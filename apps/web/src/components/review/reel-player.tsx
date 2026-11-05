"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { soundPreview } from "@/app/(app)/publications/[id]/review-actions";
import { MusicIcon, PlayIcon } from "@/components/icons";
import type { ReviewData } from "@/lib/review";

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

/**
 * The sound she adds in Instagram, under her silent Reel (`preview`, Instagram's link: soundPreview): it plays with the
 * video's own sound, from the same second, paused, moved and looped with it. A Reel shorter than its sound stops it
 * at its end, as Instagram does; a sound shorter than the Reel stops there.
 */
export function useReelPlayback(video: RefObject<HTMLVideoElement | null>, src: string | null, preview: string | null = null) {
  const [playing, setPlaying] = useState(true);
  const [sound, setSound] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Called again from her taps too: a sound starts only within a tap of hers on some phones.
  const follow = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = video.current;
    if (!el || !preview) return;
    const track = new Audio();
    track.preload = "auto";
    track.src = preview;
    const sync = () => {
      if (el.paused || el.muted) {
        if (!track.paused) track.pause();
        return;
      }
      const at = el.currentTime;
      if (Number.isFinite(track.duration) && at >= track.duration) {
        if (!track.paused) track.pause();
        return;
      }
      if (Math.abs(track.currentTime - at) > 0.25) track.currentTime = at;
      if (track.paused) track.play().catch(() => {});
    };
    follow.current = sync;
    const events = ["play", "pause", "seeked", "timeupdate", "volumechange"] as const;
    for (const name of events) el.addEventListener(name, sync);
    sync();
    return () => {
      for (const name of events) el.removeEventListener(name, sync);
      follow.current = null;
      track.pause();
      track.removeAttribute("src");
      track.load();
    };
  }, [video, src, preview]);

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
      follow.current?.();
    },
    toggleSound: () => {
      const el = video.current;
      if (!el) return;
      mute(el, !el.muted);
      if (!el.muted && el.paused) el.play().catch(() => {});
      setSound(!el.muted);
      follow.current?.();
    },
    seek: (to: number) => {
      const el = video.current;
      if (!el) return;
      moveTo(el, to);
      setTime(el.currentTime);
      follow.current?.();
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

/**
 * The link that plays the sound she adds in Instagram under her Reel, asked once its page is open (read from
 * Instagram, which takes a second or two the first time); null without one.
 */
export function useSoundPreview(postId: string, sound: { link: string } | null): string | null {
  const [url, setUrl] = useState<{ of: string; url: string | null } | null>(null);
  const link = sound?.link ?? null;
  useEffect(() => {
    if (!link) return;
    let live = true;
    soundPreview(postId).then(
      (found) => live && setUrl({ of: link, url: found }),
      () => live && setUrl({ of: link, url: null }),
    );
    return () => {
      live = false;
    };
  }, [postId, link]);
  return link && url?.of === link ? url.url : null;
}

/** The sound she adds in Instagram: its name, that it plays here only, and the Reel to open for « Utiliser l'audio ». */
export function AddedSound({ sound, heard, dark = false }: { sound: ReviewData["sound"]; heard: boolean; dark?: boolean }) {
  if (!sound) return null;
  const name = sound.title ? `« ${sound.title} »${sound.artist ? ` · ${sound.artist}` : ""}` : sound.followed ? "Le son que tu m’as donné" : "Le son du Reel que tu recopies";
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${dark ? "text-white" : ""}`}>
      <p className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-bold">
        <MusicIcon size={14} />
        <span className="truncate">{name}</span>
      </p>
      <p className={`text-[12.5px] leading-snug ${dark ? "text-white/80" : "text-muted"}`}>
        {heard ? "Ici en aperçu, son activé. " : ""}Il n’est pas dans la vidéo : en la publiant, ouvre ce Reel dans Instagram, touche le son, « Utiliser l’audio ».
      </p>
      <a href={sound.link} target="_blank" rel="noopener noreferrer" className={`self-start text-[13px] font-bold underline underline-offset-3 ${dark ? "text-white" : "text-violet"}`}>
        Ouvrir le Reel du son
      </a>
    </div>
  );
}
