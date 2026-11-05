import "server-only";
import { randomUUID } from "node:crypto";
import { pcmSamples, sameTake, TAKE_RATE, takeOffset, wordsOffset, type ClipAnalysis, type TakeSync } from "@fauve/agent";
import { costMeta } from "@/lib/cost-scope";
import { sandboxCostEur, takeAudioInSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { keepAnalysis } from "./speech";

// Two videos of one take (takes.ts in @fauve/agent): her other videos where she says the same words as in her main one
// (two phones filming her at once) are synced on their sound once, in the render sandbox, and the result kept on the main
// video's speech (speech.takes): a skill timed on her voice can then switch from one to the other in the middle of what
// she says (skills.ts, SkillTalk.takes). Never fails a montage: without it, her main video alone.

type Clip = { media_id: string; analysis: ClipAnalysis };

/**
 * Her other videos that are the same take as her main one, each with its offset (its time = the main's + offset):
 * those whose words match the main one's (free) are measured on their sound, once (a few seconds of the sandbox, its
 * cost logged), and every measure kept on the main video's analysis.
 */
export async function syncTakes(studioId: string, main: Clip, others: Clip[]): Promise<TakeSync[]> {
  const known = main.analysis.speech?.takes ?? [];
  const words = main.analysis.words ?? [];
  // Measured before, or worth measuring: the same words, in the same order (their rough offset narrows the search).
  const rough = new Map(others.flatMap((o) => {
    if (known.some((t) => t.media_id === o.media_id)) return [];
    const matched = wordsOffset(words, o.analysis.words ?? []);
    return matched ? [[o.media_id, matched.offset] as const] : [];
  }));
  const measured: TakeSync[] = [];
  if (rough.size && main.analysis.speech) {
    try {
      const db = supabaseAdmin();
      const ids = [main.media_id, ...rough.keys()];
      const { data: rows } = await db.from("media_assets").select("id, storage_path").eq("studio_id", studioId).in("id", ids);
      const paths = ids.map((id) => rows?.find((r) => r.id === id)?.storage_path as string | undefined);
      if (paths.every(Boolean)) {
        const signed = await Promise.all(paths.map((p) => db.storage.from("media").createSignedUrl(p!, 3600)));
        const urls = signed.map((s) => s.data?.signedUrl);
        if (urls.every(Boolean)) {
          const { pcm, seconds } = await takeAudioInSandbox(`takes-${randomUUID()}`, urls as string[]);
          await db.from("cost_events").insert({
            studio_id: studioId,
            kind: "take_sync",
            provider: "vercel_sandbox",
            units: Math.round(seconds),
            cost_eur: sandboxCostEur(seconds),
            meta: costMeta({ media_id: main.media_id, others: [...rough.keys()] }),
          });
          const first = pcm[0] ? pcmSamples(pcm[0]) : null;
          [...rough.entries()].forEach(([id, around], k) => {
            const other = pcm[k + 1];
            const sync = first && other ? takeOffset(first, pcmSamples(other), TAKE_RATE, { around }) : null;
            measured.push(sync ? { media_id: id, offset: sync.offset, score: sync.score, same: sameTake(sync) } : { media_id: id, offset: 0, score: 0, same: false });
          });
          if (measured.length) {
            const takes = [...known, ...measured].slice(-8);
            await keepAnalysis(studioId, main.media_id, { ...main.analysis, speech: { ...main.analysis.speech, takes } });
            main.analysis.speech.takes = takes;
          }
        }
      }
    } catch (error) {
      console.warn("takes: not synced, her main video alone", main.media_id, error instanceof Error ? error.message.slice(0, 300) : error);
    }
  }
  const all = [...known, ...measured];
  return others.flatMap((o) => all.filter((t) => t.media_id === o.media_id && t.same).slice(-1));
}
