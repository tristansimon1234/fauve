"use client";

import { MAX_PICK, type PickKind } from "@fauve/agent";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckIcon, UploadIcon, WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { formatDuration } from "@/lib/format";
import type { PickItem } from "@/lib/media-pick";
import { whatsappLink } from "@/lib/public-env";
import { sendPick, type PickResult } from "./actions";

// Her médiathèque on her phone, as her gallery: by day, most recent first, three across. A tap picks a file (its
// number is its place in the Reel), a tap again lets it go; the last one picked plays, muted. « Valider » gives her
// pick to Edith on WhatsApp; « Ajouter depuis mon téléphone » is her upload link (/depot).

const words = { photo: "photos", video: "vidéos", any: "photos et vidéos" } as const;

export function PickView({ kind, items }: { kind: PickKind; items: PickItem[] }) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [full, setFull] = useState(false);
  const [result, setResult] = useState<PickResult | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: string) => {
    const full = !chosen.includes(id) && chosen.length >= MAX_PICK;
    setFull(full);
    if (!full) setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  };
  const send = () =>
    start(async () => {
      setResult(await sendPick(chosen).catch((): PickResult => ({ ok: false, error: "Ton choix n’est pas passé. Réessaie." })));
    });

  if (result?.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot size={96} mood="happy" />
        <h1 className="text-[30px] leading-none font-bold tracking-[-0.05em]">C’est noté !</h1>
        <p className="text-[15px] leading-snug text-white/80">
          {result.count > 1 ? `Tes ${result.count} fichiers sont choisis.` : "Ton fichier est choisi."} {result.answered ? "Je continue sur WhatsApp." : "Dis-le-moi sur WhatsApp et je continue."}
        </p>
        <a href={whatsappLink(result.answered ? "" : "C’est choisi !")} className="inline-flex items-center gap-2 bg-white px-5 py-3 text-[15px] font-bold text-ink">
          <WhatsAppIcon size={18} /> Retourner sur WhatsApp
        </a>
      </main>
    );
  }

  const days = items.reduce<{ day: string; items: PickItem[] }[]>((list, item) => {
    const last = list.at(-1);
    if (last?.day === item.day) last.items.push(item);
    else list.push({ day: item.day, items: [item] });
    return list;
  }, []);
  const playing = chosen.at(-1);
  const error = result && !result.ok ? result.error : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-3 px-4 pt-8 pb-5">
        <div className="flex items-center gap-3">
          <Mascot size={44} mood="happy" still />
          <span className="mono-label text-white/60">Ta médiathèque</span>
        </div>
        <h1 className="text-[44px] leading-[0.95] font-bold tracking-[-0.05em]">Choisis tes fichiers</h1>
        <p className="text-[15px] leading-snug text-white/75">
          {items.length ? `Touche tes ${words[kind]} dans l’ordre de ton Reel. Les plus récentes d’abord.` : `Pas encore de ${words[kind]} ici. Ajoute-les depuis ton téléphone, en pleine qualité.`}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Mascot size={80} mood="thinking" />
          <Link href="/depot" className="inline-flex items-center gap-2 bg-white px-5 py-3 text-[15px] font-bold text-ink">
            <UploadIcon size={18} /> Ajouter depuis mon téléphone
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((group) => (
            <section key={group.day} className="flex flex-col gap-2">
              <h2 className="mono-label px-4 text-white/55">{group.day}</h2>
              <ul className="grid grid-cols-3 gap-[2px]">
                {group.items.map((item) => (
                  <Tile key={item.id} item={item} at={chosen.indexOf(item.id)} playing={item.id === playing} onTap={() => toggle(item.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-ink/95 backdrop-blur">
          <div className="mx-auto flex max-w-[520px] flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {(error || full) && (
              <p role="alert" className="text-[13.5px] leading-snug text-white/85">
                {error ?? `${MAX_PICK} fichiers au plus pour un Reel.`}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Link href="/depot" className="inline-flex h-[52px] shrink-0 items-center gap-2 border border-white/40 px-3.5 text-[14px] font-bold text-white" aria-label="Ajouter depuis mon téléphone">
                <UploadIcon size={18} /> <span className="max-[359px]:sr-only">Depuis mon téléphone</span>
              </Link>
              <button type="button" onClick={send} disabled={!chosen.length || pending} className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 bg-white text-[16px] font-bold text-ink disabled:opacity-40">
                <CheckIcon size={18} />
                {pending ? "J’envoie…" : chosen.length ? `Valider (${chosen.length})` : "Valider"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Tile({ item, at, playing, onTap }: { item: PickItem; at: number; playing: boolean; onTap: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const picked = at >= 0;

  // Only the last one picked plays (a dozen videos at once would stall a phone); the others show their first image.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) void v.play().catch(() => {});
    else {
      v.pause();
      if (v.currentTime > 0.5) v.currentTime = 0.1;
    }
  }, [playing]);

  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        aria-pressed={picked}
        aria-label={`${item.video ? "Vidéo" : "Photo"}${item.seconds ? ` de ${Math.round(item.seconds)} s` : ""}, ${item.day}${picked ? `, n° ${at + 1}` : ""}`}
        className="relative block aspect-square w-full overflow-hidden bg-white/5"
      >
        {item.video ? (
          <video ref={video} src={`${item.url}#t=0.1`} muted loop playsInline preload="metadata" className="size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" loading="lazy" className="size-full object-cover" />
        )}
        {item.video && item.seconds ? (
          <span className="absolute right-1.5 bottom-1.5 bg-black/60 px-1 font-mono text-[11px] leading-[16px] text-white">{formatDuration(item.seconds)}</span>
        ) : null}
        {picked && (
          <>
            <span className="pointer-events-none absolute inset-0 border-[3px] border-white bg-black/25" aria-hidden />
            <span className="absolute top-1.5 left-1.5 flex size-7 items-center justify-center bg-white text-[14px] font-bold text-ink" aria-hidden>
              {at + 1}
            </span>
          </>
        )}
      </button>
    </li>
  );
}
