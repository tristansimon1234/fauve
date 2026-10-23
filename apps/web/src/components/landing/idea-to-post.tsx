"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { Mascot, type MascotMood } from "@/components/mascot";
import { CarouselShowcase, SHOWCASE_SLIDES } from "./showcase";

// « Toi, les idées ; moi, j'exécute » : the manager gives an idea in one line,
// Simone works (texts, layout in her colours, retouch) and the real carousel
// she made for the demo salon appears with a « Ta-da ». Plays when it comes on
// screen, once (« Revoir » replays it); the end state at once when the device
// asks for reduced motion.

/** 0 nothing yet, 1 the idea, 2 Simone at work, 3 ta-da. */
type Phase = 0 | 1 | 2 | 3;
const WORK = ["J’écris les textes", "Je les pose à tes couleurs", "Je retouche les photos"];
const MOODS: Record<Phase, MascotMood> = { 0: "idle", 1: "happy", 2: "thinking", 3: "laugh" };

export function IdeaToPost() {
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [phase, setPhase] = useState<Phase>(0);
  const [done, setDone] = useState(0);
  const [still, setStill] = useState(false);
  const [run, setRun] = useState(0);

  const play = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    setPhase(0);
    setDone(0);
    at(250, () => setPhase(1));
    at(1300, () => setPhase(2));
    WORK.forEach((_, i) => at(2000 + i * 650, () => setDone(i + 1)));
    at(2000 + WORK.length * 650 + 300, () => {
      setPhase(3);
      setRun((r) => r + 1);
    });
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => {
        setStill(true);
        setPhase(3);
        setDone(WORK.length);
      }, 0);
      return () => clearTimeout(t);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        play();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    const list = timers.current;
    return () => {
      io.disconnect();
      list.forEach(clearTimeout);
    };
  }, []);

  return (
    <div ref={ref} className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
      {/* The conversation */}
      <div className="flex flex-col overflow-hidden rounded-[28px] bg-chat shadow-[0_24px_60px_rgba(28,21,48,.12)]">
        <div className="flex items-center gap-3 border-b border-line/80 bg-white/60 px-5 py-3.5">
          <Mascot size={48} mood={MOODS[phase]} still={still} />
          <span className="flex flex-col">
            <span className="text-[16px] font-bold">Simone</span>
            <span className="text-[12.5px] text-muted">{phase === 2 ? "au travail…" : "ton community manager"}</span>
          </span>
        </div>
        <div className="flex min-h-[300px] flex-col justify-end gap-2.5 px-4 pt-4 pb-5 sm:min-h-[340px] sm:px-5">
          {phase >= 1 && <Me>Tu me fais un carrousel avec 3 conseils pour les cheveux en hiver ? ❄️</Me>}
          {phase >= 2 && (
            <Her>
              <span className="flex flex-col gap-1.5">
                {WORK.map((w, i) => (
                  <span key={w} className={`flex items-center gap-2 transition-opacity duration-300 ${i < done ? "opacity-100" : "opacity-40"}`}>
                    <span className={`flex size-4.5 shrink-0 items-center justify-center rounded-full ${i < done ? "bg-violet text-white" : "border border-line"}`}>
                      {i < done && <CheckIcon size={11} />}
                    </span>
                    {w}
                  </span>
                ))}
              </span>
            </Her>
          )}
          {phase >= 3 && (
            <Her>
              <strong className="text-violet">Ta-da ✨</strong> Ton carrousel est prêt : 4 photos, tes couleurs, ta police. Je le publie maintenant ?
              <span className="mt-2.5 flex flex-wrap gap-1.5">
                {["Oui, valide", "Change un texte"].map((label) => (
                  <span key={label} className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-bold text-violet">
                    {label}
                  </span>
                ))}
              </span>
            </Her>
          )}
        </div>
      </div>

      {/* The result */}
      <div className="relative flex flex-col items-center gap-3">
        {phase >= 3 && SHOWCASE_SLIDES.length > 0 ? (
          <div key={run} className={`relative w-full max-w-[400px] ${still ? "" : "landing-tada"}`}>
            <CarouselShowcase className="max-w-[400px]" />
            {!still && <Sparkles />}
          </div>
        ) : (
          <div className="relative flex aspect-[4/5] w-full max-w-[400px] flex-col items-center justify-center gap-3 overflow-hidden rounded-[18px] border border-dashed border-lilac bg-white/70">
            <span className={`absolute inset-0 ${phase === 2 ? "landing-shimmer" : ""}`} aria-hidden="true" />
            <span className="relative text-[15px] font-bold text-muted">{phase === 2 ? "Simone prépare ton carrousel…" : "Ton idée ici"}</span>
          </div>
        )}
        <span className="flex items-center gap-3 text-[13px] font-semibold text-muted">
          Carrousel fait par Simone · Salon de coiffure · Paris
          {phase === 3 && !still && (
            <button type="button" onClick={play} className="font-bold text-violet hover:underline">
              Revoir
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/** A few stars bursting around the carousel at the ta-da. */
function Sparkles() {
  const stars = [
    { x: "-4%", y: "8%", s: 22, d: 0 },
    { x: "96%", y: "4%", s: 26, d: 80 },
    { x: "102%", y: "46%", s: 18, d: 160 },
    { x: "-8%", y: "58%", s: 20, d: 120 },
    { x: "88%", y: "92%", s: 24, d: 220 },
    { x: "6%", y: "96%", s: 16, d: 260 },
  ];
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {stars.map((st, i) => (
        <svg
          key={i}
          width={st.s}
          height={st.s}
          viewBox="0 0 24 24"
          className="landing-spark absolute"
          style={{ left: st.x, top: st.y, animationDelay: `${st.d}ms`, color: i % 2 ? "#F2694E" : "#5B3FD9" }}
        >
          <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" fill="currentColor" />
        </svg>
      ))}
    </span>
  );
}

function Her({ children }: { children: ReactNode }) {
  return <div className="fauve-enter max-w-[90%] self-start rounded-[16px_16px_16px_4px] border border-line bg-white px-3.5 py-2.5 text-[14px] leading-[1.45]">{children}</div>;
}

function Me({ children }: { children: ReactNode }) {
  return <div className="fauve-enter max-w-[82%] self-end rounded-[16px_16px_4px_16px] bg-violet px-3.5 py-2.5 text-[14px] leading-[1.45] text-white">{children}</div>;
}
