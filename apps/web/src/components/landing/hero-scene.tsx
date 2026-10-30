"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChartIcon, ChatIcon, CheckIcon, GridIcon, PaletteIcon, PlusIcon } from "@/components/icons";
import { Mascot, type MascotMood } from "@/components/mascot";

// The landing's hero, what Edith is in one look (Tristan: « on doit mettre en avant assistant IA
// sur WhatsApp et via une app web »): WhatsApp on her phone, and the app beside it, in sync. She
// sends her videos and asks for a Reel; Edith answers, the app shows it being made, then ready;
// one touch on « Partager » opens Instagram with it, she posts it and her profile visits come in
// (Edith publishes nothing himself: Tristan, « l'interface doit refléter la réalité »). Then Edith suggests a post on
// his own (a carousel of advice, never a promotion), and it goes on, the conversation scrolling
// like a real one: the screen is never empty and never resets. The Reel and the grid come from the
// landing's demo studio (public/landing). Still on its last picture when the device asks for less motion.

const REEL = "/landing/work-pilates.mp4";
const REEL_POSTER = "/landing/work-pilates.webp";
const POST = "/landing/post-planche.webp";
const CLIPS = ["/landing/raw-pilates-0.webp", "/landing/raw-pilates-1.webp", "/landing/raw-pilates-2.webp"];

type Msg =
  | { id: string; kind: "day"; text: string }
  | { id: string; kind: "text"; me?: boolean; text: string; at: string }
  | { id: string; kind: "clips"; at: string; sent: boolean }
  | { id: string; kind: "ask"; at: string; text: string; options: [string, string]; picked?: boolean; video?: string; image?: string };

type Tile = { id: string; src: string; state?: "making" | "ready" | "live"; step?: number; video?: boolean };

type Scene = {
  msgs: Msg[];
  /** Ids of the messages there from the start (no entrance). */
  writing: boolean;
  draft: string;
  tiles: Tile[];
  visits: number;
  card: boolean;
  tap: string | null;
  mood: MascotMood;
};

const START: Scene = {
  msgs: [
    { id: "s1", kind: "day", text: "Hier" },
    { id: "s2", kind: "text", text: "Ton carrousel d’hier a amené 23 visites sur ton profil. On garde ce format ?", at: "18:12" },
    { id: "s3", kind: "text", me: true, text: "Carrément !", at: "18:20" },
    { id: "s4", kind: "day", text: "Aujourd’hui" },
    { id: "s5", kind: "text", text: "Bonjour ! Envoie-moi tes vidéos quand tu en as, je m’occupe du reste.", at: "9:30" },
  ],
  writing: false,
  draft: "",
  tiles: [
    { id: "p1", src: "/landing/tile-1.webp" },
    { id: "p2", src: "/landing/tile-2.webp" },
    { id: "p3", src: "/landing/tile-3.webp" },
    { id: "p4", src: "/landing/tile-4.webp" },
    { id: "p5", src: "/landing/tile-5.webp" },
    { id: "p6", src: "/landing/tile-6.webp" },
  ],
  visits: 0,
  card: false,
  tap: null,
  mood: "idle",
};
const FIRST = new Set(START.msgs.map((m) => m.id));

type Step = [number, (s: Scene) => Scene];

const add = (m: Msg) => (s: Scene): Scene => ({ ...s, msgs: [...s.msgs, m].slice(-12) });
const patchMsg = (id: string, change: Partial<Msg>) => (s: Scene): Scene => ({
  ...s,
  msgs: s.msgs.map((m) => (m.id === id ? ({ ...m, ...change } as Msg) : m)),
});
const patchTile = (id: string, change: Partial<Tile>) => (s: Scene): Scene => ({ ...s, tiles: s.tiles.map((t) => (t.id === id ? { ...t, ...change } : t)) });
const newTile = (t: Tile) => (s: Scene): Scene => ({ ...s, tiles: [t, ...s.tiles].slice(0, 7) });
const set = (change: Partial<Scene>) => (s: Scene): Scene => ({ ...s, ...change });
const all = (...fns: ((s: Scene) => Scene)[]) => (s: Scene): Scene => fns.reduce((acc, fn) => fn(acc), s);

/** Her words typed in the box, letter by letter, then sent. */
function typed(text: string, from: number, id: string, at: string): { steps: Step[]; end: number } {
  const steps: Step[] = [];
  for (let i = 1; i <= text.length; i++) steps.push([from + i * 32, set({ draft: text.slice(0, i) })]);
  const end = from + text.length * 32 + 380;
  steps.push([end, all(set({ draft: "" }), add({ id, kind: "text", me: true, text, at }))]);
  return { steps, end };
}

