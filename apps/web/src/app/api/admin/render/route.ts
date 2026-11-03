import { after, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { designEdit } from "@/lib/agent/editor";
import { GPU, gpuCostEur, gpuReady, objectsOnGpu, photosOnGpu, reliefsOnGpu, subjectsOnGpu } from "@/lib/render/gpu";
import { reliefOf } from "@fauve/agent";
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
// (« gpu subject »), to try the card without a whole Reel. And POST ?action=gpu-objects&…&name=<object>: the same for
// an object followed by its name (« gpu object »). And POST ?action=gpu-relief&media=<photo>&move=in|out|left|right
// &seconds=<s>: a photo drawn in relief by its depth (« gpu relief »).

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
  // ?action=gpu-photos&media=<id>,<id>…: her photos cut out on the card (the general model), in the background, each
  // file in {studio}/lab-gpu/photo-<id> (its kept cut-out untouched), one log line each (« gpu photo ») with its link
  // and the link of the cut-out it already has, to compare; the time and cost in « gpu photos ».
  if (action === "gpu-photos") {
    const ids = (request.nextUrl.searchParams.get("media") ?? "").split(",").filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 10);
    if (!ids.length) return Response.json({ error: "media=<uuid>,<uuid>… (10 at most)" }, { status: 400 });
    if (!gpuReady()) return Response.json({ error: "MODAL_TOKEN_ID / MODAL_TOKEN_SECRET not set" }, { status: 400 });
    after(async () => {
      const db = supabaseAdmin();
      const { data: rows } = await db.from("media_assets").select("id, studio_id, storage_path, kind, cutout").in("id", ids);
      const photos = (rows ?? []).filter((r) => r.kind === "image" && r.storage_path);
      if (!photos.length) return console.error("gpu photos: no such photos", ids);
      const lab = (r: (typeof photos)[number], ext: string) => `${r.studio_id}/lab-gpu/photo-${r.id}.${ext}`;
      const jobs = (
        await Promise.all(
          photos.map(async (r) => {
            const [src, webp, png] = await Promise.all([
              db.storage.from("media").createSignedUrl(r.storage_path as string, 3600),
              db.storage.from("media").createSignedUploadUrl(lab(r, "webp"), { upsert: true }),
              db.storage.from("media").createSignedUploadUrl(lab(r, "png"), { upsert: true }),
            ]);
            return src.data?.signedUrl && webp.data?.signedUrl && png.data?.signedUrl ? [{ key: r.id as string, url: src.data.signedUrl, upload: { webp: webp.data.signedUrl, png: png.data.signedUrl } }] : [];
          }),
        )
      ).flat();
      const { results, seconds } = await photosOnGpu(jobs, 700_000, { startMs: 600_000 });
      for (const r of photos) {
        const result = results[r.id as string];
        const kept = (r.cutout ?? null) as { path?: string; model?: string } | null;
        const [link, before] = await Promise.all([
          result && !(result instanceof Error) ? db.storage.from("media").createSignedUrl(lab(r, result.ext), 86_400).then((x) => x.data?.signedUrl ?? null) : null,
          kept?.path ? db.storage.from("media").createSignedUrl(kept.path, 86_400).then((x) => x.data?.signedUrl ?? null) : null,
        ]);
        console.log("gpu photo", JSON.stringify({ link, before, before_model: kept?.model ?? null, media: r.id, result: result instanceof Error || !result ? (result?.message ?? "nothing") : result.reading }));
      }
      const cost = gpuCostEur(seconds);
      const studio = photos[0]!.studio_id as string;
      if (seconds > 0) await db.from("cost_events").insert({ studio_id: studio, kind: "cutout", provider: "modal", units: Math.round(seconds), cost_eur: cost, meta: { lab: true, photos: jobs.length, gpu: GPU } });
      console.log("gpu photos", JSON.stringify({ photos: jobs.length, seconds: Math.round(seconds), cost_eur: Math.round(cost * 1000) / 1000 }));
    });
    return Response.json({ ok: true, started: true }, { status: 202 });
  }
  // ?action=gpu-objects&media=<id>&from=<s>&to=<s>&name=<the object, in English>: an object followed through a passage
  // on the card (PyTorch: found by its name, followed by SAM 2, cut out), its file in {studio}/lab-gpu/ (« gpu object »);
  // its first call builds the card's PyTorch machine (10 min allowed for it).
  if (action === "gpu-objects") {
    const media = request.nextUrl.searchParams.get("media") ?? "";
    const from = Number(request.nextUrl.searchParams.get("from") ?? "0");
    const to = Number(request.nextUrl.searchParams.get("to") ?? "0");
    const name = (request.nextUrl.searchParams.get("name") ?? "").trim().slice(0, 60);
    if (!/^[0-9a-f-]{36}$/.test(media) || !(to > from) || to - from > 8 || !name) return Response.json({ error: "media=<uuid>&from=<s>&to=<s>&name=<object> (8 s at most)" }, { status: 400 });
    if (!gpuReady()) return Response.json({ error: "MODAL_TOKEN_ID / MODAL_TOKEN_SECRET not set" }, { status: 400 });
    after(async () => {
      const db = supabaseAdmin();
      const { data: row } = await db.from("media_assets").select("studio_id, storage_path").eq("id", media).maybeSingle();
      if (!row?.storage_path) return console.error("gpu object: no such media", media);
      const base = `${row.studio_id}/lab-gpu/object-${media}-${from}-${to}`;
      const [clip, webm, png] = await Promise.all([
        db.storage.from("media").createSignedUrl(row.storage_path, 3600),
        db.storage.from("media").createSignedUploadUrl(`${base}.webm`, { upsert: true }),
        db.storage.from("media").createSignedUploadUrl(`${base}.png`, { upsert: true }),
      ]);
      if (!clip.data?.signedUrl || !webm.data?.signedUrl || !png.data?.signedUrl) return console.error("gpu object: links refused");
      const { results, seconds } = await objectsOnGpu([{ key: "lab", url: clip.data.signedUrl, from, to, name, upload: { webm: webm.data.signedUrl, png: png.data.signedUrl } }], 700_000, { startMs: 600_000 });
      const result = results.lab;
      const cost = gpuCostEur(seconds);
      if (seconds > 0) await db.from("cost_events").insert({ studio_id: row.studio_id, kind: "matting", provider: "modal", units: Math.round(seconds), cost_eur: cost, meta: { lab: true, media, from, to, object: name, gpu: GPU } });
      const link = result && !(result instanceof Error) ? (await db.storage.from("media").createSignedUrl(`${base}.${result.still ? "png" : "webm"}`, 86_400)).data?.signedUrl : null;
      const summary = result instanceof Error || !result ? (result?.message ?? "nothing") : { ...result, boxes: result.boxes?.length ?? 0, contours: result.contours?.length ?? 0 };
      console.log("gpu object", JSON.stringify({ link, media, from, to, name, seconds: Math.round(seconds), cost_eur: Math.round(cost * 1000) / 1000, result: summary }));
    });
    return Response.json({ ok: true, started: true }, { status: 202 });
  }
  // ?action=gpu-relief&media=<photo id>&move=in|out|left|right&seconds=<s>: a photo drawn in relief by its depth on the
  // card (relief.py, the PyTorch machine), framed as a Reel frames it, its video in {studio}/lab-gpu/ (« gpu relief »);
  // its first call adds the depth model to the card's PyTorch machine.
  if (action === "gpu-relief") {
    const media = request.nextUrl.searchParams.get("media") ?? "";
    const move = request.nextUrl.searchParams.get("move") ?? "in";
    const seconds = Math.min(6, Math.max(1, Number(request.nextUrl.searchParams.get("seconds") ?? "3") || 3));
    if (!/^[0-9a-f-]{36}$/.test(media) || !["in", "out", "left", "right"].includes(move)) return Response.json({ error: "media=<uuid>&move=in|out|left|right&seconds=<s>" }, { status: 400 });
    if (!gpuReady()) return Response.json({ error: "MODAL_TOKEN_ID / MODAL_TOKEN_SECRET not set" }, { status: 400 });
    after(async () => {
      const db = supabaseAdmin();
      const { data: row } = await db.from("media_assets").select("studio_id, storage_path, kind, regions").eq("id", media).maybeSingle();
      if (!row?.storage_path || row.kind !== "image") return console.error("gpu relief: no such photo", media);
      const read = (row.regions ?? {}) as { width?: number; height?: number };
      const frames = Math.round(seconds * 30);
      const shot = reliefOf(
        { clip_id: media, in: 0, out: seconds, zoom: "none", move: move as "in", photo: { source: { width: read.width ?? 1080, height: read.height ?? 1350 } } },
        frames,
      );
      if (!shot) return console.error("gpu relief: no shot");
      const path = `${row.studio_id}/lab-gpu/relief-${media}-${move}-${frames}.mp4`;
      const [photo, upload] = await Promise.all([
        db.storage.from("media").createSignedUrl(row.storage_path, 3600),
        db.storage.from("media").createSignedUploadUrl(path, { upsert: true }),
      ]);
      if (!photo.data?.signedUrl || !upload.data?.signedUrl) return console.error("gpu relief: links refused");
      const { results, seconds: card } = await reliefsOnGpu(
        [{ key: "lab", url: photo.data.signedUrl, move: shot.move, frames, origin: shot.origin, shift: shot.shift, upload: { mp4: upload.data.signedUrl } }],
        700_000,
        { startMs: 600_000 },
      );
      const result = results.lab;
      const cost = gpuCostEur(card);
      if (card > 0) await db.from("cost_events").insert({ studio_id: row.studio_id, kind: "relief", provider: "modal", units: Math.round(card), cost_eur: cost, meta: { lab: true, media, move, frames, gpu: GPU } });
      const link = result && !(result instanceof Error) ? (await db.storage.from("media").createSignedUrl(path, 86_400)).data?.signedUrl : null;
      console.log("gpu relief", JSON.stringify({ link, media, move, frames, origin: shot.origin, shift: shot.shift, seconds: Math.round(card), cost_eur: Math.round(cost * 1000) / 1000, result: result instanceof Error ? result.message : result }));
    });
    return Response.json({ ok: true, started: true }, { status: 202 });
  }
  if (action === "gpu-subject") {
    const media = request.nextUrl.searchParams.get("media") ?? "";
    const from = Number(request.nextUrl.searchParams.get("from") ?? "0");
    const to = Number(request.nextUrl.searchParams.get("to") ?? "0");
    // &gpu=A10G|T4|L40S|A100…: another card; &gpu=none: a machine without one (to see whether Modal starts one at all);
    // &fp16=0: the model in full precision (to compare, its file apart; half precision is the default).
    const gpuParam = request.nextUrl.searchParams.get("gpu");
    const fp16 = request.nextUrl.searchParams.get("fp16") !== "0";
    const gpu = gpuParam === "none" ? null : gpuParam && /^[A-Z0-9-]{2,12}$/i.test(gpuParam) ? gpuParam.toUpperCase() : undefined;
    if (!/^[0-9a-f-]{36}$/.test(media) || !(to > from) || to - from > 8) return Response.json({ error: "media=<uuid>&from=<s>&to=<s> (8 s at most)" }, { status: 400 });
    if (!gpuReady()) return Response.json({ error: "MODAL_TOKEN_ID / MODAL_TOKEN_SECRET not set" }, { status: 400 });
    after(async () => {
      const db = supabaseAdmin();
      const { data: row } = await db.from("media_assets").select("studio_id, storage_path").eq("id", media).maybeSingle();
      if (!row?.storage_path) return console.error("gpu subject: no such media", media);
      const base = `${row.studio_id}/lab-gpu/${media}-${from}-${to}${fp16 ? "" : "-fp32"}`;
      const [clip, webm, png] = await Promise.all([
        db.storage.from("media").createSignedUrl(row.storage_path, 3600),
        db.storage.from("media").createSignedUploadUrl(`${base}.webm`, { upsert: true }),
        db.storage.from("media").createSignedUploadUrl(`${base}.png`, { upsert: true }),
      ]);
      if (!clip.data?.signedUrl || !webm.data?.signedUrl || !png.data?.signedUrl) return console.error("gpu subject: links refused");
      // Its steps are in the logs as they happen (« gpu … »), then its result (« gpu subject »).
      const { results, seconds } = await subjectsOnGpu([{ key: "lab", url: clip.data.signedUrl, from, to, upload: { webm: webm.data.signedUrl, png: png.data.signedUrl } }], 700_000, { gpu, fp16, startMs: 600_000 });
      const result = results.lab;
      const card = gpu === undefined ? GPU : gpu;
      const cost = gpuCostEur(seconds, card);
      if (seconds > 0) await db.from("cost_events").insert({ studio_id: row.studio_id, kind: "matting", provider: "modal", units: Math.round(seconds), cost_eur: cost, meta: { lab: true, media, from, to, gpu: card ?? "none" } });
      const still = result && !(result instanceof Error) && result.still;
      const link = result && !(result instanceof Error) ? (await db.storage.from("media").createSignedUrl(`${base}.${still ? "png" : "webm"}`, 86_400)).data?.signedUrl : null;
      // Its link first (a log line is cut after a few hundred characters), its boxes counted, not listed.
      const summary = result instanceof Error || !result ? (result?.message ?? "nothing") : { ...result, boxes: result.boxes?.length ?? 0 };
      console.log("gpu subject", JSON.stringify({ link, media, from, to, gpu: card ?? "none", fp16, seconds: Math.round(seconds), cost_eur: Math.round(cost * 1000) / 1000, result: summary }));
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
