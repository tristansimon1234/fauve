"use client";

import { defaultLook, type SavedLook, type TextLook } from "@fauve/agent";
import { useState, useTransition } from "react";
import { saveTextLook } from "./look-actions";

// A text's look, by hand: the template's style, one of the studio's saved looks
// (often copied by Fauve from an example), or any mix of font, colours, fill,
// outline, shadow, tilt and entrance. The same controls on the scene editor,
// the carousel editor and the mobile page.

const FONTS = [
  "Anton",
  "Bebas Neue",
  "Oswald",
  "Archivo Black",
  "League Gothic",
  "Montserrat",
  "Poppins",
  "Plus Jakarta Sans",
  "Outfit",
  "Inter",
  "Playfair Display",
  "DM Serif Display",
  "Fraunces",
  "Cormorant Garamond",
  "Instrument Serif",
  "Caveat",
  "Pacifico",
  "Dancing Script",
  "Kalam",
  "Courier Prime",
  "Space Mono",
  "Nunito",
  "Quicksand",
  "Fredoka",
];

const fills = [
  { value: "none", label: "Aucun" },
  { value: "box", label: "Bloc" },
  { value: "pill", label: "Pilule" },
  { value: "line", label: "Surligné" },
] as const;
const shadows = [
  { value: "none", label: "Aucune" },
  { value: "soft", label: "Douce" },
  { value: "strong", label: "Marquée" },
  { value: "hard", label: "Décalée" },
] as const;
const enters = [
  { value: "fade", label: "Fondu" },
  { value: "rise", label: "Montée" },
  { value: "pop", label: "Pop" },
  { value: "typewriter", label: "Machine à écrire" },
  { value: "slide", label: "Glissé" },
  { value: "none", label: "Aucune" },
] as const;
const weights = [
  { value: 400, label: "Normal" },
  { value: 700, label: "Gras" },
  { value: 900, label: "Très gras" },
] as const;

type Role = "hook" | "band" | "caption";

