import "server-only";
import { tiktokDirectPost, tiktokEnabled } from "@/lib/social/tiktok";
import type Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_EFFORT, DEFAULT_VOICE_ID, effortSchema, findVoice, orderReplies, readMemory, readVoiceSetting, stableWindow } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runFauve, type RunFauveInput, type RunFauveResult } from "./run";
import { describeJobs, runningJobs } from "@/lib/studio-jobs";
import { presenceLines } from "@/lib/nudge";
import { accessLine } from "@/lib/billing/access";
import { pendingSteal } from "@/lib/steal";

// Shared by every channel (WhatsApp webhook, web test chat): rebuild the
// conversation from stored messages and let Fauve answer the last one.

const HISTORY_LIMIT = 20;
/** The history's start moves by about this many messages at a time (prompt cache, `stableWindow`). */
const HISTORY_STEP = 10;
/** Rows read to find the window's start. */
const HISTORY_READ = HISTORY_LIMIT + 4 * HISTORY_STEP;
/** Long messages (video captions, links) are cut in the history: the model rarely needs them whole. */
const MESSAGE_MAX_CHARS = 700;

export type StoredMessage = {
  direction: "inbound" | "outbound";
  type: string;
  body: string | null;
  media_id: string | null;
  /** Ids Fauve made in that turn (quote, post): her memory of what the text refers to. */
  notes?: string[];
  /** Emoji reactions on the message: the manager's on Fauve's messages, Fauve's on hers. */
  reactions?: { fauve?: string; me?: string } | null;
};

const mediaLabels: Record<string, string> = {
  video: "Vidéo reçue",
  image: "Photo reçue",
  document: "Fichier reçu",
  audio: "Message vocal reçu",
  sticker: "Sticker reçu",
};

/** Rebuilds the conversation for the model from stored messages (text only). */
export function toModelHistory(rows: StoredMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const history: Anthropic.Beta.BetaMessageParam[] = [];
  for (const row of rows) {
    const role = row.direction === "inbound" ? "user" : "assistant";
    const label = row.direction === "inbound" ? mediaLabels[row.type] : undefined;
    // A voice note whose words could not be read: Simone says so instead of guessing.
    const unheard = row.direction === "inbound" && row.type === "audio" && !row.body ? " · tu n'as pas pu l'écouter : dis-le-lui et demande-lui de l'écrire" : "";
    const text = [label && `[${label}${row.media_id ? ` · media_id ${row.media_id}` : ""}${unheard}]`, row.body]
      .filter(Boolean)
      .join(" ");
    if (!text) continue;
    const cut = text.length > MESSAGE_MAX_CHARS ? `${text.slice(0, MESSAGE_MAX_CHARS)}…` : text;
    // A reaction is part of the conversation: she liked a message, Fauve already answered one with an emoji.
    const reacted = row.direction === "outbound" ? row.reactions?.me && `[elle a réagi ${row.reactions.me}]` : row.reactions?.fauve && `[tu as réagi ${row.reactions.fauve}]`;
    const short = [row.notes?.length ? `${cut}\n[mémo : ${row.notes.join(" ; ")}]` : cut, reacted].filter(Boolean).join("\n");
    const last = history.at(-1);
    if (last?.role === role && typeof last.content === "string") {
      last.content = `${last.content}\n${short}`;
    } else {
      history.push({ role, content: short });
    }
  }
  while (history[0]?.role === "assistant") history.shift();
  return history;
}

