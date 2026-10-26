import "server-only";
import { BRIEF_MAX, ANALYST_MODEL, CAPTION_WRITER_PROMPT, captionDraftSchema, keptCaption, memoryLines } from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A Reel launched from « Créer » has no chat turn where Simone writes its caption: two of the
// three Reels of Brume's test went out with none. Written here at delivery, only when the post
// has none (hers, or Simone's from the chat, always stays), with the chat's caption rules.

export async function ensureCaption(studioId: string, postId: string, planId: string | null, brief?: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("caption, title, agent_note, voice_media_id").eq("id", postId).eq("studio_id", studioId).single();
  if (!post || (post.caption as string | null)?.trim()) return;
  const [studio, profile, plan, voice] = await Promise.all([
    db.from("studios").select("name, business_type, memory, booking_url").eq("id", studioId).single(),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    planId ? db.from("edit_plans").select("plan").eq("id", planId).single() : Promise.resolve({ data: null }),
    post.voice_media_id ? db.from("media_assets").select("transcript").eq("id", post.voice_media_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const texts = ((plan.data?.plan as { texts?: { text?: string }[] } | null)?.texts ?? []).map((t) => t.text?.trim()).filter(Boolean);
  const spoken = (voice.data?.transcript as { text?: string } | null)?.text?.trim();

  const response = await anthropic().beta.messages.parse({
    model: ANALYST_MODEL,
    max_tokens: 1200,
    output_config: { effort: "low", format: outputFormat(captionDraftSchema) },
    system: CAPTION_WRITER_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          commerce: {
            nom: studio.data?.name ?? undefined,
            activite: studio.data?.business_type ?? undefined,
            ce_qu_on_sait: memoryLines(studio.data?.memory),
            reservation_en_ligne: Boolean(studio.data?.booking_url),
            ton: (profile.data?.profile as { tone?: string } | null)?.tone ?? undefined,
          },
          publication: { idee: post.title ?? undefined, angle: post.agent_note ?? undefined, ...(brief?.trim() ? { demande: brief.trim().slice(0, BRIEF_MAX) } : {}) },
          video: { textes_a_l_ecran: texts, ...(spoken ? { voix_off: spoken.slice(0, 1500) } : {}) },
        }),
      },
    ],
  });
  await logClaudeCost(studioId, response.usage, "caption", ANALYST_MODEL);
  const kept = response.parsed_output ? keptCaption(response.parsed_output) : null;
  if (!kept) return;
  // Never over a caption written meanwhile (in the chat or on the page).
  await db.from("posts").update(kept).eq("id", postId).eq("studio_id", studioId).or("caption.is.null,caption.eq.");
}
