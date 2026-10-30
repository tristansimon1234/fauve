import { filmIdeas, PLAN_ORDER, PLANS, postIdeas, reelsPerMonth } from "@fauve/agent";
import { priceTax } from "@/lib/legal";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import { CarouselStrip } from "@/components/landing/carousel-strip";
import { fr } from "@/components/landing/fr";
import { ReelWall } from "@/components/landing/reel-wall";
import { breadcrumb, faqPage, JsonLd, LastCall, SectionTitle, Start } from "@/components/landing/site";
import { COMPARISONS } from "@/content/comparatifs";
import { guideBySlug } from "@/content/guides";
import { COMMON_FAQ, TRADES, tradeBySlug } from "@/content/metiers";
import { whatsappLink } from "@/lib/public-env";

// A trade's page (/community-manager/restaurant…): what Edith does for it, the work to show, the
// ideas the app really offers that trade, its questions. Content in content/metiers.ts.

// Every real page is prerendered from generateStaticParams; only an unknown address reads its
// params at request time, and it ends in a 404.
export const instant = false;

export function generateStaticParams() {
  return TRADES.map((t) => ({ metier: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/community-manager/[metier]">): Promise<Metadata> {
  const trade = tradeBySlug((await params).metier);
  if (!trade) return {};
  const path = `/community-manager/${trade.slug}`;
  return {
    title: trade.title,
    description: trade.description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "Edith", locale: "fr_FR", url: path, title: `${trade.h1} ${trade.accent}`, description: trade.description },
  };
}

export default async function TradePage({ params }: PageProps<"/community-manager/[metier]">) {
  const trade = tradeBySlug((await params).metier);
  if (!trade) notFound();
  const waUrl = whatsappLink();
  const ideas = postIdeas(trade.business);
  const film = filmIdeas(trade.business);
  const faq = [...trade.faq, ...COMMON_FAQ];
  const path = `/community-manager/${trade.slug}`;

  return (
    <main>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [breadcrumb([["Edith", "/"], [trade.menu, path]]), faqPage(faq)] }} />

      {/* The promise for this trade */}
      <section className="mx-auto flex max-w-[1240px] flex-col gap-7 px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
        <nav aria-label="Fil d’Ariane" className="text-[13px] font-semibold text-muted">
          <Link href="/" className="hover:text-ink">
            Edith
          </Link>
          <span className="mx-2 text-ink/30">/</span>
          {trade.menu}
        </nav>
        <span className="flex items-center gap-3 text-[12px] font-bold tracking-[0.16em] text-muted uppercase">
          <span className="h-px w-8 bg-ink/30" />
          Community manager IA · {trade.kicker}
        </span>
        <h1 className="max-w-[900px] text-[clamp(38px,5.2vw,72px)] leading-[1] font-extrabold tracking-[-0.045em]">
          {fr(trade.h1)}
          <span className="mt-1 block font-[family-name:var(--font-serif)] text-[1.1em] leading-[0.98] font-normal tracking-[-0.02em] text-violet italic">{fr(trade.accent)}</span>
        </h1>
        <p className="max-w-[620px] text-[18px] leading-[1.6] text-muted sm:text-[19px]">{fr(trade.intro)}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Start waUrl={waUrl} size="lg" />
          <Link href="/#tarif" className="btn h-14 border border-ink/15 bg-white px-7 text-base text-ink hover:border-ink/30">
            Voir les tarifs
          </Link>
        </div>
      </section>

      {/* The work */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        {trade.show.carousel ? <CarouselStrip /> : <ReelWall only={trade.show.reels} />}
        <p className="mt-5 text-[13px] text-muted">{fr(trade.show.note)}</p>
      </section>

      {/* Why it works for this trade */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <SectionTitle n={1} kicker="Pourquoi ça marche">
          Fait pour ton métier, <span className="accent">pas pour tout le monde.</span>
        </SectionTitle>
        <div className="mt-10 grid gap-8 border-t border-ink/12 pt-8 md:grid-cols-3">
          {trade.points.map(([title, text], i) => (
            <div key={title} className="flex flex-col gap-2">
              <span className="font-[family-name:var(--font-serif)] text-[26px] leading-none text-violet italic">{i + 1}</span>
              <h3 className="text-[19px] font-bold tracking-[-0.01em]">{fr(title)}</h3>
              <p className="text-[15.5px] leading-[1.6] text-muted">{fr(text)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What to ask: the very ideas the app offers this trade */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <SectionTitle n={2} kicker="Ce que tu peux lui demander">
          Une phrase, <span className="accent">un Reel.</span>
        </SectionTitle>
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          {(
            [
              ["Reels", ideas.reel],
              ["Carrousels", ideas.carousel],
            ] as const
          ).map(([label, list]) => (
            <div key={label} className="flex flex-col">
              <span className="mb-3 text-[12px] font-bold tracking-[0.16em] text-muted uppercase">{label}</span>
              <ul className="flex flex-col divide-y divide-ink/10 border-y border-ink/10">
                {list.map((idea) => (
                  <li key={idea.label} className="flex flex-col gap-1 py-4">
                    <span className="text-[16px] font-bold">{fr(idea.label)}</span>
                    <span className="font-[family-name:var(--font-serif)] text-[19px] leading-[1.35] text-ink/80 italic">{fr(`« ${idea.prompt} »`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Easy to film */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <SectionTitle n={3} kicker="À filmer cette semaine">
          Pas d’idée ? <span className="accent">Commence par ça.</span>
        </SectionTitle>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {film.map((f) => (
            <div key={f.idea} className="flex flex-col gap-1.5 rounded-[22px] bg-white p-6">
              <span className="text-[17px] font-bold">{fr(f.idea)}</span>
              <span className="text-[15px] text-muted">{fr(f.how)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* The offers, in one line each */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <SectionTitle n={4} kicker="Tarif">
          Sans engagement, <span className="accent">sans surprise.</span>
        </SectionTitle>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => (
            <Link key={id} href="/#tarif" className="flex flex-col gap-2 rounded-[22px] bg-white p-6 transition-shadow hover:shadow-[0_24px_50px_-28px_rgba(28,21,48,.35)]">
              <span className="text-[12px] font-bold tracking-[0.16em] text-violet uppercase">{PLANS[id].label}</span>
              <span className="text-[34px] leading-none font-extrabold tracking-[-0.03em]">
                {PLANS[id].priceEur}&nbsp;€<span className="ml-1 text-[15px] font-semibold text-muted">{priceTax ? "TTC / mois" : "par mois"}</span>
              </span>
              <span className="flex items-center gap-2 text-[15px] text-muted">
                <CheckIcon size={15} />
                {reelsPerMonth(id)}&nbsp;Reels soignés par mois
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Questions */}
      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 pb-24 sm:px-8 lg:grid-cols-[1fr_1.6fr]">
        <SectionTitle n={5} kicker="Questions">
          Ce qu’on nous <span className="accent">demande.</span>
        </SectionTitle>
        <div className="flex flex-col border-t border-ink/12">
          {faq.map(([q, a]) => (
            <details key={q} className="group border-b border-ink/12 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold [&::-webkit-details-marker]:hidden">
                {fr(q)}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-lg leading-none text-ink transition-transform duration-300 ease-[var(--ease-fauve)] group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[640px] text-[15.5px] leading-relaxed text-muted">{fr(a)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* To read next */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <span className="mb-4 block text-[12px] font-bold tracking-[0.16em] text-muted uppercase">À lire aussi</span>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ...trade.guides.flatMap((slug) => {
              const g = guideBySlug(slug);
              return g ? [[`/guides/${g.slug}`, "Guide", g.title] as const] : [];
            }),
            [`/comparatif/${COMPARISONS[0]!.slug}`, "Comparer", COMPARISONS[0]!.h1] as const,
          ].map(([href, kind, title]) => (
            <Link key={href} href={href} className="flex flex-col gap-2 rounded-[22px] border border-ink/10 p-6 transition-colors hover:border-ink/30">
              <span className="text-[12px] font-bold tracking-[0.16em] text-violet uppercase">{kind}</span>
              <span className="text-[18px] leading-snug font-bold">{fr(title)}</span>
            </Link>
          ))}
        </div>
      </section>

      <LastCall waUrl={waUrl} line="Dis-lui ce que tu fais : dans cinq minutes, il te montre ce qu’il ferait pour toi.">
        Tes vidéos sont déjà là. <span className="font-[family-name:var(--font-serif)] font-normal tracking-[-0.01em] text-lilac italic">Edith en fait des Reels.</span>
      </LastCall>
    </main>
  );
}
