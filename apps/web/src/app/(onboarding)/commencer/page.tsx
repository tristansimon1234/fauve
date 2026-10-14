import type { Metadata } from "next";
import { Suspense } from "react";
import { Pairing } from "./pairing";

export const metadata: Metadata = { title: "Commencer" };

export default function StartPage({ searchParams }: { searchParams: Promise<{ connexion?: string; expire?: string }> }) {
  return (
    <Suspense>
      <Start searchParams={searchParams} />
    </Suspense>
  );
}

async function Start({ searchParams }: { searchParams: Promise<{ connexion?: string; expire?: string }> }) {
  const { connexion, expire } = await searchParams;
  return <Pairing signIn={connexion !== undefined} expired={expire !== undefined} />;
}
