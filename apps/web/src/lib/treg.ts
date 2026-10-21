import "server-only";
import { videoUrlIn } from "@fauve/agent";
import { env } from "@/lib/env";

// Treg (treg.to), a pay-per-call gateway: the video of an Instagram Reel from its link, through its
// providers, when the render sandbox's yt-dlp cannot open it (Instagram often refuses a server).
// She pastes a link; she never has to save the video and send it.

const POST_DETAIL = "https://treg.to/call/anyapi.instagram.post.detail";
/** What one call costs (Treg's catalog, October 2026): logged in cost_events. */
export const TREG_POST_USD = 0.0015;

/** The video file's link of an Instagram post or Reel, or null (no key, no answer, no video in it). */
export async function instagramVideo(link: string): Promise<string | null> {
  const token = env("TREG_API_KEY");
  if (!token) return null;
  const headers = { "X-Treg-Token": token, "X-Treg-Route-Max-Cost": "0.02" };
  // A catalog tool takes its parameters in the query; some take a JSON body: both are tried.
  const tries = [
    () => fetch(`${POST_DETAIL}?${new URLSearchParams({ url: link })}`, { headers, signal: AbortSignal.timeout(30_000) }),
    () => fetch(POST_DETAIL, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ url: link }), signal: AbortSignal.timeout(30_000) }),
  ];
  for (const call of tries) {
    const response = await call().catch(() => null);
    if (!response?.ok) {
      if (response) console.warn("treg: post detail refused", response.status, (await response.text().catch(() => "")).slice(0, 300));
      continue;
    }
    const video = videoUrlIn(await response.json().catch(() => null));
    if (video) return video;
    console.warn("treg: no video in the post detail");
  }
  return null;
}
