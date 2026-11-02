// The quality her videos arrive in (Tristan: « le niveau de qualité d'une vidéo ne diminue pas vraiment sur WhatsApp si
// je les envoie direct »). WhatsApp has two qualities: standard compresses a phone video to about 1.7 Mb/s, HD keeps it
// close to the original (6 to 11 Mb/s measured on his, against 6 to 9 Mb/s sent from the app). Each video received is
// measured (its size, length and picture, read in its MP4 header): in HD, nothing is said and no upload link is added;
// compressed, she is told once how to set HD in WhatsApp, the upload link staying as a fallback.

/** Under this, a video came compressed (WhatsApp's standard quality is about 1.7 Mb/s). */
export const COMPRESSED_MBPS = 3;
/** A picture whose short side is under this came compressed too (480p). */
export const COMPRESSED_SHORT_SIDE = 600;

/** What she is told once, the first time a video of hers arrives compressed on WhatsApp. */
export const HD_TIP =
  "Petite astuce : WhatsApp compresse tes vidéos. Dans ses réglages, Stockage et données, mets « Qualité d'envoi des médias » sur HD, et elles m'arriveront en pleine qualité.";

export type VideoFacts = {
  duration: number | null;
  width: number | null;
  height: number | null;
};

/** An MP4 (or MOV) read in its header: its length (moov › mvhd) and its picture as shown (the video track's tkhd, turned). */
export function mp4Video(bytes: Uint8Array): VideoFacts {
  const facts: VideoFacts = { duration: null, width: null, height: null };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number) =>
    String.fromCharCode(
      bytes[at + 4]!,
      bytes[at + 5]!,
      bytes[at + 6]!,
      bytes[at + 7]!,
    );
  const boxes = function* (start: number, end: number) {
    let at = start;
    while (at + 8 <= end) {
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) return;
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) return;
      yield { kind: type(at), body: at + header, end: at + size };
      at += size;
    }
  };
  for (const box of boxes(0, bytes.length)) {
    if (box.kind !== "moov") continue;
    for (const child of boxes(box.body, box.end)) {
      if (child.kind === "mvhd" && child.body + 32 <= child.end) {
        const v1 = bytes[child.body] === 1;
        const timescale = view.getUint32(child.body + (v1 ? 20 : 12));
        const duration = v1
          ? Number(view.getBigUint64(child.body + 24))
          : view.getUint32(child.body + 16);
        if (timescale)
          facts.duration = Math.round((duration / timescale) * 1000) / 1000;
      }
      if (child.kind !== "trak" || facts.width) continue;
      for (const part of boxes(child.body, child.end)) {
        if (part.kind !== "tkhd") continue;
        const v1 = bytes[part.body] === 1;
        const matrix = part.body + (v1 ? 52 : 40);
        const size = matrix + 36;
        if (size + 8 > part.end) continue;
        const width = Math.round(view.getUint32(size) / 65536);
        const height = Math.round(view.getUint32(size + 4) / 65536);
        // An audio track has no picture; a phone video filmed upright is stored lying, turned by its matrix.
        if (!width || !height) continue;
        const turned =
          view.getInt32(matrix) === 0 && view.getInt32(matrix + 4) !== 0;
        facts.width = turned ? height : width;
        facts.height = turned ? width : height;
      }
    }
  }
  return facts;
}

/** Whether a video came compressed: null when it cannot be told (too short, nothing measured). */
export function compressedVideo(video: {
  bytes: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
}): boolean | null {
  const short =
    video.width && video.height ? Math.min(video.width, video.height) : null;
  if (short !== null && short < COMPRESSED_SHORT_SIDE) return true;
  if (!video.bytes || !video.duration || video.duration < 2)
    return short === null ? null : false;
  return (video.bytes * 8) / video.duration / 1e6 < COMPRESSED_MBPS;
}
