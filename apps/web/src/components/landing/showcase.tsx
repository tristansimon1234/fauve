"use client";

import { useEffect, useRef, useState } from "react";

// Real work by Edith for the landing: three Reels and a carousel made by the
// app itself (montage, motion design, review) for demo businesses, from free
// Unsplash photos, with the music Edith composed for them (ElevenLabs). Files in
// the public `landing` bucket of Supabase Storage.

const BASE = "https://tfxkhktofgtljlqlksba.supabase.co/storage/v1/object/public/landing";

// Each with its first picture (public/landing), so the phone is never black while it loads.
export const SHOWCASE_REELS = [
  { file: "reel-pilates-music.mp4", name: "studio.lune", who: "Studio de Pilates · Lyon", poster: "/landing/reel-pilates.webp" },
  { file: "reel-coiffure-music.mp4", name: "maison.maya", who: "Salon de coiffure · Paris", poster: "/landing/reel-coiffure.webp" },
  { file: "reel-trattoria-music.mp4", name: "chezlino.bordeaux", who: "Trattoria · Bordeaux", poster: "/landing/reel-trattoria.webp" },
] as const;

/** The carousel's rendered photos (empty until it is made: the Reels then take the whole width). */
export const SHOWCASE_SLIDES: readonly string[] = ["carrousel-1.jpg", "carrousel-2.jpg", "carrousel-3.jpg", "carrousel-4.jpg"];

const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z";
const BUBBLE = "M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z";
const PLANE = "M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z";

/**
 * The Reels as on Instagram: one phone, a vertical feed that scrolls by itself
 * from one Reel to the next when it ends (or with a finger, the wheel, the
 * arrows), each with the music Edith composed for it. Muted until a tap on the
 * sound, as browsers want; plays only while it is on screen.
 */
