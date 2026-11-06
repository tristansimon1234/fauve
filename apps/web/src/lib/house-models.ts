import "server-only";
import { HOUSE_SOURCE, HOUSE_VERSION, houseModel, houseStyle, stolenStyleSchema } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Edith's own models (packages/agent/src/house-models.ts) as a studio uses them: an internal tool, never shown to her
// (Tristan, 6 November: « je préfère ne pas divulguer nos modèles »): Edith picks one while the Reel is made
// (lib/agent/house-pick.ts), or the bench plays one (model=), and the Reel follows it the way it follows a Reel she
// sends (posts.inspiration_id), so each model a studio is made with is a row of its inspirations (source « house »,
// external_id = the model's key), written from the catalogue when first used and rewritten when the catalogue's
// version moves on. Never listed with her inspirations; never read by Gemini; its name never said to her.

/** The studio's row for a model (made, or rewritten from a newer catalogue); null for an unknown key. */
export async function houseInspiration(studioId: string, key: string): Promise<{ id: string; name: string } | null> {
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
    return { id: known.id as string, name: model.name };
  }
  const { data, error } = await db
    .from("inspirations")
    .insert({ studio_id: studioId, source: HOUSE_SOURCE, kind: "reel", external_id: model.key, title: model.name, style })
    .select("id")
    .single();
  if (error || !data) throw new Error(`house model not kept: ${error?.message ?? "no row"}`);
  return { id: data.id as string, name: model.name };
}
