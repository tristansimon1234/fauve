import type { EditPlan } from "./schemas.ts";

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

/** Output timeline length: the sum of the kept segments. */
export function renderDuration(plan: EditPlan): number {
  return round(plan.segments.reduce((sum, s) => sum + (s.out - s.in), 0));
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
  const left = Math.round(90 * k);
  const right = Math.round(170 * k);
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
  for (const t of plan.texts) {
    if (t.from >= total) continue;
    lines.push(`Dialogue: 0,${assTime(t.from)},${assTime(Math.min(t.to, total))},${t.style},,0,0,0,,${assText(t.text)}`);
  }
  return `${lines.join("\n")}\n`;
}

/** ffmpeg arguments: trim and frame each segment, butt-cut them, burn the texts, add a silent track. */
export function buildFfmpegArgs(plan: EditPlan, options: RenderOptions): string[] {
  const { w, h } = SIZES[plan.format];
  const total = renderDuration(plan);
  const ass = options.assFile ?? "texts.ass";
  const fonts = options.fontsDir ?? "fonts";
  const output = options.output ?? "out.mp4";

  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  plan.segments.forEach((s) => {
    const file = options.clipFiles[s.clip_id];
    if (!file) throw new Error(`No file for clip ${s.clip_id}`);
    args.push("-ss", String(round(s.in)), "-t", String(round(s.out - s.in)), "-i", file);
  });
  const audioInput = plan.segments.length;
  args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=48000:cl=stereo");

  const filters = plan.segments.map((s, i) => {
    // "light" zoom: a steady 8 % punch-in, enough to feel intentional without blur.
    const z = s.zoom === "light" ? 1.08 : 1;
    return (
      `[${i}:v]scale=${even(w * z)}:${even(h * z)}:force_original_aspect_ratio=increase,` +
      `crop=${w}:${h},setsar=1,fps=${FPS},format=yuv420p,setpts=PTS-STARTPTS[v${i}]`
    );
  });
  const inputs = plan.segments.map((_, i) => `[v${i}]`).join("");
  filters.push(`${inputs}concat=n=${plan.segments.length}:v=1:a=0[vc]`);
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
