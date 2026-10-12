"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpIcon,
  BulbIcon,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  ClockIcon,
  FilmIcon,
  InstagramIcon,
  MegaphoneIcon,
  MicIcon,
  PaperclipIcon,
  PenIcon,
  PlayIcon,
  RepeatIcon,
  ReplyIcon,
  TikTokIcon,
  UploadIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { Orb } from "@/components/orb";
import { demoClips, demoConversations, demoDraft, demoStudio } from "@/lib/demo";
import { whatsappLink } from "@/lib/public-env";

const shortcuts = [
  { label: "Faire un Reel avec mes vidéos", icon: FilmIcon, tone: "text-violet" },
  { label: "Préparer le post de jeudi", icon: CalendarIcon, tone: "text-coral-ink" },
  { label: "Idées de tournage de la semaine", icon: BulbIcon, tone: "text-violet" },
  { label: "Annoncer un atelier", icon: MegaphoneIcon, tone: "text-coral-ink" },
  { label: "Bilan de la semaine", icon: ChartIcon, tone: "text-violet" },
  { label: "Répondre aux messages Insta", icon: ReplyIcon, tone: "text-coral-ink" },
  { label: "Recycler un post qui a marché", icon: RepeatIcon, tone: "text-violet" },
  { label: "Ajuster le ton des légendes", icon: PenIcon, tone: "text-coral-ink" },
];

