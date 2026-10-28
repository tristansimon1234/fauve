"use client";

import { CREDIT_PRICES, shortCount, TREND_FREE_CHANGES } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { EyeIcon, HeartIcon, InstagramIcon, MusicIcon, TikTokIcon } from "@/components/icons";
import { NewPostSheet } from "@/components/new-post-sheet";
import type { TrendCard, TrendLists } from "@/lib/trends";
import { setTrendQuery } from "./actions";

type Filter = "all" | "tiktok" | "instagram";

/** The words searched for her trade, which she can change. */
export function TrendQuery({ query, left }: { query: string | null; left: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(query === null);
  const [words, setWords] = useState(query ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const res = await setTrendQuery(words);
      if (!res.ok) return setError(res.error);
      setEditing(false);
      router.refresh();
    });

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[15px]">
        <span className="text-muted">Pour</span>
        <span className="font-serif text-[22px] italic leading-none">« {query} »</span>
        <button type="button" onClick={() => setEditing(true)} className="rounded-full px-3 py-1.5 text-[14px] font-bold text-violet hover:bg-violet-soft">
          Changer
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex max-w-[520px] flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor="trend-words" className="text-[15px] font-bold">
        Ton métier, en quelques mots
      </label>
      <div className="flex gap-2">
        <input
          id="trend-words"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          maxLength={60}
          placeholder="salon de coiffure, café, studio de pilates…"
          className="h-11 min-w-0 flex-1 rounded-full border border-line px-4 text-[16px] outline-none focus:border-violet"
        />
        <button type="submit" disabled={pending} className="h-11 rounded-full bg-violet px-5 text-[15px] font-bold text-white disabled:opacity-50">
          {pending ? "…" : "Voir"}
        </button>
      </div>
      {query !== null && (
        <p className="text-[13px] text-muted">
          {left > 0
            ? `Chaque changement relance une recherche : encore ${left} gratuit${left > 1 ? "s" : ""} ce mois-ci.`
            : `Tes ${TREND_FREE_CHANGES} changements gratuits du mois sont passés : celui-ci coûte ${CREDIT_PRICES.trends} crédit.`}
        </p>
      )}
      {error && <p className="text-[14px] text-peach-ink">{error}</p>}
    </form>
  );
}

