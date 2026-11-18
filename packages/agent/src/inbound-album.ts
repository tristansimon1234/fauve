// Several photos or videos sent at once on WhatsApp arrive with one message more, just before the first file, that the
// Cloud API cannot describe (type « unsupported »): the album that holds them. Read as « a share from Instagram, a poll,
// a view-once », it had Edith answer « je n'ai pas vu ton partage Instagram » to each burst of videos (13 and 14 November;
// Tristan: « ça sort de nowhere »). Pure, read where her history is rebuilt (lib/agent/conversation.ts).

/** Seconds between an unreadable message and the file after it, under which it is that file's album. */
export const ALBUM_GAP_SECONDS = 20;

const FILES = new Set(["video", "image"]);

type Row = { direction: "inbound" | "outbound"; type: string; created_at?: string | null };

/** Whether row i is the album of the photos or videos right after it: unreadable, then one of her files within seconds. */
export function isAlbumWrapper(rows: readonly Row[], i: number): boolean {
  const row = rows[i];
  const next = rows[i + 1];
  if (!row || !next || row.direction !== "inbound" || row.type !== "unsupported") return false;
  if (next.direction !== "inbound" || !FILES.has(next.type)) return false;
  if (!row.created_at || !next.created_at) return true;
  const gap = (Date.parse(next.created_at) - Date.parse(row.created_at)) / 1000;
  return Number.isFinite(gap) && gap >= 0 && gap <= ALBUM_GAP_SECONDS;
}
