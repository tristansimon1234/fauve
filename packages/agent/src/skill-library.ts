import type { MontageSkill } from "./skills.ts";
import { decode } from "./skills/decode.ts";
import { mosaique } from "./skills/mosaique.ts";
import { photoDump } from "./skills/photo-dump.ts";
import { pile } from "./skills/pile.ts";

// The montage skills written so far, by the key of the house model each one plays (skills.ts). Server side only
// (@fauve/agent/skills): their code stays out of the pages. Each one is written by hand on its model's original,
// checked by the scene check and rendered locally before it joins (scripts/skill-render.mts).

export const MONTAGE_SKILLS: Record<string, MontageSkill> = {
  decode,
  mosaique,
  "photo-dump": photoDump,
  pile,
};

/** The skill of a house model, when it has one. */
export const skillFor = (key: string | null | undefined): MontageSkill | undefined => (key ? MONTAGE_SKILLS[key] : undefined);
