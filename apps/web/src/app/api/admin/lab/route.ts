import { after } from "next/server";
import { isMotionSegment, motionTemplateSchema, editPlanSchema, type MotionTemplate } from "@fauve/agent";
import { cronAuthorized } from "@/lib/cron-auth";
import { queueJob } from "@/lib/jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { photoRegions } from "@/lib/video/regions";

// A test bench for the whole montage chain in production: what Simone makes alone, on
// the same media as hand-made references. Each case is a lab studio of its own (its
// business, brand and facts; website_url lab://<case>), so its Reel is a first Reel, as
// at onboarding. POST with CRON_SECRET, from the database (call_app):
//   ?case=…[&reset=1]    sets up the studio and its media if needed (free stock clips by
//                        URL, or the photos of a demo studio), has them all read (Gemini),
//                        then starts the same montage job as a manager's Reel at the default
//                        care (editor, motion designer, render with music, critic, corrections),
//                        without a quote. Answers at once and works after the response.
//                        reset=1 first removes the case's posts and scenes, for a new first Reel.
//   ?case=…&step=result  every version: its render (signed link, 24 h), the plan kept
//                        (without the scenes' code), the delivered message and the costs.
// Lab studios go with /api/admin/delete-studio.
export const maxDuration = 300;

type LabCase = {
  name: string;
  business: string;
  facts: string[];
  brand: { colors: string[]; fonts: [string, string]; tone: string };
  template?: MotionTemplate;
  title: string;
  /** What she asks for: the post's idea and the editor's request. */
  idea: string;
  /** Free stock clips (Mixkit licence), in 720p. */
  clips?: number[];
  /** The vertical photos of a demo studio. */
  photosOf?: { studio: string; max: number };
};

const CASES: Record<string, LabCase> = {
  pizzeria: {
    name: "Pizzeria Nonna",
    business: "pizzeria",
    facts: ["Pizzeria napolitaine au feu de bois, Paris 11e", "Pâte maturée 48 h, pétrie chaque matin", "Ouvert tous les soirs, terrasse aux beaux jours"],
    brand: { colors: ["#C8102E", "#F4EDE1", "#1E5631"], fonts: ["Anton", "Space Mono"], tone: "chaleureux, tutoiement, une pointe d'humour" },
    template: "dynamique",
    title: "Dîner ce soir",
    idea: "Un Reel qui donne envie de venir dîner ce soir.",
    clips: [42484, 42465, 42469, 42481, 42480, 44007, 2597],
  },
  pilates: {
    name: "Studio Ciel",
    business: "studio de Pilates Reformer",
    facts: ["Studio de Pilates Reformer à Lyon", "6 reformers, cours de 50 minutes, 8 personnes au plus", "Premier cours d'essai offert"],
    brand: { colors: ["#B4532A", "#EFE6DA", "#2F3B2F"], fonts: ["Instrument Serif", "Inter Tight"], tone: "doux, motivant, tutoiement" },
    template: "doux",
    title: "Cours d'essai",
    idea: "Un Reel qui donne envie de réserver un cours d'essai.",
    clips: [48562, 48547, 48553, 48558, 48548, 48560, 48552],
  },
  barbier: {
    name: "Le Comptoir",
    business: "barbier",
    facts: ["Barbier à Bordeaux, coupe et barbe à l'ancienne", "Serviette chaude à chaque rasage", "Barbe et coupe en 45 minutes"],
    brand: { colors: ["#B08D57", "#F3EEE6", "#1B1B1B"], fonts: ["Playfair Display", "Inter Tight"], tone: "posé, précis, tutoiement" },
    template: "chic",
    title: "Coupe et barbe",
    idea: "Un Reel qui montre le soin d'une coupe et barbe.",
    clips: [43233, 43240, 43232, 43241, 43279, 43226],
  },
  coiffure: {
    name: "Atelier Mila",
    business: "salon de coiffure",
    facts: ["Salon de coiffure à Nantes, coupes et couleurs naturelles", "Balayage sur mesure, diagnostic offert"],
    brand: { colors: ["#C9898F", "#F7EFEA", "#3A2E2C"], fonts: ["Fraunces", "Inter Tight"], tone: "doux, chaleureux, tutoiement" },
    title: "L'ambiance du salon",
    idea: "Un Reel avec mes photos du salon, pour faire découvrir l'ambiance.",
    photosOf: { studio: "Maison Maya", max: 8 },
  },
  trattoria: {
    name: "Trattoria Sole",
    business: "restaurant italien",
    facts: ["Restaurant italien à Marseille, pâtes fraîches et pizzas au feu de bois", "Grande terrasse face au port"],
    brand: { colors: ["#E07A1F", "#FBF3E4", "#23402E"], fonts: ["Bricolage Grotesque", "Inter Tight"], tone: "gourmand, joyeux, tutoiement" },
    title: "La terrasse ce week-end",
    idea: "Un Reel avec mes photos et mes vidéos pour remplir la terrasse ce week-end.",
    clips: [42469, 42481, 42480, 42484],
    photosOf: { studio: "Chez Lino", max: 5 },
  },
};

