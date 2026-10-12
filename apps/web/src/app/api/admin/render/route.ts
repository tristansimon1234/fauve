import { type NextRequest } from "next/server";
import { renderPost } from "@/lib/render/render-post";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidTestKey } from "@/lib/test-studio";

// Admin helper to exercise the render worker, protected by FAUVE_TEST_KEY:
//   ?cle=…&post=<post id>  renders the post's latest edit plan and returns a 24 h link.

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isValidTestKey(params.get("cle"))) return new Response("Forbidden", { status: 403 });
  const postId = params.get("post") ?? "";
  const post = await supabaseAdmin().from("posts").select("studio_id").eq("id", postId).maybeSingle();
  if (!post.data) return Response.json({ error: "post not found" }, { status: 404 });

  const started = Date.now();
  try {
    const result = await renderPost(post.data.studio_id as string, postId);
    return Response.json({ ok: true, elapsedMs: Date.now() - started, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, elapsedMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
