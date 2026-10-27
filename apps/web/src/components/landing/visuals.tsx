import type { CSSProperties, ReactNode } from "react";
import { CheckIcon, PlayIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { PHOTOS, unsplash } from "./photos";

// What each card of the landing shows, alive: drawings of what Edith does, played by
// landing.css once their <Play> is on screen (land-once: plays once, land-loop: loops while
// on screen). Their plain styles are the finished picture (the server's, and reduced motion's).

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

/* ── « Refais-moi ce Reel »: the Reel she likes, then hers in the same form ─────────────── */

export function CopyReelVisual() {
  return (
    <span className="mt-5 flex flex-col gap-2">
      <span className="land-once land-rise self-end rounded-[14px_14px_4px_14px] bg-violet px-3 py-2 text-[12.5px] text-white" style={v({ "--d": "0.1s" })}>
        instagram.com/reel/… fais-moi le même
      </span>
      <span className="land-once land-rise max-w-[94%] rounded-[14px_14px_14px_4px] border border-line bg-soft px-3 py-2.5 text-[12.5px] leading-snug text-ink" style={v({ "--d": "0.8s" })}>
        Je reprends son écran partagé, ses coupes sur le temps et ses petits textes en minuscules. Avec ta vidéo en bas.
      </span>
      <span className="mt-4 flex items-end justify-center gap-3">
        <MiniPhone label="Le Reel que tu aimes" d="1.3s">
          <span className="flex h-1/2 flex-col items-center justify-center gap-1.5 bg-[#e9e7ec] px-2">
            <span className="h-[7px] w-[70%] rounded-full bg-[#b9b4c2]" />
            <span className="h-[7px] w-[52%] rounded-full bg-[#b9b4c2]" />
          </span>
          <span className="flex h-1/2 items-center justify-center bg-[#cfcbd6] text-white">
            <PlayIcon size={16} />
          </span>
        </MiniPhone>
        <svg width="34" height="14" viewBox="0 0 34 14" fill="none" stroke="var(--color-violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="land-once land-fade mb-[78px]" style={v({ "--d": "1.7s" })}>
          <path d="M1 7h30M26 2l5 5-5 5" />
        </svg>
        <MiniPhone label="Le tien" d="2s" wipe>
          <span className="flex h-1/2 flex-col items-center justify-center bg-[#efe6da] px-1.5 text-center">
            <span className="text-[9px] font-bold text-[#2f3b2f]">pov :</span>
            <span className="font-[family-name:var(--font-serif)] text-[16px] leading-none text-[#b4532a] italic">ton 1er cours</span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/tile-4.webp" alt="" className="h-1/2 w-full object-cover" />
        </MiniPhone>
      </span>
    </span>
  );
}

function MiniPhone({ label, d, wipe = false, children }: { label: string; d: string; wipe?: boolean; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className={`land-once ${wipe ? "land-wipe" : "land-rise"} flex h-[164px] w-[92px] flex-col overflow-hidden rounded-[16px] border-[3px] border-ink bg-ink`} style={v({ "--d": d })}>
        {children}
      </span>
      <span className="text-[11px] font-bold text-muted">{label}</span>
    </span>
  );
}

/* ── A voice: its waveform, and the word being said in the subtitle ─────────────────────── */

const WAVE = Array.from({ length: 30 }, (_, i) => 26 + Math.round(70 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.55))));
const SAID = ["Ton", "cours", "de 7 h,", "c’est", "le moment", "préféré", "du", "quartier."];

export function VoiceVisual() {
  return (
    <span className="mt-5 block rounded-[18px] bg-soft p-3.5">
      <span className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet text-white">
          <PlayIcon size={14} />
        </span>
        <span className="flex h-9 min-w-0 flex-1 items-center gap-[3px]" aria-hidden="true">
          {WAVE.map((h, i) => (
            <span key={i} className="land-loop land-wave w-[3px] shrink-0 rounded-full bg-violet/75" style={v({ height: `${h}%`, "--d": `${-(i % 7) * 0.16}s` })} />
          ))}
        </span>
        <span className="shrink-0 text-[11.5px] font-bold text-muted">Eva</span>
      </span>
      <span className="mt-3 block text-[13.5px] leading-[1.75] font-semibold text-ink">
        {SAID.map((w, i) => (
          <span key={w}>
            <span className="land-loop land-said -mx-[2px] rounded-[6px] px-[3px] py-[1px]" style={v({ "--i": i, "--dur": "4.8s", "--step": "0.6s" })}>
              {w}
            </span>{" "}
          </span>
        ))}
      </span>
    </span>
  );
}

/* ── Music: the cuts of the Reel fall on the beat ─────────────────────────────────────── */

const CLIPS = [
  { src: "/landing/tile-1.webp", w: 22 },
  { src: "/landing/tile-2.webp", w: 30 },
  { src: "/landing/tile-3.webp", w: 18 },
  { src: "/landing/tile-5.webp", w: 30 },
];
const CUTS = [0.22, 0.52, 0.7];
const BARS = Array.from({ length: 44 }, (_, i) => {
  const beat = CUTS.some((c) => Math.abs(c * 44 - i) < 0.6) || i % 6 === 0;
  return { h: beat ? 92 : 22 + Math.round(40 * Math.abs(Math.sin(i * 2.3))), beat };
});

