import "server-only";
import { tiktokDirectPost, tiktokEnabled } from "@/lib/social/tiktok";
import type Anthropic from "@anthropic-ai/sdk";
import {
  DAILY_CAP_REPLY,
  DEFAULT_EFFORT,
  DEFAULT_VOICE_ID,
  effortSchema,
  findVoice,
  finishDefaultWords,
  orderReplies,
  memoryLines,
  readOwnVoice,
  readVoiceSetting,
  reelFinishSchema,
  reelLookSchema,
  stableWindow,
  type ExchangeRow,
} from "@fauve/agent";
import { dayOfTurns } from "@/lib/reply-cap";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runFauve, type RunFauveInput, type RunFauveResult } from "./run";
import { describeJobs, runningJobs } from "@/lib/studio-jobs";
import { presenceLines } from "@/lib/nudge";
import { accessLine } from "@/lib/billing/access";
import { studioModels } from "@/lib/reel-models";
import { pendingSteal } from "@/lib/steal";

// Shared by every channel (WhatsApp webhook, web test chat): rebuild the
// conversation from stored messages and let Fauve answer the last one.

const HISTORY_LIMIT = 20;
/** The history's start moves by about this many messages at a time (prompt cache, `stableWindow`). */
const HISTORY_STEP = 10;
/** Rows read to find the window's start. */
const HISTORY_READ = HISTORY_LIMIT + 4 * HISTORY_STEP;
/** A conversation about one publication also reads this much of what was said before it elsewhere (its Reel was asked there). */
const POST_CONTEXT = 16;
/** A message that does not look finished (cut on a comma, on « et »…) waits this long for the rest before Edith answers. */
const UNFINISHED_WAIT_MS = 12_000;
/** The end of a message that announces more to come. */
const UNFINISHED = /(?:[,:;]|\b(?:et|mais|ou|donc|du coup|genre|avec|puis))\s*$/i;
/**
 * Longer earlier messages (a pasted text) are cut in the history. Edith's plans and deliveries run to
 * 1,300 characters and are kept whole: at 700, a third of them lost their end, and so did a request of
 * 715 characters she was answering, which she took for a message cut by its sender and asked her to resend.
 */
