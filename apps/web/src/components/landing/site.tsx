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
      <span className={`inline-flex h-14 items-center border px-7 text-base font-semibold ${light ? "border-white/40 text-white" : "border-ink text-ink"}`}>
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

/** A section's title, numbered like a magazine's pages: a hairline across, « N° 01 — Le travail » in mono, then the line in big type. */
export function SectionTitle({ n, kicker, children, as: Tag = "h2" }: { n?: number; kicker: string; children: ReactNode; as?: "h1" | "h2" }) {
  return (
    <div className="flex flex-col gap-6 border-t border-ink pt-4">
      <span className="mono-label flex items-center justify-between gap-3 text-ink">
        <span>{fr(kicker)}</span>
        {n !== undefined && <span className="tabular-nums">N° {String(n).padStart(2, "0")}</span>}
      </span>
      <Tag className="max-w-[1100px] text-[clamp(40px,6.4vw,96px)] leading-[0.95] font-semibold tracking-[-0.055em]">{frNodes(children)}</Tag>
    </div>
  );
}

/** The last call: Edith's head in thin lines, one promise in the biggest type of the page, one line, the button. */
export function LastCall({ waUrl, children, line }: { waUrl: string; children: ReactNode; line: string }) {
  return (
    <section className="mx-auto max-w-[1360px] px-4 pb-20 sm:px-8">
      <div className="land-reveal flex flex-col items-start gap-8 border-t border-ink pt-10 sm:pt-14">
        <Mascot size={120} mood="happy" />
        <h2 className="max-w-[1200px] text-[clamp(48px,8.4vw,132px)] leading-[0.92] font-semibold tracking-[-0.06em]">{frNodes(children)}</h2>
        <div className="flex w-full flex-wrap items-end justify-between gap-6">
          <p className="max-w-[460px] text-[17px] leading-relaxed text-muted">{fr(line)}</p>
          <Start waUrl={waUrl} size="lg" />
        </div>
      </div>
    </section>
  );
}

/** The header: on the landing its links scroll the page, elsewhere they lead back to it. */
export function SiteHeader({ waUrl, home = false }: { waUrl: string; home?: boolean }) {
  const at = (hash: string) => (home ? hash : `/${hash}`);
  return (
    <header className="mx-auto flex max-w-[1360px] items-center justify-between gap-4 border-b border-ink/15 px-4 py-4 sm:px-8">
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
          <a key={href} href={href} className="mono-label hidden text-ink/70 transition-colors hover:text-ink lg:inline">
            {label}
          </a>
        ))}
        {!home && (
          <Link href="/guides" className="mono-label hidden text-ink/70 transition-colors hover:text-ink lg:inline">
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
      <span className="mono-label text-ink">{title}</span>
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="text-[14.5px] text-muted transition-colors hover:text-ink">
          {fr(label)}
        </Link>
      ))}
    </div>
  );
  return (
    <footer className="mx-auto max-w-[1360px] px-4 pb-10 sm:px-8">
      <div className="grid gap-10 border-t border-ink pt-8 sm:grid-cols-3">
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
      <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/15 pt-5 text-[13px] font-medium text-muted">
        <span>© Edith</span>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/conditions">Conditions d’utilisation</Link>
        <Link href="/sous-traitance">Traitement des données</Link>
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
