import { AsyncLocalStorage } from "node:async_hooks";

// The work a cost belongs to: a montage is charged on what it really cost (Tristan: « le calcul des
// crédits devrait se faire en fonction de la complexité passée »), so every cost logged while its job
// runs carries its quote's id (cost_events.meta.quote_id), whichever model, sandbox or service it paid.

const scope = new AsyncLocalStorage<{ quoteId: string }>();

/** Runs `work` with every cost it logs counted for this montage (none without a quote: a lab run, an admin render). */
export function withCostScope<T>(quoteId: string | undefined, work: () => T): T {
  return quoteId ? scope.run({ quoteId }, work) : work();
}

/** A cost's meta, with the montage it belongs to when one is running. */
export function costMeta<T extends Record<string, unknown>>(meta: T): T & { quote_id?: string } {
  const quoteId = scope.getStore()?.quoteId;
  return quoteId ? { ...meta, quote_id: quoteId } : meta;
}
