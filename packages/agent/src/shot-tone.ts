import { z } from "zod";
import { planLook, type ReelEffect, type ReelLook } from "./looks.ts";
import type { Adjust, PhotoEdit } from "./retouch.ts";

// Every shot of a Reel brought to the same light before its look, the way an editor first evens out phone footage in
// CapCut (Tristan, 8 November, on a tutorial whose recipe he liked: « Ajustement automatique », exposure −10, highlights
// −10, saturation +5, clarity +15, a glow, then the clips that need it corrected by hand). One setting on every clip
// darkens a shot that was already dark: here each shot is measured (its light and its colour cast, read in the render
// workshop on her prepared files: apps/render/tone_read.mjs), then moved part of the way toward the Reel's own light,
// gently and capped: a dark shot lifted, a burnt one calmed, a strong cast neutralised a little (only what goes beyond a
// tolerance: a warm restaurant stays warm), so her shots look filmed the same day. Then a light finish (highlights pulled, a small glow on them), hers to switch off.
//
// A model that recreates its original's look (a montage skill, or a Reel that wears a look of its own: hers, the
// Reel she copies, a model's finish) keeps it: its shots' light is only matched to each other (no pull toward a
// standard light, no colour cast corrected), and the light finish steps aside for its look. A shot she wants as filmed (`keep_colour`), or a
// Reel without colour correction (finish.colour « off »), is left as filmed.
//
// Drawn by the render as one colour matrix and one tone curve per shot (apps/render/src/Tone.tsx), on her footage only:
// the texts and the animations over it never change. Deterministic: the same measures give the same grade, in the
// render and the preview (the measures are kept on the plan: segments[].tone).

/** What the render workshop read on one shot's passage (tone_read.mjs), kept on its segment. */
export const shotToneSchema = z.object({
  /** The passage it was read on (in and out, s of the clip): a shot cut elsewhere is read again. */
  at: z.tuple([z.number().min(0), z.number().min(0)]),
  /** Its mean light, and that of its darkest and of its brightest tenth (luma of its sRGB values, 0 to 1). */
  mean: z.number().min(0).max(1),
  low: z.number().min(0).max(1),
  high: z.number().min(0).max(1),
  /** The share of it burnt white. */
  burnt: z.number().min(0).max(1),
  /** The mean colour of its parts that should be neutral (its colour cast); null when too little of it is. */
  rgb: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]).nullable(),
});
export type ShotTone = z.infer<typeof shotToneSchema>;

/** How a Reel's colours are finished (finish.colour): auto, matched and lightly finished; natural, matched only; off, as filmed. */
export const COLOUR_MODES = ["auto", "natural", "off"] as const;
export type ColourMode = (typeof COLOUR_MODES)[number];

/** A shot's grade as the render draws it: a colour matrix (20 values, feColorMatrix), a tone curve (feComponentTransfer table), a glow on its highlights. */
export type ShotGrade = { matrix: number[]; curve: number[]; glow: number };

/** The scales of the correction: gentle, capped, never a look. */
export const TONE = {
  /** The mean light of a well exposed phone shot (sRGB luma), and the colour most graded footage sits at (a touch warm): ln(r/g), ln(b/g). */
  standard: { mean: 0.45, cast: [0.04, -0.05] as const },
  /** How far the Reel's own light is pulled toward the standard (none on a model), at most this far. */
  pull: 0.35,
  pullMax: 0.06,
  /** How far each shot goes toward the Reel's light, and the most it is lifted or darkened (mean light); under `dead`, nothing. */
  follow: 0.6,
  lift: 0.1,
  darken: 0.07,
  dead: 0.025,
  /** The tone curve's gamma, at most. */
  gamma: [0.72, 1.3] as const,
  /**
   * Colour: a cast further than `castDead` from the standard (ln of a channel against green) is corrected by `castFollow`
   * of what is beyond, each channel `castMax` at most; none on a model (its ambiance is its own). Matching casts between
   * shots of different places pushed a white top pink next to a mint backdrop: each shot is neutralised on its own instead.
   */
  castFollow: 0.5,
  castMax: 0.06,
  castDead: 0.06,
  /** Lifted, milky blacks brought down at most this much. */
  black: 0.05,
  /** A burnt shot's whites calmed at most this much. */
  burnt: 0.05,
  /** The light finish: highlights pulled at the top, a small glow on them. */
  polishPull: 0.04,
  polishGlow: 0.12,
} as const;

