import { type NextRequest } from "next/server";
import { designEdit } from "@/lib/agent/editor";
import { renderPost } from "@/lib/render/render-post";
import { remotionSandbox } from "@/lib/render/sandbox";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidTestKey } from "@/lib/test-studio";

// Admin helper to exercise the render worker, protected by FAUVE_TEST_KEY:
//   ?cle=…&post=<post id>  renders the post's latest edit plan and returns a 24 h link.
//   ?cle=…&action=warm     installs the Remotion templates in the sandbox ahead of the first render.
//   ?cle=…&post=…&design=1[&brief=…]  has the editor (Opus) write a new plan first, then renders it.

export const maxDuration = 300;

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
