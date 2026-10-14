"use client";

import { defaultLook, resolveBrandLook, type BrandPalette, type SavedLook, type TextLook } from "@fauve/agent";
import { useEffect } from "react";

// A text's style in one tap, for people who are not designers: each choice is
// drawn as it will look (font, colours, background, outline), on a dark photo-
// like tile. The studio's saved styles first, then a few ready-made ones in its
// colours, and the plain style of the montage. No settings: anything finer is
// asked of Brigitte.

type Role = "hook" | "band" | "caption";
export type StyleBrand = { accent: string; accentInk: string; displayFont: string; bodyFont: string; palette?: BrandPalette };

const SIZE: Record<Role, number> = { hook: 110, band: 54, caption: 46 };
const ENTER: Record<Role, TextLook["enter"]> = { hook: "pop", band: "slide", caption: "rise" };

const luminance = (hex: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0.5;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/**
 * Ready-made styles drawn from the studio's brand: its title and text fonts and its
 * colours by role (never a fixed font or colour), so they follow the brand when it changes.
 */
export function stylePresets(role: Role, brand: StyleBrand): { name: string; look: TextLook }[] {
  const base = { italic: false, uppercase: false, size: SIZE[role], letter_spacing: 0, line_height: 1.05, align: "center", rotate: 0, enter: ENTER[role] } as const;
  const onSecondary = luminance(brand.palette?.secondary ?? brand.accent) > 0.45 ? "dark" : "light";
  return [
    {
      name: "Percutant",
      look: { ...base, font: "brand_display", weight: 900, uppercase: true, letter_spacing: 0.01, color: "light", shadow: "hard", stroke: { color: "dark", width: 4 }, emphasis: { color: "accent" } },
    },
    {
      name: "Bloc couleur",
      look: { ...base, font: "brand_body", weight: 800, color: "accent_ink", shadow: "none", fill: { kind: "box", color: "accent", opacity: 1, radius: 6 } },
    },
    {
      name: "Bloc 2e couleur",
      look: { ...base, font: "brand_body", weight: 800, uppercase: true, letter_spacing: 0.06, color: onSecondary, shadow: "none", fill: { kind: "box", color: "secondary", opacity: 1, radius: 0 }, rotate: -2, enter: "slide" },
    },
    {
      name: "Étiquette",
      look: { ...base, font: "brand_body", weight: 700, color: "light", shadow: "none", fill: { kind: "pill", color: "dark", opacity: 0.75 } },
    },
    {
      name: "Surligné",
      look: { ...base, font: "brand_body", weight: 800, line_height: 1.25, color: "dark", shadow: "none", fill: { kind: "line", color: "light", opacity: 1, radius: 4 } },
    },
    {
      name: "Élégant",
      look: { ...base, font: "brand_display", weight: 400, italic: true, letter_spacing: 0.01, color: "light", shadow: "soft", enter: "fade" },
    },
  ];
}

const same = (a?: TextLook, b?: TextLook) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const loadedFonts = new Set<string>();

/** Loads the families the tiles are drawn with (the player loads its own). */
export function useFonts(families: string[]) {
  const key = [...new Set(families)].sort().join("|");
  useEffect(() => {
    for (const family of key.split("|")) {
      if (!family || loadedFonts.has(family) || !/^[A-Za-z0-9 ]{2,40}$/.test(family)) continue;
      loadedFonts.add(family);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${family.trim().replace(/ +/g, "+")}:ital,wght@0,400;0,700;0,800;1,600&display=swap`;
      link.onerror = () => {
        // A family without those weights: ask for it plain.
        link.href = `https://fonts.googleapis.com/css2?family=${family.trim().replace(/ +/g, "+")}&display=swap`;
        link.onerror = null;
      };
      document.head.appendChild(link);
    }
  }, [key]);
}

