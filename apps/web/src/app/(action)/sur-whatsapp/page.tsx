import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { whatsappLink } from "@/lib/public-env";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Edith est sur WhatsApp" };

// Where a phone lands when it opens the app (proxy.ts): on a phone, Edith is on WhatsApp, and the
// app is for a computer (Tristan: « l'app ne devrait pas être accessible sur le téléphone »).

export default function OnWhatsAppPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <Mascot size={96} />
      <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.01em]">Sur ton téléphone, je suis sur WhatsApp</h1>
      <p className="text-[15px] leading-snug text-white/80">
        Écris-moi là-bas comme à une vraie personne : tes photos, tes vidéos, tes idées. Quand il faut un écran, je t’envoie un bouton vers la bonne page.
      </p>
      <a href={whatsappLink("")} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-extrabold text-ink">
        <WhatsAppIcon size={18} /> Ouvrir WhatsApp
      </a>
      <p className="text-[13px] leading-snug text-white/60">L’app complète s’ouvre sur ordinateur, sur {new URL(SITE_URL).host}.</p>
      <nav aria-label="Pages sur ton téléphone" className="flex gap-4 text-[13px] font-semibold text-white/70">
        <Link href="/factures" className="underline underline-offset-2">
          Mes factures
        </Link>
        <Link href="/abonnement?next=/merci" className="underline underline-offset-2">
          Les offres
        </Link>
      </nav>
    </main>
  );
}
