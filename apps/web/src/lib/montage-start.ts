import "server-only";
import type { AcceptedQuote } from "@/lib/credits";
import { queueJob } from "@/lib/jobs";

/**
 * Starts the quoted work as a background job (it sends the video itself when
 * done). Shared by Fauve's montage tool and the « Lancer » button of the quote card.
 */
export function startMontage(studioId: string, quote: AcceptedQuote, target: { waId?: string; replyTo?: string; notify?: boolean } = {}) {
  return queueJob("montage", {
    // A variant skips the editor: same cut, another style and hook, then the render.
    step: quote.kind === "variant" ? "variant" : "design",
    variant: quote.variant ?? undefined,
    studioId,
    postId: quote.postId,
    mediaIds: quote.mediaIds.length ? quote.mediaIds : undefined,
    brief: quote.brief ?? (quote.kind === "correction" ? "Correction demandée par la gérante." : undefined),
    maxNewScenes: quote.maxNewScenes,
    quoteId: quote.id,
    // Soigné and Max: reviewed by the critic before delivery (montage job).
    effort: quote.effort ?? undefined,
    correction: quote.kind === "correction",
    waId: target.waId,
    replyTo: target.replyTo,
    notify: target.notify || undefined,
  });
}
