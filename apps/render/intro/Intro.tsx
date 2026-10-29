import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, Composition, continueRender, delayRender, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Mascot } from "../../web/src/components/mascot";
// The app's own font files (those of its link preview image), not Google's: the render runs offline.
import instrumentItalic from "../../web/src/app/_og/instrument-italic.ttf";
import jakarta600 from "../../web/src/app/_og/jakarta-600.ttf";
import jakarta800 from "../../web/src/app/_og/jakarta-800.ttf";

// Edith's introduction in 30 seconds (Tristan: « il se connecte, bienvenue, voici tout ce qu'il faut
// savoir sur moi, et là tu balances la vidéo 30 secondes qui explique les capacités, WhatsApp, l'app
// pour ordi »): who Edith is, everything happens on WhatsApp (her videos, photos, voice notes), the
// Reels, the carousels and the captions, nothing goes out without her « oui », and the app on a
// computer; then how to start. Motion design in the app's colours, her real landing work inside.
//
// Made by hand, once:
//   1. Edith's voice reads the script (its charter's narrator, Lucie): POST /api/admin/voices?say=<voice>&text=<script>
//      (CRON_SECRET, from the database), which answers the voice and the time of each word;
//   2. python3 intro/place-voice.py <voice.mp3>: each sentence on its scene → ../web/public/landing/intro-voice.mp3 and
//      intro/voice.json (the scenes' timings, this composition's props);
//   3. from apps/render: npx remotion render intro/index.ts EdithIntro <out.mp4> --public-dir ../web/public/landing
//      --crf 22 --props intro/voice.json
//   4. Edith's music under it, mixed as for any Reel (the voice-over case): the video uploaded to the lab studio of
//      edith-ai.app (/api/admin/lab?site=edith-ai.app&step=upload), set as a played-as-is post (a « baked » plan,
//      its voice flagged), then &step=music; its render is apps/web/public/onboarding/edith-intro.mp4, its poster:
//      ffmpeg -ss 2.2 -i edith-intro.mp4 -frames:v 1 -vf scale=540:-1 -q:v 4 edith-intro.jpg

const FPS = 30;
const s = (seconds: number) => Math.round(seconds * FPS);

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

type SceneId = "hello" | "whatsapp" | "reel" | "carousel" | "publish" | "app" | "start";
type Timed = { id: SceneId; from: number; to: number };

/** The scenes, end to end (seconds), when no voice sets them: with one, each starts on its own sentence (props.scenes). */
const SCENES: readonly Timed[] = [
  { id: "hello", from: 0, to: 3.6 },
  { id: "whatsapp", from: 3.6, to: 10 },
  { id: "reel", from: 10, to: 14.4 },
  { id: "carousel", from: 14.4, to: 19.4 },
  { id: "publish", from: 19.4, to: 24.2 },
  { id: "app", from: 24.2, to: 27.6 },
  { id: "start", from: 27.6, to: 30 },
];
export const INTRO_SECONDS = 30;

type IntroProps = {
  /** The voice-over, read by Edith (a file of the public dir): it goes out with the video, the music is mixed under it by the app. */
  voice?: string | null;
  /** The scenes set on the voice's sentences. */
  scenes?: Timed[] | null;
  soundtrack?: string | null;
};
const lengthOf = (scenes: readonly Timed[]) => scenes[scenes.length - 1]!.to;

/** A soft entrance, never a bounce. */
function useIn(delay = 0, duration = 14) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, durationInFrames: duration, config: { damping: 200 } });
}

