import Link from "next/link";
import { LayersIcon, PlayIcon } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import { formatShortDateTime, kindLabels } from "@/lib/format";
import type { CardPost, ChatCard } from "@/lib/chat-cards";

// Cards under Fauve's messages: a post with its render or photo, or the
// coming posts laid out as on the Instagram grid.

export function ChatCards({ cards, timezone }: { cards: ChatCard[]; timezone: string }) {
  if (!cards.length) return null;
  return (
    <div className="flex max-w-full flex-wrap items-start gap-3">
      {cards.map((card, i) =>
        card.type === "post" ? <PostCard key={card.post.id} post={card.post} timezone={timezone} /> : <GridCard key={`grid-${i}`} posts={card.posts} />,
      )}
    </div>
  );
}

function Media({ post, controls }: { post: CardPost; controls: boolean }) {
  if (!post.media) {
    return <span className="flex size-full items-center justify-center bg-violet-soft p-3 text-center text-[13px] font-semibold text-violet">{post.title}</span>;
  }
  return post.media.video ? (
    <video
      src={controls ? post.media.url : `${post.media.url}#t=0.5`}
      controls={controls}
      muted={!controls}
      playsInline
      preload="metadata"
      className="size-full bg-ink object-cover"
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.media.url} alt="" loading="lazy" className="size-full object-cover" />
  );
}

function PostCard({ post, timezone }: { post: CardPost; timezone: string }) {
  const tall = post.kind === "reel" || post.kind === "story";
  return (
    <article className="flex w-[240px] max-w-full flex-col overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_2px_10px_rgba(28,21,48,0.05)]">
      <div className={`relative ${tall ? "aspect-[9/16]" : "aspect-[4/5]"} bg-soft`}>
        <Media post={post} controls />
        {post.kind === "carousel" && <LayersIcon size={16} className="absolute top-2 right-2 text-white drop-shadow" />}
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[14px] font-bold">{post.title}</span>
          <StatusPill status={post.status} className="shrink-0" />
        </div>
        <span className="text-[12px] text-muted">
          {kindLabels[post.kind]}
          {post.at ? ` · ${formatShortDateTime(post.at, timezone)}` : ""}
        </span>
        {post.caption && <p className="line-clamp-2 text-[13px] leading-snug text-ink/80">{post.caption}</p>}
        <Link href={`/publications/${post.id}`} className="pt-0.5 text-[13px] font-bold text-violet">
          Ouvrir la publication
        </Link>
      </div>
    </article>
  );
}

function GridCard({ posts }: { posts: CardPost[] }) {
  return (
    <article className="flex w-[300px] max-w-full flex-col overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_2px_10px_rgba(28,21,48,0.05)]">
      <span className="px-3 pt-3 pb-2 text-[13px] font-bold">Ta grille à venir</span>
      {posts.length ? (
        <ul className="grid grid-cols-3 gap-0.5 border-t border-line">
          {posts.map((post) => (
            <li key={post.id} className="relative aspect-[3/4] bg-soft">
              <Link href={`/publications/${post.id}`} className="absolute inset-0 block" aria-label={post.title}>
                <Media post={post} controls={false} />
                <span className="pointer-events-none absolute inset-0 border-2 border-dashed border-violet/70" />
                {post.kind === "reel" && <PlayIcon size={12} className="absolute top-1.5 right-1.5 text-white drop-shadow" />}
                {post.kind === "carousel" && <LayersIcon size={12} className="absolute top-1.5 right-1.5 text-white drop-shadow" />}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-line px-3 py-4 text-[13px] text-muted">Aucune publication prévue pour l’instant.</p>
      )}
      <Link href="/grille" className="border-t border-line px-3 py-2.5 text-[13px] font-bold text-violet">
        Voir toute la grille
      </Link>
    </article>
  );
}
