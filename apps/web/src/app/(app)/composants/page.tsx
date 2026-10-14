import type { Metadata } from "next";
import { Suspense } from "react";
import { resolveReelBrand } from "@fauve/agent";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { SettingsTabs } from "@/components/settings-tabs";
import { listElements } from "@/lib/elements";
import { loadMontageInputs } from "@/lib/render/render-post";
import { getStudioContext } from "@/lib/studio";
import { runningJobs } from "@/lib/studio-jobs";
import { ComponentsBank } from "./components-bank";

export const metadata: Metadata = { title: "Composants" };

export default function ComponentsPage({ searchParams }: { searchParams: Promise<{ kit?: string }> }) {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <SettingsTabs current="/composants" />
      <Suspense fallback={<PageLoading title="Composants" />}>
        <Bank searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Bank({ searchParams }: { searchParams: Promise<{ kit?: string }> }) {
  const { member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;
  const [elements, inputs, jobs, { kit }] = await Promise.all([
    listElements(studioId),
    loadMontageInputs(studioId, { segments: [] }),
    runningJobs(studioId, { kind: "elements" }),
    searchParams,
  ]);
  const brand = resolveReelBrand({}, "doux", { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts, customFonts: inputs.customFonts });
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
