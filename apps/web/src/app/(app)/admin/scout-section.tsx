import { HOUSE_MODELS, requestsWords, VERDICT_LABELS } from "@fauve/agent";
import { formatShortDateTime } from "@/lib/format";
import type { ScoutCard, ScoutView } from "@/lib/model-scout";
import { proposeCandidate, reviewCandidate } from "./scout-actions";

// « Modèles repérés » (lib/model-scout.ts; docs/modeles.md): the Reels businesses send to copy whose form would make a
// new model of Edith's, and the links Tristan proposes, each judged on its reading. « En faire un modèle » keeps one:
// for now its fiche and its model are written from this list by Claude Code, as before.

const ZONE = "Europe/Paris";
const PLATFORMS: Record<ScoutCard["platform"], string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };

const euros = (n: number) => `${n.toFixed(n > 0 && n < 0.1 ? 3 : 2).replace(".", ",")} €`;

/** Where it comes from: how often businesses sent it to copy, or Tristan's own link. */
function origin(card: ScoutCard): string {
  const sent = requestsWords(card.requests);
  if (card.source === "admin") return sent ? `Proposé par toi · ${sent.charAt(0).toLowerCase()}${sent.slice(1)}` : "Proposé par toi";
  return sent ?? "Envoyé à recopier par un commerce";
}

/** Those being read first, then the strongest, the most asked for, the latest. */
const ranked = (cards: ScoutCard[]) =>
  [...cards].sort((a, b) => Number(Boolean(b.reading)) - Number(Boolean(a.reading)) || (b.score ?? 0) - (a.score ?? 0) || b.requests - a.requests || b.at.localeCompare(a.at));

export function ScoutSection({ view }: { view: ScoutView }) {
  const fresh = ranked(view.cards.filter((c) => c.status === "new"));
  const kept = ranked(view.cards.filter((c) => c.status === "kept"));
  const drafted = view.cards.filter((c) => c.status === "drafted");
  const dropped = [...view.cards.filter((c) => c.status === "dropped")].sort((a, b) => b.requests - a.requests || b.at.localeCompare(a.at));
  return (
    <section className="card flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-bold">Modèles repérés</h2>
        <p className="text-sm text-muted">
          Quand un commerce envoie un Reel à recopier, Edith le lit pour sa copie, puis juge sur cette lecture si sa forme de montage ferait un modèle qu’aucun des{" "}
          {HOUSE_MODELS.length} ne fait déjà (environ un centime ; rien n’est dit au commerce). Tes liens sont lus et jugés de la même façon. On ne garde que le lien du
          Reel, sa lecture et le nombre de demandes, jamais qui l’a envoyé. « En faire un modèle » le garde : pour l’instant, sa fiche et son modèle s’écrivent ensuite
          depuis cette liste par Claude Code, comme aujourd’hui.
        </p>
      </div>
      <p className="text-[13px] text-muted tabular-nums">
        30 derniers jours : {view.judged} Reel{view.judged > 1 ? "s" : ""} jugé{view.judged > 1 ? "s" : ""}, {euros(view.monthEur)} (lectures de tes liens comprises).
      </p>
      <form action={proposeCandidate} className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          name="link"
          required
          maxLength={600}
          pattern="https?://(www\.|m\.|vm\.|vt\.)?(instagram\.com|tiktok\.com)/.+"
          title="Le lien d’un Reel Instagram ou d’un TikTok"
          placeholder="Le lien d’un Reel Instagram ou d’un TikTok"
          className="h-10 min-w-0 flex-1 border border-line bg-white px-3 text-[14px] outline-none focus:border-violet"
        />
        <button type="submit" className="btn btn-primary h-10 px-4 text-sm">
          Proposer
        </button>
      </form>
      {view.missing ? (
        <p className="text-sm text-muted">La liste n’est pas encore en place (sa table est à créer en base).</p>
      ) : (
        <>
          <Group title={`À regarder${fresh.length ? ` (${fresh.length})` : ""}`} cards={fresh} empty="Rien à regarder pour l’instant : un Reel apparaît ici quand un commerce en envoie un dont la forme est nouvelle, ou quand tu proposes un lien." />
          {kept.length > 0 && (
            <Group
              title={`À écrire (${kept.length})`}
              hint="Pour l’instant, Claude Code écrit sa fiche puis son modèle depuis cette liste, par la chaîne des modèles, comme aujourd’hui ; tu le valides ensuite dans « Modèles ». « Marquer écrit » une fois le modèle en ligne."
              cards={kept}
            />
          )}
          {drafted.length > 0 && <Group title={`Écrits (${drafted.length})`} cards={drafted} />}
          {dropped.length > 0 && (
            <details className="flex flex-col gap-2">
              <summary className="cursor-pointer text-sm font-semibold">Écartés ({dropped.length}) : par toi, ou par le jugement d’Edith</summary>
              <Group cards={dropped} />
            </details>
          )}
        </>
      )}
    </section>
  );
}

