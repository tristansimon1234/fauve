"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CLONE_MAX_SECONDS, CLONE_MIN_SECONDS, CLONE_SCRIPT, SIMONE_VOICES, voiceSamplePath } from "@fauve/agent";
import { MicIcon, PauseIcon, PlayIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { publicEnv } from "@/lib/public-env";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cloneMyVoice, deleteMyVoice, type OwnVoiceView } from "./actions";
import type { StyleForm } from "./style-options";
import { FoldedSection, Segmented } from "./ui";

// Edith's voice over the Reels: when she puts one, and which voice: one of Edith's (each
// heard reading the same lines, from the public bucket), or her own, cloned from a minute
// she records or sends here. Her own voice note, when she sends one, always comes first.

const SAMPLES = `${publicEnv.supabaseUrl}/storage/v1/object/public/landing`;

const USE_OPTIONS = [
  { value: "auto", label: "Quand ça raconte" },
  { value: "always", label: "Sur tous mes Reels" },
  { value: "never", label: "Jamais" },
] as const;

const USE_HINTS: Record<StyleForm["voice_use"], string> = {
  auto: "Edith en pose une quand tes images racontent quelque chose (un geste, un avant/après, une histoire) et que personne ne parle déjà dans tes vidéos.",
  always: "Chaque nouveau Reel a sa voix off, sauf quand tu m’envoies ton propre vocal : c’est lui qui passe.",
  never: "Tes Reels n’ont que leur musique. Tu peux toujours en demander une pour un Reel précis.",
};

type VoiceFields = Pick<StyleForm, "voice_use" | "voice_id">;