/** She sends her videos and asks for a Reel; Edith makes it, she shares it to Instagram herself. */
function reelStory(n: number): { steps: Step[]; length: number } {
  const k = `a${n}`;
  const ask = typed("Tu m’en fais un Reel pour vendredi ?", 1900, `${k}q`, "9:42");
  return {
    length: 15800,
    steps: [
      ...(n > 0 ? ([[0, add({ id: `${k}d`, kind: "day", text: "Lundi" })]] as Step[]) : []),
      [n > 0 ? 500 : 300, add({ id: `${k}c`, kind: "clips", at: "9:41", sent: false })],
      [1400, patchMsg(`${k}c`, { sent: true })],
      ...ask.steps,
      [ask.end + 400, all(set({ writing: true, mood: "thinking", card: false }), newTile({ id: `${k}t`, src: REEL_POSTER, state: "making", step: 0, video: true }))],
      [ask.end + 1300, all(set({ writing: false, mood: "happy" }), add({ id: `${k}r`, kind: "text", text: "Je m’en occupe. Je te l’envoie dès qu’il est prêt.", at: "9:42" }))],
      [ask.end + 2400, patchTile(`${k}t`, { step: 1 })],
      [ask.end + 3400, all(patchTile(`${k}t`, { step: 2 }), set({ writing: true, mood: "thinking" }))],
      [
        ask.end + 4300,
        all(
          set({ writing: false, mood: "happy" }),
          patchTile(`${k}t`, { state: "ready", step: 3 }),
          add({ id: `${k}v`, kind: "ask", at: "9:58", video: REEL, text: "Ton Reel est prêt, légende comprise. Touche « Partager » sur sa page : il s’ouvre dans Instagram.", options: ["Voir mon Reel", "Plus tard"] }),
        ),
      ],
      [ask.end + 6900, set({ tap: `${k}v` })],
      [ask.end + 7250, all(set({ tap: null }), patchMsg(`${k}v`, { picked: true }), add({ id: `${k}y`, kind: "text", me: true, text: "Posté ! Avec un son tendance en plus", at: "10:04" }))],
      [ask.end + 7900, set({ writing: true, mood: "thinking" })],
      [
        ask.end + 8600,
        all(
          set({ writing: false, mood: "laugh", card: true, visits: 41 }),
          patchTile(`${k}t`, { state: "live" }),
          add({ id: `${k}o`, kind: "text", text: "Bien vu pour le son. Je suis ses chiffres et je te dis dimanche ce qu’il a donné.", at: "10:04" }),
        ),
      ],
      [ask.end + 11000, set({ mood: "idle" })],
    ],
  };
}

/** Edith suggests a carousel on his own (advice people save, not an offer); she says yes, then posts it herself. */
function postStory(n: number): { steps: Step[]; length: number } {
  const k = `b${n}`;
  return {
    length: 13600,
    steps: [
      [0, add({ id: `${k}d`, kind: "day", text: "Mercredi" })],
      [500, set({ writing: true, mood: "thinking" })],
      [
        1400,
        all(
          set({ writing: false, mood: "happy" }),
          add({ id: `${k}a`, kind: "ask", at: "18:02", text: "Le mercredi soir, tes posts amènent le plus de visites. Je te fais un carrousel « 3 erreurs en planche » avec tes vidéos de mardi ?", options: ["Oui, vas-y", "Pas cette semaine"] }),
        ),
      ],
      [3700, set({ tap: `${k}a` })],
      [4050, all(set({ tap: null }), patchMsg(`${k}a`, { picked: true }), add({ id: `${k}y`, kind: "text", me: true, text: "Oui, vas-y", at: "18:03" }))],
      [4500, all(set({ writing: true, mood: "thinking" }), newTile({ id: `${k}t`, src: POST, state: "making", step: 0 }))],
      [5400, patchTile(`${k}t`, { step: 1 })],
      [6300, patchTile(`${k}t`, { step: 2 })],
      [
        7100,
        all(
          set({ writing: false, mood: "happy" }),
          patchTile(`${k}t`, { state: "ready", step: 3 }),
          add({ id: `${k}p`, kind: "ask", at: "18:05", image: POST, text: "Le voilà, à tes couleurs. Ses images et sa légende sont prêtes à partager.", options: ["Voir mon carrousel", "Plus tard"] }),
        ),
      ],
      [9300, set({ tap: `${k}p` })],
      [9650, all(set({ tap: null }), patchMsg(`${k}p`, { picked: true }), add({ id: `${k}z`, kind: "text", me: true, text: "C’est posté", at: "18:09" }))],
      [10200, set({ writing: true, mood: "thinking" })],
      [
        10900,
        all(
          set({ writing: false, mood: "happy", visits: 58 }),
          patchTile(`${k}t`, { state: "live" }),
          add({ id: `${k}o`, kind: "text", text: "Top. Je te dis dimanche ce qu’il a donné.", at: "18:09" }),
        ),
      ],
      [12800, set({ mood: "idle" })],
    ],
  };
}

