import "server-only";
import {
  curateIdeas,
  IDEA_PREVIEW_DIR,
  IDEAS_FLOOR,
  ideaCity,
  ideaMonth,
  ideaName,
  ideaPitch,
  ideaPreviewPath,
  ideaTrade,
  memoryLines,
  studioPlaceSchema,
  type IdeaCandidate,
  type IdeaFile,
} from "@fauve/agent";
import { MONTAGE_SKILLS } from "@fauve/agent/skills";
import { cacheLife } from "next/cache";
import { pickFiles, recentHouseKeys } from "@/lib/agent/house-pick";
import { skillGate } from "@/lib/skill-reviews";
import { supabaseAdmin } from "@/lib/supabase/admin";

// « Regarde nos idées » (packages/agent/src/house-ideas.ts; docs/modeles.md, « Nos modèles restent internes »): the
// ideas of form a business is shown for a new Reel, kept on an offer (idea_offers) that the Créer screen and the page
// of her phone (/idees/<id>) read. Only models whose skill plays for her (skillGate: validated by Tristan; all for the
// team's studio and the lab) and whose preview is kept (house/previews/<key>.mp4, uploaded by /api/admin/house-previews,
// never public: signed links for her studio's members only).

/** The models whose preview is kept (both its loop and its poster), read at most every five minutes. */
async function keptPreviews(): Promise<string[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 900 });
  const { data, error } = await supabaseAdmin().storage.from("media").list(IDEA_PREVIEW_DIR, { limit: 500 });
  // A failure throws, so it is not kept.
  if (error) throw new Error(error.message);
  const names = new Set((data ?? []).map((f) => f.name));
  return [...names].filter((n) => n.endsWith(".mp4") && names.has(n.replace(/\.mp4$/, ".jpg"))).map((n) => n.replace(/\.mp4$/, ""));
}

/** The previews' signed links (two hours; each served link still valid an hour). */
async function signedPreviews(keys: string[]): Promise<Record<string, string>> {
  "use cache";
  cacheLife({ stale: 1800, revalidate: 1800, expire: 3600 });
  const paths = keys.flatMap((k) => [ideaPreviewPath(k, "mp4"), ideaPreviewPath(k, "jpg")]);
  const { data, error } = await supabaseAdmin().storage.from("media").createSignedUrls(paths, 7200);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).flatMap((item) => (item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl]] : [])));
}

/** The models that may be shown to this business: its skill plays for her, its preview is kept. */
export async function ideaCandidates(studioId: string): Promise<IdeaCandidate[]> {
  const [gate, previews] = await Promise.all([skillGate(studioId), keptPreviews().catch(() => [] as string[])]);
  const kept = new Set(previews);
  return Object.values(MONTAGE_SKILLS)
    .filter((s) => kept.has(s.key) && gate(s) && ideaName(s.key))
    .map((s) => ({ key: s.key, least: s.files[0] }));
}

/** Whether the ideas door can be offered to this business at all (before her files are known). */
export async function ideasPossible(studioId: string): Promise<boolean> {
  return (await ideaCandidates(studioId).catch(() => [])).length >= IDEAS_FLOOR;
}

/** One idea as she sees it: its name, what it does, its loop and its poster. */
export type IdeaCard = { key: string; name: string; pitch: string; video: string; poster: string };

/** The cards of these ideas, in order (one whose preview could not be signed is left out). */
export async function ideaCards(keys: string[]): Promise<IdeaCard[]> {
  if (!keys.length) return [];
  const signed = await signedPreviews([...keys].sort()).catch((error: unknown) => {
    console.warn("ideas: previews not signed", error instanceof Error ? error.message : error);
    return {} as Record<string, string>;
  });
  return keys.flatMap((key) => {
    const name = ideaName(key);
    const video = signed[ideaPreviewPath(key, "mp4")];
    const poster = signed[ideaPreviewPath(key, "jpg")];
    return name && video && poster ? [{ key, name, pitch: ideaPitch(key) ?? "", video, poster }] : [];
  });
}

/** Her files for the curation: her library's, read (their reading, their shape), and new ones not in it yet by their kind. */
async function ideaFiles(studioId: string, mediaIds: string[], extra: IdeaFile[]): Promise<IdeaFile[]> {
  const db = supabaseAdmin();
  const owned = mediaIds.length ? ((await db.from("media_assets").select("id").eq("studio_id", studioId).in("id", mediaIds)).data ?? []).map((r) => r.id as string) : [];
  const read = owned.length ? await pickFiles(mediaIds.filter((id) => owned.includes(id))) : [];
  // A reading not there yet (« une vidéo ») is no reading.
  return [...read.map((f) => ({ ...f, shows: /^une (?:vidéo|photo)$/.test(f.shows) ? "" : f.shows })), ...extra].slice(0, 20);
}