export function MusicVisual() {
  return (
    <span className="mt-5 block rounded-[18px] bg-ink p-3.5 text-white">
      <span className="relative block">
        <span className="flex h-11 gap-[3px] overflow-hidden rounded-[8px]">
          {CLIPS.map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c.src} src={c.src} alt="" className="h-full min-w-0 object-cover opacity-90" style={{ width: `${c.w}%` }} />
          ))}
        </span>
        <span className="mt-2 flex h-8 items-end gap-[2px]" aria-hidden="true">
          {BARS.map((b, i) => (
            <span key={i} className={`flex-1 rounded-full ${b.beat ? "bg-lilac" : "bg-white/25"}`} style={{ height: `${b.h}%` }} />
          ))}
        </span>
        {CUTS.map((x) => (
          <span key={x} className="land-loop land-cut absolute -top-1 -bottom-1 w-[2px] rounded-full bg-coral/70" style={v({ left: `calc(${x * 100}% - 1px)`, "--x": x })} />
        ))}
        <span className="land-loop land-playhead absolute -top-2 -bottom-2 w-[2px] bg-white shadow-[0_0_10px_rgba(255,255,255,.6)]" style={{ left: "38%" }}>
          <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-white" />
        </span>
      </span>
      <span className="mt-3 flex items-center justify-between text-[11.5px] font-semibold text-white/70">
        <span>Composée pour ce Reel</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 tabular-nums">98 BPM</span>
      </span>
    </span>
  );
}

/* ── Gestures: thumb and index part, the word grows between them ───────────────────────── */

export function GestureVisual() {
  return (
    <span className="relative mt-5 block h-[170px] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_25%_15%,#ffe9e1,transparent_55%),linear-gradient(160deg,#efebff,#fbf7f4)]">
      <span className="absolute inset-0 bg-[linear-gradient(rgba(91,63,217,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(91,63,217,.06)_1px,transparent_1px)] bg-[size:18px_18px]" aria-hidden="true" />
      <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-0.5 text-[10.5px] font-bold text-muted">
        <span className="size-1.5 rounded-full bg-coral" />
        Suivi image par image
      </span>
      <span className="absolute top-[56%] left-1/2" aria-hidden="true">
        <span className="land-loop land-pinch-line absolute top-0 left-0 h-[2px] w-[100px] rounded-full bg-violet/35" style={{ transform: "translate(-50%, -50%) rotate(-37deg)" }} />
        <span className="land-loop land-pinch-word absolute top-0 left-0 font-[family-name:var(--font-serif)] text-[46px] leading-none whitespace-nowrap text-ink italic" style={{ transform: "translate(-50%, -50%)" }}>
          nouveau
        </span>
        <span className="land-loop land-thumb absolute -top-[7px] -left-[7px] size-3.5 rounded-full bg-coral shadow-[0_0_0_5px_rgba(242,105,78,.22)]" style={{ transform: "translate(-40px, 30px)" }} />
        <span className="land-loop land-index absolute -top-[7px] -left-[7px] size-3.5 rounded-full bg-violet shadow-[0_0_0_5px_rgba(91,63,217,.2)]" style={{ transform: "translate(40px, -30px)" }} />
      </span>
    </span>
  );
}

/* ── Layouts: one frame, three forms ─────────────────────────────────────────────────── */

