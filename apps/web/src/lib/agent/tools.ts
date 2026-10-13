import "server-only";
import { createHash, randomBytes } from "node:crypto";
import {
  assertTransition,
  canTransition,
  postStatusSchema,
  type ToolHandlers,
} from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { setReaction } from "@/lib/reactions";
import { sendReaction } from "@/lib/whatsapp/client";
import { queueJob } from "@/lib/jobs";
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
};

const json = (value: unknown) => JSON.stringify(value);

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
export function createToolHandlers(ctx: ToolContext): ToolHandlers {
  const db = supabaseAdmin();
  const { studioId } = ctx;

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
      const token = randomBytes(24).toString("base64url");
      const { data: member } = await db.from("members").select("phone_e164, user_id").eq("id", ctx.memberId).single();
      check(
        await db.from("login_tokens").insert({
          user_id: member?.user_id ?? null,
          phone_e164: member?.phone_e164,
          token_hash: createHash("sha256").update(token).digest("hex"),
          purpose: "connect_social",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }),
      );
      return json({ url: `${env("APP_URL")}/auth/link/${token}?next=/connect`, expires_in_minutes: 15 });
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
      const post = unwrap(
        await db
          .from("posts")
          .insert({ studio_id: studioId, status: "planned", ...input })
          .select("id, kind, title, scheduled_at, status")
          .single(),
      );
      return json({ post });
    },

    async update_post({ post_id, status, ...fields }) {
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

    async montage({ post_id, media_ids, brief }) {
      const post = unwrap(await db.from("posts").select("id, title").eq("id", post_id).eq("studio_id", studioId).single());
      // The montage outlives this reply: it runs as a background job and sends the video itself.
      ctx.afterReply.push(() =>
        queueJob("montage", {
          step: "design",
          studioId,
          postId: post_id,
          mediaIds: media_ids,
          brief,
          waId: ctx.waId,
          replyTo: ctx.replyToMessageId,
        }),
      );
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
      ctx.afterReply.push(() =>
        renderAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId }),
      );
      return json({
        status: "started",
        note: "Le montage démarre après ta réponse et la vidéo sera envoyée automatiquement (environ une minute). Annonce-le en une phrase, sans décrire la vidéo comme si elle était déjà prête.",
      });
    },

    async schedule_post({ post_id, scheduled_at }) {
      const post = unwrap(
        await db.from("posts").select("id, status, render_id, scheduled_at").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (!post.render_id) return json({ error: "Pas encore de vidéo montée : lance render d'abord." });
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
  };
}
