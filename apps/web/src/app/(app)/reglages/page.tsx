import type { Metadata } from "next";
import Link from "next/link";
import { InstagramIcon, TikTokIcon } from "@/components/icons";
import { demoStudio } from "@/lib/demo";

export const metadata: Metadata = { title: "Réglages" };

export default function SettingsPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Réglages</h1>
      <div className="flex max-w-[640px] flex-col gap-4">
        <Section title="Comptes connectés">
          <Row icon={<InstagramIcon size={18} />} label={`@${demoStudio.instagram}`} detail="Instagram connecté" />
          <Row icon={<TikTokIcon size={18} />} label={`@${demoStudio.tiktok}`} detail="TikTok connecté" />
          <Link href="/connect" className="btn btn-secondary mt-1 self-start">
            Gérer les connexions
          </Link>
        </Section>
        <Section title="Rythme">
          <p className="text-sm">
            {demoStudio.postsPerWeek} posts et {demoStudio.storiesPerWeek} stories par semaine. Demande à Mila pour le
            changer.
          </p>
        </Section>
        <Section title="Abonnement">
          <p className="text-sm">49 € / mois, sans engagement.</p>
        </Section>
      </div>
    </main>
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

function Row({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-violet-soft text-violet">{icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-[13px] text-muted">{detail}</span>
      </span>
    </div>
  );
}
