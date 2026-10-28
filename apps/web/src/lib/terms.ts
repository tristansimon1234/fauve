import "server-only";
import { TERMS_VERSION } from "@/lib/legal";
import { supabaseAdmin } from "@/lib/supabase/admin";

// « En continuant, tu acceptes les conditions » (Tristan): the terms are shown where someone starts
// (under Edith's first WhatsApp message, on the QR page, before paying), and going on after seeing
// them accepts them. Kept on the studio as proof: the version, when shown, when accepted.

/** Whether Edith's next WhatsApp message must carry the terms line: never shown, or older terms. */
export async function termsToShow(studioId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("studios").select("terms_version, terms_accepted_at").eq("id", studioId).maybeSingle();
  return Boolean(data) && !(data!.terms_version === TERMS_VERSION && data!.terms_accepted_at);
}

/** The terms line went out with Edith's message: her next message accepts them. */
export async function markTermsShown(studioId: string): Promise<void> {
  await supabaseAdmin().from("studios").update({ terms_version: TERMS_VERSION, terms_shown_at: new Date().toISOString(), terms_accepted_at: null }).eq("id", studioId);
}

/** She wrote again after seeing the terms: accepted (once per version). */
export async function acceptShownTerms(studioId: string): Promise<void> {
  await supabaseAdmin()
    .from("studios")
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq("id", studioId)
    .eq("terms_version", TERMS_VERSION)
    .not("terms_shown_at", "is", null)
    .is("terms_accepted_at", null);
}

/** She went on from a page that showed the terms (the QR page, the offers): accepted now. */
export async function acceptTerms(studioId: string): Promise<void> {
  if (!(await termsToShow(studioId))) return;
  const now = new Date().toISOString();
  await supabaseAdmin().from("studios").update({ terms_version: TERMS_VERSION, terms_shown_at: now, terms_accepted_at: now }).eq("id", studioId);
}
