import { Fragment, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, Composition, continueRender, delayRender, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { Mascot, type MascotMood } from "../../web/src/components/mascot";
// The app's own font files (those of its link preview image), not Google's: the render runs offline.
import instrumentItalic from "../../web/src/app/_og/instrument-italic.ttf";
import interTight500 from "../../web/src/app/_og/intertight-500.ttf";
import interTight600 from "../../web/src/app/_og/intertight-600.ttf";
import take from "./voice.json";

// Edith's introduction (Tristan: « il se connecte, bienvenue, voici tout ce qu'il faut savoir sur
// moi, et là tu balances la vidéo 30 secondes qui explique les capacités, WhatsApp, l'app pour
// ordi », then « il faut un truc plus dynamique », told like a friend: « en gros je t'explique, tu
// me parles sur WhatsApp comme à une vraie personne, tu m'envoies tes photos, tes notes vocales, on
// brainstorme et je m'occupe de tout »): her voice in one take, and everything on screen lands on
// its words (cue). Motion design in the app's colours, her real landing work inside. Redone in the paper and ink
// art direction (lot 6, Tristan: « il faudra refaire le reel de l'onboarding aussi pour correspondre à la DA »): black
// and white, square corners, thin lines, big tight Inter Tight with one word in Instrument Serif italic, the pictures
// bringing the colour; without « Tu dis oui, je publie… » nor « sur ordi, tout est dans l'app » (cut out of the same
// take: Tristan, « c'est faux », « en 5 minutes SANS APP, directement sur WhatsApp »).
//
// Made by hand, once:
//   1. Edith's voice reads the script (its charter's narrator, Lucie): POST /api/admin/voices?say=<voice>&text=<script>
//      (CRON_SECRET, from the database), which answers the voice and the time of each word;
//   2. python3 intro/take.py <the answer.json> <voice.mp3>: ../web/public/landing/intro-voice.mp3 and intro/voice.json
//      (its words, imported here);
//   3. from apps/render: npx remotion render intro/index.ts EdithIntro <out.mp4> --public-dir ../web/public/landing --crf 20
//   4. music under it: one of Edith's compositions mixed under the voice as for a voice-over Reel (MIX_CASES.voice_over:
//      the voice at -14 LUFS, the music at -20 ducking under it, its last 0.8 s faded); the render is
//      apps/web/public/onboarding/edith-intro.mp4, its poster:
//      ffmpeg -ss 3 -i edith-intro.mp4 -frames:v 1 -vf scale=540:-1 -q:v 4 edith-intro.jpg

const FPS = 30;
const s = (seconds: number) => Math.round(seconds * FPS);
/** The voice starts this long (s) after the first frame. */
const LEAD = 0.25;
/** What stays on screen after its last word (s): « On commence ? », five minutes without an app, and how to start, to read. */
const TAIL = 3.6;

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
  allez: cue("allez"),
  commence: cue("on", 15.9),
};

/** The app's paper and ink (globals.css); WhatsApp's own colours inside its screens. */
const C = {
  bg: "#F5F2EC",
  soft: "#ECE8E0",
  ink: "#121110",
  muted: "#6B675F",
  line: "#D4CEC3",
  chat: "#EFEAE2",
  mine: "#D9FDD3",
  green: "#25D366",
};
const SANS = "'Inter Tight', sans-serif";
const SERIF = "'Instrument Serif', serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