const MESSAGE_MAX_CHARS = 2000;

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
  // The messages she is answering now (after Edith's last one) are read whole, however long.
  const answering = rows.findLastIndex((r) => r.direction === "outbound") + 1;
  for (const [i, row] of rows.entries()) {
    const role = row.direction === "inbound" ? "user" : "assistant";
    const label = row.direction === "inbound" ? mediaLabels[row.type] : undefined;
    // A voice note whose words could not be read: Edith says so instead of guessing.
    const unheard = row.direction === "inbound" && row.type === "audio" && !row.body ? " · tu n'as pas pu l'écouter : dis-le-lui et demande-lui de l'écrire" : "";
    const text = [label && `[${label}${row.media_id ? ` · media_id ${row.media_id}` : ""}${unheard}]`, row.body]
      .filter(Boolean)
      .join(" ");
    if (!text) continue;
    // Said where it is cut: a bare « … » reads as a message its sender cut.
    const cut = i < answering && text.length > MESSAGE_MAX_CHARS ? `${text.slice(0, MESSAGE_MAX_CHARS)}… [la suite est coupée dans ton historique]` : text;
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
  channel?: "whatsapp" | "web";
  /** Live events of the turn (the app's chat). */
  onEvent?: RunFauveInput["onEvent"];
}): Promise<RunFauveResult> {
  const db = supabaseAdmin();
  // A chat the manager started fresh in the web app is its own context (and
  // costs fewer tokens); otherwise Fauve keeps the studio's recent history.
  let conversations = db
    .from("conversations")
    .select("id, started_by, post_id")
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
    .select("id, direction, type, body, media_id, wa_message_id, payload, conversation_id, reactions, created_at")
    .eq("studio_id", params.studioId)
    .order("created_at", { ascending: false })
    // WhatsApp keeps the studio's recent thread across conversations, minus the ones opened in the app: read a little more, then filter.
    .limit(ownThread ? HISTORY_READ : HISTORY_READ * 2);
  if (ownThread) messages = messages.eq("conversation_id", conversation.id);

  const [studio, member, rows, instagram, brand, jobs, tiktok, copying, models] = await Promise.all([
    db.from("studios").select("name, business_type, timezone, onboarding_step, montage_effort, website_url, booking_url, memory, team, subscription_status").eq("id", params.studioId).single(),
    db.from("members").select("first_name").eq("id", params.memberId).single(),
    messages,
    db.from("social_accounts").select("handle").eq("studio_id", params.studioId).eq("platform", "instagram").eq("status", "connected").maybeSingle(),
    db.from("brand_profiles").select("profile->>tone, profile->voice, profile->own_voice, profile->fonts, profile->font_twins, profile->custom_fonts, profile->look, profile->finish").eq("studio_id", params.studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    runningJobs(params.studioId).catch(() => []),
    db.from("social_accounts").select("handle, status").eq("studio_id", params.studioId).eq("platform", "tiktok").maybeSingle(),
    // The Reel she sent to copy (« Steal »), for her next Reel only.
    pendingSteal(params.studioId).catch(() => null),
    // Her Reels kept as models, to make new ones like them.
    studioModels(params.studioId, 5).catch(() => []),
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
  // A conversation opened on one publication (from its page) starts empty: it also reads what was said just
  // before elsewhere, where that Reel was asked for (« 50/50, c'est quoi ? » came from a thread that knew nothing).
  if (ownThread && conversation?.post_id) {
    const { data: before } = await db
      .from("whatsapp_messages")
      .select("id, direction, type, body, media_id, wa_message_id, payload, conversation_id, reactions, created_at")
      .eq("studio_id", params.studioId)
      .neq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(POST_CONTEXT);
    kept = [...kept, ...(before ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, HISTORY_READ);
  }
  if (!ownThread) {
    const ids = [...new Set(kept.map((r) => r.conversation_id as string | null).filter((id): id is string => Boolean(id)))];
    const { data: separate } = ids.length
      ? await db.from("conversations").select("id").in("id", ids).or("started_by.eq.web,post_id.not.is.null")
      : { data: [] };
    const skip = new Set((separate ?? []).map((c) => c.id as string));
    kept = kept.filter((r) => !skip.has(r.conversation_id as string)).slice(0, HISTORY_READ);
  }
  // A copy: `kept` stays newest first (her latest message, the words this turn answers).
  const stored = stableWindow([...kept].reverse(), HISTORY_LIMIT, HISTORY_STEP).map((r) => ({
    ...(r as StoredMessage & { wa_message_id: string | null }),
    reply_to: (r.payload as { reply_to?: string } | null)?.reply_to ?? null,
    notes: (r.payload as { notes?: string[] } | null)?.notes,
  }));
  const history = toModelHistory(orderReplies(stored));
  const silent: RunFauveResult = { reply: null, reactions: [], extras: {}, notes: [], usage: { input_tokens: 0, output_tokens: 0 }, afterReply: [] };
  // Every message has already been answered (e.g. a retried delivery): nothing to say.
  if (history.at(-1)?.role !== "user") return silent;
  // A message cut on a comma (« il faut que ça reprenne le parcours global, ») is waited on: when the rest comes,
  // its own turn answers both together (a Reel had been launched on half a sentence, then again on the whole).
  const latest = kept[0];
  if (latest?.direction === "inbound" && typeof latest.body === "string" && UNFINISHED.test(latest.body.trim())) {
    await new Promise((resolve) => setTimeout(resolve, UNFINISHED_WAIT_MS));
    let newer = db.from("whatsapp_messages").select("id").eq("studio_id", params.studioId).eq("direction", "inbound").gt("created_at", latest.created_at as string).limit(1);
    if (ownThread && conversation) newer = newer.eq("conversation_id", conversation.id);
    if ((await newer).data?.length) return silent;
  }

  // Her day's turns used up (a number writing in a loop, or spam): said once, then nothing until tomorrow.
  const day = await dayOfTurns(params.studioId, studio.data);
  if (day === "silent") return silent;
  if (day === "notice") return { ...silent, reply: DAILY_CAP_REPLY, extras: { kind: "daily_cap" } };

  return runFauve({
    studioId: params.studioId,
    memberId: params.memberId,
    waId: params.waId,
    replyToMessageId: params.replyToMessageId,
    reactToRowId: params.reactToRowId,
    // In the app, what she starts here is delivered here (WhatsApp delivers on WhatsApp).
    conversationId: params.waId ? undefined : conversation?.id,
    // The conversation this turn answers (her latest message's): a montage launched now keeps its exchange for every
    // agent. On WhatsApp the history spans her earlier conversations, whose talk was about other things.
    exchange: [...kept]
      .reverse()
      .filter((r) => !latest?.conversation_id || r.conversation_id === latest.conversation_id)
      .map(toExchange),
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
        memory: memoryLines(studio.data.memory),
      },
      work: describeJobs(jobs.map((j) => ({ ...j, title: j.postId ? jobTitles.get(j.postId) : undefined }))),
      voice: (() => {
        const setting = readVoiceSetting((brand.data as { voice?: unknown } | null)?.voice);
        // Her own voice (a clone made in Style) is named so: Edith knows she can lay it.
        const own = readOwnVoice((brand.data as { own_voice?: unknown } | null)?.own_voice);
        const name = own && setting.voice_id === own.id ? "sa propre voix (clonée)" : (findVoice(setting.voice_id ?? DEFAULT_VOICE_ID)?.name ?? "sa voix");
        return { use: setting.use, name: own && setting.voice_id !== own.id ? `${name} (elle a aussi cloné sa propre voix : voice « sa voix »)` : name };
      })(),
      copying: copying ? { inspirationId: copying.id, name: copying.name, lines: copying.lines } : undefined,
      models: models.map((m) => ({ inspirationId: m.id, title: m.title, name: m.name })),
      defaults: (() => {
        // Her look and finishing touches for all her Reels, when she set some (set_look, set_finish without a Reel).
        const profile = brand.data as { look?: unknown; finish?: unknown } | null;
        const look = reelLookSchema.safeParse(profile?.look);
        const finish = reelFinishSchema.safeParse(profile?.finish ?? {});
        return [...(look.success ? [`look « ${look.data.name} »`] : []), ...finishDefaultWords(finish.success ? finish.data : undefined)];
      })(),
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

/** Edith's notes of a turn that started work (a montage, a carousel, an effect's words): what was asked before was for it. */
const LAUNCHED = /lancée? (job|quote_id)=|(carrousel|mots de l'effet) en cours/;

/** What Edith sends on her own, outside a turn: a reminder to post, a nudge, the team's alerts. */
const UNPROMPTED = new Set(["reminder", "nudge", "daily_cap", "new_numbers_alert"]);

/**
 * A stored message as a launch's exchange reads it: Edith's reply of a turn that started work marks where it begins;
 * a message she sent on her own (a delivery, a reminder) says which post it is about.
 */
function toExchange(row: { direction: string; type: string; body: string | null; created_at: string; payload: unknown }): ExchangeRow {
  const payload = row.payload as { quote?: unknown; notes?: string[]; open_post?: unknown; kind?: unknown } | null;
  const outbound = row.direction === "outbound";
  const launched = outbound && Boolean(payload?.quote || payload?.notes?.some((n) => LAUNCHED.test(n)));
  const unprompted = outbound && Boolean(payload?.open_post || (typeof payload?.kind === "string" && UNPROMPTED.has(payload.kind)));
  return {
    direction: outbound ? "outbound" : "inbound",
    type: row.type,
    body: row.body,
    created_at: row.created_at,
    ...(launched ? { launched } : {}),
    ...(unprompted ? { unprompted: typeof payload?.open_post === "string" ? { post: payload.open_post } : {} } : {}),
  };
}

/**
 * Her charter's fonts for the chat: the ones her visuals cannot load (not free) say which
 * twin replaces them, and Edith offers once to add the font file for the real one.
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
