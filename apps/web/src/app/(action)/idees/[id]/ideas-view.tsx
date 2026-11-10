"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import type { IdeaCard } from "@/lib/house-ideas";
import { whatsappLink } from "@/lib/public-env";
import { launchIdea, type IdeaLaunch } from "../actions";

// The ideas page of her phone, a vertical feed like Instagram's Reels (Tristan, 10 November: « mets en mode scroll comme
// Insta non ? j'arrive même pas à lire les vidéos »): one idea per screen, snapped, the one on screen plays muted and
// on loop (a tap pauses it), its name and « Choisir celle-ci » over it; the last screen lets Edith choose. The videos
// are plain <video> elements (never inside a button: some phones would not play them there), loaded only near view.

const TRUST_TEXT = "Fais-moi confiance";

export function IdeasView({ offerId, cards, files, launched }: { offerId: string; cards: IdeaCard[]; files: number; launched: boolean }) {
  const [picked, setPicked] = useState<IdeaCard | null>(null);
  const [result, setResult] = useState<IdeaLaunch | null>(null);
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);

  const [onScreen, setOnScreen] = useState(0);
  // Which idea is on screen; each one plays or rests by itself (IdeaVideo).
  useEffect(() => {
    const root = list.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setOnScreen(Number((e.target as HTMLElement).dataset.at));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-at]").forEach((section) => seen.observe(section));
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
    <main className="fixed inset-0 bg-black text-white">
      <div ref={list} className="h-dvh snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]">
        {cards.map((card, i) => {
          return (
            <section key={card.key} data-at={i} className="relative h-dvh w-full snap-start snap-always overflow-hidden">
              <IdeaVideo card={card} at={i} onScreen={onScreen} />
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
                <span className="flex items-center gap-2">
                  <Mascot size={30} mood="happy" still />
                  <span className="mono-label text-white/80">Idées pour toi</span>
                </span>
                <span className="mono-label text-white/70 tabular-nums">
                  {i + 1} / {cards.length}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pt-20 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <h2 className="text-[30px] leading-[1.02] font-semibold tracking-[-0.04em]">{card.name}</h2>
                {card.pitch && <p className="text-[14.5px] leading-snug text-white/80">{card.pitch}</p>}
                <p className="text-[12.5px] text-white/60">Avec tes {files > 1 ? `${files} fichiers` : "images"}, ta charte et ta musique.</p>
                <button type="button" onClick={() => setPicked(card)} className="btn mt-1 h-[52px] bg-white text-[16.5px] font-bold text-ink">
                  Choisir celle-ci
                </button>
                {i === 0 && <p className="text-center text-[12.5px] text-white/60">Fais défiler pour voir les autres idées</p>}
              </div>
            </section>
          );
        })}
        <section data-at={cards.length} className="flex h-dvh w-full snap-start flex-col items-center justify-center gap-5 px-6 text-center">
          <Mascot size={88} mood="happy" />
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.04em]">Aucune ne te parle ?</h2>
          <p className="text-[15px] leading-snug text-white/75">Laisse-moi choisir la forme qui va le mieux à tes fichiers.</p>
          <a href={whatsappLink(TRUST_TEXT)} className="inline-flex items-center justify-center gap-2 bg-white px-5 py-3 text-[15px] font-bold text-ink">
            <WhatsAppIcon size={18} /> {TRUST_TEXT}
          </a>
        </section>
      </div>

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

/**
 * One idea's loop, as Instagram does it (Tristan, 10 November: « comment fait Insta pour avoir en bonne qualité ? »,
 * « il faut charger plusieurs vidéos à la fois non ? »): the light loop of this idea and of the three after it loads
 * ahead and starts at once; the HD loop of the one on screen and the next loads behind it and takes over, at the
 * same moment of the loop, as soon as it can play through. Only the idea on screen plays; a tap pauses it.
 */
function IdeaVideo({ card, at, onScreen }: { card: IdeaCard; at: number; onScreen: number }) {
  const light = useRef<HTMLVideoElement>(null);
  const hd = useRef<HTMLVideoElement>(null);
  const [hdReady, setHdReady] = useState(false);
  const active = at === onScreen;
  const loadLight = at >= onScreen - 1 && at <= onScreen + 3;
  const loadHd = Boolean(card.videoHd) && at >= onScreen && at <= onScreen + 1;
  const showHd = hdReady && Boolean(card.videoHd);

  useEffect(() => {
    const l = light.current;
    const h = hd.current;
    if (!active) {
      l?.pause();
      h?.pause();
      return;
    }
    if (showHd && h) {
      if (l && l.duration && h.duration) h.currentTime = l.currentTime % h.duration;
      h.muted = true;
      void h.play().catch(() => {});
      l?.pause();
    } else if (l) {
      l.muted = true;
      void l.play().catch(() => {});
    }
  }, [active, showHd]);

  const toggle = () => {
    const v = showHd ? hd.current : light.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  return (
    <>
      <video
        ref={light}
        src={loadLight ? card.video : undefined}
        poster={card.poster}
        muted
        loop
        playsInline
        autoPlay={at === 0}
        preload={loadLight ? "auto" : "none"}
        onClick={toggle}
        className="absolute inset-0 size-full object-cover"
      />
      {card.videoHd && (loadHd || hdReady) && (
        <video
          ref={hd}
          src={card.videoHd}
          muted
          loop
          playsInline
          preload="auto"
          onCanPlayThrough={() => setHdReady(true)}
          onClick={toggle}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${showHd ? "opacity-100" : "pointer-events-none opacity-0"}`}
        />
      )}
    </>
  );
}