function Group({ title, hint, cards, empty }: { title?: string; hint?: string; cards: ScoutCard[]; empty?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {title && <h3 className="mono-label text-muted">{title}</h3>}
      {hint && <p className="text-[13px] leading-snug text-muted">{hint}</p>}
      {cards.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {cards.map((card) => (
            <Candidate key={card.id} card={card} />
          ))}
        </ul>
      ) : (
        empty && <p className="text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

function Candidate({ card }: { card: ScoutCard }) {
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="text-[17px] font-bold">{card.name ?? (card.reading ? "Reel en lecture" : "Reel")}</h4>
        {card.verdict && <span className={`mono-label ${card.verdict === "new_form" ? "text-violet" : "text-muted"}`}>{VERDICT_LABELS[card.verdict]}</span>}
        {card.score !== null && <span className="mono-label text-muted tabular-nums">{card.score}/10</span>}
      </div>
      <p className="text-[13px] text-muted">
        {origin(card)} · {PLATFORMS[card.platform]} · {formatShortDateTime(card.at, ZONE)}
        {card.costEur > 0 ? ` · ${euros(card.costEur)}` : ""} ·{" "}
        <a href={card.link} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          Ouvrir le Reel
        </a>
      </p>
      {card.novelty && <p className="text-sm leading-snug">{card.novelty}</p>}
      {card.nearest && (
        <p className="text-[13px] text-muted">
          Le plus proche : « {card.nearest.name} »{card.nearest.closeness !== null ? `, ${card.nearest.closeness}/10` : ""}
        </p>
      )}
      {card.trades.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Pour">
          {card.trades.map((t) => (
            <li key={t} className="border border-line px-2 py-0.5 text-[12px]">
              {t}
            </li>
          ))}
        </ul>
      )}
      {card.needs && <p className="text-[13px] text-muted">À filmer : {card.needs}</p>}
      {card.why && <p className="text-[13px] leading-snug text-muted">{card.why}</p>}
      {card.note && <p className="text-[13px] leading-snug whitespace-pre-line">Ta note : « {card.note} »</p>}
      {card.embed && (
        <details>
          <summary className="cursor-pointer text-[13px] font-semibold">Voir le Reel</summary>
          <iframe
            src={card.embed}
            title={card.name ?? "Reel"}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className={`mt-2 w-[260px] max-w-full border border-line bg-ink ${card.platform === "instagram" ? "aspect-[9/14]" : "aspect-[9/16]"}`}
          />
        </details>
      )}
      <Actions card={card} />
    </li>
  );
}

function Actions({ card }: { card: ScoutCard }) {
  const id = <input type="hidden" name="id" value={card.id} />;
  if (card.reading === "running") return <p className="text-[13px] text-muted">Lecture et jugement en cours (une à deux minutes).</p>;
  if (card.reading === "stale" || card.verdict === "unreadable")
    return (
      <form action={reviewCandidate}>
        {id}
        <button type="submit" name="action" value="reread" className="btn btn-secondary h-9 px-3 text-[13px]">
          Relancer la lecture
        </button>
      </form>
    );
  if (card.status === "new")
    return (
      <form action={reviewCandidate} className="flex flex-col gap-2">
        {id}
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          placeholder="Ta note : ce qui t’y plaît, ou pourquoi l’écarter (facultatif)"
          className="w-full border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-violet"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="action" value="keep" className="btn btn-primary h-9 px-3 text-[13px]">
            En faire un modèle
          </button>
          <button type="submit" name="action" value="drop" className="btn btn-secondary h-9 px-3 text-[13px]">
            Écarter
          </button>
        </div>
      </form>
    );
  if (card.status === "kept")
    return (
      <div className="flex flex-wrap items-center gap-2">
        <form action={reviewCandidate} className="flex flex-wrap items-center gap-2">
          {id}
          <select name="model" required defaultValue="" className="h-9 min-w-0 border border-line bg-white px-2 text-[13px] outline-none focus:border-violet">
            <option value="" disabled>
              Le modèle écrit
            </option>
            {HOUSE_MODELS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="submit" name="action" value="drafted" className="btn btn-primary h-9 px-3 text-[13px]">
            Marquer écrit
          </button>
        </form>
        <form action={reviewCandidate}>
          {id}
          <button type="submit" name="action" value="drop" className="btn btn-secondary h-9 px-3 text-[13px]">
            Écarter
          </button>
        </form>
      </div>
    );
  if (card.status === "drafted") return card.model ? <p className="text-[13px] font-semibold">Devenu « {card.model.name} »</p> : null;
  return (
    <form action={reviewCandidate}>
      {id}
      <button type="submit" name="action" value="restore" className="btn btn-secondary h-9 px-3 text-[13px]">
        Remettre
      </button>
    </form>
  );
}
