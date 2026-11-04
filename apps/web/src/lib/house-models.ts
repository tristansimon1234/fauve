import "server-only";
import { HOUSE_MODELS, HOUSE_SOURCE, HOUSE_VERSION, houseLines, houseModel, houseStyle, stolenStyleSchema } from "@fauve/agent";
import { skillFor } from "@fauve/agent/skills";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Edith's own models (packages/agent/src/house-models.ts) as a studio uses them: the Reel she makes « comme le modèle
// … » follows it the way it follows a Reel she sends (posts.inspiration_id), so each model a studio picks is a row of
// its inspirations (source « house », external_id = the model's key), written from the catalogue when first used and
// rewritten when the catalogue's version moves on. Never listed with her inspirations; never read by Gemini.

/**
 * A model for the Créer screen: what it is, what it wants, and its preview (a loop rendered from its reference
 * composition); `least`, for a model coded as a montage skill, the files it wants at least (fewer: she is asked first).
 */
export type HouseCard = { key: string; name: string; pitch: string; needs: string; video: string; poster: string; least?: number };

/** The models, in the catalogue's order, for her to pick one. */
export function houseCards(): HouseCard[] {
  return HOUSE_MODELS.map((m) => {
    const skill = skillFor(m.key);
    return { key: m.key, name: m.name, pitch: m.pitch, needs: m.needs, video: `/modeles/${m.key}.mp4`, poster: `/modeles/${m.key}.jpg`, ...(skill ? { least: skill.files[0] } : {}) };
  });
}

/** The studio's row for a model (made, or rewritten from a newer catalogue), with what her Reel takes from it; null for an unknown key. */
export async function houseInspiration(studioId: string, key: string): Promise<{ id: string; name: string; lines: string[] } | null> {
  const model = houseModel(key);
  if (!model) return null;
  const db = supabaseAdmin();
  const style = houseStyle(model);
  const { data: known } = await db
    .from("inspirations")
    .select("id, style")
    .eq("studio_id", studioId)
    .eq("source", HOUSE_SOURCE)
    .eq("external_id", model.key)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (known) {
    const kept = stolenStyleSchema.safeParse(known.style);
    if (!kept.success || kept.data.house?.version !== HOUSE_VERSION) {
      await db.from("inspirations").update({ style, title: model.name }).eq("id", known.id).eq("studio_id", studioId);
    }
    return { id: known.id as string, name: model.name, lines: houseLines(model) };
  }
  const { data, error } = await db
    .from("inspirations")
    .insert({ studio_id: studioId, source: HOUSE_SOURCE, kind: "reel", external_id: model.key, title: model.name, style })
    .select("id")
    .single();
  if (error || !data) throw new Error(`house model not kept: ${error?.message ?? "no row"}`);
  return { id: data.id as string, name: model.name, lines: houseLines(model) };
}
