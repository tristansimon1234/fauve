import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { gradesFootage, LookDefs, lookFilter, LookOverlay } from "./Looks";
import { passageLook, passageLookOn, type PassageLooks } from "./look-passage";
import type { ComposeShot } from "./types";

// A ready look on one passage of a composition (Tristan's references: an eighth note of « Toi sur un aplat de couleur »
// in black and white, a VHS tape on one passage of « Face caméra et références »), where a look on the whole Reel is its
// finish (plan.look). The engine gives the Reel the ready looks (LOOK_PRESETS: their grade as one colour matrix, their
// texture, the date their camera prints) when an animation's code names Look; Look lays one of them over what it wraps,
// in its box, while its shot plays or within its span, and draws it plain outside (and in the scene check, which has
// none). A look grades and textures her real images, never redraws them.

type Hooks = { useCurrentFrame: () => number; useVideoConfig: () => { width: number; height: number } };

/** The ready looks of this Reel, by key; none in the scene check and the previews that have none (Look draws plain). */
export const PassageLooksContext = createContext<PassageLooks | null>(null);

const px = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

export type LookProps = {
  /** The ready look, by its key (« vhs », « bw », « disposable », « y2k », « cine », « dust ») or its name (« Cassette VHS »). */
  preset: string;
  /** On while this shot plays (shots[i]), and/or from `from` to `to` (frames of the composition, `to` excluded); all along with neither. */
  shot?: ComposeShot;
  from?: number;
  to?: number;
  /** Its box (px: left, top, width, height, and any other style), the whole frame by default: what it wraps is laid in it. */
  style?: CSSProperties;
  /** false: its grade only, without its texture (grain, lines, its camera's date…); `grade` false: its texture only. */
  texture?: boolean;
  grade?: boolean;
  /** What it covers: her Footage, a cut-out, a whole card with its words; or (size) => node, drawn at its box's size. */
  children?: ReactNode | ((size: { width: number; height: number }) => ReactNode);
};

/** Look, bound to a clock (the render's, or the scene check's own for each copy). */
export function makeLooks(hooks: Hooks) {
  return {
    Look: function Look({ preset, shot, from, to, style, texture = true, grade = true, children }: LookProps) {
      const looks = useContext(PassageLooksContext);
      const frame = hooks.useCurrentFrame();
      const { width, height } = hooks.useVideoConfig();
      const size = { width: px(style?.width) ?? width, height: px(style?.height) ?? height };
      const box: CSSProperties = { position: "absolute", left: 0, top: 0, width: size.width, height: size.height, overflow: "hidden", ...style };
      const content = typeof children === "function" ? children(size) : (children ?? null);
      const found = passageLook(looks, preset);
      const on = found && passageLookOn(frame, { from, to, shot }) ? found : null;
      const k = width / 1080;
      const graded = Boolean(on && grade && gradesFootage(on.look));
      // The same tree on and off (what it wraps is never laid again when the look comes or goes).
      return (
        <div style={box}>
          {on && graded ? <LookDefs look={on.look} k={k} /> : null}
          <div style={{ position: "absolute", inset: 0, ...(on && graded ? { filter: lookFilter(on.look, k) } : {}) }}>{content}</div>
          {on && texture ? <LookOverlay look={on.look} k={k} size={size} {...(on.stamp ? { stamp: on.stamp } : {})} /> : null}
        </div>
      );
    },
  };
}
