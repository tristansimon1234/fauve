"use client";

import { useEffect, useState } from "react";
import { Mascot, type MascotMood } from "@/components/mascot";

/** What Brigitte reacts to: the manager's message (decided at once by Jev) or her own answer arriving. */
export type BrigitteCue = { id: string; mood: MascotMood; fresh: boolean };

/** How long each reaction lasts before she goes back to rest. */
const REACTION_MS: Partial<Record<MascotMood, number>> = { cry: 4500, sad: 4500, laugh: 3200, surprised: 2400, happy: 2200 };

/**
 * One Brigitte for the whole conversation (its header): she reacts to the
 * manager's message as soon as it is read (laughs at a joke, is sad or cries when
 * the manager is upset), thinks while she writes, reacts again when her answer
 * arrives, then rests. A single mascot, so every change of mood is a transition.
 */
export function BrigitteLive({ typing, cue, size }: { typing: boolean; cue: BrigitteCue | null; size: number }) {
  const [rested, setRested] = useState<string | null>(null);
  const reaction: MascotMood | null = cue?.fresh && rested !== cue.id ? cue.mood : null;
  const cueId = cue?.id;
  useEffect(() => {
    if (!reaction || !cueId) return;
    const timer = setTimeout(() => setRested(cueId), REACTION_MS[reaction] ?? 2200);
    return () => clearTimeout(timer);
  }, [reaction, cueId]);
  return <Mascot size={size} mood={reaction ?? (typing ? "thinking" : "idle")} />;
}
