import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { InvoiceList } from "@/components/invoice-list";
import { studioInvoices } from "@/lib/billing/invoices";
import { whatsappLink } from "@/lib/public-env";
import { getStudioContext } from "@/lib/studio";

export const metadata: Metadata = { title: "Mes factures" };

// Her invoices on her phone, behind « Voir mes factures » under Edith's message on WhatsApp
// (get_page_link factures): each payment with Stripe's PDF, then back to WhatsApp with nothing
// written (a message would make Edith answer, and each answer past the free 1,000 a month is paid).

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-white/60">Chargement…</div>}>
      <Invoices />
    </Suspense>
  );
}

async function Invoices() {
  const { member } = await getStudioContext();
  if (!member) redirect("/connexion?next=/factures");
  const rows = await studioInvoices(member.studio.id);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-5 px-5 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-extrabold tracking-[-0.01em]">Mes factures</h1>
        <p className="text-[14px] leading-snug text-white/70">{member.studio.name ?? "Ton commerce"}, chaque paiement en PDF.</p>
      </div>
      <InvoiceList rows={rows} timeZone={member.studio.timezone} dark />
      <a
        href={whatsappLink("")}
        className="mt-auto inline-flex items-center justify-center gap-2 self-center rounded-full bg-white px-5 py-3 text-[15px] font-extrabold text-ink"
      >
        <WhatsAppIcon size={18} /> Retourner sur WhatsApp
      </a>
    </main>
  );
}
