import "server-only";
import { DEFAULT_EFFORT, effortSchema, type RequestEntry, type RequestLine } from "@fauve/agent";
import { acceptQuote, createMontageQuote, type AcceptedQuote } from "@/lib/credits";
import { queueJob } from "@/lib/jobs";
import { launchBrief, logLaunch } from "@/lib/request-log";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * A correction of a post's montage, priced and accepted at once (her request or her tap is her yes),
 * at the studio's level of care; the caller starts it (startMontage) after its answer. Charged on delivery.
 */
export async function correctionQuote(studioId: string, postId: string, brief: string): Promise<AcceptedQuote | { error: string }> {
  const studio = await supabaseAdmin().from("studios").select("montage_effort").eq("id", studioId).single();
  const effort = effortSchema.catch(DEFAULT_EFFORT).parse(studio.data?.montage_effort);
  const quote = await createMontageQuote({ studioId, postId, mediaIds: [], brief, correction: true, maxNewScenes: 0, effort });
  if ("error" in quote) return { error: "Il ne te reste pas assez de crédits pour refaire la vidéo." };
  return acceptQuote(studioId, quote.id, new Date(), { immediate: true });
}

/**
 * Starts the quoted work as a background job (it sends the video itself when
 * done). Shared by Fauve's montage tool and the « Lancer » button of the quote card.
 * Its request is kept on the post first (`request`: where she asked and what was said), and every agent of the
 * montage gets the exchange word for word with Edith's brief (launchBrief).
 */
export async function startMontage(
  studioId: string,
  quote: AcceptedQuote,
  /**
   * route: who makes it, when it was decided before (effectRoute), so the job does not decide again.
   * conversationId: the app's conversation she asked in, where the Reel is delivered.
   */
  target: {
    waId?: string;
    replyTo?: string;
    notify?: boolean;
    route?: "agent" | "chain";
    conversationId?: string;
    request?: { via: RequestEntry["via"]; lines: RequestLine[] };
  } = {},
) {
  const simone = quote.brief ?? (quote.kind === "correction" ? "Correction demandée par la gérante." : undefined);
  if (target.request) await logLaunch(studioId, quote.postId, target.request.via, target.request.lines).catch((error: unknown) => console.warn("request not kept", quote.postId, error));
  const brief = await launchBrief(studioId, quote.postId, simone).catch((error: unknown) => {
    console.warn("request not read, Edith's brief alone", quote.postId, error);
    return simone;
  });
  return queueJob("montage", {
    // A variant skips the editor: same cut, another style and hook, then the render.
    step: quote.kind === "variant" ? "variant" : "design",
    variant: quote.variant ?? undefined,
    studioId,
    postId: quote.postId,
    mediaIds: quote.mediaIds.length ? quote.mediaIds : undefined,
    brief,
    maxNewScenes: quote.maxNewScenes,
    quoteId: quote.id,
    // Soigné and Max: reviewed by the critic before delivery (montage job).
    effort: quote.effort ?? undefined,
    correction: quote.kind === "correction",
    waId: target.waId,
    replyTo: target.replyTo,
    notify: target.notify || undefined,
    route: target.route,
    conversationId: target.waId ? undefined : target.conversationId,
  });
}
