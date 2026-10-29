import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageSuspense } from "@/components/page-suspense";
import { adminView, teamMember, type AdminView } from "@/lib/admin";
import { formatPhone, formatShortDateTime } from "@/lib/format";
import type { ProviderBudget } from "@/lib/provider-budgets";
import { dropWaiting, letIn, saveBrakes, setBudget } from "./actions";

export const metadata: Metadata = { title: "Admin" };

// The team's page (Tristan : « il va me falloir une interface admin pour gérer ») : the brakes of a
// rush (brakes.ts) and their numbers, the waitlist (let someone in, or off), the montages running
// or waiting, the last signups. Only the team's studio opens it (lib/admin.ts).

const ZONE = "Europe/Paris";

const STEPS: Record<string, string> = {
  website: "Site",
  style: "Style",
  rhythm: "Rythme",
  first_post: "1re publication",
  connect: "Instagram",
  done: "Terminé",
};

export default function AdminPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <PageSuspense title="Admin">
        <Admin />
      </PageSuspense>
    </main>
  );
}

async function Admin() {
  if (!(await teamMember())) notFound();
  const view = await adminView();
  return (
    <>
      <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em]">Admin</h1>
      <Today view={view} />
      <Providers providers={view.providers} />
      <Brakes view={view} />
      <Waitlist view={view} />
      <Montages view={view} />
      <Signups view={view} />
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Today({ view }: { view: AdminView }) {
  const { today, settings } = view;
  const tiles = [
    { label: "Nouveaux commerces aujourd’hui", value: `${today.signups} / ${settings.dailySignups}`, full: today.signups >= settings.dailySignups },
    { label: "En liste d’attente", value: String(view.waitlistTotal), full: view.waitlistTotal > 0 },
    { label: "Montages en cours", value: `${today.running} / ${settings.montagesAtOnce}`, full: today.running >= settings.montagesAtOnce },
    { label: "Montages en file", value: String(today.waiting), full: today.waiting > 0 },
    { label: "Dépense des non abonnés", value: `${today.spent.toFixed(2).replace(".", ",")} € / ${settings.freeSpendEurPerDay} €`, full: today.spent >= settings.freeSpendEurPerDay },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className={`card flex flex-col gap-1 p-4 ${t.full ? "bg-peach" : ""}`}>
          <span className="text-[13px] text-muted">{t.label}</span>
          <span className={`text-[22px] font-extrabold tabular-nums ${t.full ? "text-peach-ink" : ""}`}>{t.value}</span>
        </div>
      ))}
    </div>
  );
}

function NumberField({ name, label, hint, value, step }: { name: string; label: string; hint: string; value: number; step?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={value}
        min={0}
        step={step ?? "1"}
        required
        className="h-10 w-full rounded-[12px] border border-line bg-white px-3 text-[14px] tabular-nums outline-none focus:border-violet"
      />
      <span className="text-[13px] text-muted">{hint}</span>
    </label>
  );
}

function Brakes({ view }: { view: AdminView }) {
  const { settings } = view;
  return (
    <Section title="Les freins" hint="Appliqués partout en moins d’une minute.">
      <form action={saveBrakes} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            name="dailySignups"
            label="Nouveaux commerces par jour"
            hint="Au-delà, liste d’attente. Compté de minuit à minuit, heure de Paris."
            value={settings.dailySignups}
          />
          <NumberField name="montagesAtOnce" label="Montages en même temps" hint="Tous commerces ensemble. Les suivants attendent leur tour." value={settings.montagesAtOnce} />
          <NumberField
            name="freeSpendEurPerDay"
            label="Dépense max des non abonnés (€ / jour)"
            hint="Au-delà, plus rien de coûteux pour eux jusqu’à demain."
            value={settings.freeSpendEurPerDay}
            step="any"
          />
        </div>
        <button type="submit" className="btn btn-primary self-start">
          Enregistrer
        </button>
      </form>
    </Section>
  );
}

