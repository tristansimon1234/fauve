// Values safe to ship to the browser. NEXT_PUBLIC_* are inlined at build time.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Mila's WhatsApp number, digits only with country code (e.g. 33612345678).
  milaWhatsAppNumber: process.env.NEXT_PUBLIC_MILA_WHATSAPP_NUMBER ?? "",
};

export function whatsappLink(text = "Bonjour Mila !"): string {
  const number = publicEnv.milaWhatsAppNumber.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
