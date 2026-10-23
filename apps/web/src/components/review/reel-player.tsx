"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { PlayIcon } from "@/components/icons";

// The Reel's own controls on its page: play and pause, where it is and where to go
// (Tristan: « il y a rien pour mettre pause, avancer, reculer la vidéo »), and its sound.
// Next.js keeps a page it leaves in the document, hidden (React <Activity>): the video went
// on playing, sound included, on the next page. Hiding runs the effects' cleanup: it pauses there.

/** The video element is the browser's: changed through it, never as the hook's value. */
function mute(el: HTMLVideoElement, muted: boolean) {
  el.muted = muted;
}
function moveTo(el: HTMLVideoElement, seconds: number) {
  el.currentTime = Math.max(0, Math.min(seconds, el.duration || seconds));
}

export function useReelPlayback(video: RefObject<HTMLVideoElement | null>, src: string | null) {
  const [playing, setPlaying] = useState(true);
  const [sound, setSound] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const sync = () => {
      setPlaying(!el.paused);
      setTime(el.currentTime);
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const events = ["play", "pause", "timeupdate", "loadedmetadata", "seeked"] as const;
    for (const name of events) el.addEventListener(name, sync);
    sync();
    return () => {
      for (const name of events) el.removeEventListener(name, sync);
    };
  }, [video, src]);

  // Hidden with its page (another page opened): silent and still until she comes back.
  useLayoutEffect(() => {
    const el = video.current;
    return () => {
      el?.pause();
    };
  }, [video, src]);

  return {
    playing,
    sound,
    time,
    duration,
    toggle: () => {
      const el = video.current;
      if (!el) return;
      if (el.paused) el.play().catch(() => {});
      else el.pause();
    },
    toggleSound: () => {
      const el = video.current;
      if (!el) return;
      mute(el, !el.muted);
      if (!el.muted && el.paused) el.play().catch(() => {});
      setSound(!el.muted);
    },
    seek: (to: number) => {
      const el = video.current;
      if (!el) return;
      moveTo(el, to);
      setTime(el.currentTime);
    },
  };
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The big play sign over a paused Reel. */
export function PausedSign({ playing }: { playing: boolean }) {
  if (playing) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
        <PlayIcon size={28} />
      </span>
    </span>
  );
}

/** Where the Reel is, to drag forward or back, with its time. */
export function Scrubber({ time, duration, onSeek }: { time: number; duration: number; onSeek: (to: number) => void }) {
  if (!duration) return null;
  const share = Math.min(100, (time / duration) * 100);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px] font-bold text-white tabular-nums drop-shadow">
      <span>{clock(time)}</span>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.05}
        value={time}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Avancer ou reculer dans la vidéo"
        className="fauve-scrubber h-6 min-w-0 flex-1 cursor-pointer"
        style={{ "--fauve-progress": `${share}%` } as CSSProperties}
      />
      <span>{clock(duration)}</span>
    </div>
  );
}
