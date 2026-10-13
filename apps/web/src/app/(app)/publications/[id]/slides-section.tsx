"use client";

import type { ReelInputs, SavedLook, SlidesPlan } from "@fauve/agent";
import { useState, useTransition } from "react";
import { SlidesEditor } from "@/components/montage/slides-editor";
import { saveSlidesPlan } from "./actions";

/** Text over the photos on the publication page: edit live, save, the images follow in a minute. */
export function SlidesSection({
  postId,
  initialPlan,
  photos,
  brand,
  looks,
}: {
  postId: string;
  initialPlan: SlidesPlan;
  photos: Record<string, string>;
  brand: ReelInputs["brand"];
  looks: SavedLook[];
}) {
  const [saved, setSaved] = useState(initialPlan);
  const [plan, setPlan] = useState(initialPlan);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, start] = useTransition();
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved);

  const save = () =>
    start(async () => {
      const res = await saveSlidesPlan(postId, plan).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
      if (res.ok) {
        setSaved(plan);
        setMessage({ ok: true, text: "Enregistré. Les images finales se mettent à jour (environ une minute)." });
      } else setMessage({ ok: false, text: res.error });
    });

  return (
    <div className="flex max-w-[460px] flex-col gap-4">
      <SlidesEditor
        plan={plan}
        onChange={(next) => {
          setPlan(next);
          setMessage(null);
        }}
        photos={photos}
        brand={brand}
        looks={looks}
        previewWidth="min(100%, 400px)"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!dirty || saving} onClick={save} className="btn btn-primary disabled:opacity-50">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {dirty && !saving && (
          <button type="button" onClick={() => setPlan(saved)} className="btn btn-secondary">
            Annuler
          </button>
        )}
        {message && (
          <p role="status" className={`text-sm ${message.ok ? "text-muted" : "font-semibold text-danger"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
