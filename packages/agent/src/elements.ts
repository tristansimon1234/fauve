import { z } from "zod";
import { FORBIDDEN_CODE, MOTION_SCOPE } from "./motion-scene.ts";
import { SLOT_NAME } from "./schemas.ts";
import { LOOK_FONT } from "./text-look.ts";
import { LAYER_MARGIN, layerSlotSchema } from "./text-layer.ts";

// Components: the studio's design system for text over photos. From an
// inspiration, the designer (Opus) takes out each piece that can live on its
// own (a title, a tag, a checklist, a price in a circle…) and codes it as a
// small React component with text slots, drawn at its design width. Each one
// is kept in the studio's bank, placed freely on any photo (position, width,
// rotation), edited on its own (a new version, the older ones kept), and
// reused at no cost. Pieces born from the same inspiration form a kit, laid
// again in one click where they sat on it.

export const ELEMENT_ROLES = ["titre", "sous_titre", "etiquette", "liste", "etapes", "citation", "prix", "bouton", "date", "signature", "decor", "autre"] as const;
export type ElementRole = (typeof ELEMENT_ROLES)[number];

export const ELEMENT_ROLE_LABELS: Record<ElementRole, string> = {
  titre: "Titres",
  sous_titre: "Sous-titres",
  etiquette: "Étiquettes",
  liste: "Listes",
  etapes: "Étapes",
  citation: "Citations",
  prix: "Prix et offres",
  bouton: "Boutons",
  date: "Dates et horaires",
  signature: "Signatures",
  decor: "Décors",
  autre: "Autres",
};

export const elementRoleSchema = z.enum(ELEMENT_ROLES);

/** Where a component sits on a photo: its top-left corner and width as shares of the frame, its tilt in degrees. */
export const elementBoxSchema = z.object({
  x: z.number().min(-0.2).max(1),
  y: z.number().min(-0.2).max(1),
  w: z.number().min(0.06).max(1.2),
  rotate: z.number().min(-45).max(45).optional(),
});
export type ElementBox = z.infer<typeof elementBoxSchema>;

