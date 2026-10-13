import Link from "next/link";
import { CheckIcon, LayersIcon, PlayIcon } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import { formatShortDateTime, kindLabels } from "@/lib/format";
import type { CardPost, CardQuote, ChatCard } from "@/lib/chat-cards";

// Cards under Fauve's messages: a post with its render or photo, or the
// coming posts laid out as on the Instagram grid.

export function ChatCards({
  cards,
  timezone,
  onLaunch,
  onAnswer,
  busy = false,
}: {
  cards: ChatCard[];
  timezone: string;
  /** Starts the quoted montage at once (no round trip through Fauve). */
  onLaunch?: (quoteId: string) => void;
  /** Sends a short answer to Fauve, as if typed. */
  onAnswer?: (text: string) => void;
  busy?: boolean;
}) {
  if (!cards.length) return null;
  return (
    <div className="flex max-w-full flex-wrap items-start gap-3">
      {cards.map((card, i) =>
        card.type === "post" ? (
          <PostCard key={card.post.id} post={card.post} timezone={timezone} />
        ) : card.type === "quote" ? (
          <QuoteCard key={card.quote.id} quote={card.quote} onLaunch={onLaunch} onAnswer={onAnswer} busy={busy} />
        ) : (
          <GridCard key={`grid-${i}`} posts={card.posts} />
        ),
      )}
    </div>
  );
}

const sceneLabels = { clip: "Vidéo", animation: "Animation", end: "Fin" } as const;
const styleLabels = { doux: "style doux", dynamique: "style dynamique", chic: "style chic" } as const;

/** The montage Fauve proposes, scene by scene. */
function PlanList({ plan }: { plan: NonNullable<CardQuote["plan"]> }) {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-soft p-3">
      <span className="text-[12px] font-semibold text-muted">
        ~{Math.round(plan.duration)} s · {plan.scenes.length} scène{plan.scenes.length > 1 ? "s" : ""}
        {plan.style ? ` · ${styleLabels[plan.style]}` : ""}
      </span>
      <ol className="flex flex-col gap-1.5 text-[13px] leading-snug">
        {plan.scenes.map((scene, i) => (
          <li key={i} className="flex gap-2">
            <span
              className={`h-fit shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                scene.kind === "animation" ? "bg-violet-soft text-violet" : scene.kind === "end" ? "bg-chip text-muted" : "bg-peach text-peach-ink"
              }`}
            >
              {sceneLabels[scene.kind]}
            </span>
            <span>{scene.what}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const credits = (n: number) => `${n} crédit${n > 1 ? "s" : ""}`;

/** The plan and its price, before anything runs: one tap to launch. */
function QuoteCard({
  quote,
  onLaunch,
  onAnswer,
  busy,
}: {
  quote: CardQuote;
  onLaunch?: (quoteId: string) => void;
  onAnswer?: (text: string) => void;
  busy: boolean;
}) {
  const scenes = quote.max > quote.base;
  return (
    <article className="flex w-[340px] max-w-full flex-col gap-3 rounded-[18px] border border-line bg-white p-4 shadow-[0_2px_10px_rgba(28,21,48,0.05)]">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">Devis</span>
        <span className="text-[15px] font-bold leading-snug">{quote.title}</span>
      </div>
      {quote.plan && <PlanList plan={quote.plan} />}
      <ul className="flex flex-col gap-1.5 text-[13px]">
        {quote.lines.map((line) => (
          <li key={line.label} className="flex justify-between gap-3">
            <span className="text-ink/80">{line.label}</span>
            <span className="shrink-0 font-semibold">{line.credits}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 border-t border-line pt-1.5 text-[14px] font-bold">
          <span>Total</span>
          <span>{credits(quote.base)}</span>
        </li>
      </ul>
      {scenes && (
        <p className="text-[12px] leading-snug text-muted">
          Jusqu’à {credits(quote.max)} si Fauve crée de nouvelles scènes animées. Tu ne paies que ce qui est vraiment fait.
        </p>
      )}
      <p className="text-[12px] text-muted">
        Solde : {credits(quote.balance)} · il t’en restera au moins {Math.max(0, quote.balance - quote.max)}
      </p>
      {quote.state === "open" && onLaunch ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onLaunch(quote.id)}
            className="h-10 flex-1 rounded-full bg-violet px-4 text-[14px] font-bold whitespace-nowrap text-white disabled:opacity-60"
          >
            Lancer · {credits(quote.base)}
          </button>
          {onAnswer && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAnswer("Pas maintenant")}
              className="h-10 rounded-full px-3 text-[14px] font-semibold text-muted hover:bg-soft disabled:opacity-60"
            >
              Pas maintenant
            </button>
          )}
        </div>
      ) : quote.state === "launched" ? (
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-success">
          <CheckIcon size={16} />
          Montage lancé
        </span>
      ) : quote.state === "expired" ? (
        <span className="text-[13px] text-muted">Devis expiré : demande-en un nouveau à Fauve.</span>
      ) : null}
    </article>
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
