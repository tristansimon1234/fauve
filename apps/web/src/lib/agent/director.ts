import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  CLAUDE_MODEL,
  DIRECTOR_LOOK_NOTE,
  DIRECTOR_PROMPT,
  EDITOR_SYSTEM_PROMPT,
  directorOutputSchema,
  lookMoments,
  motionDesignerPrompt,
  originalInstant,
  planTimeline,
  sheetCell,
  type DirectorOutput,
  type EditPlan,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { rushSheetsInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { reelStills } from "./reel-canvas";
import { anthropic, CACHE_AN_HOUR, logClaudeCost } from "./run";

// One director for a composed Reel (packages/agent/src/director.ts): what it sees before it cuts (the original's
// sheets, a sheet per video of hers, each photo), its call, and its look at its Reel next to the original.

type ImageBlock = { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } };
type TextBlock = { type: "text"; text: string; cache_control?: typeof CACHE_AN_HOUR };
export type DirectorBlock = TextBlock | ImageBlock;
type Turn = { role: "user" | "assistant"; content: string | DirectorBlock[] };

/** Its first turn and its answer, saved by the design for the look that follows it (its own step). */
export type SavedDirector = { director: true; first: DirectorBlock[]; parts: DirectorParts; answer: DirectorOutput; original: number; notes?: string[] };

/** The parts of the motion design kit its system prompt carries (the same for its look: its prompt stays cached). */
export type DirectorParts = { photos: boolean; moves: boolean; example: boolean };

const image = (jpeg: Buffer): ImageBlock => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } });
const seconds = (n: number) => n.toFixed(1).replace(".", ",");

/** A director call: the editor's prompt and the kit's, both cached an hour, streamed (a plan and a composition's code are long). */
export async function askDirector(studioId: string, parts: DirectorParts, messages: Turn[], effort: "medium" | "high" = "medium"): Promise<DirectorOutput | null> {
  const kit = motionDesignerPrompt({ composition: true, photos: parts.photos, moves: parts.moves, example: parts.example });
  const response = await anthropic()
    .beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 64000,
      output_config: { effort, format: outputFormat(directorOutputSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: EDITOR_SYSTEM_PROMPT, cache_control: CACHE_AN_HOUR },
        { type: "text", text: [DIRECTOR_PROMPT, "The motion design kit, for the composition's code:", kit.base, kit.parts].filter(Boolean).join("\n\n"), cache_control: CACHE_AN_HOUR },
      ],
      messages,
    })
    .finalMessage();
  await logClaudeCost(studioId, response.usage, "director");
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    console.warn("director: no readable answer", response.stop_reason);
    return null;
  }
  return readAnswer(directorOutputSchema, response.parsed_output);
}

/**
 * What the director is shown before its JSON: the original's sheets (each with its span), then her files (a sheet of
 * ten frames per video over its whole length, each photo), each named by its media_id; the JSON last, the whole turn
 * cached for its look.
 */
export async function directorFirstTurn(
  studioId: string,
  sheets: { from: number; to: number; jpeg: Buffer }[],
  files: { id: string; seconds: number; photo: boolean }[],
  input: unknown,
): Promise<DirectorBlock[]> {
  const db = supabaseAdmin();
  const { data: assets } = files.length ? await db.from("media_assets").select("id, storage_path").eq("studio_id", studioId).in("id", files.map((f) => f.id)) : { data: [] };
  const path = new Map((assets ?? []).map((a) => [a.id as string, a.storage_path as string]));
  const paths = files.flatMap((f) => (path.get(f.id) ? [path.get(f.id)!] : []));
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 900)).data ?? []) : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const shown = files.flatMap((f) => (url.get(path.get(f.id) ?? "") ? [{ ...f, url: url.get(path.get(f.id)!)! }] : []));
  const rushes = shown.length
    ? await rushSheetsInSandbox(`rush-${randomUUID()}`, shown.map((f) => ({ url: f.url, seconds: f.seconds, photo: f.photo }))).catch((error: unknown) => {
        console.warn("director: her files not shown", error);
        return [];
      })
    : [];
  const blocks: DirectorBlock[] = [];
  if (sheets.length) {
    blocks.push({ type: "text", text: "L'original, image par image (chaque planche : dix images dans l'ordre, de gauche à droite puis de haut en bas) :" });
    for (const s of sheets) blocks.push({ type: "text", text: `De ${seconds(s.from)} s à ${seconds(s.to)} s :` }, image(s.jpeg));
  }
  const files_ = shown.flatMap((f, i) => (rushes[i] ? [{ f, jpeg: rushes[i]! }] : []));
  if (files_.length) {
    blocks.push({ type: "text", text: "Ses fichiers (une planche de dix images par vidéo, sur toute sa durée ; chaque photo) :" });
    for (const { f, jpeg } of files_) blocks.push({ type: "text", text: f.photo ? `Photo ${f.id} :` : `Vidéo ${f.id} (${seconds(f.seconds)} s), de 0 à ${seconds(f.seconds)} s :` }, image(jpeg));
  }
  blocks.push({ type: "text", text: JSON.stringify(input), cache_control: CACHE_AN_HOUR });
  console.log("director: shown", `${sheets.length} sheets of the original, ${files_.length} of ${files.length} files`);
  return blocks;
}

