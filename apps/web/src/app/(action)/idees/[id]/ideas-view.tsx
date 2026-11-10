"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import type { IdeaCard } from "@/lib/house-ideas";
import { whatsappLink } from "@/lib/public-env";
import { launchIdea, type IdeaLaunch } from "../actions";

// The ideas page of her phone: each idea a loop full width (played only while in view), one tap opens its
// confirmation, « C'est parti » starts her Reel. « Fais-moi confiance » goes back to WhatsApp with its words ready.

const TRUST_TEXT = "Fais-moi confiance";

export function IdeasView({ offerId, cards, files, launched }: { offerId: string; cards: IdeaCard[]; files: number; launched: boolean }) {
  const [picked, setPicked] = useState<IdeaCard | null>(null);
  const [result, setResult] = useState<IdeaLaunch | null>(null);
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);

  // Only the loops in view play (six to eight videos at once would stall a phone).
  useEffect(() => {
    const root = list.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const video = e.target as HTMLVideoElement;
          if (e.isIntersecting) void video.play().catch(() => {});
          else video.pause();
        }
      },
      { threshold: 0.55 },
    );
    root.querySelectorAll("video").forEach((v) => seen.observe(v));
    return () => seen.disconnect();
  }, [cards]);

  const go = (card: IdeaCard) =>
    start(async () => {
      const res = await launchIdea(offerId, card.key).catch((): IdeaLaunch => ({ ok: false, error: "Ça n’est pas parti. Réessaie dans un instant." }));
      setResult(res);
      if (res.ok) setPicked(null);
    });

  if (launched || result?.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot size={96} mood="happy" />
        <h1 className="text-[30px] leading-none font-bold tracking-[-0.05em]">C’est parti !</h1>
        <p className="text-[15px] leading-snug text-white/80">
          {result?.ok
            ? `Je monte ton Reel avec tes images, ta charte et ta musique. Je te préviens sur WhatsApp dès qu’il est prêt, dans ${result.minutes} min environ.`
            : "Ton Reel est déjà lancé. Je te préviens sur WhatsApp dès qu’il est prêt."}
        </p>
        <a href={whatsappLink(result?.ok && !result.answered ? "C’est parti pour mon Reel 🎬" : "")} className="inline-flex items-center gap-2 bg-white px-5 py-3 text-[15px] font-bold text-ink">
          <WhatsAppIcon size={18} /> Retourner sur WhatsApp
        </a>
      </main>
    );
  }

  if (!cards.length) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot size={96} mood="thinking" />
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.04em]">Les idées ne s’affichent pas pour l’instant</h1>
        <p className="text-[15px] leading-snug text-white/80">Réessaie dans un instant, ou laisse-moi choisir pour toi.</p>
        <a href={whatsappLink(TRUST_TEXT)} className="inline-flex items-center gap-2 bg-white px-5 py-3 text-[15px] font-bold text-ink">
          <WhatsAppIcon size={18} /> {TRUST_TEXT}
        </a>
      </main>
    );
  }

  const error = result && !result.ok ? result : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-3 px-4 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <Mascot size={44} mood="happy" still />
          <span className="mono-label text-white/60">{cards.length} idées pour toi</span>
        </div>
        <h1 className="text-[44px] leading-[0.95] font-bold tracking-[-0.05em]">Des idées pour ton Reel</h1>
        <p className="text-[15px] leading-snug text-white/75">
          Des idées de forme, choisies pour ton métier et tes {files > 1 ? `${files} fichiers` : "images"}. Ton Reel est fait avec tes images, ta charte et ta musique. Touche celle qui te plaît.
        </p>
        <a href={whatsappLink(TRUST_TEXT)} className="self-start text-[14px] font-semibold text-white/80 underline underline-offset-3">
          Ou laisse-moi choisir : {TRUST_TEXT}
        </a>
      </header>

      <div ref={list} className="flex flex-col gap-8">
        {cards.map((card, i) => (
          <button key={card.key} type="button" onClick={() => setPicked(card)} className="fauve-press flex flex-col gap-3 text-left" aria-label={`Choisir « ${card.name} »`}>
            <span className="flex items-baseline justify-between gap-3 px-4">
              <span className="text-[24px] leading-tight font-semibold tracking-[-0.03em]">{card.name}</span>
              <span className="mono-label shrink-0 text-white/50">N° {String(i + 1).padStart(2, "0")}</span>
            </span>
            <span className="relative block aspect-[9/16] w-full overflow-hidden border-y border-white/10 bg-black">
              <video src={card.video} poster={card.poster} muted loop playsInline preload="none" className="absolute inset-0 size-full object-cover" />
            </span>
          </button>
        ))}
      </div>

      <section className="mx-4 mt-10 flex flex-col gap-3 border-t border-white/15 pt-6">
        <p className="text-[15px] leading-snug text-white/75">Aucune ne te parle ? Laisse-moi choisir la forme qui va le mieux à tes fichiers.</p>
        <a href={whatsappLink(TRUST_TEXT)} className="inline-flex items-center justify-center gap-2 border border-white/40 px-5 py-3 text-[15px] font-bold text-white">
          <WhatsAppIcon size={18} /> {TRUST_TEXT}
        </a>
      </section>

      {picked && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button type="button" aria-label="Fermer" onClick={() => !pending && setPicked(null)} className="fauve-fade absolute inset-0 bg-black/60" />
          <div role="dialog" aria-modal="true" aria-label={picked.name} className="fauve-enter relative flex w-full max-w-[480px] flex-col gap-4 bg-white px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink">
            <div className="flex items-start gap-4">
              <span className="relative block aspect-[9/16] w-[84px] shrink-0 overflow-hidden bg-ink">
                <video src={picked.video} poster={picked.poster} muted loop playsInline autoPlay className="absolute inset-0 size-full object-cover" />
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="mono-label text-muted">Ton Reel</span>
                <h2 className="text-[24px] leading-tight font-semibold tracking-[-0.03em]">{picked.name}</h2>
                {picked.pitch && <p className="text-[13.5px] leading-snug text-muted">{picked.pitch}</p>}
              </div>
            </div>
            <p className="text-[14px] leading-snug">Avec tes images, ta charte et ta musique. Les crédits sont débités une fois ton Reel livré, pour ce qui a été fait.</p>
            {error && (
              <div role="alert" className="flex flex-col gap-2 bg-peach px-4 py-3 text-[14px] leading-snug text-peach-ink">
                <p className="font-semibold">{error.error}</p>
                {error.locked && (
                  <Link href="/abonnement?next=/merci" className="self-start font-bold underline underline-offset-2">
                    {error.locked === "subscribe" ? "Choisir mon abonnement" : "Avoir plus de crédits"}
                  </Link>
                )}
              </div>
            )}
            <button type="button" onClick={() => go(picked)} disabled={pending} className="btn btn-primary h-[54px] text-[17px] font-bold disabled:opacity-60">
              {pending ? "C’est parti…" : "C’est parti"}
            </button>
            <button type="button" onClick={() => setPicked(null)} disabled={pending} className="h-10 text-[14.5px] font-bold text-ink/70">
              Voir les autres idées
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
