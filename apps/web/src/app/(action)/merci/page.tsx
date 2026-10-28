import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { studioAccess } from "@/lib/billing/access";
import { creditBalance } from "@/lib/credits";
import { whatsappLink } from "@/lib/public-env";
import { getStudioContext } from "@/lib/studio";

export const metadata: Metadata = { title: "C’est fait" };

// Where the offers page opened from WhatsApp brings her back once she paid (or not): her phone
// goes back to WhatsApp, with her message ready. WhatsApp never lets a page write for her, and
// her message is what makes Edith go on (the plan she validated starts as soon as she is subscribed).

export default function ThanksPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-white/60">Chargement…</div>}>
      <Thanks />
    </Suspense>
  );
}

async function Thanks() {
  const { member } = await getStudioContext();
  if (!member) redirect("/connexion?next=/merci");
  const [access, credits] = await Promise.all([studioAccess(member.studio.id), creditBalance(member.studio.id).catch(() => null)]);
  const ok = access.subscribed && access.create;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
      <Mascot size={96} mood={ok ? "happy" : "idle"} />
      <h1 className="text-[24px] font-extrabold tracking-[-0.01em]">{ok ? "C’est fait, merci !" : access.subscribed ? "Plus de crédits pour l’instant" : "Rien n’a été payé"}</h1>
      <p className="text-[15px] leading-snug text-white/80">
        {ok
          ? `Ton abonnement est actif${credits !== null ? ` et tu as ${credits} crédits` : ""}. Envoie-moi le petit message tout prêt sur WhatsApp, et je m’y mets.`
          : "Tu peux y revenir quand tu veux depuis le lien que je t’ai envoyé, ou me poser tes questions sur WhatsApp."}
      </p>
      <a
        href={whatsappLink(ok ? "C’est bon, c’est payé ! On y va 🚀" : "J’ai une question sur les offres")}
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-extrabold text-ink"
      >
        <WhatsAppIcon size={18} /> Retourner sur WhatsApp
      </a>
    </main>
  );
}
