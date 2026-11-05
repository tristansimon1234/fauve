import type { EffectPiece } from "./pieces.ts";
import { cadre } from "./pieces/cadre.ts";
import { facade } from "./pieces/facade.ts";
import { motsMeles } from "./pieces/mots-meles.ts";
import { quatreCoins } from "./pieces/quatre-coins.ts";

// The bank of ready-to-play effects (pieces.ts: the form of an effect, its filler, how its layer is built), by the key of
// the model each one comes from. Server side only (@fauve/agent/pieces), like the montage skills: their code stays out of
// the pages. An effect joins it once written from its model's skill and fiche, checked by the tests and rendered locally
// (scripts/skill-render.mts --piece); a new model of Edith's brings its own (docs/reprise.md, « Passage de relais »).

/** The bank, in the order the editor is offered them on a tie (pieces.ts, piecesOffered). */
export const EFFECT_PIECES: Record<string, EffectPiece> = { cadre, facade, "quatre-coins": quatreCoins, "mots-meles": motsMeles };

/** The piece of the bank a model's key names, if it has one. */
export const pieceFor = (key: string | null | undefined): EffectPiece | undefined => (key ? EFFECT_PIECES[key] : undefined);
