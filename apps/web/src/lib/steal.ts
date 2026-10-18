import "server-only";
import { randomUUID } from "node:crypto";
import {
  followedFrom,
  reelLink,
  reelMeasuresSchema,
  stealMissMessage,
  stealOfferAnswer,
  stolenStyleLines,
  stolenStyleSchema,
  tempoOf,
  type FollowedStyle,
  type StolenStyle,
} from "@fauve/agent";
import { z } from "zod";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { cutoutPath } from "@/lib/render/cutout";
import { sandboxCostEur, stealReelInSandbox, type StealMiss } from "@/lib/render/sandbox";
import { tracksPath } from "@/lib/render/tracks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readStolenLook } from "@/lib/video/inspiration";

// « Steal » (Tristan : « tu envoies le lien d'un Reel et il recopie la DA ») : a Reel she likes,
// from its link, a video she sent or a share to Simone on Instagram, is taken and measured in
// the render sandbox (its cuts, tempo, loudness), then read once by Gemini (its form, hook,
// texts, look, movement, music). The style is kept on an inspiration (inspirations.style), the
// video never; once she says so, her next Reels follow it (brand_profiles.profile.followed).

/** Where the Reel comes from: its link, a video she sent as an example, an inspiration already kept. */
export type StealSource = { link: string } | { mediaId: string } | { inspirationId: string };

export type StealOutcome =
  | { ok: true; inspirationId: string; style: StolenStyle; lines: string[]; reused: boolean }
  | { ok: false; miss: StealMiss | "unreadable" | "not_found" };

/** Simone's own Instagram account (shares to it become inspirations), when connected. */
export async function simoneHandle(): Promise<string | null> {
  const { data } = await supabaseAdmin().from("platform_accounts").select("username").eq("key", "fauve_instagram").maybeSingle();
  return (data?.username as string | null) ?? null;
}

/** What to tell her when a Reel could not be read. */
export async function missMessage(miss: Exclude<StealOutcome, { ok: true }>["miss"]): Promise<string> {
  return stealMissMessage(miss, miss === "unreachable" ? await simoneHandle().catch(() => null) : null);
}

const read = (inspirationId: string, style: StolenStyle, reused: boolean): StealOutcome => ({ ok: true, inspirationId, style, lines: stolenStyleLines(style), reused });

/**
 * A video she sent as an example leaves her library once read: it is someone else's Reel,
 * never one of her shots (taken out of the posts it was sorted into, its files removed).
 * Kept when a montage already uses it: then it was hers.
 */
async function dropExample(studioId: string, mediaId: string, path: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: plans } = await db.from("edit_plans").select("id").contains("plan", { segments: [{ clip_id: mediaId }] }).limit(1);
  if (plans?.length) return;
  const { data: posts } = await db.from("posts").select("id, media_ids").eq("studio_id", studioId).contains("media_ids", [mediaId]);
  for (const post of posts ?? []) {
    await db.from("posts").update({ media_ids: ((post.media_ids as string[] | null) ?? []).filter((id) => id !== mediaId) }).eq("id", post.id);
  }
  const { error } = await db.from("media_assets").delete().eq("id", mediaId).eq("studio_id", studioId);
  if (error) return void console.warn("steal: example kept", mediaId, error.message);
  if (path.startsWith(`${studioId}/`)) {
    await db.storage.from("media").remove([path, tracksPath(studioId, mediaId), cutoutPath(studioId, mediaId, "webp"), cutoutPath(studioId, mediaId, "png")]).catch(() => {});
  }
}

