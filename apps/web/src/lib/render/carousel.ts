import "server-only";
import { cutEdges, cutoutSchema, photoEditFrom, sceneWorthy, type CarouselPhoto, type PhotoEdit } from "@fauve/agent";
import { jpegPath } from "@/lib/social/media-urls";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { photoRegions, type StoredRegions } from "@/lib/video/regions";

// Her photos as a designed carousel lays them (apps/render/src/Carousel.tsx): signed,
// their light corrected and framed on their subject from their reading (never a filter
// you notice), the zones she asked to blur, and their subject cut out when the cut is clean.

/** A photo of the carousel that no longer exists: an empty frame in the brand's light (never a broken image). */
const GONE = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='4' height='5'><rect width='4' height='5' fill='#EFEAE4'/></svg>");

export type CarouselSource = {
  id: string;
  /** What the photo shows (its reading), for the designer. */
  shows: string;
  /** How many faces its reading found. */
  faces: number;
  photo: CarouselPhoto;
  /** Whether it was found (else an empty frame stands in). */
  found: boolean;
};

/**
 * Her photos, in the order given (the design's photos[0], photos[1]…). `blur`: the zones she
 * asked to blur on a photo (its slide's retouch); a photo with blurred faces keeps no cut-out,
 * which would show them again.
 */
export async function carouselPhotos(studioId: string, ids: string[], blur: Record<string, PhotoEdit["blur"]> = {}): Promise<CarouselSource[]> {
  if (!ids.length) return [];
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, kind, storage_path, mime_type, regions, cutout").eq("studio_id", studioId).in("id", ids);
  const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
  return Promise.all(
    ids.map(async (id): Promise<CarouselSource> => {
      const asset = byId.get(id);
      if (!asset || asset.kind !== "image") return { id, shows: "", faces: 0, found: false, photo: { src: GONE, aspect: 0.8 } };
      let regions: Extract<StoredRegions, { kind: "photo" }> | null = null;
      try {
        regions = await photoRegions(studioId, id);
      } catch (error) {
        console.warn("carousel photo unread", id, error instanceof Error ? error.message : error);
      }
      const jpeg = await jpegPath(studioId, asset.storage_path as string, (asset.mime_type as string | null) ?? null);
      const zones = blur[id]?.length ? blur[id] : undefined;
      const cut = cutoutSchema.safeParse(asset.cutout);
      const clean = cut.success && sceneWorthy(cut.data) && cut.data.path.startsWith(`${studioId}/`) && !zones?.some((z) => z.kind === "face") ? cut.data : null;
      const signed = (await db.storage.from("media").createSignedUrls([jpeg, ...(clean ? [clean.path] : [])], 7200)).data ?? [];
      const src = signed[0]?.signedUrl;
      if (!src) return { id, shows: "", faces: 0, found: false, photo: { src: GONE, aspect: 0.8 } };
      const source = regions ? { width: regions.width, height: regions.height } : clean ? { width: clean.w, height: clean.h } : null;
      const aspect = source ? source.width / source.height : 0.8;
      const edit: PhotoEdit | undefined = regions
        ? { ...photoEditFrom(regions.detection, source!, { retouch: true, blur: "none" }), ...(zones ? { blur: zones } : {}) }
        : source
          ? { source, ...(zones ? { blur: zones } : {}) }
          : undefined;
      const cutout = clean ? signed[1]?.signedUrl : undefined;
      const edges = clean ? cutEdges(clean.touches) : [];
      return {
        id,
        found: true,
        shows: regions?.detection.notes ?? "",
        faces: regions?.detection.regions.filter((r) => r.kind === "face").length ?? 0,
        photo: { src, aspect, ...(edit ? { edit } : {}), ...(cutout && clean ? { cutout, subject: clean.box, ...(edges.length ? { cutEdges: edges } : {}) } : {}) },
      };
    }),
  );
}
