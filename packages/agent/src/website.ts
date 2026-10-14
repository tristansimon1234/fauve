// Turns a studio's web page into the facts Fauve needs during onboarding.
// Pure functions only: fetching (and its safety checks) lives in apps/web.

export type SiteInfo = {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  logo: string | null;
  socials: { instagram: string[]; tiktok: string[]; facebook: string[] };
  bookingLinks: string[];
  pages: { label: string; url: string }[];
  text: string;
};

// Booking platforms used by French local businesses: studios (bsport first, the
// market leader), hair and beauty salons, restaurants.
const BOOKING_HOSTS = [
  "bsport.io",
  "momoyoga.com",
  "deciplus.pro",
  "mindbodyonline.com",
  "mindbody.io",
  "teamup.com",
  "eversports.",
  "classpass.com",
  "resamania.",
  "planity.com",
  "calendly.com",
  "acuityscheduling.com",
  "wix.com/booking",
  "treatwell.",
  "fresha.com",
  "booksy.com",
  "salonkee.",
  "kiute.com",
  "thefork.",
  "lafourchette.",
  "zenchef.",
  "guestonline.",
  "sevenrooms.com",
  "opentable.",
];

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ocirc: "ô",
  ucirc: "û",
  icirc: "î",
  euro: "€",
  ndash: "–",
  mdash: "—",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const clean = (value: string) => decodeEntities(value).replace(/\s+/g, " ").trim();

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const value = m?.[1] ?? m?.[2] ?? m?.[3];
  return value === undefined ? null : clean(value);
}

function meta(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = attr(tag, "property") ?? attr(tag, "name");
    if (k?.toLowerCase() === key) return attr(tag, "content") || null;
  }
  return null;
}

function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const stripCode = (html: string) =>
  html.replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");

/** Visible text of the page, without scripts, styles and markup. */
export function htmlToText(html: string): string {
  return clean(
    stripCode(html)
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/tr)\b[^>]*>/gi, " · ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/(\s*·\s*)+/g, " · ")
    .replace(/^ · | · $/g, "");
}

const unique = <T>(items: T[]) => [...new Set(items)];

/** An image's address, lazy-loaded ones included (Squarespace, Wix, WordPress plugins). */
const imgSrc = (tag: string) => attr(tag, "src")?.replace(/^data:.*/, "") || attr(tag, "data-src") || attr(tag, "data-image") || attr(tag, "data-lazy-src") || null;

/**
 * The site's logo: an image named or classed "logo" (or in a "logo" link), else
 * the image in the link back to the home page (header of nearly every site).
 */
function findLogo(html: string, pageUrl: string): string | null {
  const named = (html.match(/<img\b[^>]*>/gi) ?? []).find((tag) => /logo/i.test(tag) && imgSrc(tag));
  if (named) return imgSrc(named);
  const home = new URL(pageUrl);
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]{0,1500}?)<\/a>/gi)) {
    const img = m[2]?.match(/<img\b[^>]*>/i)?.[0];
    if (!img || !imgSrc(img)) continue;
    const href = attr(m[1] ?? "", "href");
    const target = href ? absolute(href, pageUrl) : null;
    const toHome = target ? new URL(target).hostname === home.hostname && /^\/?(index\.html?)?$/.test(new URL(target).pathname) : false;
    if (/logo/i.test(m[1] ?? "") || toHome) return imgSrc(img);
  }
  return null;
}

