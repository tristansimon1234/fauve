import { PageSuspense } from "@/components/page-suspense";
import { NoStudio } from "@/components/empty-state";
import { loadGrid, loadTikTokGrid, profileIdentity } from "@/lib/grid";
import { getStudioContext } from "@/lib/studio";
import { CreatePostButton } from "./create-post-button";
import { GridView } from "./grid-view";

// The studio's Instagram grid, its own page in the menu: the profile as followers
// see it, the coming publications where they will land, and a button to make one.
export default function GridPage() {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-9">
      <PageSuspense title="Grille">
        <Grid />
      </PageSuspense>
    </main>
  );
}

async function Grid() {
  const { db, member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const [grid, tiktok, identity] = await Promise.all([loadGrid(db, member.studio.id), loadTikTokGrid(db, member.studio.id), profileIdentity(db, member.studio.id)]);
  return (
    <GridView
      aside={
        <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-col lg:items-start">
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">Grille</h1>
          <CreatePostButton timezone={member.studio.timezone} />
        </div>
      }
      identity={identity}
      connected={grid.connected}
      handle={grid.handle}
      info={grid.info}
      tiles={grid.tiles}
      timezone={member.studio.timezone}
      tiktok={tiktok}
    />
  );
}
