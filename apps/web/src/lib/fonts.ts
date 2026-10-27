import "server-only";
import { fontTwin, googleFamilyName, templateFonts, type MotionTemplate } from "@fauve/agent";
import { cacheLife } from "next/cache";

// The charter's fonts as a Reel (or a photo with its texts) can load them: from Google
// Fonts, or from a file she added (« Tes polices »). A site's font that Google does not
// serve (« fairplex », an Adobe Fonts family) would otherwise fall back to a generic
// sans-serif in the render: it gets its closest free twin, else the ambiance's font.

const FAMILY = /^[A-Za-z0-9 ]{2,40}$/;

/** Google Fonts' answer for one family: 200 when it serves it, 400 when it does not. Kept for weeks. */
async function servedByGoogle(family: string): Promise<boolean> {
  "use cache";
  cacheLife("weeks");
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Edith)" },
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 400) return false;
  // Anything else (a network hiccup) is not an answer: thrown, so it is not kept.
  if (!res.ok) throw new Error(`Google Fonts ${res.status}`);
  return true;
}

/** The name Google Fonts serves this family under (« playfair display » → « Playfair Display »), or null. */
export async function googleFont(family: string): Promise<string | null> {
  const name = family.trim();
  if (!FAMILY.test(name)) return null;
  for (const candidate of [...new Set([name, googleFamilyName(name)])]) {
    // Unreachable: the family is kept as it is (better than swapping on a hiccup).
    if (await servedByGoogle(candidate).catch(() => true)) return candidate;
  }
  return null;
}

export type FontSwap = { from: string; to: string };

/**
 * The charter's fonts, each one loadable: hers (a file she added), Google's, the twin Edith
 * chose by looking at her site (`twins`), a well-known twin, or the ambiance's for that role.
 */
export async function usableFonts(
  fonts: string[] | undefined,
  own: string[],
  template: MotionTemplate,
  twins: Record<string, string> = {},
): Promise<{ fonts: string[] | undefined; swaps: FontSwap[] }> {
  if (!fonts?.length) return { fonts, swaps: [] };
  const roles = templateFonts(template);
  const mine = new Set(own.map((f) => f.toLowerCase()));
  const chosen = new Map(Object.entries(twins).map(([from, to]) => [from.toLowerCase(), to]));
  const swaps: FontSwap[] = [];
  const usable = await Promise.all(
    fonts.map(async (family, i) => {
      if (mine.has(family.toLowerCase())) return family;
      const served = await googleFont(family);
      if (served) return served;
      const twin = chosen.get(family.toLowerCase()) ?? fontTwin(family);
      const to = (twin && (await googleFont(twin))) || (i === 0 ? roles.display : roles.body);
      swaps.push({ from: family, to });
      return to;
    }),
  );
  return { fonts: usable, swaps };
}
