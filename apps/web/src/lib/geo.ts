import "server-only";
import {
  addressIn,
  coordinatesText,
  GEO_USER_AGENT,
  htmlToText,
  memoryLines,
  nominatimUrl,
  placeCoordinates,
  readNominatim,
  siteAddressLines,
  studioPlaceSchema,
  type StudioPlace,
} from "@fauve/agent";
import { readPublicPage } from "@/lib/agent/website";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her place as coordinates (packages/agent/src/geo.ts): the postal address she gave, in her facts or on her site,
// geocoded once by OpenStreetMap's Nominatim and cached on the studio (studios.place), for a model whose labels show
// where she is (« Fenêtres et étiquettes »). Free, no key; its usage policy kept: a User-Agent naming the app, one
// request per address, never two within a second. Never a made-up value: no coordinates when her door is not found.

/** The last request to Nominatim from this instance: one a second at most (its usage policy). */
let lastAsked = 0;

/** Her address, from her facts first, then from her site's page (read once per site): null when none is precise enough. */
async function findAddress(memory: unknown, site: string | null, cached: StudioPlace | null): Promise<{ address: ReturnType<typeof addressIn>; site?: string }> {
  const fromFacts = addressIn(memoryLines(memory));
  if (fromFacts || !site) return { address: fromFacts };
  // Her site was already read for it: what it had (or not), never read again until it changes.
  if (cached?.site === site) return { address: cached.address ? addressIn([cached.address]) : null, site };
  try {
    const page = await readPublicPage(site, AbortSignal.timeout(8_000));
    return { address: addressIn([...siteAddressLines(page.body), htmlToText(page.body)]), site };
  } catch (error) {
    console.warn("geo: her site could not be read for her address", site, error instanceof Error ? error.message : error);
    return { address: null };
  }
}

/**
 * Her place's coordinates and the label a model writes of them (« 48.8772° N, 2.3394° E »), or null when no precise
 * address of hers is known or Nominatim did not find her door. One request per address, ever: its answer (found or not)
 * is kept on the studio; a network failure is not kept, so a later montage asks again.
 */
export async function studioPlace(studioId: string): Promise<{ address: string; lat: number; lon: number; label: string } | null> {
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("memory, website_url, place").eq("id", studioId).maybeSingle();
  if (!studio) return null;
  const cached = studioPlaceSchema.nullable().catch(null).parse(studio.place ?? null);
  const { address, site } = await findAddress(studio.memory, (studio.website_url as string | null) ?? null, cached);
  const at = new Date().toISOString();
  if (!address) {
    // Nothing precise enough: kept, so her site is not read again for it (her facts are read each time, for free).
    if (site && cached?.site !== site) await db.from("studios").update({ place: { address: null, site, at } satisfies StudioPlace }).eq("id", studioId);
    return null;
  }
  // The same address as last time: its answer as kept, found or not.
  if (cached?.address === address.line) {
    const known = placeCoordinates(cached);
    return known ? { address: address.line, ...known, label: coordinatesText(known) } : null;
  }
  const wait = lastAsked + 1_100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastAsked = Date.now();
  let answer: unknown;
  try {
    const res = await fetch(nominatimUrl(address), { headers: { "user-agent": GEO_USER_AGENT, accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    answer = await res.json();
  } catch (error) {
    console.warn("geo: her address could not be geocoded now", address.line, error instanceof Error ? error.message : error);
    return null;
  }
  const found = readNominatim(answer, address);
  const place: StudioPlace = { address: address.line, ...(found ? { lat: found.lat, lon: found.lon } : { none: true }), ...(site ? { site } : {}), at };
  await db.from("studios").update({ place }).eq("id", studioId);
  if (!found) console.log("geo: Nominatim did not find her door, no coordinates", studioId, address.line);
  return found ? { address: address.line, ...found, label: coordinatesText(found) } : null;
}