/** The first story played to its end: what a still page shows. */
function finalScene(): Scene {
  let s = START;
  for (const [, fn] of [...reelStory(0).steps].sort((a, b) => a[0] - b[0])) s = fn(s);
  return { ...s, tap: null, mood: "happy" };
}

export function HeroScene() {
  const [scene, setScene] = useState<Scene>(START);
  const [still, setStill] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: number[] = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timers.push(
        window.setTimeout(() => {
          setStill(true);
          setScene(finalScene());
        }, 0),
      );
      return () => timers.forEach(clearTimeout);
    }
    // A story starts only when the scene is on screen; the one under way finishes.
    let visible = true;
    let waiting: (() => void) | null = null;
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      if (visible && waiting) {
        const go = waiting;
        waiting = null;
        go();
      }
    });
    if (root.current) io.observe(root.current);
    const play = (round: number) => {
      const story = round % 2 === 0 ? reelStory(round / 2) : postStory((round - 1) / 2);
      for (const [ms, fn] of story.steps) timers.push(window.setTimeout(() => setScene(fn), ms));
      timers.push(
        window.setTimeout(() => {
          timers.length = 0;
          const next = () => play(round + 1);
          if (visible) next();
          else waiting = next;
        }, story.length),
      );
    };
    // After the hero's text has come in.
    timers.push(window.setTimeout(() => play(0), 900));
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div ref={root} role="img" aria-label="Exemple : Edith sur WhatsApp, et la grille Instagram dans l’app Edith" className="relative mx-auto h-[566px] w-[300px] sm:h-[600px] sm:w-[500px] lg:[zoom:0.86] xl:[zoom:1]">
      <div aria-hidden="true">
        <AppWindow tiles={scene.tiles} />
        <Phone scene={scene} still={still} />
        <VisitsCard on={scene.card} visits={scene.visits} />
      </div>
    </div>
  );
}

/* ── The phone: WhatsApp ──────────────────────────────────────────────────────────────── */