let fontsAsked = false;
/** Inter Tight (500, 600) and Instrument Serif italic, before the first frame. */
function loadBrandFonts() {
  if (fontsAsked || typeof document === "undefined") return;
  fontsAsked = true;
  const handle = delayRender("brand fonts");
  const faces = [
    new FontFace("Inter Tight", `url(${interTight500})`, { weight: "500" }),
    new FontFace("Inter Tight", `url(${interTight600})`, { weight: "600" }),
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

function Say({ bits, top, size = 80, color = C.ink, accent = color, style }: { bits: Bit[]; top: number; size?: number; color?: string; accent?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{ position: "absolute", top, left: 60, right: 60, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.05em", wordSpacing: "0.1em", color, textWrap: "balance", ...style }}
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
                ...(b.accent ? { fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: size * 1.18, letterSpacing: "-0.02em", color: accent } : null),
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

/** A mono label between two hairlines, like the site's section heads (« N° 01 — Le principe »). */
function Label({ top, left, right, color = C.ink }: { top: number; left: string; right: string; color?: string }) {
  return (
    <div style={{ position: "absolute", top, left: 60, right: 60, display: "flex", justifyContent: "space-between", borderTop: `2px solid ${color}`, paddingTop: 14, fontFamily: SANS, fontWeight: 500, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase", color }}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

/** A phone, its screen given as children; it comes up from below with its scene. */
function Phone({ children, top, height, width = 620, at, screen = C.chat }: { children: ReactNode; top: number; height: number; width?: number; at: number; screen?: string }) {
  const frame = useCurrentFrame();
  const p = enter(frame, at, 14);
  return (
    <div style={{ position: "absolute", left: (1080 - width) / 2, top: px(top + (1 - p) * 260), width, height, borderRadius: 82, background: C.ink, padding: 16 }}>
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
        <div style={{ fontSize: 34, fontWeight: 600, color: C.ink }}>Edith</div>
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
      {[1, 2, 3].map((n) => (
        <div key={n} style={{ width: 146, height: 196, borderRadius: 16, overflow: "hidden" }}>
          <Img src={staticFile(`intro-photo-${n}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
    </div>
  );
}

/** Her video, with its play sign and length. */
function Clip() {
  return (
    <div style={{ position: "relative", width: 330, height: 204, borderRadius: 16, overflow: "hidden" }}>
      <Img src={staticFile("intro-clip.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 78, height: 78, margin: "-39px 0 0 -39px", borderRadius: "50%", background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 0, height: 0, marginLeft: 6, borderTop: "15px solid transparent", borderBottom: "15px solid transparent", borderLeft: "24px solid #fff" }} />
      </div>
      <div style={{ position: "absolute", left: 12, bottom: 8, fontFamily: SANS, fontSize: 22, fontWeight: 600, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>0:14</div>
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
        <div style={{ background: "#fff", border: `2px solid ${C.ink}`, padding: "26px 34px", fontFamily: SANS, fontWeight: 600, fontSize: 52, lineHeight: 1.05, letterSpacing: "-0.045em", color: C.ink, whiteSpace: "pre" }}>
          {"En gros,\nje "}
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 64, letterSpacing: "-0.01em" }}>t’explique</span>
        </div>
      </div>
      <Say top={850} size={96} bits={[{ text: "Salut !", at: 0 }, { text: "Moi c’est", at: T.moi }]} />
      <Say top={950} size={210} bits={[{ text: "Edith", at: T.edith, accent: true }]} style={{ lineHeight: 1 }} />
      <Say top={1250} size={54} color={C.muted} bits={[{ text: "ton", at: T.ton }, { text: "community manager", at: T.community }, { text: "IA", at: T.community + 0.5 }]} />
      <Label top={1700} left="Edith" right="Sur WhatsApp" />
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
  const phoneTop = 440;
  const phoneHeight = 1340;
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

/** Where Edith stands in « je m'occupe de tout », and where everything she is sent goes. */
const EDITH_AT = { x: 540, y: 700 };

/**
 * One of the things she sent, scattered around the screen, then drawn into Edith along a curve
 * (faster as it gets close, smaller, gone as it reaches her).
 */
function Gathered({ x, y, at, spin, children }: { x: number; y: number; at: number; spin: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [F(at), F(at + 0.5)], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (t >= 1) return null;
  // Waiting for its turn, it drifts a little.
  const drift = (1 - t) * Math.sin((frame + x) / 9) * 6;
  const { x: ex, y: ey } = EDITH_AT;
  const cx = (x + ex) / 2 + (ey - y) * 0.3;
  const cy = (y + ey) / 2 - (ex - x) * 0.3;
  const u = 1 - t;
  const left = u * u * x + 2 * u * t * cx + t * t * ex;
  const top = u * u * y + 2 * u * t * cy + t * t * ey + drift;
  const appear = enter(frame, F(T.ensemble) + 3, 8);
  return (
    <div style={{ position: "absolute", left: px(left), top: px(top), opacity: appear * Math.min(1, (1 - t) / 0.2), transform: `translate(-50%, -50%) rotate(${spin * (1 - t * 0.5)}deg) scale(${(0.7 + 0.3 * appear) * (1 - 0.8 * t)})` }}>
      {children}
    </div>
  );
}

const card: CSSProperties = { overflow: "hidden", border: `3px solid ${C.bg}` };

/** « je m'occupe de tout »: everything she sent flies into Edith, who takes it all on. */
function FlashScene() {
  const frame = useCurrentFrame();
  const pop = enterAt(frame, T.ensemble + 0.15, 12);
  // Edith swallows the last of it on « tout »: a small gulp and a ring going out.
  const gulp = interpolate(frame, [F(T.tout) - 4, F(T.tout), F(T.tout) + 8], [0, 1, 0], clamp);
  const ring = interpolate(frame, [F(T.tout), F(T.tout) + 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const glow = 0.45 + 0.35 * gulp;
  return (
    <>
      {ring > 0 && ring < 1 && (
        <div style={{ position: "absolute", left: EDITH_AT.x - (220 + ring * 520), top: EDITH_AT.y - (220 + ring * 520), width: 2 * (220 + ring * 520), height: 2 * (220 + ring * 520), borderRadius: "50%", border: `2px solid ${C.bg}`, opacity: (1 - ring) * glow }} />
      )}
      <Gathered x={190} y={300} at={T.ensemble + 0.3} spin={-12}>
        <div style={{ ...card, width: 170, height: 226 }}>
          <Img src={staticFile("intro-photo-1.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </Gathered>
      <Gathered x={870} y={290} at={T.ensemble + 0.35} spin={8}>
        <div style={{ borderRadius: 999, background: C.mine, padding: "6px 22px" }}>
          <VoiceNote at={T.ensemble} />
        </div>
      </Gathered>
      <Gathered x={190} y={1560} at={T.ensemble + 0.4} spin={10}>
        <div style={card}>
          <Clip />
        </div>
      </Gathered>
      <Gathered x={890} y={1520} at={T.ensemble + 0.45} spin={-9}>
        <div style={{ ...card, width: 170, height: 226 }}>
          <Img src={staticFile("intro-photo-2.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </Gathered>
      <Gathered x={900} y={930} at={T.ensemble + 0.5} spin={6}>
        <BubbleBox height={textHeight(["", ""])}>
          <div style={bubbleText}>{"Idée : « pov : ton premier\ncafé du matin » ☕"}</div>
        </BubbleBox>
      </Gathered>
      <Gathered x={170} y={940} at={T.ensemble + 0.55} spin={-7}>
        <div style={{ ...card, width: 150, height: 200 }}>
          <Img src={staticFile("intro-photo-3.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </Gathered>
      <Gathered x={560} y={1760} at={T.ensemble + 0.6} spin={4}>
        <BubbleBox mine height={textHeight([""])}>
          <div style={bubbleText}>Trop bien, go ! 🔥</div>
        </BubbleBox>
      </Gathered>
      <div style={{ position: "absolute", left: 0, right: 0, top: EDITH_AT.y - 200, display: "flex", justifyContent: "center", opacity: pop, transform: `translateY(${px((1 - pop) * 60)}px) scale(${(0.6 + 0.4 * pop) * (1 + 0.1 * gulp)})` }}>
        <div style={{ color: C.bg }}>
          <Mascot size={400} mood={frame >= F(T.tout) ? "laugh" : "happy"} still />
        </div>
      </div>
      <Say top={1010} size={104} color={C.bg} bits={[{ text: "je m’occupe", at: T.occupe }]} />
      <Say top={1120} size={230} color={C.bg} bits={[{ text: "de tout", at: T.tout, accent: true }]} style={{ lineHeight: 1 }} />
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
      <div style={{ position: "absolute", left: 70, top: 420, width: 430, height: 764, transform: `translateX(${px((1 - reel) * -620)}px) rotate(-2deg)`, overflow: "hidden", border: `2px solid ${C.ink}`, background: C.ink }}>
        <Sequence from={F(from)} layout="none">
          <OffthreadVideo src={staticFile("reels/cafe.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
              overflow: "hidden",
              border: `2px solid ${C.ink}`,
              opacity: p,
              transform: `translateX(${px((1 - p) * 520)}px) rotate(${2 + k * 3}deg)`,
            }}
          >
            <Img src={staticFile(`carrousels/comptoir-${n}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
      {/* The caption, written as she listens. */}
      <div style={{ position: "absolute", left: 90, right: 90, top: 1300, height: 300, boxSizing: "border-box", opacity: card, transform: `translateY(${px((1 - card) * 120)}px)`, background: "#fff", border: `2px solid ${C.ink}`, padding: "28px 38px", fontFamily: SANS }}>
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 14 }}>Ta légende</div>
        <div style={{ fontSize: 38, lineHeight: 1.35, fontWeight: 500, letterSpacing: "-0.02em", color: C.ink }}>
          {caption.slice(0, typed)}
          <span style={{ opacity: Math.floor(frame / 6) % 2 ? 0 : 1 }}>|</span>
        </div>
      </div>
    </>
  );
}

function StartScene({ from }: { from: number }) {
  const frame = useCurrentFrame();
  const pop = spring({ frame: frame - F(from), fps: FPS, durationInFrames: 20, config: { damping: 11, mass: 0.8 } });
  const five = enterAt(frame, T.commence + 0.55, 10);
  const lines = enterAt(frame, T.commence + 1.4, 10);
  const where = enterAt(frame, T.commence + 1.75, 10);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 240, display: "flex", justifyContent: "center", transform: `translateY(${px(Math.sin(frame / 12) * 10)}px) scale(${0.4 + 0.6 * pop})`, opacity: Math.min(1, pop * 2) }}>
        <Mascot size={360} mood="happy" still />
      </div>
      <Say top={660} size={92} bits={[{ text: "Allez,", at: T.allez }]} />
      <Say top={760} size={140} bits={[{ text: "on commence ?", at: T.commence, accent: true }]} style={{ lineHeight: 1 }} />
      {/* Tristan: « en 5 minutes SANS APP, directement sur WhatsApp ». */}
      <div style={{ position: "absolute", top: 1040, left: 60, right: 60, borderTop: `2px solid ${C.ink}`, paddingTop: 34, textAlign: "center", opacity: five, transform: `translateY(${px((1 - five) * 40)}px)`, fontFamily: SANS, fontWeight: 600, fontSize: 76, lineHeight: 1.04, letterSpacing: "-0.05em", color: C.ink }}>
        En 5 minutes, <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 88, letterSpacing: "-0.01em" }}>sans app</span>,
        <br />
        directement sur WhatsApp.
      </div>
      <div style={{ position: "absolute", top: 1330, left: 80, right: 80, textAlign: "center", opacity: lines, transform: `translateY(${px((1 - lines) * 40)}px)`, fontFamily: SANS, fontWeight: 500, fontSize: 48, lineHeight: 1.2, letterSpacing: "-0.03em", color: C.muted, textWrap: "balance" }}>
        Envoie-moi ton site ou ton Instagram
      </div>
      <div style={{ position: "absolute", top: 1500, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: where, transform: `translateY(${px((1 - where) * 40)}px)` }}>
        <div style={{ padding: "20px 40px", background: C.ink, color: C.bg, fontFamily: SANS, fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>ici, sur WhatsApp</div>
      </div>
    </>
  );
}

type SceneProps = { from: number };
type SceneDef = { id: string; from: number; background: string; View: (props: SceneProps) => ReactNode; wipe?: boolean };

/** The scenes in order, each from a little before its first word: its entrance ends as the word is said. */
const SCENES: SceneDef[] = [
  { id: "hello", from: -LEAD, background: C.bg, View: HelloScene },
  { id: "chat", from: T.parles - 0.3, background: C.bg, View: ChatScene },
  { id: "flash", from: T.ensemble + 0.1, background: C.ink, View: FlashScene, wipe: true },
  { id: "work", from: T.tesReels - 0.25, background: C.soft, View: WorkScene },
  { id: "start", from: T.allez - 0.2, background: C.bg, View: StartScene },
];

/** How long (frames) a scene takes to come in: it pushes the one before up, like a swipe. */
const PUSH = 9;

export function Intro() {
  loadBrandFonts();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, color: C.ink }}>
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
