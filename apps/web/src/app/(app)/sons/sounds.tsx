"use client";

import { SOUND_SEARCHES_PER_DAY } from "@fauve/agent";
import { useEffect, useRef, useState, useTransition } from "react";
import { MusicIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { NewPostSheet, type PickedSound } from "@/components/new-post-sheet";
import type { TrendSound } from "@/lib/trend-sounds";
import { findSounds, soundToHear, soundToPlay } from "./actions";

// « Les sons du moment » (Tristan: « une bibliothèque de sons tendances », « plutôt 30 sons et des sons à la demande »):
// TikTok's charts found on Instagram, and any sound she looks for by name. Listened to here from a Reel that uses it
// (its video, played from Instagram, nothing kept); « Caler un Reel dessus » opens Créer on it: her Reel comes out
// silent, cut on its beats, and she adds the sound in Instagram with « Utiliser l'audio » on that Reel.

const SHOWN = 10;

export function SoundsSection({ sounds, timezone }: { sounds: TrendSound[]; timezone: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [all, setAll] = useState(false);
  const [words, setWords] = useState("");
  const [found, setFound] = useState<TrendSound[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedSound | null>(null);

  // Silent when the page is left (Next.js keeps it hidden in the document).
  useEffect(() => {
    const el = audio.current;
    return () => el?.pause();
  }, []);

  const search = () =>
    startSearch(async () => {
      setError(null);
      const res = await findSounds(words);
      if (!res.ok) return setError(res.error);
      setFound(res.sounds);
    });

  const listen = async (sound: TrendSound) => {
    const el = audio.current;
    if (!el) return;
    if (playing === sound.audioId) {
      el.pause();
      setPlaying(null);
      return;
    }
    setBusy(sound.audioId);
    const heard = await soundToHear(sound.audioId);
    setBusy(null);
    if (!heard) return setError(`Je n’arrive pas à faire écouter « ${sound.title} » pour l’instant.`);
    setError(null);
    el.src = heard.url;
    // From its highlight, once its length is known (the passage Instagram offers first).
    el.onloadedmetadata = () => {
      if (heard.start > 0 && heard.start < el.duration) el.currentTime = heard.start;
    };
    el.play().then(
      () => setPlaying(sound.audioId),
      () => setPlaying(null),
    );
  };

  const pick = async (sound: TrendSound) => {
    setBusy(sound.audioId);
    const example = await soundToPlay(sound.audioId);
    setBusy(null);
    if (!example) return setError(`Aucun Reel n’utilise encore « ${sound.title} » sur Instagram : choisis-en un autre.`);
    audio.current?.pause();
    setPlaying(null);
    setPicked({ link: example.link, title: sound.title, artist: sound.artist, audioId: sound.audioId });
  };

  const shown = all ? sounds : sounds.slice(0, SHOWN);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="sounds-title">
      <div className="flex flex-col gap-1">
        {/* Edith's own picks (Tristan: « mets mes sons préférés du moment avec la tête d'Edith »). */}
        <div className="flex items-center gap-2.5">
          <Mascot size={40} still />
          <h2 id="sounds-title" className="text-[22px] font-extrabold tracking-[-0.01em]">
            Mes sons préférés du moment
          </h2>
        </div>
        <p className="max-w-[640px] text-[13.5px] leading-snug text-muted">
          Choisis un son : ton Reel sort sans musique, coupé sur ses temps, et tu ajoutes le son dans Instagram en le publiant (« Utiliser l’audio »). Instagram ne laisse aucune appli le mettre à ta place.
        </p>
      </div>

      <form
        className="flex max-w-[520px] flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          aria-label="Chercher un son"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          maxLength={80}
          placeholder="Un titre, un artiste…"
          className="h-11 min-w-[200px] flex-1 border border-line px-4 text-[16px] outline-none focus:border-violet"
        />
        <button type="submit" disabled={searching || words.trim().length < 2} className="h-11 bg-violet px-5 text-[15px] font-bold text-white disabled:opacity-50">
          {searching ? "…" : "Chercher"}
        </button>
      </form>
      {error && <p className="text-[14px] text-peach-ink">{error}</p>}

      {found && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="mono-label text-muted">Résultats</p>
            <button type="button" onClick={() => setFound(null)} className="text-[13px] font-bold text-violet">
              Revenir à la liste
            </button>
          </div>
          {found.length ? (
            <SoundList sounds={found} playing={playing} busy={busy} onListen={listen} onPick={pick} />
          ) : (
            <p className="bg-soft px-5 py-6 text-[14px] text-muted">Rien trouvé sur Instagram pour « {words.trim()} ». Essaie le titre seul, ou l’artiste.</p>
          )}
          <p className="text-[12px] text-muted">{SOUND_SEARCHES_PER_DAY} recherches par jour.</p>
        </div>
      )}

      {!found &&
        (sounds.length ? (
          <div className="flex flex-col gap-2">
            <SoundList sounds={shown} playing={playing} busy={busy} onListen={listen} onPick={pick} />
            {sounds.length > SHOWN && (
              <button type="button" onClick={() => setAll(!all)} className="btn-secondary h-10 self-start px-4 text-[14px]">
                {all ? "Moins de sons" : `Voir les ${sounds.length} sons`}
              </button>
            )}
          </div>
        ) : (
          <p className="bg-soft px-5 py-6 text-[14px] text-muted">La liste de la semaine arrive dans une minute. En attendant, cherche un son par son titre.</p>
        ))}

      <audio ref={audio} onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} preload="none" />
      {picked && <NewPostSheet timezone={timezone} sound={picked} onClose={() => setPicked(null)} />}
    </section>
  );
}

function SoundList({
  sounds,
  playing,
  busy,
  onListen,
  onPick,
}: {
  sounds: TrendSound[];
  playing: string | null;
  busy: string | null;
  onListen: (sound: TrendSound) => void;
  onPick: (sound: TrendSound) => void;
}) {
  return (
    <ul className="grid gap-x-6 border-t border-line lg:grid-cols-2">
      {sounds.map((sound) => (
        <li key={sound.audioId} className="flex min-w-0 items-center gap-3 border-b border-line py-3">
          <button
            type="button"
            onClick={() => onListen(sound)}
            disabled={busy === sound.audioId}
            aria-label={playing === sound.audioId ? `Arrêter « ${sound.title} »` : `Écouter « ${sound.title} »`}
            className="relative size-14 shrink-0 overflow-hidden bg-soft disabled:opacity-60"
          >
            <Cover src={sound.cover} />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
              {busy === sound.audioId ? "…" : playing === sound.audioId ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </span>
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-[15px] font-bold">{sound.title}</p>
            <p className="truncate text-[13px] text-muted">{[sound.artist, sound.explicit ? "Explicite" : null].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" onClick={() => onPick(sound)} disabled={busy === sound.audioId} className="btn-secondary h-9 shrink-0 px-3 text-[13px] disabled:opacity-50">
            Caler un Reel dessus
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Its cover from Instagram (its link expires: then the music sign). */
function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="flex size-full items-center justify-center text-muted">
        <MusicIcon size={20} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- Instagram's CDN, expiring
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />;
}
