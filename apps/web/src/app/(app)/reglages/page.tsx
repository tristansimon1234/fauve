import { PageSuspense } from "@/components/page-suspense";
import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_PRICES, DEFAULT_EFFORT, effortSchema, PLANS, planOf, readMemory } from "@fauve/agent";
import { NoStudio } from "@/components/empty-state";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";
import { creditBalance } from "@/lib/credits";
import { fauveAccount } from "@/lib/instagram-dm";
import { formatPhone, platformLabels, plural, shortUrl } from "@/lib/format";
import { whatsappLink } from "@/lib/public-env";
import { getContentPlan, getSocialAccounts, getStudioContext, type SocialAccount } from "@/lib/studio";
import { signOut } from "../../(onboarding)/connexion/actions";
import { EffortSetting } from "./effort-setting";
import { MemoryList } from "./memory-list";
import { InstagramLinkCode } from "./instagram-link";
import { SettingsTabs } from "@/components/settings-tabs";

export const metadata: Metadata = { title: "Réglages" };

/** The price list, as the manager reads it. */
const CREDIT_LINES: [string, string][] = [
  ["Montage", `${CREDIT_PRICES.montage} + ${CREDIT_PRICES.clip} par clip`],
  ["Nouvelle scène animée", `${CREDIT_PRICES.newScene}`],
  ["Scène de ta bibliothèque", "gratuit"],
  ["Correction d’un montage", `${CREDIT_PRICES.correction}`],
  ["Variante d’un montage", `${CREDIT_PRICES.variant}`],
  ["Simone regarde la vidéo (Soigné, Max)", `${CREDIT_PRICES.review}`],
  ["Correction après l’avoir regardée", `${CREDIT_PRICES.fixRound}`],
  ["2e version à comparer (Max)", `${CREDIT_PRICES.alternative}`],
  ["Rendu vidéo", `${CREDIT_PRICES.render}`],
  ["Lecture du moodboard", `${CREDIT_PRICES.moodboard}`],
  ["Messages à Simone", "gratuit"],
];

const accountStatusLabels: Record<SocialAccount["status"], string> = {
  connected: "connecté",
  pending: "connexion en cours",
  expired: "connexion expirée",
  disconnected: "déconnecté",
};

export default function SettingsPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <SettingsTabs current="/reglages" />
      <PageSuspense title="Réglages">
        <Settings />
      </PageSuspense>
      <form action={signOut}>
        <button type="submit" className="btn btn-secondary">
          Me déconnecter
        </button>
      </form>
    </main>
  );
}

