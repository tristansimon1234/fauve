import { z } from "zod";

// Her place as coordinates (« Fenêtres et étiquettes », docs/fiches/fenetres.md, effect 1: its labels show her place's
// coordinates with four decimals, nothing invented). The postal address she gave, found in her facts (what she told
// Edith, what Edith read on her site) or on her site's page, is geocoded once by OpenStreetMap's Nominatim, as its usage
// policy asks (https://operations.osmfoundation.org/policies/nominatim/): a User-Agent naming the app, never an email,
// one request per address, its answer cached on the studio, never more than one a second. Its answer is kept only when
// it found her very address (the number she gave on her street, her postcode); else there are no coordinates, never a
// street's or a town's middle passed off as hers. Pure functions: the request and its cache live in apps/web (lib/geo.ts).

/** How Edith names itself to Nominatim: the app and its site, never a person or an email (its usage policy). */
export const GEO_USER_AGENT = "Edith/1.0 (+https://edith-ai.app)";
/** Nominatim's search, OpenStreetMap's free geocoder. */
export const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

/**
 * The kinds of street of a postal address (French, Belgian, Swiss), as written in a fact or on a site. The plain ones
 * are streets whatever follows; the others (« cours », « passage », « route »…) are words of a sentence too (« 12 cours
 * de yoga par semaine »): they are an address only with a postcode.
 */
