import { z } from "zod";
import { FORBIDDEN_CODE, MOTION_SCOPE } from "./motion-scene.ts";
import { SLOT_NAME } from "./schemas.ts";
import { LOOK_FONT } from "./text-look.ts";

// Text layers: the text over a photo, designed as code. A fixed set of options
// always misses the next example (a price in a circle, arrows, two columns, a
// stamp, a text on an arc…), so the text designer (Opus) writes the whole layer
// as a React component with editable text slots, from the manager's example and
// her photo. It is checked statically, rendered in the sandbox (errors, texts
// out of the frame), compared with the example by a critic, kept in the
// library, and reused with new texts at no cost.

export const layerSlotSchema = z.object({
  name: z.string().regex(SLOT_NAME),
  role: z.string().max(120).describe("Ce que contient ce texte, ex. « titre », « élément 2 de la liste »"),
  max_chars: z.number().int().min(1).max(400),
  multiline: z.boolean().describe("true si le texte peut tenir sur plusieurs lignes séparées par \\n (une liste, un paragraphe)"),
});
export type LayerSlot = z.infer<typeof layerSlotSchema>;

/** A layer as stored on a slide: its code (from Fauve, never from the browser), its slots and their texts. */
export const textLayerSchema = z.object({
  template_id: z.uuid().optional(),
  name: z.string().max(80),
  js: z.string().min(1).max(40000),
  slots: z.array(layerSlotSchema).max(16),
  texts: z.record(z.string().regex(SLOT_NAME), z.string().max(400)),
  /** Google fonts the layer uses, loaded before it is drawn. */
  fonts: z.array(z.string().regex(LOOK_FONT)).max(4),
  /** Moved and resized by hand in the editor: offset of the whole layer (share of the frame) and its size. */
  place: z.object({ x: z.number().min(-0.45).max(0.45), y: z.number().min(-0.45).max(0.45), scale: z.number().min(0.5).max(1.5) }).optional(),
  /** Its accent colour, instead of the studio's. */
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type TextLayer = z.infer<typeof textLayerSchema>;

const slotTextsSchema = z.array(z.object({ slot: z.string().regex(SLOT_NAME), text: z.string().max(400) }));

/** What the text designer answers. */
export const layerDesignOutputSchema = z.object({
  code: z.string(),
  name: z.string().max(80).describe("Nom court et parlant, ex. « Checklist surlignée menthe »"),
  notes: z.string().max(400).describe("Ce que tu as repris de l'exemple, en une phrase"),
  slots: z.array(layerSlotSchema).max(16),
  fonts: z.array(z.string().regex(LOOK_FONT)).max(4).describe("Familles Google Fonts utilisées"),
  slides: z.array(z.object({ photo: z.number().int().min(1), texts: slotTextsSchema })).min(1).max(10).describe("Les textes de chaque photo, par slot"),
});
export type LayerDesignOutput = z.infer<typeof layerDesignOutputSchema>;

/** What the critic answers after looking at the rendered photos. */
export const layerReviewSchema = z.object({
  ok: z.boolean().describe("true si c'est publiable tel quel"),
  issues: z.array(z.string().max(300)).max(6).describe("Ce qu'il faut corriger, précisément (vide si ok)"),
});
export type LayerReview = z.infer<typeof layerReviewSchema>;

/** Slot texts as a record (the model answers with a list). */
export const slotTexts = (list: { slot: string; text: string }[]): Record<string, string> =>
  Object.fromEntries(list.filter((t) => SLOT_NAME.test(t.slot)).map((t) => [t.slot, t.text.slice(0, 400)]));

/** Margin (px on a 1080-wide photo) every text of a layer stays inside. */
export const LAYER_MARGIN = 40;

export const TEXT_DESIGNER_PROMPT = `Tu es directeur artistique et développeur front senior. Tu dessines le calque de texte posé sur une photo de publication Instagram (carrousel ou post photo, 1080 × 1350) d'un commerce de quartier. Le calque est un composant React rendu par Remotion, par-dessus la photo.

Si on te donne un exemple (l'image d'un post que la gérante aime), refais LA MÊME CHOSE : même mise en page, même hiérarchie, mêmes polices (les plus proches dans Google Fonts), mêmes couleurs, mêmes fonds, formes, pictos, puces, cadres, filets, angles, effets, mêmes proportions et marges. Ne garde pas les mots de l'exemple : mets ceux du commerce (« demande »). Mesure l'exemple avant de coder et reproduis ses mesures : la part de la largeur qu'occupe chaque texte (un titre d'affiche en occupe souvent 70 à 90 %), la hauteur de ses lettres (un grand titre en capitales fait souvent 150 à 260 px de haut sur 1350), l'écart entre les blocs, ce qui chevauche quoi (une accroche manuscrite posée sur le titre, une pastille inclinée sur son coin). Un calque plus petit, plus sage ou plus aéré que l'exemple est raté : la gérante veut le même impact. Ignore l'interface d'Instagram (pseudo, boutons, compteurs, points du carrousel) visible sur une capture.
Sans exemple, crée un calque qui suit la direction artistique du studio. Couleurs : les grands textes posés sur la photo restent dans des tons neutres et nobles (blanc cassé, crème très clair, encre), comme sur l'exemple ; les couleurs du studio servent aux accents (pastille, filet, mot mis en valeur), jamais un jaune ou une teinte pastel saturée sur un grand titre : ça fait bon marché. Vérifie que chaque couleur va avec la photo.
On te montre aussi la ou les photos : place les textes là où ils se lisent bien, sans couvrir l'essentiel (visages, produit), en ajoutant si besoin un voile, un dégradé ou un fond comme le ferait un graphiste.

Contrat du code (strict) :
- Écris uniquement une fonction : function Layer({ width, height, brand, texts }) { ... return (<AbsoluteFill>...</AbsoluteFill>); } — fond transparent : la photo est dessous.
- Aucun texte en dur : chaque texte vient d'un slot, texts.nom_du_slot (minuscules, chiffres, _), avec une valeur par défaut (texts.titre ?? "…"). Déclare chaque slot dans "slots". Un slot multiline peut contenir plusieurs lignes séparées par "\\n" : découpe-le (texts.liste.split("\\n")) pour une liste, des étapes, un planning ; le nombre de lignes peut varier, la mise en page doit s'adapter.
- Chaque texte (ou bloc de texte) est dans un FitText, qui rétrécit le contenu jusqu'à ce qu'il tienne (il ne l'agrandit jamais : donne la taille de police voulue pour un texte court, par exemple 220 px pour un titre d'affiche, et une boîte à la taille que le texte doit occuper) : <FitText style={{ position: "absolute", left: 80, top: 160, width: 920, height: 700 }} innerStyle={{ alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left" }}>…</FitText>. style place la boîte ; innerStyle met en page le contenu (colonne flex centrée par défaut). Prévois des boîtes assez grandes pour les textes les plus longs.
- Pas d'import, pas d'export. Seuls ces identifiants existent : ${MOTION_SCOPE.join(", ")}. Styles en ligne et SVG en ligne (pictos, cases, flèches, formes : dessine-les en SVG).
- Interdits : fetch et tout accès réseau, Math.random, Date, setTimeout, eval, window, document, balises <script>, images externes (seul brand.logoUrl peut être affiché avec <Img>, s'il existe).
- Polices : celles que tu déclares dans "fonts" (familles Google Fonts exactes, 3 au plus) sont chargées, plus brand.displayFont et brand.bodyFont. fontFamily: '"Playfair Display", serif'.
- brand = { name, accent, accentInk, ink: "#1C1530", cream: "#FBF7F4", displayFont, bodyFont, logoUrl } : utile sans exemple, ou pour le logo.
- Tout texte reste entier dans le cadre, à ${LAYER_MARGIN} px des bords au moins (c'est vérifié). Lisible sur téléphone : 26 px minimum.
- C'est une image fixe : pas besoin d'animation (useCurrentFrame vaut une valeur quelconque, ne t'en sers pas).

Réponds avec :
- code ; name ; notes ; slots ; fonts ;
- slides : pour chaque photo à couvrir (numéro de photo, à partir de 1), les textes de chaque slot : les vrais mots du commerce tirés de la demande, jamais la description du slot (« Titre », « Petite note en bas »). Un même calque sert à toutes ces photos (ex. une checklist différente par photo) ; s'il faut un calque différent pour la couverture, fais-en un qui marche pour toutes.`;

export const LAYER_CRITIC_PROMPT = `Tu es directeur artistique. On te montre le rendu d'un calque de texte posé sur une photo de publication Instagram, et parfois l'exemple que la gérante voulait reproduire. Dis si c'est publiable tel quel.
Vérifie : fidélité à l'exemple quand il y en a un (mise en page, polices, couleurs, fonds, formes, pictos, et surtout les proportions : si le titre est nettement plus petit ou plus fin que dans l'exemple, ou si l'ensemble a moins d'impact, ce n'est pas ok ; donne alors les tailles à viser en px) ; des mots qui sont des étiquettes et pas un vrai message (« Titre », « Texte ici ») ; lisibilité sur téléphone ; aucun texte coupé, tassé, qui se chevauche ou qui couvre un visage ; textes bien alignés, marges régulières ; rien d'absurde (une puce sans texte, un caractère manquant, une police de secours visible).
Juge aussi les couleurs : un grand titre jaune, pastel saturé ou criard, ou des couleurs qui jurent avec la photo, ce n'est pas ok (« titre en blanc cassé #F7F3EC, garde le bordeaux pour la pastille »). ok = true si un graphiste exigeant le publierait. Sinon, liste les corrections précises à faire dans le code (« le surlignage doit s'arrêter à la fin du texte », « les cases sont trop petites : 48 px »…), 4 au plus, les plus importantes d'abord.`;

/** Problems that forbid running a layer's code (empty when it is acceptable). */
export function checkLayerCode(code: string): string[] {
  const problems: string[] = [];
  if (code.length > 24000) problems.push("code trop long");
  if (!/\bfunction\s+Layer\s*\(/.test(code)) problems.push("il faut une fonction Layer");
  for (const [pattern, label] of FORBIDDEN_CODE) if (pattern.test(code)) problems.push(label);
  return problems;
}