export function VoiceSection({
  value,
  onChange,
  studioId,
  ownVoice,
  onOwnVoice,
}: {
  value: VoiceFields;
  onChange: (patch: Partial<VoiceFields>) => void;
  studioId: string;
  ownVoice: OwnVoiceView | null;
  /** The server changed the voice setting itself (her clone made, or deleted). */
  onOwnVoice: (patch: Partial<VoiceFields>) => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [own, setOwn] = useState(ownVoice);
  const [cloning, setCloning] = useState(false);
  useEffect(() => () => audio.current?.pause(), []);

  const listen = (id: string, url: string) => {
    audio.current?.pause();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const sample = new Audio(url);
    audio.current = sample;
    sample.onended = () => setPlaying((current) => (current === id ? null : current));
    setPlaying(id);
    sample.play().catch(() => setPlaying(null));
  };

  const voices = [
    ...(own ? [{ id: own.id, name: "Ta voix", hint: "clonée, rien qu’à toi", url: own.sampleUrl }] : []),
    ...SIMONE_VOICES.map((v) => ({ id: v.id as string, name: v.name as string, hint: v.hint as string, url: `${SAMPLES}/${voiceSamplePath(v.id)}` as string | null })),
  ];

  return (
    <FoldedSection title="Voix off" hint="Une vraie voix qui raconte tes Reels. La musique passe dessous.">
      <Segmented legend="Quand mettre une voix" name="voice-use" value={value.voice_use} options={USE_OPTIONS} onChange={(voice_use) => onChange({ voice_use })} />
      <p className="text-[13px] leading-snug text-muted">{USE_HINTS[value.voice_use]}</p>
      <fieldset className="flex flex-col gap-2" disabled={value.voice_use === "never"}>
        <legend className="mb-2 text-[13px] font-bold">La voix</legend>
        <div role="radiogroup" aria-label="La voix de tes Reels" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {voices.map((voice) => {
            const chosen = value.voice_id === voice.id;
            return (
              <div
                key={voice.id}
                className={`flex items-center gap-2 rounded-[16px] border p-2.5 transition-colors ${chosen ? "border-violet bg-violet-soft" : "border-line bg-white"} ${value.voice_use === "never" ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => onChange({ voice_id: voice.id })}
                  className="flex min-w-0 flex-1 flex-col text-left leading-tight"
                >
                  <span className="text-[14px] font-bold">{voice.name}</span>
                  <span className="truncate text-[12px] text-muted">{voice.hint}</span>
                </button>
                {voice.url ? (
                  <button
                    type="button"
                    onClick={() => listen(voice.id, voice.url!)}
                    aria-label={playing === voice.id ? `Arrêter ${voice.name}` : `Écouter ${voice.name}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-ink transition-colors hover:bg-violet-tint"
                  >
                    {playing === voice.id ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>
      {own ? (
        <OwnVoiceLine
          onDeleted={() => {
            setOwn(null);
            if (value.voice_id === own.id) onOwnVoice({ voice_id: SIMONE_VOICES[0].id });
          }}
          onRedo={() => setCloning(true)}
        />
      ) : null}
      {!own || cloning ? (
        <CloneVoice
          studioId={studioId}
          open={cloning}
          onOpen={() => setCloning(true)}
          onClose={() => setCloning(false)}
          onCloned={(voice) => {
            setOwn(voice);
            setCloning(false);
            onOwnVoice({ voice_id: voice.id });
            if (voice.sampleUrl) listen(voice.id, voice.sampleUrl);
          }}
        />
      ) : null}
    </FoldedSection>
  );
}

function OwnVoiceLine({ onDeleted, onRedo }: { onDeleted: () => void; onRedo: () => void }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
      <span>Ta voix est clonée. Elle ne sert qu’à tes Reels.</span>
      <button type="button" onClick={onRedo} className="font-semibold text-violet hover:underline">
        La refaire
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!window.confirm("Supprimer ta voix ? Elle est effacée partout, et tes Reels reprennent une voix d’Edith.")) return;
          start(async () => {
            setError(null);
            const res = await deleteMyVoice().catch(() => ({ ok: false, message: "Ce n’est pas supprimé. Réessaie." }));
            if (res.ok) onDeleted();
            else setError(res.message ?? "Ce n’est pas supprimé. Réessaie.");
          });
        }}
        className="inline-flex items-center gap-1 font-semibold text-ink hover:text-[#9A3412] disabled:opacity-50"
      >
        <TrashIcon size={13} />
        {busy ? "Suppression…" : "Supprimer ma voix"}
      </button>
      {error ? <span role="alert" className="text-[#9A3412]">{error}</span> : null}
    </div>
  );
}

/** The recorder picks what the browser records best: Opus in WebM (Chrome, Firefox), AAC in MP4 (Safari). */
function recorderType(): { mimeType?: string; ext: string } {
  for (const [mimeType, ext] of [["audio/webm;codecs=opus", "webm"], ["audio/webm", "webm"], ["audio/mp4", "m4a"], ["audio/ogg;codecs=opus", "ogg"]] as const) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType)) return { mimeType, ext };
  }
  return { ext: "webm" };
}

const UPLOAD_EXT = ["webm", "ogg", "mp3", "m4a", "mp4", "wav", "aac", "flac"];
const MAX_BYTES = 25 * 1024 * 1024;

type Take = { blob: Blob; ext: string; seconds: number; url: string };

/** How long an audio file lasts, read by the browser (a file it cannot read: unknown). */
function durationOf(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => resolve(null);
    a.src = url;
  });
}

