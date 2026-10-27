import type { Metadata } from "next";
import { Suspense } from "react";
import { Orb } from "@/components/orb";
import { getOrCreateTestMember, loadTestState } from "@/lib/test-studio";
import { testKeyValid } from "./actions";
import { KeyForm } from "./key-form";
import { TestChat } from "./test-chat";

export const metadata: Metadata = { title: "Tester Edith", robots: { index: false, follow: false } };

// The agent may run several tools before answering.
export const maxDuration = 300;

export default function TestPage() {
  return (
    <Suspense fallback={<Centered>Chargement…</Centered>}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  if (!(await testKeyValid())) {
    return (
      <Centered>
        <KeyForm />
      </Centered>
    );
  }
  const state = await loadTestState(await getOrCreateTestMember());
  return <TestChat initial={state} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-soft p-6 text-center">
      <Orb size={64} />
      <div className="text-[15px] text-muted">{children}</div>
    </div>
  );
}
