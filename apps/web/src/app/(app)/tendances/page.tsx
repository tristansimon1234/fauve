import { trendChangesLeft, trendQueryOf } from "@fauve/agent";
import type { Metadata } from "next";
import { after } from "next/server";
import { NoStudio } from "@/components/empty-state";
import { PageSuspense } from "@/components/page-suspense";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { anyStale, lastSearched, monthIn, refreshTrends, trendCards } from "@/lib/trends";
import { TrendQuery, TrendsGrid } from "./trends-grid";

export const metadata: Metadata = { title: "Tendances" };

// What works right now in her trade, on TikTok and Instagram (Tristan: « une page tendance, où tu
// vois des vidéos qui fonctionnent »), searched each week (lib/trends.ts); « Fais-en un comme ça »
// opens Créer with the video as the Reel to copy.
export default function TrendsPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <PageSuspense title="Tendances">
        <Trends />
      </PageSuspense>
    </main>
  );
}

async function Trends() {
  const { member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const { data } = await supabaseAdmin().from("studios").select("trend_query, business_type, trend_query_month, trend_query_changes").eq("id", member.studio.id).maybeSingle();
  const own = (data?.trend_query as string | null) ?? null;
  const query = trendQueryOf(own, data?.business_type as string | null);
  const left = trendChangesLeft({ month: (data?.trend_query_month as string | null) ?? null, changes: Number(data?.trend_query_changes ?? 0) }, monthIn(member.studio.timezone));

  if (!query) {
    return (
      <>
        <Header />
        <TrendQuery query={null} left={left} />
      </>
    );
  }

  const [lists, last] = await Promise.all([trendCards(query), lastSearched(query)]);
  // Never searched, or last week's: searched again now, after the page is sent.
  const stale = anyStale(last);
  if (stale) after(() => refreshTrends(query).catch((e: unknown) => console.error("trends: refresh failed", query, e)));

  return (
    <>
      <Header />
      <TrendQuery query={query} left={left} />
      <TrendsGrid lists={lists} searching={(stale || last.running) && !lists.trend.length && !lists.beau.length && !lists.local.length} timezone={member.studio.timezone} />
    </>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Tendances</h1>
      <p className="text-[15px] text-muted">Les vidéos les plus vues de ton métier ce mois-ci, partout et près de chez toi, sur TikTok et Instagram. Mis à jour chaque semaine.</p>
    </div>
  );
}
