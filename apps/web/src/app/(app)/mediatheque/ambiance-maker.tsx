"use client";

import { CREDIT_PRICES, MAX_AMBIANCE_IMAGES, type AiImageFormat } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAmbianceImages } from "../ai-image-actions";

// « Image d'ambiance »: when she has no photo for a post with a text (planning,
// offer, tip), Edith makes generic images in her colours: a background, a
// material, a detail, an object. Never her place, her products or people.

const IDEAS = ["Un fond de matière douce et claire", "Une nature morte avec des plantes", "Un détail de bois et de lin à la lumière du matin"];
const FORMATS: { value: AiImageFormat; label: string }[] = [
  { value: "4:5", label: "Post 4:5" },
  { value: "1:1", label: "Carré" },
  { value: "9:16", label: "Story 9:16" },
];

export function AmbianceMaker() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [format, setFormat] = useState<AiImageFormat>("4:5");
  const [count, setCount] = useState(2);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const make = () =>
    start(async () => {
      setMessage(null);
      const res = await createAmbianceImages(text, format, count).catch(() => ({ ok: false as const, error: "Edith n’a pas réussi cette fois. Réessaie dans un instant." }));
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setMessage({ ok: true, text: res.count > 1 ? `${res.count} images ajoutées à ta médiathèque.` : "Image ajoutée à ta médiathèque." });
      setText("");
      router.refresh();
    });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn h-11 border border-line bg-white text-sm">
        Image d’ambiance
      </button>
    );
  }
  const price = count * CREDIT_PRICES.image;
  return (
    <div className="flex w-full max-w-[860px] flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-bold">Une image d’ambiance</h2>
        <p className="text-[13px] leading-snug text-muted">
          Pour poser un texte (planning, offre, conseil) quand tu n’as pas de photo : un fond, une matière, un détail, un objet, dans tes couleurs. Jamais ton lieu, tes produits ni des
          personnes : pour ça, tes vraies photos sont les meilleures.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={400}
        disabled={busy}
        placeholder="Ce qu’on y voit, ex. « des serviettes roulées sur du bois clair, lumière douce »"
        className="resize-none rounded-[12px] border border-line px-3 py-2 text-[14px] leading-snug outline-none focus:border-violet"
      />
      {!text && (
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => setText(idea)} className="h-7 rounded-full bg-soft px-2.5 text-[12px] font-semibold text-ink hover:text-violet">
              {idea}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={format === f.value}
            onClick={() => setFormat(f.value)}
            className={`h-8 rounded-full px-3 text-[12px] font-semibold ${format === f.value ? "bg-violet text-white" : "bg-soft text-ink"}`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-2 text-[12px] font-semibold text-muted">Combien</span>
        {Array.from({ length: MAX_AMBIANCE_IMAGES }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={count === n}
            onClick={() => setCount(n)}
            className={`size-8 rounded-full text-[12px] font-bold ${count === n ? "bg-violet text-white" : "bg-soft text-ink"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || text.trim().length < 3} onClick={make} className="btn btn-primary h-10 px-4 text-[14px] disabled:opacity-40">
          {busy ? "Edith crée tes images… (30 s environ)" : `Créer · ${price} crédit${price > 1 ? "s" : ""}`}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-[13px] font-semibold text-muted hover:text-ink">
          Fermer
        </button>
      </div>
      {message && <p className={`text-[13px] ${message.ok ? "text-muted" : "font-semibold text-danger"}`}>{message.text}</p>}
    </div>
  );
}
