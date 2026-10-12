import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { demoPosts, demoWeek } from "@/lib/demo";

export const metadata: Metadata = { title: "Publications" };

const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const kindLabels = { reel: "Reel", post: "Post", carousel: "Carrousel", story: "Story" } as const;

export default function PostsPage() {
  const toValidate = demoPosts.filter((p) => p.status === "draft");
  const others = demoPosts.filter((p) => p.status !== "draft");

  return (
    <main className="flex min-w-0 flex-col gap-8 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Publications</h1>
        <p className="text-[15px] text-muted">{demoWeek.label}</p>
      </div>
      <PostList title="À valider" posts={toValidate} />
      <PostList title="Cette semaine" posts={others} />
    </main>
  );
}

function PostList({ title, posts }: { title: string; posts: typeof demoPosts }) {
  if (!posts.length) return null;
  return (
    <section className="flex max-w-[760px] flex-col gap-3">
      <h2 className="text-base font-bold">{title}</h2>
      <ul className="card divide-y divide-line">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/publications/${p.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-soft">
              <span
                className="h-16 w-12 shrink-0 rounded-[10px] bg-soft"
                style={p.thumb ? { background: p.thumb } : undefined}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-bold">{p.title}</span>
                <span className="text-[13px] text-muted">
                  {kindLabels[p.kind]} · {dayNames[p.day]} {demoWeek.firstDay + p.day} oct. · {p.time}
                </span>
              </span>
              <StatusPill status={p.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
