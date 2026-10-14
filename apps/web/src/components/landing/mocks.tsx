// Small drawings of what Simone makes, for the landing (illustrations, not data).

/** Photos from Unsplash (free licence), served by its CDN at the size asked. */
// Asked at the size shown (CSS pixels) with dpr 2, so they stay sharp on phone and retina screens.
export const unsplash = (id: string, w: number, h?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&dpr=2&w=${w}${h ? `&h=${h}` : ""}`;

export const PHOTOS = {
  studioClass: "1518611012118-696072aa579a",
  groupClass: "1518310383802-640c2de311b2",
  yogaSunset: "1544367567-0f2fcb009e0b",
  salon: "1560066984-138dadb4c035",
  salonChair: "1521590832167-7bcbfaa6381f",
  hair: "1522337360788-8b13dee7a37e",
  cafe: "1554118811-1e0d58224f24",
  restaurant: "1517248135467-4c7edcad34c4",
  dish: "1414235077428-338989a2e8c0",
  shop: "1441986300917-64674bd600d8",
  coffee: "1495474472287-4d71bcdd2085",
} as const;

/** The Reel's three shots: a studio's class. */
const SHOTS = [PHOTOS.studioClass, PHOTOS.groupClass, PHOTOS.yogaSunset];
const WORDS = ["Respire.", "Bouge.", "Reviens."];

/** A Reel playing on its own: three photos with a slow zoom, a word on each, its progress bar. */
export function ReelMock({ width, still = false, name = "Studio Lune" }: { width: number; still?: boolean; name?: string }) {
  const k = width / 220;
  return (
    <span
      className="relative block shrink-0 overflow-hidden bg-ink shadow-[0_14px_30px_rgba(28,21,48,.22)]"
      style={{ width, height: Math.round((width * 16) / 9), borderRadius: 18 * k }}
      aria-hidden="true"
    >
      {SHOTS.map((id, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={id}
          src={unsplash(id, Math.round(width), Math.round((width * 16) / 9))}
          alt=""
          loading="lazy"
          className={`absolute inset-0 size-full object-cover ${still ? "" : "landing-reel-shot"}`}
          style={{ opacity: still && i > 0 ? 0 : undefined, animationDelay: `${i * 3}s` }}
        />
      ))}
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.28)_0%,rgba(0,0,0,0)_35%,rgba(0,0,0,0)_60%,rgba(0,0,0,.35)_100%)]" />
      <span className="absolute inset-x-0 flex justify-center" style={{ top: "38%" }}>
        {WORDS.map((w, i) => (
          <span
            key={w}
            className={`absolute font-[family-name:var(--font-serif)] text-white italic ${still ? "" : "landing-reel-word"}`}
            style={{ fontSize: 34 * k, lineHeight: 1, textShadow: "0 2px 18px rgba(0,0,0,.3)", opacity: still && i > 0 ? 0 : undefined, animationDelay: `${i * 3 + 0.25}s` }}
          >
            {w}
          </span>
        ))}
      </span>
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5" style={{ padding: `0 ${12 * k}px ${12 * k}px` }}>
        <span className="font-bold text-white/90" style={{ fontSize: 10 * k, letterSpacing: "0.08em" }}>
          {name.toUpperCase()}
        </span>
        <span className="block h-[3px] overflow-hidden rounded-full bg-white/25">
          <span className={`block h-full rounded-full bg-white ${still ? "" : "landing-reel-bar"}`} />
        </span>
      </span>
    </span>
  );
}

/** A carousel: a salon's tips, three photos with text set on them, the first one in front. */
export function CarouselMock() {
  const slides = [
    { id: PHOTOS.hair, title: "3 conseils", sub: "pour tes cheveux cet hiver" },
    { id: PHOTOS.salon, title: "1.", sub: "Un soin par semaine" },
    { id: PHOTOS.salonChair, title: "2.", sub: "Moins de chaleur" },
  ];
  return (
    <span className="relative flex h-[188px] items-center justify-center" aria-hidden="true">
      {slides
        .map((s, i) => (
          <span
            key={i}
            className="absolute flex h-[160px] w-[128px] flex-col justify-end overflow-hidden rounded-[14px] p-3 text-white shadow-[0_10px_24px_rgba(28,21,48,.18)]"
            style={{ transform: `translateX(${(i - 1) * 64}px) rotate(${(i - 1) * 6}deg) scale(${i === 0 ? 1 : 0.9})`, zIndex: 3 - i }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={unsplash(s.id, 128, 160)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
            <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_40%,rgba(0,0,0,.55)_100%)]" />
            <span className="relative font-[family-name:var(--font-serif)] text-[24px] leading-none italic">{s.title}</span>
            <span className="relative mt-1 text-[11px] leading-tight font-semibold">{s.sub}</span>
          </span>
        ))
        .reverse()}
    </span>
  );
}

/** A week with its posts in place. */
export function WeekMock() {
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const kinds = { reel: { label: "Reel", tone: "bg-violet" }, carousel: { label: "Carrousel", tone: "bg-coral" }, story: { label: "Story", tone: "bg-lilac" } } as const;
  const posts: Record<number, keyof typeof kinds> = { 1: "reel", 3: "carousel", 5: "story" };
  return (
    <span className="flex flex-col gap-2.5" aria-hidden="true">
      <span className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <span key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted">{d}</span>
            <span className="flex h-[64px] w-full items-end rounded-[10px] border border-line bg-white p-1">
              {posts[i] && <span className={`h-[26px] w-full rounded-[6px] ${kinds[posts[i]!].tone}`} />}
            </span>
          </span>
        ))}
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {Object.values(kinds).map((k) => (
          <span key={k.label} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted">
            <span className={`size-2.5 rounded-full ${k.tone}`} />
            {k.label}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Sunday's report: what worked, in bars. */
export function ReportMock() {
  const bars = [38, 52, 44, 86, 61, 72, 49];
  return (
    <span className="flex flex-col gap-3" aria-hidden="true">
      <span className="flex h-[82px] items-end gap-1.5">
        {bars.map((h, i) => (
          <span key={i} className={`flex-1 rounded-t-[6px] ${i === 3 ? "bg-violet" : "bg-lilac"}`} style={{ height: `${h}%` }} />
        ))}
      </span>
      <span className="rounded-[12px] bg-violet-tint px-3 py-2 text-[12.5px] leading-snug text-violet">
        Tes Reels du matin font plus de vues : on garde 8 h le jeudi.
      </span>
    </span>
  );
}

/** A photo before and after her retouch: light, colours, warmth. */
export function RetouchMock() {
  return (
    <span className="grid grid-cols-2 gap-2" aria-hidden="true">
      {[false, true].map((after) => (
        <span key={String(after)} className="relative h-[120px] overflow-hidden rounded-[12px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={unsplash(PHOTOS.cafe, 180, 120)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            style={{ filter: after ? "brightness(1.12) saturate(1.2) contrast(1.05)" : "brightness(.72) saturate(.65) contrast(.92)" }}
          />
          <span className="absolute top-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold text-ink">{after ? "Après" : "Avant"}</span>
        </span>
      ))}
    </span>
  );
}
