import "server-only";
import { studioAccess } from "@/lib/billing/access";
import { effortSchema, montagePlanSchema, replyExtrasSchema, type Effort, type MontagePlan, type PostKind, type PostStatus } from "@fauve/agent";
import { creditBalance, pricedAsEffect, quoteEfforts, type QuoteStage } from "@/lib/credits";
import { signMediaUrls } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Buttons and cards under Fauve's messages in the app (reply_with): read from
// the message payload, filled with the posts' current state and fresh media links.

export type CardPost = {
  id: string;
  title: string;
  kind: PostKind;
  status: PostStatus;
  at: string | null;
  caption: string | null;
  media: { url: string; video: boolean } | null;
};

export type QuoteState = "open" | "launched" | "delivered" | "expired" | "replaced";

export type CardQuote = {
  id: string;
  title: string;
  /** What is quoted: a new montage, a correction of one, or a variant (render only). */
  kind: "montage" | "correction" | "variant";
  postId: string;
  lines: { label: string; credits: number }[];
  base: number;
  max: number;
  /** open: can be launched; launched: being made; delivered: video sent; expired: ask for a new one. */
  state: QuoteState;
  balance: number;
  /** What Fauve will make: duration, style, scenes in order. */
  plan: MontagePlan | null;
  /** Level of care (null: a variant, or an older quote). */
  effort: Effort | null;
  /** The price at each level the balance allows, for the manager to pick another one. */
  efforts: Partial<Record<Effort, { base: number; max: number; lines: { label: string; credits: number }[] }>>;
  /** Where the launched montage is, and since when. */
  stage: QuoteStage | null;
  stageAt: string | null;
  /** When it was launched (null before). */
  startedAt: string | null;
  /** Launched once, failed, and open again (nothing was charged). */
  failed: boolean;
  /** What the delivered montage really cost (null before delivery). */
  charged: number | null;
  /** The effects agent makes it (an effect drawn image by image): its own steps and time. */
  effect: boolean;
};

/** What a quote card can show of a quote, from its row. */
export function quoteState(row: { used_at?: unknown; charged_at?: unknown; expires_at?: unknown; stage?: unknown }): QuoteState {
  if (row.charged_at) return "delivered";
  // Stopped by a newer request on the same Reel (credits.ts, supersedeRunning): never charged.
  if (row.stage === "superseded") return "replaced";
  if (row.used_at) return "launched";
  return new Date(row.expires_at as string).getTime() < Date.now() ? "expired" : "open";
}

/** A montage that failed reopens its quote but keeps the time of its last step (api/jobs/montage, reopenQuote). */
export const quoteFailed = (row: { used_at?: unknown; charged_at?: unknown; stage_at?: unknown }) => !row.used_at && !row.charged_at && Boolean(row.stage_at);

/** What each delivered quote really cost: its charge in the ledger. */
export async function quoteCharges(studioId: string, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const { data } = await supabaseAdmin().from("credit_ledger").select("delta, ref").eq("studio_id", studioId).in("ref->>quote_id", ids);
  const out = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row.ref as { quote_id?: string } | null)?.quote_id;
    if (id) out.set(id, (out.get(id) ?? 0) - (row.delta as number));
  }
  return out;
}

export type ChatCard = { type: "post"; post: CardPost } | { type: "grid"; posts: CardPost[] } | { type: "quote"; quote: CardQuote };

/** Parsed extras of one message; anything malformed is dropped. */
export function extrasOf(payload: unknown) {
  const parsed = replyExtrasSchema.safeParse(payload ?? {});
  return parsed.success ? parsed.data : {};
}

const GRID_POSTS = 6;
/** Every publication still to come shows in the grid, even before its photos or video are ready. */
const UPCOMING = ["planned", "content_requested", "media_received", "draft", "validated", "scheduled"];

