import "server-only";
import { compressedVideo } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The quality her WhatsApp videos arrive in (packages/agent/src/video-quality.ts): in HD, Edith asks for them here and
// adds no upload link; compressed, she is told once how to set HD, the upload link staying as a fallback.

/** A compressed video this recent is the one she just sent: the tip goes with this answer. */
const FRESH_MS = 15 * 60_000;

export type WhatsAppVideos = {
  /** Her latest measured WhatsApp video: in full quality, compressed, or none measured yet. */
  quality: "full" | "compressed" | null;
  /** A compressed video in the last minutes, and she was never told how to send in HD. */
  tipNow: boolean;
};

export async function whatsappVideos(
  studioId: string,
): Promise<WhatsAppVideos> {
  const db = supabaseAdmin();
  const [videos, studio] = await Promise.all([
    db
      .from("media_assets")
      .select("size_bytes, duration, width, height, created_at")
      .eq("studio_id", studioId)
      .eq("source", "whatsapp")
      .eq("kind", "video")
      .gt("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(6),
    db.from("studios").select("hd_tip_at").eq("id", studioId).maybeSingle(),
  ]);
  const measured = (videos.data ?? []).map((v) => ({
    at: Date.parse(v.created_at as string),
    compressed: compressedVideo({
      bytes: Number(v.size_bytes) || null,
      duration: Number(v.duration) || null,
      width: (v.width as number | null) ?? null,
      height: (v.height as number | null) ?? null,
    }),
  }));
  const latest = measured.find((v) => v.compressed !== null);
  const fresh = measured.some(
    (v) => v.compressed && Date.now() - v.at < FRESH_MS,
  );
  return {
    quality: latest ? (latest.compressed ? "compressed" : "full") : null,
    tipNow: fresh && !studio.data?.hd_tip_at,
  };
}

/** The tip is given once: noted when it goes out. */
export async function markHdTip(studioId: string): Promise<void> {
  await supabaseAdmin()
    .from("studios")
    .update({ hd_tip_at: new Date().toISOString() })
    .eq("id", studioId)
    .is("hd_tip_at", null);
}
