import { z } from "zod";

// Photo retouching and blurring. Gemini looks (faces, number plates, screens,
// light, horizon, subject) and returns numbers; the render composition applies
// them with deterministic CSS (filters, crop, rotation, backdrop blur). The
// model decides, the engine executes; the original file is never touched.

/** Light and framing, all optional: 0 means unchanged. */
export const adjustSchema = z.object({
  exposure: z.number().min(-1).max(1).optional().describe("Luminosité : -1 plus sombre, 1 plus clair"),
  contrast: z.number().min(-1).max(1).optional(),
  saturation: z.number().min(-1).max(1).optional(),
  warmth: z.number().min(-1).max(1).optional().describe("-1 plus froid (bleu), 1 plus chaud (orangé)"),
  straighten: z.number().min(-10).max(10).optional().describe("Redressement en degrés (horizon penché)"),
  /** The point the crop keeps in view (share of the width and height of the source). */
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  zoom: z.number().min(1).max(1.6).optional(),
});
export type Adjust = z.infer<typeof adjustSchema>;

export const regionKindSchema = z.enum(["face", "plate", "screen", "document", "other"]);
export type RegionKind = z.infer<typeof regionKindSchema>;

/** A zone of the source image (shares of its width and height). */
export const boxSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) });
export type Box = z.infer<typeof boxSchema>;

export const blurRegionSchema = boxSchema.extend({ kind: regionKindSchema, shape: z.enum(["ellipse", "rect"]) });
export type BlurRegion = z.infer<typeof blurRegionSchema>;

/** A photo's retouch, stored on its slide: the source size places the blur exactly. */
export const photoEditSchema = z.object({
  source: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  adjust: adjustSchema.optional(),
  blur: z.array(blurRegionSchema).max(24).optional(),
});
export type PhotoEdit = z.infer<typeof photoEditSchema>;

/** Blur over a video clip: tracked zones, a box per moment (seconds in the clip), in between interpolated. */
export const clipBlurSchema = z.object({
  /** Width / height of the source video. */
  aspect: z.number().min(0.3).max(3),
  tracks: z
    .array(z.object({ kind: regionKindSchema, keys: z.array(boxSchema.extend({ t: z.number().min(0) })).min(1).max(240) }))
    .max(12),
});
export type ClipBlur = z.infer<typeof clipBlurSchema>;

// ---------------------------------------------------------------------------
// What Gemini returns.
// ---------------------------------------------------------------------------

/** Gemini's boxes: [ymin, xmin, ymax, xmax] on a 0–1000 grid. */
const box2d = z.array(z.number()).length(4).describe("[ymin, xmin, ymax, xmax] de 0 à 1000");

export const photoDetectionSchema = z.object({
  regions: z.array(z.object({ kind: regionKindSchema, label: z.string().max(80), box_2d: box2d, recognizable: z.boolean() })).max(30),
  adjust: z.object({
    exposure: z.number().min(-1).max(1),
    contrast: z.number().min(-1).max(1),
    saturation: z.number().min(-1).max(1),
    warmth: z.number().min(-1).max(1),
    straighten: z.number().min(-10).max(10),
  }),
  subject: z.object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(1000) }).describe("Centre du sujet principal, 0–1000"),
  notes: z.string().max(300),
  /** Text already on the picture (a sign, a logo, a window lettering): a Reel's text never goes over it. */
  text_boxes: z.array(box2d).max(8).optional(),
});
export type PhotoDetection = z.infer<typeof photoDetectionSchema>;

export const clipDetectionSchema = z.object({
  tracks: z
    .array(
      z.object({
        kind: regionKindSchema,
        label: z.string().max(80),
        recognizable: z.boolean(),
        keys: z.array(z.object({ t: z.number().min(0), box_2d: box2d })).max(240),
      }),
    )
    .max(12),
});
export type ClipDetection = z.infer<typeof clipDetectionSchema>;

