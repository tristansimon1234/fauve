import { z } from "zod";

// Images made with the image model, within two limits that keep Simone honest:
// improve a real photo without changing what it shows (its place, its products,
// its people), or make an ambiance image that never pretends to be the business
// (no place presented as hers, no products, no people, no text). The texts go on
// afterwards with the studio's own components and styles, never drawn by the model.

export const AI_IMAGE_FORMATS = ["4:5", "1:1", "9:16"] as const;
export const aiImageFormatSchema = z.enum(AI_IMAGE_FORMATS);
export type AiImageFormat = z.infer<typeof aiImageFormatSchema>;

/** Size of the image kept, per format (Instagram's 4:5 and square at their best, a story's 9:16). */
export const AI_IMAGE_SIZES: Record<AiImageFormat, { width: number; height: number }> = {
  "4:5": { width: 1440, height: 1800 },
  "1:1": { width: 1440, height: 1440 },
  "9:16": { width: 1080, height: 1920 },
};

/** Ambiance images made at once, at most. */
export const MAX_AMBIANCE_IMAGES = 4;

/** What is kept on media_assets.ai. */
export const aiImageSchema = z.object({
  mode: z.enum(["improve", "ambiance"]),
  instruction: z.string(),
  from_media_id: z.uuid().nullable().optional(),
  format: aiImageFormatSchema,
  model: z.string(),
});
export type AiImage = z.infer<typeof aiImageSchema>;

/** The improvements offered in one click in the editors, each with the instruction the model gets. */
export const PHOTO_IMPROVEMENTS = {
  extend: {
    label: "Agrandir sans couper",
    instruction: "Extend the scene beyond the edges of the photo so that it fills the new frame without cropping anything: continue the walls, floor, table, sky or background naturally. The original part stays exactly as it is.",
  },
  background: {
    label: "Fond plus net",
    instruction: "Tidy the background: remove clutter, cables, bins, stray objects and passers-by in the background, so the subject stands out. The place stays recognisable: same walls, furniture, decor and light.",
  },
  light: {
    label: "Plus lumineuse",
    instruction: "Make the photo bright, clear and inviting, as if taken in beautiful natural light: lift the shadows, balance the white, give true and appetising colours. No filter look, no change of what is shown.",
  },
} as const;
export type PhotoImprovement = keyof typeof PHOTO_IMPROVEMENTS;

const ORIENTATION: Record<AiImageFormat, string> = { "4:5": "portrait 4:5", "1:1": "square 1:1", "9:16": "vertical 9:16" };

/** The model's brief to improve a real photo: what she asked, and everything real kept as it is. */
export function improvePrompt(instruction: string, format: AiImageFormat, business?: string | null): string {
  return [
    `You are retouching a real photograph taken by a local business${business ? ` (${business})` : ""}. It will be published on their Instagram, so it must stay truthful: their customers will see the real place and the real products.`,
    `Do exactly this: ${instruction.trim()}`,
    "Rules:",
    "- Keep everything real exactly as it is: the place, the products, the dishes, the work done (haircut, nails, treatment…), the people (faces, bodies, hair, skin, clothes), the colours and shapes of the products, any sign or text.",
    "- Do not add people, products, food, logos or text. Never make a product, a dish or a result look bigger, better or different from what it is.",
    "- Photorealistic and natural: same light and lens as the original, no artificial look, no heavy filter, no smoothing of faces.",
    `- Output a ${ORIENTATION[format]} image. If the original has another shape, extend the scene naturally beyond its edges instead of cropping or squashing the subject.`,
  ].join("\n");
}

/** The model's brief for an ambiance image: generic, never her place, her products or people, room left for a text. */
export function ambiancePrompt(
  description: string,
  format: AiImageFormat,
  look: { business?: string | null; colors?: string[]; mood?: string | null } = {},
): string {
  const colors = (look.colors ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4);
  return [
    `Create a photorealistic ambiance image for the Instagram of a local business${look.business ? ` (${look.business})` : ""}. A short text will be laid over it afterwards.`,
    `What to show: ${description.trim()}`,
    "Rules:",
    "- Generic: a background, a texture, a detail, an object or a still life that evokes the activity. It must not pretend to be this business: no shop front, no room presented as theirs, no sign, no brand, no logo, no product presented as theirs.",
    "- No people and no faces; at most anonymous hands.",
    "- No text, letters or numbers anywhere in the image.",
    "- Leave a calm, simple area (top or middle) where a text will be readable.",
    colors.length ? `- Colours in harmony with this palette: ${colors.join(", ")}.` : "",
    look.mood ? `- Mood: ${look.mood.slice(0, 300)}.` : "",
    "- Natural light, real materials, refined editorial photography; not a cartoon, no artificial 3D look.",
    `- ${ORIENTATION[format]} image.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The format closest to a photo's shape (to improve it without changing its frame). */
export function closestFormat(width: number, height: number): AiImageFormat {
  const ratio = width / height;
  const formats = AI_IMAGE_FORMATS.map((f) => {
    const s = AI_IMAGE_SIZES[f];
    return { f, gap: Math.abs(Math.log(ratio / (s.width / s.height))) };
  });
  return formats.sort((a, b) => a.gap - b.gap)[0]!.f;
}

/** Whether a photo would lose much of itself in a frame (more than 12 % cut off): worth extending rather than cropping. */
export function cropsMuch(width: number, height: number, format: AiImageFormat): boolean {
  const target = AI_IMAGE_SIZES[format].width / AI_IMAGE_SIZES[format].height;
  const ratio = width / height;
  return Math.min(ratio, target) / Math.max(ratio, target) < 0.88;
}
