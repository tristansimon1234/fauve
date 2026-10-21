import "server-only";
import { videoUrlIn } from "@fauve/agent";
import { env } from "@/lib/env";

// Treg (treg.to), a pay-per-call gateway: the video of an Instagram Reel from its link, through its
// providers, when the render sandbox's yt-dlp cannot open it (Instagram often refuses a server).
// She pastes a link; she never has to save the video and send it.

const POST_DETAIL = "https://treg.to/call/anyapi.instagram.post.detail";
/** What one call costs at most (Treg's catalog, October 2026: $0.0015 a post, $0.0005 when the cheapest source serves it). */
const MAX_COST_USD = 0.02;

/** The video file's link of an Instagram post or Reel (a direct link, downloaded with a plain GET), and what the call cost; null without a key. */
export async function instagramVideo(link: string): Promise<{ video: string | null; costUsd: number } | null> {
  const token = env("TREG_API_KEY");
  if (!token) return null;
  // The catalog's call line: POST with a JSON body { url } (anyapi.instagram.post.detail, verified October 2026).
  const response = await fetch(POST_DETAIL, {
    method: "POST",
    headers: { "X-Treg-Token": token, "X-Treg-Route-Max-Cost": String(MAX_COST_USD), "Content-Type": "application/json" },
    body: JSON.stringify({ url: link }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null);
  if (!response) return { video: null, costUsd: 0 };
  // Its charge, in millionths of a dollar (a post not found is billed too).
  const costUsd = Number(response.headers.get("x-treg-cost-micro") ?? 0) / 1_000_000;
  if (!response.ok) {
    console.warn("treg: post detail refused", response.status, (await response.text().catch(() => "")).slice(0, 300));
    return { video: null, costUsd };
  }
  const answer = (await response.json().catch(() => null)) as { output?: { found?: boolean; data?: unknown } } | null;
  const video = answer?.output?.found === false ? null : videoUrlIn(answer?.output?.data ?? answer);
  if (!video) console.warn("treg: no video in the post detail");
  return { video, costUsd: Number.isFinite(costUsd) ? costUsd : 0 };
}
