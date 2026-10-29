import { isClipSegment, segmentSeconds, type ClipSegment, type EditPlan } from "./schemas.ts";

// Edit plan → ffmpeg command. The model decides (the plan), this file executes:
// deterministic, testable, no model in the loop. Texts are drawn with libass
// (ASS subtitles), which gives real typography, wrapping and safe-zone margins.

export const RENDER_FONTS = {
  "InstrumentSerif-Italic.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/InstrumentSerif-Italic.ttf",
  "Poppins-Bold.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf",
  "Poppins-ExtraBold.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-ExtraBold.ttf",
} as const;

const SIZES: Record<EditPlan["format"], { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
};

const FPS = 30;
const DEFAULT_ACCENT = "#5B3FD9"; // Fauve violet, when the studio has no brand colour yet

export type RenderOptions = {
  /** Local file name of each clip, by clip_id (media_assets id). */
  clipFiles: Record<string, string>;
  /** Studio's main brand colour (#rrggbb) for the text band. */
  accent?: string;
  assFile?: string;
  fontsDir?: string;
  output?: string;
};

const round = (n: number) => Math.round(n * 1000) / 1000;
const even = (n: number) => Math.round(n / 2) * 2;

export const FADE = 0.35; // crossfade length (transitions: "fade")
const KEN_BURNS = 0.08; // slow push-in over a segment: 100 % → 108 %

const segmentLength = (s: EditPlan["segments"][number]) => round(segmentSeconds(s));

/** Crossfades need every segment to outlast the fade; otherwise the plan falls back to cuts. */
export function usesFades(plan: Pick<EditPlan, "segments" | "transitions">): boolean {
  return plan.transitions === "fade" && plan.segments.length > 1 && plan.segments.every((s) => segmentLength(s) > FADE + 0.15);
}

/** Output timeline length: the kept segments, minus the overlaps of crossfades. */
export function renderDuration(plan: EditPlan): number {
  const sum = plan.segments.reduce((total, s) => total + segmentLength(s), 0);
  return round(usesFades(plan) ? sum - FADE * (plan.segments.length - 1) : sum);
}

/** "#5B3FD9" → ASS colour "&H00D93F5B" (alpha, blue, green, red). */
function assColour(hex: string, alpha = 0): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) ?? /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(DEFAULT_ACCENT)!;
  const [, r, g, b] = m;
  return `&H${alpha.toString(16).padStart(2, "0")}${b}${g}${r}`.toUpperCase();
}

