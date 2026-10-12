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
import { sendReaction } from "@/lib/whatsapp/client";

export type ToolContext = {
  studioId: string;
  memberId: string;
  /** WhatsApp id of the manager, and the inbound message to react to (WhatsApp channel only). */
  waId?: string;
  replyToMessageId?: string;
  /** Filled by react_to_message so the caller knows an emoji was sent. */
  reactions: string[];
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
        db.from("studios").select("name, timezone, onboarding_step, booking_url").eq("id", studioId).single(),
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

    async react_to_message({ emoji }) {
      if (!ctx.waId || !ctx.replyToMessageId) return "Pas de message WhatsApp auquel réagir.";
      await sendReaction(ctx.waId, ctx.replyToMessageId, emoji);
      ctx.reactions.push(emoji);
      return "ok";
    },
  };
}
