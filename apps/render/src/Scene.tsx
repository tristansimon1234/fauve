import type { CSSProperties } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Fit } from "./Fit";
import type { Theme } from "./theme";
import type { ReelProps, Scene } from "./types";

// Full motion-design screens: animated typography over a living gradient in the
// studio's colours (the drifting orbs echo Fauve's identity). No video needed.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SAFE = { left: 140, right: 140 }; // symmetric: centred titles sit on the centre line

function palette(background: Scene["background"], brand: ReelProps["brand"]) {
  if (background === "ink") {
    return { bg: "#1C1530", fg: "#FFFFFF", mark: brand.accent, orbA: `${brand.accent}cc`, orbB: "rgba(91,63,217,0.55)" };
  }
  if (background === "cream") {
    return { bg: "#FBF7F4", fg: "#1C1530", mark: brand.accent, orbA: `${brand.accent}66`, orbB: "rgba(255,233,225,0.9)" };
  }
  return { bg: brand.accent, fg: brand.accentInk, mark: brand.accentInk, orbA: "rgba(255,255,255,0.35)", orbB: "rgba(0,0,0,0.18)" };
}

/** Same entrances as the hook, so scenes and footage feel like one piece. */
export function wordEntrance(theme: Theme, p: number, k: number): CSSProperties {
  const enter = theme.hook.enter;
  if (enter === "pop") return { transform: `scale(${interpolate(p, [0, 1], [0.55, 1])})`, opacity: interpolate(p, [0, 0.4], [0, 1], clamp) };
  if (enter === "rise") {
    return { transform: `translateY(${interpolate(p, [0, 1], [38 * k, 0])}px)`, opacity: p, filter: `blur(${interpolate(p, [0, 1], [8, 0])}px)` };
  }
  return { transform: `translateY(${interpolate(p, [0, 1], [12 * k, 0])}px)`, opacity: p };
}

