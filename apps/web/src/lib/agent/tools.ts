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
import { sendReaction, sendText, sendVideo } from "@/lib/whatsapp/client";
import { renderPost } from "@/lib/render/render-post";
import { instagramAccount, publishIfDue } from "@/lib/social/publish";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { readWebsite, WebsiteError } from "./website";

export type ToolContext = {
  studioId: string;
  memberId: string;
  /** WhatsApp id of the manager, and the inbound message to react to (WhatsApp channel only). */
  waId?: string;
  replyToMessageId?: string;
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
      return json({ clips: results });
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
      ctx.afterReply.push(() => renderAndDeliver(ctx, post_id));
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

    async react_to_message({ emoji }) {
      if (!ctx.waId || !ctx.replyToMessageId) return "Pas de message WhatsApp auquel réagir.";
      await sendReaction(ctx.waId, ctx.replyToMessageId, emoji);
      ctx.reactions.push(emoji);
      return "ok";
    },
  };
}

/** Renders the post and sends the video to the manager (WhatsApp) or into the web test chat. */
async function renderAndDeliver(ctx: ToolContext, postId: string): Promise<void> {
  const db = supabaseAdmin();
  const store = (fields: { wa_message_id?: string; type: string; body: string; payload?: Record<string, unknown> }) =>
    db.from("whatsapp_messages").insert({
      studio_id: ctx.studioId,
      channel: ctx.waId ? "whatsapp" : "web",
      direction: "outbound",
      phone_e164: ctx.waId ? `+${ctx.waId}` : null,
      ...fields,
      payload: { reply_to: ctx.replyToMessageId, ...fields.payload },
    });

  try {
    const r = await renderPost(ctx.studioId, postId);
    const seconds = Math.round(r.durationMs / 100) / 10;
    const hashtags = r.hashtags.map((h) => `#${h}`).join(" ");
    const caption = [
      `Ton montage « ${r.title} » (${seconds} s).`,
      r.caption ? `Légende :\n${r.caption}${hashtags ? `\n${hashtags}` : ""}` : null,
      "Réponds « ok » pour le valider, ou dis-moi ce que tu veux changer.",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (ctx.waId) {
      const id = await sendVideo(ctx.waId, r.url, caption);
      await store({ wa_message_id: id, type: "video", body: `[Vidéo envoyée : montage de « ${r.title} », ${seconds} s]\n${caption}`, payload: { render_id: r.renderId } });
    } else {
      await store({ type: "text", body: `${caption}\n\nVoir la vidéo : ${r.url}`, payload: { render_id: r.renderId } });
    }
  } catch (error) {
    console.error("render failed", postId, error);
    const text = "Le montage n’a pas abouti cette fois, je regarde ce qui coince. Tu veux que je réessaie ?";
    const id = ctx.waId ? await sendText(ctx.waId, text).catch(() => undefined) : undefined;
    await store({ wa_message_id: id, type: "text", body: text, payload: { render_error: String(error).slice(0, 500) } });
  }
}
