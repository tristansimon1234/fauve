import { z } from "zod";
import { MAX_MONTAGE_FILES } from "./creation.ts";
import { exchangeFiles, type ExchangeRow } from "./request-log.ts";
import type { ReplyExtras } from "./schemas.ts";

// Her médiathèque to pick from (reply_with pick_media; docs/whatsapp.md, « Choisir dans sa médiathèque depuis
// WhatsApp »). In the app, a card under Edith's message; on WhatsApp, a page of her phone (/choisir) behind the
// button « Choisir mes fichiers » (Tristan, 10 November: « il faut pas me montrer la bibliothèque », when Edith
// answered « Je peux pas choisir les vidéos ? » with her upload link). Either way her pick comes back as her own
// message with the media_ids in order, which Edith reads as the files of the post she is making (exchangeFiles).

export const PICK_KINDS = ["video", "photo", "any"] as const;
export const pickKindSchema = z.enum(PICK_KINDS);
export type PickKind = z.infer<typeof pickKindSchema>;

/** Files in one pick: as many as a montage takes. */
export const MAX_PICK = MAX_MONTAGE_FILES;

type PageButton = NonNullable<ReplyExtras["link"]>;

/** Her médiathèque on her phone, behind a WhatsApp button (20 characters at most). */
export const pickButton = (kind: PickKind): PageButton => ({ path: kind === "any" ? "/choisir" : `/choisir?type=${kind}`, label: "Choisir mes fichiers", purpose: "pick" });

/** Her pick, as her message in the conversation: the same words from the app's card and from her phone's page. */
export function pickedLine(ids: string[]): string {
  const n = ids.length;
  return `Je prends ${n === 1 ? "celle-ci" : `ces ${n}`} dans la médiathèque, dans cet ordre (media_id : ${ids.join(", ")}).`;
}

/** Her pick kept as she made it: in her order, each file once, only hers, MAX_PICK at most. */
export function ownPick(ids: string[], owned: Iterable<string>): string[] {
  const hers = new Set([...owned].map((id) => id.toLowerCase()));
  return [...new Set(ids.map((id) => id.toLowerCase()))].filter((id) => hers.has(id)).slice(0, MAX_PICK);
}

/**
 * The page behind the button under Edith's WhatsApp message: the one a tool chose (her médiathèque to pick from,
 * the ideas, a publication…), else her upload link when she asked for files (full quality from her gallery, WhatsApp
 * compressing videos; none while her videos arrive in HD), else the page of the one publication she talks about.
 */
export function whatsappButton(extras: Pick<ReplyExtras, "link" | "upload" | "posts">, videos: "full" | "compressed" | null): PageButton | null {
  if (extras.link) return extras.link;
  if (extras.upload && videos !== "full") return { path: "/depot", label: "Envoyer mes fichiers", purpose: "upload" };
  if (extras.posts?.length === 1) return { path: `/v/${extras.posts[0]}`, label: "Voir la publication", purpose: "open_post" };
  return null;
}

/**
 * The three doors of a new Reel (reply_with doors) wait for her files of this Reel, sent or picked: « Fais-moi
 * confiance » plans with them and the ideas fit them. Asked for a Reel « avec des vidéos de ma bibliothèque », Edith
 * had put the doors to her before her library (Tristan: « il faut pas me montrer la bibliothèque »).
 */
export const doorsReady = (rows: ExchangeRow[]): boolean => exchangeFiles(rows).size > 0;
