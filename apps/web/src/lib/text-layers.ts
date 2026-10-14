import "server-only";
import { alignSlides, layerSlotSchema, slidesPlanSchema, type LayerSlot, type SlidesPlan, type TextLayer } from "@fauve/agent";
import { z } from "zod";
import { saveSlides } from "@/lib/render/slides";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Text layers in the library (motion_templates, kind « layer »): every layer the
// text designer made, plus Fauve's house ones (studio_id null), reused with new
// texts at no cost. And putting layers on a post's photos.

export type LayerSummary = { id: string; name: string; description: string; slots: LayerSlot[]; house: boolean };

const slotsOf = (raw: unknown): LayerSlot[] => z.array(layerSlotSchema).catch([]).parse(raw);

/** The layers a studio can reuse, most used first (no code). */
export async function listLayers(studioId: string, limit = 20): Promise<LayerSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from("motion_templates")
    .select("id, studio_id, name, description, slots")
    .eq("kind", "layer")
    .or(`studio_id.eq.${studioId},studio_id.is.null`)
    .is("archived_at", null)
    .order("uses", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("text layers: listing failed", error.message);
    return [];
  }
  return data.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: (t.description as string).slice(0, 300),
    slots: slotsOf(t.slots),
    house: t.studio_id === null,
  }));
}

/** A layer of the library, with its code, if this studio may use it. */
export async function loadLayer(studioId: string, id: string) {
  const { data } = await supabaseAdmin()
    .from("motion_templates")
    .select("id, name, slots, js, fonts, uses")
    .eq("id", id)
    .eq("kind", "layer")
    .or(`studio_id.eq.${studioId},studio_id.is.null`)
    .is("archived_at", null)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, name: data.name as string, slots: slotsOf(data.slots), js: data.js as string, fonts: (data.fonts as string[] | null) ?? [], uses: (data.uses as number) ?? 0 };
}

/** Keeps a new layer in the studio's library. */
export async function saveLayer(
  studioId: string,
  layer: { name: string; description: string; slots: LayerSlot[]; code: string; js: string; fonts: string[] },
): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("motion_templates")
    .insert({
      studio_id: studioId,
      kind: "layer",
      name: layer.name.slice(0, 80) || "Calque de texte",
      description: layer.description.slice(0, 1000),
      slots: layer.slots,
      code: layer.code,
      js: layer.js,
      fonts: layer.fonts,
      uses: 1,
      last_used_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.warn("text layers: saving failed", error.message);
    return null;
  }
  return data.id as string;
}

export async function markLayerUsed(id: string, uses: number) {
  await supabaseAdmin().from("motion_templates").update({ uses: uses + 1, last_used_at: new Date().toISOString() }).eq("id", id);
}

/** Puts layers on a post's photos (photo number, 1-based → layer) and saves the slides; the caller renders. */
export async function applyLayers(studioId: string, postId: string, layers: Map<number, TextLayer>): Promise<SlidesPlan> {
  const { data: post, error } = await supabaseAdmin().from("posts").select("kind, status, media_ids, slides").eq("id", postId).eq("studio_id", studioId).single();
  if (error) throw new Error(error.message);
  if (post.kind !== "carousel" && post.kind !== "post") throw new Error("Les calques de texte sont pour un carrousel ou un post photo");
  if (post.status === "published" || post.status === "measured") throw new Error("Cette publication est déjà en ligne");
  const mediaIds = (post.media_ids as string[] | null) ?? [];
  const current = slidesPlanSchema.safeParse(post.slides);
  const plan = alignSlides(current.success ? current.data : { template: "doux", slides: [] }, mediaIds);
  const next = { ...plan, slides: plan.slides.map((s, i) => (layers.has(i + 1) ? { ...s, layer: layers.get(i + 1)! } : s)) };
  return saveSlides(studioId, postId, next);
}

/** The layouts the carousel editor offers: the studio's and Fauve's, with their code to draw them live. */
export async function layoutsForEditor(studioId: string, limit = 16): Promise<(Omit<TextLayer, "texts" | "template_id"> & { id: string; house: boolean })[]> {
  const { data, error } = await supabaseAdmin()
    .from("motion_templates")
    .select("id, studio_id, name, slots, js, fonts")
    .eq("kind", "layer")
    .or(`studio_id.eq.${studioId},studio_id.is.null`)
    .is("archived_at", null)
    .neq("js", "")
    .order("uses", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("text layers: editor listing failed", error.message);
    return [];
  }
  return data.map((t) => ({
    id: t.id as string,
    name: (t.name as string).slice(0, 80),
    house: t.studio_id === null,
    slots: slotsOf(t.slots),
    js: t.js as string,
    fonts: ((t.fonts as string[] | null) ?? []).slice(0, 4),
  }));
}
