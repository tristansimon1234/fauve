import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ChatIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { StatusPill } from "@/components/status-pill";
import { demoDraft, demoPosts } from "@/lib/demo";
import { PostEditor } from "./post-editor";

export function generateStaticParams() {
  return demoPosts.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/publications/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: demoPosts.find((p) => p.id === id)?.title ?? "Publication" };
}

export default async function PostPage({ params }: PageProps<"/publications/[id]">) {
  const { id } = await params;
  const post = demoPosts.find((p) => p.id === id);
  if (!post) notFound();

  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-8">
      <Link href="/calendrier" className="inline-flex items-center gap-2 self-start text-sm font-bold text-violet">
        <ArrowLeftIcon size={18} />
        Calendrier
      </Link>
      {post.id === demoDraft.id ? (
        <PostEditor draft={demoDraft} />
      ) : (
        <div className="flex max-w-[640px] flex-col gap-4">
          <StatusPill status={post.status} className="px-2.5 text-xs" />
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">{post.title}</h1>
          <div className="flex items-start gap-3 rounded-[18px] bg-soft p-4">
            <Orb size={28} className="shrink-0" />
            <p className="text-sm leading-relaxed">
              {post.status === "content_requested"
                ? "J’attends encore la vidéo pour cette publication. Je te relance la veille si rien n’arrive."
                : "Cette publication n’a pas encore de brouillon à valider."}
            </p>
          </div>
          <Link href="/fauve" className="btn btn-secondary self-start">
            <ChatIcon size={18} />
            En parler à Fauve
          </Link>
        </div>
      )}
    </main>
  );
}
