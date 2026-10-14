import "server-only";
import {
  alignSlides,
  elementBoxSchema,
  elementRoleSchema,
  layerSlotSchema,
  MAX_ELEMENTS,
  slidesPlanSchema,
  placeElement,
  type ElementBox,
  type ElementRole,
  type LayerSlot,
  type SlideElement,
  type SlidesPlan,
} from "@fauve/agent";
import { z } from "zod";
import { saveSlides } from "@/lib/render/slides";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The studio's components (motion_templates, kind « element »): its design
// system for text over photos. Each one lives on its own: listed, placed on any
// photo, edited (every change keeps the previous version), reused at no cost.

export type BankElement = {
  id: string;
  name: string;
  role: ElementRole;
  slots: LayerSlot[];
  js: string;
  fonts: string[];
  base: number;
  /** Where it sat on its inspiration (laid again with the whole kit). */
  box: ElementBox | null;
  sample: Record<string, string>;
  kitId: string | null;
  kitName: string | null;
  uses: number;
  versions: number;
  updatedAt: string;
};

export type ElementVersion = {
  name: string;
  code: string;
  js: string;
  slots: LayerSlot[];
  fonts: string[];
  base: number;
  sample: Record<string, string>;
  at: string;
  note: string | null;
};

const MAX_VERSIONS = 12;
const COLUMNS = "id, name, role, slots, js, fonts, base, box, sample, kit_id, kit_name, uses, versions, updated_at";
const UPCOMING = ["planned", "content_requested", "media_received", "draft", "validated", "scheduled", "failed"];

const slotsOf = (raw: unknown): LayerSlot[] => z.array(layerSlotSchema).catch([]).parse(raw);
const sampleOf = (raw: unknown): Record<string, string> => z.record(z.string(), z.string()).catch({}).parse(raw ?? {});
const versionsOf = (raw: unknown): ElementVersion[] => (Array.isArray(raw) ? (raw as ElementVersion[]) : []);

function toElement(t: Record<string, unknown>): BankElement {
  const box = elementBoxSchema.safeParse(t.box);
  return {
    id: t.id as string,
    name: (t.name as string).slice(0, 80),
    role: elementRoleSchema.catch("autre").parse(t.role),
    slots: slotsOf(t.slots),
    js: t.js as string,
    fonts: ((t.fonts as string[] | null) ?? []).slice(0, 3),
    base: (t.base as number | null) ?? 600,
    box: box.success ? box.data : null,
    sample: sampleOf(t.sample),
    kitId: (t.kit_id as string | null) ?? null,
    kitName: (t.kit_name as string | null) ?? null,
    uses: (t.uses as number | null) ?? 0,
    versions: versionsOf(t.versions).length,
    updatedAt: (t.updated_at as string | null) ?? new Date(0).toISOString(),
  };
}

/** The studio's components, the most recent kits first. */
export async function listElements(studioId: string, limit = 120): Promise<BankElement[]> {
  const { data, error } = await supabaseAdmin()
    .from("motion_templates")
    .select(COLUMNS)
    .eq("kind", "element")
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("elements: listing failed", error.message);
    return [];
  }
  return data.map(toElement);
}

/** One component of the studio, with its previous versions. */
export async function loadElement(studioId: string, id: string): Promise<(BankElement & { code: string; history: ElementVersion[]; examplePath: string | null; description: string }) | null> {
  const { data } = await supabaseAdmin()
    .from("motion_templates")
    .select(`${COLUMNS}, code, example_path, description`)
    .eq("id", id)
    .eq("kind", "element")
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    ...toElement(data),
    code: data.code as string,
    history: versionsOf(data.versions),
    examplePath: (data.example_path as string | null) ?? null,
    description: (data.description as string | null) ?? "",
  };
}

export type NewElement = { name: string; role: ElementRole; code: string; js: string; slots: LayerSlot[]; fonts: string[]; base: number; box: ElementBox | null; sample: Record<string, string> };

/** Keeps the components of a new kit in the studio's bank; returns their ids in order. */
export async function saveKit(studioId: string, kit: { name: string; description: string; examplePath: string | null; elements: NewElement[] }): Promise<string[]> {
  const kitId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("motion_templates")
    .insert(
      kit.elements.map((e) => ({
        studio_id: studioId,
        kind: "element",
        name: e.name.slice(0, 80) || "Composant",
        description: kit.description.slice(0, 1000),
        role: e.role,
        slots: e.slots,
        code: e.code,
        js: e.js,
        fonts: e.fonts,
        base: e.base,
        box: e.box,
        sample: e.sample,
        kit_id: kitId,
        kit_name: kit.name.slice(0, 80),
        example_path: kit.examplePath,
        uses: 0,
        updated_at: now,
      })),
    )
    .select("id");
  if (error) throw new Error(`elements: ${error.message}`);
  return data.map((r) => r.id as string);
}

