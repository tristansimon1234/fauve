import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, NoStudio, PageLoading } from "@/components/empty-state";
import { FilmIcon, ImageIcon } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import { localDateOf, startOfLocalDay } from "@/lib/dates";
import { formatShortDateTime, kindLabels } from "@/lib/format";
import { getStudioContext, POST_COLUMNS, postRowSchema, rows, type PostRow } from "@/lib/studio";

export const metadata: Metadata = { title: "Publications" };

export default function PostsPage() {
  return (
    <main className="flex min-w-0 flex-col gap-8 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <Suspense fallback={<PageLoading title="Publications" />}>
        <Posts />
      </Suspense>
    </main>
  );
}

async function Posts() {
  const { db, member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;
  const today = startOfLocalDay(localDateOf(new Date(), tz), tz).toISOString();

  const [draftsResult, comingResult, publishedResult] = await Promise.all([
    db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("studio_id", studioId)
      .eq("status", "draft")
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(50),
    db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("studio_id", studioId)
      .in("status", ["planned", "content_requested", "media_received", "validated", "scheduled", "failed"])
      .or(`scheduled_at.gte."${today}",scheduled_at.is.null`)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(50),
    db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("studio_id", studioId)
      .in("status", ["published", "measured"])
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);
  const drafts = rows(postRowSchema, draftsResult, "posts");
  const coming = rows(postRowSchema, comingResult, "posts");
  const published = rows(postRowSchema, publishedResult, "posts");
  const empty = !drafts.length && !coming.length && !published.length;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Publications</h1>
        <p className="text-[15px] text-muted">Les brouillons de Fauve, ce qui se prépare et ce qui est en ligne.</p>
      </div>
      {empty ? (
        <EmptyState title="Aucune publication pour l’instant" className="max-w-[760px]" cta="Envoyer mes vidéos à Fauve">
          Envoie tes vidéos à Fauve sur WhatsApp : elle prépare tes posts, et tu les retrouves ici pour les relire et les
          valider.
        </EmptyState>
      ) : (
        <>
          <PostList title="À valider" posts={drafts} tz={tz} />
          <PostList title="À venir" posts={coming} tz={tz} />
          <PostList title="Publiées" posts={published} tz={tz} />
        </>
      )}
    </>
  );
}

function PostList({ title, posts, tz }: { title: string; posts: PostRow[]; tz: string }) {
  if (!posts.length) return null;
  return (
    <section className="flex max-w-[760px] flex-col gap-3">
      <h2 className="text-base font-bold">{title}</h2>
      <ul className="card divide-y divide-line">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/publications/${p.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-soft">
              <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-[10px] bg-soft text-violet">
                {p.kind === "reel" || p.kind === "story" ? <FilmIcon /> : <ImageIcon />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-bold">{p.title}</span>
                <span className="text-[13px] text-muted">
                  {kindLabels[p.kind]} · {p.scheduled_at ? formatShortDateTime(p.scheduled_at, tz) : "date à définir"}
                </span>
              </span>
              <StatusPill status={p.status} className="self-center" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
