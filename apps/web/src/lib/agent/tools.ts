import "server-only";
import {
  assertTransition,
  canTransition,
  postStatusSchema,
  type PostKind,
  type ReplyExtras,
  type ToolHandlers,
} from "@fauve/agent";
import { createLoginLink } from "@/lib/auth/login-link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { acceptQuote, createMontageQuote, lastPresentedQuote } from "@/lib/credits";
import { startMontage } from "@/lib/montage-start";
import { montageStatus } from "@/lib/montage-status";
import { analyzePerformance, latestReport } from "@/lib/performance";
import { setReaction } from "@/lib/reactions";
import { sendReaction } from "@/lib/whatsapp/client";
import { renderAndDeliver } from "@/lib/render/deliver";
import { mediaComments, mediaInsights, recentMedia, replyToComment } from "@/lib/social/instagram";
import { instagramAccount, publishIfDue } from "@/lib/social/publish";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { readWebsite, WebsiteError } from "./website";

export type ToolContext = {
  studioId: string;
  memberId: string;
  /** WhatsApp id of the manager, and the inbound message to react to (WhatsApp channel only). */
  waId?: string;
  replyToMessageId?: string;
  /** Web chat: the stored message Fauve can react to. */
  reactToRowId?: string;
  /** Filled by react_to_message so the caller knows an emoji was sent. */
  reactions: string[];
  /** Jobs the caller runs after sending the reply (render, then deliver the video). */
  afterReply: (() => Promise<void>)[];
  /** Filled by reply_with: buttons and cards the caller shows under the reply. */
  extras: ReplyExtras;
  /**
   * Ids made during this turn (quote, post), stored with the reply and shown to the
   * model on the next turns: the history keeps only text, not tool results.
   */
  notes: string[];
  /** The studio's time zone, for the local dates in tool results. */
  timezone?: string;
};

/**
 * Tool results as JSON. Every object with a scheduled_at also gets « quand », the
 * local day and time (« mardi 13 octobre à 18:00 »): the model must never work
 * out a weekday or a time zone itself.
 */
function jsonIn(timeZone: string) {
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" });
  return (value: unknown) =>
    JSON.stringify(value, (_key, v: unknown) => {
      if (v && typeof v === "object" && !Array.isArray(v) && "scheduled_at" in v && typeof v.scheduled_at === "string") {
        const at = new Date(v.scheduled_at);
        if (!Number.isNaN(at.getTime())) return { ...v, quand: `${day.format(at)} à ${time.format(at)}` };
      }
      return v;
    });
}

type DbResult = { data: unknown; error: { message: string } | null };

/** For writes: fail loudly, the model gets the error as a tool result. */
function check(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message);
}

/** For reads: the row(s) must exist. */
function unwrap<R extends DbResult>(result: R): NonNullable<R["data"]> {
  check(result);
  if (result.data === null || result.data === undefined) throw new Error("Not found");
  return result.data as NonNullable<R["data"]>;
}

async function nextVersion(table: "brand_profiles" | "edit_plans", column: "studio_id" | "post_id", id: string) {
  const db = supabaseAdmin();
  const { data } = await db.from(table).select("version").eq(column, id).order("version", { ascending: false }).limit(1);
  return ((data?.[0]?.version as number | undefined) ?? 0) + 1;
}

/** Database-backed implementations of Fauve's tools, scoped to one studio. */
/** What a post still needs before it can go out, per format (null when ready). */
function missingContent(kind: PostKind, hasRender: boolean, media: number): string | null {
  if (kind === "reel" && !hasRender) return "Pas encore de vidéo montée : fais d'abord le montage.";
  if (kind === "post" && media < 1) return "Il faut une photo pour ce post : ajoute son media_id (update_post media_ids).";
  if (kind === "carousel" && media < 2) return "Un carrousel demande 2 à 10 photos ou vidéos (update_post media_ids, dans l'ordre).";
  if (kind === "story" && !hasRender && media < 1) return "Il faut une photo, une vidéo ou un montage pour cette story.";
  return null;
}

