import { PageSuspense } from "@/components/page-suspense";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { jobStepLabel, resolveReelBrand } from "@fauve/agent";
import { ArrowLeftIcon } from "@/components/icons";
import { NoStudio } from "@/components/empty-state";
import { loadElement, postsUsingElement } from "@/lib/elements";
import { loadMontageInputs } from "@/lib/render/render-post";
import { getStudioContext } from "@/lib/studio";
import { runningJobs } from "@/lib/studio-jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ComponentStudio } from "./component-studio";

export const metadata: Metadata = { title: "Élément pour photos" };

export default function ComponentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="flex min-w-0 flex-col gap-5 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <Link href="/style" className="inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon size={16} />
        Ton style
      </Link>
      <PageSuspense title="Composant">
        <Component params={params} />
      </PageSuspense>
    </main>
  );
}

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin().storage.from("media").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

async function Component({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;
  const element = /^[0-9a-f-]{36}$/.test(id) ? await loadElement(studioId, id) : null;
  if (!element) notFound();

  const db = supabaseAdmin();
  const [inputs, posts, [running], photo] = await Promise.all([
    loadMontageInputs(studioId, { segments: [] }),
    postsUsingElement(studioId, id),
    runningJobs(studioId, { templateId: id, kind: "elements" }),
    // The studio's latest photo, to see the component on something real.
    db.from("media_assets").select("storage_path, mime_type").eq("studio_id", studioId).eq("kind", "image").order("created_at", { ascending: false }).limit(1),
  ]);
  const brand = resolveReelBrand({}, "doux", { name: inputs.studioName, accent: inputs.accent, logoUrl: inputs.logoUrl, fonts: inputs.fonts, colors: inputs.colors, customFonts: inputs.customFonts });
  const photoPath = photo.data?.[0]?.storage_path as string | undefined;
  const [photoUrl, exampleUrl] = await Promise.all([signed(photoPath), signed(element.examplePath)]);

  return (
    <ComponentStudio
      key={element.updatedAt}
      studioId={studioId}
      brand={brand}
      photoUrl={photoUrl}
      exampleUrl={exampleUrl}
      element={{
        id: element.id,
        name: element.name,
        role: element.role,
        slots: element.slots,
        js: element.js,
        fonts: element.fonts,
        base: element.base,
        box: element.box,
        sample: element.sample,
        kitName: element.kitName,
        note: element.description,
        updatedAt: element.updatedAt,
      }}
      history={element.history.map((v) => ({ name: v.name, js: v.js, fonts: v.fonts, base: v.base, sample: v.sample, at: v.at }))}
      posts={posts}
      running={running ? { stage: jobStepLabel(running.kind, running.stage), since: running.startedAt } : null}
    />
  );
}
