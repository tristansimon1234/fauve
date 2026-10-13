import "server-only";
import { motionSlotSchema, type MotionSlot } from "@fauve/agent";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The motion template library: every free scene the motion designer writes is
// kept with its text slots, and the editor reuses them with new texts instead
// of ordering a new scene. A studio sees its own scenes and Fauve's house ones
// (studio_id null).

/** How many scenes the editor is shown: the most used and most recent first. */
const LIBRARY_SIZE = 24;

export type TemplateSummary = { id: string; name: string; description: string; slots: MotionSlot[]; duration_seconds: number | null };
export type TemplateCode = { id: string; code: string; js: string };

const slots = (raw: unknown): MotionSlot[] => z.array(motionSlotSchema).catch([]).parse(raw);

/** The library as the editor sees it (no code). */
export async function templatesForEditor(studioId: string): Promise<TemplateSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from("motion_templates")
    .select("id, name, description, slots, duration_seconds")
    .eq("kind", "scene")
    .or(`studio_id.eq.${studioId},studio_id.is.null`)
    .is("archived_at", null)
    .order("uses", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIBRARY_SIZE);
  if (error) {
    console.warn("motion_templates: listing failed", error.message);
    return [];
  }
  return data.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    // The editor only needs the gist of what the scene shows.
    description: (t.description as string).slice(0, 300),
    slots: slots(t.slots),
    duration_seconds: t.duration_seconds === null ? null : Number(t.duration_seconds),
  }));
}

/** Code of the templates a plan reuses, limited to the ones this studio may use. */
export async function templateCode(studioId: string, ids: string[]): Promise<Map<string, TemplateCode>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data, error } = await supabaseAdmin()
    .from("motion_templates")
    .select("id, code, js")
    .eq("kind", "scene")
    .in("id", unique)
    .or(`studio_id.eq.${studioId},studio_id.is.null`)
    .is("archived_at", null);
  if (error) throw new Error(`motion_templates: ${error.message}`);
  return new Map(data.map((t) => [t.id as string, { id: t.id as string, code: t.code as string, js: t.js as string }]));
}

/** Counts a reuse (feeds the library order). */
export async function markTemplatesUsed(ids: string[]) {
  const db = supabaseAdmin();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const { data } = await db.from("motion_templates").select("uses").eq("id", id).single();
      await db
        .from("motion_templates")
        .update({ uses: ((data?.uses as number | undefined) ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", id);
    }),
  );
}

/** Saves new scenes that passed the smoke test; returns their ids in the same order (null if not saved). */
export async function saveTemplates(
  studioId: string,
  scenes: { name: string; description: string; slots: MotionSlot[]; code: string; js: string; durationSeconds: number }[],
): Promise<(string | null)[]> {
  if (!scenes.length) return [];
  const { data, error } = await supabaseAdmin()
    .from("motion_templates")
    .insert(
      scenes.map((s) => ({
        studio_id: studioId,
        name: s.name.slice(0, 80) || "Scène animée",
        description: s.description,
        slots: s.slots,
        code: s.code,
        js: s.js,
        duration_seconds: s.durationSeconds,
        uses: 1,
        last_used_at: new Date().toISOString(),
      })),
    )
    .select("id");
  if (error) {
    console.warn("motion_templates: saving failed", error.message);
    return scenes.map(() => null);
  }
  return data.map((row) => row.id as string);
}
