import { z } from "zod";

// What she asked for a Reel reaches every agent as she said it (Tristan: « l'information doit circuler correctement
// entre agents »). Each launch of its montage keeps the exchange that led to it on the post: her messages word for word,
// Simone's replies for context. Before, the agents only got Simone's summary: on the florist's Reel, « quelque part sur
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
 * A stored message as the log reads it; `launched`: Simone's reply of a turn that started a montage; `unprompted`: a
 * message she sent on her own (a delivery, a reminder, a nudge), with the post it is about.
 */
export type ExchangeRow = {
  direction: "inbound" | "outbound";
  type: string;
  body: string | null;
  created_at: string;
  launched?: boolean;
  unprompted?: { post?: string };
};

/** One message kept whole up to this length (Simone's plans are under 1 000 characters). */
const LINE_MAX = 1500;
/** One launch's exchange: its latest messages up to this length. */
const ENTRY_MAX = 8000;
/** The launches kept on a post. */
const ENTRIES_MAX = 12;
/** What the agents get of a Reel's request: its latest launches, whole, up to this length. */
export const REQUEST_MAX = 12000;
/** What they get of her words on her recent Reels. */
const RECENT_MAX = 2000;
/** The most of a montage's brief every agent reads: her exchange, Simone's brief and her recent words, whole. */
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
 * The exchange of a launch for `post`, from her messages and Simone's replies (oldest first): what was said since the
 * last montage launched in this thread (an earlier Reel's exchange is its own), its latest messages kept when it is long.
 * What Simone sent on her own about another post is left out: the florist's request carried the delivery of Inès's Reel
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
  return [head, ...entry.lines.map((l) => `${l.who === "elle" ? "Elle" : "Simone"} : ${l.text}`)].join("\n");
}

/**
 * What every agent gets as the request for one launch: her exchange with Simone for this Reel, word for word (its latest
 * launches whole), then Simone's brief for this launch as her reading of it, then what she said of her recent Reels (her
 * taste). Without an exchange kept, Simone's brief as it was.
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
      ? `Sa conversation avec Simone pour ce Reel, mot pour mot (ses messages et les réponses de Simone, dans l'ordre) : ce sont ses mots qui comptent, le brief de Simone plus bas en est la lecture.\n\n${kept.join("\n\n")}`
      : "",
    brief?.trim() ? `${kept.length ? "Le brief de Simone pour ce lancement" : "Le brief de Simone"} :\n${brief.trim()}` : "",
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
  return parts.length ? `Ce qu'elle a dit de ses Reels récents (ses goûts ; la demande de ce Reel passe avant) :\n${parts.join("\n")}` : "";
}
