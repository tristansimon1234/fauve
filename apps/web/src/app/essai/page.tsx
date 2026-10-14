import type { Metadata } from "next";
import { Suspense } from "react";
import { Orb } from "@/components/orb";
import { getOrCreateTestMember, isValidTestKey, loadTestState } from "@/lib/test-studio";
import { TestChat } from "./test-chat";

export const metadata: Metadata = { title: "Tester Brigitte", robots: { index: false, follow: false } };

// The agent may run several tools before answering.
export const maxDuration = 300;

export default function TestPage({ searchParams }: PageProps<"/essai">) {
  return (
    <Suspense fallback={<Centered>Chargement…</Centered>}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: { searchParams: PageProps<"/essai">["searchParams"] }) {
  const { cle } = await searchParams;
  const key = typeof cle === "string" ? cle : null;
  if (!key || !isValidTestKey(key)) {
    return <Centered>Ce lien de test n’est pas valide.</Centered>;
  }
  const state = await loadTestState(await getOrCreateTestMember());
  return <TestChat testKey={key} initial={state} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-soft p-6 text-center">
      <Orb size={64} />
      <p className="text-[15px] text-muted">{children}</p>
    </div>
  );
}
