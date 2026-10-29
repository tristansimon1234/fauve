import { Fragment, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, Composition, continueRender, delayRender, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { Mascot, type MascotMood } from "../../web/src/components/mascot";
// The app's own font files (those of its link preview image), not Google's: the render runs offline.
import instrumentItalic from "../../web/src/app/_og/instrument-italic.ttf";
import jakarta600 from "../../web/src/app/_og/jakarta-600.ttf";
import jakarta800 from "../../web/src/app/_og/jakarta-800.ttf";
import take from "./voice.json";

// Edith's introduction (Tristan: « il se connecte, bienvenue, voici tout ce qu'il faut savoir sur
// moi, et là tu balances la vidéo 30 secondes qui explique les capacités, WhatsApp, l'app pour
// ordi », then « il faut un truc plus dynamique », told like a friend: « en gros je t'explique, tu
// me parles sur WhatsApp comme à une vraie personne, tu m'envoies tes photos, tes notes vocales, on
// brainstorme et je m'occupe de tout »): her voice in one take, and everything on screen lands on
// its words (cue). Motion design in the app's colours, her real landing work inside.
//
// Made by hand, once:
//   1. Edith's voice reads the script (its charter's narrator, Lucie): POST /api/admin/voices?say=<voice>&text=<script>
//      (CRON_SECRET, from the database), which answers the voice and the time of each word;
//   2. python3 intro/take.py <the answer.json> <voice.mp3>: ../web/public/landing/intro-voice.mp3 and intro/voice.json
//      (its words, imported here);
//   3. from apps/render: npx remotion render intro/index.ts EdithIntro <out.mp4> --public-dir ../web/public/landing --crf 20
//   4. Edith's music under it, mixed as for any Reel (the voice-over case): the video uploaded to the lab studio of
//      edith-ai.app (/api/admin/lab?site=edith-ai.app&step=upload), set as a played-as-is post (a « baked » plan,
//      its voice flagged), then &step=music; its render is apps/web/public/onboarding/edith-intro.mp4, its poster:
//      ffmpeg -ss 3 -i edith-intro.mp4 -frames:v 1 -vf scale=540:-1 -q:v 4 edith-intro.jpg

const FPS = 30;
const s = (seconds: number) => Math.round(seconds * FPS);
/** The voice starts this long (s) after the first frame. */
const LEAD = 0.25;
/** What stays on screen after its last word (s): « On commence ? » and how to start, to read. */
const TAIL = 2.7;

type Word = { w: string; start: number; end: number };
const WORDS: Word[] = take.words;
const plain = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z']/g, "");
/** When the voice says a word (its time in the voice, s): the first one from `after` on. */
function cue(word: string, after = 0): number {
  const hit = WORDS.find((x) => x.start >= after && plain(x.w).startsWith(plain(word)));
  if (!hit) throw new Error(`« ${word} » is not in the voice`);
  return hit.start;
}
/** The frame of a moment of the voice. */
const F = (v: number) => Math.round((v + LEAD) * FPS);
const VOICE_END = WORDS[WORDS.length - 1]!.end;
const ENDS = VOICE_END + TAIL;
export const INTRO_SECONDS = LEAD + ENDS;

/** The words everything lands on. */
const T = {
  moi: cue("moi"),
  edith: cue("edith"),
  ton: cue("ton"),
  community: cue("community"),
  enGros: cue("en", 3),
  explique: cue("t'explique"),
  parles: cue("tu", 5),
  whatsapp: cue("whatsapp"),
  comme: cue("comme"),
  vraie: cue("vraie"),
  envoies: cue("tu", 7),
  photos: cue("photos"),
  videos: cue("videos"),
  notes: cue("notes"),
  on: cue("on", 10),
  brainstorme: cue("brainstorme"),
  ensemble: cue("ensemble"),
  occupe: cue("m'occupe"),
  tout: cue("tout", 12.5),
  tesReels: cue("tes", 13),
  reels: cue("reels"),
  carrousels: cue("carrousels"),
  legendes: cue("legendes"),
  dis: cue("tu", 15),
  oui: cue("oui"),
  publie: cue("publie"),
  instagram: cue("instagram"),
  tiktok: cue("tiktok"),
  etOrdi: cue("et", 18),
  ordi: cue("ordi"),
  toutApp: cue("tout", 19),
  app: cue("l'app"),
  allez: cue("allez"),
  commence: cue("on", 20.5),
};

const C = {
  bg: "#FBF7F4",
  ink: "#1C1530",
  muted: "#5E5670",
  violet: "#5B3FD9",
  lilac: "#EFEBFF",
  coral: "#F2694E",
  peach: "#FFE9E1",
  line: "#ECE6EF",
  chat: "#EFEAE2",
  mine: "#D9FDD3",
  green: "#25D366",
};
const SANS = "'Plus Jakarta Sans', sans-serif";
const SERIF = "'Instrument Serif', serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

let fontsAsked = false;
/** Plus Jakarta Sans (600, 800) and Instrument Serif italic, before the first frame. */
function loadBrandFonts() {
  if (fontsAsked || typeof document === "undefined") return;
  fontsAsked = true;
  const handle = delayRender("brand fonts");
  const faces = [
    new FontFace("Plus Jakarta Sans", `url(${jakarta600})`, { weight: "600" }),
    new FontFace("Plus Jakarta Sans", `url(${jakarta800})`, { weight: "800" }),
    new FontFace("Instrument Serif", `url(${instrumentItalic})`, { style: "italic" }),
  ];
  Promise.all(faces.map((f) => f.load().then((face) => (document.fonts as unknown as { add(face: FontFace): void }).add(face))))
    .catch(() => undefined)
    .finally(() => continueRender(handle));
}

/** A soft entrance starting at a frame (no bounce). */
const enter = (frame: number, at: number, duration = 9) => spring({ frame: frame - at, fps: FPS, durationInFrames: duration, config: { damping: 200 } });
/** The same, from a moment of the voice. */
const enterAt = (frame: number, v: number, duration = 9) => enter(frame, F(v), duration);
/** Whole pixels: text moved by fractions of a pixel shimmers. */
const px = (n: number) => Math.round(n);

/** Words that land on the voice's words, an accent in Instrument Serif italic. */
type Bit = { text: string; at: number; accent?: boolean; br?: boolean };

function Say({ bits, top, size = 80, color = C.ink, accent = C.violet, style }: { bits: Bit[]; top: number; size?: number; color?: string; accent?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{ position: "absolute", top, left: 60, right: 60, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.1, letterSpacing: "-0.03em", wordSpacing: "0.12em", color, textWrap: "balance", ...style }}
    >
      {bits.map((b, i) => {
        const p = enterAt(frame, b.at, 8);
        // A key word pops in, then stays still.
        const pop = b.accent ? 1 + 0.22 * (1 - p) : 1;
        return (
          <Fragment key={i}>
            {b.br ? <br /> : i ? " " : ""}
            <span
              style={{
                display: "inline-block",
                opacity: p,
                transform: `translateY(${px((1 - p) * 40)}px) scale(${pop})`,
                ...(b.accent ? { fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: size * 1.22, letterSpacing: "-0.01em", color: accent } : null),
              }}
            >
              {b.text}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

/** A title on screen from its first word to `until` (a moment of the voice), then off upwards. */
function Until({ until, children }: { until: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [F(until), F(until) + 6], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (out >= 1) return null;
  return <AbsoluteFill style={{ opacity: 1 - out, transform: `translateY(${px(-60 * out)}px)` }}>{children}</AbsoluteFill>;
}

/** The brand's orb, drifting slowly behind everything. */
function Orb({ tint = 0.16 }: { tint?: number }) {
  const frame = useCurrentFrame();
  const x = Math.sin(frame / 70) * 60;
  const y = Math.cos(frame / 90) * 50;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1100, height: 1100, left: 260 + x, top: 900 + y, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${C.violet}, ${C.coral} 70%)`, opacity: tint, filter: "blur(120px)" }} />
      <div style={{ position: "absolute", width: 700, height: 700, left: -260 - x, top: 120 - y, borderRadius: "50%", background: C.coral, opacity: tint * 0.6, filter: "blur(110px)" }} />
    </AbsoluteFill>
  );
}

/** A phone, its screen given as children; it comes up from below with its scene. */
function Phone({ children, top, height, width = 620, at, screen = C.chat }: { children: ReactNode; top: number; height: number; width?: number; at: number; screen?: string }) {
  const frame = useCurrentFrame();
  const p = enter(frame, at, 14);
  return (
    <div style={{ position: "absolute", left: (1080 - width) / 2, top: px(top + (1 - p) * 260), width, height, borderRadius: 82, background: C.ink, padding: 16, boxShadow: "0 50px 90px rgba(28,21,48,.22)" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 66, overflow: "hidden", background: screen }}>{children}</div>
    </div>
  );
}

const HEADER = 150;

/** WhatsApp's header in the phone: Edith, on line. */
function ChatHeader() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: HEADER, zIndex: 2, display: "flex", alignItems: "center", gap: 18, padding: "54px 28px 0", background: "#F7F5F3", borderBottom: `2px solid ${C.line}` }}>
      <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <Mascot size={62} still />
      </div>
      <div style={{ fontFamily: SANS }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: C.ink }}>Edith</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: C.muted }}>en ligne</div>
      </div>
    </div>
  );
}

/** WhatsApp's message bar at the bottom of the phone. */
function InputBar({ height }: { height: number }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height, zIndex: 2, display: "flex", alignItems: "center", gap: 14, padding: "0 20px 14px", background: "#F7F5F3" }}>
      <div style={{ flex: 1, height: 64, borderRadius: 32, background: "#fff", display: "flex", alignItems: "center", padding: "0 26px", fontFamily: SANS, fontSize: 26, fontWeight: 600, color: "#A39DAD" }}>Message</div>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0A7C5A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden>
          <rect x="7" y="1" width="12" height="18" rx="6" fill="#fff" />
          <path d="M3 14a10 10 0 0 0 20 0M13 24v5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

const LINE = 40;
const PAD = 16;
const bubbleText: CSSProperties = { fontFamily: SANS, fontSize: 30, lineHeight: `${LINE}px`, fontWeight: 600, color: C.ink, whiteSpace: "pre" };

/** A WhatsApp bubble of a known height: the chat never measures, so nothing ever moves but what is animated. */
function BubbleBox({ mine, height, padding = `${PAD}px 22px`, children }: { mine?: boolean; height: number; padding?: string; children: ReactNode }) {
  return (
    <div
      style={{
        height,
        boxSizing: "border-box",
        borderRadius: 26,
        borderBottomRightRadius: mine ? 8 : 26,
        borderBottomLeftRadius: mine ? 26 : 8,
        background: mine ? C.mine : "#fff",
        padding,
        boxShadow: "0 2px 4px rgba(0,0,0,.06)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/** Edith writing: three dots that hop (moved, never resized). */
function Typing() {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 9, height: LINE, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: "#9A93A6", transform: `translateY(${px(-7 * Math.max(0, Math.sin((frame - i * 4) / 3.2)))}px)` }} />
      ))}
    </div>
  );
}

/** Her voice note: a play sign, a waveform of fixed bars, the part already heard in green. */
function VoiceNote({ at }: { at: number }) {
  const frame = useCurrentFrame();
  const bars = [10, 20, 30, 16, 36, 24, 12, 28, 40, 18, 10, 26, 34, 14, 22, 30, 12, 20, 32, 16, 24, 12];
  const played = interpolate(frame, [F(at) + 4, F(at) + s(1.6)], [0, 1], clamp);
  const width = bars.length * 10 - 4;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, height: 56 }}>
      <div style={{ width: 0, height: 0, borderTop: "15px solid transparent", borderBottom: "15px solid transparent", borderLeft: `24px solid ${C.muted}` }} />
      <div style={{ position: "relative", width, height: 44, display: "flex", alignItems: "center", gap: 4 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 6, height: h, borderRadius: 3, background: (i + 0.5) / bars.length <= played ? C.green : "#A8B0AC" }} />
        ))}
        <div style={{ position: "absolute", top: 12, left: px(played * width) - 10, width: 20, height: 20, borderRadius: "50%", background: C.green }} />
      </div>
      <div style={{ fontFamily: SANS, fontSize: 24, color: C.muted, fontWeight: 600 }}>0:12</div>
    </div>
  );
}

type Message = {
  mine?: boolean;
  /** When it arrives (a moment of the voice). */
  at: number;
  /** Edith writes from then (dots) until `at`. */
  typing?: number;
  lines?: string[];
  /** A bubble that is not text: its height and what it shows. */
  height?: number;
  body?: ReactNode;
  padding?: string;
};

const textHeight = (lines: string[]) => lines.length * LINE + PAD * 2;
const TYPING_HEIGHT = textHeight([""]);

/**
 * A chat that scrolls up as messages arrive, as on WhatsApp: each message's place is computed from
 * the known heights of the ones after it (never measured), so a message coming in pushes the others
 * up smoothly and nothing else moves.
 */
function Chat({ messages, bottom, gap = 14 }: { messages: Message[]; bottom: number; gap?: number }) {
  const frame = useCurrentFrame();
  const shown = messages.map((m) => {
    const full = m.height ?? textHeight(m.lines ?? [""]);
    const appear = enter(frame, F(m.typing ?? m.at), 9);
    // From the dots to the message: its height grows to its own.
    const written = m.typing === undefined ? 1 : enter(frame, F(m.at), 7);
    const height = m.typing === undefined ? full : TYPING_HEIGHT + (full - TYPING_HEIGHT) * written;
    return { m, appear, written, height };
  });
  let y = bottom;
  const placed = shown
    .slice()
    .reverse()
    .map((item) => {
      const space = item.appear * (item.height + gap);
      const top = y - item.height;
      y -= space;
      return { ...item, top };
    })
    .reverse();
  return (
    <>
      {placed.map(({ m, appear, written, height, top }, i) =>
        appear <= 0 || top + height < HEADER ? null : (
          <div key={i} style={{ position: "absolute", top: px(top + (1 - appear) * 22), [m.mine ? "right" : "left"]: 20, opacity: appear }}>
            <BubbleBox mine={m.mine} height={px(height)} padding={m.lines || written < 1 ? undefined : m.padding}>
              {written < 1 ? (
                <div style={{ opacity: 1 - written }}>
                  <Typing />
                </div>
              ) : null}
              {written > 0 && <div style={{ opacity: written }}>{m.lines ? <div style={bubbleText}>{m.lines.join("\n")}</div> : m.body}</div>}
            </BubbleBox>
          </div>
        ),
      )}
    </>
  );
}

/** Her photos, as a WhatsApp album. */
function Album() {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[2, 3, 4].map((n) => (
        <div key={n} style={{ width: 146, height: 196, borderRadius: 16, overflow: "hidden" }}>
          <Img src={staticFile(`tile-${n}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
    </div>
  );
}

/** Her video, with its play sign and length. */
function Clip() {
  return (
    <div style={{ position: "relative", width: 330, height: 204, borderRadius: 16, overflow: "hidden" }}>
      <Img src={staticFile("work-cave.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 78, height: 78, margin: "-39px 0 0 -39px", borderRadius: "50%", background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 0, height: 0, marginLeft: 6, borderTop: "15px solid transparent", borderBottom: "15px solid transparent", borderLeft: "24px solid #fff" }} />
      </div>
      <div style={{ position: "absolute", left: 12, bottom: 8, fontFamily: SANS, fontSize: 22, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>0:14</div>
    </div>
  );
}

// ——— The scenes ———

function HelloScene() {
  const frame = useCurrentFrame();
  // The one bounce of the video: Edith popping up to say hello.
  const pop = spring({ frame: frame - 1, fps: FPS, durationInFrames: 22, config: { damping: 11, mass: 0.8 } });
  const float = Math.sin(frame / 14) * 10;
  const aside = enterAt(frame, T.enGros - 0.05, 10);
  const mood: MascotMood = frame >= F(T.enGros) ? "thinking" : frame >= F(T.edith) ? "happy" : "laugh";
  const bubble = enterAt(frame, T.enGros, 9);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center", transform: `translate(${px(-170 * aside)}px, ${px(float)}px) scale(${0.35 + 0.65 * pop})`, opacity: Math.min(1, pop * 2) }}>
        <Mascot size={480} mood={mood} still />
      </div>
      {/* « En gros, je t'explique : » said by her, in a bubble. */}
      <div style={{ position: "absolute", left: 560, top: 250, opacity: bubble, transform: `translateY(${px((1 - bubble) * 30)}px)` }}>
        <div style={{ borderRadius: 40, borderBottomLeftRadius: 10, background: "#fff", padding: "26px 34px", boxShadow: "0 24px 50px rgba(28,21,48,.14)", fontFamily: SANS, fontWeight: 800, fontSize: 52, lineHeight: 1.1, letterSpacing: "-0.02em", color: C.ink, whiteSpace: "pre" }}>
          {"En gros,\nje "}
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 64, color: C.violet }}>t’explique</span>
        </div>
      </div>
      <Say top={850} size={96} bits={[{ text: "Salut !", at: 0 }, { text: "Moi c’est", at: T.moi }]} />
      <Say top={950} size={210} bits={[{ text: "Edith", at: T.edith, accent: true }]} style={{ lineHeight: 1 }} />
      <Say top={1250} size={54} color={C.muted} bits={[{ text: "ton", at: T.ton }, { text: "community manager", at: T.community }, { text: "IA", at: T.community + 0.5 }]} />
    </>
  );
}

const CHAT: Message[] = [
  { mine: true, at: T.parles + 0.05, lines: ["Coucou Edith ! 👋"] },
  { at: T.vraie, typing: T.whatsapp, lines: ["Coucou ! Raconte-moi,", "je t’écoute 😊"] },
  { mine: true, at: T.photos, height: 196 + 16, padding: "8px", body: <Album /> },
  { mine: true, at: T.videos, height: 204 + 16, padding: "8px", body: <Clip /> },
  { mine: true, at: T.notes, height: 56 + 2 * PAD, padding: `${PAD}px 22px`, body: <VoiceNote at={T.notes} /> },
  { at: T.brainstorme - 0.1, typing: T.on - 0.3, lines: ["Idée : « pov : ton premier", "café du matin » ☕", "On le tourne demain ?"] },
  { mine: true, at: T.brainstorme + 0.4, lines: ["Trop bien, go ! 🔥"] },
];

function ChatScene({ from }: { from: number }) {
  const phoneTop = 520;
  const phoneHeight = 1420;
  const inner = phoneHeight - 32;
  const bar = 104;
  return (
    <>
      <Until until={T.envoies - 0.12}>
        <Say
          top={110}
          size={74}
          bits={[
            { text: "Tu me parles sur", at: T.parles },
            { text: "WhatsApp,", at: T.whatsapp, accent: true },
            { text: "comme à une", at: T.comme, br: true },
            { text: "vraie personne", at: T.vraie, accent: true },
          ]}
        />
      </Until>
      <Until until={T.on - 0.12}>
        <Say
          top={110}
          size={74}
          bits={[
            { text: "Tu m’envoies tes", at: T.envoies },
            { text: "photos,", at: T.photos, accent: true },
            { text: "tes", at: T.videos, br: true },
            { text: "vidéos,", at: T.videos, accent: true },
            { text: "tes", at: T.notes },
            { text: "vocaux", at: T.notes, accent: true },
          ]}
        />
      </Until>
      <Say
        top={110}
        size={74}
        bits={[
          { text: "On", at: T.on },
          { text: "brainstorme", at: T.brainstorme, accent: true },
          { text: "ensemble", at: T.ensemble, br: true },
        ]}
      />
      <Phone top={phoneTop} height={phoneHeight} at={F(from)}>
        <ChatHeader />
        <Chat messages={CHAT} bottom={inner - bar - 18} />
        <InputBar height={bar} />
      </Phone>
    </>
  );
}

/** « je m'occupe de tout »: the screen goes violet. */
function FlashScene() {
  const frame = useCurrentFrame();
  const pop = enterAt(frame, T.occupe - 0.1, 12);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center", opacity: pop, transform: `translateY(${px((1 - pop) * 80)}px)` }}>
        <Mascot size={380} mood="laugh" still />
      </div>
      <Say top={880} size={100} color="#fff" bits={[{ text: "je m’occupe", at: T.occupe }]} />
      <Say top={990} size={210} accent={C.peach} bits={[{ text: "de tout", at: T.tout, accent: true }]} style={{ lineHeight: 1 }} />
    </>
  );
}

function WorkScene({ from }: { from: number }) {
  const frame = useCurrentFrame();
  const reel = enterAt(frame, T.reels - 0.12, 11);
  const card = enterAt(frame, T.legendes - 0.12, 10);
  const caption = "Le premier café, celui qui compte ☕ Toi, plutôt espresso ou flat white ?";
  const typed = Math.floor(interpolate(frame, [F(T.legendes), F(T.legendes + 0.75)], [0, caption.length], clamp));
  return (
    <>
      <Say
        top={110}
        size={74}
        bits={[
          { text: "tes", at: T.tesReels },
          { text: "Reels,", at: T.reels, accent: true },
          { text: "tes", at: T.carrousels - 0.1 },
          { text: "carrousels,", at: T.carrousels, accent: true },
          { text: "tes", at: T.legendes - 0.08, br: true },
          { text: "légendes", at: T.legendes, accent: true },
        ]}
      />
      {/* The Reel, from the left. */}
      <div style={{ position: "absolute", left: 70, top: 420, width: 430, height: 764, transform: `translateX(${px((1 - reel) * -620)}px) rotate(-4deg)`, borderRadius: 40, overflow: "hidden", border: "10px solid #fff", boxShadow: "0 40px 80px rgba(28,21,48,.24)", background: C.ink }}>
        <Sequence from={F(from)} layout="none">
          <OffthreadVideo src={staticFile("work-cafe.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Sequence>
      </div>
      {/* The carousel, its slides dealt from the right. */}
      {[3, 2, 1].map((n, i) => {
        const p = enterAt(frame, T.carrousels - 0.1 + i * 0.07, 10);
        const k = 2 - i;
        return (
          <div
            key={n}
            style={{
              position: "absolute",
              left: 600 + k * 34,
              top: 470 + k * 40,
              width: 340,
              height: 425,
              borderRadius: 22,
              overflow: "hidden",
              border: "8px solid #fff",
              boxShadow: "0 30px 60px rgba(28,21,48,.22)",
              opacity: p,
              transform: `translateX(${px((1 - p) * 520)}px) rotate(${3 + k * 4}deg)`,
            }}
          >
            <Img src={staticFile(`intro-slide-${n}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
      {/* The caption, written as she listens. */}
      <div style={{ position: "absolute", left: 90, right: 90, top: 1300, height: 300, boxSizing: "border-box", opacity: card, transform: `translateY(${px((1 - card) * 120)}px)`, borderRadius: 32, background: "#fff", padding: "32px 38px", boxShadow: "0 24px 50px rgba(28,21,48,.14)", fontFamily: SANS }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.violet, marginBottom: 12 }}>Ta légende</div>
        <div style={{ fontSize: 38, lineHeight: 1.35, fontWeight: 600, color: C.ink }}>
          {caption.slice(0, typed)}
          <span style={{ opacity: Math.floor(frame / 6) % 2 ? 0 : 1, color: C.violet }}>|</span>
        </div>
      </div>
    </>
  );
}

/** Instagram's and TikTok's own marks, simplified. */
function PlatformMark({ name }: { name: "Instagram" | "TikTok" }) {
  return name === "Instagram" ? (
    <div style={{ width: 52, height: 52, borderRadius: 15, background: "linear-gradient(45deg, #FEDA75, #FA7E1E 30%, #D62976 60%, #962FBF 85%, #4F5BD5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", border: "4px solid #fff", boxSizing: "border-box" }} />
    </div>
  ) : (
    <div style={{ width: 52, height: 52, borderRadius: 15, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="30" height="32" viewBox="0 0 30 32" aria-hidden>
        <path d="M17 2v19a5.5 5.5 0 1 1-5.5-5.5" stroke="#25F4EE" strokeWidth="4.5" fill="none" transform="translate(-1.5,-1)" />
        <path d="M17 2v19a5.5 5.5 0 1 1-5.5-5.5M17 2c1 4.5 4 7 8.5 7.5" stroke="#FE2C55" strokeWidth="4.5" fill="none" transform="translate(1.5,1)" />
        <path d="M17 2v19a5.5 5.5 0 1 1-5.5-5.5M17 2c1 4.5 4 7 8.5 7.5" stroke="#fff" strokeWidth="4.5" fill="none" />
      </svg>
    </div>
  );
}

function PublishScene({ from }: { from: number }) {
  const frame = useCurrentFrame();
  const tap = F(T.oui);
  const pressed = frame >= tap && frame < tap + 7;
  const ring = interpolate(frame, [tap, tap + 14], [0, 1], clamp);
  const live = enterAt(frame, T.publie, 9);
  return (
    <>
      <Say
        top={110}
        size={80}
        bits={[
          { text: "Tu dis", at: T.dis },
          { text: "oui,", at: T.oui, accent: true },
          { text: "je publie", at: T.publie, br: true },
        ]}
      />
      <Phone top={430} height={1150} at={F(from)}>
        <ChatHeader />
        <div style={{ position: "absolute", left: 20, top: HEADER + 30 }}>
          <BubbleBox height={400 + 12 + 2 * LINE + PAD + 10} padding="10px">
            <div style={{ position: "relative", width: 300, height: 400, borderRadius: 18, overflow: "hidden" }}>
              <Img src={staticFile("work-pilates.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {/* Out: a tick on it when she says « je publie ». */}
              <div style={{ position: "absolute", right: 14, top: 14, display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 8px 10px", borderRadius: 999, background: "#fff", opacity: live, transform: `translateY(${px((1 - live) * -16)}px)`, fontFamily: SANS, fontSize: 22, fontWeight: 800, color: C.ink }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: C.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✓</span>
                En ligne
              </div>
            </div>
            <div style={{ ...bubbleText, padding: "12px 10px 0" }}>{"Ton Reel est prêt !\nJe le publie vendredi à 18 h ?"}</div>
          </BubbleBox>
        </div>
        {["Oui, publie-le", "Je regarde d’abord"].map((label, i) => {
          const hit = i === 0;
          return (
            <div
              key={label}
              style={{ position: "absolute", left: 20, top: HEADER + 30 + 518 + 14 + i * 84, width: 440, height: 70, borderRadius: 22, background: hit && pressed ? "#DCEBE3" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontSize: 30, fontWeight: 800, color: "#0A7C5A", boxShadow: "0 2px 4px rgba(0,0,0,.06)" }}
            >
              {label}
              {hit && ring > 0 && ring < 1 && (
                <div style={{ position: "absolute", left: "50%", top: "50%", width: 90 + ring * 140, height: 90 + ring * 140, marginLeft: -(45 + ring * 70), marginTop: -(45 + ring * 70), borderRadius: "50%", border: `5px solid ${C.violet}`, opacity: 1 - ring }} />
              )}
            </div>
          );
        })}
        <Chat bottom={HEADER + 30 + 518 + 14 + 168 + 14 + 72 + 4} messages={[{ mine: true, at: T.oui + 0.2, lines: ["Oui, publie-le"] }]} />
      </Phone>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1650, display: "flex", justifyContent: "center", gap: 26 }}>
        {(["Instagram", "TikTok"] as const).map((name) => {
          const p = enterAt(frame, name === "Instagram" ? T.instagram : T.tiktok, 9);
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 30px 16px 16px", borderRadius: 999, background: "#fff", boxShadow: "0 18px 40px rgba(28,21,48,.14)", opacity: p, transform: `translateY(${px((1 - p) * 60)}px)`, fontFamily: SANS, fontSize: 38, fontWeight: 800, color: C.ink }}>
              <PlatformMark name={name} />
              {name}
            </div>
          );
        })}
      </div>
    </>
  );
}

function AppScene({ from }: { from: number }) {
  const frame = useCurrentFrame();
  const p = enter(frame, F(from), 14);
  const site = enterAt(frame, T.app, 9);
  const tiles = [1, 2, 3, 4, 5, 6];
  return (
    <>
      <Say
        top={110}
        size={80}
        bits={[
          { text: "Et sur", at: T.etOrdi },
          { text: "ordi,", at: T.ordi, accent: true },
          { text: "tout est dans", at: T.toutApp, br: true },
          { text: "l’app", at: T.app, accent: true },
        ]}
      />
      <div style={{ position: "absolute", left: 60, right: 60, top: px(560 + (1 - p) * 300) }}>
        {/* The screen */}
        <div style={{ borderRadius: "34px 34px 10px 10px", background: C.ink, padding: 16, boxShadow: "0 40px 80px rgba(28,21,48,.24)" }}>
          <div style={{ height: 640, borderRadius: 22, overflow: "hidden", background: "#fff", display: "flex" }}>
            <div style={{ width: 210, background: C.bg, borderRight: `2px solid ${C.line}`, padding: "26px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: C.ink }}>
                <Mascot size={44} still />
                Edith
              </div>
              {["Edith", "Grille", "Tendances", "Résultats", "Ton style", "Réglages"].map((item, i) => (
                <div key={item} style={{ fontFamily: SANS, fontSize: 21, fontWeight: 700, color: i === 1 ? C.violet : C.muted, background: i === 1 ? C.lilac : "transparent", borderRadius: 999, padding: "8px 14px" }}>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ flex: 1, padding: "26px 30px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
                <div style={{ width: 84, height: 84, borderRadius: "50%", background: `linear-gradient(135deg, ${C.violet}, ${C.coral})` }} />
                <div style={{ fontFamily: SANS }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>maisonmaya.paris</div>
                  <div style={{ fontSize: 19, color: C.muted, fontWeight: 600 }}>84 publications · 1 240 abonnés</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {tiles.map((n, i) => {
                  const t = enter(frame, F(from) + 6 + i * 2, 9);
                  return (
                    <div key={n} style={{ position: "relative", aspectRatio: "3 / 4", overflow: "hidden", opacity: t }}>
                      <Img src={staticFile(`tile-${n}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {i === 0 && <div style={{ position: "absolute", left: 6, bottom: 6, borderRadius: 999, background: C.violet, color: "#fff", fontFamily: SANS, fontSize: 15, fontWeight: 800, padding: "4px 10px" }}>Vendredi</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {/* The base */}
        <div style={{ margin: "0 -40px", height: 34, borderRadius: "0 0 30px 30px", background: "#D9D3DE" }} />
        <div style={{ marginTop: 50, display: "flex", justifyContent: "center", opacity: site, transform: `translateY(${px((1 - site) * 40)}px)` }}>
          <div style={{ padding: "18px 38px", borderRadius: 999, background: C.ink, fontFamily: SANS, fontSize: 40, fontWeight: 800, color: "#fff", boxShadow: "0 14px 30px rgba(28,21,48,.2)" }}>edith-ai.app</div>
        </div>
      </div>
    </>
  );
}

function StartScene({ from }: { from: number }) {
  const frame = useCurrentFrame();
  const pop = spring({ frame: frame - F(from), fps: FPS, durationInFrames: 20, config: { damping: 11, mass: 0.8 } });
  const lines = enterAt(frame, T.commence + 0.6, 10);
  const where = enterAt(frame, T.commence + 0.95, 10);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center", transform: `translateY(${px(Math.sin(frame / 12) * 10)}px) scale(${0.4 + 0.6 * pop})`, opacity: Math.min(1, pop * 2) }}>
        <Mascot size={420} mood="happy" still />
      </div>
      <Say top={840} size={92} bits={[{ text: "Allez,", at: T.allez }]} />
      <Say top={940} size={130} bits={[{ text: "on commence ?", at: T.commence, accent: true }]} style={{ lineHeight: 1 }} />
      <div style={{ position: "absolute", top: 1220, left: 80, right: 80, textAlign: "center", opacity: lines, transform: `translateY(${px((1 - lines) * 40)}px)`, fontFamily: SANS, fontWeight: 800, fontSize: 60, lineHeight: 1.15, letterSpacing: "-0.02em", color: C.ink, textWrap: "balance" }}>
        Envoie-moi ton site ou ton Instagram
      </div>
      <div style={{ position: "absolute", top: 1400, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: where, transform: `translateY(${px((1 - where) * 40)}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 32px", borderRadius: 999, background: "#0A7C5A", color: "#fff", fontFamily: SANS, fontSize: 40, fontWeight: 800 }}>ici, sur WhatsApp</div>
      </div>
    </>
  );
}

type SceneProps = { from: number };
type SceneDef = { id: string; from: number; background: string; orb?: number; View: (props: SceneProps) => ReactNode; wipe?: boolean };

/** The scenes in order, each from a little before its first word: its entrance ends as the word is said. */
const SCENES: SceneDef[] = [
  { id: "hello", from: -LEAD, background: C.bg, View: HelloScene },
  { id: "chat", from: T.parles - 0.3, background: C.bg, View: ChatScene },
  { id: "flash", from: T.occupe - 0.3, background: C.violet, orb: 0, View: FlashScene, wipe: true },
  { id: "work", from: T.tesReels - 0.25, background: C.lilac, orb: 0.12, View: WorkScene },
  { id: "publish", from: T.dis - 0.3, background: C.bg, View: PublishScene },
  { id: "app", from: T.etOrdi - 0.2, background: C.peach, orb: 0.12, View: AppScene },
  { id: "start", from: T.allez - 0.2, background: C.bg, View: StartScene },
];

/** How long (frames) a scene takes to come in: it pushes the one before up, like a swipe. */
const PUSH = 9;

export function Intro() {
  loadBrandFonts();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* The mascot's sizing, from the app's stylesheet (its motion is drawn here, frame by frame). */}
      <style>{".fauve-cat{display:inline-block;flex-shrink:0;width:var(--cat);height:var(--cat)}.fauve-cat svg{display:block;width:100%;height:100%}"}</style>
      {SCENES.map((scene, i) => {
        const start = Math.max(0, F(scene.from));
        const next = SCENES[i + 1];
        const end = next ? Math.max(0, F(next.from)) + PUSH : s(INTRO_SECONDS);
        if (frame < start || frame >= end) return null;
        const come = i ? interpolate(frame, [start, start + PUSH], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
        // Pushed up by the next one.
        const go = next ? interpolate(frame, [end - PUSH, end], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
        const style: CSSProperties = scene.wipe
          ? { clipPath: `circle(${px(come * 2300)}px at 540px 1100px)`, transform: `translateY(${px(-500 * go)}px)` }
          : { transform: `translateY(${px((1 - come) * 1920 - 500 * go)}px)` };
        const { View } = scene;
        return (
          <AbsoluteFill key={scene.id} style={{ background: scene.background, ...style }}>
            <Orb tint={scene.orb ?? 0.16} />
            <View from={scene.from} />
          </AbsoluteFill>
        );
      })}
      <Sequence from={s(LEAD)} layout="none">
        <Audio src={staticFile(take.voice)} />
      </Sequence>
    </AbsoluteFill>
  );
}

export function IntroRoot() {
  return <Composition id="EdithIntro" component={Intro} durationInFrames={s(INTRO_SECONDS)} fps={FPS} width={1080} height={1920} />;
}
