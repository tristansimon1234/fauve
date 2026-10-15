import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Paywall } from "@/components/paywall";
import { studioAccess } from "@/lib/billing/access";
import { getStudioContext } from "@/lib/studio";

export const metadata: Metadata = { title: "Ton abonnement" };

// The offers and the trial (Stripe Checkout). Already subscribed: back to the app.
export default function SubscribePage({ searchParams }: PageProps<"/abonnement">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-soft" />}>
      <Subscribe searchParams={searchParams} />
    </Suspense>
  );
}

async function Subscribe({ searchParams }: { searchParams: PageProps<"/abonnement">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/fauve";
  const { db, member } = await getStudioContext();
  if (!member) redirect(`/connexion?next=/abonnement`);
  if ((await studioAccess(member.studio.id)).unlock) redirect(next);
  return <Paywall db={db} studioId={member.studio.id} postId={null} next={next} />;
}