/** Takes, measures and reads a Reel, and keeps its style on an inspiration (a Reel already read is not read again). */
export async function stealStyle(studioId: string, source: StealSource): Promise<StealOutcome> {
  const db = supabaseAdmin();
  let take: { link: string } | { file: string };
  let inspirationId: string | null = null;
  let url: string | null = null;
  let example: { id: string; path: string } | null = null;
  if ("link" in source) {
    const found = reelLink(source.link);
    if (!found) return { ok: false, miss: "unreachable" };
    url = found.url;
    const { data: known } = await db
      .from("inspirations")
      .select("id, style")
      .eq("studio_id", studioId)
      .eq("url", url)
      .not("style", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const kept = known ? stolenStyleSchema.safeParse(known.style) : null;
    if (known && kept?.success) return read(known.id as string, kept.data, true);
    take = { link: url };
  } else if ("mediaId" in source) {
    const { data: asset } = await db.from("media_assets").select("id, kind, storage_path").eq("id", source.mediaId).eq("studio_id", studioId).maybeSingle();
    if (!asset?.storage_path || asset.kind !== "video") return { ok: false, miss: "not_found" };
    const signed = await db.storage.from("media").createSignedUrl(asset.storage_path as string, 900);
    if (!signed.data) return { ok: false, miss: "not_found" };
    take = { file: signed.data.signedUrl };
    example = { id: asset.id as string, path: asset.storage_path as string };
  } else {
    const { data: row } = await db.from("inspirations").select("id, url, storage_path, style").eq("id", source.inspirationId).eq("studio_id", studioId).maybeSingle();
    if (!row) return { ok: false, miss: "not_found" };
    const kept = stolenStyleSchema.safeParse(row.style);
    if (kept.success) return read(row.id as string, kept.data, true);
    inspirationId = row.id as string;
    url = (row.url as string | null) ?? null;
    if (row.storage_path) {
      const signed = await db.storage.from("media").createSignedUrl(row.storage_path as string, 900);
      if (!signed.data) return { ok: false, miss: "not_found" };
      take = { file: signed.data.signedUrl };
    } else if (url) {
      // A share to Simone on Instagram comes as a file on Meta's CDN; a link, as a Reel to open.
      const link = reelLink(url);
      take = link ? { link: link.url } : { file: url };
    } else return { ok: false, miss: "not_found" };
  }

  const started = Date.now();
  const reel = await stealReelInSandbox(`steal-${randomUUID()}`, take);
  const seconds = "miss" in reel ? (Date.now() - started) / 1000 : reel.seconds;
  // A miss is kept with what yt-dlp or curl said (links without their query: no signed token in it).
  const why = "miss" in reel ? { miss: reel.miss, detail: reel.detail.replace(/\?[^\s"']*/g, "").slice(-400) } : {};
  await db
    .from("cost_events")
    .insert({ studio_id: studioId, kind: "steal", provider: "vercel_sandbox", units: Math.round(seconds), cost_eur: sandboxCostEur(seconds), meta: { link: "link" in take, ...why } });
  if ("miss" in reel) {
    console.warn("steal: not taken", reel.miss, reel.detail.slice(-500));
    return { ok: false, miss: reel.miss };
  }
  const measures = reelMeasuresSchema.parse({ duration: reel.duration, cuts: reel.cuts, bpm: tempoOf(reel.levels), lufs: reel.lufs });
  const look = await readStolenLook(studioId, reel.video, measures).catch((error: unknown) => {
    console.warn("steal: reading failed", error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
  });
  if (!look) return { ok: false, miss: "unreadable" };
  const style: StolenStyle = { look, measures };
  // Its three lines also stand as its reading (the inspirations list, the editor's chosen inspiration).
  const analysis = stolenStyleLines(style).join(" ");

  if (inspirationId) {
    const { data: row } = await db.from("inspirations").select("title, storage_path").eq("id", inspirationId).maybeSingle();
    await db
      .from("inspirations")
      .update({ style, analysis, title: (row?.title as string | null) || look.name, storage_path: null })
      .eq("id", inspirationId)
      .eq("studio_id", studioId);
    // The file she added was only for this reading (someone else's content).
    if (row?.storage_path) await db.storage.from("media").remove([row.storage_path as string]).catch(() => {});
  } else {
    const { data: row, error } = await db
      .from("inspirations")
      .insert({ studio_id: studioId, source: example ? "chat" : "link", kind: "reel", url, title: look.name, analysis, style })
      .select("id")
      .single();
    if (error || !row) throw new Error(`inspirations insert: ${error?.message ?? "no row"}`);
    inspirationId = row.id as string;
  }
  if (example) await dropExample(studioId, example.id, example.path).catch((error: unknown) => console.warn("steal: example not removed", error));
  return read(inspirationId, style, false);
}

/** Her next Reels follow this inspiration's style (null: none any more). Returns what is followed. */
export async function followStyle(studioId: string, inspirationId: string | null): Promise<FollowedStyle | null> {
  if (!inspirationId) {
    await insertProfileVersion(studioId, (profile) => {
      const next: Record<string, unknown> = { ...profile };
      delete next.followed;
      return next;
    });
    return null;
  }
  const { data } = await supabaseAdmin().from("inspirations").select("style").eq("id", inspirationId).eq("studio_id", studioId).maybeSingle();
  const style = stolenStyleSchema.safeParse(data?.style);
  if (!style.success) return null;
  const followed = followedFrom(inspirationId, style.data);
  await insertProfileVersion(studioId, (profile) => ({ ...profile, followed }));
  return followed;
}

const offerSchema = z.object({ steal_offer: z.uuid() });

/**
 * « Suivre ce style » / « Non merci » under the three lines Simone sent about a Reel:
 * answered at once, with no Simone turn. Any other answer goes to Simone as usual.
 */
export async function answerStealOffer(
  studioId: string,
  text: string | null | undefined,
  lastOutbound: { payload: unknown } | null,
): Promise<{ reply: string; body: string; payload: Record<string, unknown> } | null> {
  const answer = stealOfferAnswer(text);
  const offered = offerSchema.safeParse(lastOutbound?.payload);
  if (!answer || !offered.success) return null;
  if (answer === "skip") {
    const line = "Pas de souci, je le garde dans tes inspirations sans rien changer à tes Reels.";
    return { reply: line, body: line, payload: {} };
  }
  const followed = await followStyle(studioId, offered.data.steal_offer);
  if (!followed) return null;
  const line = `C’est noté ✅ Tes prochains Reels suivent ce style (« ${followed.look.name} »), avec tes couleurs et tes polices. Tu peux l’arrêter quand tu veux dans Style, ou en me le disant.`;
  return { reply: line, body: line, payload: {} };
}
