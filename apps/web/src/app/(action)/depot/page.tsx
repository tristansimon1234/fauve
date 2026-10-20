import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getStudioContext } from "@/lib/studio";
import { DropView } from "./drop-view";

export const metadata: Metadata = { title: "Envoie tes photos et vidéos" };
// Her files are read, then Simone answers on WhatsApp, after the page has its answer.
export const maxDuration = 300;

// The upload link Simone sends on WhatsApp when she asks for files (reply_with upload): her
// gallery in full quality, straight to Storage, then the files arrive in her WhatsApp conversation.

export default function DropPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-white/60">Chargement…</div>}>
      <Drop />
    </Suspense>
  );
}

async function Drop() {
  const { member } = await getStudioContext();
  if (!member) redirect("/connexion?next=/depot");
  return <DropView studioId={member.studio.id} />;
}
