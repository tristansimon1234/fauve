"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchMusic, setMusic, type MusicSearch, type MusicTrack } from "@/app/(app)/publications/[id]/music-actions";

// Instagram's music on a Reel: trending tracks or a search, listened to in the
// page, chosen in one tap. Instagram attaches it when it publishes the Reel (the
// montage itself stays silent). Needs the Instagram connection through Facebook.

const time = (ms?: number | null) => {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function MusicPicker({ postId, available, initial }: { postId: string; available: boolean; initial: MusicTrack | null }) {
  const [track, setTrack] = useState<MusicTrack | null>(initial);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<MusicSearch | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [searching, start] = useTransition();
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const search = (q: string) => start(async () => setResult(await searchMusic(q)));
  const toggleOpen = () => {
    setOpen((o) => !o);
    if (!result) search("");
  };
  const play = (t: MusicTrack) => {
    if (!t.preview) return;
    if (playing === t.audio_id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    audio.current = new Audio(t.preview);
    audio.current.onended = () => setPlaying(null);
    void audio.current.play().catch(() => setPlaying(null));
    setPlaying(t.audio_id);
  };
  const choose = async (t: MusicTrack | null) => {
    setSaving(t?.audio_id ?? "none");
    const res = await setMusic(postId, t?.audio_id ?? null);
    setSaving(null);
    if (res.ok) {
      setTrack(res.track ?? (t ? t : null));
      setOpen(false);
    }
  };

  if (!available) {
    return (
      <section aria-label="Musique" className="flex flex-col gap-1.5 rounded-[18px] border border-line bg-white p-3.5">
        <h2 className="text-[16px] font-extrabold">Musique</h2>
        <p className="text-[13px] leading-snug text-muted">
          Pour choisir ici la musique d’Instagram, connecte ton compte via Facebook. Sinon, ajoute le son dans l’appli Instagram au moment de publier.
        </p>
        <a href="/api/facebook/connect" className="self-start text-[13px] font-bold text-violet">
          Activer la musique d’Instagram
        </a>
      </section>
    );
  }

  const tracks = result?.status === "ok" ? result.tracks : [];
  return (
    <section aria-label="Musique" className="flex flex-col gap-3 rounded-[18px] border-2 border-violet-soft bg-white p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-extrabold">Musique</h2>
        <span className="text-[12px] text-muted">Ajoutée par Instagram à la publication</span>
      </div>
      {track ? (
        <TrackRow track={track} playing={playing === track.audio_id} onPlay={() => play(track)}>
          <button type="button" onClick={toggleOpen} className="text-[13px] font-bold text-violet">
            {open ? "Fermer" : "Changer"}
          </button>
        </TrackRow>
      ) : (
        <button type="button" onClick={toggleOpen} className="btn btn-primary h-10 self-start px-4 text-[14px]">
          {open ? "Fermer" : "Choisir une musique"}
        </button>
      )}
      {open && (
        <div className="flex flex-col gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
            className="flex gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Un titre, un artiste, une ambiance…"
              className="h-10 min-w-0 flex-1 rounded-full border border-line px-4 text-[14px] outline-none focus:border-violet"
            />
            <button type="submit" className="h-10 rounded-full bg-soft px-4 text-[13px] font-bold">
              Chercher
            </button>
          </form>
          <p className="text-[12px] font-semibold text-muted">{query.trim() ? "Résultats" : "Tendances sur Instagram"}</p>
          {searching ? (
            <p className="text-[13px] text-muted">Je cherche…</p>
          ) : result?.status === "error" ? (
            <p className="text-[13px] text-danger">{result.message}</p>
          ) : tracks.length === 0 ? (
            <p className="text-[13px] text-muted">Aucune musique trouvée.</p>
          ) : (
            <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {tracks.map((t) => (
                <li key={t.audio_id}>
                  <TrackRow track={t} playing={playing === t.audio_id} onPlay={() => play(t)}>
                    <button
                      type="button"
                      disabled={saving !== null}
                      onClick={() => choose(t)}
                      className={`h-8 rounded-full px-3 text-[12px] font-bold ${track?.audio_id === t.audio_id ? "bg-violet text-white" : "bg-violet-soft text-violet"}`}
                    >
                      {saving === t.audio_id ? "…" : track?.audio_id === t.audio_id ? "Choisie" : "Choisir"}
                    </button>
                  </TrackRow>
                </li>
              ))}
            </ul>
          )}
          {track && (
            <button type="button" disabled={saving !== null} onClick={() => choose(null)} className="self-start text-[12px] font-semibold text-muted hover:text-ink">
              Sans musique
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function TrackRow({ track, playing, onPlay, children }: { track: MusicTrack; playing: boolean; onPlay: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[12px] px-1 py-1">
      <button
        type="button"
        onClick={onPlay}
        disabled={!track.preview}
        aria-label={playing ? "Arrêter l’écoute" : "Écouter"}
        className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-ink text-white disabled:opacity-50"
      >
        {track.cover && (
          // eslint-disable-next-line @next/next/no-img-element -- Instagram's artwork
          <img src={track.cover} alt="" className="absolute inset-0 size-full object-cover opacity-70" />
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="relative" aria-hidden="true">
          {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5l11 7-11 7z" />}
        </svg>
      </button>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-bold">{track.title ?? "Son original"}</span>
        <span className="truncate text-[12px] text-muted">
          {[track.artist, time(track.duration_ms)].filter(Boolean).join(" · ")}
        </span>
      </span>
      {children}
    </div>
  );
}
