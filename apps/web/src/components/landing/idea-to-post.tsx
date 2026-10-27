"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpIcon, CheckIcon } from "@/components/icons";
import { Mascot, type MascotMood } from "@/components/mascot";
import { shownShare } from "./play";

// « Toi, les idées ; moi, j'exécute », in the app: she types her idea in one line, Edith works,
// and her carousel develops on the table step by step (the texts, her colours, the retouch)
// before it gathers into the post as Instagram shows it, then slides by itself. The real
// carousel the app made for a demo salon. Plays when it comes on screen (« Revoir » replays it);
// the server, and a device asking for less motion, show it finished.

const BASE = "https://tfxkhktofgtljlqlksba.supabase.co/storage/v1/object/public/landing";
/** The carousel's rendered photos, in the public `landing` bucket of Supabase Storage. */
const SHOWCASE_SLIDES = ["carrousel-1.jpg", "carrousel-2.jpg", "carrousel-3.jpg", "carrousel-4.jpg"];
const IDEA = "Un carrousel avec 3 conseils pour les cheveux en hiver";
const WORK = ["J’écris les textes", "Je les pose à tes couleurs", "Je retouche les photos"];

/** 0 nothing yet, 1 her idea typed, 2 sent, 3 Edith at work, 4 the post. */
type Phase = 0 | 1 | 2 | 3 | 4;
const MOODS: Record<Phase, MascotMood> = { 0: "idle", 1: "idle", 2: "happy", 3: "thinking", 4: "laugh" };