export const PHOTO_DETECT_PROMPT = `Tu prépares une photo pour Instagram, prise dans un commerce de quartier.
1. regions : chaque zone à pouvoir flouter, avec sa boîte englobante box_2d [ymin, xmin, ymax, xmax] sur une grille de 0 à 1000 :
   - face : chaque visage humain (même de profil ou partiel), recognizable = true si on peut reconnaître la personne ;
   - plate : chaque plaque d'immatriculation ;
   - screen : écran affichant des informations personnelles (téléphone, ordinateur, caisse) ;
   - document : papier ou étiquette avec nom, adresse, numéro ;
   - other : autre donnée personnelle visible.
   Boîtes serrées sur la zone. Rien n'est inventé : liste vide s'il n'y a rien.
2. adjust : la retouche légère qui rendrait la photo plus belle et naturelle sur Instagram, comme un bon photographe (0 = ne rien changer, rester sobre : ±0,1 à ±0,4 en général) : exposure (luminosité), contrast, saturation, warmth (-1 froid, 1 chaud ; corrige une dominante), straighten (degrés pour remettre l'horizon ou les verticales droites, 0 si c'est déjà droit).
3. subject : le centre du sujet principal (0–1000), pour recadrer sans le couper.
4. notes : une phrase sur ce que la photo montre (le sujet, le lieu, le détail), puis sa lumière et son cadrage.
5. text_boxes : la boîte box_2d de chaque texte déjà visible sur la photo (enseigne, logo, lettrage sur une vitre, affiche, menu), lisible ou pas ; liste vide s'il n'y en a pas.`;

export const CLIP_DETECT_PROMPT = `Tu prépares une vidéo pour un Reel Instagram, filmée dans un commerce de quartier. Repère les zones à flouter et suis-les dans le temps :
- face : chaque visage humain (recognizable = true si on peut reconnaître la personne) ;
- plate : plaque d'immatriculation ; screen : écran avec des informations personnelles ; document : papier avec nom ou adresse.
Pour chaque zone suivie, donne keys : sa boîte box_2d [ymin, xmin, ymax, xmax] (grille 0–1000) toutes les 0,5 seconde environ (t en secondes depuis le début), plus souvent si elle bouge vite, tant qu'elle est visible. Une même personne garde la même piste. Liste vide s'il n'y a rien.`;

/** A Gemini box as a zone of the image, with a margin around it (a blur must cover the whole face). */
export function boxFrom2d(b: number[], pad = 0.15): Box {
  const [ymin = 0, xmin = 0, ymax = 0, xmax = 0] = b.map((v) => Math.min(1000, Math.max(0, v)) / 1000);
  const w = Math.max(0.01, xmax - xmin);
  const h = Math.max(0.01, ymax - ymin);
  const x = Math.max(0, xmin - w * pad);
  const y = Math.max(0, ymin - h * pad);
  return { x, y, w: Math.min(1 - x, w * (1 + 2 * pad)), h: Math.min(1 - y, h * (1 + 2 * pad)) };
}

/** The box of a tracked zone at a moment (linear in between keys), or null when it is not on screen. */
export function boxAt(keys: (Box & { t: number })[], t: number, hold = 0.4): Box | null {
  if (!keys.length) return null;
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (t < first.t - hold || t > last.t + hold) return null;
  if (t <= first.t) return first;
  if (t >= last.t) return last;
  const i = keys.findIndex((k) => k.t > t);
  const a = keys[i - 1]!;
  const b = keys[i]!;
  // A gap of more than a second: the zone left the frame in between.
  if (b.t - a.t > 1.2 && t - a.t > hold && b.t - t > hold) return null;
  const p = (t - a.t) / Math.max(0.001, b.t - a.t);
  const mix = (u: number, v: number) => u + (v - u) * p;
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), w: mix(a.w, b.w), h: mix(a.h, b.h) };
}