/** Points of the tone curve (feComponentTransfer table, straight lines between them). */
export const CURVE_POINTS = 33;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const median = (values: number[]) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** A shot's cast as ln(r/g), ln(b/g); null without a reading of its neutral parts. */
export const castOf = (tone: Pick<ShotTone, "rgb"> | null | undefined): [number, number] | null => {
  const rgb = tone?.rgb;
  if (!rgb || rgb.some((v) => v <= 0.01)) return null;
  return [Math.log(rgb[0] / rgb[1]), Math.log(rgb[2] / rgb[1])];
};

/**
 * What every shot of a Reel moves toward: the Reel's own light (its shots' median), pulled a little toward a well exposed
 * shot unless it follows a model; and, unless it follows a model, the standard colour each shot's strong cast is
 * corrected toward (a colour is not matched between shots: two places have two colours).
 */
export function toneBaseline(tones: ShotTone[], deliberate: boolean): { mean: number; low: number; cast: readonly [number, number] | null } {
  const reel = median(tones.map((t) => t.mean)) ?? TONE.standard.mean;
  const mean = deliberate ? reel : reel + clamp(TONE.pull * (TONE.standard.mean - reel), -TONE.pullMax, TONE.pullMax);
  const low = median(tones.map((t) => t.low)) ?? 0.06;
  return { mean, low: deliberate ? low : Math.min(low, 0.08), cast: deliberate ? null : TONE.standard.cast };
}

/** The tone curve: blacks brought down by `black`, mid-tones by a gamma, the top pulled down by `pull` (a soft shoulder from 0.6). */
export function toneCurve({ black = 0, gamma = 1, pull = 0 }: { black?: number; gamma?: number; pull?: number }): number[] {
  return Array.from({ length: CURVE_POINTS }, (_, i) => {
    const x = i / (CURVE_POINTS - 1);
    let y = black > 0 ? Math.max(0, (x - black) / (1 - black)) : x;
    y = gamma !== 1 ? y ** gamma : y;
    if (pull > 0 && y > 0.6) y -= pull * ((y - 0.6) / 0.4) ** 2;
    return r4(clamp(y, 0, 1));
  });
}

/** A value (0–1) through a tone curve (the render's straight lines between its points). */
export function throughCurve(curve: readonly number[] | undefined, v: number): number {
  if (!curve?.length) return v;
  const x = clamp(v, 0, 1) * (curve.length - 1);
  const i = Math.min(curve.length - 2, Math.floor(x));
  return curve[i]! + (curve[i + 1]! - curve[i]!) * (x - i);
}

/** The colour matrix of a white balance (gains on red, green, blue, keeping the light: their luma stays 1). */
function gainMatrix(r: number, g: number, b: number): number[] {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const [kr, kg, kb] = [r / luma, g / luma, b / luma];
  return [r4(kr), 0, 0, 0, 0, 0, r4(kg), 0, 0, 0, 0, 0, r4(kb), 0, 0, 0, 0, 0, 1, 0];
}
const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/**
 * One shot's grade: its light moved part of the way toward the Reel's (a gamma, capped), its milky blacks brought
 * down, its burnt whites calmed, its colour cast moved toward the Reel's (gains, capped), and the light finish
 * (`polish`). Null when there is nothing to do.
 */
