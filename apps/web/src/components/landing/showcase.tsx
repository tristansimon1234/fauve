"use client";

import { useEffect, useRef, useState } from "react";

// Real work by Simone for the landing: three Reels and a carousel made by the
// app itself (montage, motion design, review) for demo businesses, from free
// Unsplash photos, with the music Simone composed for them (ElevenLabs). Files in
// the public `landing` bucket of Supabase Storage.

const BASE = "https://tfxkhktofgtljlqlksba.supabase.co/storage/v1/object/public/landing";

export const SHOWCASE_REELS = [
  { file: "reel-pilates-music.mp4", name: "studio.lune", who: "Studio de Pilates · Lyon" },
  { file: "reel-coiffure-music.mp4", name: "maison.maya", who: "Salon de coiffure · Paris" },
  { file: "reel-trattoria-music.mp4", name: "chezlino.bordeaux", who: "Trattoria · Bordeaux" },
] as const;

/** The carousel's rendered photos (empty until it is made: the Reels then take the whole width). */
export const SHOWCASE_SLIDES: readonly string[] = ["carrousel-1.jpg", "carrousel-2.jpg", "carrousel-3.jpg", "carrousel-4.jpg"];

/** A Reel in a phone, as on Instagram: it plays muted while it is on screen; a tap on the speaker plays its music. */
function ReelPhone({ reel, big }: { reel: (typeof SHOWCASE_REELS)[number]; big?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);
  const [src, setSrc] = useState<string>(reel.file);
  const toggleSound = () => {
    const el = video.current;
    if (!el) return;
    el.muted = sound;
    setSound(!sound);
    if (!sound) {
      // One Reel heard at a time.
      document.querySelectorAll<HTMLVideoElement>("video[data-showcase]").forEach((v) => {
        if (v !== el) v.muted = true;
      });
      window.dispatchEvent(new CustomEvent("showcase-sound", { detail: reel.file }));
      el.play().catch(() => {});
    }
  };
  useEffect(() => {
    const quiet = (e: Event) => (e as CustomEvent<string>).detail !== reel.file && setSound(false);
    window.addEventListener("showcase-sound", quiet);
    return () => window.removeEventListener("showcase-sound", quiet);
  }, [reel.file]);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? el.play().catch(() => {}) : el.pause()), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <figure className={`flex shrink-0 flex-col items-center gap-3 ${big ? "w-[min(68vw,270px)]" : "w-[min(56vw,230px)] md:mt-10"}`}>
      <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-[26px] bg-ink shadow-[0_24px_60px_rgba(28,21,48,.28)] ring-[6px] ring-ink">
        <video
          ref={video}
          // #t: the first frames are often an animation's empty start; show a frame with something on it.
          src={`${BASE}/${src}#t=1.2`}
          // The version with music is made once after a deploy: until then, the silent one.
          onError={() => setSrc(reel.file.replace("-music", ""))}
          muted
          loop
          playsInline
          preload="metadata"
          data-showcase
          aria-label={`Reel de ${reel.who}, monté par Simone`}
          className="size-full object-cover"
        />
        <button
          type="button"
          onClick={toggleSound}
          aria-label={sound ? "Couper le son" : "Écouter la musique"}
          aria-pressed={sound}
          className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6M21 9l-5 6" />}
          </svg>
        </button>
        {/* Instagram's frame: the account at the bottom, the actions on the right. */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,.45))] px-3 pt-8 pb-3">
          <span className="size-6 shrink-0 rounded-full bg-[conic-gradient(from_180deg,#F2694E,#5B3FD9,#F2694E)] p-[2px]">
            <span className="block size-full rounded-full bg-white/90" />
          </span>
          <span className="truncate text-[12px] font-bold text-white">{reel.name}</span>
          <span className="rounded-[6px] border border-white/70 px-1.5 py-px text-[10px] font-bold text-white">Suivre</span>
        </span>
        <span className="pointer-events-none absolute right-2.5 bottom-14 flex flex-col items-center gap-3 text-white" aria-hidden="true">
          {[HEART, BUBBLE, PLANE].map((d, i) => (
            <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="drop-shadow">
              <path d={d} />
            </svg>
          ))}
        </span>
      </span>
      <figcaption className="text-center text-[13px] font-semibold text-muted">{reel.who}</figcaption>
    </figure>
  );
}

const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z";
const BUBBLE = "M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z";
const PLANE = "M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z";

/** The three Reels, the middle one in front. */
export function ReelsShowcase() {
  const [a, b, c] = SHOWCASE_REELS;
  return (
    <div className="-mx-4 flex snap-x snap-mandatory items-start justify-start gap-5 overflow-x-auto px-4 pb-2 md:mx-0 md:justify-center md:overflow-visible md:px-0">
      <span className="snap-center">
        <ReelPhone reel={a} />
      </span>
      <span className="snap-center">
        <ReelPhone reel={b} big />
      </span>
      <span className="snap-center">
        <ReelPhone reel={c} />
      </span>
    </div>
  );
}

/** The carousel as an Instagram post: the photos slide by themselves, the dots follow. */
export function CarouselShowcase() {
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setAt((i) => (i + 1) % SHOWCASE_SLIDES.length), 2600);
    return () => clearInterval(timer);
  }, []);
  return (
    <figure className="mx-auto flex w-full max-w-[340px] flex-col overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_18px_44px_rgba(28,21,48,.14)]">
      <span className="flex items-center gap-2 px-3 py-2.5">
        <span className="size-7 shrink-0 rounded-full bg-[conic-gradient(from_180deg,#F2694E,#5B3FD9,#F2694E)] p-[2px]">
          <span className="block size-full rounded-full bg-[#6D2E46]" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-bold">maison.maya</span>
          <span className="text-[11px] text-muted">Paris 11e</span>
        </span>
      </span>
      <span className="relative block aspect-[4/5] w-full overflow-hidden bg-soft">
        <span className="flex h-full transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]" style={{ transform: `translateX(-${at * 100}%)` }}>
          {SHOWCASE_SLIDES.map((file, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={file} src={`${BASE}/${file}`} alt={`Carrousel de Maison Maya, photo ${i + 1}`} loading="lazy" className="size-full shrink-0 object-cover" />
          ))}
        </span>
        <span className="absolute top-2.5 right-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
          {at + 1}/{SHOWCASE_SLIDES.length}
        </span>
      </span>
      <span className="flex items-center gap-3 px-3 pt-2.5 pb-3" aria-hidden="true">
        {[HEART, BUBBLE, PLANE].map((d, i) => (
          <svg key={i} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
            <path d={d} />
          </svg>
        ))}
        <span className="mx-auto flex gap-1">
          {SHOWCASE_SLIDES.map((f, i) => (
            <span key={f} className={`size-1.5 rounded-full transition-colors ${i === at ? "bg-violet" : "bg-line"}`} />
          ))}
        </span>
        <span className="w-[66px]" />
      </span>
    </figure>
  );
}