function Rise({ delay = 0, distance = 40, children, style }: { delay?: number; distance?: number; children: ReactNode; style?: CSSProperties }) {
  const p = useIn(delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * distance}px)`, ...style }}>{children}</div>;
}

/** Each scene fades in over the one before and out at its end. */
function Scene({ length, children }: { length: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [length - 8, length], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lift = interpolate(frame, [length - 8, length], [0, -30], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut), transform: `translateY(${lift}px)` }}>{children}</AbsoluteFill>;
}

/** A title at the top: plain words, one in Instrument Serif italic, and a line under it. */
function Title({ before, accent, after = "", sub, delay = 0 }: { before: string; accent: string; after?: string; sub?: string; delay?: number }) {
  return (
    <div style={{ position: "absolute", top: 150, left: 80, right: 80, textAlign: "center" }}>
      <Rise delay={delay}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 84, lineHeight: 1.06, letterSpacing: "-0.03em", color: C.ink, textWrap: "balance" }}>
          {before}
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 100, letterSpacing: "-0.01em", color: C.violet }}>{accent}</span>
          {after}
        </div>
      </Rise>
      {sub && (
        <Rise delay={delay + 6}>
          <div style={{ marginTop: 22, fontFamily: SANS, fontWeight: 600, fontSize: 44, lineHeight: 1.25, color: C.muted, textWrap: "balance" }}>{sub}</div>
        </Rise>
      )}
    </div>
  );
}

/** The brand's orb, drifting slowly behind everything. */
function Orb() {
  const frame = useCurrentFrame();
  const x = Math.sin(frame / 70) * 60;
  const y = Math.cos(frame / 90) * 50;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1100, height: 1100, left: 260 + x, top: 900 + y, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${C.violet}, ${C.coral} 70%)`, opacity: 0.16, filter: "blur(120px)" }} />
      <div style={{ position: "absolute", width: 700, height: 700, left: -260 - x, top: 120 - y, borderRadius: "50%", background: C.coral, opacity: 0.1, filter: "blur(110px)" }} />
    </AbsoluteFill>
  );
}

/** A phone, its screen given as children. */
function Phone({ children, top = 560, width = 600, height = 1210, delay = 4 }: { children: ReactNode; top?: number; width?: number; height?: number; delay?: number }) {
  const p = useIn(delay, 18);
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - width) / 2,
        top: top + (1 - p) * 120,
        width,
        height,
        opacity: p,
        borderRadius: 82,
        background: C.ink,
        padding: 16,
        boxShadow: "0 50px 90px rgba(28,21,48,.22)",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 66, overflow: "hidden", background: C.chat }}>{children}</div>
    </div>
  );
}

/** WhatsApp's header in the phone: Edith, on line. */
function ChatHeader() {
  return (
    <div style={{ height: 150, paddingTop: 54, display: "flex", alignItems: "center", gap: 18, padding: "54px 28px 0", background: "#F7F5F3", borderBottom: `2px solid ${C.line}` }}>
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

function Bubble({ mine = false, delay, children, style }: { mine?: boolean; delay: number; children: ReactNode; style?: CSSProperties }) {
  const p = useIn(delay, 12);
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", opacity: p, transform: `translateY(${(1 - p) * 26}px) scale(${0.96 + 0.04 * p})`, transformOrigin: mine ? "right bottom" : "left bottom" }}>
      <div
        style={{
          maxWidth: "82%",
          borderRadius: 26,
          borderBottomRightRadius: mine ? 8 : 26,
          borderBottomLeftRadius: mine ? 26 : 8,
          background: mine ? C.mine : "#fff",
          padding: "16px 22px",
          fontFamily: SANS,
          fontSize: 31,
          lineHeight: 1.3,
          fontWeight: 500,
          color: C.ink,
          boxShadow: "0 2px 4px rgba(0,0,0,.06)",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Her voice note: a play sign, a waveform, its length. */
function VoiceNote() {
  const frame = useCurrentFrame();
  const bars = [10, 22, 34, 18, 40, 26, 14, 30, 44, 20, 12, 28, 36, 16, 24, 32, 12, 20];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 0, height: 0, borderTop: "16px solid transparent", borderBottom: "16px solid transparent", borderLeft: `26px solid ${C.muted}` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 6, height: h * (0.75 + 0.25 * Math.abs(Math.sin((frame + i * 7) / 6))), borderRadius: 3, background: i < 7 ? C.green : "#9AA4A0" }} />
        ))}
      </div>
      <div style={{ fontSize: 24, color: C.muted, fontWeight: 600 }}>0:12</div>
    </div>
  );
}