export function shotGrade(tone: ShotTone | null, base: ReturnType<typeof toneBaseline> | null, polish: boolean): ShotGrade | null {
  let gamma = 1;
  let black = 0;
  let burntPull = 0;
  let matrix = IDENTITY;
  if (tone && base) {
    // Light: part of the way toward the Reel's, a dark shot lifted more readily than a bright one is darkened.
    const delta = clamp(TONE.follow * (base.mean - tone.mean), -TONE.darken, TONE.lift);
    if (Math.abs(delta) >= TONE.dead && tone.mean > 0.02 && tone.mean < 0.98) {
      gamma = clamp(Math.log(clamp(tone.mean + delta, 0.02, 0.98)) / Math.log(tone.mean), TONE.gamma[0], TONE.gamma[1]);
    }
    // Milky blacks (a haze, a phone lifting its shadows) brought down toward the Reel's.
    if (tone.low > base.low + 0.04) black = clamp(0.5 * (tone.low - base.low), 0, TONE.black);
    // Burnt whites calmed: a sky, a window, a white wall gone flat.
    if (tone.burnt > 0.01 || tone.high > 0.95) burntPull = clamp(0.4 * (tone.high - 0.9) + 0.6 * tone.burnt, 0, TONE.burnt);
    // Colour: a strong cast corrected for part of what goes beyond the tolerance, each channel capped.
    const cast = castOf(tone);
    if (cast && base.cast) {
      const beyond = (d: number) => Math.sign(d) * Math.max(0, Math.abs(d) - TONE.castDead);
      const mr = clamp(-TONE.castFollow * beyond(cast[0] - base.cast[0]), -TONE.castMax, TONE.castMax);
      const mb = clamp(-TONE.castFollow * beyond(cast[1] - base.cast[1]), -TONE.castMax, TONE.castMax);
      if (Math.abs(mr) >= 0.005 || Math.abs(mb) >= 0.005) matrix = gainMatrix(Math.exp(mr), 1, Math.exp(mb));
    }
  }
  const pull = Math.min(TONE.burnt + TONE.polishPull, burntPull + (polish ? TONE.polishPull : 0));
  const glow = polish ? TONE.polishGlow : 0;
  if (gamma === 1 && black === 0 && pull === 0 && glow === 0 && matrix === IDENTITY) return null;
  return { matrix, curve: toneCurve({ black, gamma: r4(gamma), pull }), glow };
}

// ——— A plan's grades ——————————————————————————————————————————————————————————————————————————————————————————

type ToneSegment = { clip_id: string; in: number; out: number; tone?: ShotTone; keep_colour?: boolean };
type TonePlan = {
  segments: (ToneSegment | object)[];
  finish?: { colour?: ColourMode } | undefined;
  look?: ReelLook | undefined;
  effect?: ReelEffect | undefined;
  skill?: object | undefined;
  baked?: object | undefined;
};

const isShot = (s: object): s is ToneSegment => "clip_id" in s;

/** A shot's measure, when it was read on the passage it plays now (a shot cut elsewhere is read again). */
export const toneFor = (s: ToneSegment): ShotTone | null =>
  s.tone && Math.abs(s.tone.at[0] - s.in) <= 0.15 && Math.abs(s.tone.at[1] - s.out) <= 0.15 ? s.tone : null;

/** Whether a look changes the colours of her footage (its grade), not only lays a texture over it. */
export const lookGrades = (look: ReelLook | null | undefined): boolean =>
  Boolean(look) &&
  [look!.exposure, look!.contrast, look!.saturation, look!.warmth, look!.tint, look!.fade, look!.split, look!.hue, look!.glow, look!.soft, look!.bleed].some((v) => Math.abs(v) > 1e-3);

/** How a plan's colours are finished: its finish, « auto » by default; an effects agent's video is played as it is. */
export const colourMode = (plan: TonePlan): ColourMode => (plan.baked ? "off" : (plan.finish?.colour ?? "auto"));