function Words({ text, delay, theme, k, style }: { text: string; delay: number; theme: Theme; k: number; style: CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={style}>
      {words.map((word, i) => {
        const p = spring({ frame: frame - delay - i * theme.hook.stagger, fps, config: theme.spring });
        return (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre", ...wordEntrance(theme, p, k) }}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
}

function CountUp({ value, frame }: { value: string; frame: number }) {
  const m = /^(\D*)(\d+)(.*)$/.exec(value);
  if (!m) return <>{value}</>;
  const progress = interpolate(frame, [4, 28], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // The final value holds the room (hidden), so the size never depends on the frame.
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ visibility: "hidden" }}>{value}</span>
      <span style={{ position: "absolute", left: 0, right: 0, top: 0, textAlign: "center" }}>
        {m[1]}
        {Math.round(Number(m[2]) * progress)}
        {m[3]}
      </span>
    </span>
  );
}

/** The studio's colours, alive (two soft orbs drifting slowly): what an animation plays over when there is no footage. */
export function Backdrop({ background = "accent", props, k }: { background?: Scene["background"]; props: ReelProps; k: number }) {
  const frame = useCurrentFrame();
  const c = palette(background, props.brand);
  const drift = (speed: number, amp: number) => Math.sin(frame / speed) * amp;
  return (
    <AbsoluteFill style={{ backgroundColor: c.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: props.width * 1.1,
          height: props.width * 1.1,
          left: props.width * (-0.35 + drift(45, 0.06)),
          top: props.height * (0.02 + drift(60, 0.04)),
          borderRadius: "50%",
          background: `radial-gradient(circle, ${c.orbA} 0%, transparent 65%)`,
          filter: `blur(${40 * k}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: props.width * 1.2,
          height: props.width * 1.2,
          right: props.width * (-0.45 + drift(52, 0.05)),
          bottom: props.height * (0.05 + drift(70, 0.05)),
          borderRadius: "50%",
          background: `radial-gradient(circle, ${c.orbB} 0%, transparent 65%)`,
          filter: `blur(${50 * k}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * The engine's fixed scene over her footage brings its own scrim (the footage plays bare under the
 * motion designer's animations): darker at the top and the bottom, so its white type reads on any picture.
 */
const OVERLAY_SCRIM =
  "linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.2) 26%, rgba(0,0,0,0.06) 46%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.1) 72%, rgba(0,0,0,0.3) 100%), rgba(10,8,18,0.32)";

export function SceneView({
  scene,
  durationInFrames,
  props,
  theme,
  k,
  overlay = false,
}: {
  scene: Scene;
  durationInFrames: number;
  props: ReelProps;
  theme: Theme;
  k: number;
  /** Over her footage: no background of its own, white type that reads on the picture. */
  overlay?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = overlay
    ? { bg: "transparent", fg: "#FFFFFF", mark: props.brand.accent, orbA: "transparent", orbB: "transparent" }
    : palette(scene.background, props.brand);
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], clamp);
  const drift = (speed: number, amp: number) => Math.sin(frame / speed) * amp;
  // Titles in the hook's font (a sans hook keeps its serif for accents only).
  const display = theme.hook.family === "display" ? `"${props.brand.displayFont}", serif` : `"${props.brand.bodyFont}", sans-serif`;
  const body = `"${props.brand.bodyFont}", sans-serif`;
  const kickerIn = spring({ frame, fps, config: { damping: 200, stiffness: 110 } });
  const line = interpolate(frame, [10, 28], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const titleSize = scene.title.length <= 14 ? 150 : scene.title.length <= 28 ? 118 : 92;
  const italic = theme.hook.italic;

  // When the content shrinks to fit, secondary texts keep at least 75 % of their size.
  const readable = (size: number, fit: number) => Math.max(size, (size * 0.75) / fit) * k;

  const kicker = (fit: number) =>
    scene.kicker &&
    scene.kind !== "quote" && (
      <div
        style={{
          fontFamily: body,
          fontWeight: 700,
          fontSize: readable(32, fit),
          letterSpacing: 6 * k,
          textTransform: "uppercase",
          opacity: 0.85 * kickerIn,
          transform: `translateY(${(1 - kickerIn) * 14 * k}px)`,
          marginBottom: 28 * k,
        }}
      >
        {scene.kicker}
      </div>
    );

  return (
    <AbsoluteFill style={{ background: overlay ? OVERLAY_SCRIM : c.bg, overflow: "hidden", textShadow: overlay ? "0 2px 6px rgba(0,0,0,0.25), 0 10px 40px rgba(0,0,0,0.45)" : undefined }}>
      {/* Living background: two soft orbs drifting slowly (none over footage). */}
      {overlay ? null : (
      <div
        style={{
          position: "absolute",
          width: props.width * 1.1,
          height: props.width * 1.1,
          left: props.width * (-0.35 + drift(45, 0.06)),
          top: props.height * (0.02 + drift(60, 0.04)),
          borderRadius: "50%",
          background: `radial-gradient(circle, ${c.orbA} 0%, transparent 65%)`,
          filter: `blur(${40 * k}px)`,
        }}
      />
      )}
      {overlay ? null : (
      <div
        style={{
          position: "absolute",
          width: props.width * 1.2,
          height: props.width * 1.2,
          right: props.width * (-0.45 + drift(52, 0.05)),
          bottom: props.height * (0.05 + drift(70, 0.05)),
          borderRadius: "50%",
          background: `radial-gradient(circle, ${c.orbB} 0%, transparent 65%)`,
          filter: `blur(${50 * k}px)`,
        }}
      />
      )}

      {/* Sizes below are the ideal ones: a long title, word or list shrinks to stay in the safe zone. */}
      <Fit
        style={{
          position: "absolute",
          top: props.height * 0.14,
          bottom: props.height * 0.3,
          left: SAFE.left * k,
          right: SAFE.right * k,
          color: c.fg,
          opacity: exit,
        }}
        innerStyle={{
          alignItems: scene.kind === "list" ? "flex-start" : "center",
          textAlign: scene.kind === "list" ? "left" : "center",
        }}
      >
        {(fit) => (
          <>
            {scene.kind === "title" && (
              <>
                {kicker(fit)}
                <Words
                  text={scene.title}
                  delay={3}
                  theme={theme}
                  k={k}
                  style={{ fontFamily: display, fontStyle: italic ? "italic" : "normal", fontWeight: theme.hook.weight, fontSize: titleSize * k, lineHeight: 1.02, textTransform: theme.hook.uppercase ? "uppercase" : "none" }}
                />
                <div style={{ marginTop: 40 * k, width: 140 * k * line, height: 6 * k, borderRadius: 6 * k, background: c.mark }} />
              </>
            )}

            {scene.kind === "number" && (
              <>
                {kicker(fit)}
                <div
                  style={{
                    fontFamily: body,
                    fontWeight: 800,
                    fontSize: (scene.title.length <= 6 ? 240 : 170) * k,
                    lineHeight: 1,
                    letterSpacing: -4 * k,
                    transform: `scale(${interpolate(spring({ frame, fps, config: { damping: 14, stiffness: 140 } }), [0, 1], [0.7, 1])})`,
                  }}
                >
                  <CountUp value={scene.title} frame={frame} />
                </div>
                {scene.items?.[0] ? (
                  <div style={{ marginTop: 30 * k, fontFamily: body, fontWeight: 600, fontSize: readable(44, fit), opacity: line }}>{scene.items[0]}</div>
                ) : null}
              </>
            )}

            {scene.kind === "quote" && (
              <>
                <div
                  style={{
                    fontFamily: display,
                    fontSize: 280 * k,
                    lineHeight: 0.6,
                    height: 150 * k,
                    color: c.mark,
                    transform: `scale(${spring({ frame, fps, config: { damping: 12, stiffness: 120 } })})`,
                  }}
                >
                  “
                </div>
                <Words
                  text={scene.title}
                  delay={6}
                  theme={theme}
                  k={k}
                  style={{ fontFamily: `"${props.brand.displayFont}", serif`, fontStyle: "italic", fontWeight: 400, fontSize: (scene.title.length <= 40 ? 84 : 66) * k, lineHeight: 1.12 }}
                />
                {scene.kicker ? (
                  <div style={{ marginTop: 36 * k, fontFamily: body, fontWeight: 600, fontSize: readable(36, fit), opacity: line }}>— {scene.kicker}</div>
                ) : null}
              </>
            )}

            {scene.kind === "list" && (
              <>
                <Words
                  text={scene.title}
                  delay={0}
                  theme={theme}
                  k={k}
                  style={{ fontFamily: display, fontStyle: italic ? "italic" : "normal", fontWeight: theme.hook.weight, fontSize: 92 * k, lineHeight: 1.05, marginBottom: 44 * k, textTransform: theme.hook.uppercase ? "uppercase" : "none" }}
                />
                {(scene.items ?? []).map((item, i) => {
                  const p = spring({ frame: frame - 10 - i * 5, fps, config: { damping: 200, stiffness: 120 } });
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 24 * k,
                        marginBottom: 22 * k,
                        fontFamily: body,
                        fontWeight: 600,
                        fontSize: readable(48, fit),
                        opacity: p,
                        transform: `translateX(${(1 - p) * -40 * k}px)`,
                      }}
                    >
                      <span style={{ width: 14 * k, height: 14 * k, borderRadius: "50%", background: c.mark, flexShrink: 0 }} />
                      {item}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </Fit>
    </AbsoluteFill>
  );
}
