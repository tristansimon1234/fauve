import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageSuspense } from "@/components/page-suspense";
import { ideaCards, readOffer } from "@/lib/house-ideas";
import { getStudioContext } from "@/lib/studio";
import { IdeasView } from "./ideas-view";

export const metadata: Metadata = { title: "Des idées pour ton Reel" };

// « Regarde nos idées » from WhatsApp (docs/whatsapp.md): the 6 to 8 ideas of form Edith chose for her trade and the
// files of this Reel (idea_offers), each a looping preview full width; one tap, « C'est parti », and the Reel starts.
// Previews are never public: signed links, for her studio's members only.

export default function IdeasPage({ params }: PageProps<"/idees/[id]">) {
  return (
    <PageSuspense title="Des idées pour ton Reel" skeleton={<div className="flex min-h-dvh items-center justify-center bg-ink text-white/60">Chargement…</div>}>
      <Ideas params={params} />
    </PageSuspense>
  );
}

async function Ideas({ params }: { params: PageProps<"/idees/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { member } = await getStudioContext();
  if (!member) redirect(`/connexion?next=/idees/${id}`);
  const offer = await readOffer(member.studio.id, id);
  if (!offer) notFound();
  const cards = await ideaCards(offer.keys);
  return <IdeasView offerId={offer.id} cards={cards} files={offer.mediaIds.length} launched={Boolean(offer.postId)} />;
}
