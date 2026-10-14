"use client";

import { soundtrackKey, soundtrackWav, type ReelProps } from "@fauve/agent";
import { useEffect, useMemo, useState } from "react";

// The live preview plays the same soundtrack as the render: synthesized here from
// the props (music, cuts, texts), a moment after the last change, as a blob.

export function useSoundtrack(props: ReelProps): ReelProps;
export function useSoundtrack(props: ReelProps | null): ReelProps | null;
export function useSoundtrack(props: ReelProps | null): ReelProps | null {
  const key = props ? soundtrackKey(props) : null;
  const [made, setMade] = useState<{ key: string; src: string } | null>(null);

  useEffect(() => {
    if (!props || !key) return;
    let src: string | null = null;
    const timer = setTimeout(() => {
      const wav = soundtrackWav(props);
      if (!wav) return;
      src = URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }));
      setMade({ key, src });
    }, 200);
    return () => {
      clearTimeout(timer);
      if (src) URL.revokeObjectURL(src);
    };
    // The key names everything the sound depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => (props && made && made.key === key ? { ...props, soundtrack: { src: made.src } } : props), [props, made, key]);
}