export function MilaChat() {
  const [view, setView] = useState<"home" | "thread">("home");
  const [scheduled, setScheduled] = useState(false);
  const [draft, setDraft] = useState("");

  const reset = () => {
    setView("home");
    setScheduled(false);
    setDraft("");
  };

  return (
    <div className="flex min-h-full flex-1">
      <section
        aria-label="Conversations"
        className="hidden w-[250px] shrink-0 flex-col gap-4 border-r border-line px-3.5 py-8 xl:flex"
      >
        <div className="flex items-center justify-between px-2">
          <h2 className="text-base font-bold">Conversations</h2>
          <button
            type="button"
            aria-label="Nouvelle conversation"
            onClick={reset}
            className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-soft"
          >
            <PenIcon />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {demoConversations.map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => setView("thread")}
              className="truncate rounded-[10px] px-3 py-2.5 text-left text-sm hover:bg-soft"
            >
              {title}
            </button>
          ))}
        </div>
      </section>

      <main className="flex min-w-0 flex-1 flex-col bg-soft">
        <div className="flex flex-wrap items-center justify-end gap-2.5 px-4 py-4 sm:px-7 sm:py-5">
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold">
            <span className="size-2 rounded-full bg-online" />
            WhatsApp connecté
          </span>
          <a
            href={whatsappLink()}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] font-bold"
          >
            <WhatsAppIcon size={16} />
            Continuer sur WhatsApp
          </a>
        </div>

        <div className="flex flex-1 flex-col items-center px-4 pt-2 sm:px-7">
          {view === "home" ? (
            <div className="flex w-full max-w-[860px] flex-col items-center gap-5 pt-6">
              <Orb size={104} />
              <h1 className="text-center text-4xl font-extrabold tracking-[-0.03em] sm:text-[52px]">
                Bonjour <span className="accent">{demoStudio.manager}</span>
              </h1>
              <p className="text-center text-[17px] text-muted">
                Cette semaine : 3 posts prévus, 1 publié. J’attends une vidéo pour jeudi.
              </p>
              <Link href="/mediatheque" className="btn btn-primary h-[52px] px-6.5">
                <UploadIcon />
                Déposer des vidéos
              </Link>
              <div className="mt-4 grid w-full grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
                {shortcuts.map(({ label, icon: Icon, tone }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDraft(label)}
                    className="flex min-h-[60px] items-center gap-3.5 rounded-2xl border border-line bg-white px-5 text-left text-[15px] font-semibold hover:border-lilac"
                  >
                    <Icon className={tone} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Thread scheduled={scheduled} onValidate={() => setScheduled(true)} />
          )}
        </div>

        <form
          className="flex justify-center px-4 pt-4 pb-7 sm:px-7"
          onSubmit={(e) => {
            e.preventDefault();
            setView("thread");
            setDraft("");
          }}
        >
          <div className="flex w-full max-w-[860px] items-center gap-2 rounded-[22px] border border-line bg-white py-2 pr-2 pl-3 shadow-[0_8px_24px_rgba(28,21,48,.06)]">
            <button
              type="button"
              aria-label="Joindre des fichiers"
              className="flex size-11 items-center justify-center rounded-[14px] text-muted"
            >
              <PaperclipIcon />
            </button>
            <label htmlFor="ask" className="sr-only">
              Message à Mila
            </label>
            <input
              id="ask"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Demandez à Mila…"
              className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <button type="button" aria-label="Dicter" className="flex size-11 items-center justify-center rounded-[14px] text-muted">
              <MicIcon />
            </button>
            <button
              type="submit"
              aria-label="Envoyer"
              className="flex size-11 items-center justify-center rounded-[14px] bg-violet text-white"
            >
              <ArrowUpIcon />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Thread({ scheduled, onValidate }: { scheduled: boolean; onValidate: () => void }) {
  return (
    <div className="flex w-full max-w-[820px] flex-col gap-6 pt-2 pb-6">
      <div className="flex max-w-[560px] flex-col items-end gap-2.5 self-end">
        <div className="grid w-full grid-cols-5 gap-2">
          {demoClips.map((clip, i) => (
            <div
              key={i}
              className="flex aspect-[9/16] flex-col justify-between rounded-xl p-2 text-white"
              style={{ background: clip.bg }}
            >
              <span className="self-end rounded-md bg-ink/55 px-1.5 py-0.5 text-[11px] font-bold">{clip.duration}</span>
              <PlayIcon size={16} />
            </div>
          ))}
        </div>
        <div className="rounded-[18px_18px_4px_18px] bg-violet px-4 py-3 text-[15px] leading-[1.45] text-white">
          Cours de ce matin, ambiance douce. Tu peux me faire un Reel pour jeudi ?
        </div>
      </div>

      <div className="flex items-start gap-3.5">
        <Orb size={36} className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <p className="text-[15px] leading-relaxed">
            J’ai gardé 3 plans sur 5 : les mains sur la barre en accroche, la correction de posture, puis le studio au
            lever du jour. 12 secondes, sous-titres et logo à la fin. Le plan 4 était un peu sombre, je l’ai écarté.
          </p>
          <div className="flex flex-wrap gap-4.5 rounded-[20px] border border-line bg-white p-4">
            <div
              className="relative flex aspect-[9/16] w-[180px] shrink-0 flex-col justify-between overflow-hidden rounded-[14px] p-3.5 text-white"
              style={{ background: "linear-gradient(160deg,#F6C9B8,#C86B5A)" }}
            >
              <span className="font-serif text-[26px] leading-[1.05] italic">
                {demoDraft.hook.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
              <span className="flex items-center justify-between">
                <span className="rounded-md bg-ink/55 px-2 py-0.5 text-[11px] font-bold">0:12</span>
                <span className="flex size-9 items-center justify-center rounded-full bg-white/90 text-violet">
                  <PlayIcon size={16} />
                </span>
              </span>
            </div>
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3">
              <span className="flex flex-wrap gap-2">
                <Chip icon={<InstagramIcon size={14} />}>Reel</Chip>
                <Chip icon={<TikTokIcon size={14} />}>TikTok</Chip>
                <Chip icon={<ClockIcon size={14} />} warm>
                  Jeu. 18:00
                </Chip>
              </span>
              <p className="text-sm leading-relaxed">{demoDraft.caption}</p>
              <p className="text-[13px] text-muted">{demoDraft.hashtags.map((h) => `#${h}`).join(" ")}</p>
              {scheduled ? (
                <span className="mt-auto inline-flex h-10 items-center gap-2 self-start rounded-full bg-success-soft px-4 text-sm font-bold text-success">
                  <CheckIcon size={16} />
                  Programmé jeudi à 18 h
                </span>
              ) : (
                <div className="mt-auto flex flex-wrap gap-2.5">
                  <button type="button" onClick={onValidate} className="btn btn-primary">
                    <CheckIcon size={18} />
                    Valider pour jeudi 18 h
                  </button>
                  <Link href={`/publications/${demoDraft.id}`} className="btn btn-secondary">
                    Modifier
                  </Link>
                </div>
              )}
            </div>
          </div>
          {scheduled && (
            <p className="text-[15px] leading-relaxed">
              Parfait. Je te relance mercredi pour la story « dernières places ». Tu peux me filmer 5 secondes du studio
              vide demain matin ?
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, icon, warm = false }: { children: React.ReactNode; icon: React.ReactNode; warm?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold ${
        warm ? "bg-peach text-peach-ink" : "bg-violet-soft text-violet"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}
