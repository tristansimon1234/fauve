"use client";

import { CREDIT_PRICES, cropsMuch, PHOTO_IMPROVEMENTS, type PhotoImprovement } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { improvePostPhoto } from "@/app/(app)/ai-image-actions";

// « Améliorer avec Edith »: the image model retouches the photo without
// changing what it shows (extended to the frame instead of cropped, a tidier
// background, better light, or her own words). The new photo takes the
// original's place on the post; the original stays in her library. 1 credit.

export function PhotoImprove({ postId, mediaId, url, disabled }: { postId: string; mediaId: string; url: string; disabled?: boolean }) {
  const router = useRouter();
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [extend, setExtend] = useState(false);
  const [, start] = useTransition();

  // « Agrandir sans couper » only for a photo the 4:5 frame would cut much of.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setExtend(cropsMuch(img.naturalWidth, img.naturalHeight, "4:5"));
    img.src = url;
  }, [url]);

  const run = (change: string, label: string) => {
    setBusy(label);
    setMessage(null);
    start(async () => {
      const res = await improvePostPhoto(postId, mediaId, change).catch(() => ({ ok: false as const, error: "Edith n’a pas réussi cette fois. Réessaie dans un instant." }));
      setBusy(null);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setWish("");
      setMessage({ ok: true, text: "C’est fait : la photo améliorée remplace l’originale, qui reste dans ta médiathèque." });
      router.refresh();
    });
  };

  const quick = (Object.keys(PHOTO_IMPROVEMENTS) as PhotoImprovement[]).filter((k) => k !== "extend" || extend);
  const price = `${CREDIT_PRICES.image} crédit`;
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold">Améliorer avec Edith</span>
        <span className="text-[11px] font-semibold text-muted">{price} · IA</span>
      </span>
      {busy ? (
        <p className="text-[13px] text-muted" aria-live="polite">
          Edith retouche ta photo… (20 secondes environ)
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {quick.map((k) => (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => run(k, PHOTO_IMPROVEMENTS[k].label)}
                className="fauve-press h-8 rounded-full bg-soft px-3 text-[12px] font-semibold text-ink hover:text-violet disabled:opacity-40"
              >
                {PHOTO_IMPROVEMENTS[k].label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (wish.trim().length >= 3) run(wish.trim(), "custom");
            }}
            className="flex items-center gap-1.5"
          >
            <input
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              maxLength={400}
              disabled={disabled}
              placeholder="Ou dis-le : « enlève la poubelle à gauche »"
              className="h-9 min-w-0 flex-1 rounded-full border border-line bg-white px-3.5 text-[13px] outline-none focus:border-violet disabled:opacity-40"
            />
            <button type="submit" disabled={disabled || wish.trim().length < 3} className="btn btn-primary h-9 shrink-0 px-3.5 text-[13px] disabled:opacity-40">
              OK
            </button>
          </form>
        </>
      )}
      {disabled && !busy && <p className="text-[12px] text-muted">Enregistre d’abord tes changements.</p>}
      {message && <p className={`text-[12px] leading-snug ${message.ok ? "text-muted" : "font-semibold text-danger"}`}>{message.text}</p>}
      <p className="text-[11px] leading-snug text-muted">Ce qu’elle montre ne change pas : ton lieu, tes produits et les personnes restent tels quels.</p>
    </div>
  );
}
