import "server-only";
import { randomUUID } from "node:crypto";
import {
  followedFrom,
  reelLink,
  reelMeasuresSchema,
  stealMissMessage,
  stolenStyleLines,
  stolenStyleSchema,
  tempoOf,
  usdToEur,
  type FollowedStyle,
  type StolenStyle,
} from "@fauve/agent";
import { env } from "@/lib/env";
import { googleFont } from "@/lib/fonts";
import { cutoutPath } from "@/lib/render/cutout";
import { sandboxCostEur, stealReelInSandbox, type StealMiss } from "@/lib/render/sandbox";
import { tracksPath } from "@/lib/render/tracks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { instagramVideo } from "@/lib/treg";
import { readStolenLook } from "@/lib/video/inspiration";
import { costMeta } from "@/lib/cost-scope";

// « Steal » (Tristan : « tu envoies le lien d'un Reel et il recopie la DA », « c'est one shot ») :
// a Reel she likes, from its link, a video she sent or a share to Simone on Instagram, is the
// model of one Reel of hers. It becomes an inspiration at once, is taken and measured in the
// render sandbox (its cuts, tempo, loudness), then read once by Gemini (its form, hook, texts,
// look, movement, music). The style is kept on the inspiration (inspirations.style), the video
// never; the Reel that copies it has it as its inspiration (posts.inspiration_id), and only that one.

/** Where the Reel comes from: its link, a video she sent as an example, an inspiration already kept. */
export type StealSource = { link: string } | { mediaId: string } | { inspirationId: string };

export type StealMissReason = StealMiss | "unreadable" | "not_found";

export type StealOutcome = { ok: true; inspirationId: string; style: StolenStyle; lines: string[]; reused: boolean } | { ok: false; miss: StealMissReason };

/** How long a Reel waits, at most, for the style it copies to be read (it usually takes a minute). */
export const STEAL_WAIT_MS = 4 * 60_000;
/** A Reel she sent to copy waits for her next Reel this long. */
const PENDING_MS = 48 * 3600_000;
/** Inspirations sent to be copied: a link or a video in the conversation, a share to Simone on Instagram. */
export const SENT_TO_COPY = ["link", "chat", "instagram_dm"];
/** One of her own Reels kept as a model (lib/reel-models.ts): read like a Reel to copy, never one shot. */
export const MODEL_SOURCE = "model";
/** A Reel still being read: it usually takes a minute or two. */
export const READING_MS = 15 * 60_000;

/** Simone's own Instagram account (shares to it become inspirations), when connected. */
export async function simoneHandle(): Promise<string | null> {
  const { data } = await supabaseAdmin().from("platform_accounts").select("username").eq("key", "fauve_instagram").maybeSingle();
  return (data?.username as string | null) ?? null;
}

/** What to tell her when a Reel could not be read. */
export async function missMessage(miss: StealMissReason): Promise<string> {
  return stealMissMessage(miss, miss === "unreachable" ? await simoneHandle().catch(() => null) : null);
}

const read = (inspirationId: string, style: StolenStyle, reused: boolean): StealOutcome => ({ ok: true, inspirationId, style, lines: stolenStyleLines(style), reused });

/**
 * The Reel she sends to copy becomes an inspiration at once, its id ready for her Reel (it is
 * read after the reply). The same link again is the same inspiration; a video she sent as an
 * example is copied to her inspirations, and leaves her library once read (`example`).
 */
export async function startSteal(studioId: string, source: StealSource): Promise<{ inspirationId: string; example?: { id: string; path: string } } | { miss: StealMissReason }> {
  const db = supabaseAdmin();
  if ("inspirationId" in source) {
    const { data } = await db.from("inspirations").select("id").eq("id", source.inspirationId).eq("studio_id", studioId).maybeSingle();
    return data ? { inspirationId: data.id as string } : { miss: "not_found" };
  }
  if ("link" in source) {
    const found = reelLink(source.link);
    if (!found) return { miss: "unreachable" };
    const { data: known } = await db
      .from("inspirations")
      .select("id, style, analysis, title")
      .eq("studio_id", studioId)
      .eq("url", found.url)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const kept = stolenStyleSchema.safeParse(known?.style);
    if (known) {
      const { count } = await db.from("posts").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("inspiration_id", known.id);
      // Sent again before a Reel copied it: the same one, now the latest she sent (one that could not be read is read again).
      if (!count) {
        await db
          .from("inspirations")
          .update({ created_at: new Date().toISOString(), ...(kept.success ? {} : { style: null }) })
          .eq("id", known.id);
        return { inspirationId: known.id as string };
      }
    }
    // A new Reel to copy; one a Reel of hers already copied is a new Reel to make, its reading reused.
    const { data: row, error } = await db
      .from("inspirations")
      .insert({ studio_id: studioId, source: "link", kind: "reel", url: found.url, ...(known && kept.success ? { style: known.style, analysis: known.analysis, title: known.title } : {}) })
      .select("id")
      .single();
    if (error || !row) throw new Error(`inspirations insert: ${error?.message ?? "no row"}`);
    return { inspirationId: row.id as string };
  }
  const { data: asset } = await db.from("media_assets").select("id, kind, storage_path").eq("id", source.mediaId).eq("studio_id", studioId).maybeSingle();
  if (!asset?.storage_path || asset.kind !== "video") return { miss: "not_found" };
  const from = asset.storage_path as string;
  const path = `${studioId}/inspirations/${Date.now()}-${randomUUID().slice(0, 8)}.${/\.(\w{2,4})$/.exec(from)?.[1] ?? "mp4"}`;
  const copied = await db.storage.from("media").copy(from, path);
  if (copied.error) throw new Error(`steal: example not copied: ${copied.error.message}`);
  const { data: row, error } = await db.from("inspirations").insert({ studio_id: studioId, source: "chat", kind: "video", storage_path: path }).select("id").single();
  if (error || !row) throw new Error(`inspirations insert: ${error?.message ?? "no row"}`);
  return { inspirationId: row.id as string, example: { id: asset.id as string, path: from } };
}

