import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { ConnectActions, ConnectActionsFallback } from "./connect-actions";

export const metadata: Metadata = { title: "Connecte ton Instagram" };

// Connecting is mostly for her results: she posts herself from her phone (« Publier » opens Instagram
// with the Reel ready, a trending sound added there), and Edith publishes at a word only if she wants.
const permissions = [
  "Suivre tes résultats : visites du profil, clics sur ton lien, nouveaux abonnés",
  "Retrouver chaque publication pour te dire ce qui marche",
  "Publier pour toi d’un mot, si tu préfères",
];

export default function ConnectPage({ searchParams }: PageProps<"/connect">) {
  return (
    <>
      <div className="flex flex-1 flex-col gap-6 px-6 pt-11 pb-6">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Orb size={28} />
            <span className="text-[17px] font-extrabold">Edith</span>
          </span>
          <span className="text-[13px] font-bold text-muted">Étape 2 sur 3</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em]">
            Connecte ton <span className="accent">Instagram</span>
          </h1>
          <p className="text-[15px] leading-[1.55] text-muted">Pour suivre tes résultats. Une seule fois, ensuite tout se passe sur WhatsApp.</p>
        </div>
        <ul className="flex flex-col gap-3">
          {permissions.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[15px] leading-[1.45]">
              <CheckIcon className="shrink-0 text-violet" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl bg-soft px-4 py-3.5 text-sm leading-normal">
          <strong>Rien n’est publié sans ton accord.</strong> Tu peux déconnecter Edith à tout moment.
        </div>
        <Suspense fallback={<ConnectActionsFallback />}>
          <ConnectActions searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
