import "server-only";
import { timingSafeEqual } from "node:crypto";
import { brandProfileSchema } from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Browser test chat: one sandbox studio, reached with a secret link, so Fauve
// can be tried end to end before WhatsApp is connected.

const TEST_PHONE = "+33100000001";

export function isValidTestKey(key: string | undefined | null): boolean {
  let expected: string;
  try {
    expected = env("FAUVE_TEST_KEY");
  } catch {
    return false;
  }
  if (!key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type TestMember = { memberId: string; studioId: string };

export async function getOrCreateTestMember(): Promise<TestMember> {
  const db = supabaseAdmin();
  const existing = await db.from("members").select("id, studio_id").eq("phone_e164", TEST_PHONE).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return { memberId: existing.data.id, studioId: existing.data.studio_id };

  const studio = await db.from("studios").insert({}).select("id").single();
  if (studio.error) throw new Error(studio.error.message);
  const member = await db
    .from("members")
    .insert({ studio_id: studio.data.id, phone_e164: TEST_PHONE, role: "owner" })
    .select("id")
    .single();
  if (member.error) throw new Error(member.error.message);
  return { memberId: member.data.id, studioId: studio.data.id };
}

/** Deletes the sandbox studio and everything attached to it (cascade). */
export async function resetTestStudio(): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db.from("members").select("studio_id").eq("phone_e164", TEST_PHONE).maybeSingle();
  if (data) {
    const res = await db.from("studios").delete().eq("id", data.studio_id);
    if (res.error) throw new Error(res.error.message);
  }
}

export type ChatMessage = { id: string; from: "me" | "fauve"; body: string; at: string };

export type TestSnapshot = {
  studio: { name: string | null; onboardingStep: string; websiteUrl: string | null; bookingUrl: string | null };
  manager: string | null;
  plan: { postsPerWeek: number; storiesPerWeek: number; platforms: string[] } | null;
  brandVersion: number | null;
  brandColors: string[];
  brandFonts: string[];
  posts: { id: string; kind: string; title: string; scheduledAt: string | null; status: string }[];
  shots: { id: string; label: string; hint: string | null; done: boolean }[];
  costEur: number;
};

export type TestState = { messages: ChatMessage[]; snapshot: TestSnapshot };

export async function loadTestState(member: TestMember): Promise<TestState> {
  const db = supabaseAdmin();
  const { studioId } = member;
  const [messages, studio, manager, plan, brand, posts, shots, costs] = await Promise.all([
    db
      .from("whatsapp_messages")
      .select("id, direction, body, created_at")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: true })
      .limit(200),
    db.from("studios").select("name, onboarding_step, website_url, booking_url").eq("id", studioId).single(),
    db.from("members").select("first_name").eq("id", member.memberId).single(),
    db.from("content_plans").select("posts_per_week, stories_per_week, platforms").eq("studio_id", studioId).maybeSingle(),
    db.from("brand_profiles").select("version, profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1),
    db
      .from("posts")
      .select("id, kind, title, scheduled_at, status")
      .eq("studio_id", studioId)
      .order("scheduled_at", { ascending: true })
      .limit(50),
    db.from("shot_requests").select("id, label, hint, done").eq("studio_id", studioId).order("created_at").limit(50),
    db.from("cost_events").select("cost_eur").eq("studio_id", studioId),
  ]);

  const brandStyle = brandProfileSchema
    .pick({ colors: true, fonts: true })
    .catch({})
    .parse(brand.data?.[0]?.profile ?? {});

  return {
    messages: (messages.data ?? [])
      .filter((m) => m.body)
      .map((m) => ({
        id: m.id,
        from: m.direction === "inbound" ? "me" : "fauve",
        body: m.body as string,
        at: m.created_at,
      })),
    snapshot: {
      studio: {
        name: studio.data?.name ?? null,
        onboardingStep: studio.data?.onboarding_step ?? "studio_name",
        websiteUrl: studio.data?.website_url ?? null,
        bookingUrl: studio.data?.booking_url ?? null,
      },
      manager: manager.data?.first_name ?? null,
      plan: plan.data
        ? {
            postsPerWeek: plan.data.posts_per_week,
            storiesPerWeek: plan.data.stories_per_week,
            platforms: plan.data.platforms,
          }
        : null,
      brandVersion: brand.data?.[0]?.version ?? null,
      brandColors: brandStyle.colors ?? [],
      brandFonts: brandStyle.fonts ?? [],
      posts: (posts.data ?? []).map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        scheduledAt: p.scheduled_at,
        status: p.status,
      })),
      shots: shots.data ?? [],
      costEur: (costs.data ?? []).reduce((sum, c) => sum + Number(c.cost_eur), 0),
    },
  };
}
