import { after, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { designEdit } from "@/lib/agent/editor";
import { lookAtAnimations } from "@/lib/agent/motion-look";
import { renderPost } from "@/lib/render/render-post";
import { withStepDeadline } from "@/lib/step-clock";
import { dropSandbox, remotionSandbox, trackSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidTestKey } from "@/lib/test-studio";

// Admin helper to exercise the render worker, protected by FAUVE_TEST_KEY:
//   ?cle=…&post=<post id>  renders the post's latest edit plan and returns a 24 h link.
//   ?cle=…&action=warm     installs the Remotion templates in the sandbox ahead of the first render.
//   ?cle=…&post=…&design=1[&brief=…]  has the editor (Opus) write a new plan first (and the motion designer
//                                      look at its new animations), then renders it.
// And POST ?action=warm with CRON_SECRET, from the database (call_app): the same warm-up,
// in the background (a new sandbox installs everything once, a few minutes, the collages'
// cut-out model and the tracker included). And POST
// ?action=drop&sandbox=<name>: deletes an old render sandbox (never the one in service).

export const maxDuration = 800;
/** A design's look ends by then, leaving the render its time. */
const RENDER_BY_MS = (maxDuration - 240) * 1000;

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
  if (action !== "warm") return Response.json({ error: "unknown action" }, { status: 400 });
  after(async () => {
    const started = Date.now();
    try {
      await remotionSandbox();
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
  if (!isValidTestKey(params.get("cle"))) return new Response("Forbidden", { status: 403 });
  if (params.get("action") === "warm") {
    const started = Date.now();
    try {
      await remotionSandbox();
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
    // The motion designer's look at its new animations, as in a montage, with the time to render after it.
    if (edit?.look) {
      const path = edit.look.path;
      await withStepDeadline(RENDER_BY_MS - (Date.now() - started), () => lookAtAnimations(studioId, postId, edit.editPlanId, path)).catch((error: unknown) =>
        console.warn("admin render: look failed", error),
      );
    }
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