const same = (a?: TextLook, b?: TextLook) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function LookPanel({
  role,
  look,
  saved,
  brand,
  video = true,
  advanced = false,
  onChange,
}: {
  role: Role;
  look: TextLook | undefined;
  saved: SavedLook[];
  /** The studio's colours and fonts, to show « accent » and start a look by hand. */
  brand: { accent: string; accentInk: string; displayFont: string; bodyFont: string };
  /** Entrances only matter in a video. */
  video?: boolean;
  /** Every setting (font, colours, fill…) by hand; off by default: the manager picks a saved style or asks Fauve. */
  advanced?: boolean;
  onChange: (look: TextLook | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [looks, setLooks] = useState(saved);
  const [saving, startSaving] = useTransition();
  const [savedName, setSavedName] = useState<string | null>(null);
  const current = looks.find((l) => same(l.look, look));
  const hex = (c: string) => (c === "accent" ? brand.accent : c === "accent_ink" ? brand.accentInk : c);
  const set = (patch: Partial<TextLook>) => onChange({ ...(look ?? defaultLook(role, { display: brand.displayFont, body: brand.bodyFont })), ...patch });
  const chip = (on: boolean) => `h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold ${on ? "bg-violet text-white" : "bg-soft text-muted hover:text-ink"}`;

  const keep = () => {
    if (!look) return;
    const name = window.prompt("Nom de ce style (ex. « Titre jaune »)", current?.name ?? "")?.trim();
    if (!name) return;
    startSaving(async () => {
      const res = await saveTextLook(name, role, look).catch(() => null);
      if (res?.ok) {
        setLooks(res.looks);
        setSavedName(name);
      }
    });
  };

  if (!advanced && !looks.length && !look) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-muted">Style</span>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
          <button type="button" onClick={() => onChange(undefined)} className={chip(!look)}>
            Gabarit
          </button>
          {looks.map((l) => (
            <button
              key={l.name}
              type="button"
              title={`${l.name} · ${l.look.font}`}
              onClick={() => onChange(l.look)}
              className={chip(current?.name === l.name)}
              style={{ fontFamily: `"${l.look.font}", sans-serif` }}
            >
              {l.name}
            </button>
          ))}
          {look && !current && <span className={chip(true)}>Perso</span>}
        </div>
      </div>

      {advanced && (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="self-start text-[12px] font-bold text-violet hover:underline"
      >
        {open ? "Masquer les réglages" : look ? "Régler la police, les couleurs, le fond…" : "Personnaliser (police, couleurs, fond…)"}
      </button>
      )}

      {advanced && open && (
        <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-3">
          <Row label="Police">
            <select
              value={look?.font ?? ""}
              onChange={(e) => set({ font: e.target.value })}
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-line bg-white px-2 text-[13px]"
              style={{ fontFamily: look ? `"${look.font}", sans-serif` : undefined }}
            >
              {!look && <option value="">Celle du gabarit</option>}
              {[...new Set([...(look ? [look.font] : []), ...FONTS])].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Lettres">
            {weights.map((w) => (
              <button key={w.value} type="button" onClick={() => set({ weight: w.value })} className={chip(look?.weight === w.value)}>
                {w.label}
              </button>
            ))}
            <button type="button" aria-pressed={look?.italic ?? false} onClick={() => set({ italic: !look?.italic })} className={chip(Boolean(look?.italic))}>
              <em>Italique</em>
            </button>
            <button type="button" aria-pressed={look?.uppercase ?? false} onClick={() => set({ uppercase: !look?.uppercase })} className={chip(Boolean(look?.uppercase))}>
              MAJ
            </button>
          </Row>
          <Row label="Couleur">
            <input
              type="color"
              aria-label="Couleur du texte"
              value={hex(look?.color ?? "#ffffff")}
              onChange={(e) => set({ color: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded-[8px] border border-line bg-white"
            />
            <span className="text-[12px] text-muted">Mots en valeur</span>
            <input
              type="color"
              aria-label="Couleur des mots en valeur"
              value={hex(look?.emphasis?.color ?? brand.accent)}
              onChange={(e) => set({ emphasis: { ...(look?.emphasis ?? {}), color: e.target.value } })}
              className="h-9 w-12 cursor-pointer rounded-[8px] border border-line bg-white"
            />
          </Row>
          <Row label="Fond">
            {fills.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() =>
                  set({ fill: f.value === "none" ? undefined : { kind: f.value, color: look?.fill?.color ?? "accent", opacity: look?.fill?.opacity ?? 1, radius: look?.fill?.radius } })
                }
                className={chip((look?.fill?.kind ?? "none") === f.value && Boolean(look))}
              >
                {f.label}
              </button>
            ))}
          </Row>
          {look?.fill && (
            <Row label="">
              <input
                type="color"
                aria-label="Couleur du fond"
                value={hex(look.fill.color)}
                onChange={(e) => set({ fill: { ...look.fill!, color: e.target.value } })}
                className="h-9 w-12 cursor-pointer rounded-[8px] border border-line bg-white"
              />
              <label className="flex flex-1 items-center gap-2 text-[12px] text-muted">
                Opacité
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={look.fill.opacity}
                  onChange={(e) => set({ fill: { ...look.fill!, opacity: Number(e.target.value) } })}
                  className="flex-1 accent-violet"
                />
              </label>
            </Row>
          )}
          <Row label="Contour">
            <button type="button" onClick={() => set({ stroke: look?.stroke ? undefined : { color: "#000000", width: 4 } })} className={chip(Boolean(look?.stroke))}>
              {look?.stroke ? "Oui" : "Non"}
            </button>
            {look?.stroke && (
              <>
                <input
                  type="color"
                  aria-label="Couleur du contour"
                  value={hex(look.stroke.color)}
                  onChange={(e) => set({ stroke: { ...look.stroke!, color: e.target.value } })}
                  className="h-9 w-12 cursor-pointer rounded-[8px] border border-line bg-white"
                />
                <input
                  type="range"
                  aria-label="Épaisseur du contour"
                  min={1}
                  max={16}
                  step={1}
                  value={look.stroke.width}
                  onChange={(e) => set({ stroke: { ...look.stroke!, width: Number(e.target.value) } })}
                  className="min-w-0 flex-1 accent-violet"
                />
              </>
            )}
          </Row>
          <Row label="Ombre">
            {shadows.map((s) => (
              <button key={s.value} type="button" onClick={() => set({ shadow: s.value })} className={chip(look?.shadow === s.value)}>
                {s.label}
              </button>
            ))}
          </Row>
          <Row label="Penché">
            <input
              type="range"
              aria-label="Inclinaison"
              min={-12}
              max={12}
              step={1}
              value={look?.rotate ?? 0}
              onChange={(e) => set({ rotate: Number(e.target.value) })}
              className="min-w-0 flex-1 accent-violet"
            />
            <span className="w-10 text-right text-[12px] text-muted">{look?.rotate ?? 0}°</span>
          </Row>
          {video && (
            <Row label="Arrivée">
              {enters.map((e) => (
                <button key={e.value} type="button" onClick={() => set({ enter: e.value })} className={chip(look?.enter === e.value)}>
                  {e.label}
                </button>
              ))}
            </Row>
          )}
          {look && (
            <div className="flex items-center gap-2 border-t border-line pt-2.5">
              <button type="button" disabled={saving} onClick={keep} className="text-[12px] font-bold text-violet hover:underline disabled:opacity-50">
                {saving ? "Enregistrement…" : current ? "Renommer ce style" : "Garder ce style pour mes prochains textes"}
              </button>
              {savedName && <span className="text-[12px] text-success">« {savedName} » gardé</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[58px] shrink-0 text-[12px] font-semibold text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