/** A component placed on a slide: its code (from Fauve, never from the browser), slots and texts, and where it sits. */
export const slideElementSchema = z.object({
  element_id: z.uuid().optional(),
  name: z.string().max(80),
  role: elementRoleSchema.catch("autre"),
  js: z.string().min(1).max(40000),
  slots: z.array(layerSlotSchema).max(12),
  texts: z.record(z.string().regex(SLOT_NAME), z.string().max(400)),
  fonts: z.array(z.string().regex(LOOK_FONT)).max(3),
  /** Design width in px (on a 1080-wide frame): the component is drawn at this width, then scaled to the box. */
  base: z.number().int().min(60).max(1080),
  box: elementBoxSchema,
  /** Its accent colour, instead of the studio's. */
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type SlideElement = z.infer<typeof slideElementSchema>;

/** At most this many components on one photo. */
export const MAX_ELEMENTS = 8;

const slotTextsSchema = z.array(z.object({ slot: z.string().regex(SLOT_NAME), text: z.string().max(400) }));

const designedElementSchema = z.object({
  ref: z.string().regex(/^e\d{1,2}$/).describe("Repère du composant dans cette réponse : e1, e2…"),
  name: z.string().max(80).describe("Nom court : ce que c'est et son style, ex. « Étiquette pilule bordeaux »"),
  role: elementRoleSchema,
  code: z.string(),
  slots: z.array(layerSlotSchema).max(12),
  fonts: z.array(z.string().regex(LOOK_FONT)).max(3).describe("Familles Google Fonts utilisées"),
  base_width: z.number().int().min(60).max(1080).describe("Largeur de dessin du composant en px, sur une photo de 1080 de large"),
});

/** What the component designer answers: the components, and where they go on each photo. */
export const kitDesignOutputSchema = z.object({
  kit_name: z.string().max(80).describe("Nom du kit, ex. « Checklist bordeaux et script »"),
  notes: z.string().max(400).describe("Ce que tu as repris de l'exemple, en une phrase"),
  elements: z.array(designedElementSchema).min(1).max(MAX_ELEMENTS),
  slides: z
    .array(
      z.object({
        photo: z.number().int().min(1),
        placements: z
          .array(
            z.object({
              ref: z.string().regex(/^e\d{1,2}$/),
              x: z.number().describe("Bord gauche, part de la largeur (0 à 1)"),
              y: z.number().describe("Bord haut, part de la hauteur (0 à 1)"),
              w: z.number().describe("Largeur affichée, part de la largeur (0,06 à 1)"),
              rotate: z.number().describe("Inclinaison en degrés (0 si droit)"),
              texts: slotTextsSchema,
            }),
          )
          .max(MAX_ELEMENTS),
      }),
    )
    .min(1)
    .max(10)
    .describe("Les composants posés sur chaque photo, avec les vrais mots du commerce"),
});
export type KitDesignOutput = z.infer<typeof kitDesignOutputSchema>;

const contract = `Contrat du code de chaque composant (strict) :
- Écris uniquement une fonction : function Element({ width, brand, texts }) { ... return (<div style={{ width, position: "relative" }}>...</div>); } — width vaut toujours base_width : dessine le composant à cette largeur, en px. Sa hauteur suit son contenu (pas de hauteur fixe sauf pour une forme : un rond, une pastille). Il est ensuite posé et agrandi ou réduit en entier sur la photo : ne t'occupe pas de sa position dans le cadre.
- Fond transparent autour du composant : seul ce qu'il dessine (texte, fond de pastille, filet, case) est visible, la photo est dessous.
- Aucun texte en dur : chaque texte vient d'un slot, texts.nom_du_slot (minuscules, chiffres, _), avec une valeur par défaut (texts.titre ?? "…"). Déclare chaque slot dans "slots" avec sa longueur maximale. Un slot multiline contient plusieurs lignes séparées par "\\n" : découpe-le (split("\\n")) pour une liste, des étapes ; le nombre de lignes varie, le composant s'adapte (sa hauteur grandit).
- Conçois pour le texte le plus long que permet max_chars : les mots passent à la ligne dans la largeur, jamais de texte coupé ni de whiteSpace: "nowrap" sur un texte qui peut s'allonger (sauf une étiquette courte de quelques mots, dont la largeur suit alors le texte : display: "inline-flex").
- Pas d'import, pas d'export. Seuls ces identifiants existent : ${MOTION_SCOPE.join(", ")}. Styles en ligne et SVG en ligne (pictos, cases, flèches, formes).
- Interdits : fetch et tout accès réseau, Math.random, Date, setTimeout, eval, window, document, balises <script>, images externes (seul brand.logoUrl peut être affiché avec <Img>, s'il existe).
- Polices : celles que tu déclares dans "fonts" (familles Google Fonts exactes, 3 au plus) sont chargées, plus brand.displayFont et brand.bodyFont. Si « polices_du_studio » est donné, ce sont les polices de la gérante (déjà chargées) : utilise-les en priorité par leur nom, sans les mettre dans "fonts".
- brand = { name, accent, accentInk, ink: "#1C1530", cream: "#FBF7F4", displayFont, bodyFont, logoUrl }.
- C'est une image fixe : pas d'animation.`;

export const ELEMENTS_DESIGNER_PROMPT = `Tu es directeur artistique et développeur front senior. Tu construis le design system d'un commerce de quartier pour ses publications Instagram (photos 1080 × 1350) : des composants de texte réutilisables, posés sur ses photos.

On te donne en général un exemple (un post que la gérante aime) et ses photos. Décompose l'exemple en composants : chaque pièce qui peut vivre seule et resservir ailleurs devient un composant (un titre, une étiquette ou pastille, une checklist, des étapes numérotées, un prix dans un rond, une citation, un bouton d'appel, une date, une signature manuscrite, un décor avec texte). Ce qui doit rester collé pour garder l'effet (un mot manuscrit posé en travers d'un titre, une pastille accrochée au coin d'un cadre) forme UN seul composant. En général 2 à 5 composants ; un seul si l'exemple n'a qu'une pièce.

Chaque composant reproduit fidèlement sa pièce de l'exemple : même typographie (la plus proche dans Google Fonts), mêmes graisses, couleurs, fonds, formes, pictos, puces, cadres, filets, angles, mêmes proportions internes (mesure-les : taille des lettres par rapport à la largeur, marges, écarts). Ne garde pas les mots de l'exemple : mets ceux du commerce. Les composants sont génériques : n'importe quels mots de la bonne longueur y tiennent.

Puis pose-les sur chaque photo demandée (slides) pour refaire la composition de l'exemple : position (x, y du coin haut gauche), largeur affichée (w) et inclinaison, en parts du cadre. Mesure l'exemple : la part de la largeur qu'occupe chaque pièce (un titre d'affiche en occupe souvent 70 à 90 %), où elle est, ce qui chevauche quoi. Une composition plus petite, plus sage ou plus aérée que l'exemple est ratée : la gérante veut le même impact. Ignore l'interface d'Instagram visible sur une capture. Place les textes là où ils se lisent sur la photo, sans couvrir l'essentiel (visages, produit). Chaque texte reste entier dans le cadre, à ${LAYER_MARGIN} px des bords au moins (c'est vérifié). Lisible sur téléphone : 26 px minimum une fois posé.
Sans exemple, crée les composants demandés dans la direction artistique du studio : grands textes dans des tons neutres et nobles (blanc cassé, crème, encre), couleurs du studio en accents ; jamais un jaune ou un pastel saturé sur un grand titre.

${contract}

Réponds avec kit_name, notes, elements (ref, name, role, code, slots, fonts, base_width) et slides : pour chaque photo, les composants posés (ref, x, y, w, rotate) avec les vrais mots du commerce dans chaque slot, jamais la description du slot.`;

export const ELEMENT_EDIT_PROMPT = `Tu es directeur artistique et développeur front senior. Tu fais évoluer UN composant du design system d'un commerce (un composant de texte réutilisable, posé sur ses photos Instagram 1080 × 1350). On te donne son code, ses slots, sa largeur de dessin et la demande de la gérante (parfois avec une image d'exemple). Applique exactement la demande et garde tout le reste à l'identique : même nom de slots (tu peux en ajouter si la demande l'exige), même esprit. Si la demande vise sa place ou sa taille sur la photo, adapte plutôt la pose (x, y, w, rotate) que le dessin.

${contract}

Réponds avec kit_name (le nom du composant), notes (ce que tu as changé, en une phrase), elements = [le composant modifié, ref "e1", même role, un name mis à jour si son style a changé] et slides = [{ photo: 1, placements: [e1 posé sur la photo, avec des textes d'exemple réalistes] }].`;

/** Problems that forbid running a component's code (empty when it is acceptable). */
export function checkElementCode(code: string): string[] {
  const problems: string[] = [];
  if (code.length > 16000) problems.push("code trop long");
  if (!/\bfunction\s+Element\s*\(/.test(code)) problems.push("il faut une fonction Element");
  for (const [pattern, label] of FORBIDDEN_CODE) if (pattern.test(code)) problems.push(label);
  return problems;
}

/** Slot texts as a record (the model answers with a list). */
export const elementTexts = (list: { slot: string; text: string }[], slots: { name: string; max_chars: number }[]): Record<string, string> => {
  const max = new Map(slots.map((s) => [s.name, s.max_chars]));
  return Object.fromEntries(list.filter((t) => max.has(t.slot)).map((t) => [t.slot, t.text.slice(0, max.get(t.slot)!)]));
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/** A placement as the model gives it, kept inside what the editor allows. */
export function clampBox(box: { x: number; y: number; w: number; rotate?: number }): ElementBox {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const rotate = Math.round(clamp(box.rotate ?? 0, -45, 45) * 10) / 10;
  return { x: r(clamp(box.x, -0.2, 1)), y: r(clamp(box.y, -0.2, 1)), w: r(clamp(box.w, 0.06, 1.2)), ...(rotate ? { rotate } : {}) };
}

/** The texts a component shows: what it was given, else its sample, for each of its slots. */
export function elementTextsWithSample(slots: { name: string }[], texts: Record<string, string>, sample: Record<string, string>): Record<string, string> {
  return Object.fromEntries(slots.map((s) => [s.name, texts[s.name] || sample[s.name] || ""]).filter(([, v]) => v));
}

/** What placing a component needs to know of it (a bank row, on the server or in the editor). */
export type ElementSource = {
  id: string;
  name: string;
  role: ElementRole;
  slots: z.infer<typeof layerSlotSchema>[];
  js: string;
  fonts: string[];
  base: number;
  box: ElementBox | null;
  sample: Record<string, string>;
};

/** A component as placed on a photo: its box (else where it sat on its kit), its texts (else its sample). */
export function placeElement(element: ElementSource, place: { box?: Partial<ElementBox>; texts?: Record<string, string> } = {}): SlideElement {
  const fallback: ElementBox = element.box ?? { x: 0.1, y: 0.1, w: Math.min(0.8, element.base / 1080) };
  return {
    element_id: element.id,
    name: element.name,
    role: element.role,
    js: element.js,
    slots: element.slots,
    texts: elementTextsWithSample(element.slots, place.texts ?? {}, element.sample),
    fonts: element.fonts,
    base: element.base,
    box: clampBox({ ...fallback, ...place.box }),
  };
}