async function Settings() {
  const { db, member } = await getStudioContext();
  if (!member) {
    return (
      <>
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Réglages</h1>
        <NoStudio />
      </>
    );
  }
  const { studio } = member;
  const offer = planOf(studio.plan);
  const [accounts, plan, balance, ledger, fauveInstagram, dmContact, care] = await Promise.all([
    getSocialAccounts(db, studio.id),
    getContentPlan(db, studio.id),
    creditBalance(studio.id),
    db.from("credit_ledger").select("id, delta, label, created_at").eq("studio_id", studio.id).order("created_at", { ascending: false }).limit(10),
    fauveAccount(),
    db.from("instagram_contacts").select("igsid").eq("studio_id", studio.id).limit(1).maybeSingle(),
    db.from("studios").select("montage_effort, business_type, memory").eq("id", studio.id).maybeSingle(),
  ]);
  const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: studio.timezone });

  return (
    <>
      <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Réglages</h1>
      <div className="flex max-w-[640px] flex-col gap-4">
        <Section title="Mon studio">
          <Field label="Nom" value={studio.name} />
          <Field label="Activité" value={(care.data?.business_type as string | null) ?? null} />
          <Field label="Site web" value={studio.website_url} href={studio.website_url} />
          <Field label="Lien de réservation" value={studio.booking_url} href={studio.booking_url} />
          <p className="text-[13px] text-muted">Pour changer ces informations, dis-le à Simone.</p>
        </Section>

        <Section title="Ce que Simone sait de ton commerce">
          <MemoryList initial={readMemory(care.data?.memory).map((f) => f.fact)} />
        </Section>

        <Section title="Mon compte">
          <Field label="Prénom" value={member.first_name} />
          <Field label="Téléphone" value={formatPhone(member.phone_e164)} />
          <Field label="Rôle" value={member.role === "owner" ? "Gérante" : "Équipe"} />
        </Section>

        <Section title="Comptes connectés">
          {accounts.length ? (
            accounts.map((a) => (
              <div key={a.platform} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-violet-soft text-violet">
                  {a.platform === "tiktok" ? <TikTokIcon size={18} /> : <InstagramIcon size={18} />}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-bold">{a.handle ? `@${a.handle}` : platformLabels[a.platform]}</span>
                  <span className="text-[13px] text-muted">
                    {platformLabels[a.platform]} {accountStatusLabels[a.status]}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm leading-normal">
              Aucun compte connecté pour l’instant.{" "}
              <a href="/connect" className="font-bold text-violet">
                Connecter Instagram
              </a>{" "}
              pour que Simone publie tes posts validés. TikTok arrive bientôt.
            </p>
          )}
        </Section>

        {fauveInstagram?.username && (
          <Section title="Simone sur Instagram">
            <p className="text-sm leading-normal">
              Quand un Reel t’inspire, partage-le à{" "}
              <a href={`https://ig.me/m/${fauveInstagram.username}`} target="_blank" rel="noreferrer" className="font-bold text-violet">
                @{fauveInstagram.username}
              </a>{" "}
              (bouton Partager) : Simone en tire des idées pour ton style. Tu peux aussi lui écrire là-bas comme sur WhatsApp.
            </p>
            {dmContact.data ? (
              <p className="text-sm font-semibold text-success">Ton compte Instagram est relié.</p>
            ) : (
              <InstagramLinkCode fauveHandle={fauveInstagram.username} />
            )}
          </Section>
        )}

        <Section title="Style des vidéos">
          <p className="text-sm leading-normal">
            Direction artistique, couleurs, polices, logo et ambiance que Simone applique à chaque publication.{" "}
            <Link href="/style" className="font-bold text-violet">
              Régler mon style
            </Link>
          </p>
        </Section>

        <Section title="Soin des montages">
          <p className="text-sm leading-normal">
            Le niveau que Simone utilise par défaut pour tes Reels. Pour un Reel en particulier, choisis-en un autre sur le devis, ou dis-le-lui.
          </p>
          <EffortSetting initial={effortSchema.catch(DEFAULT_EFFORT).parse(care.data?.montage_effort)} />
        </Section>

        <Section title="Rythme">
          {plan ? (
            <p className="text-sm leading-normal">
              {plural(plan.posts_per_week, "post", "posts")} et {plural(plan.stories_per_week, "story", "stories")} par
              semaine
              {plan.platforms.length ? `, sur ${plan.platforms.map((p) => platformLabels[p]).join(" et ")}` : ""}.
              Demande à Simone sur WhatsApp pour le changer.
            </p>
          ) : (
            <p className="text-sm leading-normal">
              Pas encore de rythme choisi. Dis à Simone sur WhatsApp combien de posts et de stories tu veux par semaine.
            </p>
          )}
        </Section>

        <Section title="Abonnement">
          <p className="text-sm leading-normal">
            {studio.plan === "trial"
              ? `Période d’essai en cours, avec tout ${PLANS.pro.label}. Ensuite : ${PLANS.essentiel.label} à ${PLANS.essentiel.priceEur} € / mois ou ${PLANS.pro.label} à ${PLANS.pro.priceEur} € / mois, sans engagement.`
              : `${PLANS[offer].label} : ${PLANS[offer].priceEur} € / mois, ${PLANS[offer].credits} crédits par mois, sans engagement.`}
          </p>
        </Section>

        <Section title="Crédits">
          <p className="flex items-baseline gap-2">
            <span className="text-[34px] font-extrabold tracking-[-0.02em] tabular-nums">{balance}</span>
            <span className="text-sm font-semibold text-muted">crédits disponibles</span>
          </p>
          <p className="text-sm leading-normal text-muted">
            Ton solde remonte à {PLANS[offer].credits} crédits le 1er de chaque mois. Avant chaque montage, Simone t’annonce ce
            qu’elle va faire et ce que ça coûte ; tu ne paies jamais plus que l’annonce, et rien si le montage échoue.
          </p>
          <ul className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
            {CREDIT_LINES.map(([label, credits]) => (
              <li key={label} className="flex justify-between gap-3 border-b border-line py-1.5">
                <span>{label}</span>
                <span className="font-semibold tabular-nums">{credits}</span>
              </li>
            ))}
          </ul>
          {(ledger.data ?? []).length > 0 && (
            <div className="flex flex-col gap-1 pt-1">
              <h3 className="text-[13px] font-bold">Derniers mouvements</h3>
              <ul className="flex flex-col">
                {(ledger.data ?? []).map((row) => (
                  <li key={row.id as string} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                    <span className="min-w-0 truncate">
                      <span className="text-muted">{dateFormat.format(new Date(row.created_at as string))} · </span>
                      {row.label as string}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${(row.delta as number) > 0 ? "text-success" : ""}`}>
                      {(row.delta as number) > 0 ? "+" : ""}
                      {row.delta as number}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <a href={whatsappLink()} className="btn btn-secondary self-start">
          <WhatsAppIcon size={18} />
          Écrire à Simone sur WhatsApp
        </a>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, href }: { label: string; value: string | null; href?: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
      <span className="text-muted">{label}</span>
      {value ? (
        href && /^https?:\/\//i.test(href) ? (
          <a href={href} target="_blank" rel="noreferrer" className="font-semibold break-all text-violet">
            {shortUrl(value)}
          </a>
        ) : (
          <span className="font-semibold">{value}</span>
        )
      ) : (
        <span className="text-muted">Non renseigné</span>
      )}
    </div>
  );
}
