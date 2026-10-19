import "server-only";
import { acceptedSort, ANALYST_MODEL, CLIP_SORT_PROMPT, clipSortSchema, SORT_DAYS_AHEAD, type ClipAnalysis } from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Puts a video she sent on the publication of the coming days it fits (see
// packages/agent/src/clip-sort.ts), ticks its filming mission, and remembers
// where it went (media_assets.sorted_post_id) for Simone and the to-do list.

const OPEN = ["planned", "content_requested", "media_received"];

export async function sortClip(studioId: string, mediaId: string, analysis: ClipAnalysis): Promise<{ postId: string; title: string; why: string } | null> {
  const db = supabaseAdmin();
  const { data: asset } = await db.from("media_assets").select("sorted_post_id, source").eq("id", mediaId).single();
  // Already placed (by her, Simone or an earlier sort), or not one of hers.
  if (!asset || asset.sorted_post_id || asset.source === "website" || asset.source === "render") return null;
  const { data: used } = await db.from("posts").select("id").eq("studio_id", studioId).contains("media_ids", [mediaId]).limit(1);
  if (used?.length) return null;
  // Sent in a conversation about one publication (its panel): that one decides, not the sort.
  const { data: message } = await db.from("whatsapp_messages").select("conversation_id").eq("media_id", mediaId).limit(1).maybeSingle();
  if (message?.conversation_id) {
    const { data: conversation } = await db.from("conversations").select("post_id").eq("id", message.conversation_id).maybeSingle();
    if (conversation?.post_id) return null;
  }

  const now = Date.now();
  const [{ data: posts }, { data: shots }] = await Promise.all([
    db
      .from("posts")
      .select("id, kind, title, agent_note, scheduled_at, status, media_ids")
      .eq("studio_id", studioId)
      .in("status", OPEN)
      .in("kind", ["reel", "story"])
      .gte("scheduled_at", new Date(now).toISOString())
      .lte("scheduled_at", new Date(now + SORT_DAYS_AHEAD * 86_400_000).toISOString())
      .order("scheduled_at")
      .limit(12),
    db.from("shot_requests").select("post_id, label, hint").eq("studio_id", studioId).eq("done", false).not("post_id", "is", null),
  ]);
  if (!posts?.length) return null;
  const missions = new Map((shots ?? []).map((s) => [s.post_id as string, `${s.label as string}${s.hint ? ` (${s.hint as string})` : ""}`]));

  const response = await anthropic().beta.messages.parse({
    model: ANALYST_MODEL,
    max_tokens: 1500,
    output_config: { effort: "low", format: outputFormat(clipSortSchema) },
    system: CLIP_SORT_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          video: { contenu: analysis.summary, lieu: analysis.setting, plans: analysis.shots.slice(0, 8).map((s) => s.description), duree_s: Math.round(analysis.duration) },
          publications: posts.map((p) => ({
            post_id: p.id,
            format: p.kind,
            idee: p.title,
            angle: p.agent_note,
            date: p.scheduled_at,
            deja_des_videos: Boolean((p.media_ids as string[] | null)?.length),
            mission: missions.get(p.id as string) ?? null,
          })),
        }),
      },
    ],
  });
  await logClaudeCost(studioId, response.usage, "clip_sort", ANALYST_MODEL);
  const sort = response.parsed_output;
  if (!sort) return null;
  const postId = acceptedSort(sort, new Set(posts.map((p) => p.id as string)));
  if (!postId) return null;

  const post = posts.find((p) => p.id === postId)!;
  const media = [...new Set([...((post.media_ids as string[] | null) ?? []), mediaId])];
  await db
    .from("posts")
    .update({ media_ids: media, ...(post.status === "media_received" ? {} : { status: "media_received" }) })
    .eq("id", postId)
    .eq("studio_id", studioId);
  await db.from("shot_requests").update({ done: true }).eq("post_id", postId).eq("studio_id", studioId).eq("done", false);
  await db.from("media_assets").update({ sorted_post_id: postId, sorted_why: sort.why.slice(0, 240) }).eq("id", mediaId);
  return { postId, title: (post.title as string | null) ?? "", why: sort.why };
}
