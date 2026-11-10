import { pickKindSchema } from "@fauve/agent";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageSuspense } from "@/components/page-suspense";
import { pickableMedia } from "@/lib/media-pick";
import { getStudioContext } from "@/lib/studio";
import { PickView } from "./pick-view";

export const metadata: Metadata = { title: "Choisis tes fichiers" };
// Her pick is given to Edith, who answers on WhatsApp after the page has its answer.
export const maxDuration = 300;

// « Choisir mes fichiers » from WhatsApp (reply_with pick_media; docs/whatsapp.md): her médiathèque on her phone,
// most recent first, to tick in the order of her Reel; « Valider » gives her pick back to the conversation.
// Her studio's files only, behind signed links.

export default function PickPage({ searchParams }: PageProps<"/choisir">) {
  return (
    <PageSuspense title="Choisis tes fichiers" skeleton={<div className="flex min-h-dvh items-center justify-center bg-ink text-white/60">Chargement…</div>}>
      <Pick searchParams={searchParams} />
    </PageSuspense>
  );
}

async function Pick({ searchParams }: { searchParams: PageProps<"/choisir">["searchParams"] }) {
  const { type } = await searchParams;
  const kind = pickKindSchema.catch("any").parse(type);
  const { db, member } = await getStudioContext();
  if (!member) redirect(`/connexion?next=${encodeURIComponent(kind === "any" ? "/choisir" : `/choisir?type=${kind}`)}`);
  const items = await pickableMedia(db, member.studio.id, kind, member.studio.timezone);
  return <PickView kind={kind} items={items} />;
}
