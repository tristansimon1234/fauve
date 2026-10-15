import { dayLabel } from "@fauve/agent";
import { after } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { addDays, localDateOf, localTimeOf, toIsoDate } from "@/lib/dates";
import { messageOwner } from "@/lib/owner-message";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Each morning (pg_cron): what gets her material. The day's filming missions
// (her « À filmer » list, due today), once; and for a publication tomorrow
// still without material, a plan B: film today, or Simone does without.
export const maxDuration = 300;

const FORMAT: Record<string, string> = { reel: "ton Reel", carousel: "ton carrousel", post: "ta photo", story: "ta story" };

async function missions() {
  const db = supabaseAdmin();
  const soon = new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 10);
  const { data: open } = await db
    .from("shot_requests")
    .select("id, studio_id, label, hint, due_date, post_id, studios(timezone), posts(title, kind, scheduled_at)")
    .eq("done", false)
    .is("reminded_at", null)
    .lte("due_date", soon);
  const byStudio = new Map<string, NonNullable<typeof open>>();
  for (const shot of open ?? []) {
    const timezone = (shot.studios as unknown as { timezone: string } | null)?.timezone ?? "Europe/Paris";
    if ((shot.due_date as string) > toIsoDate(localDateOf(new Date(), timezone))) continue;
    byStudio.set(shot.studio_id as string, [...(byStudio.get(shot.studio_id as string) ?? []), shot]);
  }
  for (const [studioId, shots] of byStudio) {
    const timezone = (shots[0]!.studios as unknown as { timezone: string } | null)?.timezone ?? "Europe/Paris";
    const localDay = (at: string) => dayLabel(toIsoDate(localDateOf(new Date(at), timezone)));
    const lines = shots.map((s) => {
      const post = s.posts as unknown as { title: string | null; kind: string; scheduled_at: string | null } | null;
      const when = post?.scheduled_at ? ` (${FORMAT[post.kind] ?? "ta publication"} « ${post.title ?? ""} » de ${localDay(post.scheduled_at)})` : "";
      return [`${s.label}${when}`, s.hint].filter(Boolean).join("\n");
    });
    const text = [
      shots.length > 1 ? "Tes missions du jour 🎬" : "Ta mission du jour 🎬",
      lines.join("\n\n"),
      "Envoie-moi ça ici dès que c'est filmé, en document pour garder la qualité. Je m'occupe du reste.",
    ].join("\n\n");
    const first = shots[0]!;
    const firstPost = first.posts as unknown as { scheduled_at: string | null } | null;
    try {
      await messageOwner(studioId, {
        text,
        notes: shots.map((s) => `mission envoyée shot_id=${s.id as string}${s.post_id ? ` post_id=${s.post_id as string}` : ""}`),
        template: { name: "content_request", params: [first.label as string, firstPost?.scheduled_at ? localDay(firstPost.scheduled_at) : "cette semaine"] },
      });
      await db.from("shot_requests").update({ reminded_at: new Date().toISOString() }).in("id", shots.map((s) => s.id as string));
    } catch (error) {
      console.error("daily mission failed", studioId, error);
    }
  }
}

async function planB() {
  const db = supabaseAdmin();
  const now = Date.now();
  const { data: posts } = await db
    .from("posts")
    .select("id, studio_id, title, kind, scheduled_at, media_ids, edit_plan_id, studios(timezone)")
    .in("status", ["planned", "content_requested"])
    .is("plan_b_at", null)
    .is("edit_plan_id", null)
    .gte("scheduled_at", new Date(now).toISOString())
    .lte("scheduled_at", new Date(now + 60 * 3600_000).toISOString());
  for (const post of posts ?? []) {
    if ((post.media_ids as string[] | null)?.length) continue;
    const timezone = (post.studios as unknown as { timezone: string } | null)?.timezone ?? "Europe/Paris";
    const at = new Date(post.scheduled_at as string);
    const tomorrow = toIsoDate(addDays(localDateOf(new Date(), timezone), 1));
    if (toIsoDate(localDateOf(at, timezone)) !== tomorrow) continue;
    const studioId = post.studio_id as string;
    const [{ count: banked }, { count: site }] = await Promise.all([
      db.from("media_assets").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("bank", true),
      db.from("media_assets").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("source", "website"),
    ]);
    const without = banked
      ? "je pars d'une vidéo de ta banque de plans"
      : site
        ? "j'en fais un carrousel avec les photos de ton site"
        : "on la décale à un autre jour";
    const { hours, minutes } = localTimeOf(at, timezone);
    const time = `${hours} h${minutes ? String(minutes).padStart(2, "0") : ""}`;
    const text = `Demain à ${time}, il y a ${FORMAT[post.kind as string] ?? "ta publication"} « ${post.title ?? ""} », et je n'ai pas encore de quoi le faire. Si tu peux filmer aujourd'hui, envoie-moi ça ici. Sinon, ${without}.`;
    try {
      await messageOwner(studioId, {
        text,
        options: ["Je filme aujourd'hui", "Fais sans"],
        notes: [`plan B proposé post_id=${post.id as string}`],
        template: { name: "content_request", params: ["ta vidéo", `demain (« ${post.title ?? ""} »)`] },
      });
      await db.from("posts").update({ plan_b_at: new Date().toISOString() }).eq("id", post.id);
    } catch (error) {
      console.error("plan B failed", post.id, error);
    }
  }
}

async function run() {
  await missions().catch((error) => console.error("daily missions failed", error));
  await planB().catch((error) => console.error("plan B failed", error));
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  after(run);
  return Response.json({ queued: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
