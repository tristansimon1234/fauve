import "server-only";
import {
  CHAT_MODEL,
  HOUSE_PICK_AVOID,
  HOUSE_PICK_PROMPT,
  HOUSE_SOURCE,
  housePickInput,
  housePickSchema,
  readHousePick,
  type HousePickFile,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { houseInspiration } from "@/lib/house-models";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic, logClaudeCost } from "./run";

// Edith's art direction by default (packages/agent/src/house-pick.ts): a new Reel with no model, no Reel to copy and no
// form of her own is made in one of Edith's models, picked here once from her files, her request and her trade, and
// kept on the post (inspiration_id, and edith_pick: the one Edith picked, dressed in her charter). Never blocks the
// montage: unread, the Reel is made as before.

/** The model the Reel is made in: the one she chose, the one Edith picked before, or one picked now; null for none. */
export async function ensureEdithModel(input: { studioId: string; postId: string; mediaIds?: string[]; brief?: string }): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: post } = await db
    .from("posts")
    .select("kind, template, inspiration_id, edith_pick, media_ids, voice_over, voice_media_id")
    .eq("id", input.postId)
    .eq("studio_id", input.studioId)
    .maybeSingle();
  if (!post || (post.kind !== "reel" && post.kind !== "post")) return null;
  // Already picked (a design that went on after recording a voice): kept.
  if (post.inspiration_id && post.inspiration_id === post.edith_pick) return "kept";
  // Hers: a Reel to copy, a model she chose, a form she asked for (the collage).
  if (post.inspiration_id || (post.template && post.template !== "libre")) return null;
  const mediaIds = (input.mediaIds?.length ? input.mediaIds : ((post.media_ids as string[] | null) ?? [])).slice(0, 20);
  if (!mediaIds.length) return null;
  const [files, avoid, studio] = await Promise.all([pickFiles(mediaIds), recentHouseKeys(input.studioId, input.postId), db.from("studios").select("business_type").eq("id", input.studioId).maybeSingle()]);
  if (!files.length) return null;
  // A voice over the Reel (hers, or one she asked Edith for): a model with room for its subtitles.
  const voice = Boolean(post.voice_media_id) || (post.voice_over as { mode?: string } | null)?.mode === "on";
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 1500,
      output_config: { effort: "low", format: outputFormat(housePickSchema) },
      system: HOUSE_PICK_PROMPT,
      messages: [{ role: "user", content: housePickInput({ request: input.brief ?? "", business: (studio.data?.business_type as string | null) ?? null, files, voice, avoid }) }],
    });
    await logClaudeCost(input.studioId, response.usage, "house_pick", CHAT_MODEL);
    const key = readHousePick(response.parsed_output ? readAnswer(housePickSchema, response.parsed_output) : null, files.length, avoid);
    if (!key) return null;
    const house = await houseInspiration(input.studioId, key);
    if (!house) return null;
    const { error } = await db.from("posts").update({ inspiration_id: house.id, edith_pick: house.id }).eq("id", input.postId).eq("studio_id", input.studioId).is("inspiration_id", null);
    if (error) throw new Error(error.message);
    console.log("house pick", input.postId, key, response.parsed_output?.why);
    return key;
  } catch (error) {
    console.warn("house model not picked, the Reel is made freely", input.postId, error);
    return null;
  }
}

/** Her files as the picker reads them: a video's summary, length and speech, a photo's reading. */
async function pickFiles(mediaIds: string[]): Promise<HousePickFile[]> {
  const db = supabaseAdmin();
  const [{ data: assets }, { data: analyses }] = await Promise.all([
    db.from("media_assets").select("id, kind, duration, regions").in("id", mediaIds),
    db.from("clip_analyses").select("media_id, analysis").in("media_id", mediaIds).order("created_at", { ascending: false }),
  ]);
  const read = new Map<string, Record<string, unknown>>();
  for (const a of analyses ?? []) if (!read.has(a.media_id as string)) read.set(a.media_id as string, (a.analysis ?? {}) as Record<string, unknown>);
  return mediaIds.flatMap((id): HousePickFile[] => {
    const asset = (assets ?? []).find((a) => a.id === id);
    if (!asset) return [];
    if (asset.kind === "image") {
      const notes = (asset.regions as { detection?: { notes?: string } } | null)?.detection?.notes ?? "";
      return [{ kind: "photo", shows: notes || "une photo" }];
    }
    if (asset.kind !== "video") return [];
    const a = read.get(id) ?? {};
    const shows = [a.summary, a.setting].filter((x): x is string => typeof x === "string" && x.trim().length > 0).join(" ; ");
    const transcript = typeof a.transcript === "string" ? a.transcript.trim() : "";
    const seconds = typeof a.duration === "number" ? a.duration : typeof asset.duration === "number" ? asset.duration : undefined;
    return [{ kind: "video", ...(seconds ? { seconds } : {}), shows: shows || "une vidéo", ...(transcript.length > 20 ? { speaks: true } : {}) }];
  });
}

/** The models of her last Reels (the latest first), not to pick again. */
async function recentHouseKeys(studioId: string, postId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data: posts } = await db
    .from("posts")
    .select("inspiration_id")
    .eq("studio_id", studioId)
    .neq("id", postId)
    .not("inspiration_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);
  const ids = [...new Set((posts ?? []).map((p) => p.inspiration_id as string))];
  if (!ids.length) return [];
  const { data: rows } = await db.from("inspirations").select("id, external_id").in("id", ids).eq("source", HOUSE_SOURCE);
  const key = new Map((rows ?? []).map((r) => [r.id as string, r.external_id as string]));
  return [...new Set((posts ?? []).map((p) => key.get(p.inspiration_id as string)).filter((k): k is string => Boolean(k)))].slice(0, HOUSE_PICK_AVOID);
}