function Phone({ scene, still }: { scene: Scene; still: boolean }) {
  return (
    <div className="land-float absolute top-0 left-0 z-10 h-[548px] w-[262px] rounded-[46px] bg-[#16131f] p-[8px] shadow-[0_50px_90px_-30px_rgba(28,21,48,.55),0_18px_36px_-18px_rgba(28,21,48,.35),inset_0_0_0_1.5px_rgba(255,255,255,.08)] sm:top-[52px]">
      <div className="land-app-font relative flex h-full flex-col overflow-hidden rounded-[38px] bg-[#f6f6f6] text-[#111b21]">
        <StatusBar />
        {/* Edith's conversation header, as in WhatsApp. */}
        <div className="flex items-center gap-2 border-b border-black/5 bg-[#f6f6f6]/95 px-2.5 pt-0.5 pb-2">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="#1d7aef" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2 2 8l6 6" />
          </svg>
          <span className="flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#efebff]">
            <Mascot size={30} mood={scene.mood} still={still} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[14px] font-semibold">Edith</span>
            <span className="text-[11px] text-[#667781]">{scene.writing ? "écrit…" : "en ligne"}</span>
          </span>
          <svg width="20" height="14" viewBox="0 0 24 16" fill="none" stroke="#1d7aef" strokeWidth="1.8" strokeLinejoin="round" className="mr-1">
            <rect x="1" y="2" width="15" height="12" rx="3" />
            <path d="m16 7 6-3.5v9L16 9" />
          </svg>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d7aef" strokeWidth="1.8" strokeLinejoin="round" className="mr-1">
            <path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.1 3.6 2 2 0 0 1 3.1 1.5h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7 9.4a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
          </svg>
        </div>
        {/* The conversation: the latest at the bottom, older ones leave by the top. */}
        <div className="land-wa-wall land-chat-mask flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-2 pt-6 pb-1.5">
          {scene.msgs.map((m) => (
            <div key={m.id} className={`land-msg ${FIRST.has(m.id) ? "" : "is-new"}`}>
              <div className="pb-[5px]">
                <Message m={m} tapped={scene.tap === m.id} />
              </div>
            </div>
          ))}
        </div>
        <Composer draft={scene.draft} />
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="relative flex h-[34px] shrink-0 items-center justify-between bg-[#f6f6f6] px-6 pt-1 text-[12px] font-semibold">
      <span>9:41</span>
      <span className="absolute top-[7px] left-1/2 h-[21px] w-[72px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1">
        <svg width="15" height="10" viewBox="0 0 15 10" fill="currentColor">
          <rect x="0" y="6.5" width="2.6" height="3.5" rx=".6" />
          <rect x="4" y="4.5" width="2.6" height="5.5" rx=".6" />
          <rect x="8" y="2.5" width="2.6" height="7.5" rx=".6" />
          <rect x="12" y="0" width="2.6" height="10" rx=".6" />
        </svg>
        <svg width="14" height="10" viewBox="0 0 16 11" fill="currentColor">
          <path d="M8 2.6c2.2 0 4.2.8 5.7 2.2l1.2-1.3A10 10 0 0 0 8 .8 10 10 0 0 0 1.1 3.5l1.2 1.3A8.2 8.2 0 0 1 8 2.6zm0 3.6c1.2 0 2.3.4 3.2 1.2l1.2-1.3A6.5 6.5 0 0 0 8 4.4c-1.7 0-3.2.6-4.4 1.7l1.2 1.3c.9-.8 2-1.2 3.2-1.2zm0 3.3c.5 0 1 .2 1.3.5L8 11 6.7 10c.3-.3.8-.5 1.3-.5z" />
        </svg>
        <span className="flex h-[11px] w-[23px] items-center rounded-[3.5px] border border-current/40 p-[1.5px]">
          <span className="h-full w-[78%] rounded-[2px] bg-current" />
        </span>
      </span>
    </div>
  );
}

function Ticks() {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5 inline-block">
      <path d="m1 5.5 2.8 2.8L9.5 2.6M6.8 8.3l5.7-5.7" />
    </svg>
  );
}

function Time({ at, me }: { at: string; me?: boolean }) {
  return (
    <span className="float-right mt-[3px] ml-2 inline-flex translate-y-[3px] items-center text-[9.5px] leading-none text-[#667781]">
      {at}
      {me && <Ticks />}
    </span>
  );
}