export function StylePicker({
  role,
  look,
  saved,
  brand,
  sample,
  onChange,
}: {
  role: Role;
  look: TextLook | undefined;
  saved: SavedLook[];
  brand: StyleBrand;
  /** The text's own words, drawn on each tile (cut short). */
  sample: string;
  onChange: (look: TextLook | undefined) => void;
}) {
  const plain = defaultLook(role, { display: brand.displayFont, body: brand.bodyFont });
  const choices = [
    ...saved.map((s) => ({ key: `saved:${s.name}`, name: s.name, look: s.look as TextLook | undefined, preview: s.look })),
    ...stylePresets(role, brand).map((p) => ({ key: `preset:${p.name}`, name: p.name, look: p.look as TextLook | undefined, preview: p.look })),
    { key: "plain", name: "Simple", look: undefined as TextLook | undefined, preview: plain },
  ];
  // A style Brigitte made for this text only: shown first, so it is never lost by a tap.
  const own = look && !choices.some((c) => same(c.look, look)) ? { key: "own", name: "Actuel", look, preview: look } : null;
  const all = own ? [own, ...choices] : choices;
  useFonts(all.map((c) => resolveBrandLook(c.preview, brand).font));
  const words = (sample.trim() || "Ton texte").split(/\s+/).slice(0, 2).join(" ").slice(0, 14);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-muted">Style</span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Style du texte">
        {all.map((c) => {
          const on = c.key === "own" || same(c.look, look);
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(c.look)}
              className={`group flex min-w-0 flex-col items-center gap-1 rounded-[14px] p-1 transition-shadow ${on ? "ring-2 ring-violet" : "hover:ring-1 hover:ring-lilac"}`}
            >
              <StyleTile look={resolveBrandLook(c.preview, brand)} brand={brand} words={words} on={on} />
              <span className={`w-full truncate text-center text-[11px] font-semibold ${on ? "text-violet" : "text-muted"}`}>{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One style drawn small on a dark, photo-like tile; it plays its entrance when hovered or chosen. */
export function StyleTile({ look, brand, words, on }: { look: TextLook; brand: StyleBrand; words: string; on: boolean }) {
  const color = (c: string) => (c === "accent" ? brand.accent : c === "accent_ink" ? brand.accentInk : c);
  const withAlpha = (c: string, alpha: number) => {
    const hex = color(c);
    if (alpha >= 1 || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r},${g},${b},${alpha})`;
  };
  const size = Math.max(11, Math.min(15, look.size / 8));
  const fill = look.fill;
  const shadow = { none: "none", soft: "0 1px 6px rgba(0,0,0,.45)", strong: "0 2px 4px rgba(0,0,0,.8)", hard: "2px 2px 0 rgba(0,0,0,.85)" }[look.shadow];
  return (
    <span className="flex h-[58px] w-full items-center justify-center overflow-hidden rounded-[10px] bg-[linear-gradient(160deg,#6b5a7a_0%,#3a2f45_55%,#1d1726_100%)] px-1.5">
      <span className="inline-block max-w-full" style={{ transform: look.rotate ? `rotate(${look.rotate}deg)` : undefined }}>
        <span
          className={`fauve-tile-anim line-clamp-2 max-w-full text-center break-words ${on ? "is-on" : ""}`}
          style={{ lineHeight: fill?.kind === "line" ? 1.35 : 1.1, ["--tile-anim" as string]: look.enter === "none" ? "none" : `fauve-tile-${look.enter}` }}
        >
          <span
            style={{
              fontFamily: `"${look.font}", sans-serif`,
              fontWeight: look.weight,
              fontStyle: look.italic ? "italic" : "normal",
              textTransform: look.uppercase ? "uppercase" : "none",
              letterSpacing: `${look.letter_spacing}em`,
              fontSize: size,
              color: color(look.color),
              textShadow: shadow,
              WebkitTextStroke: look.stroke ? `${Math.max(0.5, look.stroke.width / 6)}px ${color(look.stroke.color)}` : undefined,
              paintOrder: "stroke fill",
              ...(fill
                ? {
                    background: withAlpha(fill.color, fill.opacity),
                    padding: fill.kind === "line" ? "0 3px" : "2px 7px",
                    borderRadius: fill.kind === "pill" ? 999 : Math.min(6, (fill.radius ?? 0) / 2),
                    boxDecorationBreak: "clone",
                    WebkitBoxDecorationBreak: "clone",
                    display: fill.kind === "line" ? "inline" : "inline-block",
                  }
                : {}),
            }}
          >
            {words}
          </span>
        </span>
      </span>
    </span>
  );
}
