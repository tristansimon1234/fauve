import { after, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { designEdit } from "@/lib/agent/editor";
import { GPU, gpuCostEur, gpuReady, subjectsOnGpu } from "@/lib/render/gpu";
import { renderPost } from "@/lib/render/render-post";
import { dropSandbox, pruneSnapshots, trackSandbox, warmRemotionPool } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminKeyAuthorized } from "@/lib/test-studio";

// Admin helper to exercise the render worker, protected by FAUVE_TEST_KEY (Authorization: Bearer …, never in the address):
//   ?post=<post id>  renders the post's latest edit plan and returns a 24 h link.
//   ?action=warm     installs the Remotion templates in the render sandboxes (all three) ahead of the first render.
//   ?post=…&design=1[&brief=…]  has the editor (Opus) write a new plan first, then renders it.
// And POST ?action=warm with CRON_SECRET, from the database (call_app): the same warm-up,
// in the background (a new sandbox installs everything once, a few minutes, the collages'
// cut-out model and the tracker included). And POST
// ?action=drop&sandbox=<name>: deletes an old render sandbox (never the one in service). And POST
// ?action=prune: deletes the snapshots the sandboxes in service no longer need (the last two stay). And POST
// ?action=gpu-subject&media=<media id>&from=<s>&to=<s>: one passage of a video cut out on the rented card (Modal,
// lib/render/gpu.ts), in the background, its file in {studio}/lab-gpu/ and a 24 h link, its timing and cost in the logs
// (« gpu subject »), to try the card without a whole Reel.

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  if (!cronAuthorized(request)) return new Response("Forbidden", { status: 403 });
  const action = request.nextUrl.searchParams.get("action");
  if (action === "drop") {
    const name = request.nextUrl.searchParams.get("sandbox") ?? "";
    if (!/^[\w-]{1,128}$/.test(name)) return Response.json({ error: "sandbox name required" }, { status: 400 });
    try {
      return Response.json({ ok: true, sandbox: name, result: await dropSandbox(name) });
    } catch (error) {
      return Response.json({ ok: false, sandbox: name, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }
  if (action === "prune") {
    try {
      return Response.json({ ok: true, sandboxes: await pruneSnapshots() });
    } catch (error) {
      return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }
  if (action === "gpu-subject") {
    const media = request.nextUrl.searchParams.get("media") ?? "";
    const from = Number(request.nextUrl.searchParams.get("from") ?? "0");
    const to = Number(request.nextUrl.searchParams.get("to") ?? "0");
    // &gpu=A10G|T4|L40S|A100…: another card; &gpu=none: a machine without one (to see whether Modal starts one at all).
    const gpuParam = request.nextUrl.searchParams.get("gpu");
    const gpu = gpuParam === "none" ? null : gpuParam && /^[A-Z0-9-]{2,12}$/i.test(gpuParam) ? gpuParam.toUpperCase() : undefined;
    if (!/^[0-9a-f-]{36}$/.test(media) || !(to > from) || to - from > 8) return Response.json({ error: "media=<uuid>&from=<s>&to=<s> (8 s at most)" }, { status: 400 });
    if (!gpuReady()) return Response.json({ error: "MODAL_TOKEN_ID / MODAL_TOKEN_SECRET not set" }, { status: 400 });
    after(async () => {
      const db = supabaseAdmin();
      const { data: row } = await db.from("media_assets").select("studio_id, storage_path").eq("id", media).maybeSingle();
      if (!row?.storage_path) return console.error("gpu subject: no such media", media);
      const base = `${row.studio_id}/lab-gpu/${media}-${from}-${to}`;
      const [clip, webm, png] = await Promise.all([
        db.storage.from("media").createSignedUrl(row.storage_path, 3600),
        db.storage.from("media").createSignedUploadUrl(`${base}.webm`, { upsert: true }),
        db.storage.from("media").createSignedUploadUrl(`${base}.png`, { upsert: true }),
      ]);
      if (!clip.data?.signedUrl || !webm.data?.signedUrl || !png.data?.signedUrl) return console.error("gpu subject: links refused");
      // Its steps are in the logs as they happen (« gpu … »), then its result (« gpu subject »).
      const { results, seconds } = await subjectsOnGpu([{ key: "lab", url: clip.data.signedUrl, from, to, upload: { webm: webm.data.signedUrl, png: png.data.signedUrl } }], 700_000, { gpu });
      const result = results.lab;
      const card = gpu === undefined ? GPU : gpu;
      const cost = gpuCostEur(seconds, card);
      if (seconds > 0) await db.from("cost_events").insert({ studio_id: row.studio_id, kind: "matting", provider: "modal", units: Math.round(seconds), cost_eur: cost, meta: { lab: true, media, from, to, gpu: card ?? "none" } });
      const still = result && !(result instanceof Error) && result.still;
      const link = result && !(result instanceof Error) ? (await db.storage.from("media").createSignedUrl(`${base}.${still ? "png" : "webm"}`, 86_400)).data?.signedUrl : null;
      // Its link first (a log line is cut after a few hundred characters), its boxes counted, not listed.
      const summary = result instanceof Error || !result ? (result?.message ?? "nothing") : { ...result, boxes: result.boxes?.length ?? 0 };
      console.log("gpu subject", JSON.stringify({ link, media, from, to, gpu: card ?? "none", seconds: Math.round(seconds), cost_eur: Math.round(cost * 1000) / 1000, result: summary }));
    });
    return Response.json({ ok: true, started: true }, { status: 202 });
  }
  if (action !== "warm") return Response.json({ error: "unknown action" }, { status: 400 });
  after(async () => {
    const started = Date.now();
    try {
      await warmRemotionPool();
      // The cut-out model too (onnxruntime-node and 224 MB of weights, once), and the tracker in the same sandbox (Python, MediaPipe and its models).
      await trackSandbox();
      console.log("render sandbox warm", { elapsedMs: Date.now() - started });
    } catch (error) {
      console.error("render sandbox warm-up failed", error);
    }
  });
  return Response.json({ ok: true, warming: true }, { status: 202 });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!adminKeyAuthorized(request)) return new Response("Forbidden", { status: 403 });
  if (params.get("action") === "warm") {
    const started = Date.now();
    try {
      await warmRemotionPool();
      return Response.json({ ok: true, elapsedMs: Date.now() - started });
    } catch (error) {
      return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }
  const postId = params.get("post") ?? "";
  const post = await supabaseAdmin().from("posts").select("studio_id").eq("id", postId).maybeSingle();
  if (!post.data) return Response.json({ error: "post not found" }, { status: 404 });

  const started = Date.now();
  try {
    const studioId = post.data.studio_id as string;
    const edit = params.get("design")
      ? await designEdit({ studioId, postId, brief: params.get("brief") ?? undefined })
      : null;
    const designedMs = Date.now() - started;
    const result = await renderPost(studioId, postId);
    return Response.json({
      ok: true,
      elapsedMs: Date.now() - started,
      designedMs: edit ? designedMs : undefined,
      edit: edit ? { version: edit.version, rationale: edit.rationale, plan: edit.plan } : undefined,
      ...result,
    });
  } catch (error) {
    return Response.json(
      { ok: false, elapsedMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