export async function replyInConversation(params: {
  studioId: string;
  memberId: string;
  /** Web chat: the conversation being answered. Default: the studio's latest one. */
  conversationId?: string;
  /** Web chat: the manager's message, so Fauve can react to it. */
  reactToRowId?: string;
  /** WhatsApp only: lets Fauve react to the manager's last message. */
  waId?: string;
  replyToMessageId?: string;
  /** Where the manager writes from (default: WhatsApp when there is a waId, else the app). */
  channel?: "whatsapp" | "web" | "instagram";
  /** Live events of the turn (the app's chat). */
  onEvent?: RunFauveInput["onEvent"];
}): Promise<RunFauveResult> {
  const db = supabaseAdmin();
  // A chat the manager started fresh in the web app is its own context (and
  // costs fewer tokens); otherwise Fauve keeps the studio's recent history.
  let conversations = db
    .from("conversations")
    .select("id, started_by")
    .eq("studio_id", params.studioId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false })
    .limit(1);
  // WhatsApp answers the studio's general conversation, never one about a single publication.
  conversations = params.conversationId ? conversations.eq("id", params.conversationId) : conversations.is("post_id", null);
  const conversation = (await conversations).data?.[0];
  const ownThread = conversation?.started_by === "web";
  let messages = db
    .from("whatsapp_messages")
    .select("id, direction, type, body, media_id, wa_message_id, payload, conversation_id, reactions")
    .eq("studio_id", params.studioId)
    .order("created_at", { ascending: false })
    // WhatsApp keeps the studio's recent thread across conversations, minus the ones opened in the app: read a little more, then filter.
    .limit(ownThread ? HISTORY_READ : HISTORY_READ * 2);
  if (ownThread) messages = messages.eq("conversation_id", conversation.id);

  const [studio, member, rows, instagram, brand, jobs, tiktok, copying] = await Promise.all([
    db.from("studios").select("name, business_type, timezone, onboarding_step, montage_effort, website_url, booking_url, memory").eq("id", params.studioId).single(),
    db.from("members").select("first_name").eq("id", params.memberId).single(),
    messages,
    db.from("social_accounts").select("handle").eq("studio_id", params.studioId).eq("platform", "instagram").eq("status", "connected").maybeSingle(),
    db.from("brand_profiles").select("profile->>tone, profile->voice, profile->fonts, profile->font_twins, profile->custom_fonts").eq("studio_id", params.studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    runningJobs(params.studioId).catch(() => []),
    db.from("social_accounts").select("handle, status").eq("studio_id", params.studioId).eq("platform", "tiktok").maybeSingle(),
    // The Reel she sent to copy (« Steal »), for her next Reel only.
    pendingSteal(params.studioId).catch(() => null),
  ]);
  const jobTitles = jobs.length
    ? new Map(
        ((await db.from("posts").select("id, title").in("id", jobs.flatMap((j) => (j.postId ? [j.postId] : [])))).data ?? []).map((p) => [p.id as string, p.title as string]),
      )
    : new Map<string, string>();
  if (studio.error) throw new Error(studio.error.message);
  if (rows.error) throw new Error(rows.error.message);

  // Outside an app conversation, leave out the conversations opened in the app (their own thread, or one publication).
  let kept = rows.data;
  if (!ownThread) {
    const ids = [...new Set(kept.map((r) => r.conversation_id as string | null).filter((id): id is string => Boolean(id)))];
    const { data: separate } = ids.length
      ? await db.from("conversations").select("id").in("id", ids).or("started_by.eq.web,post_id.not.is.null")
      : { data: [] };
    const skip = new Set((separate ?? []).map((c) => c.id as string));
    kept = kept.filter((r) => !skip.has(r.conversation_id as string)).slice(0, HISTORY_READ);
  }
  const stored = stableWindow(kept.reverse(), HISTORY_LIMIT, HISTORY_STEP).map((r) => ({
    ...(r as StoredMessage & { wa_message_id: string | null }),
    reply_to: (r.payload as { reply_to?: string } | null)?.reply_to ?? null,
    notes: (r.payload as { notes?: string[] } | null)?.notes,
  }));
  const history = toModelHistory(orderReplies(stored));
  // Every message has already been answered (e.g. a retried delivery): nothing to say.
  if (history.at(-1)?.role !== "user") {
    return { reply: null, reactions: [], extras: {}, notes: [], usage: { input_tokens: 0, output_tokens: 0 }, afterReply: [] };
  }

  return runFauve({
    studioId: params.studioId,
    memberId: params.memberId,
    waId: params.waId,
    replyToMessageId: params.replyToMessageId,
    reactToRowId: params.reactToRowId,
    timezone: studio.data.timezone,
    reactions: [],
    extras: {},
    notes: [],
    afterReply: [],
    history,
    onEvent: params.onEvent,
    studio: {
      name: studio.data.name,
      businessType: (studio.data.business_type as string | null) ?? null,
      timezone: studio.data.timezone,
      onboardingStep: studio.data.onboarding_step,
      firstName: member.data?.first_name ?? null,
      instagram: (instagram.data?.handle as string | null | undefined) ?? null,
      tiktok: tiktokEnabled()
        ? {
            state: tiktok.data?.status === "connected" ? "connected" : tiktok.data?.status === "expired" ? "expired" : "not_connected",
            handle: (tiktok.data?.handle as string | null | undefined) ?? null,
            direct: tiktokDirectPost(),
          }
        : { state: "off", handle: null, direct: false },
      channel: params.channel ?? (params.waId ? "whatsapp" : "web"),
      montageEffort: effortSchema.catch(DEFAULT_EFFORT).parse(studio.data.montage_effort),
      known: {
        website: (studio.data.website_url as string | null) ?? null,
        booking: (studio.data.booking_url as string | null) ?? null,
        tone: ((brand.data as { tone?: string | null } | null)?.tone ?? null)?.slice(0, 300) ?? null,
        fonts: fontsLine(brand.data as { fonts?: unknown; font_twins?: unknown; custom_fonts?: unknown } | null),
        memory: readMemory(studio.data.memory).map((f) => f.fact),
      },
      work: describeJobs(jobs.map((j) => ({ ...j, title: j.postId ? jobTitles.get(j.postId) : undefined }))),
      voice: (() => {
        const setting = readVoiceSetting((brand.data as { voice?: unknown } | null)?.voice);
        return { use: setting.use, name: findVoice(setting.voice_id ?? DEFAULT_VOICE_ID)?.name ?? "sa voix" };
      })(),
      copying: copying ? { inspirationId: copying.id, name: copying.name, lines: copying.lines } : undefined,
      routine: await Promise.all([
        accessLine(params.studioId).catch(() => null),
        presenceLines(params.studioId).catch((error) => {
          console.warn("presence context failed", error);
          return [] as string[];
        }),
      ]).then(([access, presence]) => [...(access ? [access] : []), ...presence]),
    },
  });
}

