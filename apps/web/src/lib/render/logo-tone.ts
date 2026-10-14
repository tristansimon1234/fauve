import "server-only";
import { logoOnDark, type LogoOnDark } from "@fauve/agent";
import sharp from "sharp";
import { fetchPublicImage } from "@/lib/agent/website";
import { supabaseAdmin } from "@/lib/supabase/admin";

// How the studio's logo shows on the Reel's dark end card, read once per logo
// from its pixels (a 64 px thumbnail) and kept while the server is warm.

const known = new Map<string, Promise<LogoOnDark>>();

async function read(source: { path: string } | { url: string }): Promise<LogoOnDark> {
  let bytes: Buffer;
  if ("path" in source) {
    const { data } = await supabaseAdmin().storage.from("media").download(source.path);
    if (!data) throw new Error("logo illisible");
    bytes = Buffer.from(await data.arrayBuffer());
  } else {
    bytes = await fetchPublicImage(source.url, AbortSignal.timeout(6000));
  }
  const { data } = await sharp(bytes).ensureAlpha().resize(64, 64, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  return logoOnDark(data);
}

/** The logo's tone; "as_is" when it cannot be read (the end card then shows it unchanged). */
export function logoTone(source: { path: string } | { url: string }): Promise<LogoOnDark> {
  const key = "path" in source ? source.path : source.url;
  let tone = known.get(key);
  if (!tone) {
    tone = read(source).catch((error: unknown) => {
      console.warn("logo tone unreadable", error);
      known.delete(key);
      return "as_is" as const;
    });
    known.set(key, tone);
  }
  return tone;
}