const labUrl = (name: string) => `lab://${name}`;

async function labStudio(name: string, c: LabCase): Promise<string> {
  const db = supabaseAdmin();
  const found = await db.from("studios").select("id").eq("website_url", labUrl(name)).maybeSingle();
  if (found.data) return found.data.id as string;
  const at = new Date().toISOString();
  const studio = await db
    .from("studios")
    .insert({ name: c.name, business_type: c.business, website_url: labUrl(name), onboarding_step: "first_post", memory: c.facts.map((fact) => ({ fact, at })) })
    .select("id")
    .single();
  if (studio.error) throw new Error(studio.error.message);
  const profile = { tone: c.brand.tone, colors: c.brand.colors, fonts: c.brand.fonts, dos: [], donts: [] };
  const brand = await db.from("brand_profiles").insert({ studio_id: studio.data.id, version: 1, profile });
  if (brand.error) throw new Error(brand.error.message);
  return studio.data.id as string;
}

/** The case's media in the lab studio (copied once), videos then photos. */
async function labMedia(studioId: string, c: LabCase): Promise<{ videos: string[]; photos: string[] }> {
  const db = supabaseAdmin();
  const have = new Map(((await db.from("media_assets").select("id, storage_path").eq("studio_id", studioId)).data ?? []).map((m) => [m.storage_path as string, m.id as string]));
  const add = async (path: string, row: Record<string, unknown>, bytes: () => Promise<{ error: { message: string } | null }>) => {
    const known = have.get(path);
    if (known) return known;
    const { error } = await bytes();
    if (error) throw new Error(`${path}: ${error.message}`);
    const inserted = await db.from("media_assets").insert({ studio_id: studioId, storage_path: path, source: "library", consent_ok: true, ...row }).select("id").single();
    if (inserted.error) throw new Error(inserted.error.message);
    return inserted.data.id as string;
  };

  const videos = await Promise.all(
    (c.clips ?? []).map((clip) =>
      add(`${studioId}/lab/${clip}.mp4`, { kind: "video", mime_type: "video/mp4" }, async () => {
        const res = await fetch(`https://assets.mixkit.co/videos/${clip}/${clip}-720.mp4`, { headers: { "user-agent": "Mozilla/5.0 (compatible; SimoneLab/1.0)" } });
        if (!res.ok) return { error: { message: `stock clip ${clip}: ${res.status}` } };
        const body = Buffer.from(await res.arrayBuffer());
        return db.storage.from("media").upload(`${studioId}/lab/${clip}.mp4`, body, { contentType: "video/mp4", upsert: true });
      }),
    ),
  );

  let photos: string[] = [];
  if (c.photosOf) {
    const demo = await db.from("studios").select("id").eq("name", c.photosOf.studio).is("website_url", null).limit(1).single();
    if (demo.error) throw new Error(`demo studio ${c.photosOf.studio}: ${demo.error.message}`);
    const source = await db
      .from("media_assets")
      .select("storage_path, width, height, mime_type")
      .eq("studio_id", demo.data.id)
      .eq("kind", "image")
      .gt("height", 1600)
      .order("created_at")
      .limit(c.photosOf.max);
    photos = await Promise.all(
      (source.data ?? []).map((p) => {
        const file = (p.storage_path as string).split("/").pop()!;
        return add(`${studioId}/lab/${file}`, { kind: "image", mime_type: p.mime_type ?? "image/jpeg", width: p.width, height: p.height }, () =>
          db.storage.from("media").copy(p.storage_path as string, `${studioId}/lab/${file}`),
        );
      }),
    );
  }
  return { videos, photos };
}

