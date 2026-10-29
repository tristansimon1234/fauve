import { z } from "zod";

// What works right now in her trade (Tristan: « une page tendance, où tu vois des vidéos qui
// fonctionnent », then « les tendances sont pas folles »): each week, two lists through Treg
// (AnyAPI, about $0.001 a call). « Ce qui cartonne »: her trade's broad words, worldwide (the
// formats that work, the ones worth copying), TikTok's most liked of the month and Instagram's own
// top posts on the trade's hashtags, with their real views. « Près de chez toi »: the same words
// with her city. Strict thresholds (five strong videos rather than twelve at a thousand views),
// then a quick read of their captions keeps only those really about her trade. Read loosely:
// the shapes are the provider's and may change.

export const TREND_PLATFORMS = ["tiktok", "instagram"] as const;
export type TrendPlatform = (typeof TREND_PLATFORMS)[number];

/** « trend »: what works in her trade, everywhere; « beau »: the most beautiful ones, chosen on their image; « local »: what is posted in her city. */
export const TREND_SCOPES = ["trend", "beau", "local"] as const;
export type TrendScope = (typeof TREND_SCOPES)[number];

/** Searched again after this many days (a cron each week, or her page when it is older). */
export const TREND_REFRESH_DAYS = 6;
/** Videos kept per list and platform, the most watched first. */
export const TREND_KEEP = 8;
/** Older than this, a video is a classic, not a trend: never kept. */
export const TREND_MAX_AGE_DAYS = 120;
/** Fewer views than this is not shown, even when the list stays short. */
export const TREND_MIN_VIEWS: Record<TrendScope, Record<TrendPlatform, number>> = {
  trend: { tiktok: 100_000, instagram: 50_000 },
  // A beautiful post is chosen on its image: enough views to have found its public, no more.
  beau: { tiktok: 20_000, instagram: 10_000 },
  local: { tiktok: 5_000, instagram: 5_000 },
};

/**
 * The language of the videos she sees (Tristan: « il faut du contenu en français ou choisir sa
 * langue »): French by default, or another, or all of them. Part of a list's key: a French list is
 * shared by every studio that reads French, never mixed with the English one.
 */
export const TREND_LANGS = ["fr", "en", "es", "it", "de", "pt", "all"] as const;
export type TrendLang = (typeof TREND_LANGS)[number];
type Spoken = Exclude<TrendLang, "all">;
export const DEFAULT_TREND_LANG: TrendLang = "fr";
export const TREND_LANG_LABELS: Record<TrendLang, string> = { fr: "Français", en: "Anglais", es: "Espagnol", it: "Italien", de: "Allemand", pt: "Portugais", all: "Toutes les langues" };
/** « en français », « en anglais »…, « dans toutes les langues ». */
export const trendLangIn = (lang: TrendLang) => (lang === "all" ? "dans toutes les langues" : `en ${TREND_LANG_LABELS[lang].toLowerCase()}`);
export const trendLangOf = (value: unknown): TrendLang => ((TREND_LANGS as readonly unknown[]).includes(value) ? (value as TrendLang) : DEFAULT_TREND_LANG);

/** Where a language is posted from (TikTok's region of a video), and the country word of its hashtags (#pilatesfrance). */
const LANG_PLACES: Record<Spoken, { regions: string[]; country: string | null }> = {
  fr: { regions: ["FR", "BE", "CH", "LU", "MC", "CA", "MA", "DZ", "TN", "SN", "CI", "RE", "GP", "MQ", "GF", "YT", "NC", "PF"], country: "france" },
  en: { regions: ["US", "GB", "IE", "AU", "NZ", "CA", "ZA"], country: null },
  es: { regions: ["ES", "MX", "AR", "CO", "CL", "PE", "UY", "VE", "EC"], country: "espana" },
  it: { regions: ["IT", "SM", "CH"], country: "italia" },
  de: { regions: ["DE", "AT", "CH"], country: "deutschland" },
  pt: { regions: ["PT", "BR"], country: "portugal" },
};

