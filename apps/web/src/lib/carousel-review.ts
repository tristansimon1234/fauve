import "server-only";
import {
  alignSlides,
  captionForInstagram,
  postStatusSchema,
  publishWhen,
  type CarouselDesign,
  type CarouselPhoto,
  type MotionTemplate,
  type PostStatus,
  type PublishWhen,
  type ReelInputs,
  type SlidesPlan,
} from "@fauve/agent";
import { carouselPhotos } from "@/lib/render/carousel";
import { loadMontageInputs } from "@/lib/render/render-post";
import { hasTexts, postSlides, rendersPlan, slideWritten, type SlidesRender } from "@/lib/render/slides";
import { instagramHandle, reviewSlots, type ReviewSlot } from "@/lib/review";
import { instagramAccount } from "@/lib/social/publish";
import { signMediaUrls, type Db } from "@/lib/studio";
import { runningJobs } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A carousel or a photo post opened from WhatsApp (/v/{id}): what its phone page needs. Its
// slides as they will be published (the final images when they are its plan's, else drawn live
// by the code that renders them), its caption, when Edith reminds her to post it, its images to
// save, and what she changes herself: the words of a carousel Edith composed, or her texts on a photo.

export type CarouselSlide = { url: string; video: boolean };

export type CarouselReviewData = {
  postId: string;
  title: string;
  kind: "carousel" | "post";
  status: PostStatus;
  /** Online already: nothing can change. */
  locked: boolean;
  /** How many slides it has. */
  count: number;
  /** Each slide as it will be published, or null where it is drawn live (its final image is not made yet). */
  slides: (CarouselSlide | null)[];
  /** A carousel Edith composed: its code, its photos as the render lays them, its words to change on the image. */
  design: { design: CarouselDesign; template: MotionTemplate; photos: CarouselPhoto[] } | null;
  /** Her texts on the photos (not composed): the plan and the photos by media id, to draw and edit. */
  plan: { plan: SlidesPlan; photos: Record<string, string> } | null;
  /** The photo or video of each slide (not composed), by media id. */
  mediaIds: string[];
  brand: ReelInputs["brand"];
  /** The final images to save on her phone, under the post's name; empty while one is still being made. */
  downloads: { url: string; name: string }[];
  /** Its final images are being made again (her words changed): the page follows them. */
  updating: boolean;
  /** Edith composing it (or a correction of it). */
  making: { step: string; minutes: number } | null;
  caption: string;
  /** The caption as Instagram shows it (cleaned, at most 5 hashtags). */
  captionShown: string;
  handle: string | null;
  instagram: boolean;
  platforms: string[];
  scheduledAt: string | null;
  when: PublishWhen | null;
  upcoming: boolean;
  slots: ReviewSlot[];
  timezone: string;
};

type CarouselPost = {
  id: string;
  title: string;
  kind: "carousel" | "post";
  status: string;
  caption: string | null;
  hashtags: string[];
  scheduled_at: string | null;
  platforms: string[];
  media_ids: string[];
  slides: unknown;
  slides_render: unknown;
};

const fileBase = (title: string) => title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "carrousel";

