import { timingSafeEqual } from "node:crypto";
import { editPlanSchema, motionTemplateSchema, variantPlan, type MotionTemplate } from "@fauve/agent";
import { insertPlanVersion } from "@/lib/edit-plans";
import { env } from "@/lib/env";
import { renderPost } from "@/lib/render/render-post";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The landing's demo Reels again, each in its own style with current fonts:
// a new version of each demo post's plan (same cut and texts), rendered with the
// music Simone composes for it, then copied to the public `landing` bucket.
// One Reel per call (?reel=pilates|coiffure|trattoria, &template= to change its style), with CRON_SECRET (sent
// from the database through pg_net).
export const maxDuration = 300;

const REELS: Record<string, { studio: string; template: MotionTemplate; fonts: { display: string; body: string } }> = {
  pilates: { studio: "Studio Lune", template: "collage", fonts: { display: "Bricolage Grotesque", body: "DM Mono" } },
  coiffure: { studio: "Maison Maya", template: "doux", fonts: { display: "Instrument Serif", body: "Inter Tight" } },
  trattoria: { studio: "Chez Lino", template: "collage", fonts: { display: "Anton", body: "Space Mono" } },
};

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const name = params.get("reel");
  const reel = name ? REELS[name] : undefined;
  const asked = motionTemplateSchema.safeParse(params.get("template"));
  const template = asked.success ? asked.data : reel?.template;
  if (!name || !reel) return Response.json({ error: "reel=pilates|coiffure|trattoria" }, { status: 400 });
  const db = supabaseAdmin();
  try {
    const { data: studio } = await db.from("studios").select("id").eq("name", reel.studio).single();
    const { data: post } = await db.from("posts").select("id, edit_plan_id").eq("studio_id", studio!.id).eq("kind", "reel").order("created_at").limit(1).single();
    const { data: row } = await db.from("edit_plans").select("plan").eq("id", post!.edit_plan_id).single();
    const current = editPlanSchema.parse(row!.plan);
    const plan = editPlanSchema.parse({ ...variantPlan(current, { template }), transitions: template === "doux" || template === "chic" ? "fade" : "cut", fonts: reel.fonts });
    const inserted = await insertPlanVersion(studio!.id, post!.id, plan);
    await db.from("posts").update({ edit_plan_id: inserted.id, template }).eq("id", post!.id);
    const result = await renderPost(studio!.id, post!.id, { editPlanId: inserted.id, freshMusic: true });
    const file = await db.storage.from("media").download(result.storagePath);
    if (file.error) throw new Error(file.error.message);
    const mp4 = Buffer.from(await file.data.arrayBuffer());
    const { error } = await db.storage.from("landing").upload(`reel-${name}-music.mp4`, mp4, { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, reel: name, template, bytes: mp4.length, durationMs: result.durationMs });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
