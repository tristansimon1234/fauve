import { z } from "zod";

// What she asked for a Reel reaches every agent as she said it (Tristan: « l'information doit circuler correctement
// entre agents »). Each launch of its montage keeps the exchange that led to it on the post: her messages word for word,
// Edith's replies for context. Before, the agents only got Edith's summary: on the florist's Reel, « quelque part sur
// l'écran où elles écrivent sur WhatsApp » became « textes animés en bas », and his « les animations en haut », said that
// day of another Reel, reached none of them.

/** One line of an exchange: who said it, and what, as written (a voice note's words). */
export const requestLineSchema = z.object({
  who: z.enum(["elle", "simone"]),
  text: z.string(),
  at: z.string().optional(),
});
export type RequestLine = z.infer<typeof requestLineSchema>;

/** One launch of a Reel's montage: where it was asked (the chat, the « Créer » screen, a button of its page) and the exchange. */
export const requestEntrySchema = z.object({
  at: z.string(),
  via: z.enum(["chat", "create", "page"]),
  lines: z.array(requestLineSchema),
});
export type RequestEntry = z.infer<typeof requestEntrySchema>;

/** `posts.request_log`, read leniently: an entry it cannot read is left out. */
export const requestLogSchema = z.array(requestEntrySchema.nullable().catch(null)).catch([]).transform((log) => log.filter((e): e is RequestEntry => e !== null));

/**
 * A stored message as the log reads it; `launched`: Edith's reply of a turn that started a montage; `unprompted`: a
 * message she sent on her own (a delivery, a reminder, a nudge), with the post it is about.
 */
export type ExchangeRow = {
  direction: "inbound" | "outbound";
  type: string;
  body: string | null;
  created_at: string;
  /** A file she sent with this message. */
  media_id?: string | null;
  launched?: boolean;
  /** Edith's message that put a post's plan to her (reply_with plan: its « C'est parti » / « Changer le plan » buttons). */
  plan?: boolean;
  /** That plan's sound, for a Reel: with a voice over or not (reply_with plan, voix_off). */
  planVoice?: boolean;
  unprompted?: { post?: string };
};

/** One message kept whole up to this length (Edith's plans are under 1 000 characters). */
const LINE_MAX = 1500;
/** One launch's exchange: its latest messages up to this length. */
const ENTRY_MAX = 8000;
/** The launches kept on a post. */
const ENTRIES_MAX = 12;
/** What the agents get of a Reel's request: its latest launches, whole, up to this length. */
export const REQUEST_MAX = 12000;
/** What they get of her words on her recent Reels. */
const RECENT_MAX = 2000;
/** The most of a montage's brief every agent reads: her exchange, Edith's brief and her recent words, whole. */
export const BRIEF_MAX = 18000;

const MEDIA: Record<string, string> = {
  video: "[elle envoie une vidéo]",
  image: "[elle envoie une photo]",
  document: "[elle envoie un fichier]",
  sticker: "[sticker]",
  audio: "[message vocal]",
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text);

/**
 * The exchange of a launch for `post`, from her messages and Edith's replies (oldest first): what was said since the
 * last montage launched in this thread (an earlier Reel's exchange is its own), its latest messages kept when it is long.
 * What Edith sent on her own about another post is left out: the florist's request carried the delivery of Inès's Reel
 * and the reminder of a third one.
 */
export function exchangeLines(rows: ExchangeRow[], post?: string): RequestLine[] {
  const relevant = rows.filter((row) => !row.unprompted || (post !== undefined && row.unprompted.post === post));
  const start = relevant.reduce((at, row, i) => (row.launched ? i + 1 : at), 0);
  const lines = relevant.slice(start).flatMap((row): RequestLine[] => {
    const inbound = row.direction === "inbound";
    const body = row.body?.trim() ?? "";
    const media = inbound ? MEDIA[row.type] : undefined;
    // A voice note is its words; a file, what it is (her caption after it).
    const text = [media && !(row.type === "audio" && body) ? media : undefined, body].filter(Boolean).join(" ");
    return text ? [{ who: inbound ? "elle" : "simone", text: clip(text, LINE_MAX), at: row.created_at }] : [];
  });
  const kept: RequestLine[] = [];
  let length = 0;
  for (const line of [...lines].reverse()) {
    if (length + line.text.length > ENTRY_MAX && kept.length) break;
    kept.unshift(line);
    length += line.text.length;
  }
  return kept;
}

/** The post's log with this launch added (its latest launches kept). */
export function withEntry(log: RequestEntry[], entry: RequestEntry): RequestEntry[] {
  return [...log, entry].slice(-ENTRIES_MAX);
}

const VIA = { chat: "dans la conversation", create: "depuis l'écran « Créer »", page: "depuis la page de la publication" } as const;

function entryText(entry: RequestEntry, index: number): string {
  const head = `[${index === 0 ? "Demande" : `Correction ${index}`}, ${VIA[entry.via]}]`;
  return [head, ...entry.lines.map((l) => `${l.who === "elle" ? "Elle" : "Edith"} : ${l.text}`)].join("\n");
}

/** The headers of a launch's brief (requestBrief), read back by ownRequestWords. */
const EXCHANGE_HEAD = "Sa conversation avec Edith pour ce Reel, mot pour mot";
const BRIEF_HEAD = /^Le brief d'Edith(?: pour ce lancement)? :$/;
const RECENT_HEAD = "Ce qu'elle a dit de ses Reels récents";

