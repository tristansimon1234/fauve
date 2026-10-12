import type { Metadata } from "next";
import { Suspense } from "react";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { sanitizeProfile, toStyleForm } from "./style-profile";
import { StyleEditor } from "./style-editor";
import type { Logo } from "./style-options";

export const metadata: Metadata = { title: "Style" };

export default function StylePage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 sm:px-10 sm:pt-9">
      <Suspense fallback={<PageLoading title="Style" />}>
        <StyleLoader />
      </Suspense>
    </main>
  );
}

async function StyleLoader() {
  const { db, member } = await getStudioContext();
  if (!member) {
    return (
      <>
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Style</h1>
        <NoStudio />
      </>
    );
  }
  const studioId = member.studio.id;

  const { data, error } = await db
    .from("brand_profiles")
    .select("version, profile")
    .eq("studio_id", studioId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`brand_profiles: ${error.message}`);

  const profile = sanitizeProfile(data?.profile);
  let logo: Logo = null;
  if (profile.logo_path) {
    // signMediaUrls only signs paths under the studio's own folder.
    const url = (await signMediaUrls(db, studioId, [profile.logo_path])).get(profile.logo_path);
    if (url) logo = { url, source: "upload" };
  } else if (profile.logo_url && /^https:\/\//i.test(profile.logo_url)) {
    logo = { url: profile.logo_url, source: "website" };
  }

  return (
    <StyleEditor
      studioId={studioId}
      studioName={member.studio.name ?? "Ton studio"}
      initial={toStyleForm(profile)}
      version={(data?.version as number | undefined) ?? null}
      logo={logo}
    />
  );
}