/**
 * Her charter's fonts for the chat: the ones her visuals cannot load (not free) say which
 * twin replaces them, and Simone offers once to add the font file for the real one.
 */
function fontsLine(brand: { fonts?: unknown; font_twins?: unknown; custom_fonts?: unknown } | null): string | null {
  const fonts = Array.isArray(brand?.fonts) ? brand.fonts.filter((f): f is string => typeof f === "string") : [];
  if (!fonts.length) return null;
  const twins = brand?.font_twins && typeof brand.font_twins === "object" ? (brand.font_twins as Record<string, unknown>) : {};
  const own = new Set(
    (Array.isArray(brand?.custom_fonts) ? brand.custom_fonts : []).flatMap((f: unknown) =>
      f && typeof f === "object" && typeof (f as { family?: unknown }).family === "string" ? [(f as { family: string }).family.toLowerCase()] : [],
    ),
  );
  const replaced = fonts.filter((f) => typeof twins[f] === "string" && !own.has(f.toLowerCase()));
  const named = fonts.map((f) => (replaced.includes(f) ? `${f} (pas libre : ses visuels utilisent ${twins[f] as string}, qui lui ressemble)` : f));
  return `${named.join(", ")}.${replaced.length ? " Propose-lui une fois, en une phrase, d'ajouter le fichier de sa police dans Style › Tes polices (.ttf, .otf, .woff) pour avoir la vraie sur ses Reels et ses photos." : ""}`;
}
