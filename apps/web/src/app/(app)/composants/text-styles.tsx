"use client";

import { resolveBrandLook, type SavedLook } from "@fauve/agent";
import Link from "next/link";
import { DeleteButton } from "@/components/delete-button";
import { StyleTile, stylePresets, useFonts, type StyleBrand } from "@/components/montage/style-picker";
import { removeTextLook } from "./actions";

// The text styles tab of « Tes créations »: the brand they all follow (its two fonts
// and colours, set in Style), the studio's saved styles, and the ready-made ones
// drawn from its brand. A tile plays its entrance when hovered.

export function TextStyles({ brand, colors, saved }: { brand: StyleBrand; colors: string[]; saved: SavedLook[] }) {
  const presets = stylePresets("hook", brand);
  useFonts([brand.displayFont, brand.bodyFont, ...[...saved.map((s) => s.look), ...presets.map((p) => p.look)].map((l) => resolveBrandLook(l, brand).font)]);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-bold">Ta charte</h2>
          <Link href="/style" className="text-[13px] font-bold text-violet hover:underline">
            Modifier dans Style
          </Link>
        </div>
        <p className="text-[13.5px] leading-relaxed text-muted">Tous tes textes suivent ces deux polices et ces couleurs : change-les ici, et tes styles suivent.</p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <span className="flex flex-col">
            <span className="text-[11px] font-bold tracking-wide text-muted uppercase">Titres</span>
            <span className="text-[26px] leading-tight" style={{ fontFamily: `"${brand.displayFont}", serif` }}>
              {brand.displayFont}
            </span>
          </span>
          <span className="flex flex-col">
            <span className="text-[11px] font-bold tracking-wide text-muted uppercase">Texte</span>
            <span className="text-[18px] leading-tight" style={{ fontFamily: `"${brand.bodyFont}", sans-serif` }}>
              {brand.bodyFont}
            </span>
          </span>
          <span className="flex gap-1.5" aria-label="Couleurs de ta charte">
            {(colors.length ? colors : [brand.accent]).map((c) => (
              <span key={c} title={c} className="size-8 rounded-full border border-line" style={{ background: c }} />
            ))}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Tes styles</h2>
        {saved.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {saved.map((s) => (
              <li key={s.name} className="group flex flex-col gap-1.5 rounded-[16px] border border-line bg-white p-2">
                <StyleTile look={resolveBrandLook(s.look, brand)} brand={brand} words="Ton texte ici" on={false} />
                <span className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{s.name}</span>
                  <DeleteButton compact label="Retirer" action={removeTextLook.bind(null, s.name)} confirmText="Retirer ce style ? Les textes qui l’utilisent gardent leur apparence." />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">Pas encore de style à toi : demande à Brigitte un texte « comme sur cette image », elle le garde ici.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Prêts à l’emploi, à tes couleurs</h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {presets.map((p) => (
            <li key={p.name} className="group flex flex-col gap-1.5 rounded-[16px] border border-line bg-white p-2">
              <StyleTile look={resolveBrandLook(p.look, brand)} brand={brand} words="Ton texte ici" on={false} />
              <span className="truncate text-[13px] font-semibold">{p.name}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
