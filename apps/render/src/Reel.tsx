import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Fit } from "./Fit";
import { loadFonts } from "./fonts";
import { MotionScene } from "./MotionScene";
import { SceneView } from "./Scene";
import { THEMES, type Theme } from "./theme";
import type { ReelProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Safe zones: Instagram and TikTok cover the bottom quarter and the right edge. */
// Same margin on both sides, so centred texts sit on the frame's centre line; 140 px keeps
// them clear of Instagram's buttons on the right.
const SAFE = { left: 140, right: 140 };

const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function Reel(props: ReelProps) {
  const theme = THEMES[props.template];
  loadFonts([props.brand.displayFont, props.brand.bodyFont]);
  const k = props.width / 1080;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {props.segments.map((segment, i) => (
        <Sequence key={i} from={segment.startAt} durationInFrames={segment.durationInFrames} layout="none">
          <FadeIn frames={i > 0 ? props.fadeFrames : 0}>
            {segment.type === "clip" || segment.type === "image" ? (
              <>
                {segment.type === "clip" ? (
                  <Shot segment={segment} theme={theme} />
                ) : (
                  <Img src={segment.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {/* Soft gradients keep white text readable on any footage. */}
                <AbsoluteFill
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0) 45%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.28) 100%)",
                  }}
                />
              </>
            ) : segment.type === "motion" ? (
              <MotionScene
                js={segment.js}
                texts={segment.texts ?? {}}
                fallback={segment.fallback}
                durationInFrames={segment.durationInFrames}
                props={props}
                theme={theme}
                k={k}
              />
            ) : (
              <SceneView scene={segment.scene} durationInFrames={segment.durationInFrames} props={props} theme={theme} k={k} />
            )}
          </FadeIn>
        </Sequence>
      ))}

      {props.texts.map((t, i) => (
        <Sequence key={`t${i}`} from={t.from} durationInFrames={t.durationInFrames} layout="none">
          <TextBeat text={t} index={i} props={props} theme={theme} k={k} />
        </Sequence>
      ))}

      {props.words.length > 0 && <Subtitles props={props} theme={theme} k={k} />}

      {props.endCard && (
        <Sequence from={props.endCard.from} layout="none">
          <EndCard props={props} k={k} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

function FadeIn({ frames, children }: { frames: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: frames ? interpolate(frame, [0, frames], [0, 1], clamp) : 1 }}>{children}</AbsoluteFill>;
}

type ClipSegment = Extract<ReelProps["segments"][number], { type: "clip" }>;

function Shot({ segment, theme }: { segment: ClipSegment; theme: Theme }) {
  const frame = useCurrentFrame();
  const scale = segment.zoom
    ? interpolate(frame, [0, segment.durationInFrames], [1, theme.zoomTo], { ...clamp, easing: Easing.inOut(Easing.quad) })
    : 1;
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={segment.src}
        trimBefore={segment.startFrom}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }}
      />
    </AbsoluteFill>
  );
}

function useExit(durationInFrames: number, theme: Theme) {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [durationInFrames - theme.exitFrames, durationInFrames], [1, 0], clamp);
  return { opacity: out, translate: (1 - out) * -12 };
}

/** A dark rounded background behind a text, set by hand to read it on a busy image. */
function backdrop(text: ReelProps["texts"][number], k: number): CSSProperties {
  return text.backdrop
    ? { background: "rgba(20,14,36,0.62)", borderRadius: 18 * k, padding: `${14 * k}px ${24 * k}px`, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }
    : {};
}

/**
 * Left and right edges of a text's box: the safe margins, or narrower around a
 * centre moved by hand (`x`), so the text stays inside the safe zone.
 */
function sides(text: ReelProps["texts"][number], props: ReelProps, k: number): { left: number; right: number } {
  const left = SAFE.left * k;
  const right = SAFE.right * k;
  if (text.x === undefined) return { left, right };
  const centre = text.x * props.width;
  const half = Math.max(80 * k, Math.min(centre - left, props.width - right - centre));
  return { left: centre - half, right: props.width - centre - half };
}

