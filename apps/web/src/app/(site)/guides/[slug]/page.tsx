import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fr } from "@/components/landing/fr";
import { Prose } from "@/components/landing/prose";
import { breadcrumb, JsonLd, LastCall } from "@/components/landing/site";
import { day, GUIDES, guideBySlug } from "@/content/guides";
import { tradeBySlug } from "@/content/metiers";
import { whatsappLink } from "@/lib/public-env";
import { SITE_URL } from "@/lib/site";

// A guide (/guides/idees-reels-restaurant…), written by hand in content/guides.ts.

// Every real page is prerendered from generateStaticParams; only an unknown address reads its
// params at request time, and it ends in a 404.
export const instant = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: { type: "article", siteName: "Edith", locale: "fr_FR", url: path, title: guide.title, description: guide.description, publishedTime: guide.published, modifiedTime: guide.updated ?? guide.published },
  };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const trade = tradeBySlug(guide.trade);
  const others = GUIDES.filter((g) => g.slug !== guide.slug);
  const path = `/guides/${guide.slug}`;

  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: guide.title,
              description: guide.description,
              inLanguage: "fr",
              datePublished: guide.published,
              dateModified: guide.updated ?? guide.published,
              mainEntityOfPage: `${SITE_URL}${path}`,
              image: `${SITE_URL}/opengraph-image`,
              author: { "@type": "Organization", name: "Edith", url: SITE_URL },
              publisher: { "@type": "Organization", name: "Edith", url: SITE_URL },
            },
            breadcrumb([
              ["Edith", "/"],
              ["Guides", "/guides"],
              [guide.h1, path],
            ]),
          ],
        }}
      />
      <article className="mx-auto max-w-[760px] px-4 pt-8 pb-20 sm:px-8 sm:pt-12">
        <nav aria-label="Fil d’Ariane" className="text-[13px] font-semibold text-muted">
          <Link href="/" className="hover:text-ink">
            Edith
          </Link>
          <span className="mx-2 text-ink/30">/</span>
          <Link href="/guides" className="hover:text-ink">
            Guides
          </Link>
        </nav>
        <span className="mt-8 flex items-center gap-3 text-[12px] font-bold tracking-[0.16em] text-muted uppercase">
          <span className="h-px w-8 bg-ink/30" />
          {fr(guide.kicker)}
        </span>
        <h1 className="mt-5 text-[clamp(36px,5vw,60px)] leading-[1.02] font-extrabold tracking-[-0.045em]">
          {fr(guide.h1)}
          {guide.accent && <span className="mt-1 block font-[family-name:var(--font-serif)] text-[1.05em] leading-[1] font-normal tracking-[-0.02em] text-violet italic">{fr(guide.accent)}</span>}
        </h1>
        <p className="mt-5 text-[14px] font-semibold text-muted">
          <time dateTime={guide.published}>{day(guide.published)}</time> · {guide.minutes}&nbsp;min de lecture
        </p>
        <p className="mt-8 text-[20px] leading-[1.6] text-ink">{fr(guide.intro)}</p>
        <div className="mt-6">
          <Prose blocks={guide.blocks} />
        </div>

        {trade && (
          <Link href={`/community-manager/${trade.slug}`} className="mt-14 flex flex-col gap-2 rounded-[22px] bg-white p-7 transition-shadow hover:shadow-[0_24px_50px_-28px_rgba(28,21,48,.35)]">
            <span className="text-[12px] font-bold tracking-[0.16em] text-violet uppercase">{fr(trade.menu)}</span>
            <span className="text-[22px] leading-snug font-extrabold tracking-[-0.02em]">{fr(`${trade.h1} ${trade.accent}`)}</span>
            <span className="text-[15px] text-muted">{fr("Voir ce qu’Edith fait pour ton métier →")}</span>
          </Link>
        )}

        {others.length > 0 && (
          <div className="mt-14">
            <span className="mb-3 block text-[12px] font-bold tracking-[0.16em] text-muted uppercase">Autres guides</span>
            <div className="flex flex-col border-t border-ink/12">
              {others.map((g) => (
                <Link key={g.slug} href={`/guides/${g.slug}`} className="border-b border-ink/12 py-4 text-[18px] font-bold transition-colors hover:text-violet">
                  {fr(g.title)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      <LastCall waUrl={whatsappLink()} line="Tu filmes, Edith monte, écrit la légende et attend ton oui pour publier.">
        Pas le temps de tout ça ? <span className="font-[family-name:var(--font-serif)] font-normal tracking-[-0.01em] text-lilac italic">Edith s’en occupe.</span>
      </LastCall>
    </main>
  );
}
