import "server-only";
import { ANALYST_MODEL, BRIEF_QUESTIONS_PROMPT, briefWriterSchema, fallbackQuestions, readMemory, type BriefQuestion, type PostKind } from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Simone's questions before she makes a publication from the Créer screen (her brief,
// packages/agent/src/brief.ts): Sonnet reads her business, what she imagines, her files and
// what the screen already chose, and asks the few that change the result, with answers to tap.

export type BriefRequest = {
  kind: PostKind;
  idea: string;
  /** Picked from her library: what Simone already saw of them. */
  media: string[];
  /** Just sent from her phone: not seen yet, only counted. */
  sent: { videos: number; photos: number };
  /** What the screen already chose, in her words: never asked again. */
  chosen: { format: string; voice?: string; style?: string; when: string };
};

/** Her library's files as Simone saw them: a line each. */
async function seen(studioId: string, ids: string[]): Promise<{ videos: number; photos: number; lines: string[] }> {
  if (!ids.length) return { videos: 0, photos: 0, lines: [] };
  const db = supabaseAdmin();
  const { data: assets } = await db.from("media_assets").select("id, kind, regions").eq("studio_id", studioId).in("id", ids);
  const videos = (assets ?? []).filter((a) => a.kind === "video").map((a) => a.id as string);
  const { data: analyses } = videos.length ? await db.from("clip_analyses").select("media_id, analysis").in("media_id", videos).order("created_at", { ascending: false }) : { data: [] };
  const summaries = new Map<string, string>();
  for (const a of analyses ?? []) {
    const summary = (a.analysis as { summary?: string } | null)?.summary;
    if (summary && !summaries.has(a.media_id as string)) summaries.set(a.media_id as string, summary);
  }
  const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
  const lines = ids.flatMap((id) => {
    const a = byId.get(id);
    const said = a?.kind === "video" ? summaries.get(id) : (a?.regions as { notes?: string } | null)?.notes;
    return a && said ? [`${a.kind === "video" ? "vidéo" : "photo"} : ${said.slice(0, 220)}`] : [];
  });
  return { videos: videos.length, photos: (assets ?? []).length - videos.length, lines: lines.slice(0, 12) };
}

/**
 * Her brief's questions: none when her request says it all; when they cannot be written,
 * what any publication needs (what it is for, how it ends).
 */
export async function briefQuestions(studioId: string, input: BriefRequest): Promise<BriefQuestion[]> {
  try {
    const [{ data: studio }, files] = await Promise.all([
      supabaseAdmin().from("studios").select("name, business_type, booking_url, memory").eq("id", studioId).single(),
      seen(studioId, input.media),
    ]);
    const request = {
      commerce: {
        nom: studio?.name ?? undefined,
        activite: studio?.business_type ?? undefined,
        lien_de_reservation: studio?.booking_url ? "oui" : "non",
        memoire: readMemory(studio?.memory).map((f) => f.fact),
      },
      demande: input.idea.trim() || undefined,
      fichiers: { videos: files.videos + input.sent.videos, photos: files.photos + input.sent.photos, ce_qu_on_y_voit: files.lines.length ? files.lines : undefined },
      deja_choisi: input.chosen,
    };
    const response = await anthropic().beta.messages.parse(
      {
        model: ANALYST_MODEL,
        max_tokens: 800,
        output_config: { effort: "low", format: outputFormat(briefWriterSchema) },
        system: BRIEF_QUESTIONS_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(request) }],
      },
      { timeout: 20_000, maxRetries: 1 },
    );
    await logClaudeCost(studioId, response.usage, "brief", ANALYST_MODEL);
    return response.parsed_output?.questions ?? fallbackQuestions(input.kind === "reel");
  } catch (error) {
    console.warn("brief: questions not written, the usual ones instead", error);
    return fallbackQuestions(input.kind === "reel");
  }
}
