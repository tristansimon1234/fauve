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

/**
 * One call of a Treg catalog tool with a JSON body (POST https://treg.to/call/<id>), and what it cost;
 * null without a key. Treg's answer is returned as is ({ output, … }), or null when refused.
 */
export async function tregCall(id: string, body: Record<string, unknown>, maxCostUsd = MAX_COST_USD): Promise<{ answer: unknown; costUsd: number } | null> {
  const token = env("TREG_API_KEY");
  if (!token) return null;
  const response = await fetch(`https://treg.to/call/${id}`, {
    method: "POST",
    headers: { "X-Treg-Token": token, "X-Treg-Route-Max-Cost": String(maxCostUsd), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null);
  if (!response) return { answer: null, costUsd: 0 };
  const costUsd = Number(response.headers.get("x-treg-cost-micro") ?? 0) / 1_000_000;
  const cost = Number.isFinite(costUsd) ? costUsd : 0;
  if (!response.ok) {
    console.warn("treg: call refused", id, response.status, (await response.text().catch(() => "")).slice(0, 300));
    return { answer: null, costUsd: cost };
  }
  return { answer: await response.json().catch(() => null), costUsd: cost };
}
