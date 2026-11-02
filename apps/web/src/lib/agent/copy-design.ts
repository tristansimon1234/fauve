import "server-only";
import {
  BRIEF_MAX,
  CHAT_MODEL,
  contractLines,
  COPY_WORDS_PROMPT,
  copyable,
  copyPlan,
  copyWordsSchema,
  cutoutSchema,
  finishPlan,
  followedLook,
  laysCutouts,
  memoryLines,
  shotScore,
  type ClipAnalysis,
  type CopyFile,
  type CopyWords,
  type EditPlan,
  type FollowedStyle,
  type MediaFacts,
  type ReelContract,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { insertPlanVersion } from "@/lib/edit-plans";
import { ensureCutouts } from "@/lib/render/cutout";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic, logClaudeCost } from "./run";

// A simple copied Reel remade by code (packages/agent/src/copy.ts): one small call writes its words and says whether
// her request is served by it; the plan is code. Anything else goes to the editor, as before.

/** How long the cut-outs of her photos are waited for (their own sandbox, 10 to 30 s a photo). */
const CUTOUTS_WAIT_MS = 4 * 60_000;
/** The most photos cut out for a copy. */
const MAX_CUT = 10;

export type CopyDesign = { plan: EditPlan; editPlanId: string; version: number; rationale: string };

/** Whether a Reel she copies can be remade by code at all, before anything is asked (its form, her request's fixed points, her voice). */
export function copyCandidate(followed: FollowedStyle | undefined, contract: ReelContract | undefined, voice: boolean): followed is FollowedStyle & { measured: NonNullable<FollowedStyle["measured"]> } {
  return Boolean(
    followed &&
      !followed.own &&
      followed.measured &&
      copyable(followed.look, followed.measured) &&
      !voice &&
      !contract?.layout &&
      !contract?.voice_text &&
      !contract?.voice_text_rest,
  );
}

/**
 * Remakes the Reel she copies by code, or returns null when her request needs more than the code does (the editor
 * then makes it) or its words could not be written.
 */
export async function designCopy(params: {
  studioId: string;
  postId: string;
  followed: FollowedStyle & { measured: NonNullable<FollowedStyle["measured"]> };
  /** Her files, in her order. */
  mediaIds: string[];
  clips: { media_id: string; analysis: ClipAnalysis }[];
  photos: MediaFacts["photos"];
  brief?: string;
  contract?: ReelContract;
  /** The version corrected, when it is a copy: its words are kept but what her request changes. */
  previous?: EditPlan | null;
  studio: { name?: string | null; business?: string | null; memory?: unknown; booking?: boolean; tone?: string };
}): Promise<CopyDesign | null> {
  const { followed } = params;
  const look = followed.look;
  const photoIds = params.mediaIds.filter((id) => params.photos[id]);
  // Her photos' subjects, cut out once (laid over the other shots when the model lays some).
  if (laysCutouts(look) && photoIds.length) {
    await Promise.race([ensureCutouts(params.studioId, photoIds.slice(0, MAX_CUT)).catch((e: unknown) => console.warn("copy: cut-outs not ready", e)), new Promise((resolve) => setTimeout(resolve, CUTOUTS_WAIT_MS))]);
  }
  const cutouts = photoIds.length
    ? new Map(
        ((await supabaseAdmin().from("media_assets").select("id, cutout").eq("studio_id", params.studioId).in("id", photoIds)).data ?? []).flatMap((a) => {
          const cut = cutoutSchema.safeParse(a.cutout);
          // Only a clean subject (a sticker's rule): a cut-out with a ragged edge is not laid.
          return cut.success && cut.data.sticker && cut.data.path.startsWith(`${params.studioId}/`) ? [[a.id as string, cut.data] as const] : [];
        }),
      )
    : new Map();

  const files: CopyFile[] = params.mediaIds.flatMap((id): CopyFile[] => {
    if (params.photos[id]) {
      const cut = cutouts.get(id);
      // Someone stands on the bottom edge (a face was read on the photo); an object sits big in the middle.
      const person = params.photos[id]!.detection.regions.some((r) => r.kind === "face");
      return [{ id, photo: true, seconds: 0, ...(cut ? { cutout: { tall: (cut.box.h * cut.h) / Math.max(1, cut.box.w * cut.w), person } } : {}) }];
    }
    const clip = params.clips.find((c) => c.media_id === id);
    if (!clip) return [];
    const a = clip.analysis;
    // Its best moments, then its clean shots, best first: a blurry or dark passage comes last.
    const shots = [...a.shots].filter((s) => !s.quality.blurry && !s.quality.dark).sort((x, y) => shotScore(y, a) - shotScore(x, a));
    return [{ id, photo: false, seconds: a.duration, moments: [...a.best_moments, ...shots].map((m) => ({ start: m.start, end: m.end })) }];
  });
  if (!files.length) return null;

  const words = await copyWords(params);
  if (!words) return null;
  if (!words.fits) {
    console.log("copy: her request needs the editor", params.postId, words.missing);
    return null;
  }
  const plan = copyPlan({ cuts: followed.measured.cuts, duration: followed.measured.duration, bpm: followed.bpm, files, look, words });
  Object.assign(plan, followedLook(plan, followed));
  // Each shot framed on its subject and its light corrected, as any montage.
  const durations = Object.fromEntries(files.map((f) => [f.id, f.photo ? plan.duration : f.seconds]));
  const facts: MediaFacts = { clips: Object.fromEntries(params.clips.map((c) => [c.media_id, c.analysis])), photos: params.photos, tracks: {} };
  Object.assign(plan, finishPlan(plan, facts, durations));

  const row = await insertPlanVersion(params.studioId, params.postId, plan);
  await supabaseAdmin().from("posts").update({ edit_plan_id: row.id }).eq("id", params.postId);
  const laid = plan.copy?.cutouts.length ?? 0;
  return {
    plan,
    editPlanId: row.id,
    version: row.version,
    rationale: `Je l'ai refait sur les coupes exactes du Reel que tu m'as envoyé${laid ? ", avec les sujets de tes photos détourés par-dessus" : ""}${plan.copy?.title ? ", et son titre dans sa police" : ""}.`,
  };
}

