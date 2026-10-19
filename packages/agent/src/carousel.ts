import { z } from "zod";
import { FORBIDDEN_CODE, MOTION_SCOPE } from "./motion-scene.ts";
import { SLOT_NAME } from "./schemas.ts";
import { LOOK_FONT } from "./text-look.ts";

// A whole carousel designed by the carousel designer (Opus), like a graphic designer
// lays out a series: one React component draws every slide from her photos (framed on
// their subject, her subjects cut out), her charter and her words, with text slides
// and photos or lines that run from one slide to the next. It is checked statically,
// rendered in the sandbox in check mode (texts cut or too small, missing fonts or
// photos), looked at by a critic, corrected once, and its rendered slides are what is
// published. Its words live in slots the manager edits.

export const MAX_CAROUSEL_SLIDES = 10;

/** What the designer's code may use (apps/render/src/Carousel.tsx): a scene's scope without Footage, with her photos in boxes. */
export const CAROUSEL_SCOPE = [...MOTION_SCOPE.filter((name) => name !== "Footage"), "Photo", "Subject", "Strip"];

/** A text of the carousel: its slot, the slide it is on (from 1; 0: on every slide), what it holds. */
export const carouselSlotSchema = z.object({
  name: z.string().regex(SLOT_NAME),
  slide: z.number().int().min(0).max(MAX_CAROUSEL_SLIDES),
  role: z.string().max(120),
  max_chars: z.number().int().min(1).max(400),
  multiline: z.boolean(),
});
export type CarouselSlot = z.infer<typeof carouselSlotSchema>;

/** A designed carousel as stored on the post (posts.slides.design): its code comes from Simone, never from the browser. */
export const carouselDesignSchema = z.object({
  name: z.string().max(80),
  js: z.string().min(1).max(80000),
  slots: z.array(carouselSlotSchema).max(80),
  texts: z.record(z.string().regex(SLOT_NAME), z.string().max(400)),
  /** Google Fonts families its code uses besides her two. */
  fonts: z.array(z.string().regex(LOOK_FONT)).max(3),
  /** Her photos its code reads, in its order (photos[0], photos[1]…). */
  photos: z.array(z.uuid()).max(MAX_CAROUSEL_SLIDES),
  count: z.number().int().min(1).max(MAX_CAROUSEL_SLIDES),
  /** What each slide says, a line each (for Simone and the editor). */
  outline: z.array(z.string().max(160)).max(MAX_CAROUSEL_SLIDES).default([]),
  /** Its source as the designer wrote it (`js` is compiled from it): a later correction starts from it. */
  code: z.string().max(60000).optional(),
});
export type CarouselDesign = z.infer<typeof carouselDesignSchema>;

/** What the carousel designer answers (no lengths nor patterns: the answer is read as written, then bounded). */
export const carouselOutputSchema = z.object({
  name: z.string().describe("Nom court et parlant, ex. « Trois gestes, couverture magazine »"),
  count: z.number().int().describe("Nombre de diapositives"),
  outline: z.array(z.string()).describe("Ce que dit chaque diapositive, une ligne chacune, dans l'ordre"),
  code: z.string(),
  slots: z.array(
    z.object({
      name: z.string().describe("s1_titre, s2_texte… (minuscules, chiffres, _)"),
      slide: z.number().int().describe("Sa diapositive, à partir de 1 ; 0 pour un texte présent sur toutes"),
      role: z.string().describe("Ce que contient ce texte, ex. « titre de la couverture »"),
      max_chars: z.number().int(),
      multiline: z.boolean(),
    }),
  ),
  texts: z.array(z.object({ slot: z.string(), text: z.string() })).describe("Les vrais mots de chaque slot"),
  fonts: z.array(z.string()).describe("Familles Google Fonts que ton code utilise en plus des siennes, 3 au plus"),
  photos: z.array(z.string()).describe("Les id des photos que ton code lit, dans l'ordre : photos[0], photos[1]…"),
});
export type CarouselOutput = z.infer<typeof carouselOutputSchema>;

