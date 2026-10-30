import "server-only";
import type { InvoiceRow } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { billingEnabled, customerInvoices } from "./stripe";

/** Her invoices, newest first: none before her first payment, null when Stripe can't be read now. */
export async function studioInvoices(studioId: string): Promise<InvoiceRow[] | null> {
  if (!billingEnabled()) return [];
  const { data } = await supabaseAdmin().from("studios").select("stripe_customer_id").eq("id", studioId).maybeSingle();
  const customer = data?.stripe_customer_id as string | null | undefined;
  if (!customer) return [];
  return customerInvoices(customer).catch((error: unknown) => {
    console.warn("invoices not read", studioId, error);
    return null;
  });
}