/** Words only one of these languages writes often (none shared: « tu », « non », « mais », « in » left out). */
const LANG_WORDS: Record<Spoken, Set<string>> = {
  fr: new Set("les des est et pour pas qui avec dans sur cette mon mes ton tes je vous nous ça très plus quand chez fait faire tout toi moi notre votre par à au aux ici être une le ce quoi mieux bien rien vraiment encore toujours jamais aussi après cours séance".split(" ")),
  en: new Set("the and you your my this that with for what when how it's i'm i'll i to of is are was just get got why who we our it be all about from after before can can't don't if these they their will have has".split(" ")),
  es: new Set("el los las del y muy pero esto este esta cómo qué porque mis hay ser más también aquí hoy nuestro nuestra cuando donde".split(" ")),
  it: new Set("che è gli della delle dei sono questo questa perché anche molto sempre oggi alla nella ho hai cosa più mio mia".split(" ")),
  de: new Set("der das und ist nicht ich mit für ein eine auf auch sich wie mein meine heute sehr noch zu dem den bei".split(" ")),
  pt: new Set("não você vocês uma muito isso meu minha também está são hoje aqui nossa nosso é pra tá tô obrigado obrigada".split(" ")),
};
const SPOKEN = Object.keys(LANG_WORDS) as Spoken[];

/** The language a caption is written in, when its words say so clearly (two of its own words at least, twice as many as any other); null otherwise. */
export function captionLang(caption: string): Spoken | null {
  const words = caption
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/#\S+|@\S+|https?:\/\/\S+/g, " ")
    .split(/[^\p{L}']+/u)
    .filter(Boolean);
  // « qu'un », « j'ai », « c'est », « n'est »: only French elides these (Italian shares « l' » and « d' »).
  const elided = (w: string) => /^(qu|j|c|n|m|t|s)'\p{L}/u.test(w);
  const hits = SPOKEN.map((lang) => ({ lang, n: words.filter((w) => LANG_WORDS[lang].has(w) || (lang === "fr" && elided(w))).length })).sort((a, b) => b.n - a.n);
  const [best, second] = hits;
  if (!best || best.n < 2 || best.n < (second?.n ?? 0) * 2) return null;
  return best.lang;
}

/**
 * Whether a video is in her language: « yes » when its caption is written in it (or, without words,
 * when TikTok says it was posted where it is spoken), « no » when written in another or posted
 * elsewhere, « maybe » when nothing tells (an Instagram post with only hashtags): its cover decides.
 */
export function inTrendLang(video: Pick<TrendVideo, "caption" | "region">, lang: TrendLang): "yes" | "maybe" | "no" {
  if (lang === "all") return "yes";
  const said = captionLang(video.caption);
  if (said) return said === lang ? "yes" : "no";
  if (foreignScript(video.caption)) return "no";
  const region = video.region?.trim().toUpperCase();
  if (!region) return "maybe";
  return LANG_PLACES[lang].regions.includes(region) ? "yes" : "no";
}

export type TrendVideo = {
  platform: TrendPlatform;
  external_id: string;
  url: string;
  caption: string;
  author: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  sound: string | null;
  duration: number | null;
  posted_at: string | null;
  /** The cover's link at the provider (short-lived): copied to our storage when kept. */
  cover: string | null;
  /** Where TikTok says it was posted (« FR »), when it says. */
  region?: string | null;
};

const count = z.preprocess((v) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v), z.number().nonnegative().finite()).nullable().catch(null);
const text = z.string().nullable().catch(null);
const link = z.string().regex(/^https:\/\/\S+$/).nullable().catch(null);

const tiktokRow = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  url: link,
  caption: text,
  views: count,
  likes: count,
  comments: count,
  shares: count,
  author: text,
  image: link,
  createdUtc: count,
  durationSeconds: count,
  soundTitle: text,
  soundAuthor: text,
  region: text.optional(),
});

const instagramRow = z.object({
  shortcode: z.string().regex(/^[\w-]+$/),
  url: link,
  caption: text,
  views: count,
  likes: count,
  comments: count,
  username: text,
  thumbnail: link,
  createdUtc: count,
  durationSeconds: count,
  audioTitle: text.optional(),
});

