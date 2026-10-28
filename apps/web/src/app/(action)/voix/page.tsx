import { readOwnVoice, readVoiceSetting } from "@fauve/agent";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { VoiceView } from "./voice-view";

export const metadata: Metadata = { title: "La voix de tes Reels" };
// Cloning her voice takes a minute (ElevenLabs, then a sample read by the clone).
export const maxDuration = 300;

// The voice page Edith sends on WhatsApp (« Choisir ma voix »): her phone is where she lives,
// so the voices are heard and chosen here, and her own voice is cloned here, then back to WhatsApp.

export default function VoicePage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-soft text-muted">Chargement…</div>}>
      <Voice />
    </Suspense>
  );
}

async function Voice() {
  const { db, member } = await getStudioContext();
  if (!member) redirect("/connexion?next=/voix");
  const studioId = member.studio.id;
  const { data } = await db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle();
  const profile = (data?.profile ?? {}) as { voice?: unknown; own_voice?: unknown };
  const setting = readVoiceSetting(profile.voice);
  const own = readOwnVoice(profile.own_voice);
  const sample = own?.sample_path ? ((await signMediaUrls(db, studioId, [own.sample_path])).get(own.sample_path) ?? null) : null;
  return (
    <VoiceView
      studioId={studioId}
      initial={{ use: setting.use, voiceId: setting.voice_id ?? null }}
      own={own ? { id: own.id, name: own.name, sampleUrl: sample } : null}
    />
  );
}
