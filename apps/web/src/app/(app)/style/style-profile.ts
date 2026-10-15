// Pure logic of the Style page's brand profile (no I/O, unit tested): reading a
// stored profile, validating the form, applying it to the profile.
import { brandProfileSchema, DEFAULT_VOICE_ID, motionTemplateSchema, readVoiceSetting, type BrandProfile } from "@fauve/agent";
import { z } from "zod";
import {
  ART_DIRECTION_MAX,
  CAPTION_LENGTHS,
  EMOJI_LEVELS,
  FONT_NAME,
  HASHTAG,
  HASHTAGS_MAX,
  HEX_COLOR,
  MAX_COLORS,
  RULE_MAX,
  RULES_MAX,
  TEMPLATE_FONTS,
  TEMPLATES,
  TONE_MAX,
  VOICE_USES,
  type StyleForm,
} from "./style-options.ts";

/**
 * The brand profile with the fields this page writes. They are being added to
 * brandProfileSchema in packages/agent with the same definitions; until then the
 * extension keeps them from being stripped. Harmless once they land.
 */
export const styleProfileSchema = brandProfileSchema.extend({
  /** Logo uploaded here (path in the private media bucket); wins over logo_url. */
  logo_path: z.string().max(300).optional(),
  art_direction: z.string().max(ART_DIRECTION_MAX).optional(),
  default_template: motionTemplateSchema.optional(),
});
export type StyleProfile = z.infer<typeof styleProfileSchema>;

/** Unknown keys are kept as they are: the agent may store more than this page edits. */
export type StoredProfile = StyleProfile & Record<string, unknown>;

/** Required fields of a brand new profile. */
const DEFAULTS: Pick<BrandProfile, "tone" | "caption_length" | "emojis" | "hashtags" | "visual_notes" | "dos" | "donts"> = {
  tone: "Chaleureux, simple et encourageant",
  caption_length: "medium",
  emojis: "few",
  hashtags: [],
  visual_notes: "",
  dos: [],
  donts: [],
};

/** A stored profile, with invalid known fields dropped and required ones defaulted. */
export function sanitizeProfile(raw: unknown): StoredProfile {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...DEFAULTS };
  const shape = styleProfileSchema.shape as Record<string, z.ZodType>;
  for (const [key, value] of Object.entries(source)) {
    const field = shape[key];
    if (!field || field.safeParse(value).success) out[key] = value;
  }
  return out as StoredProfile;
}

const validFont = (family: string | undefined) => (family && FONT_NAME.test(family) ? family : null);

export function toStyleForm(profile: StyleProfile): StyleForm {
  return {
    art_direction: profile.art_direction ?? "",
    colors: (profile.colors ?? []).map((c) => c.toLowerCase()),
    display_font: validFont(profile.fonts?.[0]),
    body_font: validFont(profile.fonts?.[1]),
    default_template: profile.default_template ?? null,
    tone: profile.tone,
    caption_length: profile.caption_length,
    emojis: profile.emojis,
    hashtags: profile.hashtags,
    dos: profile.dos,
    donts: profile.donts,
    voice_use: readVoiceSetting(profile.voice).use,
    voice_id: profile.voice?.voice_id ?? DEFAULT_VOICE_ID,
  };
}

// ---------------------------------------------------------------------------
// Form input (the server re-validates everything the client sends)
// ---------------------------------------------------------------------------

const ruleList = z
  .array(z.string().trim().max(RULE_MAX, `Une règle dépasse ${RULE_MAX} caractères.`))
  .max(RULES_MAX, `${RULES_MAX} règles au maximum.`)
  .transform((items) => [...new Set(items.filter(Boolean))]);

const fontInput = z
  .string()
  .trim()
  .regex(FONT_NAME, "Nom de police invalide : lettres, chiffres et espaces, 2 à 40 caractères.")
  .nullable();

export const styleFormSchema = z.object({
  art_direction: z
    .string()
    .trim()
    .max(ART_DIRECTION_MAX, `La direction artistique dépasse ${ART_DIRECTION_MAX} caractères.`),
  colors: z
    .array(z.string().regex(HEX_COLOR, "Une couleur n’est pas au format #rrggbb.").transform((c) => c.toLowerCase()))
    .max(MAX_COLORS, `${MAX_COLORS} couleurs au maximum.`)
    .transform((colors) => [...new Set(colors)]),
  display_font: fontInput,
  body_font: fontInput,
  default_template: z.enum(TEMPLATES).nullable(),
  tone: z.string().trim().max(TONE_MAX, `Le ton dépasse ${TONE_MAX} caractères.`),
  caption_length: z.enum(CAPTION_LENGTHS),
  emojis: z.enum(EMOJI_LEVELS),
  hashtags: z
    .array(
      z
        .string()
        .trim()
        .transform((tag) => tag.replace(/^#+/, ""))
        .pipe(z.string().regex(HASHTAG, "Un hashtag contient des caractères invalides.")),
    )
    .max(HASHTAGS_MAX, `${HASHTAGS_MAX} hashtags au maximum.`)
    .transform((tags) => [...new Set(tags)]),
  dos: ruleList,
  donts: ruleList,
  voice_use: z.enum(VOICE_USES),
  voice_id: z.string().regex(/^[A-Za-z0-9]{10,40}$/, "Voix inconnue."),
});

/** Applies the form onto the current profile; optional fields left empty are removed. */
export function applyStyleForm(current: StoredProfile, form: z.output<typeof styleFormSchema>): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...current,
    tone: form.tone,
    caption_length: form.caption_length,
    emojis: form.emojis,
    hashtags: form.hashtags,
    dos: form.dos,
    donts: form.donts,
    voice: { use: form.voice_use, voice_id: form.voice_id },
  };
  const set = (key: string, value: unknown) => {
    if (value === undefined) delete next[key];
    else next[key] = value;
  };
  // fonts is positional ([display, body]): a missing one takes the template's font.
  const fallback = TEMPLATE_FONTS[form.default_template ?? "doux"];
  set("art_direction", form.art_direction || undefined);
  set("colors", form.colors.length ? form.colors : undefined);
  set(
    "fonts",
    form.display_font || form.body_font
      ? [form.display_font ?? fallback.display, form.body_font ?? fallback.body]
      : undefined,
  );
  set("default_template", form.default_template ?? undefined);
  return next;
}

/** The next stored profile: `change` applied to the sanitized current one, then validated. */
export function nextProfile(raw: unknown, change: (current: StoredProfile) => Record<string, unknown>): StoredProfile {
  return styleProfileSchema.loose().parse(change(sanitizeProfile(raw))) as StoredProfile;
}
