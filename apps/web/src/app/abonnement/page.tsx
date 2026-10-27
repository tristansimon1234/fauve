import { nextPlan, planOf } from "@fauve/agent";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Paywall } from "@/components/paywall";
import { studioAccess } from "@/lib/billing/access";
import { getStudioContext } from "@/lib/studio";

export const metadata: Metadata = { title: "Ton abonnement" };

// The 3 offers (Stripe Checkout). Subscribed with no credits left: the offers above hers. Otherwise back to the app.
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
  const access = await studioAccess(member.studio.id);
  const above = nextPlan(planOf(member.studio.plan));
  if (access.subscribed && (access.create || !above)) redirect(next);
  return <Paywall db={db} studioId={member.studio.id} postId={null} next={next} upgradeFrom={access.subscribed ? planOf(member.studio.plan) : undefined} />;
}
