// Her Instagram profile, given at her getting started instead of a site (Tristan: « enfin profil
// insta »): who she is, what she does, how she talks, her latest photos. Read through Treg, whose
// providers answer each in their own shape: the fields are read where they are, whatever the envelope.

/** Paths of instagram.com that are not a profile. */
const NOT_PROFILES = new Set(["p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "about", "legal", "developer", "web", "s", "share"]);
/** A profile's own tabs (instagram.com/{handle}/reels/). */
const PROFILE_TABS = new Set(["reels", "tagged", "guides", "saved"]);
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/** Her handle from a profile link (instagram.com/maisonmaya.paris, with or without https, ?igsh=…) or « @maisonmaya.paris »; null for a post, a Reel or any other page. */
export function instagramProfileHandle(text: string): string | null {
  const t = text.trim();
  const at = t.match(/^@([A-Za-z0-9._]{1,30})$/);
  if (at) return at[1]!.toLowerCase();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/i.test(url.hostname) && !/^instagr\.am$/i.test(url.hostname)) return null;
  const [handle, tab, ...rest] = url.pathname.split("/").filter(Boolean);
  if (!handle || rest.length || (tab && !PROFILE_TABS.has(tab.toLowerCase()))) return null;
  return HANDLE.test(handle) && !NOT_PROFILES.has(handle.toLowerCase()) ? handle.toLowerCase() : null;
}

export type InstagramProfile = {
  handle: string;
  name: string | null;
  bio: string | null;
  /** What Instagram says she is (« Salon de coiffure »). */
  category: string | null;
  /** The link in her bio: often her site. */
  site: string | null;
  picture: string | null;
  private: boolean;
  followers: number | null;
  posts: number | null;
};

export type InstagramPost = { image: string; caption: string; video: boolean };

type Obj = Record<string, unknown>;

/** Every object of an answer, parents before their children. */
function* objects(value: unknown, depth = 0): Generator<Obj> {
  if (depth > 8 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) yield* objects(v, depth + 1);
    return;
  }
  yield value as Obj;
  for (const v of Object.values(value)) yield* objects(v, depth + 1);
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const link = (v: unknown): string | null => {
  const s = text(v);
  return s && /^https?:\/\//i.test(s) ? s : null;
};
const count = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v);
  if (v && typeof v === "object" && typeof (v as Obj).count === "number") return count((v as Obj).count);
  return null;
};
const first = <T>(...values: (T | null | undefined)[]): T | null => values.find((v) => v !== null && v !== undefined) ?? null;
const at = (o: unknown, ...path: (string | number)[]): unknown => path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string | number, unknown>)[k] : undefined), o);

/** The profile in a provider's answer, or null when none is there. */
export function readInstagramProfile(answer: unknown, handle: string): InstagramProfile | null {
  for (const o of objects(answer)) {
    if (!("biography" in o || "full_name" in o || "fullName" in o || ("username" in o && ("followers" in o || "follower_count" in o || "edge_followed_by" in o)))) continue;
    const bioLinks = first(at(o, "bio_links", 0, "url"), at(o, "bioLinks", 0, "url"));
    return {
      handle: (text(o.username) ?? handle).toLowerCase(),
      name: first(text(o.full_name), text(o.fullName), text(o.name)),
      bio: first(text(o.biography), text(o.bio)),
      category: first(text(o.category), text(o.category_name), text(o.business_category_name), text(o.categoryName)),
      site: first(link(o.external_url), link(o.externalUrl), link(o.website), link(bioLinks)),
      picture: first(link(o.profile_pic_url_hd), link(at(o, "hd_profile_pic_url_info", "url")), link(o.profile_pic_url), link(o.profilePicUrlHD), link(o.profilePicUrl)),
      private: o.is_private === true || o.isPrivate === true || o.private === true,
      followers: first(count(o.followers), count(o.follower_count), count(o.edge_followed_by), count(o.followersCount)),
      posts: first(count(o.posts), count(o.media_count), count(o.edge_owner_to_timeline_media), count(o.postsCount)),
    };
  }
  return null;
}

/** A post's image, caption and kind, when the object is a post. */
function postOf(o: Obj): InstagramPost | null {
  const image = first(
    link(o.image),
    link(o.display_url),
    link(o.displayUrl),
    link(o.thumbnail_src),
    link(o.thumbnail_url),
    link(o.thumbnailUrl),
    link(o.image_url),
    link(o.imageUrl),
    link(at(o, "image_versions2", "candidates", 0, "url")),
    link(at(o, "image_versions", "items", 0, "url")),
  );
  if (!image) return null;
  const caption = first(text(o.caption), text(at(o, "caption", "text")), text(at(o, "edge_media_to_caption", "edges", 0, "node", "text")), text(o.captionText), text(o.description)) ?? "";
  const kind = String(o.kind ?? o.type ?? o.product_type ?? o.productType ?? "").toLowerCase();
  const video = o.is_video === true || o.isVideo === true || o.media_type === 2 || Boolean(link(o.video_url) ?? link(o.videoUrl)) || /video|reel|clips/.test(kind);
  return { image, caption, video };
}

/** Her latest posts in a provider's answer, in its order, each image once. */
export function readInstagramPosts(answer: unknown, limit = 12): InstagramPost[] {
  const posts: InstagramPost[] = [];
  const seen = new Set<string>();
  const walk = (value: unknown, depth: number): void => {
    if (posts.length >= limit || depth > 8 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const v of value) walk(v, depth + 1);
      return;
    }
    const post = postOf(value as Obj);
    if (post) {
      const key = post.image.split("?")[0]!;
      if (!seen.has(key)) {
        seen.add(key);
        posts.push(post);
      }
      // A carousel's own slides are not more posts.
      return;
    }
    for (const v of Object.values(value)) walk(v, depth + 1);
  };
  walk(answer, 0);
  return posts;
}