export async function loadCarouselReview(db: Db, studioId: string, post: CarouselPost, timezone: string): Promise<CarouselReviewData> {
  const status = postStatusSchema.parse(post.status);
  const locked = status === "published" || status === "measured";
  const ids = post.media_ids;
  const { data: assets } = ids.length
    ? await db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", ids)
    : { data: [] as { id: string; storage_path: string; kind: string; mime_type: string | null }[] };
  const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
  const isVideo = (a: { kind: string; mime_type: string | null }) => a.kind === "video" || String(a.mime_type ?? "").startsWith("video/");

  const planned = postSlides({ slides: post.slides, media_ids: ids });
  const render = (post.slides_render ?? null) as SlidesRender | null;
  const current = Boolean(planned && render && rendersPlan(render.key, planned));
  const composed = planned?.design ?? null;
  // Each slide's file once its final image is there: a composed carousel's slides, or her photos
  // with their texts (a photo left as it is, or a video, goes out as it is).
  const shownIds = composed ? [] : ids.filter((id) => byId.has(id));
  const files: ({ path: string; video: boolean } | null)[] = composed
    ? Array.from({ length: composed.count }, (_, i) => (current && render?.paths[i] ? { path: render.paths[i]!, video: false } : null))
    : ids.flatMap((id, i) => {
        const a = byId.get(id);
        if (!a) return [];
        const slide = planned?.slides[i];
        const written = Boolean(slide && slideWritten(slide));
        const done = current ? render?.paths[i] : null;
        return [done ? { path: done, video: false } : written ? null : { path: a.storage_path as string, video: isVideo(a) }];
      });
  const signed = await signMediaUrls(db, studioId, files.flatMap((f) => (f ? [f.path] : [])));
  const slides = files.map((f) => (f && signed.get(f.path) ? { url: signed.get(f.path)!, video: f.video } : null));

  // What draws a slide live (and lets her change its words): the brand, then its code or her texts.
  const brand = await loadMontageInputs(studioId, { segments: [] }).then((i) => ({ name: i.studioName, accent: i.accent, logoUrl: i.logoUrl, logoOnDark: i.logoOnDark, fonts: i.fonts, colors: i.colors, customFonts: i.customFonts, signature: i.signature }));
  const design = composed
    ? {
        design: composed,
        template: planned!.template,
        photos: (await carouselPhotos(studioId, composed.photos, Object.fromEntries(planned!.slides.flatMap((s) => (s.edit?.blur?.length ? [[s.media_id, s.edit.blur]] : []))))).map((p) => p.photo),
      }
    : null;
  const photoUrls = composed ? new Map<string, string>() : await signMediaUrls(db, studioId, ids.flatMap((id) => (byId.get(id) && !isVideo(byId.get(id)!) ? [byId.get(id)!.storage_path as string] : [])));
  const photos = Object.fromEntries(ids.flatMap((id) => (byId.get(id) && photoUrls.get(byId.get(id)!.storage_path as string) ? [[id, photoUrls.get(byId.get(id)!.storage_path as string)!]] : [])));
  const plan = !composed && Object.keys(photos).length ? { plan: planned ?? alignSlides({ template: "doux", slides: [] }, ids), photos } : null;

  // Her images to save, once each one is final.
  const base = fileBase(post.title);
  const ready = files.length > 0 && files.every(Boolean);
  const downloads = ready
    ? (
        await Promise.all(
          files.map(async (f, i) => {
            const name = `${base}${files.length > 1 ? ` ${i + 1}` : ""}.${f!.video ? "mp4" : "jpg"}`;
            const { data } = await supabaseAdmin().storage.from("media").createSignedUrl(f!.path, 3600, { download: name });
            return data?.signedUrl ? [{ url: data.signedUrl, name }] : [];
          }),
        )
      ).flat()
    : [];
  const updating = !locked && Boolean(planned && hasTexts(planned) && !current && render?.pending && rendersPlan(render.pending, planned));

  const [jobs, account, handle, slots] = await Promise.all([
    locked ? Promise.resolve([]) : runningJobs(studioId, { postId: post.id, kind: "carousel" }),
    instagramAccount(studioId),
    instagramHandle(studioId),
    locked ? Promise.resolve([]) : reviewSlots(studioId, timezone),
  ]);
  const job = jobs[0];

  return {
    postId: post.id,
    title: post.title,
    kind: post.kind,
    status,
    locked,
    count: files.length,
    slides,
    design,
    plan,
    mediaIds: shownIds,
    brand,
    downloads: downloads.length === files.length ? downloads : [],
    updating,
    making: job ? { step: job.stage, minutes: Math.max(0, Math.round((Date.now() - new Date(job.startedAt).getTime()) / 60_000)) } : null,
    caption: post.caption ?? "",
    captionShown: captionForInstagram(post.caption, post.hashtags),
    handle,
    instagram: Boolean(account),
    platforms: post.platforms,
    scheduledAt: post.scheduled_at,
    when: post.scheduled_at ? publishWhen(post.scheduled_at, timezone) : null,
    upcoming: post.scheduled_at !== null && new Date(post.scheduled_at).getTime() > Date.now() + 60_000,
    slots,
    timezone,
  };
}
