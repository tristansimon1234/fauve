"use server";

import { getStudioContext } from "@/lib/studio";
import { searchSounds, soundExample, soundListen, type SoundExample, type TrendSound } from "@/lib/trend-sounds";

/** « Chercher »: a title or an artist among Instagram's music (SOUND_SEARCHES_PER_DAY a day). */
export async function findSounds(words: string): Promise<{ ok: true; sounds: TrendSound[] } | { ok: false; error: string }> {
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun commerce." };
  return searchSounds(member.studio.id, words).catch(() => ({ ok: false as const, error: "La recherche n’a pas répondu. Réessaie dans un instant." }));
}

/** A Reel that uses this sound: its video plays the sound here (from Instagram), its link goes to « Créer ». */
export async function soundToPlay(audioId: string): Promise<SoundExample | null> {
  const { member } = await getStudioContext();
  if (!member) return null;
  return soundExample(audioId, member.studio.id).catch(() => null);
}

/** Its song to listen to here, from its highlight (Instagram's link, played from there). */
export async function soundToHear(audioId: string): Promise<{ url: string; start: number } | null> {
  const { member } = await getStudioContext();
  if (!member) return null;
  return soundListen(audioId, member.studio.id).catch(() => null);
}