export function IdeaToPost() {
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [phase, setPhase] = useState<Phase>(4);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState(WORK.length);
  const [at, setAt] = useState(0);
  const [run, setRun] = useState(0);
  const [moving, setMoving] = useState(false);
  const [gathering, setGathering] = useState(false);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const reset = () => {
    clear();
    setPhase(0);
    setDraft("");
    setDone(0);
    setAt(0);
  };
  const play = () => {
    reset();
    setMoving(true);
    setRun((r) => r + 1);
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    later(350, () => setPhase(1));
    for (let i = 1; i <= IDEA.length; i++) later(350 + i * 26, () => setDraft(IDEA.slice(0, i)));
    const sent = 350 + IDEA.length * 26 + 350;
    later(sent, () => {
      setDraft("");
      setPhase(2);
    });
    later(sent + 500, () => setPhase(3));
    WORK.forEach((_, i) => later(sent + 1200 + i * 900, () => setDone(i + 1)));
    const post = sent + 1200 + WORK.length * 900 + 200;
    later(post, () => {
      setGathering(true);
      setPhase(4);
    });
    later(post + 1400, () => setGathering(false));
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    // Not (enough) on screen yet: back to the start, it plays when it comes on screen.
    const early = window.setTimeout(() => {
      if (shownShare(el) < 0.35) reset();
    }, 0);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        play();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    const list = timers;
    return () => {
      clearTimeout(early);
      io.disconnect();
      list.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The post slides by itself once it is there.
  useEffect(() => {
    if (phase !== 4 || !moving) return;
    const timer = window.setInterval(() => setAt((i) => (i + 1) % SHOWCASE_SLIDES.length), 2800);
    return () => clearInterval(timer);
  }, [phase, moving]);

  const stage = phase === 4 ? 3 : phase === 3 ? done : 0;

  return (
    <div ref={ref} className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      {/* The conversation, in the app */}
      <div className="flex h-[440px] flex-col overflow-hidden rounded-[28px] border border-white bg-chat shadow-[0_30px_70px_-30px_rgba(28,21,48,.3)] sm:h-[460px]">
        <div className="flex items-center gap-3 border-b border-line/80 bg-white/70 px-5 py-3.5 backdrop-blur">
          <Mascot size={46} mood={MOODS[phase]} />
          <span className="flex flex-col">
            <span className="text-[16px] font-bold">Edith</span>
            <span className="text-[12.5px] text-muted">{phase === 3 ? "au travail…" : "ton community manager"}</span>
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 pt-4 pb-3 sm:px-5">
          {phase >= 2 && (
            <Row key={`i${run}`} fresh={moving}>
              <Me>{IDEA}</Me>
            </Row>
          )}
          {phase >= 3 && (
            <Row key={`w${run}`} fresh={moving}>
              <Her>
                <span className="flex flex-col gap-2">
                  {WORK.map((w, i) => (
                    <span key={w} className={`flex items-center gap-2 transition-opacity duration-500 ${i < done ? "opacity-100" : "opacity-45"}`}>
                      <span
                        className={`flex size-[18px] shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${i < done ? "bg-violet text-white" : "border border-lilac bg-white"}`}
                      >
                        {i < done && <CheckIcon key={`c${run}`} size={11} className={moving ? "land-enter" : ""} />}
                      </span>
                      {w}
                    </span>
                  ))}
                </span>
              </Her>
            </Row>
          )}
          {phase >= 4 && (
            <Row key={`t${run}`} fresh={moving}>
              <Her>
                <strong className="font-bold text-violet">Ta-da.</strong> Ton carrousel est prêt : tes photos retouchées, tes couleurs, ta police. Je le publie ?
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  {["Oui, publie-le", "Change un texte"].map((label) => (
                    <span key={label} className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-bold text-violet">
                      {label}
                    </span>
                  ))}
                </span>
              </Her>
            </Row>
          )}
        </div>
        {/* Her message box: she types her idea, and sends it. */}
        <div className="flex items-center gap-2 border-t border-line/70 bg-white/80 px-3 py-2.5">
          <span className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-line bg-white px-4 text-[14px]">
            {draft ? (
              <>
                <span className="truncate">{draft}</span>
                <span className="land-caret ml-px h-[17px] w-[1.5px] shrink-0 bg-violet" />
              </>
            ) : (
              <span className="text-muted/70">Écris à Edith…</span>
            )}
          </span>
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${draft ? "bg-violet text-white" : "bg-violet-soft text-violet/50"}`}>
            <ArrowUpIcon size={18} />
          </span>
        </div>
      </div>

      {/* The result: the carousel develops, then becomes the post */}
      <div className="flex flex-col items-center gap-3">
        <figure className="w-full max-w-[400px] overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_30px_70px_-30px_rgba(28,21,48,.35)]">
          <span className={`flex items-center gap-2 px-3.5 py-3 transition-opacity duration-700 ${phase === 4 ? "opacity-100" : "opacity-35"}`}>
            <span className="size-8 shrink-0 rounded-full bg-[conic-gradient(from_180deg,#F2694E,#5B3FD9,#F2694E)] p-[2px]">
              <span className="block size-full rounded-full border-2 border-white bg-[#6D2E46]" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[13.5px] font-bold">maison.maya</span>
              <span className="text-[11.5px] text-muted">Paris 11e</span>
            </span>
          </span>
          <span className="relative block aspect-[4/5] w-full overflow-hidden bg-[#f4efe9]">
            {SHOWCASE_SLIDES.map((file, i) => {
              const sheet = `translate(${2.7 + (i % 2) * 48.6}%, ${2.7 + Math.floor(i / 2) * 48.6}%) scale(0.46)`;
              const strip = `translateX(${(i - at) * 100}%)`;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={file}
                  src={`${BASE}/${file}`}
                  alt={`Carrousel de Maison Maya, photo ${i + 1}`}
                  loading="lazy"
                  data-stage={stage}
                  className="land-slide absolute inset-0 size-full origin-top-left object-cover"
                  style={{
                    transform: phase === 4 ? strip : sheet,
                    borderRadius: phase === 4 ? 0 : 22,
                    boxShadow: phase === 4 ? "none" : "0 18px 40px -16px rgba(28,21,48,.45)",
                    // Gathering into the post: the first photo grows, the others follow it out.
                    transitionDelay: gathering ? `${i * 70}ms` : "0ms",
                  }}
                />
              );
            })}
            {/* A light passes over the photos at each step. */}
            {phase === 3 && done > 0 && <span key={`s${run}-${done}`} className="land-sweep pointer-events-none absolute inset-0" />}
            {phase === 4 && (
              <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[11.5px] font-semibold text-white tabular-nums">
                {at + 1}/{SHOWCASE_SLIDES.length}
              </span>
            )}
          </span>
          <span className={`flex items-center gap-3 px-3.5 pt-3 pb-3.5 transition-opacity duration-700 ${phase === 4 ? "opacity-100" : "opacity-35"}`} aria-hidden="true">
            {["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", "M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z", "M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z"].map((d) => (
              <svg key={d} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
                <path d={d} />
              </svg>
            ))}
            <span className="mx-auto flex gap-1">
              {SHOWCASE_SLIDES.map((f, i) => (
                <span key={f} className={`size-1.5 rounded-full transition-colors duration-300 ${phase === 4 && i === at ? "bg-violet" : "bg-line"}`} />
              ))}
            </span>
            <span className="w-[82px]" />
          </span>
        </figure>
        <span className="flex items-center gap-3 text-[13px] font-semibold text-muted">
          Carrousel fait par Edith · Salon de coiffure · Paris
          {phase === 4 && moving && (
            <button type="button" onClick={play} className="font-bold text-violet hover:underline">
              Revoir
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/** A message arriving: the conversation makes room, then it rises in. */
function Row({ fresh, children }: { fresh: boolean; children: ReactNode }) {
  return (
    <div className={`land-msg ${fresh ? "is-new" : ""}`}>
      <div className="flex flex-col">
        <div className="flex flex-col">{children}</div>
      </div>
    </div>
  );
}

function Her({ children }: { children: ReactNode }) {
  return <div className="max-w-[90%] self-start rounded-[16px_16px_16px_4px] border border-line bg-white px-3.5 py-2.5 text-[14px] leading-[1.45]">{children}</div>;
}

function Me({ children }: { children: ReactNode }) {
  return <div className="max-w-[82%] self-end rounded-[16px_16px_4px_16px] bg-violet px-3.5 py-2.5 text-[14px] leading-[1.45] text-white">{children}</div>;
}