function Waitlist({ view }: { view: AdminView }) {
  return (
    <Section
      title={`Liste d’attente${view.waitlistTotal ? ` (${view.waitlistTotal})` : ""}`}
      hint="Ils entrent tout seuls, les plus anciens d’abord, dès qu’il y a de la place, de 8 h à 21 h. « Faire entrer » passe avant le plafond du jour."
    >
      {view.waitlist.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {view.waitlist.map((w) => {
            const { reachable } = w;
            return (
              <li key={w.phone} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">
                    {w.firstName ?? "Sans prénom"} · <span className="tabular-nums">{formatPhone(w.phone)}</span>
                  </span>
                  {w.firstText && <span className="truncate text-sm text-muted">« {w.firstText} »</span>}
                  <span className="text-[13px] text-muted">
                    Depuis le {formatShortDateTime(w.since, ZONE)}
                    {reachable ? "" : " · plus de 24 h sans message : il entrera à son prochain message"}
                  </span>
                </div>
                <form action={letIn}>
                  <input type="hidden" name="phone" value={w.phone} />
                  <button type="submit" className="btn btn-primary h-10 px-4 text-sm">
                    Faire entrer
                  </button>
                </form>
                <form action={dropWaiting}>
                  <input type="hidden" name="phone" value={w.phone} />
                  <button type="submit" className="btn btn-secondary h-10 px-4 text-sm">
                    Retirer
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Personne n’attend.</p>
      )}
    </Section>
  );
}

function Montages({ view }: { view: AdminView }) {
  return (
    <Section title="Montages" hint={`${view.today.running} en cours, ${view.today.waiting} en file.`}>
      {view.montages.length ? (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {view.montages.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-2.5">
              <span className="min-w-0 truncate font-semibold">{m.studio}</span>
              <span className={m.stage === "waiting" ? "font-semibold text-peach-ink" : "text-muted"}>
                {m.stage === "waiting" ? "En file" : m.stage} · depuis {formatShortDateTime(m.since, ZONE)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Aucun montage en ce moment.</p>
      )}
    </Section>
  );
}

function Signups({ view }: { view: AdminView }) {
  return (
    <Section title="Dernières inscriptions">
      <ul className="flex flex-col divide-y divide-line text-sm">
        {view.signups.map((s) => (
          <li key={s.phone} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="min-w-0 truncate">
              <span className="font-semibold">{s.studio}</span>
              <span className="text-muted">
                {" "}
                · {s.firstName ?? "Sans prénom"} · <span className="tabular-nums">{formatPhone(s.phone)}</span>
              </span>
            </span>
            <span className="text-muted">
              {STEPS[s.step] ?? s.step} · {s.subscription === "active" || s.subscription === "trialing" ? "abonné" : "pas abonné"} · {formatShortDateTime(s.at, ZONE)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

function Providers({ providers }: { providers: ProviderBudget[] }) {
  return (
    <Section
      title="Budgets des fournisseurs"
      hint="Dépensé d’après ce qu’Edith note de chaque appel. Un solde lu en direct se met à jour tout seul ; sinon, saisis le solde que montre la console du fournisseur après chaque recharge. Tu es prévenu sur WhatsApp avant qu’il soit à sec, et tout de suite si Claude refuse les appels."
    >
      <ul className="flex flex-col divide-y divide-line">
        {providers.map((p) => (
          <ProviderRow key={p.key} p={p} />
        ))}
      </ul>
    </Section>
  );
}

function ProviderRow({ p }: { p: ProviderBudget }) {
  const { state } = p;
  const left =
    state.remaining === null
      ? null
      : state.remaining <= 0
        ? "Solde sans doute épuisé"
        : `Reste ${usd(state.remaining)}${state.daysLeft !== null ? ` · ≈ ${Math.floor(state.daysLeft)} jours` : ""}`;
  return (
    <li className="flex flex-col gap-2 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="flex flex-col">
          <span className="font-semibold">{p.label}</span>
          <span className="text-[13px] text-muted">{p.role}</span>
        </span>
        <span className="text-sm tabular-nums text-muted">
          Aujourd’hui {usd(p.today)} · 7 jours {usd(p.week)} ({usd(p.perDay)} / jour) · ce mois {usd(p.month)}
          {typeof p.billed === "number" ? ` · facturé par Anthropic ce mois ${usd(p.billed)}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {left && <span className={`text-sm font-bold tabular-nums ${state.low ? "text-peach-ink" : ""}`}>{left}</span>}
        {p.quota && (
          <span className={`text-sm tabular-nums ${p.quota.limit && p.quota.used / p.quota.limit > 0.85 ? "font-bold text-peach-ink" : ""}`}>
            Crédits du mois : {p.quota.used.toLocaleString("fr-FR")} / {p.quota.limit.toLocaleString("fr-FR")}
            {p.quota.resetsAt ? ` · remis à zéro le ${formatShortDateTime(p.quota.resetsAt, ZONE)}` : ""}
            {p.quota.overage ? " · dépassement autorisé" : ""}
          </span>
        )}
        {p.live === null && <span className="text-sm text-muted">Solde illisible pour l’instant</span>}
        {p.live === undefined && p.key !== "elevenlabs" && (
          <form action={setBudget} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="provider" value={p.key} />
            <label className="flex items-center gap-1.5 text-sm">
              Solde actuel
              <input
                name="balance"
                inputMode="decimal"
                placeholder="en $"
                defaultValue={p.budget ? String(Math.max(0, Math.round((state.remaining ?? 0) * 100) / 100)) : ""}
                className="h-9 w-24 rounded-[12px] border border-line bg-white px-2.5 text-[14px] tabular-nums outline-none focus:border-violet"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              alerte à
              <input
                name="alertDays"
                type="number"
                min={1}
                max={90}
                defaultValue={p.budget?.alertDays ?? 7}
                className="h-9 w-16 rounded-[12px] border border-line bg-white px-2.5 text-[14px] tabular-nums outline-none focus:border-violet"
              />
              jours
            </label>
            <button type="submit" className="btn btn-secondary h-9 px-3.5 text-sm">
              Enregistrer
            </button>
          </form>
        )}
        <a href={p.topUp} target="_blank" rel="noreferrer" className="text-sm font-semibold text-violet">
          Recharger
        </a>
      </div>
    </li>
  );
}
