"use client";

import { useEffect, useState } from "react";
import { Mascot, type MascotMood } from "@/components/mascot";

/** The latest message Brigitte reacts to. */
export type BrigitteCue = { id: string; funny: boolean; upset: "sad" | "cry" | null; fresh: boolean };

/** How long each reaction lasts before she goes back to rest. */
const REACTION_MS: Partial<Record<MascotMood, number>> = { cry: 4500, sad: 4500, laugh: 3200, happy: 2200 };

/**
 * One Brigitte for the whole conversation (its header): she thinks while she
 * writes, then reacts to the message that just arrived (laughs when the exchange
 * is funny, is sad or cries when the manager is upset, is pleased otherwise) and
 * goes back to rest. A single mascot, so every change of mood is a transition.
 */
export function BrigitteLive({ typing, cue, size }: { typing: boolean; cue: BrigitteCue | null; size: number }) {
  const [rested, setRested] = useState<string | null>(null);
  const reaction: MascotMood | null = cue?.fresh && rested !== cue.id ? (cue.upset ?? (cue.funny ? "laugh" : "happy")) : null;
  const cueId = cue?.id;
  useEffect(() => {
    if (!reaction || !cueId) return;
    const timer = setTimeout(() => setRested(cueId), REACTION_MS[reaction] ?? 2200);
    return () => clearTimeout(timer);
  }, [reaction, cueId]);
  return <Mascot size={size} mood={typing ? "thinking" : (reaction ?? "idle")} />;
}