/** The list in Treg's answer ({ output: { data: { videos | reels } } }), wherever it sits. */
function listIn(answer: unknown, key: "videos" | "reels" | "posts" | "items"): unknown[] {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): unknown[] | null => {
    if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return null;
    seen.add(v);
    const own = (v as Record<string, unknown>)[key];
    if (Array.isArray(own)) return own;
    for (const child of Object.values(v as Record<string, unknown>)) {
      const found = walk(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(answer, 0) ?? [];
}

const dateOf = (seconds: number | null) => (seconds && seconds > 1_000_000_000 ? new Date(seconds * 1000).toISOString() : null);
/** Cut by characters, never inside one: half an emoji is invalid JSON, and Postgres refused the whole list. */
const clip = (s: string | null | undefined, max: number) => (s ? Array.from(s.replace(/\s+/g, " ").trim()).slice(0, max).join("") : "");

/** The videos of a TikTok keyword search. */
export function tiktokTrends(answer: unknown): TrendVideo[] {
  return listIn(answer, "videos").flatMap((raw) => {
    const r = tiktokRow.safeParse(raw);
    if (!r.success) return [];
    const v = r.data;
    const url = v.url ?? (v.author ? `https://www.tiktok.com/@${v.author}/video/${v.id}` : null);
    if (!url) return [];
    const sound = v.soundTitle && !/^original sound|^son original/i.test(v.soundTitle) ? clip(`${v.soundTitle}${v.soundAuthor ? ` · ${v.soundAuthor}` : ""}`, 120) : null;
    return [
      {
        platform: "tiktok" as const,
        external_id: v.id,
        url,
        caption: clip(v.caption, 300),
        author: v.author,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        sound,
        duration: v.durationSeconds,
        posted_at: dateOf(v.createdUtc),
        cover: v.image,
        region: v.region ?? null,
      },
    ];
  });
}

/** The Reels of an Instagram keyword search. */
export function instagramTrends(answer: unknown): TrendVideo[] {
  return listIn(answer, "reels").flatMap((raw) => {
    const r = instagramRow.safeParse(raw);
    if (!r.success) return [];
    const v = r.data;
    return [
      {
        platform: "instagram" as const,
        external_id: v.shortcode,
        url: v.url ?? `https://www.instagram.com/reel/${v.shortcode}/`,
        caption: clip(v.caption, 300),
        author: v.username,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: null,
        sound: v.audioTitle ? clip(v.audioTitle, 120) : null,
        duration: v.durationSeconds,
        posted_at: dateOf(v.createdUtc),
        cover: v.thumbnail,
      },
    ];
  });
}

const topPostRow = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  shortcode: z.string().regex(/^[\w-]+$/),
  caption: text,
  username: text,
  views: count,
  likes: count,
  comments: count,
  createdUtc: count,
  durationSeconds: count,
  soundTitle: text.optional(),
  soundAuthor: text.optional(),
  media: z.array(z.object({ type: text, url: link }).passthrough()).nullable().catch(null),
});

/** The videos of Instagram's own top posts on a hashtag (AnyAPI: { data: { posts } }), photos left out. */
export function instagramTopPosts(answer: unknown): TrendVideo[] {
  return listIn(answer, "posts").flatMap((raw) => {
    const r = topPostRow.safeParse(raw);
    if (!r.success) return [];
    const v = r.data;
    const first = v.media?.[0];
    const video = first?.type === "video" || (v.views ?? 0) > 0 || (v.durationSeconds ?? 0) > 0;
    if (!video) return [];
    const sound = v.soundTitle && !/^original audio|^son original|^audio original/i.test(v.soundTitle) ? clip(`${v.soundTitle}${v.soundAuthor ? ` · ${v.soundAuthor}` : ""}`, 120) : null;
    return [
      {
        platform: "instagram" as const,
        external_id: v.shortcode,
        url: `https://www.instagram.com/reel/${v.shortcode}/`,
        caption: clip(v.caption, 300),
        author: v.username,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: null,
        sound,
        duration: v.durationSeconds,
        posted_at: dateOf(v.createdUtc),
        cover: first?.url ?? null,
      },
    ];
  });
}

/** How much a video caught on: its views, else its likes as if one view in twenty liked. */
export const reach = (v: Pick<TrendVideo, "views" | "likes">) => v.views ?? (v.likes ?? 0) * 20;

/** Pages read per search (AnyAPI gives 10 to 30 videos a page): a bigger pool, so the top is the real top. */
export const TREND_PAGES = 3;

/**
 * The ones worth showing (Tristan: « j'aimerais les plus vus »): no duplicate, posted in the last
 * TREND_MAX_AGE_DAYS, above the scope's TREND_MIN_VIEWS, in her language (inTrendLang: the sure
 * ones first, then the ones whose cover will tell), the most watched first. Never padded with weak
 * ones: a short list beats videos at a thousand views. A caption in another script (Persian,
 * Amharic…) is not her audience.
 */