/**
 * A video she sent as an example leaves her library once read: it is someone else's Reel,
 * never one of her shots (taken out of the posts it was sorted into, its files removed).
 * Kept when a montage already uses it: then it was hers.
 */
export async function dropExample(studioId: string, example: { id: string; path: string }): Promise<void> {
  const db = supabaseAdmin();
  const { data: plans } = await db.from("edit_plans").select("id").contains("plan", { segments: [{ clip_id: example.id }] }).limit(1);
  if (plans?.length) return;
  const { data: posts } = await db.from("posts").select("id, media_ids").eq("studio_id", studioId).contains("media_ids", [example.id]);
  for (const post of posts ?? []) {
    await db.from("posts").update({ media_ids: ((post.media_ids as string[] | null) ?? []).filter((id) => id !== example.id) }).eq("id", post.id);
  }
  const { error } = await db.from("media_assets").delete().eq("id", example.id).eq("studio_id", studioId);
  if (error) return void console.warn("steal: example kept", example.id, error.message);
  if (example.path.startsWith(`${studioId}/`)) {
    await db.storage
      .from("media")
      .remove([example.path, tracksPath(studioId, example.id), cutoutPath(studioId, example.id, "webp"), cutoutPath(studioId, example.id, "png")])
      .catch(() => {});
  }
}

/**
 * Takes, measures and reads the Reel of an inspiration, and keeps its style on it (one already
 * read is not read again). A failure is kept too (style = { miss }): a Reel waiting for it stops
 * waiting, and a later try reads it again.
 */
