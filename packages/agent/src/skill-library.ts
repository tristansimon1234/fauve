import type { MontageSkill } from "./skills.ts";
import { cadre } from "./skills/cadre.ts";
import { carteFeutre } from "./skills/carte-feutre.ts";
import { coulisses } from "./skills/coulisses.ts";
import { coupsDeFouet } from "./skills/coups-de-fouet.ts";
import { createur } from "./skills/createur.ts";
import { decode } from "./skills/decode.ts";
import { ecranPartage } from "./skills/ecran-partage.ts";
import { eventail } from "./skills/eventail.ts";
import { facade } from "./skills/facade.ts";
import { fenetres } from "./skills/fenetres.ts";
import { frappe } from "./skills/frappe.ts";
import { gaufre } from "./skills/gaufre.ts";
import { interrupteur } from "./skills/interrupteur.ts";
import { interfaceSkill } from "./skills/interface.ts";
import { journee } from "./skills/journee.ts";
import { monTravail } from "./skills/mon-travail.ts";
import { mosaique } from "./skills/mosaique.ts";
import { motsMeles } from "./skills/mots-meles.ts";
import { motCle } from "./skills/mot-cle.ts";
import { nike } from "./skills/nike.ts";
import { photoDump } from "./skills/photo-dump.ts";
import { pile } from "./skills/pile.ts";
import { pixel } from "./skills/pixel.ts";
import { plansFixes } from "./skills/plans-fixes.ts";
import { quatreCoins } from "./skills/quatre-coins.ts";
import { rallume } from "./skills/rallume.ts";
import { table } from "./skills/table.ts";
import { titreDerriere } from "./skills/titre-derriere.ts";
import { tourne } from "./skills/tourne.ts";

// The montage skills written so far, by the key of the house model each one plays (skills.ts). Server side only
// (@fauve/agent/skills): their code stays out of the pages. Each one is written by hand on its model's original,
// checked by the scene check and rendered locally before it joins (scripts/skill-render.mts).

export const MONTAGE_SKILLS: Record<string, MontageSkill> = {
  cadre,
  "carte-feutre": carteFeutre,
  coulisses,
  "coups-de-fouet": coupsDeFouet,
  createur,
  decode,
  "ecran-partage": ecranPartage,
  eventail,
  facade,
  fenetres,
  frappe,
  gaufre,
  interrupteur,
  interface: interfaceSkill,
  journee,
  "mon-travail": monTravail,
  mosaique,
  "mots-meles": motsMeles,
  "mot-cle": motCle,
  nike,
  "photo-dump": photoDump,
  pile,
  pixel,
  "plans-fixes": plansFixes,
  "quatre-coins": quatreCoins,
  rallume,
  table,
  "titre-derriere": titreDerriere,
  tourne,
};

/** The skill of a house model, when it has one. */
export const skillFor = (key: string | null | undefined): MontageSkill | undefined => (key ? MONTAGE_SKILLS[key] : undefined);
