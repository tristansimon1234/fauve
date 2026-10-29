// The looks a Reel can wear, the way Prequel's filters dress a phone video, drawn by the engine
// (apps/render/src/Looks.tsx): a grade over her footage and its animations, an overlay under the
// texts (grain, light, vignette, the camera's own marks), the texts left clean. Like the film dust,
// never by default: on her request (the editor, or Edith's `set_look`), or when the Reel she copies
// wears one. The plan holds it in `effect`.

/** The looks, besides the film dust. */
export const REEL_LOOKS = ["disposable", "vhs", "y2k", "cine", "bw"] as const;
export type ReelLook = (typeof REEL_LOOKS)[number];

/** What a Reel can wear over its whole video: the film dust, or a look. */
export const REEL_EFFECTS = ["dust", ...REEL_LOOKS] as const;
export type ReelEffect = (typeof REEL_EFFECTS)[number];

/** Each effect as she reads it: never the stored key. */
export const EFFECT_LABELS: Record<ReelEffect, { label: string; hint: string }> = {
  dust: { label: "Poussière de pellicule", hint: "des grains, une fibre, une rayure de temps en temps" },
  disposable: { label: "Appareil jetable", hint: "flash chaud, grain, coins sombres et la date en orange dans le coin" },
  vhs: { label: "Cassette VHS", hint: "couleurs qui bavent, lignes, « PLAY ▶ » et la date du caméscope" },
  y2k: { label: "Flash années 2000", hint: "flash direct, couleurs vives et un peu froides, grain fin" },
  cine: { label: "Ciné", hint: "ombres bleu-vert, peaux chaudes, grain fin, coins sombres" },
  bw: { label: "Noir et blanc", hint: "noir et blanc contrasté, grain" },
};

export const isReelEffect = (value: unknown): value is ReelEffect => typeof value === "string" && (REEL_EFFECTS as readonly string[]).includes(value);
export const isReelLook = (value: unknown): value is ReelLook => typeof value === "string" && (REEL_LOOKS as readonly string[]).includes(value);

const MONTHS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];

/**
 * The date a look prints, from the day of the render (YYYY-MM-DD in her time zone): a disposable
 * camera's « '26 10 29 », a VHS camcorder's « 29 OCT. 2026 »; nothing for the others.
 */
export function lookStamp(effect: ReelEffect | null | undefined, today: string | undefined): string | undefined {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today ?? "");
  if (!day || (effect !== "disposable" && effect !== "vhs")) return undefined;
  const [, year, month, date] = day as unknown as [string, string, string, string];
  if (effect === "disposable") return `'${year.slice(2)} ${month} ${date}`;
  return `${Number(date)} ${MONTHS[Number(month) - 1] ?? ""} ${year}`;
}

/** Today in a time zone, as lookStamp reads it. */
export function dayIn(timeZone = "Europe/Paris", at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