const PLAIN_STREETS = "rue|ruelle|venelle|avenue|av\\.|boulevard|bd|quai|impasse|all[ée]e|faubourg|fbg|rond-point|esplanade|parvis|chauss[ée]e|dr[èe]ve|place|pl\\.";
const LOOSE_STREETS = "chemin|route|cours|passage|square|villa|cit[ée]|sentier|promenade|mont[ée]e|r[ée]sidence|galerie|carrefour|mail|traverse";
/** A number on a street (« 12 », « 3 bis », « 14B »), then the kind of street, then its name. */
const ANCHOR = new RegExp(`(?<![\\p{L}\\d])(\\d{1,4}(?:\\s?(?:bis|ter|quater|[a-d]))?)\\s*,?\\s+(${PLAIN_STREETS}|${LOOSE_STREETS})\\s+`, "giu");
const LOOSE = new RegExp(`^(?:${LOOSE_STREETS})$`, "iu");
/** The street's name: up to a comma, a postcode, « à » and its town, a dash, a full stop or the end. */
const STREET_NAME = /^([\p{L}'\- ]{2,60}?)(?=\s*(?:,|\s\d{4,5}(?!\d)|\sà\s|\s[–-]\s|[.;:!?()]|$))/u;
/** A town's name: capitalised, a few words at most (« Paris », « Saint-Ouen », « Aix-en-Provence », « Le Pré-Saint-Gervais »). */
const TOWN = "(\\p{Lu}[\\p{L}'\\-]+(?:\\s\\p{Lu}[\\p{L}'\\-]+){0,2})";
const POSTCODE_TOWN = new RegExp(`^\\s*[,–-]?\\s*(\\d{4,5})\\s+${TOWN}`, "u");
const COMMA_TOWN = new RegExp(`^\\s*(?:,\\s*|\\s+)(?:à\\s+)?${TOWN}`, "u");
/** Words of a sentence that never make a street's name or a town (« 12 cours de yoga par semaine, Nous ouvrons »). */
const NOT_A_NAME = /\b(?:par|pour|avec|chaque|semaine|semaines|mois|jours?|heures?|minutes?|séances?|élèves?|personnes?|places?|euros?|offerts?|gratuits?)\b/iu;
const NOT_A_TOWN = /^(?:Nous|On|Ouvert|Ouverte|Tous|Tél|Tel|Le|La|Les|Du|De|Des|Et|Ou|Au|Aux|En|Sur|Pour|Avec|Depuis|Contact|Horaires)$/u;

/** A postal address: its number on its street, its street, its postcode and its town, as written. */
export type PostalAddress = { number: string; street: string; postcode: string | null; town: string; line: string };

const tidy = (s: string) => s.replace(/[’]/g, "'").replace(/\s+/g, " ").trim();

/**
 * The first postal address in these texts (her facts first, then her site's): a number, a street, then a postcode and a
 * town, or a town after a comma or « à ». Never a street without its number, nor a town alone: only an address precise
 * enough to be her door. Null when none.
 */
export function addressIn(texts: string[]): PostalAddress | null {
  for (const raw of texts) {
    const text = tidy(raw);
    for (const m of text.matchAll(ANCHOR)) {
      const rest = text.slice(m.index + m[0].length);
      const name = STREET_NAME.exec(rest);
      if (!name || NOT_A_NAME.test(name[1]!)) continue;
      const after = rest.slice(name[0].length);
      const coded = POSTCODE_TOWN.exec(after);
      const plain = coded ? null : COMMA_TOWN.exec(after);
      // A loose kind of street (« cours », « route ») only with a postcode; a town is a name, never the next sentence.
      if (!coded && (!plain || LOOSE.test(m[2]!))) continue;
      const town = (coded?.[2] ?? plain?.[1] ?? "").trim();
      if (!town || NOT_A_TOWN.test(town.split(" ")[0]!)) continue;
      const number = m[1]!.replace(/\s+/g, " ");
      const street = `${m[2]!.toLowerCase()} ${name[1]!.trim()}`;
      const postcode = coded?.[1] ?? null;
      return { number, street, postcode, town, line: `${number} ${street}, ${postcode ? `${postcode} ` : ""}${town}` };
    }
  }
  return null;
}

/** The addresses in a page's structured data (schema.org PostalAddress in its JSON-LD), as lines addressIn reads. */
export function siteAddressLines(html: string): string[] {
  const lines: string[] = [];
  for (const block of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(block[1]!.trim());
    } catch {
      continue;
    }
    const walk = (node: unknown, depth: number): void => {
      if (!node || typeof node !== "object" || depth > 6) return;
      if (Array.isArray(node)) return node.slice(0, 40).forEach((n) => walk(n, depth + 1));
      const o = node as Record<string, unknown>;
      const street = typeof o.streetAddress === "string" ? o.streetAddress : null;
      const town = typeof o.addressLocality === "string" ? o.addressLocality : null;
      if (street && town) lines.push(`${street}, ${typeof o.postalCode === "string" || typeof o.postalCode === "number" ? `${o.postalCode} ` : ""}${town}`);
      for (const v of Object.values(o)) walk(v, depth + 1);
    };
    walk(data, 0);
  }
  return lines.slice(0, 8);
}

/** Nominatim's search for her address: one result, its address's details (to check it found her number), in French. */
export function nominatimUrl(address: PostalAddress): string {
  const params = new URLSearchParams({ q: address.line, format: "jsonv2", addressdetails: "1", limit: "1", "accept-language": "fr" });
  return `${NOMINATIM_SEARCH}?${params.toString()}`;
}

const digits = (s: string | undefined | null) => (s ?? "").replace(/\D+/g, "");

/**
 * Her place in Nominatim's answer: its first result, kept only when it is her very address (its house number the one she
 * gave, its postcode hers when she gave one); a street or a town found instead of her door is no place. Null otherwise.
 */
export function readNominatim(answer: unknown, address: PostalAddress): { lat: number; lon: number } | null {
  const first = Array.isArray(answer) ? (answer[0] as Record<string, unknown> | undefined) : undefined;
  if (!first) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const found = (first.address ?? {}) as Record<string, unknown>;
  // Its number on her street: « 12 » for « 12 », « 3 bis » for « 3 bis » (the number itself must be the same).
  if (digits(String(found.house_number ?? "")).replace(/^0+/, "") !== digits(address.number).replace(/^0+/, "")) return null;
  if (address.postcode && found.postcode && digits(String(found.postcode)) !== address.postcode) return null;
  return { lat, lon };
}

/**
 * Coordinates as a technical label writes them (the original's « 32.9585° N, 77.2486° E »): four decimals, a point as
 * a GPS writes it, N or S, then E or O (ouest: her label is in French).
 */
export function coordinatesText(place: { lat: number; lon: number }, decimals = 4): string {
  const one = (v: number, plus: string, minus: string) => `${Math.abs(v).toFixed(decimals)}° ${v >= 0 ? plus : minus}`;
  return `${one(place.lat, "N", "S")}, ${one(place.lon, "E", "O")}`;
}

/**
 * Her place as cached on the studio (studios.place): the address it was asked for (null: none was found in her facts nor
 * on her site, `site` the site that was read for it), and its coordinates when Nominatim found her door (`none`: it did
 * not). A new address in her facts asks again; the same one never does.
 */
export const studioPlaceSchema = z.object({
  address: z.string().max(300).nullable(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  none: z.boolean().optional(),
  /** The site its address was looked for on (her website_url then): read again only when it changes. */
  site: z.string().max(500).optional(),
  at: z.string(),
});
export type StudioPlace = z.infer<typeof studioPlaceSchema>;

/** Her coordinates from the cached place, when it found her door. */
export const placeCoordinates = (place: StudioPlace | null | undefined): { lat: number; lon: number } | null =>
  place && typeof place.lat === "number" && typeof place.lon === "number" && !place.none ? { lat: place.lat, lon: place.lon } : null;