export type IdeaOffer = { id: string; keys: string[] };

/**
 * Ideas for her new Reel, kept on an offer: curated for her trade and her files, without what a business of her trade
 * in her city was shown this month when enough is left. The same files offered again the same day keep their offer.
 * Null when fewer than IDEAS_FLOOR fit (the door is then not offered).
 */
export async function offerIdeas(input: { studioId: string; mediaIds: string[]; via: "app" | "whatsapp"; extra?: IdeaFile[]; now?: Date }): Promise<IdeaOffer | null> {
  const db = supabaseAdmin();
  const now = input.now ?? new Date();
  const { data: studio } = await db.from("studios").select("business_type, timezone, place, memory").eq("id", input.studioId).maybeSingle();
  if (!studio) return null;
  const mediaIds = [...new Set(input.mediaIds)].slice(0, 20);
  // The same files, today, not chosen yet: the same ideas (she came back to the page, or asked twice).
  const since = new Date(now.getTime() - 12 * 3600_000).toISOString();
  const { data: earlier } = await db
    .from("idea_offers")
    .select("id, keys, media_ids")
    .eq("studio_id", input.studioId)
    .is("chosen", null)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  const same = (earlier ?? []).find((o) => !input.extra?.length && sameSet(o.media_ids as string[], mediaIds));
  if (same) return { id: same.id as string, keys: same.keys as string[] };

  const trade = ideaTrade(studio.business_type as string | null);
  const place = studioPlaceSchema.safeParse(studio.place);
  const city = ideaCity({ address: place.success ? place.data.address : null, facts: memoryLines(studio.memory), businessType: studio.business_type as string | null });
  const month = ideaMonth(now, (studio.timezone as string | null) ?? "Europe/Paris");
  const [candidates, files, recent, others] = await Promise.all([
    ideaCandidates(input.studioId),
    ideaFiles(input.studioId, mediaIds, input.extra ?? []),
    recentHouseKeys(input.studioId, "00000000-0000-0000-0000-000000000000").catch(() => [] as string[]),
    shownNearby(input.studioId, trade, city, month),
  ]);
  const keys = curateIdeas({ studioId: input.studioId, month, trade, files, candidates, taken: others, recent });
  if (!keys.length) return null;
  const { data, error } = await db
    .from("idea_offers")
    .insert({ studio_id: input.studioId, media_ids: mediaIds, keys, trade, city, month, via: input.via })
    .select("id")
    .single();
  if (error || !data) throw new Error(`idea_offers: ${error?.message ?? "no row"}`);
  return { id: data.id as string, keys };
}

/** What businesses of her trade were shown this month: in her city when it is known (and those whose city is not), else everywhere. */
async function shownNearby(studioId: string, trade: string, city: string | null, month: string): Promise<string[]> {
  let query = supabaseAdmin().from("idea_offers").select("keys").eq("trade", trade).eq("month", month).neq("studio_id", studioId).limit(500);
  if (city) query = query.or(`city.eq."${city.replace(/[^a-z ]/g, "")}",city.is.null`);
  const { data } = await query;
  return [...new Set((data ?? []).flatMap((r) => (r.keys as string[] | null) ?? []))];
}

const sameSet = (a: string[] | null, b: string[]) => {
  const left = new Set((a ?? []).map((x) => x.toLowerCase()));
  return left.size === b.length && b.every((x) => left.has(x.toLowerCase()));
};

/** An offer of hers, as a page reads it. */
export async function readOffer(studioId: string, offerId: string) {
  const { data } = await supabaseAdmin().from("idea_offers").select("id, keys, media_ids, chosen, post_id").eq("id", offerId).eq("studio_id", studioId).maybeSingle();
  return data
    ? { id: data.id as string, keys: (data.keys as string[]) ?? [], mediaIds: (data.media_ids as string[]) ?? [], chosen: (data.chosen as string | null) ?? null, postId: (data.post_id as string | null) ?? null }
    : null;
}

/** Her choice, kept on the offer (one of the ideas it showed). */
export async function chooseOffered(studioId: string, offerId: string, key: string): Promise<boolean> {
  const offer = await readOffer(studioId, offerId);
  if (!offer?.keys.includes(key)) return false;
  const { error } = await supabaseAdmin().from("idea_offers").update({ chosen: key, chosen_at: new Date().toISOString() }).eq("id", offerId).eq("studio_id", studioId);
  return !error;
}

/** The post her chosen idea made (set once the Reel is launched). */
export async function linkOfferPost(studioId: string, offerId: string, postId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("idea_offers").update({ post_id: postId }).eq("id", offerId).eq("studio_id", studioId).not("chosen", "is", null);
  if (error) console.warn("ideas: post not linked to its offer", offerId, error.message);
}