/** The size of one image of her Reel in the look (its stills, at 0.4 of 1080 × 1920). */
const STILL = { width: 432, height: 768 };

/**
 * The director's look at its Reel: each still of it (its first image, each text coming in and read, each shot, its
 * end) next to the original at the same point (the nearest frame of its sheets), side by side in one image.
 */
export async function directorLookTurn(studioId: string, postId: string, plan: EditPlan, sheets: { from: number; to: number; jpeg: Buffer }[], originalLength: number): Promise<DirectorBlock[]> {
  const stills = await reelStills(studioId, postId, plan, lookMoments(plan, planTimeline(plan).segments));
  const blocks: DirectorBlock[] = [];
  for (const still of stills) {
    const t = (still.frame ?? 0) / 30;
    const at = originalInstant(t, plan.duration, originalLength);
    const cell = sheetCell(sheets, at);
    let original: Buffer | null = null;
    if (cell) {
      const sheet = sheets[cell.sheet]!.jpeg;
      const meta = await sharp(sheet).metadata();
      const w = Math.floor((meta.width ?? 0) / 5);
      const h = Math.floor((meta.height ?? 0) / 2);
      if (w > 0 && h > 0) {
        original = await sharp(sheet)
          .extract({ left: cell.col * w, top: cell.row * h, width: w, height: h })
          .resize(STILL.width, STILL.height, { fit: "contain", background: "#000" })
          .jpeg({ quality: 82 })
          .toBuffer()
          .catch(() => null);
      }
    }
    const mine = await sharp(still.jpeg).resize(STILL.width, STILL.height, { fit: "contain", background: "#000" }).jpeg({ quality: 82 }).toBuffer();
    const pair = await sharp({ create: { width: STILL.width * 2 + 8, height: STILL.height, channels: 3, background: "#ffffff" } })
      .composite([{ input: mine, left: 0, top: 0 }, ...(original ? [{ input: original, left: STILL.width + 8, top: 0 }] : [])])
      .jpeg({ quality: 82 })
      .toBuffer();
    blocks.push({ type: "text", text: `À ${seconds(t)} s : ta version à gauche, l'original à ${seconds(at)} s à droite` }, image(pair));
  }
  blocks.push({ type: "text", text: DIRECTOR_LOOK_NOTE });
  console.log("director: look", postId, `${stills.length} images`);
  return blocks;
}

/** Where a design keeps its director's turn and answer for the look (removed once read). */
export const directorPath = (studioId: string, postId: string) => `${studioId}/director/${postId}-${randomUUID()}.json`;

export async function saveDirector(path: string, saved: SavedDirector): Promise<void> {
  const { error } = await supabaseAdmin()
    .storage.from("media")
    .upload(path, Buffer.from(JSON.stringify(saved)), { contentType: "application/json", upsert: true });
  if (error) throw new Error(`director not saved: ${error.message}`);
}

export async function readDirector(path: string): Promise<SavedDirector | null> {
  const file = await supabaseAdmin().storage.from("media").download(path).catch(() => null);
  if (!file?.data) return null;
  try {
    const saved = JSON.parse(await file.data.text()) as SavedDirector;
    return saved?.director === true && Array.isArray(saved.first) && saved.answer ? saved : null;
  } catch {
    return null;
  }
}