function Bubble({ me, children, className = "" }: { me?: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative w-fit max-w-[84%] rounded-[9px] px-2 pt-[5px] pb-[6px] text-[12.5px] leading-[1.32] shadow-[0_1px_.5px_rgba(11,20,26,.13)] ${
        me ? "ml-auto origin-bottom-right rounded-tr-[3px] bg-[#d9fdd3]" : "origin-bottom-left rounded-tl-[3px] bg-white"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Message({ m, tapped }: { m: Msg; tapped: boolean }) {
  if (m.kind === "day") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-[7px] bg-white/95 px-2 py-[3px] text-[10px] font-medium text-[#54656f] shadow-[0_1px_.5px_rgba(11,20,26,.1)]">{m.text}</span>
      </div>
    );
  }
  if (m.kind === "text") {
    return (
      <Bubble me={m.me}>
        {m.text}
        <Time at={m.at} me={m.me} />
      </Bubble>
    );
  }
  if (m.kind === "clips") {
    return (
      <Bubble me className="p-[3px]">
        <span className="grid w-[168px] grid-cols-3 gap-[3px]">
          {CLIPS.map((src) => (
            <span key={src} className="relative aspect-[3/4] overflow-hidden rounded-[6px] bg-[#cfd8d3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[8.5px] font-semibold text-white drop-shadow">
                <svg width="9" height="7" viewBox="0 0 24 16" fill="currentColor">
                  <rect x="1" y="2" width="15" height="12" rx="3" />
                  <path d="m16 7 6-3.5v9L16 9" />
                </svg>
                0:1{CLIPS.indexOf(src) + 2}
              </span>
              <span className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity duration-500 ${m.sent ? "opacity-0" : "opacity-100"}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.2" />
                  <circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" className="land-ring" />
                </svg>
              </span>
            </span>
          ))}
        </span>
        <span className="flex justify-end px-1 pt-0.5">
          <Time at={m.at} me={m.sent} />
        </span>
      </Bubble>
    );
  }
  // A question with its two buttons (and the Reel or the post it is about).
  return (
    <div className="flex w-fit max-w-[84%] flex-col gap-[3px]">
      <Bubble className="!max-w-none">
        {(m.video || m.image) && (
          <span className="relative -mx-[5px] -mt-[2px] mb-1.5 block overflow-hidden rounded-[7px] bg-[#e8e3dc]">
            {m.video ? (
              <video src={m.video} poster={REEL_POSTER} autoPlay muted loop playsInline preload="metadata" className="aspect-[4/5] w-[180px] object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt="" className="aspect-[4/5] w-[180px] object-cover" />
            )}
          </span>
        )}
        <span className="block max-w-[180px]">
          {m.text}
          <Time at={m.at} />
        </span>
      </Bubble>
      {m.options.map((label, i) => (
        <span
          key={label}
          className={`relative flex items-center justify-center gap-1.5 overflow-hidden rounded-[9px] bg-white py-[7px] text-[12px] font-medium shadow-[0_1px_.5px_rgba(11,20,26,.13)] transition-colors duration-300 ${
            m.picked ? (i === 0 ? "text-[#1d7aef]/55" : "text-[#1d7aef]/35") : "text-[#1d7aef]"
          }`}
        >
          <svg width="12" height="10" viewBox="0 0 16 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 1 1 6l5 5M1 6h9a5 5 0 0 1 5 5v1" />
          </svg>
          {label}
          {tapped && i === 0 && <span className="land-tap absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1d7aef]" />}
        </span>
      ))}
    </div>
  );
}

function Composer({ draft }: { draft: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 bg-[#f6f6f6] px-2.5 pt-1.5 pb-5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d7aef" strokeWidth="2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="flex h-[30px] min-w-0 flex-1 items-center overflow-hidden rounded-full border border-black/10 bg-white px-3 text-[12.5px] whitespace-nowrap">
        {draft ? (
          <span className="flex min-w-0 items-center">
            <span className="truncate">{draft}</span>
            <span className="land-caret ml-px h-[15px] w-[1.5px] shrink-0 bg-[#1d7aef]" />
          </span>
        ) : null}
      </span>
      {draft ? (
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </span>
      ) : (
        <>
          <svg width="20" height="18" viewBox="0 0 24 22" fill="none" stroke="#1d7aef" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h2.5l1.6-2.2h5.8L16.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <circle cx="12" cy="12" r="3.6" />
          </svg>
          <svg width="16" height="20" viewBox="0 0 16 22" fill="none" stroke="#1d7aef" strokeWidth="1.8" strokeLinecap="round">
            <rect x="4" y="1" width="8" height="13" rx="4" />
            <path d="M1 10a7 7 0 0 0 14 0M8 17v4" />
          </svg>
        </>
      )}
    </div>
  );
}

/* ── The app beside it: her grid, the new post arriving first ─────────────────────────── */

const STEPS = ["Je monte ton Reel", "Je compose la musique", "Presque prêt"];
const TILE_W = 70;
const TILE_H = 93;
const GAP = 4;

function AppWindow({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="land-float-slow absolute top-0 right-0 hidden h-[330px] w-[344px] flex-col overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_40px_80px_-34px_rgba(28,21,48,.35),0_10px_26px_-14px_rgba(28,21,48,.18)] sm:flex">
      {/* The browser around the app. */}
      <div className="flex h-[30px] shrink-0 items-center gap-1.5 border-b border-line bg-soft px-3">
        {["#ec6a5e", "#f4bf4f", "#61c554"].map((c) => (
          <span key={c} className="size-[9px] rounded-full" style={{ background: c }} />
        ))}
        <span className="mx-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-[3px] text-[10.5px] font-semibold text-muted shadow-[0_0_0_1px_var(--color-line)]">
          <Mascot size={14} still />
          Edith · Grille
        </span>
        <span className="w-[39px]" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[52px] shrink-0 flex-col items-center gap-3 border-r border-line pt-3 text-muted">
          <Mascot size={26} still />
          {[ChatIcon, GridIcon, ChartIcon, PaletteIcon].map((Icon, i) => (
            <span key={i} className={`flex size-8 items-center justify-center rounded-[10px] ${i === 1 ? "bg-violet-soft text-violet" : ""}`}>
              <Icon size={16} />
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col pt-3 pr-3 pl-[58px]">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-extrabold tracking-[-0.02em]">Grille</span>
            <span className="flex items-center gap-1 rounded-full bg-violet px-2.5 py-[5px] text-[10px] font-bold text-white">
              <PlusIcon size={11} />
              Créer
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#f3ece2] font-[family-name:var(--font-serif)] text-[17px] text-[#2f3b2e] italic shadow-[0_0_0_1.5px_#fff,0_0_0_3px_#e2d6c4]">
              L
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[12px] font-bold">studio.lune</span>
              <span className="text-[10px] text-muted">62 publications · 1 284 abonnés</span>
            </span>
          </div>
          {/* The grid: tiles keep their place in it and move when a new one comes first. */}
          <div className="relative mt-3 overflow-hidden" style={{ width: TILE_W * 3 + GAP * 2, height: TILE_H * 2 + GAP }}>
            {tiles.map((t, i) => (
              <span
                key={t.id}
                className={`land-tile absolute top-0 left-0 overflow-hidden rounded-[3px] bg-violet-soft ${t.state ? "land-tile-new" : ""}`}
                style={{ width: TILE_W, height: TILE_H, transform: `translate(${(i % 3) * (TILE_W + GAP)}px, ${Math.floor(i / 3) * (TILE_H + GAP)}px)`, opacity: i < 6 ? 1 : 0 }}
              >
                <TileFace t={t} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TileFace({ t }: { t: Tile }) {
  if (t.state === "making") {
    const step = t.step ?? 0;
    return (
      <span className="flex size-full flex-col items-center justify-center gap-1.5 bg-[linear-gradient(160deg,#f6f2ff,#efebff)] px-1.5 text-center">
        <svg width="30" height="30" viewBox="0 0 36 36" className="-rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#e2dbfb" strokeWidth="3" />
          <circle cx="18" cy="18" r="14" fill="none" stroke="#5b3fd9" strokeWidth="3" strokeLinecap="round" strokeDasharray="88" strokeDashoffset={88 - 88 * ((step + 1) / 4)} className="land-progress" />
        </svg>
        <span key={step} className="land-enter text-[8.5px] leading-tight font-bold text-violet">
          {STEPS[step] ?? STEPS[2]}
        </span>
      </span>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={t.src} alt="" className="size-full object-cover" />
      {t.video && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" className="absolute top-1 right-1 drop-shadow">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="m10 8.5 5 3.5-5 3.5z" fill="#fff" />
        </svg>
      )}
      {(t.state === "ready" || t.state === "live") && (
        <span
          key={t.state}
          className={`land-enter absolute inset-x-1 bottom-1 flex items-center justify-center gap-0.5 rounded-full py-[2px] text-[8.5px] font-bold ${t.state === "live" ? "bg-violet text-white" : "bg-white/95 text-ink"}`}
        >
          {t.state === "live" && <CheckIcon size={9} />}
          {t.state === "live" ? "Publié" : "Prêt"}
        </span>
      )}
    </>
  );
}

/* ── What it brings: her profile visits ───────────────────────────────────────────────── */

function VisitsCard({ on, visits }: { on: boolean; visits: number }) {
  return (
    <div
      className={`land-card-in absolute right-[-6px] bottom-[64px] z-20 w-[176px] rounded-[18px] border border-line bg-white p-3.5 shadow-[0_24px_50px_-20px_rgba(28,21,48,.35)] sm:right-[10px] sm:bottom-[44px] sm:w-[206px] ${
        on ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <span className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted">Visites de ton profil</span>
        <span className="rounded-full bg-success-soft px-1.5 py-px text-[9.5px] font-bold text-success">7 jours</span>
      </span>
      <span className="mt-1 flex items-end gap-2">
        <span className="text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
          +<CountUp value={visits} />
        </span>
        <span className="pb-1 text-[11px] font-semibold text-violet">grâce à tes posts</span>
      </span>
      <svg viewBox="0 0 180 40" className="mt-2 h-[34px] w-full" fill="none">
        <defs>
          <linearGradient id="land-visits" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5b3fd9" stopOpacity=".18" />
            <stop offset="1" stopColor="#5b3fd9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {on && (
          <g key={visits}>
            <path d="M2 34 L30 30 L58 32 L86 24 L114 26 L142 14 L178 6 L178 40 L2 40 Z" fill="url(#land-visits)" className="land-fade" style={{ animationDuration: "1.2s" }} />
            <path d="M2 34 L30 30 L58 32 L86 24 L114 26 L142 14 L178 6" stroke="#5b3fd9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="land-spark-line" />
          </g>
        )}
      </svg>
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1200);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}
