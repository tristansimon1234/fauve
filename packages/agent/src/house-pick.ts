import { z } from "zod";
import { HOUSE_MODELS, houseModel } from "./house-models.ts";

// Edith's art direction by default (Tristan: « avec la même DA par défaut que les reels envoyés », « des 31 reels
// envoyés et des modèles »): a Reel that has no model, no Reel to copy and no form of her own is made in one of
// Edith's models (house-models.ts, the reference Reels he sent, each written down), the one her files, her request
// and her trade call for, dressed in her charter (her fonts and colours), never the model of her last Reels. Picked
// once, when the montage starts its design, by a short call; "none" when no model can be made with her files, the
// Reel then made freely in the same spirit.

/** Her request asks for her own look on a Reel she copies: her colours, her fonts, her charter. */
export const OWN_LOOK_WORDS =
  /(?:^|[\s,;.!?«"'(])(?:(?:mes|nos) (?:couleurs|polices|typos?)|(?:ma|notre) (?:charte|police|typo|palette|identité|da)(?![a-zà-ÿ])|ma direction artistique|à (?:mon|notre) (?:style|image)|(?:à|aux) (?:mes|nos) couleurs|aux couleurs de (?:mon|ma|notre|chez)|avec mon style)/i;

/** How many of her last Reels' models are not picked again. */
export const HOUSE_PICK_AVOID = 3;

export const HOUSE_PICK_PROMPT = `You are Edith's art director. A local business (a salon, a café, a studio, a shop, a restaurant…) has sent its footage for one Instagram Reel. Edith's Reels are never made in a neutral, safe default: each one is made in one of Edith's own models (modeles), a form with one strong idea that carries every second of the Reel (a title that decodes like a film's credits, words in the four corners, a mosaic that never settles, a giant title the passers-by walk in front of…), dressed in the business's own fonts and colours. Choose the model this Reel is made in.

How to choose
- Her files first: a model can only be made with the footage it needs (il_faut, and its number of files). One that needs someone walking in front of the place, someone talking to the camera, a hand raised to a wall, a fixed shot of the shop front or photos on a plain background is out unless her files have it.
- Then her request (demande): what people must feel or do; when she names a form (a split screen, a collage, a word in big, black and white, a mosaic…), the model that is that form.
- Then her trade and what her footage shows: the model whose idea makes this business look its best (a mosaic for dishes or creations, fixed cinema shots for a calm place, whip pans for a lively street, a typed name for a place in the sun…).
- When she asks to surprise, for an effect or to say something (an offer, a name, a moment), a model whose idea is in its words or its effect (a title that decodes, a word you pass through, a title behind the passers-by, words that slam on each cut), never one made of images alone (a mosaic, a photo dump, fixed shots) unless she asks for that.
- Never one of derniers_modeles (the models of her last Reels): each Reel must look new.
- When none can be made with her files, answer "none".

Answer with the model's key in "key" and, in "why", one short sentence in French for her (« Je l'ai fait façon « Titre qui se décode » : ton nom apparaît comme un générique de film. »).`;

export const housePickSchema = z.object({
  key: z.string().max(40),
  why: z.string().max(300),
});
export type HousePick = z.infer<typeof housePickSchema>;

/** One of her files as the picker reads it. */
export type HousePickFile = { kind: "video" | "photo"; seconds?: number; shows: string; speaks?: boolean; people?: boolean };

/** What the picker reads: her request, her trade, her files, whether a voice is wanted, and the models of her last Reels. */
export function housePickInput(input: { request: string; business: string | null; files: HousePickFile[]; voice: boolean; avoid: string[] }): string {
  return JSON.stringify({
    demande: input.request.slice(0, 4000),
    metier: input.business ?? "commerce",
    fichiers: input.files.slice(0, 20).map((f) => ({
      type: f.kind,
      ...(f.seconds ? { secondes: Math.round(f.seconds) } : {}),
      ce_qu_on_voit: f.shows.slice(0, 220),
      ...(f.speaks ? { quelqu_un_parle: true } : {}),
      ...(f.people ? { personnes: true } : {}),
    })),
    voix_off: input.voice,
    derniers_modeles: input.avoid,
    modeles: HOUSE_MODELS.map((m) => ({ key: m.key, nom: m.name, ce_que_ca_fait: m.pitch, il_faut: m.needs, fichiers: m.files })),
  });
}

/**
 * The model to make the Reel in, from the picker's answer: a model of the catalogue that is not one of her last
 * Reels', and whose number of files hers can fill (a model asking for 10 files is not made with 3); null for none.
 */
export function readHousePick(answer: HousePick | null | undefined, files: number, avoid: string[]): string | null {
  const model = houseModel(answer?.key?.trim().toLowerCase());
  if (!model || avoid.includes(model.key)) return null;
  // A model made of photos only (an interface with her logo) takes no files: any count fits.
  const [least] = model.files;
  return files >= Math.min(least, Math.max(1, least - 2)) ? model.key : null;
}