/**
 * What she asked for this Reel, in a launch's brief (requestBrief): her own messages of this Reel's exchange and Edith's
 * brief (her reading of them), without Edith's replies nor what she said of her other Reels; a brief without an exchange
 * (the lab's idea, an older launch) is read whole, her other Reels left out. What decides a form from her words
 * (« sois créatif »: no model, house-pick.ts) reads this, never an earlier Reel's words nor Edith's (« je crée ton Reel »).
 */
export function ownRequestWords(brief: string | null | undefined): string {
  const text = (brief ?? "").split(`\n\n${RECENT_HEAD}`)[0]!.replace(new RegExp(`^${RECENT_HEAD}[^]*$`), "");
  if (!text.startsWith(EXCHANGE_HEAD)) return text.trim();
  const kept: string[] = [];
  let who: "elle" | "edith" | "brief" | null = null;
  for (const line of text.split("\n").slice(1)) {
    if (BRIEF_HEAD.test(line.trim())) who = "brief";
    else if (who !== "brief" && line.startsWith("Elle : ")) {
      who = "elle";
      kept.push(line.slice(7));
    } else if (who !== "brief" && (line.startsWith("Edith : ") || /^\[(Demande|Correction \d+), /.test(line))) who = "edith";
    else if (who === "elle" || who === "brief") kept.push(line);
  }
  return kept.join("\n").trim();
}

/**
 * What every agent gets as the request for one launch: her exchange with Edith for this Reel, word for word (its latest
 * launches whole), then Edith's brief for this launch as her reading of it, then what she said of her recent Reels (her
 * taste). Without an exchange kept, Edith's brief as it was.
 */
export function requestBrief(log: RequestEntry[], brief: string | undefined, recent: { title: string; log: RequestEntry[] }[] = []): string | undefined {
  const entries = log.map(entryText);
  const kept: string[] = [];
  let length = 0;
  for (const text of [...entries].reverse()) {
    if (length + text.length > REQUEST_MAX && kept.length) break;
    kept.unshift(text);
    length += text.length;
  }
  const taste = recentWords(recent);
  if (!kept.length && !taste) return brief;
  return [
    kept.length
      ? `${EXCHANGE_HEAD} (ses messages et les réponses d'Edith, dans l'ordre) : ce sont ses mots qui comptent, le brief d'Edith plus bas en est la lecture.\n\n${kept.join("\n\n")}`
      : "",
    brief?.trim() ? `${kept.length ? "Le brief d'Edith pour ce lancement" : "Le brief d'Edith"} :\n${brief.trim()}` : "",
    taste,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Her own words on her latest Reels (newest first), for her taste: what this Reel's request says comes first. */
function recentWords(recent: { title: string; log: RequestEntry[] }[]): string {
  const parts: string[] = [];
  let length = 0;
  for (const reel of recent) {
    const said = reel.log.flatMap((e) => e.lines.filter((l) => l.who === "elle").map((l) => l.text)).join(" / ");
    if (!said) continue;
    const part = `« ${reel.title} » : ${clip(said, 700)}`;
    if (length + part.length > RECENT_MAX) break;
    parts.push(part);
    length += part.length;
  }
  return parts.length ? `${RECENT_HEAD} (ses goûts ; la demande de ce Reel passe avant) :\n${parts.join("\n")}` : "";
}

/** Her messages since the last montage launched in this exchange. */
function sinceLaunch(rows: ExchangeRow[]): ExchangeRow[] {
  const start = rows.reduce((at, row, i) => (row.launched ? i + 1 : at), 0);
  return rows.slice(start);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * The files of this exchange: the ones she sent, or picked in her media library (their ids in her message), since the
 * last launch. A new Reel takes only these (or the post's own): Edith's launch Reel had been started with twenty photos
 * sent for other Reels.
 */
export function exchangeFiles(rows: ExchangeRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of sinceLaunch(rows)) {
    if (row.direction !== "inbound") continue;
    if (row.media_id) ids.add(row.media_id.toLowerCase());
    for (const m of (row.body ?? "").matchAll(UUID)) ids.add(m[0].toLowerCase());
  }
  return ids;
}

/**
 * A plan put to her since the last launch: Edith's plan with its buttons (reply_with plan), or a message of the
 * « Nouvelle publication » screen, whose plan she validated there. A fact the code knows, never her words read with a
 * list of keywords (Tristan: « les règles déterministes de ce type j'y crois pas »): whether her answer is a yes stays
 * Edith's call. Edith had launched a Reel without any plan, with twenty photos sent for other Reels.
 */
export function planShown(rows: ExchangeRow[]): boolean {
  return sinceLaunch(rows).some((r) => (r.direction === "outbound" && r.plan) || (r.direction === "inbound" && /^(Le plan validé|Nouvelle publication)/m.test(r.body ?? "")));
}

/**
 * The sound of the last plan put to her since the last launch, once she answered it: with a voice over (true), without
 * (false), or nothing said. Her « C'est parti » launches the plan as it was shown (Tristan: « ok » to « "C'est parti"
 * applique tout »): Edith no longer has to set it again, and her words since still come first (reelVoiceChoice).
 */
export function validatedPlanVoice(rows: ExchangeRow[]): boolean | undefined {
  const since = sinceLaunch(rows);
  let at = -1;
  since.forEach((r, i) => {
    if (r.direction === "outbound" && r.plan) at = i;
  });
  if (at < 0 || !since.slice(at + 1).some((r) => r.direction === "inbound")) return undefined;
  return since[at]!.planVoice;
}
