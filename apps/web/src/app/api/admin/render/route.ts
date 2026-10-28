import { after, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { designEdit } from "@/lib/agent/editor";
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
// ?action=prune: deletes the snapshots the sandboxes in service no longer need (the last two stay).

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