async function start(name: string, c: LabCase, reset: boolean) {
  const db = supabaseAdmin();
  const studioId = await labStudio(name, c);
  if (reset) {
    await db.from("posts").delete().eq("studio_id", studioId);
    await db.from("motion_templates").delete().eq("studio_id", studioId);
  }
  const { videos, photos } = await labMedia(studioId, c);
  // Everything read first, as when she sends them: Gemini watches each video, each photo is framed.
  const [analyses] = await Promise.all([
    Promise.all(videos.map((id) => ensureClipAnalysis(studioId, id, { waitMs: 240_000 }))),
    Promise.all(photos.map((id) => photoRegions(studioId, id).catch((error: unknown) => console.warn("lab: photo not read", id, error)))),
  ]);
  const unread = analyses.filter((a) => !("analysis" in a));
  if (unread.length) console.warn("lab: videos not read", JSON.stringify(unread));
  const mediaIds = [...videos, ...photos];
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setUTCHours(17, 0, 0, 0);
  const post = await db
    .from("posts")
    .insert({ studio_id: studioId, kind: "reel", title: c.title, status: "media_received", platforms: ["instagram"], scheduled_at: tomorrow.toISOString(), template: c.template ?? null, media_ids: mediaIds })
    .select("id")
    .single();
  if (post.error) throw new Error(post.error.message);
  // The same chain as her first Reel at the default care, without a quote: two scenes of her own.
  await queueJob("montage", { step: "design", studioId, postId: post.data.id, mediaIds, brief: c.idea, maxNewScenes: 2, effort: "soigne" });
  console.log("lab: montage started", name, post.data.id);
}

async function result(name: string) {
  const db = supabaseAdmin();
  const studio = await db.from("studios").select("id").eq("website_url", labUrl(name)).maybeSingle();
  if (!studio.data) return { error: "case not set up" };
  const studioId = studio.data.id as string;
  const post = await db.from("posts").select("id, title, status, agent_note, edit_plan_id, render_id, created_at").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!post.data) return { studioId, error: "no post" };
  const [plans, message, costs] = await Promise.all([
    db.from("edit_plans").select("id, version, plan, created_at").eq("post_id", post.data.id).order("version"),
    db.from("whatsapp_messages").select("body, created_at").eq("studio_id", studioId).eq("direction", "outbound").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("cost_events").select("kind, cost_eur").eq("studio_id", studioId),
  ]);
  const planIds = (plans.data ?? []).map((p) => p.id as string);
  const renders = planIds.length
    ? ((await db.from("renders").select("id, edit_plan_id, status, storage_path, duration_ms, error, created_at").in("edit_plan_id", planIds).order("created_at")).data ?? [])
    : [];
  const paths = renders.flatMap((r) => (r.storage_path ? [r.storage_path as string] : []));
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 86_400)).data ?? []) : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const kept = (plans.data ?? []).find((p) => p.id === post.data!.edit_plan_id);
  const plan = editPlanSchema.safeParse(kept?.plan);
  const byKind: Record<string, number> = {};
  for (const c of costs.data ?? []) byKind[c.kind as string] = Math.round(((byKind[c.kind as string] ?? 0) + Number(c.cost_eur)) * 1000) / 1000;
  return {
    studioId,
    post: post.data,
    plans: (plans.data ?? []).map((p) => ({ id: p.id, version: p.version, at: p.created_at })),
    renders: renders.map((r) => ({ plan: r.edit_plan_id, status: r.status, seconds: r.duration_ms ? Math.round((r.duration_ms as number) / 100) / 10 : null, error: r.error, url: r.storage_path ? url.get(r.storage_path as string) : null })),
    message: message.data?.body ?? null,
    costs: byKind,
    // The plan kept, readable: the scenes' code left out.
    plan: plan.success
      ? {
          ...plan.data,
          segments: plan.data.segments.map((s) => (isMotionSegment(s) ? { motion: { brief: s.motion.brief, template_id: s.motion.template_id, coded: Boolean(s.motion.js) }, duration: s.duration, over: s.over } : s)),
        }
      : null,
  };
}

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const name = params.get("case") ?? "";
  const c = CASES[name];
  if (!c) return Response.json({ error: `case=${Object.keys(CASES).join("|")}` }, { status: 400 });
  if (c.template && !motionTemplateSchema.safeParse(c.template).success) return Response.json({ error: "template" }, { status: 400 });
  if (params.get("step") === "result") return Response.json(await result(name));
  // call_app gives up after a few seconds: the work goes on after the answer.
  after(() => start(name, c, params.get("reset") === "1").catch((error: unknown) => console.error("lab: case failed", name, error)));
  return Response.json({ ok: true, case: name, started: true });
}
