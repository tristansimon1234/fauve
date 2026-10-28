import Link from "next/link";
import { Logo } from "@/components/orb";
import { company } from "@/lib/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-soft">
      <header className="mx-auto flex max-w-[760px] items-center justify-between px-4 py-6 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-[760px] px-4 pb-20 sm:px-8">
        <article className="legal flex flex-col gap-4 rounded-[22px] border border-line bg-white p-6 text-[15px] leading-relaxed sm:p-10">
          {children}
          <p className="mt-6 text-sm text-muted">Dernière mise à jour : {company.updatedAt}</p>
        </article>
        <nav className="mt-6 flex flex-wrap gap-5 text-sm font-semibold text-muted">
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/conditions">Conditions d’utilisation et de vente</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/suppression-des-donnees">Suppression des données</Link>
        </nav>
      </main>
    </div>
  );
}
