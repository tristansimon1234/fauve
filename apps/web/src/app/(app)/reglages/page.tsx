import type { Metadata } from "next";
import { Suspense } from "react";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";
import { formatPhone, platformLabels, plural, shortUrl } from "@/lib/format";
import { whatsappLink } from "@/lib/public-env";
import { getContentPlan, getSocialAccounts, getStudioContext, type SocialAccount } from "@/lib/studio";
import { signOut } from "../../(onboarding)/connexion/actions";

export const metadata: Metadata = { title: "Réglages" };

const accountStatusLabels: Record<SocialAccount["status"], string> = {
  connected: "connecté",
  pending: "connexion en cours",
  expired: "connexion expirée",
  disconnected: "déconnecté",
};

export default function SettingsPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <Suspense fallback={<PageLoading title="Réglages" />}>
        <Settings />
      </Suspense>
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
  const [accounts, plan] = await Promise.all([getSocialAccounts(db, studio.id), getContentPlan(db, studio.id)]);

  return (
    <>
      <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Réglages</h1>
      <div className="flex max-w-[640px] flex-col gap-4">
        <Section title="Mon studio">
          <Field label="Nom" value={studio.name} />
          <Field label="Site web" value={studio.website_url} href={studio.website_url} />
          <Field label="Lien de réservation" value={studio.booking_url} href={studio.booking_url} />
          <p className="text-[13px] text-muted">Pour changer ces informations, dis-le à Fauve sur WhatsApp.</p>
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
              pour que Fauve publie tes posts validés. TikTok arrive bientôt.
            </p>
          )}
        </Section>

        <Section title="Rythme">
          {plan ? (
            <p className="text-sm leading-normal">
              {plural(plan.posts_per_week, "post", "posts")} et {plural(plan.stories_per_week, "story", "stories")} par
              semaine
              {plan.platforms.length ? `, sur ${plan.platforms.map((p) => platformLabels[p]).join(" et ")}` : ""}.
              Demande à Fauve sur WhatsApp pour le changer.
            </p>
          ) : (
            <p className="text-sm leading-normal">
              Pas encore de rythme choisi. Dis à Fauve sur WhatsApp combien de posts et de stories tu veux par semaine.
            </p>
          )}
        </Section>

        <Section title="Abonnement">
          <p className="text-sm leading-normal">
            {studio.plan === "trial"
              ? "Période d’essai en cours. Ensuite : 49 € / mois, sans engagement."
              : "49 € / mois, sans engagement."}
          </p>
        </Section>

        <a href={whatsappLink()} className="btn btn-secondary self-start">
          <WhatsAppIcon size={18} />
          Écrire à Fauve sur WhatsApp
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
