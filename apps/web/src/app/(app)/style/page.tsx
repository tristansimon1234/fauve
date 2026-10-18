import { PageSuspense } from "@/components/page-suspense";
import type { Metadata } from "next";
import { NoStudio } from "@/components/empty-state";
import { followedOf } from "@fauve/agent";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { sanitizeProfile, toStyleForm } from "./style-profile";
import { fauveAccount } from "@/lib/instagram-dm";
import { InspirationsSection, type Inspiration } from "./inspirations-section";
import { StyleEditor } from "./style-editor";
import type { Logo, MoodboardView } from "./style-options";
import { SettingsTabs } from "@/components/settings-tabs";

export const metadata: Metadata = { title: "Style" };
// Reading a moodboard (Fauve looks at every image) can take a minute; a Reel added to the
// inspirations is taken, measured and read after the answer (« Steal »), up to a few minutes.
export const maxDuration = 300;

export default function StylePage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 sm:px-10 sm:pt-9">
      <SettingsTabs current="/style" />
      <PageSuspense title="Style">
        <StyleLoader />
      </PageSuspense>
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

  const moodboardItems = profile.moodboard?.items ?? [];
  const moodboardUrls = await signMediaUrls(db, studioId, moodboardItems.map((item) => item.path));
  const moodboard: MoodboardView = {
    items: moodboardItems.flatMap((item) => {
      const url = moodboardUrls.get(item.path);
      return url ? [{ path: item.path, url, note: item.note ?? "" }] : [];
    }),
    reading: profile.moodboard?.reading ?? null,
    palette: profile.moodboard?.palette ?? [],
  };


  // Her own font files, signed to draw them on the page.
  const fontFiles = (profile.custom_fonts ?? []).filter((f) => f.path.startsWith(`${studioId}/`));
  const fontUrls = await signMediaUrls(db, studioId, fontFiles.map((f) => f.path));
  const ownFonts = fontFiles.flatMap((f) => {
    const url = fontUrls.get(f.path);
    return url ? [{ family: f.family, path: f.path, url }] : [];
  });

  const [{ data: shared }, fauve] = await Promise.all([
    db.from("inspirations").select("id, title, url, analysis, storage_path, created_at, styled:style->look->>name").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(12),
    fauveAccount(),
  ]);
  // The Reel whose style her Reels follow (« Steal »).
  const followed = followedOf(data?.profile)?.inspiration_id ?? null;
  const inspirations: Inspiration[] = (shared ?? []).map((i) => ({
    id: i.id as string,
    title: (i.title as string | null) ?? null,
    url: (i.url as string | null) ?? null,
    analysis: (i.analysis as string | null) ?? null,
    at: i.created_at as string,
    reading: !i.analysis && Boolean(i.storage_path),
    styled: Boolean(i.styled),
    followed: i.id === followed,
  }));

  return (
    <StyleEditor
      inspirations={<InspirationsSection items={inspirations} fauveHandle={fauve?.username ?? null} studioId={studioId} />}
      moodboard={moodboard}
      studioId={studioId}
      studioName={member.studio.name ?? "Ton studio"}
      initial={toStyleForm(profile)}
      version={(data?.version as number | undefined) ?? null}
      logo={logo}
      ownFonts={ownFonts}
    />
  );
}
