import { PageSuspense } from "@/components/page-suspense";
import type { Metadata } from "next";
import { resolveReelBrand } from "@fauve/agent";
import { NoStudio } from "@/components/empty-state";
import { SettingsTabs } from "@/components/settings-tabs";
import { listElements } from "@/lib/elements";
import { loadMontageInputs } from "@/lib/render/render-post";
import { getStudioContext } from "@/lib/studio";
import { runningJobs } from "@/lib/studio-jobs";
import { ComponentsBank } from "./components-bank";
import { TextStyles } from "./text-styles";
import { CreationsSection, type Creation } from "../mediatheque/creations-section";
import { loadTextLooks } from "@/lib/text-looks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Tes créations" };

type Tab = "styles" | "photos" | "animations";
const TABS: { id: Tab; label: string }[] = [
  { id: "styles", label: "Styles de texte" },
  { id: "photos", label: "Éléments pour photos" },
  { id: "animations", label: "Animations" },
];

// « Tes créations »: everything Simone made for the studio and keeps, in three tabs:
// text styles (with the brand they follow), elements for photos (the components) and
// animated scenes for Reels.
export default function CreationsPage({ searchParams }: { searchParams: Promise<{ kit?: string; onglet?: string }> }) {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <SettingsTabs current="/composants" />
      <PageSuspense title="Tes créations">
        <Creations searchParams={searchParams} />
      </PageSuspense>
    </main>
  );
}

async function Creations({ searchParams }: { searchParams: Promise<{ kit?: string; onglet?: string }> }) {
  const { member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;
  const { kit, onglet } = await searchParams;
  const tab: Tab = onglet === "styles" || onglet === "animations" ? onglet : kit ? "photos" : onglet === "photos" ? "photos" : "styles";
  const inputs = await loadMontageInputs(studioId, { segments: [] });
  const brand = resolveReelBrand({}, "doux", { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts, colors: inputs.colors, customFonts: inputs.customFonts });
  return (
    <>
      <div className="flex max-w-[680px] flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Tes créations</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Ce que Simone a créé pour toi et réutilise avec d’autres mots : plus vite, et sans crédit.
        </p>
      </div>
      <nav aria-label="Sortes de créations" className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/composants?onglet=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold ${tab === t.id ? "bg-ink text-white" : "bg-soft text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <ViewTransition key={tab} enter="fauve-fade-swap" exit="fauve-fade-swap" default="none">
      {tab === "styles" ? (
        <TextStyles brand={brand} colors={inputs.colors ?? []} saved={await loadTextLooks(studioId)} />
      ) : tab === "animations" ? (
        <CreationsSection scenes={await studioScenes(studioId)} brand={brand} />
      ) : (
        <Bank studioId={studioId} brand={brand} kit={kit} />
      )}
      </ViewTransition>
    </>
  );
}

/**
 * The studio's animated scenes, most used first; not those made with her photos or over
 * several shots, which only play in their Reel (drawn alone, they would show nothing).
 */
async function studioScenes(studioId: string): Promise<Creation[]> {
  const { data } = await supabaseAdmin()
    .from("motion_templates")
    .select("id, studio_id, name, js, fonts, uses")
    .eq("studio_id", studioId)
    .eq("kind", "scene")
    .or("role.is.null,role.not.in.(photo,layer)")
    .is("archived_at", null)
    .order("uses", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(48);
  return (data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    js: t.js as string,
    fonts: Array.isArray(t.fonts) ? (t.fonts as string[]) : [],
    uses: (t.uses as number) ?? 0,
    house: t.studio_id === null,
  }));
}

async function Bank({ studioId, brand, kit }: { studioId: string; brand: ReturnType<typeof resolveReelBrand>; kit?: string }) {
  const [elements, jobs] = await Promise.all([listElements(studioId), runningJobs(studioId, { kind: "elements" })]);
  return (
    <ComponentsBank
      studioId={studioId}
      brand={brand}
      // Only what the cards draw (not the source code).
      elements={elements.map(({ id, name, role, js, fonts, base, sample, kitId, kitName, uses, versions, updatedAt }) => ({ id, name, role, js, fonts, base, sample, kitId, kitName, uses, versions, updatedAt }))}
      creating={jobs.filter((j) => !j.templateId && !j.postId).length}
      highlight={kit ?? null}
    />
  );
}