export function extractSiteInfo(rawHtml: string, pageUrl: string, maxText = 6000): SiteInfo {
  const html = stripCode(rawHtml);
  const host = new URL(pageUrl).hostname.replace(/^www\./, "");
  const links: { label: string; url: string }[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1] ?? "", "href");
    const url = href ? absolute(href, pageUrl) : null;
    if (url) links.push({ label: htmlToText(m[2] ?? "").slice(0, 60), url });
  }

  const on = (pattern: RegExp) => unique(links.map((l) => l.url).filter((u) => pattern.test(u)));
  const internal = links.filter((l) => {
    const u = new URL(l.url);
    return u.hostname.replace(/^www\./, "") === host && u.pathname !== "/" && l.label;
  });

  const logoSrc = findLogo(html, pageUrl);
  const ogImage = meta(html, "og:image");
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const text = htmlToText(body);

  return {
    url: pageUrl,
    title: title ? clean(title) || null : null,
    description: meta(html, "description") ?? meta(html, "og:description"),
    siteName: meta(html, "og:site_name"),
    logo: (logoSrc ? absolute(logoSrc, pageUrl) : null) ?? (ogImage ? absolute(ogImage, pageUrl) : null),
    socials: {
      instagram: on(/^https?:\/\/(www\.)?instagram\.com\/[^/?#]+/i),
      tiktok: on(/^https?:\/\/(www\.)?tiktok\.com\/@/i),
      facebook: on(/^https?:\/\/(www\.|m\.)?facebook\.com\//i),
    },
    bookingLinks: unique(links.map((l) => l.url).filter((u) => BOOKING_HOSTS.some((h) => u.includes(h)))).slice(0, 5),
    pages: unique(internal.map((l) => l.url))
      .slice(0, 15)
      .map((url) => ({ url, label: internal.find((l) => l.url === url)!.label })),
    text: text.length > maxText ? `${text.slice(0, maxText)}…` : text,
  };
}

// ---------------------------------------------------------------------------
// Brand style: colours and fonts, for the image templates.
// ---------------------------------------------------------------------------

export type BrandStyle = {
  /** Most characteristic colours first; greys, black and white are left out. */
  colors: string[];
  /** Neutral background / text colours actually used. */
  neutrals: string[];
  fonts: string[];
};

/** Stylesheets worth downloading (font and icon libraries are skipped). */
export function stylesheetLinks(rawHtml: string, pageUrl: string, max = 3): string[] {
  const hrefs: string[] = [];
  for (const tag of rawHtml.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/stylesheet/i.test(attr(tag, "rel") ?? "")) continue;
    const href = attr(tag, "href");
    const url = href ? absolute(href, pageUrl) : null;
    if (url && !/fonts\.googleapis|use\.typekit|fontawesome|font-awesome|icons?\b/i.test(url)) hrefs.push(url);
  }
  return unique(hrefs).slice(0, max);
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

function toHex(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  let m = value.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    const h = m[1]!;
    if (h.length === 3 || h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
    return null;
  }
  m = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/) ?? value.match(/^(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})$/);
  if (m) return `#${hex2(+m[1]!)}${hex2(+m[2]!)}${hex2(+m[3]!)}`;
  return null;
}

