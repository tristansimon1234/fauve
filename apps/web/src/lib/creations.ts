import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// What Simone made for a studio and reuses, shown in « Ton style »: its animated scenes.

/** An animated scene; fonts: the Google Fonts families its code brings besides the Reel's two. */
export type Creation = { id: string; name: string; js: string; fonts: string[]; uses: number };

/**
 * The studio's animated scenes, most used first; not those made with her photos or over
 * several shots, which only play in their Reel (drawn alone, they would show nothing).
 */
export async function studioScenes(studioId: string): Promise<Creation[]> {
  const { data } = await supabaseAdmin()
    .from("motion_templates")
    .select("id, name, js, fonts, uses")
    .eq("studio_id", studioId)
    .eq("kind", "scene")
    .or("role.is.null,role.not.in.(photo,layer)")
    .is("archived_at", null)
    .order("uses", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(48);
  return (data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    js: t.js as string,
    fonts: Array.isArray(t.fonts) ? (t.fonts as string[]) : [],
    uses: (t.uses as number) ?? 0,
  }));
}
