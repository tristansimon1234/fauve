import "server-only";
import { randomUUID } from "node:crypto";
import { needsStabilizing, shakyShare, type ClipAnalysis } from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { cutoutCostEur, stabilizeInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A shaky video steadied once, as soon as Gemini has read it: the steady copy takes
// the place of the file (storage_path), so tracking, face boxes, renders and the
// previews all see the same picture. The original is kept (original_path) and goes
// with the media at retention. Its tracks and blur zones, read on the shaky picture,
// are dropped to be read again on the steady one.

/** Where a video's steady copy is kept. */
export const stabilizedPath = (studioId: string, mediaId: string) => `${studioId}/stabilized/${mediaId}.mp4`;

/** Steadies the video when Gemini saw it shake; never fails its analysis (the shaky file stays). */
export async function stabilizeIfShaky(asset: { id: string; studio_id: string; storage_path: string }, analysis: ClipAnalysis): Promise<void> {
  if (!needsStabilizing(analysis)) return;
  const db = supabaseAdmin();
  try {
    const signed = await db.storage.from("media").createSignedUrl(asset.storage_path, 3600);
    if (!signed.data?.signedUrl) throw new Error(signed.error?.message ?? "no signed url");
    const { video, seconds } = await stabilizeInSandbox(`stab-${randomUUID()}`, signed.data.signedUrl);
    const path = stabilizedPath(asset.studio_id, asset.id);
    const uploaded = await db.storage.from("media").upload(path, video, { contentType: "video/mp4", upsert: true });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const swapped = await db
      .from("media_assets")
      .update({
        storage_path: path,
        original_path: asset.storage_path,
        mime_type: "video/mp4",
        stabilized: { at: new Date().toISOString(), shaky_share: Math.round(shakyShare(analysis) * 100) / 100 },
        tracks: null,
        regions: null,
      })
      .eq("id", asset.id)
      .eq("studio_id", asset.studio_id);
    if (swapped.error) throw new Error(swapped.error.message);
    await db.from("cost_events").insert({
      studio_id: asset.studio_id,
      kind: "stabilize",
      provider: "vercel_sandbox",
      units: Math.round(seconds),
      cost_eur: cutoutCostEur(seconds),
      meta: costMeta({ media_id: asset.id, duration: analysis.duration }),
    });
  } catch (error) {
    console.warn("stabilization failed, the video stays as sent", asset.id, error instanceof Error ? error.message.slice(0, 300) : error);
  }
}