function saturationAndLightness(hex: string): { s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

const GENERIC_FONTS = new Set([
  "inherit", "initial", "unset", "sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui",
  "-apple-system", "blinkmacsystemfont", "ui-sans-serif", "ui-serif", "ui-monospace", "segoe ui", "roboto",
  "helvetica neue", "helvetica", "arial", "noto sans", "apple color emoji", "segoe ui emoji", "segoe ui symbol",
  "noto color emoji", "times new roman", "times", "courier new", "sans", "var",
]);

/** Black, white, greys, near-whites: the background of a brand, not its signature. */
function isNeutral(hex: string): boolean {
  const { s, l } = saturationAndLightness(hex);
  return s < 0.15 || l > 0.95 || l < 0.08;
}

/**
 * The brand's colours from the palette Brigitte saw on the site (its photos and
 * home page): signature colours first, in her order (the first one is the
 * montage's accent), then the neutrals. Truer than the colours found in the CSS,
 * which on site builders are often the theme's, not the brand's.
 */
export function brandColorsFromLook(palette: string[], max = 6): string[] {
  const hexes = [...new Set(palette.map((c) => c.toLowerCase()))].filter((c) => /^#[0-9a-f]{6}$/.test(c));
  // Creams and off-whites count as backgrounds here too.
  const plain = (c: string) => isNeutral(c) || saturationAndLightness(c).l > 0.9;
  return [...hexes.filter((c) => !plain(c)), ...hexes.filter(plain)].slice(0, max);
}

export function extractBrandStyle(rawHtml: string, cssTexts: string[] = []): BrandStyle {
  const inlineCss = [
    ...[...rawHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? ""),
    ...[...rawHtml.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1] ?? ""),
  ];
  const css = [...inlineCss, ...cssTexts].join("\n").replace(/\/\*[\s\S]*?\*\//g, "");

  const scores = new Map<string, number>();
  const add = (raw: string, weight: number) => {
    const hex = toHex(raw);
    if (hex) scores.set(hex, (scores.get(hex) ?? 0) + weight);
  };

  const themeColor = rawHtml.match(/<meta\b[^>]*name\s*=\s*["']?theme-color[^>]*>/i)?.[0];
  if (themeColor) add(attr(themeColor, "content") ?? "", 30);

  for (const m of css.matchAll(/(--[\w-]+|[\w-]+)\s*:\s*([^;{}]+)/g)) {
    const prop = m[1]!.toLowerCase();
    const value = m[2]!;
    // Custom properties named like the brand weigh more (Wix stores them as "r,g,b").
    const weight = /^--.*(primary|brand|accent|main|theme|color_1[0-9])/.test(prop)
      ? 6
      : /^(background|background-color|color|border-color|fill|--)/.test(prop)
        ? 1
        : 0;
    if (!weight) continue;
    for (const c of value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|^\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*$/gi) ?? []) add(c, weight);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);

  const fontScores = new Map<string, number>();
  const addFont = (name: string, weight: number) => {
    const font = name.trim().replace(/^["']|["']$/g, "").trim();
    if (!font || font.length > 60 || GENERIC_FONTS.has(font.toLowerCase()) || /icon|awesome|var\(/i.test(font)) return;
    fontScores.set(font, (fontScores.get(font) ?? 0) + weight);
  };
  for (const m of css.matchAll(/font-family\s*:\s*([^;{}]+)/gi)) {
    m[1]!.split(",").forEach((f, i) => addFont(f, i === 0 ? 2 : 1));
  }
  for (const m of rawHtml.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
    for (const family of new URLSearchParams(decodeEntities(m[1]!)).getAll("family")) {
      family.split("|").forEach((f) => addFont(f.split(":")[0]!.replace(/\+/g, " "), 5));
    }
  }

  return {
    colors: ranked.filter((c) => !isNeutral(c)).slice(0, 6),
    neutrals: ranked.filter(isNeutral).slice(0, 4),
    fonts: [...fontScores.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// The site's photos: the best candidates for the studio's moodboard.
// ---------------------------------------------------------------------------

/** Not photos: logos, icons, flags, payment badges, tracking pixels, placeholders. */
const NOT_A_PHOTO = /logo|icon|favicon|sprite|avatar|badge|flag|payment|visa|mastercard|paypal|pixel|placeholder|blank|spinner|loader|emoji|arrow|\.svg(\?|$)|\.gif(\?|$)|data:/i;

/** The largest candidate of a srcset (« a.jpg 480w, b.jpg 1200w »). */
function largestOfSrcset(srcset: string): string | null {
  let best: { url: string; size: number } | null = null;
  for (const part of srcset.split(",")) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const n = parseFloat(size ?? "1") || 1;
    if (!best || n > best.size) best = { url, size: n };
  }
  return best?.url ?? null;
}

/**
 * The page's photos, most telling first: the share image, then the big images
 * of the page and its CSS backgrounds (hero banners), without logos, icons or
 * images declared small. Absolute URLs, deduplicated.
 */
export function extractSiteImages(rawHtml: string, pageUrl: string, max = 10): string[] {
  const html = stripCode(rawHtml);
  const found: string[] = [];
  const add = (src: string | null | undefined) => {
    const url = src ? absolute(src, pageUrl) : null;
    if (url && !NOT_A_PHOTO.test(url) && !found.includes(url)) found.push(url);
  };
  add(meta(html, "og:image"));
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (NOT_A_PHOTO.test(tag.replace(/\s(src|srcset|data-src|data-srcset)\s*=\s*("[^"]*"|'[^']*')/gi, ""))) continue;
    const width = Number(attr(tag, "width") ?? NaN);
    const height = Number(attr(tag, "height") ?? NaN);
    if ((Number.isFinite(width) && width < 300) || (Number.isFinite(height) && height < 200)) continue;
    const srcset = attr(tag, "srcset") ?? attr(tag, "data-srcset");
    add((srcset ? largestOfSrcset(srcset) : null) ?? attr(tag, "data-src") ?? attr(tag, "src"));
  }
  // Hero banners are often CSS backgrounds (inline styles, Wix/Squarespace data attributes).
  for (const m of rawHtml.matchAll(/background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add(m[1]);
  return found.slice(0, max);
}
