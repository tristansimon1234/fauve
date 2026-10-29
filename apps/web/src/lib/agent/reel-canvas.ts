import "server-only";
import { buildReelProps, canvasMoments, dayIn, isMotionSegment, motionTemplateSchema, propsAt, type EditPlan } from "@fauve/agent";
import { loadMontageInputs } from "@/lib/render/render-post";
import { reelFramesInSandbox } from "@/lib/render/sandbox";
import type { SceneRequest } from "./motion-designer";

// The motion designer sees the Reel before it writes an animation for it (Tristan: « il devrait voir la vidéo
// complètement »): her shots, the footage under each animation, the Reel's texts and a voice's subtitles, as the Reel
// will come out without the animations being written.

/** The Reel's props as the render builds them (its template, or another one). */
async function reelProps(studioId: string, postId: string, plan: EditPlan, template = motionTemplateSchema.catch("libre").parse(plan.template)) {
  const inputs = await loadMontageInputs(studioId, plan, { postId });
  return buildReelProps(plan, {
    template,
    clipUrls: inputs.clipUrls,
    photoIds: inputs.photoIds,
    words: inputs.words,
    aspects: inputs.aspects,
    brand: { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, logoOnDark: inputs.logoOnDark, fonts: inputs.fonts, colors: inputs.colors, customFonts: inputs.customFonts, signature: inputs.reelSignature },
    ...(inputs.voice ? { voice: inputs.voice } : {}),
    ...(inputs.cutouts ? { cutouts: inputs.cutouts } : {}),
    ...(inputs.sceneCutouts ? { sceneCutouts: inputs.sceneCutouts } : {}),
    ...(inputs.depth ? { depth: inputs.depth } : {}),
    today: dayIn(),
    photoAspects: inputs.photoAspects,
    ...(Object.keys(inputs.tracks).length ? { tracks: inputs.tracks } : {}),
  });
}

/** An animation that draws nothing: the footage under it shows as it will. */
const BLANK_SCENE = "function Scene() { return null; }";
/** The share of its size the Reel is shown at before writing (432 × 768: an image costs about 450 tokens). */
const CANVAS_SCALE = 0.4;

/**
 * Before the motion designer writes, the Reel as it will come out without the animations it is about to write: her
 * shots and the footage under each animation, the Reel's texts and a voice's subtitles on their row. Written blind, a
 * florist's chat card hid her smile and another set its last bubble where the subtitles went. `plan` has the code of
 * the animations it keeps; those without code are the ones being written (`requests`), drawn as nothing. A composition
 * being written sees her shots full frame, one after the other (it lays them itself). Each first draft (a correction's
 * rewrite sees its earlier render instead) gets its images in `canvas`; when anything fails, it is written blind.
 */
export async function showReel(studioId: string, postId: string, plan: EditPlan, requests: SceneRequest[]): Promise<void> {
  const writing = requests.filter((r) => !r.seen && !r.canvas);
  if (!writing.length) return;
  const started = Date.now();
  // A scene being written draws nothing over its footage (an animation over several shots without code is not drawn at all).
  const blank: EditPlan = {
    ...plan,
    segments: plan.segments.map((s) => (isMotionSegment(s) && !s.motion.js ? { ...s, motion: { ...s.motion, js: BLANK_SCENE } } : s)),
  };
  const composing = (plan.layers ?? []).some((l) => l.compose && !l.motion.js);
  const props = await reelProps(studioId, postId, blank, composing ? "libre" : undefined);
  // Each first draft's images; the moment of another animation being written says so.
  const moments = canvasMoments(plan, requests.map((r) => r.id));
  const frames = [...new Set(writing.flatMap((r) => (moments.get(r.id) ?? []).map((m) => Math.round(m.t * 30))))].sort((a, b) => a - b);
  if (!frames.length) return;
  const images = await reelFramesInSandbox(`canvas-${postId.slice(0, 8)}-${Date.now()}`, propsAt(props, frames), frames, CANVAS_SCALE);
  for (const request of writing) {
    const shown = (moments.get(request.id) ?? []).flatMap((m) => {
      const image = images[Math.round(m.t * 30)];
      return image instanceof Buffer ? [{ label: m.label, jpeg: image }] : [];
    });
    if (shown.length) request.canvas = shown;
  }
  console.log("motion: the Reel shown before writing", postId, `${frames.length} images in ${Math.round((Date.now() - started) / 1000)} s`);
}