export function createToolHandlers(ctx: ToolContext): ToolHandlers {
  const db = supabaseAdmin();
  const json = jsonIn(ctx.timezone ?? "Europe/Paris");
  const { studioId } = ctx;
  // A quote made during this turn cannot be started in it: the manager must see the price first.
  const turnStartedAt = new Date();

  /** Media ids given by the model must be this studio's. */
  async function assertOwnMedia(ids: string[]) {
    const { data } = await db.from("media_assets").select("id").eq("studio_id", studioId).in("id", ids);
    if ((data?.length ?? 0) !== new Set(ids).size) throw new Error("Un des media_id n'appartient pas à ce studio.");
  }

  return {
    async get_studio_context() {
      const [studio, member, plan, accounts, brand] = await Promise.all([
        db.from("studios").select("name, timezone, onboarding_step, website_url, booking_url").eq("id", studioId).single(),
        db.from("members").select("first_name, role").eq("id", ctx.memberId).single(),
        db.from("content_plans").select("posts_per_week, stories_per_week, platforms, themes").eq("studio_id", studioId).maybeSingle(),
        db.from("social_accounts").select("platform, handle, status").eq("studio_id", studioId),
        db.from("brand_profiles").select("version, profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1),
      ]);
      return json({
        studio: unwrap(studio),
        manager: unwrap(member),
        content_plan: plan.data,
        social_accounts: unwrap(accounts),
        brand_profile: unwrap(brand)[0] ?? null,
      });
    },

    async update_onboarding(input) {
      const studioUpdate: Record<string, unknown> = {};
      if (input.studio_name) studioUpdate.name = input.studio_name;
      if (input.business_type) studioUpdate.business_type = input.business_type;
      if (input.step) studioUpdate.onboarding_step = input.step;
      if (input.website_url) studioUpdate.website_url = input.website_url;
      if (input.booking_url) studioUpdate.booking_url = input.booking_url;
      if (Object.keys(studioUpdate).length) check(await db.from("studios").update(studioUpdate).eq("id", studioId));
      if (input.first_name) check(await db.from("members").update({ first_name: input.first_name }).eq("id", ctx.memberId));
      if (input.posts_per_week !== undefined || input.stories_per_week !== undefined || input.platforms) {
        const planUpdate: Record<string, unknown> = { studio_id: studioId };
        if (input.posts_per_week !== undefined) planUpdate.posts_per_week = input.posts_per_week;
        if (input.stories_per_week !== undefined) planUpdate.stories_per_week = input.stories_per_week;
        if (input.platforms) planUpdate.platforms = input.platforms;
        check(await db.from("content_plans").upsert(planUpdate, { onConflict: "studio_id" }));
      }
      return "ok";
    },

    async read_website({ url }) {
      try {
        return json(await readWebsite(url));
      } catch (error) {
        if (error instanceof WebsiteError) {
          console.warn("read_website failed", url, error.message);
          return json({ error: error.message });
        }
        throw error;
      }
    },

    async get_connect_link() {
      const { data: member } = await db.from("members").select("phone_e164").eq("id", ctx.memberId).single();
      const url = await createLoginLink(member?.phone_e164 as string, "/connect", "connect_social");
      return json({ url, expires_in_minutes: 15 });
    },

    async get_post_link({ post_id }) {
      const { data: post } = await db.from("posts").select("id").eq("id", post_id).eq("studio_id", studioId).maybeSingle();
      if (!post) return json({ error: "Publication introuvable dans ce studio." });
      const { data: member } = await db.from("members").select("phone_e164").eq("id", ctx.memberId).single();
      const url = await createLoginLink(member?.phone_e164 as string, `/v/${post_id}`, "open_post");
      return json({ url, expires_in_minutes: 15 });
    },

    async get_calendar({ from, to }) {
      const posts = unwrap(
        await db
          .from("posts")
          .select("id, kind, title, scheduled_at, status, platforms, caption, hashtags")
          .eq("studio_id", studioId)
          .gte("scheduled_at", from)
          .lte("scheduled_at", to)
          .order("scheduled_at"),
      );
      return json({ posts });
    },

    async create_post(input) {
      if (input.media_ids?.length) await assertOwnMedia(input.media_ids);
      const post = unwrap(
        await db
          .from("posts")
          .insert({ studio_id: studioId, status: "planned", ...input })
          .select("id, kind, title, scheduled_at, status")
          .single(),
      );
      ctx.notes.push(`publication créée « ${post.title as string} » post_id=${post.id as string}`);
      return json({ post });
    },

    async update_post({ post_id, status, ...fields }) {
      if (fields.media_ids?.length) await assertOwnMedia(fields.media_ids);
      const current = unwrap(
        await db.from("posts").select("status").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (status) assertTransition(postStatusSchema.parse(current.status), status);
      const post = unwrap(
        await db
          .from("posts")
          .update({ ...fields, ...(status ? { status } : {}) })
          .eq("id", post_id)
          .eq("studio_id", studioId)
          .select("id, title, status, scheduled_at")
          .single(),
      );
      return json({ post });
    },

    async request_content({ post_id, label, hint, due_date }) {
      check(await db.from("shot_requests").insert({ studio_id: studioId, post_id, label, hint, due_date }));
      if (post_id) {
        const current = unwrap(
          await db.from("posts").select("status").eq("id", post_id).eq("studio_id", studioId).single(),
        );
        if (canTransition(postStatusSchema.parse(current.status), "content_requested")) {
          check(await db.from("posts").update({ status: "content_requested" }).eq("id", post_id));
        }
      }
      return "ok";
    },

    async analyze_clips({ media_ids }) {
      const results = await Promise.all(
        media_ids.map((id) =>
          ensureClipAnalysis(studioId, id).catch((error: unknown) => ({
            media_id: id,
            status: "failed" as const,
            error: error instanceof Error ? error.message : String(error),
          })),
        ),
      );
      // The chat only needs the gist; the editor reads the full analyses itself.
      return json({
        clips: results.map((r) =>
          "analysis" in r
            ? {
                media_id: r.media_id,
                duration: r.analysis.duration,
                summary: r.analysis.summary,
                best_moments: r.analysis.best_moments,
                faces_visible: r.analysis.shots.some((s) => s.faces_visible),
                issues: r.analysis.issues,
              }
            : r,
        ),
      });
    },

    async quote_montage({ post_id, media_ids, brief, correction, max_new_scenes, variant, plan }) {
      const post = unwrap(await db.from("posts").select("id, title, edit_plan_id").eq("id", post_id).eq("studio_id", studioId).single());
      if ((correction || variant) && !post.edit_plan_id) return "Pas encore de montage pour cette publication : fais un devis de montage (correction: false).";
      const quote = await createMontageQuote({ studioId, postId: post_id, mediaIds: media_ids ?? [], brief, correction, maxNewScenes: max_new_scenes, variant, plan });
      if ("error" in quote) {
        return json({ possible: false, solde: quote.balance, credits_necessaires: quote.needed, note: "Solde insuffisant : dis-le simplement à la gérante, sans lancer." });
      }
      // Shown as a card with a « Lancer » button under the reply (WhatsApp: yes / no buttons).
      ctx.extras.quote = quote.id;
      ctx.notes.push(`devis présenté quote_id=${quote.id} pour « ${post.title as string} » post_id=${post_id} (${quote.base} à ${quote.max} crédits)`);
      return json({
        quote_id: quote.id,
        publication: post.title,
        lignes: quote.lines,
        credits: quote.base,
        credits_max: quote.max,
        nouvelles_scenes_max: quote.maxNewScenes,
        solde: quote.balance,
        note: "Présente le plan et le coût (credits, ou jusqu'à credits_max s'il crée de nouvelles scènes), puis attends son accord avant montage.",
      });
    },

    async analyze_performance({ refresh }) {
      const latest = await latestReport(studioId);
      const fresh = latest && Date.now() - new Date(latest.createdAt).getTime() < 3 * 24 * 3600_000;
      const report = fresh && !refresh ? latest : await analyzePerformance(studioId);
      if ("error" in report) return json({ error: report.error });
      return json({
        bilan: report.summary,
        lecons: report.lessons,
        idees: report.ideas,
        posts_analyses: report.posts,
        date: report.createdAt,
        note: "Partage le bilan en 2-3 phrases (la tendance et la leçon la plus utile) ; le détail est dans l'app, page Résultats.",
      });
    },

    async montage_status({ post_id }) {
      const montages = await montageStatus(studioId, post_id);
      if (!montages.length) return json({ montages: [], note: "Aucun montage lancé récemment." });
      return json({
        montages: montages.map((m) => ({ post_id: m.postId, publication: m.title, etape: m.step, depuis_minutes: m.minutes, late: m.late })),
        note: "En montage puis en rendu : tout va bien, la vidéo arrive toute seule. late : propose de relancer (quote_montage puis montage).",
      });
    },

    async choose_version({ post_id, version }) {
      unwrap(await db.from("posts").select("id").eq("id", post_id).eq("studio_id", studioId).single());
      const plan = (await db.from("edit_plans").select("id").eq("post_id", post_id).eq("version", version).maybeSingle()).data;
      if (!plan) return json({ error: `Pas de version ${version} pour cette publication.` });
      const render = (
        await db
          .from("renders")
          .select("id")
          .eq("edit_plan_id", plan.id)
          .eq("status", "done")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;
      check(await db.from("posts").update({ edit_plan_id: plan.id, ...(render ? { render_id: render.id } : {}) }).eq("id", post_id));
      return json({
        version,
        video: render ? "prête" : "pas encore rendue : lance render",
        note: "C'est cette version qui sera publiée. Confirme-le en une phrase.",
      });
    },

    async montage({ quote_id }) {
      const quote = await acceptQuote(studioId, quote_id, turnStartedAt);
      if ("error" in quote) {
        // The model lost the id of the quote the manager said yes to: point it back to it.
        const shown = await lastPresentedQuote(studioId, turnStartedAt);
        return shown && shown.id !== quote_id
          ? `${quote.error} Le devis présenté à la gérante est quote_id=${shown.id} (« ${shown.title} ») : lance montage avec celui-ci, sans refaire de devis ni de publication.`
          : quote.error;
      }
      const post = unwrap(await db.from("posts").select("id, title").eq("id", quote.postId).eq("studio_id", studioId).single());
      // The montage outlives this reply: it runs as a background job and sends the video itself.
      ctx.afterReply.push(() => startMontage(studioId, quote, { waId: ctx.waId, replyTo: ctx.replyToMessageId }));
      ctx.notes.push(`montage lancé (quote_id=${quote.id})`);
      return json({
        status: "started",
        post: post.title,
        note: "Le monteur prépare la vidéo (plans, scènes de motion design, textes) puis l'envoie automatiquement avec la légende, en 2 à 4 minutes. Annonce-le en une phrase courte.",
      });
    },

    async create_edit_plan({ post_id, plan }) {
      // Ownership check before writing.
      unwrap(await db.from("posts").select("id").eq("id", post_id).eq("studio_id", studioId).single());
      const version = await nextVersion("edit_plans", "post_id", post_id);
      const row = unwrap(
        await db
          .from("edit_plans")
          .insert({ studio_id: studioId, post_id, version, plan })
          .select("id, version")
          .single(),
      );
      check(await db.from("posts").update({ edit_plan_id: row.id }).eq("id", post_id));
      return json({ edit_plan_id: row.id, version: row.version });
    },

    async update_brand_profile({ profile }) {
      const version = await nextVersion("brand_profiles", "studio_id", studioId);
      check(await db.from("brand_profiles").insert({ studio_id: studioId, version, profile }));
      return json({ version });
    },

    async render({ post_id }) {
      // Ownership check now, so the model gets an immediate error for a wrong id.
      const post = unwrap(
        await db.from("posts").select("id, title, edit_plan_id").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (!post.edit_plan_id) return json({ error: "Cette publication n'a pas encore de plan de montage (create_edit_plan)." });
      // A re-render of an unchanged plan: free (no AI work).
      ctx.afterReply.push(async () => {
        await renderAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId });
      });
      return json({
        status: "started",
        note: "Le montage démarre après ta réponse et la vidéo sera envoyée automatiquement (environ une minute). Annonce-le en une phrase, sans décrire la vidéo comme si elle était déjà prête.",
      });
    },

    async schedule_post({ post_id, scheduled_at }) {
      const post = unwrap(
        await db.from("posts").select("id, kind, status, render_id, media_ids, scheduled_at").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      const missing = missingContent(post.kind as PostKind, Boolean(post.render_id), ((post.media_ids as string[] | null) ?? []).length);
      if (missing) return json({ error: missing });
      if (!(await instagramAccount(studioId))) {
        return json({ error: "Instagram n'est pas connecté pour ce studio. Envoie le lien de connexion (get_connect_link)." });
      }
      const current = postStatusSchema.parse(post.status);
      if (current !== "validated" && current !== "failed" && current !== "scheduled") {
        return json({ error: `La publication est au statut « ${current} » : elle doit d'abord être validée par la gérante (update_post status validated).` });
      }
      const when = new Date(scheduled_at ?? (post.scheduled_at as string | null) ?? Date.now());
      const at = when.getTime() < Date.now() + 60_000 ? new Date() : when;
      check(
        await db
          .from("posts")
          .update({ status: "scheduled", scheduled_at: at.toISOString(), publish_started_at: null, publish_error: null })
          .eq("id", post_id),
      );
      const now = at.getTime() <= Date.now() + 1000;
      if (now) ctx.afterReply.push(async () => void (await publishIfDue(post_id)));
      return json({
        status: "scheduled",
        scheduled_at: at.toISOString(),
        note: now
          ? "Publication immédiate après ta réponse ; la gérante recevra le lien du Reel."
          : "Fauve publiera automatiquement à l'horaire prévu et préviendra la gérante.",
      });
    },

    async get_instagram_activity({ media_limit, comments_per_post }) {
      const account = await instagramAccount(studioId);
      if (!account) return json({ error: "Instagram n'est pas connecté. Envoie le lien de connexion (get_connect_link)." });
      try {
        const media = await recentMedia(account.userId, account.accessToken, media_limit);
        const detailed = await Promise.all(
          media.map(async (m, i) => ({
            id: m.id,
            date: m.timestamp,
            type: m.media_product_type ?? m.media_type,
            caption: m.caption?.slice(0, 160),
            permalink: m.permalink,
            likes: m.like_count,
            comments_count: m.comments_count,
            // Insights cost one call each: the most recent posts are what the analysis needs.
            insights: i < 6 ? await mediaInsights(m.id, account.accessToken).catch(() => null) : undefined,
            comments:
              comments_per_post && m.comments_count
                ? (await mediaComments(m.id, account.accessToken, comments_per_post).catch(() => [])).map((c) => ({
                    id: c.id,
                    from: c.username,
                    text: c.text?.slice(0, 200),
                    date: c.timestamp,
                    likes: c.like_count,
                    replies: c.replies?.data?.map((r) => ({ from: r.username, text: r.text })) ?? [],
                    answered_by_studio: c.replies?.data?.some((r) => r.username === account.handle) ?? false,
                  }))
                : [],
          })),
        );
        return json({ account: `@${account.handle}`, media: detailed });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) });
      }
    },

    async reply_to_comment({ comment_id, message }) {
      const account = await instagramAccount(studioId);
      if (!account) return json({ error: "Instagram n'est pas connecté." });
      try {
        const id = await replyToComment(comment_id, account.accessToken, message);
        return json({ status: "posted", reply_id: id });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) });
      }
    },

    async get_metrics({ from, to }) {
      const rows = unwrap(
        await db
          .from("metrics")
          .select("post_id, platform, captured_at, views, reach, likes, saves, shares, comments, profile_visits, posts(title, kind, scheduled_at)")
          .eq("studio_id", studioId)
          .gte("captured_at", from)
          .lte("captured_at", to)
          .order("captured_at", { ascending: false })
          .limit(200),
      );
      const latest = new Map<string, (typeof rows)[number]>();
      for (const row of rows) if (!latest.has(`${row.post_id}:${row.platform}`)) latest.set(`${row.post_id}:${row.platform}`, row);
      return json({ metrics: [...latest.values()] });
    },

    async react_to_message({ emoji }) {
      if (ctx.waId && ctx.replyToMessageId) {
        await sendReaction(ctx.waId, ctx.replyToMessageId, emoji);
        await setReaction({ waMessageId: ctx.replyToMessageId }, "fauve", emoji);
      } else if (ctx.reactToRowId) {
        await setReaction({ id: ctx.reactToRowId }, "fauve", emoji);
      } else {
        return "Pas de message auquel réagir.";
      }
      ctx.reactions.push(emoji);
      return "ok";
    },

    async reply_with({ options, posts, grid }) {
      let own: string[] = [];
      if (posts?.length) {
        const { data } = await db.from("posts").select("id").eq("studio_id", studioId).in("id", posts);
        const found = new Set((data ?? []).map((p) => p.id as string));
        own = posts.filter((id) => found.has(id));
        if (own.length < posts.length) return "Publication introuvable : vérifie les id avec get_calendar.";
      }
      ctx.extras.options = options;
      ctx.extras.posts = own.length ? own : undefined;
      ctx.extras.grid = grid || undefined;
      return "ok : affiché sous ton message.";
    },
  };
}