export async function stealStyle(studioId: string, inspirationId: string): Promise<StealOutcome> {
  const db = supabaseAdmin();
  const { data: row } = await db.from("inspirations").select("id, url, storage_path, style, title").eq("id", inspirationId).eq("studio_id", studioId).maybeSingle();
  if (!row) return { ok: false, miss: "not_found" };
  const kept = stolenStyleSchema.safeParse(row.style);
  if (kept.success) return read(inspirationId, kept.data, true);
  const url = (row.url as string | null) ?? null;
  let take: { link: string } | { file: string };
  if (row.storage_path) {
    const signed = await db.storage.from("media").createSignedUrl(row.storage_path as string, 900);
    if (!signed.data) return { ok: false, miss: "not_found" };
    take = { file: signed.data.signedUrl };
  } else if (url) {
    // A share to Simone on Instagram comes as a file on Meta's CDN; a link, as a Reel to open.
    const link = reelLink(url);
    take = link ? { link: link.url } : { file: url };
  } else return { ok: false, miss: "not_found" };
  // One of her Reels kept as a model comes with its plan's structure, kept with its reading.
  const written = (row.style as { outline?: unknown } | null)?.outline;
  const outline = typeof written === "string" ? { outline: written } : {};
  const missed = async (miss: StealMissReason): Promise<StealOutcome> => {
    await db.from("inspirations").update({ style: { miss, ...outline } }).eq("id", inspirationId).eq("studio_id", studioId);
    return { ok: false, miss };
  };

  const started = Date.now();
  let reel = await stealReelInSandbox(`steal-${randomUUID()}`, take);
  // An Instagram link the sandbox could not open (Instagram often refuses a server): its video through Treg, read as a file.
  if ("miss" in reel && reel.miss === "unreachable" && "link" in take && reelLink(take.link)?.platform === "instagram") {
    const fetched = await instagramVideo(take.link).catch(() => null);
    if (fetched) {
      await db
        .from("cost_events")
        .insert({ studio_id: studioId, kind: "steal", provider: "treg", units: 1, cost_eur: usdToEur(fetched.costUsd, env("USD_TO_EUR")), meta: costMeta({ found: Boolean(fetched.video), cost_usd: fetched.costUsd }) });
    }
    if (fetched?.video) reel = await stealReelInSandbox(`steal-${randomUUID()}`, { file: fetched.video });
  }
  const seconds = "miss" in reel ? (Date.now() - started) / 1000 : reel.seconds;
  // A miss is kept with what yt-dlp or curl said (links without their query: no signed token in it).
  const why = "miss" in reel ? { miss: reel.miss, detail: reel.detail.replace(/\?[^\s"']*/g, "").slice(-400) } : {};
  await db
    .from("cost_events")
    .insert({ studio_id: studioId, kind: "steal", provider: "vercel_sandbox", units: Math.round(seconds), cost_eur: sandboxCostEur(seconds), meta: costMeta({ link: "link" in take, ...why }) });
  if ("miss" in reel) {
    console.warn("steal: not taken", reel.miss, reel.detail.slice(-500));
    return missed(reel.miss);
  }
  const measures = reelMeasuresSchema.parse({ duration: reel.duration, cuts: reel.cuts, bpm: tempoOf(reel.levels), lufs: reel.lufs });
  const look = await readStolenLook(studioId, reel.video, measures).catch((error: unknown) => {
    console.warn("steal: reading failed", error instanceof Error ? error.message.slice(0, 300) : error);
    return null;
  });
  if (!look) return missed("unreadable");
  // A font that makes its style, by the name Google Fonts serves it under (the render loads it from there); else hers stay.
  const { font: named, ...text } = look.text;
  const font = named ? await googleFont(named).catch(() => null) : null;
  const style: StolenStyle = { look: { ...look, text: { ...text, ...(font ? { font } : {}) } }, measures, ...outline };
  // Its three lines also stand as its reading (the inspirations list, the editor's chosen inspiration).
  const analysis = stolenStyleLines(style).join(" ");
  await db
    .from("inspirations")
    .update({ style, analysis, title: (row.title as string | null) || look.name, storage_path: null })
    .eq("id", inspirationId)
    .eq("studio_id", studioId);
  // The file was only for this reading (someone else's content, or a copy of her own Reel's video).
  if (row.storage_path) await db.storage.from("media").remove([row.storage_path as string]).catch(() => {});
  return read(inspirationId, style, false);
}

/** A Reel's style read at once (the lab, a share on Instagram): its inspiration made, read, and the example dropped. */
export async function stealNow(studioId: string, source: StealSource): Promise<StealOutcome> {
  const started = await startSteal(studioId, source);
  if ("miss" in started) return { ok: false, miss: started.miss };
  const outcome = await stealStyle(studioId, started.inspirationId);
  if (outcome.ok && started.example) await dropExample(studioId, started.example).catch((error: unknown) => console.warn("steal: example not removed", error));
  return outcome;
}

/**
 * The style a Reel copies: its inspiration's, when read. One still being read (added in the
 * last minutes) is waited for, `waitMs` at most; one that failed, or an older one read as
 * words only, gives none.
 */
export async function postStyle(studioId: string, postId: string, { waitMs = 0 }: { waitMs?: number } = {}): Promise<FollowedStyle | undefined> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("inspiration_id").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  const id = (post?.inspiration_id as string | null) ?? null;
  if (!id) return undefined;
  const deadline = Date.now() + waitMs;
  for (;;) {
    const { data: row } = await db.from("inspirations").select("source, style, analysis, created_at").eq("id", id).maybeSingle();
    if (!row) return undefined;
    const style = stolenStyleSchema.safeParse(row.style);
    if (style.success) return followedFrom(id, style.data, row.source === MODEL_SOURCE);
    // Not read yet: no style, or only a model's structure waiting for its reading (never one that missed).
    const kept = row.style as { miss?: unknown } | null;
    const reading = (!kept || !kept.miss) && !row.analysis && Date.now() - Date.parse(row.created_at as string) < READING_MS;
    if (!reading || Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

/** The Reel she sent to copy that no Reel of hers has used yet (sent in the last 48 h): for her next one. */
export async function pendingSteal(studioId: string): Promise<{ id: string; name: string | null; lines: string[] } | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("inspirations")
    .select("id, style, analysis, created_at")
    .eq("studio_id", studioId)
    .in("source", SENT_TO_COPY)
    .gt("created_at", new Date(Date.now() - PENDING_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const style = stolenStyleSchema.safeParse(data.style);
  // Read, or being read: not one that could not be read, nor the words about a photo she shared.
  const reading = !data.style && !data.analysis && Date.now() - Date.parse(data.created_at as string) < READING_MS;
  if (!style.success && !reading) return null;
  const { count } = await db.from("posts").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("inspiration_id", data.id);
  if (count) return null;
  return { id: data.id as string, name: style.success ? style.data.look.name : null, lines: style.success ? stolenStyleLines(style.data) : [] };
}