/** The two lists (« Ce qui cartonne », « À Paris »), the trade's hashtags and « Fais-en un comme ça ». */
export function TrendsGrid({ lists, searching, timezone }: { lists: TrendLists; searching: boolean; timezone: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [copying, setCopying] = useState<string | null>(null);

  // While the first search runs, the page looks again every few seconds.
  useEffect(() => {
    if (!searching) return;
    const timer = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(timer);
  }, [searching, router]);

  if (searching) {
    return (
      <div className="rounded-[22px] bg-soft px-6 py-10 text-center text-[15px] text-muted" aria-busy="true">
        Je regarde ce qui marche en ce moment sur TikTok et Instagram… ça prend une petite minute.
      </div>
    );
  }
  if (!lists.trend.length && !lists.local.length) {
    return (
      <div className="rounded-[22px] bg-soft px-6 py-10 text-center text-[15px] text-muted">
        Rien de vraiment fort pour ces mots cette semaine. Essaie d’autres mots, plus simples (« coiffeur », « brunch », « pilates »).
      </div>
    );
  }

  const city = lists.words.local.split(" ").at(-1) ?? "";
  const platforms = new Set([...lists.trend, ...lists.local].map((c) => c.platform));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {platforms.size > 1 ? (
          <div className="flex gap-1 rounded-full bg-soft p-1" role="tablist" aria-label="Réseau">
            {(
              [
                ["all", "Tout"],
                ["tiktok", "TikTok"],
                ["instagram", "Instagram"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`h-9 rounded-full px-4 text-[14px] font-bold ${filter === key ? "bg-white text-ink shadow-sm" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {lists.fetchedAt && <p className="text-[13px] text-muted">Mis à jour {since(lists.fetchedAt)}</p>}
      </div>

      {lists.hashtags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Hashtags sur Instagram">
          {lists.hashtags.map((h) => (
            <li key={h.hashtag} className="flex items-baseline gap-2 rounded-full border border-line px-4 py-2 text-[14px]">
              <span className="font-bold">#{h.hashtag}</span>
              <span className="text-muted">{shortCount(h.posts)} publications</span>
              {h.gained !== null && h.gained > 0 && h.days !== null && (
                <span className="font-bold text-violet">
                  +{shortCount(h.gained)} en {h.days} jours
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <TrendSection title="Ce qui cartonne en ce moment" note={`« ${lists.words.trend} », partout`} cards={lists.trend} filter={filter} onCopy={setCopying} />
      <TrendSection title={`À ${capitalized(city)}`} note={`« ${lists.words.local} »`} cards={lists.local} filter={filter} onCopy={setCopying} />
      {copying && <NewPostSheet timezone={timezone} copyLink={copying} onClose={() => setCopying(null)} />}
    </>
  );
}

function TrendSection({ title, note, cards, filter, onCopy }: { title: string; note: string; cards: TrendCard[]; filter: Filter; onCopy: (url: string) => void }) {
  const shown = cards.filter((c) => filter === "all" || c.platform === filter);
  // The most watched first, both platforms together (likes count for twenty views when a search gives no views).
  const ordered = [...shown].sort((a, b) => (b.views ?? (b.likes ?? 0) * 20) - (a.views ?? (a.likes ?? 0) * 20));
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">{title}</h2>
        <p className="text-[14px] text-muted">{note}</p>
      </div>
      {ordered.length ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {ordered.map((card) => (
            <TrendItem key={card.id} card={card} onCopy={onCopy} />
          ))}
        </ul>
      ) : (
        <p className="rounded-[16px] bg-soft px-5 py-6 text-[14px] text-muted">Rien d’assez fort ici cette semaine.</p>
      )}
    </section>
  );
}

function TrendItem({ card, onCopy }: { card: TrendCard; onCopy: (url: string) => void }) {
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <a href={card.url} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[9/16] overflow-hidden rounded-[16px] bg-soft">
        {card.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-[13px] text-muted">{card.caption.slice(0, 80) || "Voir la vidéo"}</div>
        )}
        <span className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white">
          {card.platform === "tiktok" ? <TikTokIcon size={15} /> : <InstagramIcon size={15} />}
        </span>
        <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[13px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          {card.views !== null ? (
            <>
              <EyeIcon size={15} /> {shortCount(card.views)}
            </>
          ) : card.likes !== null ? (
            <>
              <HeartIcon size={15} /> {shortCount(card.likes)}
            </>
          ) : null}
        </span>
      </a>
      <div className="flex min-w-0 flex-col gap-1 px-0.5">
        {card.author && <p className="truncate text-[13px] font-bold">@{card.author}</p>}
        {card.caption && <p className="line-clamp-2 text-[13px] leading-snug text-muted">{card.caption}</p>}
        {card.sound && (
          <p className="flex min-w-0 items-center gap-1 text-[12px] text-muted">
            <MusicIcon size={13} />
            <span className="truncate">{card.sound}</span>
          </p>
        )}
        <p className="text-[12px] text-muted">
          {[card.postedAt ? since(card.postedAt) : null, card.likes !== null && card.views !== null ? `${shortCount(card.likes)} j’aime` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <button type="button" onClick={() => onCopy(card.url)} className="h-9 rounded-full border border-line text-[13px] font-bold text-violet hover:bg-violet-soft">
        Fais-en un comme ça
      </button>
    </li>
  );
}

const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « il y a 3 jours », « il y a 2 semaines », « il y a 4 mois ». */
function since(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
  if (days === 0) return "aujourd’hui";
  if (days === 1) return "hier";
  if (days < 14) return `il y a ${days} jours`;
  if (days < 60) return `il y a ${Math.round(days / 7)} semaines`;
  if (days < 365) return `il y a ${Math.round(days / 30)} mois`;
  const years = Math.round(days / 365);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}
