import type { Metadata } from "next";
import { after } from "next/server";
import { NoStudio } from "@/components/empty-state";
import { PageSuspense } from "@/components/page-suspense";
import { getStudioContext } from "@/lib/studio";
import { refreshTrendSounds, soundsStale, trendSounds } from "@/lib/trend-sounds";
import { SoundsSection } from "./sounds";

export const metadata: Metadata = { title: "Sons" };

// The trending sounds (Tristan: « une bibliothèque de sons tendances », then « la page tendance […] les sons oui le
// reste des foireux »): TikTok's charts found on Instagram, any sound by name, each one to listen to and to cut a Reel
// on (lib/trend-sounds.ts). Made again each Monday, or after the page is sent when last week's.
export default function SoundsPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <PageSuspense title="Sons">
        <Sounds />
      </PageSuspense>
    </main>
  );
}

async function Sounds() {
  const { member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const sounds = await trendSounds();
  if (soundsStale(sounds.chartedAt)) after(() => refreshTrendSounds().catch((e: unknown) => console.error("sounds: refresh failed", e)));
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[44px] leading-[0.95] font-semibold tracking-[-0.05em] sm:text-[60px]">Sons</h1>
        <p className="max-w-[640px] text-[15px] text-muted">Les sons qui montent en ce moment, et tous ceux d’Instagram par leur titre. Écoute, choisis, et ton Reel est coupé sur ses temps. Mis à jour chaque semaine.</p>
      </div>
      <SoundsSection sounds={sounds.sounds} timezone={member.studio.timezone} />
    </>
  );
}
