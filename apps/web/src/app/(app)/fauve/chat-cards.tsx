import { AMBIANCES, EFFECT_MINUTES, effortPitch, EFFORTS, montageLate, type Effort } from "@fauve/agent";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CheckIcon, ClockIcon, LayersIcon, PlayIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { StatusPill } from "@/components/status-pill";
import { formatShortDateTime, kindLabels } from "@/lib/format";
import type { CardPost, CardQuote, ChatCard } from "@/lib/chat-cards";

// Cards under Fauve's messages: a post with its render or photo, the coming
// posts laid out as on the Instagram grid, or a montage's quote, which then
// follows the montage step by step until the video is delivered.

export function ChatCards({
  cards,
  timezone,
  onLaunch,
  onAnswer,
  onAsk,
  opening = null,
  busy = false,
  className = "",
}: {
  cards: ChatCard[];
  timezone: string;
  /** Starts the quoted montage at once (no round trip through Fauve), at the level picked on the card. Resolves to an error, or null. */
  onLaunch?: (quoteId: string, effort?: Effort) => Promise<string | null>;
  /** Sends a short answer to Fauve, as if typed (only while the message is the latest). */
  onAnswer?: (text: string) => void;
  /** Asks Fauve something about a card, from any message (expired quote, late montage). */
  onAsk?: (text: string) => void;
  /** The post the app is about to open (a montage just delivered). */
  opening?: string | null;
  busy?: boolean;
  className?: string;
}) {
  if (!cards.length) return null;
  // A post whose montage is being made says so on its card.
  const making = new Set(cards.flatMap((c) => (c.type === "quote" && c.quote.state === "launched" ? [c.quote.postId] : [])));
  return (
    <div className={`flex max-w-full flex-wrap items-start gap-3 ${className}`}>
      {cards.map((card, i) =>
        card.type === "post" ? (
          <PostCard key={card.post.id} post={card.post} timezone={timezone} making={making.has(card.post.id)} />
        ) : card.type === "quote" ? (
          <QuoteCard key={card.quote.id} quote={card.quote} onLaunch={onLaunch} onAnswer={onAnswer} onAsk={onAsk} opening={opening} busy={busy} />
        ) : (
          <GridCard key={`grid-${i}`} posts={card.posts} />
        ),
      )}
    </div>
  );
}

const sceneLabels = { clip: "Vidéo", animation: "Animation", end: "Fin" } as const;

/** Scenes shown before « Voir les N scènes » when the card is narrow (a phone, the drawer). */
const FIRST_SCENES = 3;

/** The montage Fauve proposes, scene by scene. Narrow, the first scenes only, so the price and « Lancer » stay close. */
function PlanList({ plan }: { plan: NonNullable<CardQuote["plan"]> }) {
  const [all, setAll] = useState(false);
  const scene = (s: (typeof plan.scenes)[number], i: number) => (
    <li key={i} className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-soft text-[12px] font-bold text-muted">{i + 1}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={`self-start rounded-full px-2 py-0.5 text-[11px] font-bold ${
            s.kind === "animation" ? "bg-violet-soft text-violet" : s.kind === "end" ? "bg-chip text-muted" : "bg-peach text-peach-ink"
          }`}
        >
          {sceneLabels[s.kind]}
        </span>
        <span className="text-[14px] leading-snug">{s.what}</span>
      </div>
    </li>
  );
  const rest = plan.scenes.slice(FIRST_SCENES);
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-semibold text-muted">
        ~{Math.round(plan.duration)} s · {plan.scenes.length} scène{plan.scenes.length > 1 ? "s" : ""}
        {plan.style === "collage" ? " · en collage" : plan.style && plan.style !== "libre" ? ` · ${AMBIANCES[plan.style].label.toLowerCase()}` : ""}
      </span>
      <ol className="flex flex-col gap-2.5">{plan.scenes.slice(0, FIRST_SCENES).map(scene)}</ol>
      {rest.length > 0 && (
        <>
          {/* Folded below the card's two-column width; always open beside the price. */}
          <div
            className={`-mt-3 grid transition-[grid-template-rows] duration-200 ease-fauve motion-reduce:transition-none @xl:grid-rows-[1fr] ${
              all ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <ol start={FIRST_SCENES + 1} className={`flex min-h-0 flex-col gap-2.5 overflow-hidden pt-2.5 @xl:visible ${all ? "" : "invisible"}`}>
              {rest.map((s, i) => scene(s, i + FIRST_SCENES))}
            </ol>
          </div>
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((a) => !a)}
            className="fauve-press -mt-1 self-start rounded-full text-[13px] font-bold text-violet @xl:hidden"
          >
            {all ? "Voir moins" : `Voir les ${plan.scenes.length} scènes`}
          </button>
        </>
      )}
    </div>
  );
}

