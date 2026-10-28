import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import { fr } from "@/components/landing/fr";
import { breadcrumb, faqPage, JsonLd, LastCall, SectionTitle } from "@/components/landing/site";
import { COMPARISONS, comparisonBySlug } from "@/content/comparatifs";
import { whatsappLink } from "@/lib/public-env";

// A comparison (/comparatif/community-manager-freelance…), fair to the other side: content in
// content/comparatifs.ts.

// Every real page is prerendered from generateStaticParams; only an unknown address reads its
// params at request time, and it ends in a 404.
export const instant = false;

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/comparatif/[slug]">): Promise<Metadata> {
  const c = comparisonBySlug((await params).slug);
  if (!c) return {};
  const path = `/comparatif/${c.slug}`;
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "Edith", locale: "fr_FR", url: path, title: c.h1, description: c.description },
  };
}

export default async function ComparisonPage({ params }: PageProps<"/comparatif/[slug]">) {
  const c = comparisonBySlug((await params).slug);
  if (!c) notFound();
  const path = `/comparatif/${c.slug}`;
  const others = COMPARISONS.filter((o) => o.slug !== c.slug);

  return (
    <main>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [breadcrumb([["Edith", "/"], [c.h1, path]]), faqPage(c.faq)] }} />

      <section className="mx-auto flex max-w-[1240px] flex-col gap-7 px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
        <nav aria-label="Fil d’Ariane" className="text-[13px] font-semibold text-muted">
          <Link href="/" className="hover:text-ink">
            Edith
          </Link>
          <span className="mx-2 text-ink/30">/</span>
          Comparatif
        </nav>
        <h1 className="max-w-[900px] text-[clamp(38px,5.2vw,72px)] leading-[1] font-extrabold tracking-[-0.045em]">
          {fr(c.h1)}
          <span className="mt-1 block font-[family-name:var(--font-serif)] text-[1.1em] leading-[0.98] font-normal tracking-[-0.02em] text-violet italic">{fr(c.accent)}</span>
        </h1>
        <p className="max-w-[660px] text-[18px] leading-[1.6] text-muted sm:text-[19px]">{fr(c.intro)}</p>
      </section>

      {/* Side by side */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <div className="overflow-x-auto rounded-[22px] bg-white">
          <table className="w-full min-w-[620px] border-collapse text-left text-[15.5px]">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="w-[22%] px-6 py-5" />
                <th scope="col" className="px-6 py-5 text-[12px] font-bold tracking-[0.16em] text-muted uppercase">
                  {c.other}
                </th>
                <th scope="col" className="px-6 py-5 text-[12px] font-bold tracking-[0.16em] text-violet uppercase">
                  Edith
                </th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map(([label, other, edith]) => (
                <tr key={label} className="border-b border-ink/10 last:border-0">
                  <th scope="row" className="px-6 py-5 align-top font-bold">
                    {fr(label)}
                  </th>
                  <td className="px-6 py-5 align-top text-muted">{fr(other)}</td>
                  <td className="px-6 py-5 align-top text-ink">{fr(edith)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* When to choose which */}
      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <SectionTitle n={1} kicker="Que choisir">
          Chacun son cas, <span className="accent">honnêtement.</span>
        </SectionTitle>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {(
            [
              [c.otherChoice, c.otherWins, false],
              ["Choisis Edith si…", c.edithWins, true],
            ] as const
          ).map(([title, items, ours]) => (
            <div key={title} className={`flex flex-col gap-4 rounded-[22px] p-7 ${ours ? "bg-ink text-white" : "bg-white"}`}>
              <h3 className="text-[22px] font-extrabold tracking-[-0.02em]">{fr(title)}</h3>
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li key={item} className={`flex gap-3 text-[15.5px] leading-[1.55] ${ours ? "text-white/80" : "text-muted"}`}>
                    <span className={`mt-1 shrink-0 ${ours ? "text-lilac" : "text-violet"}`}>
                      <CheckIcon size={15} />
                    </span>
                    {fr(item)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {c.together && <p className="mt-8 max-w-[720px] font-[family-name:var(--font-serif)] text-[24px] leading-[1.35] text-ink italic">{fr(c.together)}</p>}
      </section>

      {/* Questions */}
      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 pb-24 sm:px-8 lg:grid-cols-[1fr_1.6fr]">
        <SectionTitle n={2} kicker="Questions">
          Ce qu’on nous <span className="accent">demande.</span>
        </SectionTitle>
        <div className="flex flex-col border-t border-ink/12">
          {c.faq.map(([q, a]) => (
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

      <section className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        <span className="mb-4 block text-[12px] font-bold tracking-[0.16em] text-muted uppercase">Autres comparatifs</span>
        <div className="grid gap-4 md:grid-cols-2">
          {others.map((o) => (
            <Link key={o.slug} href={`/comparatif/${o.slug}`} className="rounded-[22px] border border-ink/10 p-6 text-[18px] font-bold transition-colors hover:border-ink/30">
              {fr(o.h1)}
            </Link>
          ))}
        </div>
      </section>

      <LastCall waUrl={whatsappLink()} line="Dis-lui ce que tu fais : dans cinq minutes, il te montre ce qu’il ferait pour toi.">
        Tes vidéos sont déjà là. <span className="font-[family-name:var(--font-serif)] font-normal tracking-[-0.01em] text-lilac italic">Edith en fait des Reels.</span>
      </LastCall>
    </main>
  );
}
