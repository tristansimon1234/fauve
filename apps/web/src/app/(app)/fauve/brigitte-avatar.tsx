"use client";

import { useEffect, useState } from "react";
import { Mascot, type MascotMood } from "@/components/mascot";

/**
 * Brigitte next to her latest message: she laughs a few seconds when the
 * exchange is funny (her words or the manager's), looks sad or cries when the
 * manager is upset, then goes back to rest.
 */
export function BrigitteAvatar({ funny, upset = null, fresh, size = 26 }: { funny: boolean; upset?: "sad" | "cry" | null; fresh: boolean; size?: number }) {
  const [mood, setMood] = useState<MascotMood>(!fresh ? "idle" : upset ? upset : funny ? "laugh" : "happy");
  useEffect(() => {
    if (mood === "idle") return;
    const timer = setTimeout(() => setMood("idle"), mood === "cry" || mood === "sad" ? 4500 : mood === "laugh" ? 3200 : 2200);
    return () => clearTimeout(timer);
  }, [mood]);
  return <Mascot size={size} mood={mood} />;
}
