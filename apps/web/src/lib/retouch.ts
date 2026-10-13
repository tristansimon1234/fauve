import "server-only";
import {
  alignSlides,
  clipBlurFrom,
  editPlanSchema,
  isClipSegment,
  photoEditFrom,
  slidesPlanSchema,
  type RegionKind,
} from "@fauve/agent";
import { saveSlides } from "@/lib/render/slides";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clipRegions, photoRegions } from "@/lib/video/regions";

// Retouch and blur on a post: Gemini reads each photo or clip once (cached),
// the edit goes on the slides (photos) or on the montage's clips (a new plan
// version), and the caller renders. The original files are never changed.

export type PhotoOptions = { photos?: number[]; light: boolean; blur: RegionKind[]; onlyRecognizable: boolean };

export type RetouchSummary = { photos: { photo: number; blurred: number; faces: number; note: string }[]; skipped: string[] };

/** Retouches and/or blurs the photos of a carousel or photo post (all of them, or the numbers given). */
export async function retouchPostPhotos(studioId: string, postId: string, options: PhotoOptions): Promise<RetouchSummary> {
  const db = supabaseAdmin();
  const { data: post, error } = await db.from("posts").select("kind, status, media_ids, slides").eq("id", postId).eq("studio_id", studioId).single();
  if (error) throw new Error(error.message);
  if (post.kind !== "carousel" && post.kind !== "post") throw new Error("La retouche photo est pour un carrousel ou un post photo ; pour un Reel, le flou se fait sur le montage (blur_video)");
  if (post.status === "published" || post.status === "measured") throw new Error("Cette publication est déjà en ligne");
  const mediaIds = ((post.media_ids as string[] | null) ?? []).slice(0, 10);
  if (!mediaIds.length) throw new Error("Cette publication n'a pas encore de photos");
  const { data: assets } = await db.from("media_assets").select("id, kind").eq("studio_id", studioId).in("id", mediaIds);
  const kinds = new Map((assets ?? []).map((a) => [a.id as string, a.kind as string]));

  const current = slidesPlanSchema.safeParse(post.slides);
  const plan = alignSlides(current.success ? current.data : { template: "doux", slides: [] }, mediaIds);
  const summary: RetouchSummary = { photos: [], skipped: [] };
  const slides = await Promise.all(
    plan.slides.map(async (slide, i) => {
      const n = i + 1;
      if (options.photos?.length && !options.photos.includes(n)) return slide;
      if (kinds.get(slide.media_id) !== "image") {
        summary.skipped.push(`photo ${n} : c'est une vidéo (le flou d'une vidéo se fait dans un montage)`);
        return slide;
      }
      if (!options.light && !options.blur.length) {
        summary.photos.push({ photo: n, blurred: 0, faces: 0, note: "retouche retirée" });
        return { ...slide, edit: undefined };
      }
      try {
        const regions = await photoRegions(studioId, slide.media_id);
        const edit = photoEditFrom(regions.detection, { width: regions.width, height: regions.height }, {
          retouch: options.light,
          blur: options.blur,
          onlyRecognizable: options.onlyRecognizable,
        });
        summary.photos.push({
          photo: n,
          blurred: edit.blur?.length ?? 0,
          faces: regions.detection.regions.filter((r) => r.kind === "face").length,
          note: regions.detection.notes,
        });
        return { ...slide, edit };
      } catch (e) {
        summary.skipped.push(`photo ${n} : ${e instanceof Error ? e.message : "lecture impossible"}`);
        return slide;
      }
    }),
  );
  await saveSlides(studioId, postId, { ...plan, slides });
  return summary;
}

/** Blurs zones (faces by default) over every clip of the post's montage: a new plan version; the caller renders. */
export async function blurMontage(studioId: string, postId: string, kinds: RegionKind[]): Promise<{ clips: number; tracks: number; skipped: string[] }> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("status, edit_plan_id").eq("id", postId).eq("studio_id", studioId).single();
  if (!post) throw new Error("Publication introuvable");
  if (post.status === "published" || post.status === "measured") throw new Error("Cette publication est déjà en ligne");
  const base = db.from("edit_plans").select("id, plan").eq("post_id", postId);
  const { data: row } = post.edit_plan_id
    ? await base.eq("id", post.edit_plan_id).maybeSingle()
    : await base.order("version", { ascending: false }).limit(1).maybeSingle();
  const plan = editPlanSchema.safeParse(row?.plan);
  if (!plan.success) throw new Error("Cette publication n'a pas encore de montage");

  const clipIds = [...new Set(plan.data.segments.filter(isClipSegment).map((s) => s.clip_id))];
  const skipped: string[] = [];
  const blurs = new Map(
    await Promise.all(
      clipIds.map(async (id) => {
        if (!kinds.length) return [id, null] as const;
        try {
          const regions = await clipRegions(studioId, id);
          return [id, clipBlurFrom(regions.detection, regions.aspect, kinds)] as const;
        } catch (e) {
          skipped.push(e instanceof Error ? e.message : "vidéo illisible");
          return [id, null] as const;
        }
      }),
    ),
  );
  let tracks = 0;
  const segments = plan.data.segments.map((s) => {
    if (!isClipSegment(s)) return s;
    const blur = blurs.get(s.clip_id);
    if (!blur) return { ...s, blur: undefined };
    tracks += blur.tracks.length;
    return { ...s, blur };
  });
  const next = editPlanSchema.parse({ ...plan.data, segments });
  const { data: versions } = await db.from("edit_plans").select("version").eq("post_id", postId);
  const version = Math.max(0, ...(versions ?? []).map((v) => v.version as number)) + 1;
  const { data: inserted, error } = await db.from("edit_plans").insert({ studio_id: studioId, post_id: postId, version, plan: next }).select("id").single();
  if (error) throw new Error(error.message);
  await db.from("posts").update({ edit_plan_id: inserted.id }).eq("id", postId);
  return { clips: clipIds.length, tracks, skipped };
}