const credits = (n: number) => `${n} crédit${n > 1 ? "s" : ""}`;

const LEVELS: Effort[] = ["rapide", "soigne", "max"];

/** The card's eyebrow, by state and by what is quoted. */
const eyebrows: Record<CardQuote["state"], Record<CardQuote["kind"], string>> = {
  open: { montage: "À lancer", correction: "À lancer", variant: "À lancer" },
  launched: { montage: "Montage en cours", correction: "Correction en cours", variant: "Variante en cours" },
  delivered: { montage: "Montage livré", correction: "Correction livrée", variant: "Variante livrée" },
  expired: { montage: "Pas lancé", correction: "Pas lancé", variant: "Pas lancé" },
  replaced: { montage: "Remplacé", correction: "Remplacée", variant: "Remplacée" },
};

/**
 * The plan and its price, before anything runs: one tap to launch. Then the
 * same card follows the montage step by step, and leads to the video once
 * delivered. Laid out from its own width (container queries): plan on the left
 * and price on the right when there is room, stacked in the drawer and on a phone.
 */
function QuoteCard({
  quote,
  onLaunch,
  onAnswer,
  onAsk,
  opening,
  busy,
}: {
  quote: CardQuote;
  onLaunch?: (quoteId: string, effort?: Effort) => Promise<string | null>;
  onAnswer?: (text: string) => void;
  onAsk?: (text: string) => void;
  opening: string | null;
  busy: boolean;
}) {
  // The level of care, and its price: the quoted one, or another the balance allows.
  const levels = LEVELS.filter((e) => quote.efforts[e]);
  const [effort, setEffort] = useState<Effort | null>(quote.effort);
  // Nothing moves before the manager touches the card, and a state the card was loaded in does not animate.
  const [touched, setTouched] = useState(false);
  const [first] = useState(quote.state);
  const [launching, setLaunching] = useState(false);
  const [launchedHere, setLaunchedHere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pitchId = useId();
  const open = quote.state === "open";
  // Once launched, the level that is really running (it may have been picked on WhatsApp).
  const shown = open ? effort : quote.effort;
  const level = shown ? EFFORTS[shown] : null;
  const price = (open && effort && effort !== quote.effort && quote.efforts[effort]) || quote;
  const extra = price.max > price.base;
  // The plan's animations beyond the made-to-measure ones in the price: reused from her library.
  const madeToMeasure = price.lines.filter((l) => /animations? sur mesure$/.test(l.label)).reduce((n, l) => n + Math.round(l.credits / 3), 0);
  const fromLibrary = quote.kind === "montage" && quote.plan ? Math.max(0, quote.plan.scenes.filter((sc) => sc.kind === "animation").length - madeToMeasure) : 0;

  const launch = async () => {
    if (!onLaunch || busy || launching) return;
    setLaunching(true);
    setError(null);
    const failed = await onLaunch(quote.id, effort && effort !== quote.effort ? effort : undefined);
    setLaunching(false);
    setError(failed);
    setLaunchedHere(!failed);
  };

  // Every line any level can have, so a level's own lines fold in and out instead of jumping.
  const labels = [...new Set([...levels.flatMap((e) => quote.efforts[e]!.lines.map((l) => l.label)), ...price.lines.map((l) => l.label)])];
  const creditsOf = (label: string) =>
    price.lines.find((l) => l.label === label)?.credits ?? levels.flatMap((e) => quote.efforts[e]!.lines).find((l) => l.label === label)?.credits ?? 0;
  const on = new Set(price.lines.map((l) => l.label));
  const priceList = (
    <ul className="flex flex-col text-[13px]">
      {labels.map((label) => (
        <li
          key={label}
          aria-hidden={on.has(label) ? undefined : true}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-fauve motion-reduce:transition-none ${
            on.has(label) ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          {/* The padding sits inside the clipped row: a folded line takes no space at all. */}
          <span className="min-h-0 overflow-hidden">
            <span className="flex justify-between gap-3 pb-1.5">
              <span className="text-ink/80">{label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{creditsOf(label)}</span>
            </span>
          </span>
        </li>
      ))}
      <li className="mt-0.5 flex justify-between gap-3 border-t border-line pt-2 text-[15px] font-bold">
        <span>Total</span>
        <span key={price.base} className={`inline-block tabular-nums ${touched ? "fauve-enter [--fauve-y:4px]" : ""}`}>
          {credits(price.base)}
        </span>
      </li>
    </ul>
  );

  return (
    <article
      data-quote={quote.id}
      className={`@container flex ${quote.plan && open ? "w-[640px]" : "w-[360px]"} max-w-full flex-col overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_4px_18px_rgba(28,21,48,0.07)]`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span key={quote.state} className={`text-[11px] font-bold tracking-[0.06em] uppercase ${quote.state === "launched" ? "text-violet" : "text-muted"} ${quote.state !== first ? "fauve-fade" : ""}`}>
            {eyebrows[quote.state][quote.kind]}
          </span>
          <span className="text-[17px] leading-snug font-bold">{quote.title}</span>
        </div>
        {level && !(open && levels.length > 1) && (
          <span className="mt-0.5 shrink-0 rounded-full bg-violet-soft px-2.5 py-1 text-[12px] font-bold text-violet">{level.label}</span>
        )}
      </div>
      {/* Montages start at once now: the plan and its prices only show on an older quote still waiting for its « Lancer ». */}
      <div className={`grid gap-5 p-5 ${quote.plan && open ? "@xl:grid-cols-[1fr_230px]" : ""}`}>
        {quote.plan && open && <PlanList plan={quote.plan} />}
        <div className="flex min-w-0 flex-col @xl:rounded-[16px] @xl:bg-soft @xl:p-4">
          {/* The part that changes with the state rises in when it changes live. */}
          <div key={quote.state} className={`flex flex-col gap-3 ${quote.state !== first ? "fauve-enter" : ""}`}>
            {open ? (
              <>
                {level && (
                  <div className="flex flex-col gap-1.5">
                    {levels.length > 1 && (
                      <div
                        role="radiogroup"
                        aria-label="Niveau de soin"
                        aria-describedby={pitchId}
                        className="fauve-pill bg-soft @xl:bg-white"
                        style={{ "--n": levels.length, "--i": Math.max(0, levels.indexOf(effort ?? levels[0]!)) } as CSSProperties}
                      >
                        <span className="fauve-pill-indicator" aria-hidden="true" />
                        {levels.map((e) => (
                          <label
                            key={e}
                            className={`flex h-10 cursor-pointer items-center justify-center rounded-full text-[13px] font-bold transition-colors duration-200 ease-fauve has-disabled:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet @xl:h-9 ${
                              effort === e ? "text-white" : "text-muted hover:text-ink"
                            }`}
                          >
                            {/* Native radios: one Tab stop, arrows move the choice. */}
                            <input
                              type="radio"
                              name={`effort-${quote.id}`}
                              value={e}
                              checked={effort === e}
                              disabled={busy}
                              onChange={() => {
                                setEffort(e);
                                setTouched(true);
                                setError(null);
                              }}
                              className="sr-only"
                            />
                            {EFFORTS[e].label}
                          </label>
                        ))}
                      </div>
                    )}
                    <p id={pitchId} key={shown} className={`text-[12px] leading-snug text-muted ${touched ? "fauve-fade" : ""}`}>
                      {effortPitch(shown!, quote.kind === "correction")} · {level.minutes} min
                    </p>
                    {quote.effort && levels.length > 0 && levels.length < LEVELS.length && (
                      <p className="text-[12px] leading-snug text-muted">
                        {LEVELS.filter((e) => !levels.includes(e))
                          .map((e) => EFFORTS[e].label)
                          .join(" et ")}{" "}
                        demande{LEVELS.length - levels.length > 1 ? "nt" : ""} plus de crédits que ton solde.
                      </p>
                    )}
                    {/* Heard once per change: the level and its price. */}
                    <p className="sr-only" aria-live="polite">
                      {touched ? `${level.label} : ${effortPitch(shown!, quote.kind === "correction")}, ${credits(price.base)}` : ""}
                    </p>
                  </div>
                )}
                {priceList}
                <div key={shown ?? "none"} className={`flex flex-col gap-1.5 ${touched ? "fauve-fade" : ""}`}>
                  {fromLibrary > 0 && (
                    <p className="text-[12px] leading-snug text-muted">
                      {fromLibrary > 1 ? `Les ${fromLibrary} autres animations viennent` : "L’autre animation vient"} de ta bibliothèque ou des scènes simples, sans frais.
                    </p>
                  )}
                  <p className="text-[12px] leading-snug text-muted">
                    {extra ? `Selon ce qu’il demande vraiment, jusqu’à ${credits(price.max)}. ` : ""}Tu ne paies que ce qui est vraiment fait.
                  </p>
                  <p className="text-[12px] text-muted tabular-nums">
                    Solde {credits(quote.balance)} · il t’en restera au moins {Math.max(0, quote.balance - price.max)}
                  </p>
                </div>
                {quote.failed && (
                  <p className="rounded-[12px] bg-peach px-3 py-2 text-[13px] leading-snug text-peach-ink">
                    Le montage n’a pas abouti. Aucun crédit n’a été débité.
                  </p>
                )}
                {onLaunch && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      type="button"
                      // Stays focusable while it works (a disabled button would drop the keyboard focus).
                      aria-disabled={busy || undefined}
                      aria-busy={launching || undefined}
                      onClick={launch}
                      className={`fauve-press flex h-11 items-center justify-center gap-2 rounded-full bg-violet px-4 text-[15px] font-bold whitespace-nowrap text-white ${
                        busy ? "cursor-default" : "hover:bg-violet-hover"
                      } ${busy && !launching ? "opacity-60" : ""}`}
                    >
                      {launching ? (
                        <>
                          <span className="fauve-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </span>
                          Lancement…
                        </>
                      ) : (
                        <span>
                          {quote.failed ? "Relancer" : "Lancer"} ·{" "}
                          <span key={price.base} className={`inline-block tabular-nums ${touched ? "fauve-enter [--fauve-y:4px]" : ""}`}>
                            {credits(price.base)}
                          </span>
                        </span>
                      )}
                    </button>
                    {error && (
                      <p role="alert" className="fauve-enter text-[13px] leading-snug font-semibold text-danger">
                        {error}
                      </p>
                    )}
                    {onAnswer && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAnswer("Pas maintenant")}
                        className="fauve-press h-10 rounded-full px-3 text-[14px] font-semibold text-muted hover:bg-soft hover:text-ink disabled:opacity-60 @xl:hover:bg-white"
                      >
                        Pas maintenant
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : quote.state === "launched" ? (
              <MontageProgress quote={quote} live={first !== "launched"} focus={launchedHere} onAsk={onAsk} />
            ) : quote.state === "delivered" ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success ${
                      first !== "delivered" ? "fauve-pop [--fauve-scale:0.5] [--fauve-delay:120ms]" : ""
                    }`}
                  >
                    <CheckIcon size={16} strokeWidth={2.4} />
                  </span>
                  <p role="status" className="text-[15px] leading-snug font-bold">
                    {opening === quote.postId ? "Ta vidéo est prête, je l’ouvre…" : quote.kind === "variant" ? "Ta variante est prête" : "Ta vidéo est prête"}
                  </p>
                </div>
                <Link href={`/publications/${quote.postId}`} className="btn btn-primary h-11 text-[15px]">
                  Voir la vidéo
                </Link>
                <p className="text-[12px] text-muted tabular-nums">
                  {credits(quote.charged ?? quote.base)} débité{(quote.charged ?? quote.base) > 1 ? "s" : ""} · solde {credits(quote.balance)}
                </p>
              </>
            ) : quote.state === "replaced" ? (
              <p className="text-[13px] leading-snug text-muted">Arrêté pour ta nouvelle demande, sans rien débiter : la version qui la suit arrive à sa place.</p>
            ) : (
              <>
                <div className="opacity-60">{priceList}</div>
                <p className="text-[13px] leading-snug text-muted">Ce montage n’a pas été lancé à temps.</p>
                {onAsk && (
                  <button
                    type="button"
                    onClick={() => onAsk(`Lance le montage de « ${quote.title} »`)}
                    className="fauve-press h-10 rounded-full border border-lilac bg-white px-4 text-[14px] font-semibold text-violet hover:bg-violet-soft"
                  >
                    Le lancer maintenant
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

type StepKey = "design" | "alternative" | "render" | "review" | "delivered";

/**
 * The steps of a launched montage, as its level runs them (a correction never has a 2nd version, a variant is only a render);
 * an effect made by the effects agent: the effect (its own checks), then the music.
 */
function stepsFor(kind: CardQuote["kind"], effort: Effort | null, effect = false): { key: StepKey; label: string }[] {
  if (kind === "variant") {
    return [
      { key: "render", label: "Rendu" },
      { key: "delivered", label: "Livrée" },
    ];
  }
  if (effect) {
    return [
      { key: "design", label: "Effet" },
      { key: "render", label: "Musique" },
      { key: "delivered", label: "Livrée" },
    ];
  }
  return [
    { key: "design", label: kind === "correction" ? "Correction" : "Montage" },
    ...(effort === "max" && kind === "montage" ? [{ key: "alternative" as const, label: "2e version" }] : []),
    { key: "render", label: "Rendu" },
    ...(EFFORTS[effort ?? "rapide"].review ? [{ key: "review" as const, label: "Relecture" }] : []),
    { key: "delivered", label: "Livrée" },
  ];
}

/** Where a recorded stage sits in the steps: a correction (fix) belongs to the review, the effect to the montage. */
function stepAt(steps: { key: StepKey }[], stage: CardQuote["stage"]): number {
  if (!stage) return 0;
  const i = steps.findIndex((s) => s.key === (stage === "fix" ? "review" : stage === "effects" ? "design" : stage));
  return Math.max(0, i);
}

/** The current step's label, for a short reminder elsewhere (the Fauve page, the drawer's header). */
export function montageStep(quote: CardQuote): string {
  const steps = stepsFor(quote.kind, quote.effort, quote.effect);
  return steps[stepAt(steps, quote.stage)]!.label;
}

/** Now, every `every` ms, from the browser only (null on the server and the first render: no hydration mismatch). */
function useNow(every: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, every);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [every]);
  return now;
}

/**
 * A launched montage: what is done, what is under way (Fauve's orb), what is
 * left, in one sentence, and for how long. Steps only move forward: a
 * correction rendered after the review stays on « Relecture ».
 */
function MontageProgress({ quote, live, focus, onAsk }: { quote: CardQuote; live: boolean; focus: boolean; onAsk?: (text: string) => void }) {
  const steps = stepsFor(quote.kind, quote.effort, quote.effect);
  // Every stage seen while the card is open: the furthest step, and whether a review or a correction happened.
  const [seen, setSeen] = useState<string[]>(() => (quote.stage ? [quote.stage] : []));
  if (quote.stage && !seen.includes(quote.stage)) setSeen([...seen, quote.stage]);
  const at = Math.max(stepAt(steps, quote.stage), ...seen.map((s) => stepAt(steps, s as CardQuote["stage"])));
  const [firstAt] = useState(at);
  const max = quote.effort === "max" && quote.kind === "montage";
  const reviewed = seen.includes("review") || seen.includes("fix");
  const text =
    quote.stage === "effects"
      ? "Simone fait l’effet image par image et vérifie chaque geste"
      : quote.stage === "alternative"
      ? "Une 2e version, pour comparer"
      : quote.stage === "render"
        ? quote.kind === "variant"
          ? "La variante se fabrique"
          : quote.effect
            ? "Simone pose la musique"
            : reviewed
            ? "La version corrigée se fabrique"
            : max
              ? "Les deux versions se fabriquent"
              : "La vidéo se fabrique"
        : quote.stage === "review"
          ? seen.includes("fix")
            ? "Simone vérifie la correction"
            : max
              ? "Simone compare les deux versions"
              : "Simone regarde la vidéo"
          : quote.stage === "fix"
            ? "Simone corrige ce qu’elle a repéré"
            : quote.stage === "delivered"
              ? "Ta vidéo est prête"
              : quote.kind === "correction"
                ? "Simone applique tes changements"
                : "Simone choisit les plans et anime les scènes";
  const [firstText] = useState(text);

  const now = useNow(30_000);
  const minutes = now !== null && quote.startedAt ? Math.max(0, Math.floor((now - Date.parse(quote.startedAt)) / 60_000)) : null;
  const level = EFFORTS[quote.effort ?? "rapide"];
  const late =
    now !== null &&
    quote.startedAt !== null &&
    montageLate({ startedAt: Date.parse(quote.startedAt), stageAt: quote.stageAt ? Date.parse(quote.stageAt) : null, effort: quote.effort, now });

  // Launched from this card: the keyboard focus lands on the progress (the button it was on is gone).
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus({ preventScroll: true });
  }, [focus]);

  return (
    <div ref={ref} tabIndex={-1} data-progress className="flex flex-col gap-3 outline-none">
      <ol aria-label="Étapes du montage" className="flex flex-col">
        {steps.map((step, i) => {
          const done = i < at || (i === at && step.key === "delivered");
          const current = i === at && !done;
          return (
            <li key={step.key} aria-current={current ? "step" : undefined} className="relative flex items-center gap-2.5 pb-3.5 last:pb-0">
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="absolute top-[22px] -bottom-0.5 left-[9px] w-0.5 overflow-hidden rounded-full bg-line">
                  <span
                    className={`block size-full origin-top bg-violet transition-transform duration-300 ease-fauve motion-reduce:transition-none ${
                      i < at ? "scale-y-100" : "scale-y-0"
                    }`}
                  />
                </span>
              )}
              <span className="relative flex size-5 shrink-0 items-center justify-center">
                {done ? (
                  <span
                    className={`flex size-5 items-center justify-center rounded-full bg-violet text-white ${
                      live || i >= firstAt ? "fauve-pop [--fauve-scale:0.5] [--fauve-delay:200ms]" : ""
                    }`}
                  >
                    <CheckIcon size={12} strokeWidth={2.6} />
                  </span>
                ) : current ? (
                  <Orb size={20} />
                ) : (
                  <span className="size-2.5 rounded-full border-2 border-line bg-white" />
                )}
              </span>
              <span className={`text-[13px] ${current ? "font-bold text-ink" : done ? "font-semibold text-ink/70" : "text-muted"}`}>
                {step.label}
                <span className="sr-only"> ({done ? "terminé" : current ? "en cours" : "à venir"})</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p role="status" className="text-[14px] leading-snug font-semibold">
        <span key={text} className={text !== firstText ? "fauve-fade" : ""}>
          {text}
        </span>
      </p>
      {late ? (
        <div className="fauve-enter flex flex-col items-start gap-1 rounded-[12px] bg-peach px-3 py-2 text-[13px] leading-snug text-peach-ink">
          C’est plus long que prévu. Je te préviens dès que c’est prêt.
          {onAsk && (
            <button type="button" onClick={() => onAsk(`Où en est mon montage « ${quote.title} » ?`)} className="fauve-press font-bold underline underline-offset-2">
              Où en est mon montage ?
            </button>
          )}
        </div>
      ) : (
        <p className="flex items-start gap-1.5 text-[12px] leading-[16px] text-muted tabular-nums">
          <ClockIcon size={14} className="mt-px shrink-0" />
          {minutes === null ? "" : minutes < 1 ? "À l’instant · " : `Depuis ${minutes} min · `}
          {quote.effect ? EFFECT_MINUTES : level.minutes} min en tout
        </p>
      )}
      <p className="text-[12px] leading-snug text-muted tabular-nums">
        Débité à la livraison : {quote.max > quote.base ? `${quote.base} à ${credits(quote.max)}` : credits(quote.base)}
      </p>
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

function PostCard({ post, timezone, making = false }: { post: CardPost; timezone: string; making?: boolean }) {
  const tall = post.kind === "reel" || post.kind === "story";
  return (
    <article className="flex w-[240px] max-w-full flex-col overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_2px_10px_rgba(28,21,48,0.05)]">
      <div className={`relative ${tall ? "aspect-[9/16]" : "aspect-[4/5]"} bg-soft`}>
        <Media post={post} controls />
        {post.kind === "carousel" && <LayersIcon size={16} className="absolute top-2 right-2 text-white drop-shadow" />}
        {making && (
          // At the top: the video controls stay usable (a correction keeps the current version watchable).
          <span className="fauve-fade pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-linear-to-b from-ink/70 to-transparent px-3 pt-2.5 pb-8 text-[12px] font-bold text-white">
            <span className="fauve-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            Montage en cours
          </span>
        )}
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
