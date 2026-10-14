"use client";

import { useEffect, useState } from "react";
import { Mascot, type MascotMood } from "@/components/mascot";

/**
 * Brigitte next to her latest message: she laughs a few seconds when the
 * exchange is funny (her words or the manager's), then goes back to rest.
 */
export function BrigitteAvatar({ funny, fresh, size = 26 }: { funny: boolean; fresh: boolean; size?: number }) {
  const [mood, setMood] = useState<MascotMood>(funny && fresh ? "laugh" : fresh ? "happy" : "idle");
  useEffect(() => {
    if (mood === "idle") return;
    const timer = setTimeout(() => setMood("idle"), mood === "laugh" ? 3200 : 2200);
    return () => clearTimeout(timer);
  }, [mood]);
  return <Mascot size={size} mood={mood} />;
}
