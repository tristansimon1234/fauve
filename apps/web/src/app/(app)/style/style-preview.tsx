"use client";

import type { CSSProperties } from "react";
// Global stylesheet (this project's Turbopack CSS rule makes every .css global): rp- prefix.
import "./style-preview.css";
import { TEMPLATE_LABELS, fontStack, inkOn, type Logo, type Template } from "./style-options";

const HOOK = ["Ton", "dos", "te", "dira", "merci"];
const HOOK_ACCENT = 4;
const STAGGER: Record<Template, number> = { doux: 0.13, dynamique: 0.06, chic: 0.2 };

/**
 * A 9:16 frame showing the look of a Reel with the current style: hook in the
 * display font, band in the main colour, caption in the body font, end card.
 * The real render is done by Remotion; this only previews colours, fonts and
 * the template's movement.
 */
export function StylePreview({
  template,
  accent,
  displayFont,
  bodyFont,
  logo,
  studioName,
}: {
  template: Template;
  accent: string;
  displayFont: string;
  bodyFont: string;
  logo: Logo;
  studioName: string;
}) {
  const vars = {
    "--display": fontStack(displayFont, "serif"),
    "--body": fontStack(bodyFont),
    "--accent": accent,
    "--accent-ink": inkOn(accent),
  } as CSSProperties;

  return (
    <figure className="flex flex-col items-center gap-3">
      {/* key restarts the loop when the template changes. */}
      <div
        key={template}
        className={`rp-phone rp-${template} max-w-[300px]`}
        style={vars}
        role="img"
        aria-label={`Aperçu du style, gabarit ${TEMPLATE_LABELS[template]} : accroche « ${HOOK.join(" ")} », bandeau, sous-titre et carte de fin avec ${logo ? "le logo" : "le nom du studio"}.`}
      >
        <div className="rp-footage" />
        <div className="rp-shade" />
        <div className="rp-hook" aria-hidden="true">
          {HOOK.map((word, i) => (
            <span key={i} className="rp-word" style={{ animationDelay: `${(i * STAGGER[template]).toFixed(2)}s` }}>
              <span className={i === HOOK_ACCENT ? "rp-accent" : undefined}>{word}</span>
              {i < HOOK.length - 1 ? " " : ""}
            </span>
          ))}
        </div>
        <div className="rp-band-row" aria-hidden="true">
          <span className="rp-band">Reformer · 45 min</span>
        </div>
        <p className="rp-caption" aria-hidden="true">
          Le cours du mardi 18 h, en douceur et en musique.
        </p>
        <div className="rp-end-card" aria-hidden="true">
          <div className="rp-end-inner">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.url} alt="" className="rp-logo" />
            ) : (
              <span className="rp-studio-name">{studioName}</span>
            )}
            <span className="rp-cta">Réserve ton cours</span>
            <span className="rp-cta-note">Lien en bio</span>
          </div>
        </div>
      </div>
      <figcaption className="max-w-[300px] text-center text-[13px] leading-snug text-muted">
        Aperçu du rendu, pas la vidéo finale : Fauve monte chaque Reel avec tes vrais clips.
      </figcaption>
    </figure>
  );
}

/** The template card's tiny animation: two words in the template's temperament. */
export function TemplateMini({ template, displayFont, words }: { template: Template; displayFont: string; words: string[] }) {
  return (
    <div
      className={`rp-mini rp-${template}`}
      style={{ "--display": fontStack(displayFont, "serif") } as CSSProperties}
      aria-hidden="true"
    >
      <span>
        {words.map((word, i) => (
          <span key={i} className="rp-word" style={{ animationDelay: `${(i * STAGGER[template] * 1.6).toFixed(2)}s` }}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </div>
  );
}