function HelloScene() {
  const frame = useCurrentFrame();
  const p = useIn(2, 22);
  const float = Math.sin(frame / 14) * 10;
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 470, display: "flex", justifyContent: "center", opacity: p, transform: `translateY(${(1 - p) * 80 + float}px) scale(${0.85 + 0.15 * p})` }}>
        <Mascot size={520} mood={frame > s(1.4) ? "happy" : "idle"} still />
      </div>
      <div style={{ position: "absolute", top: 1080, left: 80, right: 80, textAlign: "center" }}>
        <Rise delay={10}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, letterSpacing: "-0.03em", color: C.ink }}>Salut, moi c’est</div>
        </Rise>
        <Rise delay={16}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 230, lineHeight: 1, color: C.violet, marginTop: -6 }}>Edith</div>
        </Rise>
        <Rise delay={26}>
          <div style={{ marginTop: 26, fontFamily: SANS, fontWeight: 700, fontSize: 48, color: C.muted }}>ton community manager IA</div>
        </Rise>
      </div>
    </>
  );
}

function WhatsAppScene() {
  return (
    <>
      <Title before="Tout se passe sur " accent="WhatsApp" sub="Envoie-moi tes vidéos, tes photos ou un vocal" />
      <Phone>
        <ChatHeader />
        <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "34px 24px" }}>
          <Bubble mine delay={s(1.9)} style={{ padding: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ position: "relative", width: 132, height: 196, borderRadius: 16, overflow: "hidden" }}>
                  <Img src={staticFile(`raw-cafe-${i}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", left: 10, bottom: 8, fontFamily: SANS, fontSize: 20, fontWeight: 700, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>0:0{4 + i * 2}</div>
                </div>
              ))}
            </div>
          </Bubble>
          <Bubble mine delay={s(3.4)}>
            <VoiceNote />
          </Bubble>
          <Bubble mine delay={s(4.4)}>Un Reel pour vendredi ? Le café du matin, l’ambiance du comptoir</Bubble>
          <Bubble delay={s(5.4)}>Je m’en occupe ✨ Je te l’envoie dès qu’il est prêt.</Bubble>
        </div>
      </Phone>
    </>
  );
}

function ReelScene() {
  const chip = useIn(s(1.4));
  return (
    <>
      <Title before="Je monte tes " accent="Reels" sub="avec une voix off, si tu veux" />
      <Phone top={620} width={560} height={1000}>
        <OffthreadVideo src={staticFile("work-cafe.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </Phone>
      <div style={{ position: "absolute", left: 120, top: 1560, opacity: chip, transform: `translateX(${(1 - chip) * -40}px)`, display: "flex", alignItems: "center", gap: 14, padding: "18px 28px", borderRadius: 999, background: "#fff", boxShadow: "0 18px 40px rgba(28,21,48,.16)", fontFamily: SANS, fontSize: 32, fontWeight: 700, color: C.ink }}>
        <span style={{ width: 16, height: 16, borderRadius: "50%", background: C.coral }} />
        coupes sur le rythme de la musique
      </div>
    </>
  );
}

function CarouselScene() {
  const frame = useCurrentFrame();
  const slides = [1, 2, 3];
  const caption = "Trois gestes pour garder tes cheveux en forme tout l’hiver. Enregistre-le pour ta prochaine douche !";
  const typed = Math.max(0, Math.floor(interpolate(frame, [s(1.7), s(4.2)], [0, caption.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const card = useIn(s(1.7));
  return (
    <>
      <Title before="Je compose tes " accent="carrousels" sub="et j’écris tes légendes" />
      {slides.map((n, i) => {
        const p = spring({ frame: frame - 6 - i * 5, fps: FPS, durationInFrames: 18, config: { damping: 200 } });
        const angle = (i - 1) * 7 * p;
        const x = (i - 1) * 250 * p;
        return (
          <div
            key={n}
            style={{
              position: "absolute",
              left: 540 - 220 + x,
              top: 620 + Math.abs(i - 1) * 30 * p,
              width: 440,
              height: 550,
              borderRadius: 24,
              overflow: "hidden",
              opacity: p,
              transform: `rotate(${angle}deg)`,
              zIndex: i === 1 ? 2 : 1,
              boxShadow: "0 30px 60px rgba(28,21,48,.22)",
              border: "8px solid #fff",
            }}
          >
            <Img src={staticFile(`intro-slide-${n}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 110, right: 110, top: 1290, opacity: card, transform: `translateY(${(1 - card) * 30}px)`, borderRadius: 30, background: "#fff", padding: "30px 34px", boxShadow: "0 18px 40px rgba(28,21,48,.12)", fontFamily: SANS }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.violet, marginBottom: 10 }}>Ta légende</div>
        <div style={{ fontSize: 33, lineHeight: 1.35, fontWeight: 500, color: C.ink, minHeight: 135 }}>
          {caption.slice(0, typed)}
          <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1, color: C.violet }}>|</span>
        </div>
      </div>
    </>
  );
}

