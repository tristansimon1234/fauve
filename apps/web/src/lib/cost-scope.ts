import { AsyncLocalStorage } from "node:async_hooks";

// The work a cost belongs to: a montage is charged on what it really cost (Tristan: « le calcul des
// crédits devrait se faire en fonction de la complexité passée »), so every cost logged while its job
// runs carries its quote's id (cost_events.meta.quote_id), whichever model, sandbox or service it paid.
// The scout of Edith's models (lib/model-scout.ts) tags its own the same way (meta.scout: the Reel it
// reads for Tristan), so what it spends is the team's, counted apart.

const scope = new AsyncLocalStorage<{ quoteId?: string; scout?: string }>();

/** Runs `work` with every cost it logs counted for this montage (none without a quote: a lab run, an admin render). */
export function withCostScope<T>(quoteId: string | undefined, work: () => T): T {
  return quoteId ? scope.run({ quoteId }, work) : work();
}

/** Runs `work` with every cost it logs tagged for the scout of Edith's models (meta.scout = `tag`), never for a montage. */
export function withScoutCost<T>(tag: string, work: () => T): T {
  return scope.run({ scout: tag }, work);
}

/** A cost's meta, with the montage it belongs to when one is running, or the scout's tag. */
export function costMeta<T extends Record<string, unknown>>(meta: T): T & { quote_id?: string; scout?: string } {
  const store = scope.getStore();
  if (!store?.quoteId && !store?.scout) return meta;
  return { ...meta, ...(store.quoteId ? { quote_id: store.quoteId } : {}), ...(store.scout ? { scout: store.scout } : {}) };
}