export function LayoutsVisual() {
  return (
    <span className="mt-5 flex items-center gap-5">
      <span className="land-loop land-lay-bg relative h-[176px] w-[99px] shrink-0 overflow-hidden rounded-[16px] border-[3px] border-ink bg-ink" aria-hidden="true">
        {(
          [
            ["/landing/tile-4.webp", "land-lay-a", "0", ""],
            ["/landing/tile-2.webp", "land-lay-b", "100% 0 -50% 0", ""],
            ["/landing/tile-3.webp", "land-lay-c", "110% 20% -40% 14%", "opacity-0 shadow-[0_6px_14px_rgba(0,0,0,.25)]"],
          ] as const
        ).map(([src, move, inset, look]) => (
          // A box that changes place and size (an image would keep its own size), the photo filling it.
          <span key={src} className={`land-loop ${move} absolute overflow-hidden ${look}`} style={{ inset }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-full object-cover" />
          </span>
        ))}
      </span>
      <span className="relative h-7 flex-1">
        {(
          [
            ["Plein cadre", "0s", 1],
            ["Écran partagé", "-6s", 0],
            ["Collage", "-3s", 0],
          ] as const
        ).map(([label, d, shown]) => (
          <span key={label} className="land-loop land-lay-label absolute inset-0 flex items-center text-[15px] font-extrabold text-ink" style={v({ "--d": d, opacity: shown })}>
            {label}
          </span>
        ))}
      </span>
    </span>
  );
}

/* ── Captions: written word after word, then its hashtags ─────────────────────────────── */

const CAPTION = "Le cours de 7 h, c’est notre moment préféré. Lumière douce, 8 personnes max, et la journée qui commence bien. Réserve ta place, lien en bio.";

export function CaptionVisual() {
  const words = CAPTION.split(" ");
  return (
    <span className="mt-4 block rounded-[14px] border border-line bg-soft p-3.5 text-[13.5px] leading-relaxed text-ink">
      {words.map((w, i) => (
        <span key={i} className="land-once land-fade" style={v({ "--d": `${0.15 + i * 0.045}s`, animationDuration: "0.35s" })}>
          {w}{" "}
        </span>
      ))}
      <span className="mt-1.5 flex flex-wrap gap-x-1.5 font-semibold text-violet">
        {["#pilateslyon", "#studiolune", "#coursdumatin"].map((t, i) => (
          <span key={t} className="land-once land-pop" style={v({ "--d": `${0.25 + words.length * 0.045 + i * 0.12}s` })}>
            {t}
          </span>
        ))}
      </span>
    </span>
  );
}

/* ── The right moment: his message arrives, she taps « Oui » ──────────────────────────── */

export function ReminderVisual() {
  return (
    <span className="mt-4 block overflow-hidden rounded-[18px] bg-[linear-gradient(165deg,#2c2546,#1c1530_70%)] p-3">
      <span className="land-once land-drop flex flex-col gap-1 rounded-[14px] bg-white/95 p-2.5 shadow-[0_10px_24px_rgba(0,0,0,.25)]" style={v({ "--d": "0.15s" })}>
        <span className="flex items-center gap-2">
          <span className="flex size-[22px] items-center justify-center overflow-hidden rounded-[6px] bg-violet-soft">
            <Mascot size={20} still />
          </span>
          <span className="text-[12px] font-bold text-ink">Edith</span>
          <span className="ml-auto text-[10.5px] text-muted">maintenant</span>
        </span>
        <span className="text-[12.5px] leading-snug text-ink">C’est le bon moment pour poster ton Reel : vendredi 18 h, tes clientes sont là. Je le publie ?</span>
      </span>
      <span className="mt-2 flex gap-1.5">
        <span className="land-once land-rise flex-1 overflow-hidden rounded-full" style={v({ "--d": "0.9s" })}>
          <span className="land-once land-press block rounded-full bg-violet py-1.5 text-center text-[11.5px] font-bold text-white" style={v({ "--d": "1.7s" })}>
            Oui, publie-le
          </span>
        </span>
        <span className="land-once land-rise flex-1 rounded-full bg-white/12 py-1.5 text-center text-[11.5px] font-bold text-white/80" style={v({ "--d": "1s" })}>
          Je regarde d’abord
        </span>
      </span>
      <span className="land-once land-rise mt-2.5 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-lilac-ink" style={v({ "--d": "2.4s" })}>
        <CheckIcon size={13} />
        Publié sur Instagram
      </span>
    </span>
  );
}

/* ── Sunday's report: what worked, the bars of the week ───────────────────────────────── */

const WEEK = [38, 52, 44, 86, 61, 72, 49];

export function ReportVisual() {
  return (
    <span className="mt-4 flex flex-col gap-3">
      <span className="relative flex h-[96px] items-end gap-1.5 pt-5">
        {WEEK.map((h, i) => (
          <span key={i} className={`land-once land-grow relative flex-1 rounded-t-[6px] ${i === 3 ? "bg-violet" : "bg-lilac"}`} style={v({ height: `${h}%`, "--d": `${0.1 + i * 0.07}s` })}>
            {i === 3 && (
              <span className="land-once land-pop absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white" style={v({ "--d": "1.25s" })}>
                +38 %
              </span>
            )}
          </span>
        ))}
      </span>
      <span className="land-once land-rise rounded-[12px] bg-violet-tint px-3 py-2 text-[12.5px] leading-snug text-violet" style={v({ "--d": "1.2s" })}>
        Tes Reels du jeudi matin amènent le plus de visites sur ton profil : on garde ce moment.
      </span>
    </span>
  );
}

/* ── Retouch: the line between before and after ──────────────────────────────────────── */

export function RetouchVisual() {
  const photo = unsplash(PHOTOS.cafe, 320, 200);
  return (
    <span className="relative mt-4 block h-[132px] overflow-hidden rounded-[14px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" style={{ filter: "brightness(1.1) saturate(1.22) contrast(1.06)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" loading="lazy" className="land-loop land-before absolute inset-0 size-full object-cover" style={{ filter: "brightness(.7) saturate(.6) contrast(.9)", clipPath: "inset(0 50% 0 0)" }} />
      <span className="land-loop land-split absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,.25)]" style={{ left: "50%" }}>
        <span className="absolute top-1/2 left-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 1 .8 4l2.7 3M8.5 1l2.7 3-2.7 3" />
          </svg>
        </span>
      </span>
      <span className="absolute top-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white">Avant</span>
      <span className="absolute top-2 right-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold text-ink">Après</span>
    </span>
  );
}
