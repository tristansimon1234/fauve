"use client";

import { useRef, useState, useTransition } from "react";
import { FileStrip, MAX_FILES, useChatUploads } from "@/app/(app)/fauve/chat-uploads";
import { ImageIcon, WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { whatsappLink } from "@/lib/public-env";
import { sendDropped } from "./actions";

/** Pick in her gallery, watch them go up, send them to Edith; then back to WhatsApp. */
export function DropView({ studioId }: { studioId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ count: number; answered: boolean } | null>(null);
  const [pending, start] = useTransition();
  const uploads = useChatUploads(studioId, setError);
  const input = useRef<HTMLInputElement>(null);
  const failed = uploads.files.some((f) => f.status === "error");

  const send = () =>
    start(async () => {
      setError(null);
      const res = await sendDropped(uploads.attachments()).catch(() => ({ ok: false as const, error: "Ça n’est pas passé. Réessaie dans un instant." }));
      if (!res.ok) return setError(res.error);
      uploads.clear();
      setSent({ count: res.count, answered: res.answered });
    });

  if (sent !== null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot size={96} mood="happy" />
        <h1 className="text-[24px] font-extrabold tracking-[-0.01em]">C’est reçu, merci !</h1>
        <p className="text-[15px] leading-snug text-white/80">
          {sent.count > 1 ? `Tes ${sent.count} fichiers sont arrivés` : "Ton fichier est arrivé"} en pleine qualité.{" "}
          {sent.answered ? "Je t’ai écrit sur WhatsApp : je les regarde et je reviens vers toi." : "Envoie-moi le petit message tout prêt sur WhatsApp, et je m’y mets."}
        </p>
        {/* WhatsApp never lets a link send a message by itself: when Edith cannot write first, hers is ready to send. */}
        <a
          href={whatsappLink(sent.answered ? "" : `C’est envoyé ! ${sent.count > 1 ? `${sent.count} fichiers` : "1 fichier"} 📎`)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-extrabold text-ink"
        >
          <WhatsAppIcon size={18} /> {sent.answered ? "Retourner sur WhatsApp" : "Prévenir Edith sur WhatsApp"}
        </a>
        <button type="button" onClick={() => setSent(null)} className="text-[13.5px] font-semibold text-white/70 underline underline-offset-3">
          En envoyer d’autres
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-3">
        <Mascot size={56} mood="idle" />
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.01em]">Envoie-moi tes photos et vidéos</h1>
          <p className="text-[14px] leading-snug text-white/75">En pleine qualité, directement depuis ta galerie.</p>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          setError(null);
          if (e.target.files?.length) uploads.addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={uploads.files.length >= MAX_FILES}
        className="flex flex-col items-center gap-2 rounded-[22px] border-2 border-dashed border-white/30 bg-white/5 px-4 py-8 text-center hover:border-white/60 disabled:opacity-50"
      >
        <ImageIcon size={28} />
        <span className="text-[16px] font-extrabold">{uploads.files.length ? "En ajouter" : "Choisir dans ma galerie"}</span>
        <span className="text-[12.5px] text-white/60">Jusqu’à {MAX_FILES} fichiers</span>
      </button>

      <div className="rounded-[18px] bg-white p-2 empty:hidden">
        <FileStrip files={uploads.files} onRemove={uploads.removeFile} />
      </div>

      {error && <p className="text-[13.5px] leading-snug text-[#FFB4A3]">{error}</p>}
      {failed && !error && <p className="text-[13.5px] leading-snug text-[#FFB4A3]">Un fichier n’est pas passé : retire-le et réessaie.</p>}

      <button
        type="button"
        onClick={send}
        disabled={!uploads.ready.length || uploads.uploading || pending}
        className="mt-auto rounded-full bg-violet px-5 py-3.5 text-[16px] font-extrabold text-white disabled:opacity-40"
      >
        {uploads.uploading ? "Envoi en cours…" : pending ? "J’envoie à Edith…" : uploads.ready.length ? `Envoyer à Edith (${uploads.ready.length})` : "Envoyer à Edith"}
      </button>
    </main>
  );
}