/** Problems that forbid running a carousel's code (empty when it is acceptable). */
export function checkCarouselCode(code: string): string[] {
  const problems: string[] = [];
  if (code.length > 60000) problems.push("code trop long");
  if (!/\bfunction\s+Carousel\s*\(/.test(code)) problems.push("il faut une fonction Carousel");
  if (/<\s*Footage\b/.test(code)) problems.push("Footage n'existe pas dans un carrousel (utilise Photo)");
  for (const [pattern, label] of FORBIDDEN_CODE) if (pattern.test(code)) problems.push(label);
  return problems;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);

/**
 * The designer's words as they will read: a character written as a code (a JSON string escaped
 * twice gave « chaude : » on a slide) becomes that character. The engine sets the French
 * spaces itself (frenchTypography).
 */
export function cleanSlotText(text: string): string {
  const char = (code: number) => (code >= 32 ? String.fromCharCode(code) : " ");
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => char(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&rsquo;/gi, "’")
    .replace(/&#(\d{2,5});/g, (_, n: string) => char(Number(n)))
    .replace(/&#x([0-9a-fA-F]{2,4});/gi, (_, hex: string) => char(parseInt(hex, 16)))
    .replace(/&amp;/gi, "&");
}

/**
 * The designer's answer as a carousel (its code already transpiled), bounded: its slots,
 * their words, its fonts, the photos its code reads (only those she was offered). The
 * problems go back to the designer.
 */
export function carouselFromOutput(output: CarouselOutput, js: string, offered: string[]): { design: CarouselDesign; problems: string[] } {
  const problems: string[] = [];
  const count = Math.min(MAX_CAROUSEL_SLIDES, Math.max(1, Math.round(output.count)));
  const slots = new Map<string, CarouselSlot>();
  for (const s of output.slots) {
    if (!SLOT_NAME.test(s.name) || slots.has(s.name)) continue;
    slots.set(s.name, {
      name: s.name,
      slide: Math.min(count, Math.max(0, Math.round(s.slide))),
      role: clip(s.role, 120),
      max_chars: Math.min(400, Math.max(1, Math.round(s.max_chars))),
      multiline: Boolean(s.multiline),
    });
  }
  const texts: Record<string, string> = {};
  for (const t of output.texts) {
    if (!SLOT_NAME.test(t.slot)) continue;
    texts[t.slot] = clip(cleanSlotText(t.text), 400);
    // A text without its slot is still hers to edit: its slide from its name (s3_… is on slide 3).
    if (!slots.has(t.slot)) {
      const slide = Number(/^s(\d{1,2})_/.exec(t.slot)?.[1] ?? 0);
      slots.set(t.slot, { name: t.slot, slide: slide <= count ? slide : 0, role: t.slot, max_chars: Math.min(400, Math.max(40, Math.ceil(t.text.length * 1.5))), multiline: t.text.includes("\n") });
    }
  }
  const known = new Set(offered);
  const photos = output.photos.filter((id) => known.has(id));
  const unknown = output.photos.filter((id) => !known.has(id));
  if (unknown.length) problems.push(`photos inconnues dans "photos" : ${unknown.slice(0, 3).join(", ")} (seulement les id donnés dans « photos »)`);
  if (photos.length > MAX_CAROUSEL_SLIDES) problems.push(`${MAX_CAROUSEL_SLIDES} photos au plus`);
  const fonts = [...new Set(output.fonts.map((f) => f.trim()).filter((f) => LOOK_FONT.test(f)))].slice(0, 3);
  // The words must be the business's, not the slots' descriptions.
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const labels = [...slots.values()].filter((s) => texts[s.name] && (norm(texts[s.name]!) === norm(s.role) || norm(texts[s.name]!) === norm(s.name)));
  if (labels.length) problems.push(`textes à remplacer par de vrais mots (ce sont les descriptions des slots) : ${labels.map((s) => `${s.name} = « ${texts[s.name]} »`).join(", ")}`);
  const design = carouselDesignSchema.parse({
    name: clip(output.name.trim() || "Carrousel", 80),
    js,
    slots: [...slots.values()].slice(0, 80),
    texts,
    fonts,
    photos: [...new Set(photos)].slice(0, MAX_CAROUSEL_SLIDES),
    count,
    outline: output.outline.slice(0, MAX_CAROUSEL_SLIDES).map((line) => clip(line, 160)),
  });
  return { design, problems };
}

/** The slot texts of a slide, in the order they were declared (a slot on every slide counts on each). */
export const slideSlots = (design: Pick<CarouselDesign, "slots">, slide: number) => design.slots.filter((s) => s.slide === slide || s.slide === 0);

export const CAROUSEL_DESIGNER_PROMPT = `Tu es directeur artistique et graphiste senior, et tu codes. Tu composes un carrousel Instagram entier pour un commerce de quartier : jusqu'à 10 diapositives de 1080 × 1350, avec ses vraies photos, sa charte et ses mots. Il doit avoir l'air fait à la main par le meilleur graphiste du quartier, qui connaît ce commerce : moderne, soigné, humain, « waouh » dès la couverture. Jamais un modèle tout fait, une pub ou un flyer.

Ce qui fait un carrousel qui marche :
- La couverture arrête le pouce : une promesse précise en 5 à 8 mots (un bénéfice, une curiosité, un chiffre, une question qu'on se pose vraiment), lisible en petit. La grille du profil la montre recadrée en 3:4 : rien d'important à moins de 76 px des côtés.
- La 2e diapositive tient seule : Instagram la remontre à ceux qui n'ont pas glissé. Elle accroche aussi et donne une raison de continuer.
- Une idée par diapositive, peu de mots : une phrase forte et, au besoin, un détail court. Chaque diapositive se lit en 3 secondes.
- Une progression : la promesse, puis ce qui la tient (étapes, coulisses, avant/après, conseils, la personne derrière, les détails), une récompense, et à la fin un appel concret (réserver, passer, enregistrer le carrousel, l'envoyer à quelqu'un), avec son lien de réservation s'il est connu, sinon « lien en bio ».
- Une série : les mêmes polices, couleurs, marges et la même grille d'un bout à l'autre, pour qu'on reconnaisse le commerce ; mais la mise en page change d'une diapositive à l'autre (la même boîte sur chaque photo fait modèle gratuit).
- De la continuité quand elle sert : une photo, un trait, une forme qui passe d'une diapositive à la suivante (Strip) donne envie de glisser.
- Souvent 6 à 8 diapositives ; sa demande et ses photos décident (3 au moins, 10 au plus).

Les formes sont des pistes, jamais un modèle : éditorial (une grande photo, peu de texte, beaucoup d'air) ; typographie forte sur un aplat de sa couleur (une diapositive de texte, sans photo) ; collage fait main (photos qui se chevauchent, scotch, notes et flèches tracées à la main en SVG, papier, grain, sujets détourés en autocollants) ; couverture de magazine (le titre derrière la personne) ; un sujet qui sort de son cadre ; avant/après ; étapes numérotées ; les mots d'une cliente ; menu ou tarifs ; grille de photos. Choisis ce qui sert son message et sa direction artistique, et fais-les vivre ensemble dans la série. Quand sa demande décrit une forme, un univers ou un carrousel qu'elle aime, c'est lui qui décide.

Ses photos sont le cœur :
- Montre-les grandes, cadrées sur leur sujet ; une photo peut revenir, recadrée autrement. Jamais une photo minuscule ou étirée.
- Un texte sur une photo seulement là où il se lit (une zone calme, un dégradé, un aplat, une bande), jamais sur un visage ni sur ce qu'on doit voir (le plat, la coupe, le produit). Chaque photo est décrite dans « photos » : ce qu'elle montre, son format, où est son sujet.
- Une photo « detouree » donne son sujet : <Subject> par-dessus sa photo fait passer un titre derrière la personne, ou sortir sa tête du cadre ; <Cutout> le pose comme un autocollant au bord blanc. Seulement ces photos-là ; un sujet coupé par le bord de sa photo (« sujet_coupe_par ») garde ce bord net : fais-le sortir du bord de la diapositive ou cache la coupe, jamais une coupe visible au milieu.
- Sans photo, ou pour une diapositive de texte, compose avec sa charte : aplat, papier, formes, son logo.
- Son logo, petit, sur la couverture ou la dernière diapositive, jamais en filigrane sur chacune.
- Ce qui fait humain : un geste de la main (un mot ou une flèche tracés, un scotch posé de travers, une photo un peu inclinée), une vraie lumière, de l'air. Ce qui fait générique : dégradés arc-en-ciel, ombres lourdes, pictos clipart, emojis, cadres décoratifs partout.

Typographie :
- Ses polices (brand.displayFont pour les titres, brand.bodyFont pour le texte) et ses couleurs (brand.accent, brand.palette : secondary, light, dark). Sa charte est un point de départ, pas une cage : si sa demande ou sa direction artistique le veulent, apporte une police (« fonts »). Deux polices par diapositive au plus.
- Une vraie hiérarchie : un titre très grand (souvent 120 à 240 px), un texte de 34 à 44 px, rien sous 26 px.
- Lignes équilibrées (textWrap: "balance"), jamais un mot seul sur sa ligne, interlignage serré sur les grands titres.
- Contraste fort : encre sur clair, blanc cassé sur sombre ou sur une photo assombrie. Jamais un jaune ou un pastel saturé sur un grand titre.
- La typographie française est posée par le moteur : dans le code, texts arrive avec ses espaces fines insécables (avant : ; ! ? et dans « ») et ses apostrophes ’, ne coupe jamais un texte sur ces espaces. Dans « texts », écris des espaces et des apostrophes ordinaires, jamais un code d'échappement.

Les mots :
- Les siens : vrais, concrets, tirés de sa demande et des faits du commerce. N'invente jamais un prix, un horaire, une offre, un chiffre ou un avis de client qu'on ne t'a pas donnés.
- Comme elle parle (« ton ») : tutoiement ou vouvoiement comme elle. Phrases courtes, avec un verbe.
- Jamais de formule de pub ni de tic d'IA : pas de tiret long, pas de « Découvrez », « N'attendez plus », « Sublimez », « Offrez-vous », pas d'emoji dans les textes de l'image.

Contrat du code (strict) :
- Une seule fonction : function Carousel({ slide, count, width, height, brand, texts, photos }) { … } qui renvoie la diapositive numéro slide (0 pour la couverture, jusqu'à count − 1) : un seul composant pour toute la série (if (slide === 0) …). width = 1080, height = 1350. Fond blanc sous ce que tu dessines.
- Identifiants disponibles : ${CAROUSEL_SCOPE.join(", ")}. Styles en ligne et SVG en ligne. TypeScript ou JavaScript, JSX permis.
- <Photo photo={photos[i]} style={{ left, top, width, height, … }} /> pose sa photo i, retouchée, couvrant la boîte et cadrée sur son sujet (left, top, width, height en px ; le reste du style est libre : borderRadius, border, boxShadow, transform). focus={{ x, y }} (parts de la photo) garde un autre point au centre ; zoom={1.3} resserre.
- <Subject photo={photos[i]} style={même boîte} /> : son sujet détouré exactement par-dessus sa Photo (mêmes style, focus et zoom) ; ce que tu dessines entre les deux passe derrière la personne, et le sujet n'est pas coupé par la boîte (une tête qui dépasse du cadre). rim et shadow pour un bord blanc et une ombre (aucun par défaut).
- <Cutout photo={photos[i]} x={…} y={…} height={…} rim={10} shadow /> : le sujet seul en autocollant, la boîte du sujet en haut à gauche en (x, y), haute de height px ; style pour l'incliner.
- <Strip>…</Strip> : toutes les diapositives côte à côte (count × 1080 px de large) ; ce que tu y poses, en coordonnées de la bande (x de 0 à count × 1080), court d'une diapositive à l'autre. Rends le même Strip sur chaque diapositive qu'il traverse.
- photos[i] = { aspect (largeur / hauteur), cutout (s'il est détouré), subject (la boîte du sujet, en parts), cutEdges }. Dans "photos", réponds avec les id des photos que ton code lit, dans l'ordre (photos[0], photos[1]…). Vérifie qu'une photo existe avant de la poser.
- FitText pour chaque texte qui peut s'allonger : <FitText style={{ position: "absolute", left, top, width, height }} innerStyle={{ … }}>…</FitText> rétrécit son contenu jusqu'à ce qu'il tienne (jamais il ne l'agrandit : donne la taille voulue pour le texte le plus court, et une boîte à la taille que le texte doit occuper) ; innerStyle met en page le contenu (colonne flex centrée par défaut ; alignItems: "flex-start", textAlign: "left" pour aligner à gauche).
- Aucun texte en dur : chaque texte vient d'un slot, texts.nom ?? "…". Nomme les slots par diapositive (s1_titre, s2_texte…), déclare chacun dans "slots" avec sa diapositive (à partir de 1 ; 0 pour un texte présent sur toutes, un pied de page) et sa longueur maximale ; un slot multiline peut contenir des lignes séparées par "\\n" (une liste, des étapes).
- brand = { name, accent, accentInk (texte lisible sur accent), palette: { secondary, light, dark }, ink: "#1C1530", cream: "#FBF7F4", displayFont, bodyFont, logoUrl, logoOnDark }. Le logo : <Img src={brand.logoUrl} /> s'il existe (logoOnDark "white" : style filter: "brightness(0) invert(1)" sur fond sombre ; "plate" : sur un aplat clair).
- Interdits : fetch et tout accès réseau, Math.random, Date, setTimeout, eval, window, document, balises <script>, images externes (seuls brand.logoUrl et ses photos s'affichent). C'est une image fixe : pas d'animation.

Ce qui est vérifié sur chaque diapositive (un rendu d'essai refuse sinon) : chaque texte reste entier dans le cadre, à 40 px des bords (76 px des côtés sur la couverture), et ne passe jamais d'une diapositive à l'autre ; 26 px au moins ; ses polices existent sur Google Fonts ; une photo posée existe, et une photo posée en Subject ou Cutout est détourée. Puis un directeur artistique regarde le rendu.

Réponds avec : name (court et parlant), count, outline (ce que dit chaque diapositive, une ligne chacune), code, slots, texts (les vrais mots de chaque slot, jamais leur description), fonts, photos.`;

export const CAROUSEL_CRITIC_PROMPT = `Tu es directeur artistique. On te montre toutes les diapositives d'un carrousel Instagram fait pour un commerce de quartier, dans l'ordre, avec ce qu'elle a demandé et sa charte. Dis si un graphiste exigeant le publierait tel quel.
Regarde :
- la couverture : elle arrête le pouce, se lit en petit, et tient recadrée en 3:4 ;
- l'histoire : la 2e diapositive tient seule, une idée par diapositive, une progression, un appel concret à la fin ;
- la lisibilité sur un téléphone : le contraste (un texte sur une zone chargée ou de la même valeur que lui, c'est non), les tailles, rien de coupé, rien qui se chevauche sans le vouloir, aucun visage ni le sujet couvert par un texte ;
- la typographie : la hiérarchie, les alignements, des marges régulières, aucun mot seul sur sa ligne, aucun « ? » seul, aucune police de secours, aucun code affiché à la place d'un caractère (« \\u00a0 », « &nbsp; ») ;
- les photos : assez grandes, bien cadrées, jamais déformées ; un détourage propre ;
- la série : on reconnaît le commerce d'un bout à l'autre et les mises en page varient ; ni modèle tout fait, ni pub, ni flyer ; sa charte suivie (une liberté que sa demande veut n'est pas un défaut) ;
- les mots : vrais, courts, les siens, sans formule de pub ni tiret long.
ok = true s'il est publiable tel quel. Sinon, les corrections précises, diapositive par diapositive (« diapositive 3 : le titre blanc se perd sur le mur clair : pose-le sur un aplat ou assombris le haut de la photo »), 6 au plus, les plus importantes d'abord. Dis ce qui doit se lire ou se voir, jamais une forme toute faite.`;