/**
 * Exposure as a photographer corrects it: a gamma curve on the mid-tones (the dark parts
 * come out of the shadow, blacks stay black and whites are not burnt), where a plain
 * brightness barely showed (+5 % for a dark clip) and burnt the whites. Steps of 0.05,
 * from 0.6 (much lighter) to 1.4 (darker); null when it changes nothing.
 */
export function exposureGamma(exposure: number | undefined): number | null {
  if (!exposure) return null;
  const gamma = Math.round(Math.min(1.4, Math.max(0.6, 1 - exposure * 0.9)) * 20) / 20;
  return Math.abs(gamma - 1) < 0.01 ? null : gamma;
}

/** The id of the SVG filter that applies a gamma step (the composition draws them all, ExposureFilters). */
export const exposureFilterId = (gamma: number) => `fauve-exposure-${Math.round(gamma * 100)}`;

/** Every gamma step a clip or a photo can ask for. */
export const EXPOSURE_GAMMAS = Array.from({ length: 17 }, (_, i) => Math.round((0.6 + i * 0.05) * 100) / 100).filter((g) => g !== 1);

/** CSS filter for an adjustment (light and colour only; framing is done by the layout). */
export function cssFilter(a: Adjust | undefined): string | undefined {
  if (!a) return undefined;
  const parts: string[] = [];
  const gamma = exposureGamma(a.exposure);
  if (gamma) parts.push(`url(#${exposureFilterId(gamma)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast * 0.3).toFixed(3)})`);
  if (a.saturation) parts.push(`saturate(${(1 + a.saturation * 0.45).toFixed(3)})`);
  // Warmth: a touch of sepia for warm, a slight hue shift towards blue for cool.
  if (a.warmth && a.warmth > 0) parts.push(`sepia(${(a.warmth * 0.22).toFixed(3)})`, `saturate(${(1 + a.warmth * 0.12).toFixed(3)})`);
  if (a.warmth && a.warmth < 0) parts.push(`hue-rotate(${(a.warmth * 10).toFixed(1)}deg)`, `saturate(${(1 + a.warmth * 0.1).toFixed(3)})`);
  return parts.length ? parts.join(" ") : undefined;
}

/**
 * Where a source image lands in a frame it covers (like object-fit: cover),
 * keeping `focus` in view, zoomed by `zoom`: its drawn size and offset.
 */
export function coverLayout(frame: { width: number; height: number }, source: { width: number; height: number }, adjust?: Adjust) {
  const zoom = adjust?.zoom ?? 1;
  // Straightening rotates the picture about the frame's centre: cover the rotated frame's bounding box, so no corner shows.
  const angle = (Math.abs(adjust?.straighten ?? 0) * Math.PI) / 180;
  const box = {
    width: frame.width * Math.cos(angle) + frame.height * Math.sin(angle),
    height: frame.width * Math.sin(angle) + frame.height * Math.cos(angle),
  };
  const originX = (frame.width - box.width) / 2;
  const originY = (frame.height - box.height) / 2;
  const scale = Math.max(box.width / source.width, box.height / source.height) * zoom;
  const width = source.width * scale;
  const height = source.height * scale;
  const fx = adjust?.focus?.x ?? 0.5;
  const fy = adjust?.focus?.y ?? 0.5;
  // The focus point as close to the centre as the edges allow.
  const left = originX + Math.min(0, Math.max(box.width - width, box.width / 2 - fx * width));
  const top = originY + Math.min(0, Math.max(box.height - height, box.height / 2 - fy * height));
  return { left, top, width, height };
}