export function keptTrends(videos: TrendVideo[], scope: TrendScope, now = new Date(), lang: TrendLang = "all"): TrendVideo[] {
  const limit = now.getTime() - TREND_MAX_AGE_DAYS * 86_400_000;
  const unique = [...new Map(videos.map((v) => [`${v.platform}:${v.external_id}`, v])).values()];
  const sure = (v: TrendVideo) => (inTrendLang(v, lang) === "yes" ? 1 : 0);
  return unique
    .filter((v) => !foreignScript(v.caption) && inTrendLang(v, lang) !== "no")
    .filter((v) => v.posted_at !== null && Date.parse(v.posted_at) >= limit)
    .filter((v) => reach(v) >= TREND_MIN_VIEWS[scope][v.platform])
    .sort((a, b) => sure(b) - sure(a) || reach(b) - reach(a));
}

/** Mostly written in a script other than the Latin one (emoji, digits and hashtags aside). */
export function foreignScript(caption: string): boolean {
  const letters = caption.replace(/#\S+|@\S+/g, "").match(/\p{L}/gu) ?? [];
  if (letters.length < 6) return false;
  const latin = letters.filter((c) => /\p{Script=Latin}/u.test(c)).length;
  return latin / letters.length < 0.5;
}

/** The cursor of the next page in a search's answer (AnyAPI's nextCursor), if any. */
export function nextCursorIn(answer: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): string | null => {
    if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return null;
    seen.add(v);
    const own = (v as Record<string, unknown>).nextCursor;
    if (typeof own === "string" && own) return own;
    for (const child of Object.values(v as Record<string, unknown>)) {
      if (Array.isArray(child)) continue;
      const found = walk(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(answer, 0);
}

const CITIES = /\b(paris|lyon|marseille|bordeaux|lille|nantes|toulouse|nice|strasbourg|montpellier|rennes|grenoble|france)\b/i;
const SMALL_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "à", "a", "en", "au", "aux", "d", "l"]);

/** A word as a hashtag: no accent, no space, no sign (« salon de coiffure » → « salondecoiffure »). */
export const hashtagOf = (words: string) =>
  words
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export type TrendSearch = {
  scope: TrendScope;
  /** What is searched (« pilates », « pilates paris »). */
  words: string;
  /** Her trade alone (« pilates »), and the city of a local list. */
  trade: string;
  city: string | null;
  hashtags: string[];
  /** The language of its videos. */
  lang: TrendLang;
  /** A second TikTok search in her language's country (« pilates france »), when it has one. */
  country: string | null;
};

/**
 * The searches for a trade, in her language. « trend »: its words without the city (« pilates
 * paris » → « pilates »), and its hashtags (the words joined, its main word, and in French its
 * country's: « salon de coiffure » → #salondecoiffure, #coiffure, #coiffurefrance). « beau »: the
 * « aesthetic » search and hashtag. « local »: the same words with her city (Paris unless her words
 * name another), and the main word's city hashtag (#coiffureparis).
 */
export function trendPlan(query: string, lang: TrendLang = DEFAULT_TREND_LANG): Record<TrendScope, TrendSearch> {
  const clean = query.replace(/\s+/g, " ").trim().toLowerCase();
  const named = clean.match(CITIES)?.[1];
  const city = !named || named === "france" ? "paris" : named;
  const broad = clean.replace(new RegExp(CITIES.source, "gi"), " ").replace(/\s+(à|a|sur|in)\s*$/, "").replace(/\s+/g, " ").trim() || clean;
  const words = broad.split(" ").filter((w) => !SMALL_WORDS.has(w));
  const main = [...words].sort((a, b) => b.length - a.length)[0] ?? broad;
  const tags = (list: string[], most = 2) => [...new Set(list.map(hashtagOf).filter((t) => t.length >= 3))].slice(0, most);
  const country = lang === "all" ? null : LANG_PLACES[lang].country;
  const national = country ? [`${main}${country}`] : [];
  const base = { trade: broad, lang, country: country ? `${broad} ${country}` : null };
  return {
    trend: { ...base, scope: "trend", words: broad, city: null, hashtags: tags([broad, main, ...national], 3) },
    // « pilates aesthetic », #pilatesaesthetic and the trade's own top posts: the pool the most beautiful are picked from.
    beau: { ...base, scope: "beau", words: `${main} aesthetic`, city: null, hashtags: tags([`${main}aesthetic`, main, ...national], 3) },
    local: { ...base, scope: "local", words: `${broad} ${city}`, city, country: null, hashtags: tags([`${main}${city}`]) },
  };
}

/** The hashtags whose number of posts is followed each week: the trade's, then its city's. */
export const trendHashtags = (query: string, lang: TrendLang = DEFAULT_TREND_LANG) => {
  const plan = trendPlan(query, lang);
  return [...new Set([...plan.trend.hashtags, ...plan.local.hashtags])];
};

/** The total number of posts on a hashtag in AnyAPI's answer ({ data: { items: [{ postsCount }] } }). */
export function hashtagPostsIn(answer: unknown): number | null {
  const first = listIn(answer, "items")[0];
  const posts = z.object({ postsCount: count }).safeParse(first);
  return posts.success ? posts.data.postsCount : null;
}

export type HashtagCount = { hashtag: string; counted_on: string; posts: number };
export type HashtagVolume = { hashtag: string; posts: number; gained: number | null; days: number | null };

/**
 * Each hashtag's latest number of posts, and how many were added since a count 5 to 40 days
 * before (the nearest to a week): a hashtag that grows is a subject people post about now.
 */
export function hashtagVolumes(counts: HashtagCount[], order: string[]): HashtagVolume[] {
  return order.flatMap((hashtag) => {
    const mine = counts.filter((c) => c.hashtag === hashtag).sort((a, b) => b.counted_on.localeCompare(a.counted_on));
    const last = mine[0];
    if (!last) return [];
    const daysTo = (c: HashtagCount) => Math.round((Date.parse(last.counted_on) - Date.parse(c.counted_on)) / 86_400_000);
    const earlier = mine.filter((c) => daysTo(c) >= 5 && daysTo(c) <= 40).sort((a, b) => Math.abs(daysTo(a) - 7) - Math.abs(daysTo(b) - 7))[0];
    return [{ hashtag, posts: last.posts, gained: earlier ? last.posts - earlier.posts : null, days: earlier ? daysTo(earlier) : null }];
  });
}

/** The key a list is kept under: its scope, its language and its words (« trend:fr:pilates »). */
export const scopeKey = (search: Pick<TrendSearch, "scope" | "words" | "lang">) => `${search.scope}:${search.lang}:${trendKey(search.words)}`;


/** The forms a hook takes (read on a cover), with their name on screen. */
export const HOOK_FORMS = ["question", "pov", "chiffre", "promesse", "contre_pied", "coulisses", "defi", "liste", "autre"] as const;
export type HookForm = (typeof HOOK_FORMS)[number];
export const HOOK_FORM_LABELS: Record<HookForm, string> = {
  question: "Question",
  pov: "POV",
  chiffre: "Chiffre",
  promesse: "Promesse",
  contre_pied: "Contre-pied",
  coulisses: "Coulisses",
  defi: "Défi",
  liste: "Liste",
  autre: "Accroche",
};

/** The languages Sonnet tells on a cover: hers, another (« other »), or no words at all. */
const COVER_LANGS = ["fr", "en", "es", "it", "de", "pt", "other", "none"] as const;

/** What Sonnet reads on each cover: its beauty, whether it is about her trade, the hook written on it and its strength, its language, what makes it inspiring. */
export const coverReadSchema = z.object({
  videos: z
    .array(
      z.object({
        n: z.number().int().min(1).max(60),
        beauty: z.number().int().min(1).max(10).describe("How beautiful the image is, 1 to 10"),
        on_topic: z.boolean().describe("Really about this trade"),
        hook: z.string().max(120).describe("The words written on the image, exactly as written; empty when none"),
        hook_form: z.enum(HOOK_FORMS).describe("The form of that hook; autre when there is none"),
        hook_score: z.number().int().min(1).max(10).describe("How strongly the hook makes you keep watching, 1 to 10; 1 when there is none"),
        hook_why: z.string().max(90).describe("In French, why it stops the thumb, in a few words; empty under 7"),
        lang: z.enum(COVER_LANGS).describe("The language of the words on the image and in the caption; none when there are none"),
        tags: z.array(z.string().max(24)).max(3).describe("2 or 3 short French words for what makes it inspiring"),
      }),
    )
    .max(60),
});
export type CoverRead = z.infer<typeof coverReadSchema>["videos"][number];

/** A cover from 7 out of 10 is beautiful enough to be shown. */
export const TREND_BEAUTY_PASS = 7;
/** A hook from 7 out of 10 is shown as a hook that works; under it, a title or a label (« PINK CLUB », « pilates girl »). */
export const TREND_HOOK_PASS = 7;

/** Whether its cover says it is in another language than hers (no words on it: it can be any). */
export const otherLang = (read: Pick<CoverRead, "lang"> | undefined, lang: TrendLang) => lang !== "all" && !!read && read.lang !== "none" && read.lang !== lang;

/** Why a hook works, as Sonnet wrote it: one line, 90 characters at most, only for a hook that passes. */
export const cleanWhy = (read: Pick<CoverRead, "hook_score" | "hook_why"> | undefined) => (read && read.hook_score >= TREND_HOOK_PASS ? clip(read.hook_why, 90) : "");

/** The beautiful ones, the most beautiful first (then the most watched); reads are matched by their 1-based number. */
export function beautifulTrends(videos: TrendVideo[], reads: Pick<CoverRead, "n" | "beauty" | "on_topic">[]): TrendVideo[] {
  const byN = new Map(reads.map((s) => [s.n, s]));
  return videos
    .map((video, i) => ({ video, score: byN.get(i + 1) }))
    .filter((v) => v.score && v.score.on_topic && v.score.beauty >= TREND_BEAUTY_PASS)
    .sort((a, b) => b.score!.beauty - a.score!.beauty || reach(b.video) - reach(a.video))
    .map((v) => v.video);
}

/** A hook read on a cover, kept clean: one line, at most 120 characters; empty when it is only a handle or a hashtag. */
export function cleanHook(text: string | null | undefined): string {
  const line = clip(text, 120).replace(/^["«“\s]+|["»”\s]+$/g, "");
  return /\p{L}{2}/u.test(line.replace(/[#@]\S+/g, "")) ? line : "";
}

/** Inspiring words, as chips: lowercase, short, no duplicate, 3 at most. */
export const cleanTags = (tags: string[] | null | undefined) =>
  [...new Set((tags ?? []).map((t) => clip(t, 24).toLowerCase().replace(/[#.]/g, "").trim()).filter((t) => t.length >= 3))].slice(0, 3);

/** Sonnet's eye on the covers: their beauty for « Les plus belles », the hook written on them, what makes them inspiring. */
export const TREND_COVER_PROMPT = `You are the art director of a small business's social media. You look at the covers of short videos found on TikTok and Instagram for its trade, to build a wall of inspiration: the references a high-end Parisian studio, salon or restaurant would save.

You receive the trade (in French) and numbered covers with their caption and account. For each cover:

1. beauty, from 1 to 10, on the image itself: light (natural, soft, golden, or a clear intentional mood), composition and framing, colour grade, styling and set, a single clear subject, an editorial or cinematic feel. 9–10: magazine level. 7–8: clearly crafted, a reference worth copying. 4–6: ordinary phone footage. 1–3: cluttered, dark, blurry, a screenshot, a meme, a talking head in bad light, big captions or stickers over the image, an ad or a flyer. Judge the craft, never the popularity, the person's looks or the place's price.
2. on_topic: whether the video is really about this trade (it shows the activity, the place, the work, a client, a professional of it), not a travel guide or a lifestyle vlog that only mentions it.
3. hook: the words written on the image, exactly as written (the hook the video opens on), or empty when nothing is written. Never the caption.
4. hook_form: the form of that hook: question, pov (« pov : … »), chiffre (a precise number), promesse (what you will get), contre_pied (the opposite of what you expect), coulisses (what you don't usually see), defi (a challenge), liste (« 3 erreurs… »), autre (another form, or no hook).
5. hook_score, from 1 to 10: how strongly those words alone make someone stop scrolling and watch to the end, judged as a seasoned short-form creator would. 9–10: impossible to scroll past: a sharp tension, a surprising precise number, a reversal, a question you need answered, a situation everyone recognises said in a few words (« 180€ pour faire ÇA avec une paille ?! », « Ma copine le fait chaque semaine, ça doit pas être si dur »). 7–8: clearly opens a loop and is specific. 4–6: informs but does not pull (« Tuto carré bob »). 1–3: a title, a label, a place or brand name, one or two words, a hashtag, a vague mood (« PINK CLUB », « pilates girl », « Pilates in Paris », « La plus BELLE »), clickbait that the video cannot keep, unreadable, or no hook. The views never count: judge the words.
6. hook_why: only when hook_score is 7 or more, in French, at most 90 characters, what makes it work, concretely (« Une note Google catastrophique : on veut voir le désastre. », « Le prix choque, on reste pour comprendre. »). Never « accrocheur », never a dash. Empty under 7.
7. lang: the language of the words written on the image and in the caption (fr, en, es, it, de, pt, other), or none when there are no words but hashtags, names and emojis.
8. tags: 2 or 3 short words in French, lowercase, for what makes it inspiring to copy: its light, framing, colours, type, format or idea (« lumière naturelle », « plan serré », « titre serif », « noir et blanc », « collage », « pov », « avant après », « plan fixe »). Never a judgement (« beau », « joli »).

Answer for every number.`;

/** Hashtags that say nothing about a look or a trade: never followed. */
const GENERIC_TAGS = new Set(["fyp", "foryou", "foryoupage", "pourtoi", "viral", "reels", "reel", "explore", "explorepage", "trending", "trend", "instagood", "instagram", "tiktok", "love", "aesthetic", "paris", "france", "capcut", "ootd"]);

/** The hashtags of a caption, as hashtags (no accent, lowercase), the generic ones left out. */
export function captionHashtags(caption: string): string[] {
  const found = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(found.map((t) => hashtagOf(t.slice(1))).filter((t) => t.length >= 4 && t.length <= 30 && !GENERIC_TAGS.has(t)))];
}

/** Hashtags learned from the most beautiful posts of a trade: how often they came back and how beautiful those posts were. */
export type LearnedTag = { hashtag: string; seen: number; score: number };

/**
 * The hashtags to search next week for « Les plus belles », besides the trade's own: the two that
 * keep bringing beautiful posts (seen at least twice, best score first), and one new to explore (the
 * best seen once). Dynamic: what stops bringing beautiful posts falls behind and stops being searched.
 */
export function nextTags(learned: LearnedTag[], base: string[]): string[] {
  const fresh = learned.filter((t) => !base.includes(t.hashtag));
  const proven = fresh.filter((t) => t.seen >= 2).sort((a, b) => b.score - a.score).slice(0, 2);
  const explore = fresh.filter((t) => t.seen === 1).sort((a, b) => b.score - a.score).slice(0, 1);
  return [...proven, ...explore].map((t) => t.hashtag);
}


/**
 * The words searched for her trade: what she set, else her activity in a few words (« salon de
 * coiffure »; a long description is cut before its first « qui », « pour », comma or dash), at most 5 words.
 */
export function trendQueryOf(set: string | null | undefined, businessType: string | null | undefined): string | null {
  const own = set?.replace(/\s+/g, " ").trim();
  if (own) return own.slice(0, 60);
  const activity = businessType?.replace(/\s+/g, " ").trim();
  if (!activity) return null;
  const head = activity.split(/\s(?:qui|pour|avec|dont|où)\s|[,;:()–—-]/i)[0]!.trim();
  return head.split(" ").slice(0, 5).join(" ").toLowerCase() || null;
}

/** Changes of her words on the page Tendances each month before one costs a credit (each is a whole new search). */
export const TREND_FREE_CHANGES = 3;

/**
 * Whether changing her words counts, is paid (CREDIT_PRICES.trends), and the month's count after it:
 * free the first time (no words yet), for the same words, and for the first TREND_FREE_CHANGES of
 * the month (`month` as « 2026-10 » in her timezone).
 */
export function trendChange(input: { current: string | null; next: string | null; month: string; counted: { month: string | null; changes: number } }): { counts: boolean; paid: boolean; changes: number } {
  const same = trendKey(input.current ?? "") === trendKey(input.next ?? "");
  const used = input.counted.month === input.month ? input.counted.changes : 0;
  if (!input.current || same) return { counts: false, paid: false, changes: used };
  return { counts: true, paid: used >= TREND_FREE_CHANGES, changes: used + 1 };
}

/** Free changes left this month. */
export const trendChangesLeft = (counted: { month: string | null; changes: number }, month: string) =>
  Math.max(0, TREND_FREE_CHANGES - (counted.month === month ? counted.changes : 0));

/** The key a search is kept under (the same words, whatever their case and spaces). */
export const trendKey = (query: string) => query.replace(/\s+/g, " ").trim().toLowerCase();

/** « 1,2 M », « 48 k », « 950 »: a count the way the apps write it. */
export function shortCount(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",").replace(/,0$/, "")}\u00a0M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",").replace(/,0$/, "")}\u00a0k`;
  return String(Math.round(n));
}
