"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Mascot, type MascotMood } from "@/components/mascot";
import { PHOTOS, ReelMock, unsplash } from "./mocks";

// The landing's living example: a manager gives her site, Simone reads it,
// her first Reel arrives, she loves it. Plays once in a loop; still (the whole
// conversation at once) when the device asks for reduced motion.

/** Simone's face at each step: 1 her site, 2 reading it, 3 what she saw, 4 editing, 5 the first Reel, 6 « J'adore ». */
const MOODS: MascotMood[] = ["idle", "happy", "thinking", "happy", "thinking", "surprised", "laugh"];
/** When each step comes, from the start of a loop (ms). */
const AT = [0, 0, 900, 2400, 4200, 6000, 9000];
const LOOP_MS = 13000;

export function LandingDemo() {
  // The site and its reading are there from the first frame: the card is never empty.
  const [step, setStep] = useState(3);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      at(0, () => {
        setStill(true);
        setStep(6);
      });
      return () => timers.forEach(clearTimeout);
    }
    // First pass from what is already shown, then the whole conversation in a loop.
    const offset = AT[3]! - 1500;
    for (let s = 4; s <= 6; s++) at(AT[s]! - offset, () => setStep(s));
    const loop = (from: number) => {
      for (let s = 1; s <= 6; s++) at(from + AT[s]!, () => setStep(s));
      at(from + LOOP_MS, () => loop(0));
    };
    at(AT[6]! - offset + 3500, () => loop(0));
    return () => timers.forEach(clearTimeout);
  }, []);

  const mood = MOODS[step] ?? "idle";
  const typing = step === 2 || step === 4;
  const seen = (n: number) => step >= n;

  return (
    <div className="flex flex-col overflow-hidden rounded-[28px] bg-chat shadow-[0_24px_60px_rgba(28,21,48,.12)]" aria-label="Exemple de conversation avec Simone">
      <div className="flex items-center gap-3 border-b border-line/80 bg-white/60 px-5 py-3.5">
        <Mascot size={52} mood={mood} still={still} />
        <span className="flex flex-col">
          <span className="text-[16px] font-bold">Simone</span>
          <span className="text-[12.5px] text-muted">{typing ? "écrit…" : "ton community manager"}</span>
        </span>
      </div>
      <div className="flex h-[400px] flex-col justify-end gap-2.5 overflow-hidden px-4 pt-4 pb-5 sm:h-[470px] sm:px-5">
        {seen(1) && <Me>Voici mon site : studiolune.fr</Me>}
        {seen(3) && (
          <Her>
            J’ai tout lu ✨ Studio Lune, Pilates à Lyon. J’ai pris tes couleurs et tes plus belles photos pour ton moodboard.
            <span className="mt-2.5 flex items-center gap-2">
              {["#2F3B2E", "#E9DFCF", "#C7835B"].map((c) => (
                <span key={c} className="size-6 rounded-full border-2 border-white shadow-sm" style={{ background: c }} />
              ))}
              <span className="ml-1 grid grid-cols-3 gap-1">
                {[PHOTOS.studioClass, PHOTOS.groupClass, PHOTOS.yogaSunset].map((id) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={id} src={unsplash(id, 28, 32)} alt="" className="h-8 w-7 rounded-[6px] object-cover" />
                ))}
              </span>
            </span>
          </Her>
        )}
        {seen(5) && (
          <Her>
            <span className="flex items-end gap-3">
              <ReelMock width={92} still={still} />
              <span className="flex flex-col gap-2 pb-1">
                Ton premier Reel est prêt, pour l’essai. Ça te ressemble ?
              </span>
            </span>
            <span className="mt-2.5 flex flex-wrap gap-1.5">
              {["Ça me ressemble", "Plus rapide", "Moins de texte"].map((label) => (
                <span key={label} className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-bold text-violet">
                  {label}
                </span>
              ))}
            </span>
          </Her>
        )}
        {seen(6) && <Me reaction="❤️">J’adore, c’est tout à fait nous 😍</Me>}
        {typing && (
          <span className="fauve-enter fauve-dots flex w-fit gap-1 rounded-[16px_16px_16px_4px] border border-line bg-white px-3.5 py-3" aria-hidden="true">
            <span className="size-1.5 rounded-full bg-muted" />
            <span className="size-1.5 rounded-full bg-muted [animation-delay:150ms]" />
            <span className="size-1.5 rounded-full bg-muted [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  );
}

function Her({ children }: { children: ReactNode }) {
  return <div className="fauve-enter max-w-[88%] self-start rounded-[16px_16px_16px_4px] border border-line bg-white px-3.5 py-2.5 text-[14px] leading-[1.45]">{children}</div>;
}

function Me({ children, reaction }: { children: ReactNode; reaction?: string }) {
  return (
    <div className="fauve-enter relative max-w-[80%] self-end rounded-[16px_16px_4px_16px] bg-violet px-3.5 py-2.5 text-[14px] leading-[1.45] text-white">
      {children}
      {reaction && (
        <span className="fauve-pop absolute -bottom-3 left-2 rounded-full border border-line bg-white px-1.5 py-0.5 text-[13px] leading-none shadow-sm [animation-delay:700ms] [animation-fill-mode:backwards]">
          {reaction}
        </span>
      )}
    </div>
  );
}
