import type { EffectPiece } from "./pieces.ts";
import { cadre } from "./pieces/cadre.ts";
import { decode } from "./pieces/decode.ts";
import { quatreCoins } from "./pieces/quatre-coins.ts";
import { mosaique } from "./pieces/mosaique.ts";
import { carteFeutre } from "./pieces/carte-feutre.ts";
import { pile } from "./pieces/pile.ts";
import { monTravail } from "./pieces/mon-travail.ts";
import { photoDump } from "./pieces/photo-dump.ts";
import { table } from "./pieces/table.ts";
import { ecranPartage } from "./pieces/ecran-partage.ts";
import { fenetres } from "./pieces/fenetres.ts";
import { facade } from "./pieces/facade.ts";
import { gaufre } from "./pieces/gaufre.ts";
import { motCle } from "./pieces/mot-cle.ts";
import { frappe } from "./pieces/frappe.ts";
import { titreDerriere } from "./pieces/titre-derriere.ts";
import { journee } from "./pieces/journee.ts";
import { rallume } from "./pieces/rallume.ts";
import { plansFixes } from "./pieces/plans-fixes.ts";
import { coupsDeFouet } from "./pieces/coups-de-fouet.ts";
import { tourne } from "./pieces/tourne.ts";
import { nike } from "./pieces/nike.ts";
import { eventail } from "./pieces/eventail.ts";
import { coulisses } from "./pieces/coulisses.ts";
import { interrupteur } from "./pieces/interrupteur.ts";
import { interfaceEffect } from "./pieces/interface.ts";
import { pixel } from "./pieces/pixel.ts";
import { motsMeles } from "./pieces/mots-meles.ts";
import { aplat } from "./pieces/aplat.ts";
import { detourages } from "./pieces/detourages.ts";
import { createur } from "./pieces/createur.ts";
import { silhouette } from "./pieces/silhouette.ts";
import { vision } from "./pieces/vision.ts";
import { celuiLa } from "./pieces/celui-la.ts";

// The bank of ready-to-play effects (pieces.ts: the form of an effect, its filler, how its layer is built), by the key of
// the model each one comes from. Server side only (@fauve/agent/pieces), like the montage skills: their code stays out of
// the pages. An effect joins it once written from its model's skill and fiche, checked by the tests and rendered locally
// (scripts/skill-render.mts --piece); a new model of Edith's brings its own (docs/reprise.md, « Passage de relais »).

/** The bank, in the catalogue's order (house-models.ts); the editor is offered them by what her files carry (pieces.ts, piecesOffered). */
export const EFFECT_PIECES: Record<string, EffectPiece> = { cadre, decode, "quatre-coins": quatreCoins, mosaique, "carte-feutre": carteFeutre, pile, "mon-travail": monTravail, "photo-dump": photoDump, table, "ecran-partage": ecranPartage, fenetres, facade, gaufre, "mot-cle": motCle, frappe, "titre-derriere": titreDerriere, journee, rallume, "plans-fixes": plansFixes, "coups-de-fouet": coupsDeFouet, tourne, nike, eventail, coulisses, interrupteur, interface: interfaceEffect, pixel, "mots-meles": motsMeles, aplat, detourages, createur, silhouette, vision, "celui-la": celuiLa };

/** The piece of the bank a model's key names, if it has one. */
export const pieceFor = (key: string | null | undefined): EffectPiece | undefined => (key ? EFFECT_PIECES[key] : undefined);