function TextBeat({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  // Remount when edited, so the fit is measured again (scene editor).
  const key = `${text.text}|${text.style}|${text.scale ?? 1}|${text.x ?? ""}|${text.backdrop ?? false}`;
  if (text.style === "hook") return <Hook key={key} text={text} index={index} props={props} theme={theme} k={k} />;
  if (text.style === "band") return <Band key={key} text={text} index={index} props={props} theme={theme} k={k} />;
  return <Caption key={key} text={text} index={index} props={props} theme={theme} k={k} />;
}

function Hook({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(text.durationInFrames, theme);
  const emphasis = new Set(text.emphasis.flatMap((e) => e.split(/\s+/)).map(normalize));
  const h = theme.hook;
  const words = text.text.split(/\s+/).filter(Boolean);

  const box: CSSProperties = {
    position: "absolute",
    top: props.height * (text.y ?? 0.12),
    height: props.height * 0.26 * (text.scale ?? 1),
    ...sides(text, props, k),
    opacity: exit.opacity,
    transform: `translateY(${exit.translate * k}px)`,
  };
  const style: CSSProperties = {
    display: "block",
    fontFamily: `"${h.family === "display" ? props.brand.displayFont : props.brand.bodyFont}", serif`,
    fontWeight: h.weight,
    fontStyle: h.italic ? "italic" : "normal",
    fontSize: h.size * k * (text.scale ?? 1),
    lineHeight: h.lineHeight,
    letterSpacing: h.letterSpacing * k,
    textTransform: h.uppercase ? "uppercase" : "none",
    color: "#fff",
    textShadow: text.backdrop ? "none" : "0 4px 28px rgba(0,0,0,0.35)",
  };

  // A long hook shrinks to its box (top of the frame, inside the side margins).
  // The dark background, when set, hugs the lines of text, not the whole box.
  return (
    <Fit style={box} innerStyle={style} marker={String(index)}>
      <span style={text.backdrop ? { ...backdrop(text, k), lineHeight: 1.3 } : undefined}>
        {words.map((word, i) => {
          const p = spring({ frame: frame - i * h.stagger, fps, config: theme.spring });
          const enter: CSSProperties =
            h.enter === "pop"
              ? { transform: `scale(${interpolate(p, [0, 1], [0.55, 1])})`, opacity: interpolate(p, [0, 0.4], [0, 1], clamp) }
              : h.enter === "rise"
                ? { transform: `translateY(${interpolate(p, [0, 1], [34 * k, 0])}px)`, opacity: p, filter: `blur(${interpolate(p, [0, 1], [8, 0])}px)` }
                : { transform: `translateY(${interpolate(p, [0, 1], [10 * k, 0])}px)`, opacity: p };
          const stressed = emphasis.has(normalize(word));
          return (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre", ...enter }}>
              <span style={stressed ? { color: props.brand.accent, filter: "brightness(1.15)" } : undefined}>{word}</span>
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </span>
    </Fit>
  );
}

function Band({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(text.durationInFrames, theme);
  const b = theme.band;
  const reveal = spring({ frame, fps, config: { damping: 200, stiffness: 120, mass: 0.8 } });
  const textIn = spring({ frame: frame - 4, fps, config: { damping: 200, stiffness: 120, mass: 0.8 } });
  const emphasis = new Set(text.emphasis.flatMap((e) => e.split(/\s+/)).map(normalize));

  return (
    <div
      style={{
        position: "absolute",
        top: props.height * (text.y ?? 0.37),
        ...sides(text, props, k),
        display: "flex",
        justifyContent: "center",
        opacity: exit.opacity,
        transform: `translateY(${exit.translate * k}px) rotate(${b.tilt}deg)`,
      }}
    >
      <div
        data-fauve-text={index}
        style={{
          clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0 round ${b.radius * k}px)`,
          background: b.outline ? "rgba(0,0,0,0.18)" : props.brand.accent,
          border: b.outline ? `${2 * k}px solid rgba(255,255,255,0.9)` : "none",
          borderRadius: b.radius * k,
          padding: `${18 * k}px ${36 * k}px`,
          color: b.outline ? "#fff" : props.brand.accentInk,
          fontFamily: `"${props.brand.bodyFont}", sans-serif`,
          fontWeight: b.weight,
          fontSize: b.size * k * (text.scale ?? 1),
          letterSpacing: b.letterSpacing * k,
          textTransform: b.uppercase ? "uppercase" : "none",
          textAlign: "center",
          lineHeight: 1.2,
          boxShadow: b.outline ? "none" : "0 10px 30px rgba(0,0,0,0.18)",
        }}
      >
        <span style={{ opacity: textIn, display: "inline-block", transform: `translateX(${(1 - textIn) * -14 * k}px)` }}>
          {text.text.split(/\s+/).map((word, i, all) => (
            <span key={i} style={emphasis.has(normalize(word)) ? { fontStyle: "italic" } : undefined}>
              {word}
              {i < all.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function Caption({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(text.durationInFrames, theme);
  const p = spring({ frame, fps, config: { damping: 200, stiffness: 100 } });
  return (
    <div
      data-fauve-text={index}
      style={{
        position: "absolute",
        top: props.height * (text.y ?? 0.63),
        ...sides(text, props, k),
        textAlign: "center",
        color: "#fff",
        fontFamily: `"${props.brand.bodyFont}", sans-serif`,
        fontWeight: theme.caption.weight,
        fontSize: theme.caption.size * k * (text.scale ?? 1),
        lineHeight: 1.25,
        textShadow: "0 2px 18px rgba(0,0,0,0.45)",
        ...backdrop(text, k),
        opacity: Math.min(p, exit.opacity),
        transform: `translateY(${(1 - p) * 18 * k + exit.translate * k}px)`,
      }}
    >
      {text.text}
    </div>
  );
}

/** Word-by-word subtitles: short phrases, the spoken word lit up. */
function Subtitles({ props, theme, k }: { props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const chunks: ReelProps["words"][] = [];
  for (const word of props.words) {
    const current = chunks.at(-1);
    const last = current?.at(-1);
    if (current && last && current.length < 4 && word.from - last.to < 12) current.push(word);
    else chunks.push([word]);
  }
  const chunk = chunks.find((c) => frame >= c[0]!.from && frame <= c.at(-1)!.to + 6);
  if (!chunk) return null;
  const s = theme.subtitle;
  return (
    <div
      style={{
        position: "absolute",
        top: props.height * 0.55,
        left: SAFE.left * k,
        right: SAFE.right * k,
        textAlign: "center",
        fontFamily: `"${props.brand.bodyFont}", sans-serif`,
        fontWeight: s.weight,
        fontSize: s.size * k,
        textTransform: s.uppercase ? "uppercase" : "none",
        lineHeight: 1.3,
        color: "#fff",
        textShadow: "0 3px 16px rgba(0,0,0,0.5)",
      }}
    >
      {chunk.map((word, i) => {
        const active = frame >= word.from && frame <= word.to;
        const style: CSSProperties =
          active && s.highlight === "pill"
            ? { background: props.brand.accent, color: props.brand.accentInk, borderRadius: 10 * k, padding: `0 ${10 * k}px`, textShadow: "none" }
            : active
              ? { color: props.brand.accent }
              : {};
        return (
          <span key={i} style={{ display: "inline-block", margin: `0 ${8 * k}px`, ...style }}>
            {word.w}
          </span>
        );
      })}
    </div>
  );
}

function EndCard({ props, k }: { props: ReelProps; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shade = interpolate(frame, [0, 12], [0, 1], clamp);
  const p = spring({ frame: frame - 4, fps, config: { damping: 200, stiffness: 100 } });
  const card = props.endCard!;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(20,14,32,${0.55 * shade})`,
        backdropFilter: `blur(${10 * shade}px)`,
        color: "#fff",
      }}
    >
      {/* A long studio name shrinks instead of leaving the frame. */}
      <Fit style={{ position: "absolute", top: props.height * 0.12, bottom: props.height * 0.2, left: SAFE.left * k, right: SAFE.right * k }}>
        {(fit) => (
          <div style={{ opacity: p, transform: `translateY(${(1 - p) * 24 * k}px)` }}>
            {props.brand.logoUrl ? (
              <Img src={props.brand.logoUrl} style={{ maxWidth: 520 * k, maxHeight: 220 * k, objectFit: "contain", marginBottom: 28 * k }} />
            ) : null}
            <div style={{ fontFamily: `"${props.brand.displayFont}", serif`, fontStyle: "italic", fontSize: 96 * k, lineHeight: 1.05 }}>
              {card.title}
            </div>
            {card.subtitle ? (
              <div
                style={{
                  marginTop: 22 * k,
                  fontFamily: `"${props.brand.bodyFont}", sans-serif`,
                  fontWeight: 600,
                  fontSize: Math.max(38, 28 / fit) * k, // stays readable when a long name shrinks
                  opacity: 0.92,
                }}
              >
                {card.subtitle}
              </div>
            ) : null}
            <div style={{ margin: `${30 * k}px auto 0`, width: 64 * k, height: 4 * k, borderRadius: 4 * k, background: props.brand.accent }} />
          </div>
        )}
      </Fit>
    </AbsoluteFill>
  );
}
