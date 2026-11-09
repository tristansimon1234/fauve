import "server-only";
import { fileHabit, type CheckedFile, type FilmHabit } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her files as measured (packages/agent/src/file-check.ts): what was read on each when it arrived, the clip analysis of a
// video and the reading of a photo, never a new call. Edith's context judges the files of this exchange on their form,
// and film_guide reads her habit on her latest videos.

/** The most files read for one verdict (a Reel takes 30 at most). */
const MAX_FILES = 30;

/** Her files, in the order given, as measured; a file not of this studio is left out. */
export async function checkedFiles(studioId: string, ids: string[]): Promise<CheckedFile[]> {
  const wanted = [...new Set(ids.map((id) => id.toLowerCase()))].slice(0, MAX_FILES);
  if (!wanted.length) return [];
  const db = supabaseAdmin();
  const [assets, analyses] = await Promise.all([
    db.from("media_assets").select("id, kind, width, height, duration, regions").eq("studio_id", studioId).in("id", wanted),
    db.from("clip_analyses").select("media_id, analysis, created_at").in("media_id", wanted).order("created_at", { ascending: false }),
  ]);
  const read = new Map<string, CheckedFile["analysis"]>();
  for (const row of analyses.data ?? []) if (!read.has(row.media_id as string)) read.set(row.media_id as string, row.analysis as CheckedFile["analysis"]);
  const byId = new Map((assets.data ?? []).map((a) => [String(a.id).toLowerCase(), a]));
  return wanted.flatMap((id): CheckedFile[] => {
    const a = byId.get(id);
    if (!a || (a.kind !== "video" && a.kind !== "image")) return [];
    const regions = a.regions as { detection?: { adjust?: { exposure?: number; warmth?: number } } } | null;
    return [
      {
        kind: a.kind,
        width: (a.width as number | null) ?? null,
        height: (a.height as number | null) ?? null,
        duration: a.duration === null || a.duration === undefined ? null : Number(a.duration),
        ...(a.kind === "video" ? { analysis: read.get(String(a.id)) ?? null } : { adjust: regions?.detection?.adjust ?? null }),
      },
    ];
  });
}

/** Her habit on her latest videos (couched, dark, shaky, lights mixed), when half of them share it. */
export async function filmHabit(studioId: string): Promise<FilmHabit | null> {
  const { data } = await supabaseAdmin()
    .from("media_assets")
    .select("id")
    .eq("studio_id", studioId)
    .eq("kind", "video")
    .eq("analysis_status", "done")
    .gt("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(8);
  return fileHabit(await checkedFiles(studioId, (data ?? []).map((r) => r.id as string)));
}
