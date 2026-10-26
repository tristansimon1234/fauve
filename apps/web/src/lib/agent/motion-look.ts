import "server-only";
import { buildReelProps, canvasMoments, editPlanSchema, isMotionSegment, motionSlotSchema, motionTemplateSchema, propsAt, type EditPlan, type ReelProps } from "@fauve/agent";
import { z } from "zod";
import { checkReelAnimations, loadMontageInputs, subtitleRowAmongAnimations } from "@/lib/render/render-post";
import { reelFramesInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { lookAtScenes, type MotionKit, type SceneBrand, type SceneContext, type SceneLooks, type SceneRequest, type SceneResult } from "./motion-designer";
import { OVERLAY_ROLE, saveTemplates } from "./motion-templates";

// The motion designer looks at its render before it goes out, in its own step of the montage (after the design,
// before the render, with its own time): the design leaves what it gave the motion designer for each animation it
// wrote, and for each library scene new to this Reel; the look renders those animations over her footage in the Reel
// as it will come out (her texts, her subtitles, the shots under them) at a few instants, and what the motion designer
// reworks takes their place in the plan and in the studio's library (a library scene rewritten becomes a new one).
// Tristan: « je trouve les animations sous quali », and of library scenes, « que si l'animation est très pertinente
// pour le brief + est bien faite ».

/** What the design leaves for the look: the animations just written, when to look at each, and what their designer was given. */
export type PendingLook = {
  ids: string[];
  /** Those taken from the library (written for another Reel): rewritten, they become a new scene of it. */
  library?: string[];
  /** The instants each one is looked at, on the Reel's clock. */
  moments: Record<string, { t: number; label: string }[]>;
  /** What the motion designer was given for each (a correction's earlier frames aside). */
  requests: Omit<SceneRequest, "seen">[];
  /** What it said of each: its name, its slots, its intention (the plan keeps only its code). */
  written: Record<string, { name?: string; slots?: z.infer<typeof motionSlotSchema>[]; notes?: string }>;
  direction?: string;
  brand: SceneBrand;
  kit: MotionKit;
  context: Omit<SceneContext, "rendered" | "show">;
};

/** A request as the look keeps it: without the images its first draft saw (a correction's earlier frames, the Reel), in its own call only. */
export function forLook(request: SceneRequest): Omit<SceneRequest, "seen"> {
  const kept = { ...request };
  delete kept.seen;
  delete kept.canvas;
  return kept;
}

/** Read back as it was written (our own file): only its shape is checked. */
const pendingLookSchema = z.object({
  ids: z.array(z.string()),
  library: z.array(z.string()).optional(),
  moments: z.record(z.string(), z.array(z.object({ t: z.number(), label: z.string() }))),
  requests: z.array(z.object({ id: z.string(), brief: z.string(), durationInFrames: z.number() }).loose()),
  written: z.record(z.string(), z.object({ name: z.string().optional(), slots: z.array(motionSlotSchema).optional(), notes: z.string().optional() })),
  direction: z.string().optional(),
  brand: z.object({ name: z.string() }).loose(),
  kit: z.array(z.object({ name: z.string(), code: z.string() })),
  context: z.object({}).loose(),
});

const lookPath = (studioId: string, planId: string) => `${studioId}/looks/${planId}.json`;

/** Kept until the look is done (the next step reads it); its path. */
export async function saveLook(studioId: string, planId: string, look: PendingLook): Promise<string> {
  const path = lookPath(studioId, planId);
  const { error } = await supabaseAdmin()
    .storage.from("media")
    .upload(path, new Blob([JSON.stringify(look)], { type: "application/json" }), { contentType: "application/json", upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** Each animation of the plan by the motion designer's id: s<i> a scene (its index), l<i> a layer (found by its brief: failed ones were left out). */
function motionOf(plan: EditPlan, id: string, brief: string) {
  if (id.startsWith("s")) {
    const s = plan.segments[Number(id.slice(1))];
    return s && isMotionSegment(s) && s.motion.brief === brief ? s.motion : undefined;
  }
  return plan.layers?.find((l) => l.motion.brief === brief)?.motion;
}

/** The Reel's props as the render builds them (its template, or another one), with what they were built from. */
async function reelProps(studioId: string, postId: string, plan: EditPlan, template = motionTemplateSchema.catch("libre").parse(plan.template)) {
  const inputs = await loadMontageInputs(studioId, plan, { postId });
  const props = buildReelProps(plan, {
    template,
    clipUrls: inputs.clipUrls,
    photoIds: inputs.photoIds,
    words: inputs.words,
    aspects: inputs.aspects,
    brand: { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, logoOnDark: inputs.logoOnDark, fonts: inputs.fonts, colors: inputs.colors, customFonts: inputs.customFonts, signature: inputs.reelSignature },
    ...(inputs.voice ? { voice: inputs.voice } : {}),
    ...(inputs.cutouts ? { cutouts: inputs.cutouts } : {}),
    ...(inputs.sceneCutouts ? { sceneCutouts: inputs.sceneCutouts } : {}),
    photoAspects: inputs.photoAspects,
    ...(Object.keys(inputs.tracks).length ? { tracks: inputs.tracks } : {}),
  });
  return { inputs, props };
}

/**
 * The Reel as the render will show it, a voice's subtitles on the row the render gives them once its animations are
 * drawn: seen on the row the design had set, they fell on its cards, and two good animations in three were sent back
 * and rewritten for what the render corrects by itself (it moves the subtitles where the animations leave room).
 */
async function reelAsRendered(studioId: string, postId: string, plan: EditPlan): Promise<ReelProps> {
  const { inputs, props } = await reelProps(studioId, postId, plan);
  const row = await subtitleRowAmongAnimations(studioId, plan, props, await checkReelAnimations(props), inputs).catch((error: unknown) => {
    console.warn("motion look: subtitles' row not weighed, seen where the design set them", error);
    return undefined;
  });
  return row === undefined ? props : { ...props, subtitleY: row };
}

/** Frames of the plan's animations as the Reel will show them: each at its instants, half size. */
async function framesOf(props: ReelProps, postId: string, moments: PendingLook["moments"]): Promise<SceneLooks> {
  const frames = [...new Set(Object.values(moments).flatMap((list) => list.map((m) => Math.round(m.t * 30))))].sort((a, b) => a - b);
  if (!frames.length) return new Map();
  const images = await reelFramesInSandbox(`look-${postId.slice(0, 8)}-${Date.now()}`, propsAt(props, frames), frames);
  return new Map(
    Object.entries(moments).map(([id, list]) => [
      id,
      list.flatMap((m) => {
        const image = images[Math.round(m.t * 30)];
        return image instanceof Buffer ? [{ label: m.label, jpeg: image }] : [];
      }),
    ]),
  );
}

/** An animation that draws nothing: the footage under it shows as it will. */
const BLANK_SCENE = "function Scene() { return null; }";
/** The share of its size the Reel is shown at before writing (432 × 768: an image costs about 450 tokens). */
const CANVAS_SCALE = 0.4;

/**
 * Before the motion designer writes, the Reel as it will come out without the animations it is about to write
 * (Tristan: « il devrait voir la vidéo complètement »): her shots and the footage under each animation, the Reel's
 * texts and a voice's subtitles on their row. Written blind, a florist's chat card hid her smile and another set its
 * last bubble where the subtitles went. `plan` has the code of the animations it keeps; those without code are the ones
 * being written (`requests`), drawn as nothing. A composition being written sees her shots full frame, one after the
 * other (it lays them itself). Each first draft (a correction's rewrite sees its earlier render instead) gets its images
 * in `canvas`; when anything fails, it is written blind, as before.
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
  const { props } = await reelProps(studioId, postId, blank, composing ? "libre" : undefined);
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

/** What the design left for a look nobody will take (its montage replaced, or done). */
export async function dropLook(path: string): Promise<void> {
  await supabaseAdmin()
    .storage.from("media")
    .remove([path])
    .catch(() => undefined);
}

/**
 * The look of a montage's new animations: rendered over her footage, looked at by the motion designer, the ones it
 * reworks (and that pass their check) put in the plan, which keeps its version (nothing was rendered of it yet),
 * and in the library. The number reworked; the plan stays as it was when anything fails.
 */
export async function lookAtAnimations(studioId: string, postId: string, planId: string, path: string): Promise<number> {
  try {
    return await reworkFromLook(studioId, postId, planId, path);
  } finally {
    await dropLook(path);
  }
}

async function reworkFromLook(studioId: string, postId: string, planId: string, path: string): Promise<number> {
  const db = supabaseAdmin();
  const file = await db.storage.from("media").download(path);
  if (!file.data) throw new Error(`look: ${file.error?.message ?? "file missing"}`);
  const look = pendingLookSchema.parse(JSON.parse(await file.data.text())) as unknown as PendingLook;
  const row = await db.from("edit_plans").select("plan").eq("id", planId).eq("post_id", postId).single();
  if (row.error) throw new Error(row.error.message);
  const plan = editPlanSchema.parse(row.data.plan);
  const requests = look.requests as SceneRequest[];
  const results: SceneResult[] = look.ids.flatMap((id) => {
    const request = requests.find((r) => r.id === id);
    const motion = request ? motionOf(plan, id, request.brief) : undefined;
    if (!motion?.js || !motion.code) return [];
    const said = look.written[id] ?? {};
    return [{ id, code: motion.code, js: motion.js, error: null, ...said, photos: motion.photos, fonts: motion.fonts, ...(motion.subtitle_y !== undefined ? { subtitleY: motion.subtitle_y } : {}) }];
  });
  if (!results.length) return 0;
  const reel = await reelAsRendered(studioId, postId, plan);
  // A rewrite keeps its words off the subtitles where they will really be.
  const asked = requests.map((r) => (r.subtitles && reel.subtitleY !== undefined ? { ...r, subtitles: { ...r.subtitles, y: reel.subtitleY } } : r));
  const reworked = await lookAtScenes(studioId, asked, results, look.direction, look.brand, look.kit, {
    ...look.context,
    rendered: (written) => framesOf(reel, postId, Object.fromEntries(written.flatMap((w) => (look.moments[w.id] ? [[w.id, look.moments[w.id]!]] : [])))),
  });
  if (reworked.length) {
    const briefOf = (id: string) => requests.find((r) => r.id === id)?.brief;
    // A library scene rewritten for this Reel becomes a new scene of the library: the one it replaces stays as it was
    // (it may serve another Reel, where it fits).
    const library = new Set(look.library ?? []);
    const fromLibrary = reworked.filter((r) => library.has(r.id));
    const savedIds = await saveTemplates(
      studioId,
      fromLibrary.map((r) => ({
        name: r.name ?? "",
        description: briefOf(r.id) ?? "",
        slots: r.slots ?? [],
        code: r.code!,
        js: r.js!,
        fonts: r.fonts ?? [],
        durationSeconds: (requests.find((q) => q.id === r.id)?.durationInFrames ?? 60) / 30,
        role: OVERLAY_ROLE,
      })),
    );
    const newScene = new Map(fromLibrary.map((r, i) => [r.id, savedIds[i] ?? undefined] as const));
    // Its own code, photos and fonts; the words it carries (a library scene's texts were for the code it replaces).
    const own = (id: string) => {
      const r = reworked.find((x) => x.id === id)!;
      return {
        code: r.code ?? undefined,
        js: r.js!,
        texts: undefined,
        ...(r.photos?.length ? { photos: r.photos } : {}),
        ...(r.fonts?.length ? { fonts: r.fonts } : {}),
        ...(library.has(id) ? { template_id: newScene.get(id) } : {}),
      };
    };
    const next: EditPlan = {
      ...plan,
      segments: plan.segments.map((s, i) => {
        const id = `s${i}`;
        if (!isMotionSegment(s) || !reworked.some((r) => r.id === id) || s.motion.brief !== briefOf(id)) return s;
        return { ...s, motion: { ...s.motion, photos: undefined, fonts: undefined, ...own(id) } };
      }),
      ...(plan.layers
        ? {
            layers: plan.layers.map((l) => {
              const r = reworked.find((x) => x.id.startsWith("l") && briefOf(x.id) === l.motion.brief);
              if (!r) return l;
              return { ...l, motion: { ...l.motion, photos: undefined, fonts: undefined, ...own(r.id), ...(l.compose && r.subtitleY !== undefined ? { subtitle_y: r.subtitleY } : {}) } };
            }),
          }
        : {}),
    };
    const saved = await db.from("edit_plans").update({ plan: editPlanSchema.parse(next) }).eq("id", planId);
    if (saved.error) throw new Error(saved.error.message);
    // The library keeps a new animation's reworked code under the same scene (a next Reel may reuse it).
    for (const r of reworked) {
      if (library.has(r.id)) continue;
      const templateId = motionOf(next, r.id, briefOf(r.id) ?? "")?.template_id;
      if (!templateId) continue;
      const { error } = await db
        .from("motion_templates")
        .update({ code: r.code, js: r.js, fonts: r.fonts ?? [], ...(r.slots?.length ? { slots: r.slots } : {}), ...(r.name ? { name: r.name.slice(0, 80) } : {}) })
        .eq("id", templateId)
        .eq("studio_id", studioId);
      if (error) console.warn("motion look: library scene not updated", templateId, error.message);
    }
  }
  return reworked.length;
}
