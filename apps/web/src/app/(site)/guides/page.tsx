import type { Metadata } from "next";
import Link from "next/link";
import { fr } from "@/components/landing/fr";
import { breadcrumb, JsonLd, SectionTitle } from "@/components/landing/site";
import { day, GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Guides Instagram et TikTok pour les commerces",
  description: "Idées de Reels, légendes, ce qui fait venir des clients : des guides concrets pour les commerces de quartier et les indépendants.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const guides = [...GUIDES].sort((a, b) => b.published.localeCompare(a.published));
  return (
    <main className="mx-auto max-w-[1240px] px-4 pt-8 pb-24 sm:px-8 sm:pt-12">
      <JsonLd data={{ "@context": "https://schema.org", ...breadcrumb([["Edith", "/"], ["Guides", "/guides"]]) }} />
      <SectionTitle kicker="Guides" as="h1">
        Instagram et TikTok, <span className="accent">pour ceux qui ont un métier.</span>
      </SectionTitle>
      <p className="mt-6 max-w-[620px] text-[18px] leading-[1.6] text-muted">{fr("Des guides concrets pour les commerces et les indépendants : quoi filmer, quoi écrire, ce qui fait venir des clients.")}</p>
      <div className="mt-12 flex flex-col border-t border-ink/12">
        {guides.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="group grid gap-2 border-b border-ink/12 py-7 md:grid-cols-[180px_1fr] md:gap-8">
            <span className="text-[13px] font-semibold text-muted">
              {fr(g.kicker)} · {day(g.published)}
            </span>
            <span className="flex flex-col gap-2">
              <span className="text-[clamp(22px,2.6vw,30px)] leading-[1.15] font-extrabold tracking-[-0.03em] transition-colors group-hover:text-violet">{fr(g.title)}</span>
              <span className="max-w-[720px] text-[15.5px] leading-[1.6] text-muted">{fr(g.description)}</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