export function CloneVoice({
  studioId,
  open,
  onOpen,
  onClose,
  onCloned,
}: {
  studioId: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCloned: (voice: OwnVoiceView) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 rounded-[16px] border border-dashed border-line bg-soft p-4 text-left transition-colors hover:border-violet"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet text-white">
          <MicIcon size={18} />
        </span>
        <span className="flex flex-col leading-snug">
          <span className="text-[14px] font-bold">Mets ta propre voix sur tes Reels</span>
          <span className="text-[13px] text-muted">Lis un petit texte pendant une minute : Edith clone ta voix et raconte tes Reels avec.</span>
        </span>
      </button>
    );
  }

  const record = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const { mimeType, ext } = recorderType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const began = Date.now();
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) window.clearInterval(timer.current);
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
        const seconds = (Date.now() - began) / 1000;
        setTake({ blob, ext, seconds, url: URL.createObjectURL(blob) });
      };
      recorder.current = rec;
      rec.start(1000);
      setTake(null);
      setElapsed(0);
      setRecording(true);
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - began) / 1000);
        setElapsed(s);
        if (s >= CLONE_MAX_SECONDS && rec.state === "recording") rec.stop();
      }, 250);
    } catch {
      setError("Ton micro n’est pas accessible. Autorise-le dans ton navigateur, ou envoie un fichier audio.");
    }
  };

  const pick = async (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!UPLOAD_EXT.includes(ext)) return setError("Formats acceptés : mp3, m4a, wav, ogg, webm, aac, flac.");
    if (file.size > MAX_BYTES) return setError("Ce fichier dépasse 25 Mo.");
    const url = URL.createObjectURL(file);
    const seconds = await durationOf(url);
    if (seconds !== null && seconds < CLONE_MIN_SECONDS) return setError(`Il faut au moins ${CLONE_MIN_SECONDS} secondes de ta voix (celui-ci en fait ${Math.round(seconds)}).`);
    setTake({ blob: file, ext, seconds: seconds ?? CLONE_MIN_SECONDS, url });
  };

  const send = () =>
    start(async () => {
      if (!take) return;
      setError(null);
      const path = `${studioId}/voice-clone/rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${take.ext}`;
      const { error: uploadError } = await supabaseBrowser().storage.from("media").upload(path, take.blob, { contentType: take.blob.type || `audio/${take.ext}` });
      if (uploadError) return setError("L’envoi a échoué. Réessaie.");
      const res = await cloneMyVoice({ paths: [path], seconds: Math.round(take.seconds), consent }).catch(() => ({ status: "error" as const, message: "Ta voix n’a pas pu être clonée. Réessaie." }));
      if (res.status === "ok") onCloned(res.voice);
      else setError(res.message);
    });

  const tooShort = take !== null && take.seconds < CLONE_MIN_SECONDS;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-bold">Ta voix sur tes Reels</span>
          <span className="text-[13px] text-muted">
            Au calme, sans musique, ton téléphone ou ton ordi près de toi. Lis ce texte comme tu parles, en prenant ton temps (une minute environ, {CLONE_MIN_SECONDS} secondes au moins).
          </span>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-[13px] font-semibold text-muted hover:text-ink">
          Fermer
        </button>
      </div>
      <p className="rounded-[12px] bg-white p-4 text-[15px] leading-relaxed">{CLONE_SCRIPT}</p>
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <button type="button" onClick={() => recorder.current?.stop()} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#9A3412] px-4 text-[14px] font-semibold text-white">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
            Arrêter · {mmss(elapsed)}
          </button>
        ) : (
          <button type="button" onClick={record} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-violet px-4 text-[14px] font-semibold text-white disabled:opacity-50">
            <MicIcon size={15} />
            {take ? "Recommencer" : "M’enregistrer"}
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={recording || busy}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-ink hover:text-violet disabled:opacity-50"
        >
          <UploadIcon size={15} />
          Envoyer un fichier audio
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm,.aac,.flac"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pick(file);
          }}
        />
      </div>
      {take && !recording ? (
        <div className="flex flex-col gap-3">
          <audio controls src={take.url} className="w-full" />
          {tooShort ? <p className="text-[13px] text-[#9A3412]">C’est un peu court ({Math.round(take.seconds)} s) : lis tout le texte, sans te presser.</p> : null}
          <label className="flex items-start gap-2 text-[13px] leading-snug">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5B3FD9]" />
            <span>C’est ma voix, et j’accepte qu’Edith la clone pour raconter mes Reels. Je peux la supprimer quand je veux.</span>
          </label>
          <button
            type="button"
            onClick={send}
            disabled={!consent || tooShort || busy}
            className="inline-flex h-10 w-fit items-center rounded-full bg-violet px-5 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Edith clone ta voix… (une minute environ)" : "Cloner ma voix"}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-[#9A3412]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