export function ReelsFeed() {
  const feed = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [sound, setSound] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [srcs, setSrcs] = useState<string[]>(SHOWCASE_REELS.map((r) => r.file));

  // Which Reel fills the phone.
  useEffect(() => {
    const root = feed.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Plays only while the phone is on screen.
  useEffect(() => {
    const root = feed.current;
    if (!root) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { threshold: 0.4 });
    io.observe(root);
    return () => io.disconnect();
  }, []);

  // The active Reel plays from its start, the others wait.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      v.muted = !sound;
      if (i === active && visible) {
        v.play().catch(() => {});
      } else {
        v.pause();
        if (i !== active) v.currentTime = 0;
      }
    });
  }, [active, visible, sound]);

  const go = (i: number) => {
    const root = feed.current;
    if (!root) return;
    const n = SHOWCASE_REELS.length;
    const next = ((i % n) + n) % n;
    root.scrollTo({ top: next * root.clientHeight, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-center lg:justify-center lg:gap-10">
      <div className="relative isolate">
        {/* The colours of the Reel playing glow behind the phone. */}
        <div className="pointer-events-none absolute -inset-x-24 -inset-y-12 -z-10" aria-hidden="true">
          {SHOWCASE_REELS.map((reel, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={reel.poster} src={reel.poster} alt="" className={`land-glow absolute inset-0 size-full object-cover blur-[70px] saturate-150 ${i === active ? "opacity-50" : "opacity-0"}`} />
          ))}
        </div>
        <div className="relative h-[min(78vh,600px)] w-[min(84vw,338px)] overflow-hidden rounded-[34px] bg-ink shadow-[0_30px_70px_rgba(28,21,48,.32)] ring-[7px] ring-ink">
          <div ref={feed} className="h-full snap-y snap-mandatory overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Reels faits par Edith">
            {SHOWCASE_REELS.map((reel, i) => (
              <div key={reel.file} data-index={i} className="relative h-full w-full snap-start snap-always">
                <video
                  ref={(el) => {
                    videos.current[i] = el;
                  }}
                  src={`${BASE}/${srcs[i]}`}
                  poster={reel.poster}
                  // The version with music is made once after a deploy: until then, the silent one.
                  onError={() => setSrcs((all) => all.map((f, j) => (j === i ? reel.file.replace("-music", "") : f)))}
                  onTimeUpdate={(e) => i === active && setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
                  onEnded={() => go(i + 1)}
                  muted
                  playsInline
                  preload={i === 0 ? "auto" : "metadata"}
                  aria-label={`Reel de ${reel.who}, monté par Edith`}
                  className="size-full object-cover"
                />
                {/* Instagram's frame: the account and the music at the bottom, the actions on the right. */}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,.55))] px-3.5 pt-12 pb-5">
                  <span className="flex items-center gap-2">
                    <span className="size-7 shrink-0 rounded-full bg-[conic-gradient(from_180deg,#F2694E,#5B3FD9,#F2694E)] p-[2px]">
                      <span className="block size-full rounded-full bg-white/90" />
                    </span>
                    <span className="truncate text-[13px] font-bold text-white">{reel.name}</span>
                    <span className="rounded-[6px] border border-white/70 px-1.5 py-px text-[10px] font-bold text-white">Suivre</span>
                  </span>
                  <span className="text-[12.5px] font-semibold text-white/90">{reel.who}</span>
                  <span className="flex items-center gap-1.5 overflow-hidden text-[12px] text-white/85">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
                      <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm12-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z" />
                    </svg>
                    <span className="min-w-0 overflow-hidden">
                      <span className="land-ticker block w-max whitespace-nowrap">Musique composée par Edith · son original · Musique composée par Edith · son original ·&nbsp;</span>
                    </span>
                  </span>
                </span>
                <span className="pointer-events-none absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white" aria-hidden="true">
                  {[HEART, BUBBLE, PLANE].map((d, k) => (
                    <svg key={k} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="drop-shadow">
                      <path d={d} />
                    </svg>
                  ))}
                </span>
              </div>
            ))}
          </div>
          {/* Top bar: « Reels » and the sound, like the app. */}
          <span className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-[linear-gradient(0deg,transparent,rgba(0,0,0,.35))] px-4 pt-4 pb-6">
            <span className="text-[17px] font-extrabold text-white drop-shadow">Reels</span>
          </span>
          <button
            type="button"
            onClick={() => setSound((s) => !s)}
            aria-label={sound ? "Couper le son" : "Écouter la musique"}
            aria-pressed={sound}
            className={`absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm transition-colors ${sound ? "bg-black/40" : "bg-violet/90 hover:bg-violet"}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6M21 9l-5 6" />}
            </svg>
            {sound ? "" : "Son"}
          </button>
          {/* How far the Reel is. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
            <span className="block h-full origin-left bg-white" style={{ transform: `scaleX(${progress})` }} />
          </span>
        </div>
      </div>
      {/* The three businesses: a tap goes to their Reel. */}
      <ol className="flex flex-wrap justify-center gap-2 lg:flex-col">
        {SHOWCASE_REELS.map((reel, i) => (
          <li key={reel.file}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === active}
              className={`flex flex-col rounded-full border px-3.5 py-2 text-left transition-colors lg:w-[220px] lg:rounded-[16px] lg:py-2.5 ${i === active ? "border-violet bg-violet-soft" : "border-line bg-white hover:border-violet/40"}`}
            >
              <span className={`text-[13px] font-bold ${i === active ? "text-violet" : "text-ink"}`}>{reel.name}</span>
              <span className="hidden text-[12px] text-muted lg:block">{reel.who}</span>
              {/* Where the Reel playing is. */}
              <span className="mt-2 hidden h-[3px] overflow-hidden rounded-full bg-violet/15 lg:block">
                <span className="block h-full origin-left rounded-full bg-violet" style={{ transform: `scaleX(${i === active ? progress : 0})` }} />
              </span>
            </button>
          </li>
        ))}
        <li className="hidden lg:block">
          <span className="block px-1 pt-1 text-[12px] leading-snug text-muted">Fais défiler dans le téléphone, comme sur Instagram.</span>
        </li>
      </ol>
    </div>
  );
}
