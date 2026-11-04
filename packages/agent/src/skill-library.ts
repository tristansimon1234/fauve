import type { MontageSkill } from "./skills.ts";
import { cadre } from "./skills/cadre.ts";
import { decode } from "./skills/decode.ts";
import { ecranPartage } from "./skills/ecran-partage.ts";
import { gaufre } from "./skills/gaufre.ts";
import { journee } from "./skills/journee.ts";
import { mosaique } from "./skills/mosaique.ts";
import { nike } from "./skills/nike.ts";
import { photoDump } from "./skills/photo-dump.ts";
import { pile } from "./skills/pile.ts";
import { quatreCoins } from "./skills/quatre-coins.ts";

// The montage skills written so far, by the key of the house model each one plays (skills.ts). Server side only
// (@fauve/agent/skills): their code stays out of the pages. Each one is written by hand on its model's original,
// checked by the scene check and rendered locally before it joins (scripts/skill-render.mts).

export const MONTAGE_SKILLS: Record<string, MontageSkill> = {
  cadre,
  decode,
  "ecran-partage": ecranPartage,
  gaufre,
  journee,
  mosaique,
  nike,
  "photo-dump": photoDump,
  pile,
  "quatre-coins": quatreCoins,
};

/** The skill of a house model, when it has one. */
export const skillFor = (key: string | null | undefined): MontageSkill | undefined => (key ? MONTAGE_SKILLS[key] : undefined);