/** A plan that recreates a model's or a Reel's look deliberately: its shots are only matched to each other, without the light finish. */
export const deliberateLook = (plan: TonePlan): boolean => Boolean(plan.skill) || lookGrades(planLook(plan));

/**
 * Each segment's grade (null for an animation, a screen or a shot left as it is), or « as_filmed » for a shot she
 * wants as filmed (no retouch of its colours at all). Deterministic, from the plan alone.
 */
export function reelGrades(plan: TonePlan): (ShotGrade | "as_filmed" | null)[] {
  const mode = colourMode(plan);
  const deliberate = deliberateLook(plan);
  const shots = plan.segments.map((s) => (isShot(s) ? s : null));
  const read = shots.flatMap((s) => (s && !s.keep_colour && toneFor(s) ? [toneFor(s)!] : []));
  const base = mode === "off" || !read.length ? null : toneBaseline(read, deliberate);
  const polish = mode === "auto" && !deliberate;
  return shots.map((s) => {
    if (!s) return null;
    if (mode === "off" || s.keep_colour) return "as_filmed";
    return shotGrade(toneFor(s), base, polish);
  });
}

/** The shots whose passage is to be read before the render (index, in, out): those graded and not read there yet. */
export function tonePassages(plan: TonePlan): { index: number; in: number; out: number }[] {
  if (colourMode(plan) === "off") return [];
  return plan.segments.flatMap((s, index) => (isShot(s) && !s.keep_colour && !toneFor(s) ? [{ index, in: s.in, out: s.out }] : []));
}

/** The plan with what was read on its shots kept on them (`tone`). */
export function withTones<P extends TonePlan>(plan: P, read: Record<number, Omit<ShotTone, "at"> | null>): P {
  return {
    ...plan,
    segments: plan.segments.map((s, i) => {
      const t = read[i];
      if (!t || !isShot(s)) return s;
      const tone = shotToneSchema.safeParse({ ...t, at: [s.in, s.out] });
      return tone.success ? { ...s, tone: tone.data } : s;
    }),
  } as P;
}

/**
 * The part of a shot's picture the Reel shows (shares x, y, w, h of its file), where its light is read: a wider shot is
 * cropped to the frame around its subject (its focus), as the render covers the frame with it.
 */
export function toneCrop(aspect: number | undefined, focus: { x: number; y: number } | undefined, frameAspect = 9 / 16): [number, number, number, number] {
  if (!aspect || !(aspect > 0)) return [0, 0, 1, 1];
  const r = (v: number) => Math.round(v * 10000) / 10000;
  if (aspect > frameAspect) {
    const w = frameAspect / aspect;
    return [r(clamp((focus?.x ?? 0.5) - w / 2, 0, 1 - w)), 0, r(w), 1];
  }
  const h = aspect / frameAspect;
  return [0, r(clamp((focus?.y ?? 0.5) - h / 2, 0, 1 - h)), 1, r(h)];
}

/** Her retouch as the render applies it under a grade: as filmed, none of its colours; measured, its light and warmth are the measure's. */
export function toneAdjust(adjust: Adjust | undefined, grade: ShotGrade | "as_filmed" | null, measured: boolean): Adjust | undefined {
  if (!adjust) return undefined;
  const { exposure, contrast, saturation, warmth, ...frame } = adjust;
  const kept: Adjust = grade === "as_filmed" ? frame : measured ? { ...frame, ...(contrast ? { contrast } : {}), ...(saturation ? { saturation } : {}) } : adjust;
  void exposure;
  void warmth;
  return Object.keys(kept).length ? kept : undefined;
}

/** A photo's retouch under its grade (as toneAdjust). */
export function tonePhotoEdit(edit: PhotoEdit | undefined, grade: ShotGrade | "as_filmed" | null, measured: boolean): PhotoEdit | undefined {
  if (!edit) return undefined;
  const adjust = toneAdjust(edit.adjust, grade, measured);
  const { adjust: _old, ...rest } = edit;
  return adjust ? { ...rest, adjust } : rest;
}