/** Its words and whether her request fits, in one small call (Sonnet). Null when it fails: the editor makes the Reel. */
async function copyWords(params: Parameters<typeof designCopy>[0]): Promise<(CopyWords & { fits: boolean; missing: string }) | null> {
  const look = params.followed.look;
  const current = params.previous?.copy;
  const input = {
    commerce: {
      nom: params.studio.name ?? undefined,
      activite: params.studio.business ?? undefined,
      ce_qu_on_sait: memoryLines(params.studio.memory),
      lien_de_reservation: params.studio.booking ? "oui, dans sa bio" : "non",
      ton: params.studio.tone,
    },
    demande: params.brief?.slice(0, BRIEF_MAX) || "Refaire le Reel envoyé, avec ses fichiers.",
    ...(contractLines(params.contract).length ? { contrat: contractLines(params.contract) } : {}),
    reel_modele: {
      texte: look.text.amount,
      composition_du_titre: look.text.composition,
      casse: look.text.case === "upper" ? "capitales" : "normale",
      lignes: look.text.lines === "staggered" ? "décalées" : "alignées",
      fin: look.ending,
    },
    ...(current ? { version_actuelle: { titre: current.title?.lines ?? [], fin: current.end?.cards.map((c) => c.lines) ?? [] } } : {}),
  };
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: outputFormat(copyWordsSchema) },
      system: COPY_WORDS_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    await logClaudeCost(params.studioId, response.usage, "copy_words", CHAT_MODEL);
    if (!response.parsed_output) return null;
    const answer = readAnswer(copyWordsSchema, response.parsed_output);
    const line = (l: string) => l.trim().slice(0, 48);
    return {
      fits: answer.fits,
      missing: answer.missing.trim().slice(0, 200),
      title: answer.title.map(line).filter(Boolean).slice(0, 4),
      end: answer.end.map((card) => card.map(line).filter(Boolean).slice(0, 3)).filter((card) => card.length).slice(0, 3),
    };
  } catch (error) {
    console.warn("copy: its words could not be written, the editor makes it", error);
    return null;
  }
}
