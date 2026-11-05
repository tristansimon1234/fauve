import "server-only";
import {
  CHAT_MODEL,
  HOUSE_PICK_AVOID,
  OWN_LOOK_WORDS,
  HOUSE_PICK_PROMPT,
  HOUSE_SOURCE,
  housePickInput,
  housePickSchema,
  readHousePick,
  houseModel,
  type HousePickFile,
  type HousePickTaste,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { MONTAGE_SKILLS } from "@fauve/agent/skills";
import { houseInspiration } from "@/lib/house-models";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic, logClaudeCost } from "./run";

/** The files each model coded as a montage skill wants at least: Edith picks one only when her files fill it. */
const SKILL_LEAST: Record<string, number> = Object.fromEntries(Object.values(MONTAGE_SKILLS).map((s) => [s.key, s.files[0]]));

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
  const [files, avoid, studio, taste] = await Promise.all([
    pickFiles(mediaIds),
    recentHouseKeys(input.studioId, input.postId),
    db.from("studios").select("business_type").eq("id", input.studioId).maybeSingle(),
    tasteOf(input.studioId, input.postId).catch(() => undefined),
  ]);
  if (!files.length) return null;
  // A voice over the Reel (hers, or one she asked Edith for): a model with room for its subtitles.
  const voice = Boolean(post.voice_media_id) || (post.voice_over as { mode?: string } | null)?.mode === "on";
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 1500,
      output_config: { effort: "low", format: outputFormat(housePickSchema) },
      system: HOUSE_PICK_PROMPT,
      messages: [{ role: "user", content: housePickInput({ request: input.brief ?? "", business: (studio.data?.business_type as string | null) ?? null, files, voice, avoid, least: SKILL_LEAST, taste }) }],
    });
    await logClaudeCost(input.studioId, response.usage, "house_pick", CHAT_MODEL);
    const key = readHousePick(response.parsed_output ? readAnswer(housePickSchema, response.parsed_output) : null, files.length, avoid, SKILL_LEAST);
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

/** A look's name and hook as its reading wrote them (a Reel she sent to copy, one she kept as a model). */
function lookLine(style: unknown): string | null {
  const look = (style as { look?: { name?: unknown; hook?: { what?: unknown } } } | null)?.look;
  const name = typeof look?.name === "string" ? look.name.trim() : "";
  const hook = typeof look?.hook?.what === "string" ? look.hook.what.trim() : "";
  return name || hook ? [name, hook].filter(Boolean).join(" : ") : null;
}

/**
 * Her taste for the picker (Tristan: « attention, le user a aussi un mood board »): her moodboard's reading and her art
 * direction (« Ton style »), the Reels she sent to copy and those she kept as models (their looks, read once), the
 * models of the Reels she published. A few rows read in one go; never blocks the pick.
 */
async function tasteOf(studioId: string, postId: string): Promise<HousePickTaste | undefined> {
  const db = supabaseAdmin();
  const [brand, sent, kept, published] = await Promise.all([
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("inspirations").select("style").eq("studio_id", studioId).in("source", ["link", "chat", "web_upload"]).not("style", "is", null).order("created_at", { ascending: false }).limit(3),
    db.from("inspirations").select("style").eq("studio_id", studioId).eq("source", "model").not("style", "is", null).order("created_at", { ascending: false }).limit(3),
    db.from("posts").select("inspiration_id").eq("studio_id", studioId).eq("status", "published").neq("id", postId).not("inspiration_id", "is", null).order("created_at", { ascending: false }).limit(8),
  ]);
  const profile = (brand.data?.profile ?? {}) as { art_direction?: unknown; moodboard?: { reading?: unknown } };
  const ids = [...new Set((published.data ?? []).map((p) => p.inspiration_id as string))];
  const houses = ids.length ? ((await db.from("inspirations").select("external_id").in("id", ids).eq("source", HOUSE_SOURCE)).data ?? []) : [];
  return {
    moodboard: typeof profile.moodboard?.reading === "string" ? profile.moodboard.reading : undefined,
    direction: typeof profile.art_direction === "string" ? profile.art_direction : undefined,
    copied: (sent.data ?? []).map((r) => lookLine(r.style)).filter((l): l is string => Boolean(l)),
    kept: (kept.data ?? []).map((r) => lookLine(r.style)).filter((l): l is string => Boolean(l)),
    published: houses.map((h) => houseModel(h.external_id as string)?.name).filter((n): n is string => Boolean(n)),
  };
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

/**
 * A Reel she copies is faithful to its model (Tristan: « la DA s'applique s'il demande »): her charter dresses it only
 * when her request asks for it (« avec mes couleurs », « à ma charte »), read once when a new montage starts.
 */
export async function ensureCopyCharter(input: { studioId: string; postId: string; brief?: string }): Promise<void> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("inspiration_id, edith_pick, copy_charter").eq("id", input.postId).eq("studio_id", input.studioId).maybeSingle();
  if (!post?.inspiration_id || post.inspiration_id === post.edith_pick) return;
  const asked = OWN_LOOK_WORDS.test(input.brief ?? "");
  if (asked !== post.copy_charter) await db.from("posts").update({ copy_charter: asked }).eq("id", input.postId).eq("studio_id", input.studioId);
}
