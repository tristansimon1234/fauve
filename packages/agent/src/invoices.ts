// Her invoices as the app lists them (Réglages › Abonnement et crédits, the phone page /factures
// opened from WhatsApp): read from Stripe, which makes them (subscription and credit packs), paid
// or still to pay, newest first, each with Stripe's PDF.

/** An invoice as Stripe's API returns it, the fields read here. */
export type StripeInvoice = {
  id: string;
  number?: string | null;
  status?: string | null;
  created: number;
  total: number;
  currency?: string;
  invoice_pdf?: string | null;
  hosted_invoice_url?: string | null;
  status_transitions?: { paid_at?: number | null } | null;
  lines?: {
    data: {
      description?: string | null;
      /** Since API 2025-03-31 the price is under pricing; before, on the line. */
      pricing?: { price_details?: { product?: string | null } | null } | null;
      price?: { product?: string | null } | null;
    }[];
  } | null;
};

export type InvoiceRow = {
  id: string;
  number: string | null;
  /** When it was paid, else made (ISO). */
  date: string;
  label: string;
  /** In euros. */
  amount: number;
  paid: boolean;
  /** Stripe's PDF. */
  pdf: string | null;
  /** Stripe's page for it (to pay one still open). */
  page: string | null;
};

const SHOWN = new Set(["paid", "open"]);

/** « 1 × Edith : 1 Reel de plus (12 crédits) (at €5.00) » → « 1 Reel de plus (12 crédits) ». */
function lineLabel(description: string): string {
  return description
    .replace(/^\d+\s*×\s*/, "")
    .replace(/\s*\(at [^)]*\)\s*$/, "")
    .replace(/^Edith\s*:\s*/, "")
    .trim();
}

/**
 * Her invoices to list: paid or still to pay (never a draft or a voided one), newest first. An
 * offer's line reads « Abonnement Découverte » (its product, `offers`: product id → offer label).
 */
export function invoiceRows(invoices: StripeInvoice[], offers: Record<string, string>): InvoiceRow[] {
  return invoices
    .filter((invoice) => SHOWN.has(invoice.status ?? ""))
    .map((invoice) => {
      const line = invoice.lines?.data[0];
      const product = line?.pricing?.price_details?.product ?? line?.price?.product ?? null;
      const offer = product ? offers[product] : undefined;
      const paidAt = invoice.status_transitions?.paid_at ?? null;
      return {
        id: invoice.id,
        number: invoice.number ?? null,
        date: new Date((paidAt ?? invoice.created) * 1000).toISOString(),
        label: offer ? `Abonnement ${offer}` : line?.description ? lineLabel(line.description) || "Paiement" : "Paiement",
        amount: invoice.total / 100,
        paid: invoice.status === "paid",
        pdf: invoice.invoice_pdf ?? null,
        page: invoice.hosted_invoice_url ?? null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