/** A new version of a component; the current one joins its history. */
export async function updateElement(studioId: string, id: string, next: Omit<NewElement, "role" | "box"> & { note: string | null }): Promise<void> {
  const db = supabaseAdmin();
  const { data: row, error } = await db.from("motion_templates").select("name, code, js, slots, fonts, base, sample, versions, updated_at").eq("id", id).eq("studio_id", studioId).eq("kind", "element").single();
  if (error) throw new Error(error.message);
  const previous: ElementVersion = {
    name: row.name as string,
    code: row.code as string,
    js: row.js as string,
    slots: slotsOf(row.slots),
    fonts: (row.fonts as string[] | null) ?? [],
    base: (row.base as number | null) ?? 600,
    sample: sampleOf(row.sample),
    at: (row.updated_at as string | null) ?? new Date().toISOString(),
    note: null,
  };
  const versions = [previous, ...versionsOf(row.versions)].slice(0, MAX_VERSIONS);
  const { error: saveError } = await db
    .from("motion_templates")
    .update({
      name: next.name.slice(0, 80) || (row.name as string),
      code: next.code,
      js: next.js,
      slots: next.slots,
      fonts: next.fonts,
      base: next.base,
      sample: next.sample,
      versions,
      description: next.note ? next.note.slice(0, 1000) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("studio_id", studioId);
  if (saveError) throw new Error(saveError.message);
}

/** Back to a previous version (the current one is kept in the history, so nothing is lost). */
export async function restoreElementVersion(studioId: string, id: string, index: number): Promise<boolean> {
  const element = await loadElement(studioId, id);
  const version = element?.history[index];
  if (!element || !version) return false;
  await updateElement(studioId, id, { ...version, note: `Retour à la version du ${version.at}` });
  // The restored version is now current: take it out of the history.
  const { data } = await supabaseAdmin().from("motion_templates").select("versions").eq("id", id).single();
  const history = versionsOf(data?.versions);
  history.splice(index + 1, 1);
  await supabaseAdmin().from("motion_templates").update({ versions: history }).eq("id", id);
  return true;
}

export async function markElementsUsed(ids: string[]) {
  if (!ids.length) return;
  const db = supabaseAdmin();
  const { data } = await db.from("motion_templates").select("id, uses").in("id", ids);
  const now = new Date().toISOString();
  await Promise.all((data ?? []).map((r) => db.from("motion_templates").update({ uses: ((r.uses as number) ?? 0) + 1, last_used_at: now }).eq("id", r.id)));
}

export const elementInstance = placeElement;

/**
 * Puts components on a post's photos (photo number, 1-based → components) and saves
 * the slides; « replace » takes off the components already there. The caller renders.
 */
export async function placeElements(studioId: string, postId: string, perPhoto: Map<number, SlideElement[]>, mode: "replace" | "add"): Promise<SlidesPlan> {
  const { data: post, error } = await supabaseAdmin().from("posts").select("kind, status, media_ids, slides").eq("id", postId).eq("studio_id", studioId).single();
  if (error) throw new Error(error.message);
  if (post.kind !== "carousel" && post.kind !== "post") throw new Error("Les composants se posent sur les photos d'un carrousel ou d'un post photo");
  if (post.status === "published" || post.status === "measured") throw new Error("Cette publication est déjà en ligne");
  const mediaIds = (post.media_ids as string[] | null) ?? [];
  if (!mediaIds.length) throw new Error("Cette publication n'a pas encore de photos");
  const current = slidesPlanSchema.safeParse(post.slides);
  const plan = alignSlides(current.success ? current.data : { template: "doux", slides: [] }, mediaIds);
  const next = {
    ...plan,
    slides: plan.slides.map((s, i) => {
      const added = perPhoto.get(i + 1);
      if (!added) return s;
      const elements = [...(mode === "add" ? (s.elements ?? []) : []), ...added].slice(-MAX_ELEMENTS);
      // Components replace a designed layer (one look per photo); free texts stay.
      return { ...s, layer: undefined, elements };
    }),
  };
  return saveSlides(studioId, postId, next);
}

/** Upcoming posts with this component on a photo: the new version can be put on them. */
export async function postsUsingElement(studioId: string, elementId: string): Promise<{ id: string; title: string }[]> {
  const { data } = await supabaseAdmin().from("posts").select("id, title, slides").eq("studio_id", studioId).in("kind", ["carousel", "post"]).in("status", UPCOMING).not("slides", "is", null).limit(200);
  return (data ?? []).flatMap((p) => {
    const plan = slidesPlanSchema.safeParse(p.slides);
    const uses = plan.success && plan.data.slides.some((s) => s.elements?.some((e) => e.element_id === elementId));
    return uses ? [{ id: p.id as string, title: (p.title as string | null) ?? "Publication" }] : [];
  });
}

/**
 * Puts the component's current version on these posts (or every upcoming one using it),
 * keeping each copy's texts and place. Returns the posts changed; the caller renders them.
 */
export async function refreshElementOnPosts(studioId: string, elementId: string, postIds?: string[]): Promise<string[]> {
  const element = await loadElement(studioId, elementId);
  if (!element) return [];
  const targets = postIds ?? (await postsUsingElement(studioId, elementId)).map((p) => p.id);
  const changed: string[] = [];
  for (const postId of targets) {
    const { data: post } = await supabaseAdmin().from("posts").select("status, slides, media_ids").eq("id", postId).eq("studio_id", studioId).maybeSingle();
    if (!post || !UPCOMING.includes(post.status as string)) continue;
    const plan = slidesPlanSchema.safeParse(post.slides);
    if (!plan.success) continue;
    let touched = false;
    const slides = plan.data.slides.map((s) => ({
      ...s,
      elements: s.elements?.map((e) => {
        if (e.element_id !== elementId) return e;
        touched = true;
        return { ...elementInstance(element, { box: e.box, texts: e.texts }), ...(e.accent ? { accent: e.accent } : {}) };
      }),
    }));
    if (!touched) continue;
    await saveSlides(studioId, postId, { ...plan.data, slides });
    changed.push(postId);
  }
  return changed;
}