function assTime(seconds: number): string {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

/** Plain text for an ASS dialogue line: no override blocks, explicit line breaks. */
function assText(text: string): string {
  return text.replace(/\\/g, "/").replace(/[{}]/g, "").replace(/\r?\n/g, "\\N").trim();
}

/**
 * Subtitle file with Fauve's three text styles. Safe zones: nothing in the bottom
 * quarter or against the right edge, where Instagram and TikTok put their buttons.
 */
export function buildAss(plan: EditPlan, accent = DEFAULT_ACCENT): string {
  const { w, h } = SIZES[plan.format];
  const total = renderDuration(plan);
  const k = w / 1080; // sizes below are designed for a 1080-wide frame
  // Symmetric, so centred texts sit on the centre line (140 px clears Instagram's buttons).
  const left = Math.round(140 * k);
  const right = Math.round(140 * k);
  const style = (name: string, font: string, size: number, rest: string) =>
    `Style: ${name},${font},${Math.round(size * k)},${rest}`;

  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${w}`,
    `PlayResY: ${h}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Hook: big serif italic, top third.
    style("hook", "Instrument Serif", 124, `&H00FFFFFF,&H00FFFFFF,&H64000000,&H96000000,0,1,0,0,100,100,0,0,1,2,5,8,${left},${right},${Math.round(h * 0.16)},1`),
    // Band: bold text on a solid block in the brand colour.
    style("band", "Poppins ExtraBold", 76, `&H00FFFFFF,&H00FFFFFF,${assColour(accent)},${assColour(accent)},0,0,0,0,100,100,0,0,3,18,0,8,${left},${right},${Math.round(h * 0.34)},1`),
    // Caption: readable bold with an outline, kept above the bottom quarter.
    style("caption", "Poppins Bold", 66, `&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,4,2,2,${left},${right},${Math.round(h * 0.27)},1`),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  // Texts ease in and out; the hook also "pops" from 88 % to full size.
  const motion: Record<EditPlan["texts"][number]["style"], string> = {
    hook: "{\\fad(180,180)\\fscx88\\fscy88\\t(0,260,\\fscx100\\fscy100)}",
    band: "{\\fad(150,150)}",
    caption: "{\\fad(150,150)}",
  };
  for (const t of plan.texts) {
    if (t.from >= total) continue;
    const text = `${motion[t.style]}${assText(t.text)}`;
    lines.push(`Dialogue: 0,${assTime(t.from)},${assTime(Math.min(t.to, total))},${t.style},,0,0,0,,${text}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * ffmpeg arguments: trim and frame each segment (optional slow push-in), join them
 * with cuts or crossfades, burn the animated texts, add a silent track.
 */
export function buildFfmpegArgs(plan: EditPlan, options: RenderOptions): string[] {
  if (!plan.segments.every(isClipSegment)) throw new Error("The ffmpeg engine renders clips only: remove scenes first (withoutScenes)");
  const clips = plan.segments as ClipSegment[];
  const { w, h } = SIZES[plan.format];
  const total = renderDuration(plan);
  const ass = options.assFile ?? "texts.ass";
  const fonts = options.fontsDir ?? "fonts";
  const output = options.output ?? "out.mp4";

  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  clips.forEach((s) => {
    const file = options.clipFiles[s.clip_id];
    if (!file) throw new Error(`No file for clip ${s.clip_id}`);
    args.push("-ss", String(round(s.in)), "-t", String(round(s.out - s.in)), "-i", file);
  });
  const audioInput = plan.segments.length;
  args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=48000:cl=stereo");

  const kenBurns = (s: ClipSegment) => s.zoom === "light" || plan.transitions === "light_zoom";
  const filters = clips.map((s, i) => {
    // A shot at another speed: its frames are spread (slow motion) or packed (faster); a ramp, at its average speed.
    const rate = s.ramp ? round((s.out - s.in) / segmentSeconds(s)) : s.speed;
    const speed = rate && rate !== 1 ? `setpts=(PTS-STARTPTS)/${rate},` : "";
    const frame = `[${i}:v]${speed}scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=${FPS},setpts=PTS-STARTPTS`;
    // fps again at the end: xfade needs a constant frame rate, which per-frame scaling drops.
    // Slow push-in (Ken Burns): the frame grows a little every frame, the centre stays put.
    const zoom = kenBurns(s)
      ? `,scale=w='trunc(${w}*(1+${KEN_BURNS}*t/${segmentLength(s)})/2)*2':h=-2:eval=frame,crop=${w}:${h}`
      : "";
    return `${frame}${zoom},fps=${FPS},format=yuv420p,setsar=1,settb=AVTB[v${i}]`;
  });
  if (usesFades(plan)) {
    // Chain of crossfades: each one starts FADE before the end of what came before.
    let previous = "v0";
    let offset = 0;
    plan.segments.slice(1).forEach((_, k) => {
      offset = round(offset + segmentLength(plan.segments[k]!) - FADE);
      const out = k === plan.segments.length - 2 ? "vc" : `x${k + 1}`;
      filters.push(`[${previous}][v${k + 1}]xfade=transition=fade:duration=${FADE}:offset=${offset}[${out}]`);
      previous = out;
    });
  } else {
    const inputs = plan.segments.map((_, i) => `[v${i}]`).join("");
    filters.push(`${inputs}concat=n=${plan.segments.length}:v=1:a=0[vc]`);
  }
  filters.push(plan.texts.length ? `[vc]ass=filename=${ass}:fontsdir=${fonts}[vout]` : "[vc]null[vout]");

  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[vout]",
    "-map", `${audioInput}:a`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-maxrate", "8M", "-bufsize", "16M",
    "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "128k",
    "-t", String(total), "-movflags", "+faststart",
    output,
  );
  return args;
}