/** Post and grid cards for every message of a page, in one pass (posts, renders, photos). */
async function postAndGridCards(studioId: string, payloads: unknown[]): Promise<ChatCard[][]> {
  const extras = payloads.map(extrasOf);
  const wanted = new Set(extras.flatMap((e) => e.posts ?? []));
  const withGrid = extras.some((e) => e.grid);
  if (!wanted.size && !withGrid) return extras.map(() => []);

  const db = supabaseAdmin();
  const columns = "id, title, kind, status, scheduled_at, caption, render_id, media_ids";
  const [byId, upcoming] = await Promise.all([
    wanted.size ? db.from("posts").select(columns).eq("studio_id", studioId).in("id", [...wanted]) : Promise.resolve({ data: [] }),
    withGrid
      ? db
          .from("posts")
          .select(columns)
          .eq("studio_id", studioId)
          .in("status", UPCOMING)
          .neq("kind", "story")
          .order("scheduled_at", { ascending: false, nullsFirst: true })
          .limit(GRID_POSTS)
      : Promise.resolve({ data: [] }),
  ]);
  const rows = [...(byId.data ?? []), ...(upcoming.data ?? [])];

  // A montage shows its render; a photo post its first photo. Before she subscribes,
  // the finished render stays behind the paywall (its page shows it blurred).
  const unlocked = (await studioAccess(studioId)).unlock;
  const renderIds = !unlocked ? [] : [...new Set(rows.flatMap((p) => (p.render_id ? [p.render_id as string] : [])))];
  const firstMedia = [...new Set(rows.flatMap((p) => (!p.render_id && (p.media_ids as string[] | null)?.[0] ? [(p.media_ids as string[])[0]!] : [])))];
  const [renders, assets] = await Promise.all([
    renderIds.length ? db.from("renders").select("id, storage_path").eq("studio_id", studioId).in("id", renderIds) : Promise.resolve({ data: [] }),
    firstMedia.length
      ? db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", firstMedia)
      : Promise.resolve({ data: [] }),
  ]);
  const renderPath = new Map((renders.data ?? []).map((r) => [r.id as string, r.storage_path as string | null]));
  const asset = new Map((assets.data ?? []).map((a) => [a.id as string, a]));
  const urls = await signMediaUrls(db, studioId, [
    ...[...renderPath.values()].filter((p): p is string => Boolean(p)),
    ...(assets.data ?? []).map((a) => a.storage_path as string),
  ]);

  const toCard = (p: (typeof rows)[number]): CardPost => {
    let media: CardPost["media"] = null;
    const path = p.render_id ? renderPath.get(p.render_id as string) : null;
    if (path && urls.get(path)) media = { url: urls.get(path)!, video: true };
    const first = (p.media_ids as string[] | null)?.[0];
    const a = !media && first ? asset.get(first) : undefined;
    if (a && urls.get(a.storage_path as string)) {
      media = { url: urls.get(a.storage_path as string)!, video: a.kind === "video" || String(a.mime_type ?? "").startsWith("video/") };
    }
    return {
      id: p.id as string,
      title: (p.title as string | null) ?? "Publication",
      kind: p.kind as PostKind,
      status: p.status as PostStatus,
      at: (p.scheduled_at as string | null) ?? null,
      caption: (p.caption as string | null) ?? null,
      media,
    };
  };
  const posts = new Map((byId.data ?? []).map((p) => [p.id as string, toCard(p)]));
  const grid = (upcoming.data ?? []).map(toCard);

  return extras.map((e) => [
    ...(e.posts ?? []).flatMap((id): ChatCard[] => {
      const post = posts.get(id);
      return post ? [{ type: "post", post }] : [];
    }),
    ...(e.grid ? [{ type: "grid" as const, posts: grid }] : []),
  ]);
}

/** Quote cards: the quoted work, its price and whether it can still be launched. */
async function quoteCards(studioId: string, payloads: unknown[]): Promise<(ChatCard | null)[]> {
  const ids = payloads.map((p) => extrasOf(p).quote ?? null);
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return ids.map(() => null);
  const db = supabaseAdmin();
  const [{ data }, balance] = await Promise.all([
    db
      .from("credit_quotes")
      .select("id, kind, post_id, base, max, lines, params, effort, stage, stage_at, used_at, charged_at, expires_at, posts(title)")
      .eq("studio_id", studioId)
      .in("id", wanted),
    creditBalance(studioId).catch(() => 0),
  ]);
  const charges = await quoteCharges(
    studioId,
    (data ?? []).filter((q) => q.charged_at).map((q) => q.id as string),
  ).catch(() => new Map<string, number>());
  const byId = new Map(
    (data ?? []).map((q): [string, CardQuote] => {
      const post = q.posts as { title?: string | null } | { title?: string | null }[] | null;
      const title = (Array.isArray(post) ? post[0]?.title : post?.title) ?? "Montage";
      const plan = montagePlanSchema.safeParse((q.params as { plan?: unknown } | null)?.plan);
      return [
        q.id as string,
        {
          id: q.id as string,
          title,
          kind: (q.kind as CardQuote["kind"] | null) ?? "montage",
          postId: q.post_id as string,
          lines: (q.lines as CardQuote["lines"]) ?? [],
          base: q.base as number,
          max: q.max as number,
          state: quoteState(q),
          balance,
          plan: plan.success ? plan.data : null,
          effort: effortSchema.nullable().catch(null).parse(q.effort ?? null),
          efforts: Object.fromEntries(Object.entries(quoteEfforts(q.params)).map(([e, p]) => [e, { base: p.base, max: p.max, lines: p.lines }])),
          stage: (q.stage as QuoteStage | null) ?? null,
          stageAt: (q.stage_at as string | null) ?? null,
          startedAt: (q.used_at as string | null) ?? null,
          failed: quoteFailed(q),
          charged: charges.get(q.id as string) ?? null,
          effect: pricedAsEffect(q.params),
        },
      ];
    }),
  );
  return ids.map((id) => {
    const quote = id ? byId.get(id) : undefined;
    return quote ? { type: "quote", quote } : null;
  });
}

/** Every card of every message of a page: quote first, then posts and grid. */
export async function resolveCards(studioId: string, payloads: unknown[]): Promise<ChatCard[][]> {
  const [quotes, others] = await Promise.all([quoteCards(studioId, payloads), postAndGridCards(studioId, payloads)]);
  return others.map((cards, i) => (quotes[i] ? [quotes[i]!, ...cards] : cards));
}