/** The edit Fauve proposes for a photo from Gemini's reading: light, straightening, subject in view, and what to blur. */
export function photoEditFrom(
  detection: PhotoDetection,
  source: { width: number; height: number },
  options: { retouch: boolean; blur: RegionKind[] | "none"; onlyRecognizable?: boolean },
): PhotoEdit {
  const adjust: Adjust | undefined = options.retouch
    ? {
        exposure: detection.adjust.exposure,
        contrast: detection.adjust.contrast,
        saturation: detection.adjust.saturation,
        warmth: detection.adjust.warmth,
        straighten: detection.adjust.straighten,
        focus: { x: detection.subject.x / 1000, y: detection.subject.y / 1000 },
      }
    : undefined;
  const kinds = options.blur === "none" ? [] : options.blur;
  const blur = detection.regions
    .filter((r) => kinds.includes(r.kind) && (!options.onlyRecognizable || r.kind !== "face" || r.recognizable))
    .map((r): BlurRegion => ({ ...boxFrom2d(r.box_2d), kind: r.kind, shape: r.kind === "face" ? "ellipse" : "rect" }));
  return { source, ...(adjust ? { adjust } : {}), ...(blur.length ? { blur } : {}) };
}

/** The blur Fauve proposes for a clip from Gemini's tracking. */
export function clipBlurFrom(detection: ClipDetection, aspect: number, kinds: RegionKind[]): ClipBlur | null {
  const tracks = detection.tracks
    .filter((t) => kinds.includes(t.kind) && t.keys.length)
    .map((t) => ({ kind: t.kind, keys: [...t.keys].sort((a, b) => a.t - b.t).slice(0, 240).map((k) => ({ t: k.t, ...boxFrom2d(k.box_2d, 0.2) })) }));
  return tracks.length ? { aspect, tracks } : null;
}

/** Where each text style sits by default (top of its box, share of the frame height) and roughly how tall it is. Mirror of TEXT_Y in apps/render/src/theme.ts. */
export const TEXT_ROWS = { hook: { y: 0.2, h: 0.2 }, band: { y: 0.47, h: 0.1 }, caption: { y: 0.62, h: 0.08 } } as const;
const FREE_ROWS = [0.2, 0.47, 0.62, 0.33, 0.12, 0.55];

/**
 * A Reel's texts never sit on what must stay seen: text already in a photo (a sign, a
 * logo on a window) or a face in a shot. A text shown over such a shot moves to the
 * nearest free row. `shots`: when each shot plays and its busy zones (shares of the
 * frame; only the rows matter, texts span the width). Texts placed by hand stay put.
 */
export function avoidPhotoText<T extends { from: number; to: number; style: "hook" | "band" | "caption"; y?: number }>(
  texts: T[],
  shots: { start: number; length: number; boxes: Box[] }[],
): T[] {
  return texts.map((t) => {
    if (t.y !== undefined) return t;
    const boxes = shots
      .filter((s) => s.boxes.length && s.start < t.to && s.start + s.length > t.from)
      .flatMap((s) => s.boxes)
      // A word too small to read under a text does not count.
      .filter((b) => b.w > 0.12 || b.h > 0.04);
    if (!boxes.length) return t;
    const row = TEXT_ROWS[t.style];
    const clear = (y: number) => boxes.every((b) => b.y > y + row.h + 0.02 || b.y + b.h < y - 0.02);
    if (clear(row.y)) return t;
    const free = FREE_ROWS.filter((y) => y + row.h <= 0.82 && clear(y)).sort((a, b) => Math.abs(a - row.y) - Math.abs(b - row.y))[0];
    return free === undefined ? t : { ...t, y: Math.min(0.66, free) };
  });
}

/** Where a face is in a shot: the upper part of the subject's box, in shares of the frame (only the rows matter). */
export function headZone(subjectBox: number[] | undefined): Box | null {
  if (!subjectBox || subjectBox.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = subjectBox.map((v) => Math.min(1000, Math.max(0, v)) / 1000) as [number, number, number, number];
  if (ymax <= ymin) return null;
  return { x: xmin, y: ymin, w: Math.max(0.01, xmax - xmin), h: Math.max(0.04, (ymax - ymin) * 0.4) };
}