function PublishScene() {
  const frame = useCurrentFrame();
  // On her « oui » in the voice.
  const tap = s(1.35);
  const pressed = frame >= tap && frame < tap + 6;
  const ring = interpolate(frame, [tap, tap + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const online = useIn(s(2.3));
  return (
    <>
      <Title before="Je publie quand tu me dis " accent="oui" sub="sur Instagram et TikTok" />
      <Phone>
        <ChatHeader />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "34px 24px" }}>
          <Bubble delay={s(0.2)} style={{ padding: 10 }}>
            <div style={{ width: 300, height: 420, borderRadius: 18, overflow: "hidden", marginBottom: 12 }}>
              <Img src={staticFile("work-pilates.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ padding: "0 10px 6px" }}>Ton Reel est prêt ! Je le publie vendredi à 18 h ?</div>
          </Bubble>
          {["Oui, publie-le", "Je regarde d’abord"].map((label, i) => {
            const p = ease(frame, s(0.5) + i * 3, 12);
            const hit = i === 0;
            return (
              <div key={label} style={{ position: "relative", opacity: p, transform: `translateY(${(1 - p) * 20}px)`, width: "82%", textAlign: "center", padding: "18px 0", borderRadius: 22, background: hit && pressed ? "#E8F0EC" : "#fff", fontFamily: SANS, fontSize: 31, fontWeight: 700, color: "#0A7C5A", boxShadow: "0 2px 4px rgba(0,0,0,.06)" }}>
                {label}
                {hit && ring > 0 && ring < 1 && (
                  <div style={{ position: "absolute", left: "50%", top: "50%", width: 90 + ring * 120, height: 90 + ring * 120, marginLeft: -(45 + ring * 60), marginTop: -(45 + ring * 60), borderRadius: "50%", border: `4px solid ${C.violet}`, opacity: 1 - ring }} />
                )}
              </div>
            );
          })}
          <Bubble mine delay={tap + 8}>Oui, publie-le</Bubble>
        </div>
      </Phone>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1600, display: "flex", justifyContent: "center", opacity: online, transform: `translateY(${(1 - online) * 30}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "22px 36px", borderRadius: 999, background: C.ink, color: "#fff", fontFamily: SANS, fontSize: 36, fontWeight: 800, boxShadow: "0 20px 40px rgba(28,21,48,.28)" }}>
          <span style={{ width: 44, height: 44, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</span>
          En ligne
        </div>
      </div>
    </>
  );
}

/** The same soft entrance as useIn, for elements drawn in a list. */
function ease(frame: number, delay: number, duration: number) {
  return spring({ frame: frame - delay, fps: FPS, durationInFrames: duration, config: { damping: 200 } });
}

function AppScene() {
  const p = useIn(4, 20);
  const frame = useCurrentFrame();
  const tiles = [1, 2, 3, 4, 5, 6];
  return (
    <>
      <Title before="Sur ordi, tout est dans " accent="l’app" sub="ta grille, tes résultats, ton style" />
      <div style={{ position: "absolute", left: 60, right: 60, top: 640 + (1 - p) * 100, opacity: p }}>
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
                  const t = spring({ frame: frame - 14 - i * 3, fps: FPS, durationInFrames: 14, config: { damping: 200 } });
                  return (
                    <div key={n} style={{ position: "relative", aspectRatio: "3 / 4", overflow: "hidden", opacity: t, transform: `scale(${0.9 + 0.1 * t})` }}>
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
        <div style={{ marginTop: 44, display: "flex", justifyContent: "center" }}>
          <div style={{ padding: "16px 34px", borderRadius: 999, background: "#fff", fontFamily: SANS, fontSize: 36, fontWeight: 800, color: C.ink, boxShadow: "0 14px 30px rgba(28,21,48,.12)" }}>edith-ai.app</div>
        </div>
      </div>
    </>
  );
}

function StartScene() {
  const frame = useCurrentFrame();
  const p = useIn(0, 18);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center", opacity: p, transform: `translateY(${Math.sin(frame / 12) * 10}px)` }}>
        <Mascot size={420} mood="happy" still />
      </div>
      <div style={{ position: "absolute", top: 930, left: 80, right: 80, textAlign: "center" }}>
        <Rise delay={6}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 150, lineHeight: 1, color: C.violet }}>On commence ?</div>
        </Rise>
        <Rise delay={14}>
          <div style={{ marginTop: 40, fontFamily: SANS, fontWeight: 800, fontSize: 60, lineHeight: 1.15, letterSpacing: "-0.02em", color: C.ink, textWrap: "balance" }}>Envoie-moi ton site ou ton Instagram</div>
        </Rise>
        <Rise delay={22}>
          <div style={{ marginTop: 26, fontFamily: SANS, fontWeight: 600, fontSize: 40, color: C.muted }}>ici, sur WhatsApp</div>
        </Rise>
      </div>
    </>
  );
}

const SCENE_VIEWS: Record<SceneId, () => ReactNode> = {
  hello: HelloScene,
  whatsapp: WhatsAppScene,
  reel: ReelScene,
  carousel: CarouselScene,
  publish: PublishScene,
  app: AppScene,
  start: StartScene,
};

export function Intro({ soundtrack, voice, scenes }: IntroProps) {
  loadBrandFonts();
  const timed = scenes?.length ? scenes : SCENES;
  const seconds = lengthOf(timed);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* The mascot's sizing, from the app's stylesheet (its motion is drawn here, frame by frame). */}
      <style>{".fauve-cat{display:inline-block;flex-shrink:0;width:var(--cat);height:var(--cat)}.fauve-cat svg{display:block;width:100%;height:100%}"}</style>
      <Orb />
      {timed.map((scene, i) => {
        const View = SCENE_VIEWS[scene.id];
        // Each scene starts a little before the last one ends: they cross-fade.
        const from = s(scene.from) - (i ? 4 : 0);
        const length = s(scene.to) - from;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={length} name={scene.id}>
            <Scene length={length}>
              <View />
            </Scene>
          </Sequence>
        );
      })}
      {voice && <Audio src={staticFile(voice)} />}
      {soundtrack && <Audio src={soundtrack} volume={(f) => interpolate(f, [0, 6, s(seconds) - 24, s(seconds)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />}
    </AbsoluteFill>
  );
}

export function IntroRoot() {
  return (
    <Composition
      id="EdithIntro"
      component={Intro}
      durationInFrames={s(INTRO_SECONDS)}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ soundtrack: null, voice: null, scenes: null } as IntroProps}
      calculateMetadata={({ props }) => ({ durationInFrames: s(lengthOf(props.scenes?.length ? props.scenes : SCENES)) })}
    />
  );
}
