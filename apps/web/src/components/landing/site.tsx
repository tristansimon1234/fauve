import Link from "next/link";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { fr, frNodes } from "@/components/landing/fr";
import { Mascot } from "@/components/mascot";
import { Logo } from "@/components/orb";
import { COMPARISONS } from "@/content/comparatifs";
import { GUIDES } from "@/content/guides";
import { TRADES } from "@/content/metiers";
import { SITE_URL } from "@/lib/site";

// What the landing and the pages around it share (trades, guides, comparisons): the header, the
// footer that links them all, the button to start and the magazine section titles.

/**
 * Whether the site lets anyone in. Closed while WhatsApp and Instagram are set up again on the new
 * Meta account (Tristan: « enlève le bouton d'accès pour l'instant… rien n'est branché »): no
 * « Commencer » nor « Se connecter », a « Bientôt disponible » in place of the big buttons.
 */
export const OPEN = false;

/** Getting started: in the app on a computer (a code sent from the phone), on WhatsApp on a phone. */
export function Start({ waUrl, size, light = false }: { waUrl: string; size: "sm" | "lg"; light?: boolean }) {
  if (!OPEN) {
    if (size === "sm") return null;
    return (
      <span className={`inline-flex h-14 items-center rounded-full px-7 text-base font-bold ${light ? "bg-white/10 text-white" : "bg-violet-soft text-violet"}`}>
        Bientôt disponible
      </span>
    );
  }
  const look = `${size === "lg" ? "h-14 px-7 text-base" : "h-11 px-5"} ${light ? "bg-white text-ink hover:bg-soft" : "btn-primary"}`;
  return (
    <>
      <Link href="/commencer" className={`btn hidden md:inline-flex ${look}`}>
        Commencer
      </Link>
      <a href={waUrl} className={`btn md:hidden ${look}`}>
        <WhatsAppIcon size={size === "lg" ? 20 : 18} />
        {size === "lg" ? "Commencer sur WhatsApp" : "Essayer"}
      </a>
    </>
  );
}

/** A section's title, numbered like a magazine's pages: N° 01, a hairline, its name, then the line. */
export function SectionTitle({ n, kicker, children, as: Tag = "h2" }: { n?: number; kicker: string; children: ReactNode; as?: "h1" | "h2" }) {
  return (
    <div className="flex flex-col gap-4">
      <span className="flex items-center gap-3 text-[12px] font-bold tracking-[0.16em] text-muted uppercase">
        {n !== undefined && <span className="font-[family-name:var(--font-serif)] text-[17px] font-normal tracking-normal text-ink normal-case italic">N° {String(n).padStart(2, "0")}</span>}
        <span className="h-px w-8 bg-ink/25" />
        {fr(kicker)}
      </span>
      <Tag className="max-w-[860px] text-[clamp(34px,4.4vw,58px)] leading-[1.02] font-extrabold tracking-[-0.04em]">{frNodes(children)}</Tag>
    </div>
  );
}

/** The last call, on ink: one promise, one line, the button. */
export function LastCall({ waUrl, children, line }: { waUrl: string; children: ReactNode; line: string }) {
  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-8">
      <div className="land-reveal relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-[32px] bg-ink px-6 py-16 text-center text-white sm:py-20">
        <span className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 size-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(91,63,217,.55),transparent_65%)]" aria-hidden="true" />
        <Mascot size={92} mood="happy" />
        <h2 className="max-w-[760px] text-[clamp(34px,5vw,64px)] leading-[1.02] font-extrabold tracking-[-0.04em]">{frNodes(children)}</h2>
        <p className="max-w-[460px] text-[16px] text-white/70">{fr(line)}</p>
        <Start waUrl={waUrl} size="lg" light />
      </div>
    </section>
  );
}

/** The header: on the landing its links scroll the page, elsewhere they lead back to it. */
export function SiteHeader({ waUrl, home = false }: { waUrl: string; home?: boolean }) {
  const at = (hash: string) => (home ? hash : `/${hash}`);
  return (
    <header className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-5 sm:px-8 sm:py-6">
      <Link href="/" aria-label="Edith, accueil">
        <Logo />
      </Link>
      <nav className="flex items-center gap-7">
        {[
          [at("#travail"), "Ses Reels"],
          [at("#cringe"), "Zéro cringe"],
          [at("#comment"), "Comment ça marche"],
          [at("#tarif"), "Tarif"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="hidden text-[14.5px] font-semibold text-ink/80 transition-colors hover:text-ink lg:inline">
            {label}
          </a>
        ))}
        {!home && (
          <Link href="/guides" className="hidden text-[14.5px] font-semibold text-ink/80 transition-colors hover:text-ink lg:inline">
            Guides
          </Link>
        )}
        {OPEN && (
          <Link href="/commencer?connexion" className="hidden text-[14.5px] font-semibold md:inline">
            Se connecter
          </Link>
        )}
        <Start waUrl={waUrl} size="sm" />
      </nav>
    </header>
  );
}

/** The footer: every page of the site, so each one is a click away (and found by search engines). */
export function SiteFooter() {
  const column = (title: string, links: [string, string][]) => (
    <div className="flex min-w-0 flex-col gap-2.5">
      <span className="text-[12px] font-bold tracking-[0.16em] text-ink uppercase">{title}</span>
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="text-[14.5px] text-muted transition-colors hover:text-ink">
          {fr(label)}
        </Link>
      ))}
    </div>
  );
  return (
    <footer className="mx-auto max-w-[1240px] px-4 pb-10 sm:px-8">
      <div className="grid gap-10 border-t border-ink/12 pt-10 sm:grid-cols-3">
        {column(
          "Par métier",
          TRADES.map((t) => [`/community-manager/${t.slug}`, t.menu]),
        )}
        {column("Guides", [["/guides", "Tous les guides"], ...GUIDES.map((g): [string, string] => [`/guides/${g.slug}`, g.h1])])}
        {column(
          "Comparer",
          COMPARISONS.map((c) => [`/comparatif/${c.slug}`, c.menu]),
        )}
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-muted">
        <span>© Edith</span>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/conditions">Conditions d’utilisation</Link>
        <Link href="/suppression-des-donnees">Suppression des données</Link>
        <Link href="/mentions-legales">Mentions légales</Link>
        {OPEN && <Link href="/connexion">Se connecter</Link>}
        <span className="font-normal">Vidéos d’exemple : Mixkit · Photos : Unsplash</span>
      </div>
    </footer>
  );
}

/** Structured data for search engines and AI assistants, escaped so no text can close the script. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** The trail from the home page, for search results. */
export const breadcrumb = (items: [string, string][]) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${path}` })),
});

/** The FAQ as search engines read it. */
export const faqPage = (faq: [string, string][]) => ({
  "@type": "FAQPage",
  mainEntity: faq.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
});
