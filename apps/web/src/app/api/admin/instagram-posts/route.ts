import { cronAuthorized } from "@/lib/cron-auth";
import { fetchInstagramProfile } from "@/lib/instagram-profile";

// The latest posts of a few public Instagram accounts, with their addresses (CRON_SECRET, from the
// database by net.http_post): to find more Reels in a style the team likes, from the creators of the
// ones already chosen. Read through Treg like her own profile, about a tenth of a cent an account,
// logged on the studio given (the team's).
export const maxDuration = 120;

const HANDLE = /^[a-z0-9._]{1,30}$/;

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  const studio = params.get("studio") ?? "";
  const handles = (params.get("handles") ?? "").toLowerCase().split(",").map((h) => h.trim().replace(/^@/, "")).filter(Boolean);
  if (!/^[0-9a-f-]{36}$/.test(studio) || !handles.length || handles.length > 10 || !handles.every((h) => HANDLE.test(h))) {
    return Response.json({ error: "studio=<uuid>&handles=<a,b,…> (10 at most)" }, { status: 400 });
  }
  const read = await Promise.all(
    handles.map(async (handle) => {
      const found = await fetchInstagramProfile(studio, handle).catch(() => null);
      return {
        handle,
        name: found?.profile?.name ?? null,
        followers: found?.profile?.followers ?? null,
        posts: (found?.posts ?? []).map((p) => ({ link: p.link ?? null, video: p.video, caption: p.caption.slice(0, 140) })),
      };
    }),
  );
  return Response.json({ accounts: read });
}
