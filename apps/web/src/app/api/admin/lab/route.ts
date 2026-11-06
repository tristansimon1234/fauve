import { after } from "next/server";
import { z } from "zod";
import {
  borrowedEffects,
  CHAT_MODEL,
  CLAUDE_MODEL,
  DEFAULT_EFFORT,
  directorOutputSchema,
  HOUSE_MODELS,
  editPlanSchema,
  effortSchema,
  GEMINI_MODEL_ID,
  HOUSE_SOURCE,
  isKimiModel,
  imaginedBrief,
  intentionTitle,
  isMotionSegment,
  MAX_MONTAGE_FILES,
  motionTemplateSchema,
  planTimeline,
  reelLink,
  slidesPlanSchema,
  type Effort,
  type MotionTemplate,
} from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { replyInConversation } from "@/lib/agent/conversation";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { readWebsite } from "@/lib/agent/website";
import { cronAuthorized } from "@/lib/cron-auth";
import { startEffectWords } from "@/lib/effect-words";
import { usableFonts } from "@/lib/fonts";
import { queueJob } from "@/lib/jobs";
import { readSiteLook } from "@/lib/site-look";
import { houseInspiration } from "@/lib/house-models";
import { missMessage, modelVideo, stealNow, stealStyle } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { speak, writeVoiceScript } from "@/lib/voice-over";
import { ensureTranscript } from "@/lib/voice";
import { voiceFromVideo } from "@/lib/own-voice";
import { startCarousel } from "@/lib/carousels";
import { renderPost } from "@/lib/render/render-post";
import { voiceNoteInSandbox } from "@/lib/render/sandbox";
import { photoRegions } from "@/lib/video/regions";

// A test bench for the whole montage chain in production: what Edith makes alone, on
// the same media as hand-made references. Each case is a lab studio of its own (its
// business, brand and facts; website_url lab://<case>), so its Reel is a first Reel, as
// at onboarding. POST with CRON_SECRET, from the database (call_app):
//   ?case=…[&reset=1]    sets up the studio and its media if needed (free stock clips by
//                        URL, or the photos of a demo studio), has them all read (Gemini),
//                        then starts the same montage job as a manager's Reel at the default
//                        care (editor, motion designer, render with music, critic, corrections),
//                        without a quote. Answers at once and works after the response.
//                        reset=1 first removes the case's posts and scenes, for a new first Reel;
//                        stock=<id>,… other free stock clips (Mixkit ids) for this run, to try a
//                        clip without a new deploy;
//                        route=agent|chain makes this Reel with the effects workshop or the chain,
//                        to compare them on the same case (else decided as for her);
//                        free=1 makes it in none of Edith's models (the creative test: the editor and the motion
//                        designer free with every tool), effort=rapide|soigne|max at that care (else the default);
//                        a Reel in none of Edith's models (free=1, or a Reel to copy that no model plays) borrows
//                        one or two of their signature effects, its motion designer starting from their code
//                        (lib/agent/borrowed-effects.ts); effects=0 lends none: the chain as before (the director
//                        for a copy), to compare on the same videos;
//                        idea=<her words> is what she writes in « Ce que tu imagines » (else the
//                        case's idea), sent as the Créer screen sends it: the post's title, and
//                        « Ce que la gérante imagine : … » for the editor and the voice;
//                        voice=1 (or voice=<ElevenLabs voice id>) is her « Voix off » choice on that
//                        screen (else the studio's setting): the montage job writes and records it;
//                        own_voice=1 (or own_voice=<her words>) a voice note of hers instead, as one
//                        comes from WhatsApp: words for the images (or hers) read by a voice of the
//                        gallery, made a phone's OGG Opus note (16 kHz mono, quieter, band-limited),
//                        kept as a WhatsApp audio and read by Scribe, then put on the Reel; on a model
//                        whose words are what its voice says (model=celui-la), her voice leads it (its words
//                        on screen hers, its cuts on them: step=result's voice_leads), or is laid over it;
//                        voice_video=<file> her voice taken from one of her videos instead (one of own=: its
//                        speech read, its sound from her first word to her last taken once in the workshop),
//                        as Edith takes it when she asks « prends ma voix de la vidéo où je parle »;
//                        steal=<url> (« Steal ») first has the style of a Reel read, from its link
//                        (Instagram, TikTok, a Short) or a video file's URL, and the lab Reel copies it
//                        (one shot, as when she sends Edith a Reel to copy); steal=lab:<file> a video
//                        uploaded to the lab studio, read as a video she sent in the chat (it leaves
//                        the library once read); with steal_only=1, nothing more (no montage):
//                        step=result shows what was read;
//                        own=<file>,… videos of hers uploaded to the lab studio, instead of the stock clips
//                        (a .jpg, .png or .webp is one of her photos, beside the case's).
//   ?case=…&step=upload&file=<name>.mp4|mov|jpg  a signed upload URL (2 h) for a file of hers into the
//                        lab studio ({studio}/lab/<name>), for own= and steal=lab:.
//   ?case=…&step=result  every version: its render (signed link, 24 h), the plan kept
//                        (without the scenes' code; borrowed: the models' effects its briefs borrow), the delivered message, what this Reel cost
//                        (costs) and what the lab studio has spent over all its runs (studio_costs).
//   ?case=…&step=music   the version kept rendered again with a newly composed piece, the
//                        montage untouched: to hear a change to the music without a new montage.
//   ?case=…&step=chat&text=…[&c=<conversation>]  one message of hers to Edith in the app (a web
//                        conversation of the lab studio, made or continued), and Edith's answer with
//                        its cards and buttons; what Edith starts runs after. It waits for the answer
//                        (call net.http_post with the Vault's secret and a minute: call_app gives up at 5 s).
//                        Never on WhatsApp: a lab studio has no member.
//   ?case=…&step=words&words=[{"id":…,"text":…}]  her own words on the lab Reel's effect (an effect the
//                        agent made with its kit; the ids are in step=result's plan), as she saves them
//                        on its page: its kit draws the effect again, then step=result shows the version.
//   ?case=…&format=carrousel  a carousel instead of a Reel, from the case's photos (coiffure, trattoria),
//                        composed by the carousel designer as for her (her photos read and cut out,
//                        a test render of every slide, the critic, one correction), never charged;
//                        idea=<her words> what she asks for (else the case's carousel idea);
//                        step=result then gives its slides (signed links, 24 h) and its outline.
//   ?site=<url>[&kind=coiffeur|restaurant|pilates][&clips=1][&own=<file>,…][&reset=1][&idea=…][&voice=…|&own_voice=…][&format=carrousel][&steal=<url>[&steal_only=1]|&model=<key of a house model>]
//                        a real business from its website, as at onboarding: its site read
//                        (facts and activity, colours and fonts of its code, logo), then its look
//                        (its page read in the sandbox's browser: fonts and colours measured, captures;
//                        Sonnet writes its art direction and signature, gives its fonts their free
//                        twins and keeps the photos that show the business), then its first Reel
//                        from those photos (clips=1 adds the stock clips of the kind's trade; the
//                        kind only sets the idea; own= her videos, uploaded with step=upload&file=…, as for
//                        a case). Never published. step=result adds its brand.
//   motion=<gemini model>|<kimi model>|claude  (with a case or a site) the model that writes its
//                        animations from this run on (studios.motion_model, read only for a lab studio):
//                        to compare Gemini or Kimi (kimi-k3.1-pro…, through Vercel AI Gateway) with Opus on
//                        the same case (reset=1 for the same first Reel); step=result gives the model and
//                        what its animations cost (motion).
// Lab studios go with /api/admin/delete-studio.
// A render with its music (step=music) runs after the answer, as long as a montage job's step.
export const maxDuration = 800;

/** The files of one montage, as in the app (MAX_FILES) and the montage job. */
const MAX_MEDIA = MAX_MONTAGE_FILES;

type LabCase = {
  name: string;
  business: string;
  facts: string[];
  brand: { colors: string[]; fonts: [string, string]; tone: string };
  /** A form she asks for (« collage »); none: the editor chooses the rhythm and the form, as for her. */
  template?: MotionTemplate;
  title: string;
  /** What she asks for: the post's idea and the editor's request. */
  idea: string;
  /** What she asks for as a carousel (format=carrousel), from the case's photos. */
  carousel?: string;
  /** Free stock clips (Mixkit licence), in 720p. */
  clips?: number[];
  /** Videos of hers uploaded to the lab studio (step=upload), by file name. */
  own?: string[];
  /** The vertical photos of a demo studio. */
  photosOf?: { studio: string; max: number };
  /** Who makes the Reel for this run (route=agent|chain), to compare the effects workshop with the chain; else decided as for her. */
  route?: "agent" | "chain";
  /** Made in none of Edith's models (free=1): the editor and the motion designer free with every tool (the creative test). */
  free?: boolean;
  /** Its level of care for this run (effort=rapide|soigne|max), else the default. */
  effort?: Effort;
  /** False (effects=0): no effect of Edith's models lent to this Reel, the chain as before, to compare with the test. */
  effects?: boolean;
};

const CASES: Record<string, LabCase> = {
  // The site's Reels made again by the real chain (Tristan: « les reels qu'on a mis sur la landing on pourra tenter
  // de les refaire avec le nouveau système ? »): the same clips and the same request as on the landing (work.ts).
  cafe: {
    name: "Café Tolbiac",
    business: "café de spécialité",
    facts: ["Café de spécialité, Paris 13e", "Espresso et café filtre, grains torréfiés à Paris"],
    brand: { colors: ["#7A4B2A", "#F3EBDD", "#1F1A17"], fonts: ["Instrument Serif", "Inter Tight"], tone: "chaleureux, complice, tutoiement" },
    title: "Le premier café",
    idea: "Le premier café, avec un effet qui surprend.",
    clips: [41859, 41865, 4992, 796, 810],
  },
  bar: {
    name: "Le Comptoir",
    business: "bar à cocktails",
    facts: ["Bar à cocktails, Paris 11e", "Cocktails maison, ouvert le jeudi soir"],
    brand: { colors: ["#C1121F", "#F5F2EC", "#111111"], fonts: ["Bodoni Moda", "Inter Tight"], tone: "nocturne, élégant, tutoiement" },
    title: "Le jeudi soir",
    idea: "Le jeudi soir, en noir et blanc, avec du rouge.",
    clips: [4043, 4173, 4174, 4295, 4416, 5132, 5133],
  },
  procope: {
    name: "Le Procope",
    business: "café-restaurant",
    facts: ["Café-restaurant historique, Paris 6e"],
    brand: { colors: ["#B4232A", "#F4EDE2", "#1B1B1B"], fonts: ["Syne", "Inter Tight"], tone: "élégant, parisien, tutoiement" },
    title: "Au Procope",
    idea: "Le nom « Au Procope » en très grand dans le décor, les passants qui passent devant les lettres, puis une rafale de plans du quartier.",
    // Public domain videos of the street Tristan uploaded with step=upload (2-le-procope-serveur.mp4: people walking past its front).
    own: ["2-le-procope-serveur.mp4", "1-terrasse-mariniere.mp4", "3-boulangerie-le-viennoise.mp4", "4-rue-passantes-graphic.mp4", "5-feu-pieton-affiches.mp4", "6-passage-pieton-rue.mp4"],
  },
  // Places for the models' benches, each one shoot of one person (Pexels, free licence, horizontal), found for their
  // beauty (Tristan of a bench on unrelated clips: « pas sûr que les vidéos choisies correspondent bien », then « il faut
  // que ce soit de beaux reels », « ça doit attirer l'œil, être en lien avec ce qu'on a, qui on vend », « du vintage
  // aussi »): a seaside pier whose name is its bulb sign at night (Lieu tapé: the name typed in the sky is the sign the
  // cut lands on), a grand café under a glass roof, a vintage clothes shop, a florist. A Paris café was taken out: Tristan
  // did not want to promote it.
  brighton: {
    name: "Brighton Pier",
    business: "jetée de loisirs",
    facts: ["Jetée du front de mer de Brighton, en Angleterre", "Manèges, cafés et fish & chips, ouverte jusqu'à la nuit"],
    brand: { colors: ["#D7263D", "#F5F2EC", "#1B3A4B"], fonts: ["Archivo Black", "Inter Tight"], tone: "joyeux, estival, tutoiement" },
    title: "Brighton Pier",
    idea: "Notre jetée du matin au soir : ça doit donner envie de venir passer la journée chez nous.",
    own: [
      "01-facade-cafe.mp4",
      "02-enseigne-pier.mp4",
      "03-pier-nuit.mp4",
      "04-kiosque-couchant.mp4",
      "05-manege-soir.mp4",
      "06-promenade-bateaux.mp4",
      "07-promenade-kiosque.mp4",
      "08-plage-hotels.mp4",
      "09-cafe-fenetre-mer.mp4",
      "10-terrasse-regency.mp4",
      "11-passants-kiosque.mp4",
      "12-couple-pier.mp4",
    ],
  },
  budapest: {
    name: "Párisi Udvar",
    business: "grand café historique",
    facts: ["Grand café sous la verrière du passage Párisi Udvar (1909), à Budapest", "Café, pâtisseries et cocktails sous la verrière"],
    brand: { colors: ["#8C1C13", "#F5F2EC", "#1F1A17"], fonts: ["Bodoni Moda", "Inter Tight"], tone: "élégant, chaleureux, tutoiement" },
    title: "Párisi Udvar",
    idea: "Notre café sous la verrière, un après-midi : ça doit donner envie de venir prendre un café chez nous.",
    own: [
      "01-tram-rue.mp4",
      "02-trams-ciel.mp4",
      "03-passante-tram.mp4",
      "04-tram-soir.mp4",
      "05-cour-arcades.mp4",
      "06-passage-verriere.mp4",
      "07-cafe-verriere.mp4",
      "08-arches-verriere.mp4",
      "09-femme-rouge.mp4",
      "10-cafe-table.mp4",
      "11-latte-dessert.mp4",
      "12-cocktail-marbre.mp4",
    ],
  },
  friperie: {
    name: "La Fripe Rétro",
    business: "friperie vintage",
    facts: ["Friperie vintage : vêtements, chaussures, chapeaux et lunettes des années 60 à 90", "Deux salles, de nouvelles pièces chaque semaine"],
    brand: { colors: ["#C1440E", "#F5F2EC", "#1D1D1B"], fonts: ["DM Serif Display", "Inter Tight"], tone: "décontracté, vintage, tutoiement" },
    title: "Nouvel arrivage",
    idea: "Le nouvel arrivage de la semaine, des pièces vintage : ça doit donner envie de venir chiner.",
    own: [
      "01-boutique.mp4",
      "02-chaussures.mp4",
      "03-portant-mains.mp4",
      "04-portants-couleurs.mp4",
      "05-lunettes.mp4",
      "06-chapeaux.mp4",
      "07-clientes.mp4",
      "08-duo-chapeaux.mp4",
      "09-robe-carreaux.mp4",
      "10-modeles.mp4",
      "11-lunettes-noires.mp4",
      "12-beret.mp4",
    ],
  },
  fleuriste: {
    name: "Atelier Rose",
    business: "fleuriste",
    facts: ["Fleuriste de quartier : bouquets du jour, roses et compositions", "Bouquets emballés à la demande"],
    brand: { colors: ["#B23A48", "#F5F2EC", "#2F4A3A"], fonts: ["Instrument Serif", "Inter Tight"], tone: "doux, chaleureux, tutoiement" },
    title: "Bouquets du jour",
    idea: "Les bouquets du jour, faits à la main : ça doit donner envie de passer à la boutique.",
    own: [
      "01-vitrine-roses.mp4",
      "02-entree-roses.mp4",
      "03-enseigne-frigo.mp4",
      "04-vitrine-bouquets.mp4",
      "05-tournesols.mp4",
      "06-mains-roses.mp4",
      "07-vase.mp4",
      "08-roses-mur-vert.mp4",
      "09-papier-rouge.mp4",
      "10-proteas.mp4",
      "11-comptoir.mp4",
      "12-bouquet-fini.mp4",
    ],
  },
  // A bookshop's front, fixed, from across its street, and its street (one shoot on Pexels): for « Façade qui se construit ».
  librairie: {
    name: "Brick Lane Bookshop",
    business: "librairie indépendante",
    facts: ["Librairie indépendante de Brick Lane, à Londres", "Romans, livres d'art et sacs en toile, de nouveaux titres chaque semaine"],
    brand: { colors: ["#111111", "#F5F2EC", "#B5292F"], fonts: ["DM Serif Display", "Inter Tight"], tone: "curieux, chaleureux, tutoiement" },
    title: "Brick Lane Bookshop",
    idea: "Notre librairie dans sa rue : ça doit donner envie de passer la porte.",
    own: [
      "01-facade.mp4",
      "02-facade-passants.mp4",
      "03-vitrine-photographe.mp4",
      "04-rue-pont.mp4",
      "05-rue-panneaux.mp4",
      "06-rue-passants.mp4",
      "07-coin-graffiti.mp4",
      "08-vintage-photographes.mp4",
      "09-boutique-photographe.mp4",
    ],
  },
  // A cake made gesture by gesture, phone on a tripod (one shoot on Pexels): for « Recette cosy, typo pixel ».
  patisserie: {
    name: "Pâtisserie Lila",
    business: "pâtisserie",
    facts: ["Pâtisserie de quartier : entremets, choux et gâteaux de saison faits maison", "Le gâteau du moment : fraise et menthe"],
    brand: { colors: ["#7FC8A9", "#F5F2EC", "#E86A92"], fonts: ["Fraunces", "Inter Tight"], tone: "gourmand, doux, tutoiement" },
    title: "Gâteau fraise-menthe",
    idea: "Notre gâteau fraise-menthe, du début à la fin : ça doit donner envie de venir le goûter.",
    own: [
      "01-resultat-dessus.mp4",
      "02-on-touche.mp4",
      "03-oeufs.mp4",
      "04-farine.mp4",
      "05-fouet.mp4",
      "06-creme-menthe.mp4",
      "07-creme-genoise.mp4",
      "08-poche.mp4",
      "09-fraises.mp4",
      "10-montage.mp4",
      "11-glacage.mp4",
      "12-finitions.mp4",
    ],
  },
  // A ceramicist standing in her workshop and photos of her pieces (one shoot on Pexels): for « Voici mon travail ».
  ceramiste: {
    name: "Atelier Argile",
    business: "atelier de céramique",
    facts: ["Atelier de céramique : tasses, bols et assiettes tournés et émaillés à la main", "Cours de tournage le samedi"],
    brand: { colors: ["#B5654A", "#F5F2EC", "#2E2A26"], fonts: ["Fraunces", "Inter Tight"], tone: "doux, artisanal, tutoiement" },
    title: "Voici mon travail",
    idea: "Moi dans mon atelier et mes pièces de la saison : ça doit donner envie de venir voir l'atelier.",
    own: [
      "her.jpg",
      "w01-etagere-haut.jpg",
      "w02-tasses-grises.jpg",
      "w03-assiettes-roses.jpg",
      "w04-mugs-blancs.jpg",
      "w05-etagere-milieu.jpg",
      "w06-tour-rose.jpg",
      "w07-tasses-blanches.jpg",
      "w08-assiette-peinte.jpg",
      "w09-bol-table.jpg",
      "w10-tasse-main.jpg",
      "w11-etagere-bas.jpg",
      "w12-assiette-peinte-2.jpg",
      "w13-petites-tasses.jpg",
      "w14-argile-rose.jpg",
      "w15-mugs-main.jpg",
      "w16-rangee-grise.jpg",
      "w17-plateau-bols.jpg",
      "w18-pots-blancs.jpg",
      "w19-etagere-noire.jpg",
      "w20-tour-mains.jpg",
      "w21-bassine.jpg",
      "w22-piles-assiettes.jpg",
      "w23-tasse-levee.jpg",
      "w24-coupelles.jpg",
      "w25-argile-plaques.jpg",
      "w26-mug-motif.jpg",
      "w27-bols-table.jpg",
      "w28-tasses-empilees.jpg",
    ],
  },
  // A hotel bar at night, its pendant lamps and its life (one shoot on Pexels): for « La pièce qui se rallume ».
  salon: {
    name: "Le Salon",
    business: "bar à cocktails",
    facts: ["Bar à cocktails sous des suspensions dorées", "Ouvert le soir, whiskies et vins au verre"],
    brand: { colors: ["#C8963E", "#F5F2EC", "#14110F"], fonts: ["Bodoni Moda", "Inter Tight"], tone: "chaleureux, élégant, tutoiement" },
    title: "Le Salon",
    idea: "Notre bar le soir, quand les lumières s'allument : ça doit donner envie de venir boire un verre.",
    own: [
      "01-salle-suspensions.mp4",
      "02-comptoir-lampes.mp4",
      "03-comptoir-client.mp4",
      "04-whisky.mp4",
      "05-conversation.mp4",
      "06-documents.mp4",
      "07-discussion-comptoir.mp4",
      "08-etageres-vins.mp4",
      "09-discussion.mp4",
      "10-fauteuil.mp4",
      "11-conversation-2.mp4",
      "12-verres.mp4",
      "13-costume.mp4",
      "14-rendez-vous.mp4",
      "15-dossiers.mp4",
    ],
  },
  // The other Reels of the landing's wall, on their very clips (Tristan: « renvoie les mêmes photos et reproduis les
  // reels »): steal=https://edith-ai.app/landing/reels/<id>.mp4 copies the one made by hand, none lets Edith choose.
  meche: {
    name: "Atelier Mèche",
    business: "salon de coiffure",
    facts: ["Salon de coiffure, Paris 10e", "Coupe, couleur et brushing, sur rendez-vous"],
    brand: { colors: ["#B9856A", "#F4EFEA", "#1C1A19"], fonts: ["Instrument Serif", "Space Mono"], tone: "chaleureux, précis, tutoiement" },
    title: "Tout pour une coupe",
    idea: "Montre tout ce qu’on fait pour une coupe, en vite.",
    clips: [14336, 33481, 16031, 49556, 40126],
  },
  pivoine: {
    name: "Pivoine",
    business: "fleuriste",
    facts: ["Fleuriste, Paris 11e", "Arrivage de fleurs fraîches chaque lundi"],
    brand: { colors: ["#B8873A", "#F6F1E7", "#2B2620"], fonts: ["Instrument Serif", "Space Mono"], tone: "doux, poétique, tutoiement" },
    title: "L’arrivage du lundi",
    idea: "L’arrivage du lundi, un peu comme un carnet.",
    clips: [15122, 28938, 4742, 6424, 1168, 15115],
  },
  terre: {
    name: "Terre Lente",
    business: "atelier de céramique",
    facts: ["Atelier de céramique, Montreuil", "Pièces tournées à la main, cours le week-end"],
    brand: { colors: ["#A0522D", "#EFE7DC", "#2A2420"], fonts: ["Big Shoulders Display", "IBM Plex Mono"], tone: "calme, artisanal, tutoiement" },
    title: "La lenteur",
    idea: "Ça doit respirer la lenteur.",
    clips: [32085, 1973, 32170, 9765, 1974, 40013],
  },
  farine: {
    name: "Maison Farine",
    business: "boulangerie",
    facts: ["Boulangerie, Paris 18e", "Pain au levain cuit chaque matin dès 6 h"],
    brand: { colors: ["#C8A165", "#FBF6EE", "#1A1A1A"], fonts: ["Dela Gothic One", "Space Mono"], tone: "gourmand, vif, tutoiement" },
    title: "Six heures du matin",
    idea: "Six heures du matin, ça grouille.",
    clips: [50053, 50015, 50032, 50022, 21927, 50041, 29330],
  },
  encre: {
    name: "Encre Noire",
    business: "salon de tatouage",
    facts: ["Salon de tatouage, Paris 3e", "Tatouage fin et noir, sur rendez-vous"],
    brand: { colors: ["#0B0B0B", "#F2F2F2", "#8A8A8A"], fonts: ["Unbounded", "Space Mono"], tone: "sobre, technique, tutoiement" },
    title: "Sobre et noir",
    idea: "Sobre, noir, technique. Pas de flammes.",
    clips: [397, 393, 389, 46644, 392],
  },
  barbe: {
    name: "Barbe & Fils",
    business: "barbier",
    facts: ["Barbier, Paris 9e", "Coupe sans rendez-vous le jeudi"],
    brand: { colors: ["#B08D57", "#F3EEE6", "#0B0B0B"], fonts: ["Archivo Black", "Space Mono"], tone: "franc, complice, tutoiement" },
    title: "La coupe du jeudi",
    idea: "La coupe du jeudi, sans rendez-vous.",
    clips: [43242, 43232, 43241, 40130, 43233],
  },
  souffle: {
    name: "Studio Souffle",
    business: "studio de yoga",
    facts: ["Studio de yoga, Paris 14e", "Cours au lever du soleil, petits groupes"],
    brand: { colors: ["#E8B07A", "#F7F1EA", "#2B2A28"], fonts: ["Instrument Serif", "Space Mono"], tone: "doux, posé, tutoiement" },
    title: "Une respiration",
    idea: "Une respiration, rien d’autre.",
    clips: [4420, 33066, 32756, 32761, 1053],
  },
  pizzeria: {
    name: "Pizzeria Nonna",
    business: "pizzeria",
    facts: ["Pizzeria napolitaine au feu de bois, Paris 11e", "Pâte maturée 48 h, pétrie chaque matin", "Ouvert tous les soirs, terrasse aux beaux jours"],
    brand: { colors: ["#C8102E", "#F4EDE1", "#1E5631"], fonts: ["Anton", "Space Mono"], tone: "chaleureux, tutoiement, une pointe d'humour" },
    title: "Dîner ce soir",
    idea: "Un Reel qui donne envie de venir dîner ce soir.",
    clips: [42484, 42465, 42469, 42481, 42480, 44007, 2597],
  },
  pilates: {
    name: "Studio Ciel",
    business: "studio de Pilates Reformer",
    facts: ["Studio de Pilates Reformer à Lyon", "6 reformers, cours de 50 minutes, 8 personnes au plus", "Premier cours d'essai offert"],
    brand: { colors: ["#B4532A", "#EFE6DA", "#2F3B2F"], fonts: ["Instrument Serif", "Inter Tight"], tone: "doux, motivant, tutoiement" },
    title: "Cours d'essai",
    idea: "Un Reel qui donne envie de réserver un cours d'essai.",
    clips: [48562, 48547, 48553, 48558, 48548, 48560, 48552],
  },
  barbier: {
    name: "Le Comptoir",
    business: "barbier",
    facts: ["Barbier à Bordeaux, coupe et barbe à l'ancienne", "Serviette chaude à chaque rasage", "Barbe et coupe en 45 minutes"],
    brand: { colors: ["#B08D57", "#F3EEE6", "#1B1B1B"], fonts: ["Playfair Display", "Inter Tight"], tone: "posé, précis, tutoiement" },
    title: "Coupe et barbe",
    idea: "Un Reel qui montre le soin d'une coupe et barbe.",
    clips: [43233, 43240, 43232, 43241, 43279, 43226],
  },
  coiffure: {
    name: "Atelier Mila",
    business: "salon de coiffure",
    facts: ["Salon de coiffure à Nantes, coupes et couleurs naturelles", "Balayage sur mesure, diagnostic offert"],
    brand: { colors: ["#C9898F", "#F7EFEA", "#3A2E2C"], fonts: ["Fraunces", "Inter Tight"], tone: "doux, chaleureux, tutoiement" },
    title: "L'ambiance du salon",
    idea: "Un Reel avec mes photos du salon, pour faire découvrir l'ambiance.",
    carousel: "Un carrousel avec 3 conseils pour garder une couleur qui brille cet hiver, et qui donne envie de prendre rendez-vous pour un diagnostic.",
    photosOf: { studio: "Maison Maya", max: 8 },
  },
  boutique: {
    name: "Maison Lou",
    business: "boutique de mode femme",
    facts: ["Concept store de mode femme à Lille, pièces choisies une à une", "Nouvelle sélection chaque mois", "-20 % sur toute la boutique ce week-end"],
    brand: { colors: ["#E4572E", "#FFF4EC", "#1F1A3A"], fonts: ["Syne", "Inter Tight"], tone: "pétillant, complice, tutoiement" },
    title: "Ce week-end",
    idea: "Un Reel où je parle à la caméra, pour faire venir à la boutique ce week-end.",
    // She films herself, talking and moving her hands (vertical clips).
    clips: [42323, 42283, 42308],
  },
  trattoria: {
    name: "Trattoria Sole",
    business: "restaurant italien",
    facts: ["Restaurant italien à Marseille, pâtes fraîches et pizzas au feu de bois", "Grande terrasse face au port"],
    brand: { colors: ["#E07A1F", "#FBF3E4", "#23402E"], fonts: ["Bricolage Grotesque", "Inter Tight"], tone: "gourmand, joyeux, tutoiement" },
    title: "La terrasse ce week-end",
    idea: "Un Reel avec mes photos et mes vidéos pour remplir la terrasse ce week-end.",
    carousel: "Un carrousel qui donne envie de venir manger en terrasse ce week-end : les pâtes fraîches, les pizzas, la vue sur le port.",
    clips: [42469, 42481, 42480, 42484],
    photosOf: { studio: "Chez Lino", max: 5 },
  },
};

const labUrl = (name: string) => `lab://${name}`;

/** A real business tested from its site: what it is, what it asks for, and stock clips of the same trade. */
const KINDS: Record<string, { business: string; title: string; idea: string; carousel: string; clipsOf?: string }> = {
  coiffeur: {
    business: "salon de coiffure",
    title: "Le salon",
    idea: "Un Reel avec les photos de mon site, qui fait découvrir le salon et donne envie de prendre rendez-vous.",
    carousel: "Un carrousel avec les photos de mon site, qui fait découvrir le salon et donne envie de prendre rendez-vous.",
  },
  restaurant: {
    business: "restaurant",
    title: "Ce soir",
    idea: "Un Reel avec les photos de mon site, qui donne envie de venir manger ce soir.",
    carousel: "Un carrousel avec les photos de mon site, qui donne envie de venir manger ce soir.",
    clipsOf: "pizzeria",
  },
  pilates: {
    business: "studio de Pilates",
    title: "Cours d'essai",
    idea: "Un Reel avec les photos de mon site, qui donne envie de réserver un cours d'essai.",
    carousel: "Un carrousel avec les photos de mon site, qui donne envie de réserver un cours d'essai.",
    clipsOf: "pilates",
  },
};

const siteKey = (url: string) => `lab://site/${new URL(url).hostname.replace(/^www\./, "")}`;

const factsSchema = z.object({
  name: z.string().describe("Le nom du commerce, tel qu'il l'écrit"),
  business: z.string().describe("Son activité en quelques mots, comme il la décrit (« coffee shop et salon de coiffure », « sandwicherie », « studio de Pilates Reformer »)"),
  facts: z.array(z.string()).describe("3 à 5 faits courts et vrais, tirés du site : ville ou quartier, spécialités, ce qui le rend unique, offre ou façon de réserver"),
});

/** What its site says, in a few true facts (what the editor writes its texts from). */
async function siteFacts(studioId: string, site: Awaited<ReturnType<typeof readWebsite>>) {
  const response = await anthropic().beta.messages.parse({
    model: CHAT_MODEL,
    max_tokens: 1000,
    output_config: { effort: "low", format: outputFormat(factsSchema) },
    system: "You read a neighbourhood business's website. Answer in French. Only what the site says, nothing invented.",
    messages: [{ role: "user", content: JSON.stringify({ titre: site.title, nom: site.siteName, description: site.description, texte: site.text.slice(0, 5000) }) }],
  });
  await logClaudeCost(studioId, response.usage, "lab_site", CHAT_MODEL);
  return response.parsed_output;
}

/** The lab studio of a real business: created from its site once, then its look read (photos, capture). */
async function siteStudio(url: string, kind: { business: string }): Promise<string> {
  const db = supabaseAdmin();
  const key = siteKey(url);
  const found = await db.from("studios").select("id").eq("website_url", key).order("created_at").limit(1).maybeSingle();
  if (found.data) return found.data.id as string;
  const site = await readWebsite(url);
  const host = new URL(site.url).hostname.replace(/^www\./, "");
  const at = new Date().toISOString();
  const studio = await db
    .from("studios")
    .insert({ name: site.siteName ?? site.title?.split(/[|–—-]/)[0]?.trim() ?? host, business_type: kind.business, website_url: key, onboarding_step: "style", booking_url: site.bookingLinks[0] ?? null })
    .select("id")
    .single();
  if (studio.error) throw new Error(studio.error.message);
  const studioId = studio.data.id as string;
  const read = await siteFacts(studioId, site).catch((error: unknown) => {
    console.warn("lab: site facts failed", error);
    return null;
  });
  await db
    .from("studios")
    .update({
      ...(read?.name ? { name: read.name.slice(0, 80) } : {}),
      // Its activity as its site says it (« coffee shop et salon de coiffure »), like Edith saves it at onboarding.
      ...(read?.business ? { business_type: read.business.slice(0, 80) } : {}),
      memory: [...(read?.facts ?? []).slice(0, 5), `Site : ${site.url}`].map((fact) => ({ fact, at })),
    })
    .eq("id", studioId);
  // As Edith saves it after reading the site: the colours and fonts of its code, its logo (its tone comes from the reading of its look).
  const profile = {
    colors: site.style.colors.slice(0, 6),
    fonts: site.style.fonts.slice(0, 2),
    ...(site.logo ? { logo_url: site.logo } : {}),
    dos: [],
    donts: [],
  };
  const brand = await db.from("brand_profiles").insert({ studio_id: studioId, version: 1, profile });
  if (brand.error) throw new Error(brand.error.message);
  // Its look: the photos into its moodboard and library, then the reading of a capture.
  const look = await readSiteLook(studioId, site.url, site.logo ? site.images.filter((i) => i.split("?")[0] !== site.logo!.split("?")[0]) : site.images);
  console.log("lab: site look", host, look);
  return studioId;
}

async function labStudio(name: string, c: LabCase): Promise<string> {
  const db = supabaseAdmin();
  // The oldest one: uploads sent together for a new case each created its studio (28 for one case, 5 November);
  // with maybeSingle() a second row made every later call create one more.
  const found = await db.from("studios").select("id").eq("website_url", labUrl(name)).order("created_at").limit(1).maybeSingle();
  if (found.data) return found.data.id as string;
  const at = new Date().toISOString();
  const studio = await db
    .from("studios")
    .insert({ name: c.name, business_type: c.business, website_url: labUrl(name), onboarding_step: "first_post", memory: c.facts.map((fact) => ({ fact, at })) })
    .select("id")
    .single();
  if (studio.error) throw new Error(studio.error.message);
  const profile = { tone: c.brand.tone, colors: c.brand.colors, fonts: c.brand.fonts, dos: [], donts: [] };
  const brand = await db.from("brand_profiles").insert({ studio_id: studio.data.id, version: 1, profile });
  if (brand.error) throw new Error(brand.error.message);
  return studio.data.id as string;
}

/** The case's media in the lab studio (copied once), videos then photos. */
async function labMedia(studioId: string, c: LabCase): Promise<{ videos: string[]; photos: string[] }> {
  const db = supabaseAdmin();
  const have = new Map(((await db.from("media_assets").select("id, storage_path").eq("studio_id", studioId)).data ?? []).map((m) => [m.storage_path as string, m.id as string]));
  const add = async (path: string, row: Record<string, unknown>, bytes: () => Promise<{ error: { message: string } | null }>) => {
    const known = have.get(path);
    if (known) return known;
    const { error } = await bytes();
    if (error) throw new Error(`${path}: ${error.message}`);
    const inserted = await db.from("media_assets").insert({ studio_id: studioId, storage_path: path, source: "library", consent_ok: true, ...row }).select("id").single();
    if (inserted.error) throw new Error(inserted.error.message);
    return inserted.data.id as string;
  };

  // Her own videos and photos, uploaded with step=upload.
  const uploaded = (file: string) => async () => {
    const found = await db.storage.from("media").createSignedUrl(`${studioId}/lab/${file}`, 60);
    return { error: found.error ? { message: `not uploaded (step=upload&file=${file})` } : null };
  };
  const own = await Promise.all((c.own ?? []).filter((f) => !LAB_PHOTO.test(f)).map((file) => add(`${studioId}/lab/${file}`, { kind: "video", mime_type: videoMime(file) }, uploaded(file))));
  const ownPhotos = await Promise.all((c.own ?? []).filter((f) => LAB_PHOTO.test(f)).map((file) => add(`${studioId}/lab/${file}`, { kind: "image", mime_type: photoMime(file) }, uploaded(file))));
  const stock = await Promise.all(
    (c.clips ?? []).map((clip) =>
      add(`${studioId}/lab/${clip}.mp4`, { kind: "video", mime_type: "video/mp4" }, async () => {
        const res = await fetch(`https://assets.mixkit.co/videos/${clip}/${clip}-720.mp4`, { headers: { "user-agent": "Mozilla/5.0 (compatible; SimoneLab/1.0)" } });
        if (!res.ok) return { error: { message: `stock clip ${clip}: ${res.status}` } };
        const body = Buffer.from(await res.arrayBuffer());
        return db.storage.from("media").upload(`${studioId}/lab/${clip}.mp4`, body, { contentType: "video/mp4", upsert: true });
      }),
    ),
  );
  const videos = [...own, ...stock];

  let photos: string[] = [...ownPhotos];
  if (c.photosOf) {
    const demo = await db.from("studios").select("id").eq("name", c.photosOf.studio).is("website_url", null).limit(1).single();
    if (demo.error) throw new Error(`demo studio ${c.photosOf.studio}: ${demo.error.message}`);
    const source = await db
      .from("media_assets")
      .select("storage_path, width, height, mime_type")
      .eq("studio_id", demo.data.id)
      .eq("kind", "image")
      .gt("height", 1600)
      .order("created_at")
      .limit(c.photosOf.max);
    photos = [
      ...ownPhotos,
      ...(await Promise.all(
        (source.data ?? []).map((p) => {
          const file = (p.storage_path as string).split("/").pop()!;
          return add(`${studioId}/lab/${file}`, { kind: "image", mime_type: p.mime_type ?? "image/jpeg", width: p.width, height: p.height }, () =>
            db.storage.from("media").copy(p.storage_path as string, `${studioId}/lab/${file}`),
          );
        }),
      )),
    ];
  }
  return { videos, photos };
}

/** The voice over a lab Reel: Edith's (voice=), a voice note of hers (own_voice=), or her voice taken from one of her videos (voice_video=). */
type LabVoice = { simone: string | null; hers: string | null; video: string | null };

async function start(name: string, c: LabCase, reset: boolean, voice: LabVoice, idea: string | null, steal: { url: string | null; only: boolean }, asCarousel = false, motion?: Motion) {
  const studioId = await labStudio(name, c);
  if (reset) await clearPosts(studioId);
  await setMotion(studioId, motion);
  const copy = steal.url ? await labSteal(studioId, steal.url) : null;
  if (steal.only) return;
  const { videos, photos } = await labMedia(studioId, c);
  if (asCarousel) return carousel(name, studioId, idea ?? c.carousel ?? c.idea, photos);
  await montage(name, studioId, { ...c, idea: idea ?? c.idea }, videos, photos, voice, copy);
}

/** A carousel of the case's photos, as the chat starts one for her: her photos read, then the carousel designer (never charged). */
async function carousel(name: string, studioId: string, idea: string, photos: string[]) {
  if (!photos.length) throw new Error("lab: no photo for a carousel");
  const db = supabaseAdmin();
  await Promise.all(photos.map((id) => photoRegions(studioId, id).catch((error: unknown) => console.warn("lab: photo not read", id, error))));
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setUTCHours(17, 0, 0, 0);
  const media = photos.slice(0, 10);
  const post = await db
    .from("posts")
    .insert({ studio_id: studioId, kind: "carousel", title: intentionTitle(idea) || "Carrousel", status: "media_received", platforms: ["instagram"], scheduled_at: tomorrow.toISOString(), media_ids: media })
    .select("id")
    .single();
  if (post.error) throw new Error(post.error.message);
  const started = await startCarousel({ studioId, postId: post.data.id as string, request: idea, mediaIds: media, charge: false });
  console.log("lab: carousel started", name, post.data.id, JSON.stringify(started));
}

/** Who writes the animations: a Gemini model, or null for Opus; undefined leaves the studio as it is. */
type Motion = string | null | undefined;

/** motion=claude|<gemini model>|<kimi model>, or "bad" for anything else. */
function motionOf(params: URLSearchParams): Motion | "bad" {
  const motion = params.get("motion");
  if (motion === null) return undefined;
  if (motion === "claude") return null;
  return GEMINI_MODEL_ID.test(motion) || isKimiModel(motion) ? motion : "bad";
}

async function setMotion(studioId: string, motion: Motion) {
  if (motion === undefined) return;
  const { error } = await supabaseAdmin().from("studios").update({ motion_model: motion }).eq("id", studioId);
  if (error) throw new Error(`lab: motion model not set: ${error.message}`);
}

/** A new first Reel: the studio's posts and scenes go (its media and brand stay). */
async function clearPosts(studioId: string) {
  const db = supabaseAdmin();
  await db.from("posts").delete().eq("studio_id", studioId);
  await db.from("motion_templates").delete().eq("studio_id", studioId);
}

/** « Steal » in the lab: a Reel's style read (from its link, a video file's URL, or a video uploaded to the lab studio), for the lab Reel to copy. */
async function labSteal(studioId: string, url: string): Promise<string> {
  // One of Edith's own models (model=<key>): the studio's row for it, already read (the catalogue is its reading).
  if (url.startsWith("house:")) {
    const house = await houseInspiration(studioId, url.slice(6));
    if (!house) throw new Error(`lab: no house model ${url.slice(6)}`);
    console.log("lab: house model", house.name);
    return house.id;
  }
  let outcome: Awaited<ReturnType<typeof stealStyle>>;
  if (url.startsWith("lab:")) {
    // As a video she sends Edith in the chat: in her library first, then read (and out of it once read).
    const file = url.slice(4);
    const path = `${studioId}/lab/${file}`;
    const db = supabaseAdmin();
    const { data: known } = await db.from("media_assets").select("id").eq("studio_id", studioId).eq("storage_path", path).maybeSingle();
    const media =
      known ??
      (await db.from("media_assets").insert({ studio_id: studioId, storage_path: path, kind: "video", source: "web_upload", mime_type: videoMime(file) }).select("id").single()).data;
    if (!media) throw new Error(`lab: ${file} not kept`);
    outcome = await stealNow(studioId, { mediaId: media.id as string });
  } else if (reelLink(url)) outcome = await stealNow(studioId, { link: url });
  else {
    const { data: row, error } = await supabaseAdmin().from("inspirations").insert({ studio_id: studioId, source: "link", kind: "reel", url }).select("id").single();
    if (error || !row) throw new Error(`lab: inspiration not kept: ${error?.message ?? "no row"}`);
    outcome = await stealStyle(studioId, row.id as string);
  }
  if (!outcome.ok) throw new Error(`lab: style not read (${outcome.miss}): ${await missMessage(outcome.miss)}`);
  console.log("lab: style read", outcome.style.look.name, JSON.stringify({ lines: outcome.lines, measures: { ...outcome.style.measures, cuts: outcome.style.measures.cuts.length } }));
  return outcome.inspirationId;
}

/** The styles read for the lab studio (« Steal »), the latest first. */
async function stolenStyles(studioId: string) {
  const { data } = await supabaseAdmin()
    .from("inspirations")
    .select("id, url, title, style, created_at")
    .eq("studio_id", studioId)
    .not("style", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);
  return { read: (data ?? []).map((i) => ({ id: i.id, url: i.url, title: i.title, at: i.created_at, style: i.style })) };
}

/** A real business from its site: its site's photos (and the stock clips of its trade, if asked), then its first Reel. */
/** Without a kind: what any business would ask for its first Reel from its site. */
const ANY_KIND: (typeof KINDS)[string] = {
  business: "commerce",
  title: "Premier Reel",
  idea: "Un Reel avec les photos de mon site, qui donne envie de venir.",
  carousel: "Un carrousel avec les photos de mon site, qui présente le commerce et donne envie de venir.",
};

async function startSite(url: string, kindName: string, withClips: boolean, reset: boolean, voice: LabVoice, idea: string | null, template?: MotionTemplate, asCarousel = false, motion?: Motion, steal: { url: string | null; only: boolean } = { url: null, only: false }, own: string[] = []) {
  const kind = KINDS[kindName] ?? ANY_KIND;
  const studioId = await siteStudio(url, kind);
  if (reset) await clearPosts(studioId);
  await setMotion(studioId, motion);
  // A Reel to copy (« Steal »), read first, as for a case.
  const copy = steal.url ? await labSteal(studioId, steal.url) : null;
  if (steal.only) return;
  const db = supabaseAdmin();
  const { data: site } = await db.from("media_assets").select("id").eq("studio_id", studioId).eq("source", "website").eq("kind", "image").order("created_at").limit(asCarousel ? 10 : 8);
  if (asCarousel) return carousel(siteKey(url), studioId, idea ?? kind.carousel, (site ?? []).map((m) => m.id as string));
  const stock = withClips && kind.clipsOf ? CASES[kind.clipsOf] : undefined;
  // Her own videos (step=upload) first, then the stock clips of her trade.
  const { videos } = stock || own.length ? await labMedia(studioId, { ...(stock ?? { clips: [] }), photosOf: undefined, own } as LabCase) : { videos: [] as string[] };
  const photos = (site ?? []).map((m) => m.id as string);
  if (!photos.length && !videos.length) throw new Error("lab: no photo on the site, try clips=1");
  await montage(siteKey(url), studioId, { title: kind.title, idea: idea ?? kind.idea, template }, videos, photos, voice, copy);
}

async function montage(name: string, studioId: string, c: Pick<LabCase, "title" | "idea" | "template" | "route" | "free" | "effort" | "effects">, videos: string[], photos: string[], voice: LabVoice, copy: string | null = null) {
  const db = supabaseAdmin();
  // Everything read first, as when she sends them: Gemini watches each video, each photo is framed.
  const [analyses] = await Promise.all([
    Promise.all(videos.map((id) => ensureClipAnalysis(studioId, id, { waitMs: 240_000 }))),
    Promise.all(photos.map((id) => photoRegions(studioId, id).catch((error: unknown) => console.warn("lab: photo not read", id, error)))),
  ]);
  const unread = analyses.filter((a) => !("analysis" in a));
  if (unread.length) console.warn("lab: videos not read", JSON.stringify(unread));
  // A montage takes 20 files at most, as in the app: the videos first, then the photos.
  const mediaIds = [...videos, ...photos].slice(0, MAX_MEDIA);
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setUTCHours(17, 0, 0, 0);
  // As the Créer screen makes it: titled from what she imagines, with her « Voix off » choice.
  const brief = imaginedBrief(c.idea);
  const spoken = voice.simone && !voice.hers ? { mode: "on" as const, ...(voice.simone === "1" ? {} : { voice_id: voice.simone }) } : null;
  const post = await db
    .from("posts")
    .insert({
      studio_id: studioId,
      kind: "reel",
      title: intentionTitle(c.idea) || c.title,
      status: "media_received",
      platforms: ["instagram"],
      scheduled_at: tomorrow.toISOString(),
      template: c.template ?? null,
      media_ids: mediaIds,
      // The Reel it copies (« Steal »), as when she sends Edith a Reel to copy.
      inspiration_id: copy,
      ...(spoken ? { voice_over: spoken } : {}),
    })
    .select("id")
    .single();
  if (post.error) throw new Error(post.error.message);
  if (voice.hers) {
    const note = await labVoiceNote(studioId, post.data.id, voice.hers === "1" ? undefined : voice.hers, brief);
    console.log("lab: her voice note", name, note.seconds, note.text);
  } else if (voice.video) {
    // As Edith does when she asks « prends ma voix de la vidéo où je parle » (update_post with that video): its voice taken once.
    const { data: video } = await db.from("media_assets").select("id").eq("studio_id", studioId).eq("storage_path", `${studioId}/lab/${voice.video}`).maybeSingle();
    if (!video) throw new Error(`lab: voice_video=${voice.video} is none of her videos (upload it, then own=${voice.video})`);
    const taken = await voiceFromVideo(studioId, video.id as string);
    await db.from("posts").update({ voice_media_id: taken.mediaId }).eq("id", post.data.id);
    console.log("lab: her voice from her video", name, voice.video, taken.transcript.duration, taken.transcript.text);
  }
  // The same chain as her first Reel at the default care, without a quote: two scenes of her own.
  await queueJob("montage", {
    step: "design",
    studioId,
    postId: post.data.id,
    mediaIds,
    brief,
    maxNewScenes: 2,
    effort: c.effort ?? DEFAULT_EFFORT,
    ...(c.route ? { route: c.route } : {}),
    ...(c.free ? { free: true } : {}),
    ...(c.effects === false ? { effects: false } : {}),
  });
  console.log("lab: montage started", name, post.data.id);
}

/**
 * A voice note of hers as WhatsApp brings one: her words (or words written for the images)
 * read by a voice of the gallery, then made what a phone records (OGG Opus, 16 kHz mono,
 * quieter than a voice in a Reel, band-limited), kept as a WhatsApp audio, read by Scribe
 * as hers would be, and put on the Reel. The montage then cuts on it as on hers.
 */
async function labVoiceNote(studioId: string, postId: string, words?: string, brief?: string): Promise<{ mediaId: string; text: string; seconds: number }> {
  const db = supabaseAdmin();
  const text = words?.trim() || (await writeVoiceScript(studioId, postId, { brief })).script;
  const spoken = await speak(text);
  const ogg = await voiceNoteInSandbox(`lab-note-${postId}`, spoken.mp3);
  const path = `${studioId}/whatsapp/lab-${postId}-${Date.now()}.ogg`;
  const upload = await db.storage.from("media").upload(path, ogg, { contentType: "audio/ogg; codecs=opus", upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const asset = await db
    .from("media_assets")
    .insert({ studio_id: studioId, storage_path: path, kind: "audio", source: "whatsapp", mime_type: "audio/ogg; codecs=opus", size_bytes: ogg.length, consent_ok: true })
    .select("id")
    .single();
  if (asset.error) throw new Error(asset.error.message);
  const transcript = await ensureTranscript(studioId, asset.data.id as string);
  if (!transcript) throw new Error("lab: her voice note was not read");
  await db.from("posts").update({ voice_media_id: asset.data.id }).eq("id", postId);
  return { mediaId: asset.data.id as string, text: transcript.text, seconds: transcript.duration };
}

const voiceOf = (params: URLSearchParams): LabVoice => {
  const video = params.get("voice_video");
  return { simone: params.get("voice"), hers: params.get("own_voice"), video: video && LAB_FILE.test(video) && !LAB_PHOTO.test(video) ? video : null };
};

/** A file of hers uploaded to the lab studio: a plain name, a video. */
const LAB_FILE = /^[\w-][\w.-]{0,79}\.(mp4|mov|m4v|webm|jpe?g|png|webp)$/i;
const videoMime = (file: string) => (/\.mov$/i.test(file) ? "video/quicktime" : /\.webm$/i.test(file) ? "video/webm" : "video/mp4");
/** A photo of hers uploaded to the lab studio (own=<name>.jpg): a photo of the Reel, not a video. */
const LAB_PHOTO = /\.(jpe?g|png|webp)$/i;
const photoMime = (file: string) => (/\.png$/i.test(file) ? "image/png" : /\.webp$/i.test(file) ? "image/webp" : "image/jpeg");

/** What she writes in « Ce que tu imagines » (500 characters at most, as on the screen). */
const ideaOf = (params: URLSearchParams) => params.get("idea")?.trim().slice(0, 500) || null;

/** A skill version's bench Reel, copied out of the lab case's renders (they go when the case is reset), once per render. */
async function keepBench(skill: { key: string; version: number }, from: string, facts: { seconds: number | null; costEur: number; labCase: string }) {
  const db = supabaseAdmin();
  const path = `house/skill-benches/${skill.key}-v${skill.version}.mp4`;
  const { data: known } = await db.from("skill_benches").select("created_at").eq("key", skill.key).eq("version", skill.version).maybeSingle();
  const { data: render } = await db.from("renders").select("created_at").eq("storage_path", from).maybeSingle();
  // The same render already kept: nothing to copy again.
  if (known && render && new Date(known.created_at as string) >= new Date(render.created_at as string)) return;
  await db.storage.from("media").remove([path]);
  const copied = await db.storage.from("media").copy(from, path);
  if (copied.error) throw new Error(copied.error.message);
  const { error } = await db
    .from("skill_benches")
    .upsert({ key: skill.key, version: skill.version, path, seconds: facts.seconds, cost_eur: Math.round(facts.costEur * 1000) / 1000, lab_case: facts.labCase, created_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

async function result(key: string) {
  const db = supabaseAdmin();
  const studio = await db.from("studios").select("id, name, business_type, memory, motion_model").eq("website_url", key).order("created_at").limit(1).maybeSingle();
  if (!studio.data) return { error: "case not set up" };
  const studioId = studio.data.id as string;
  const post = await db
    .from("posts")
    .select("id, title, kind, status, agent_note, edit_plan_id, render_id, voice_media_id, inspiration_id, created_at, slides, slides_render")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!post.data) {
    return { studioId, error: "no post", steal: await stolenStyles(studioId) };
  }
  const [plans, message, costs, voice, brand] = await Promise.all([
    db.from("edit_plans").select("id, version, plan, created_at").eq("post_id", post.data.id).order("version"),
    db.from("whatsapp_messages").select("body, created_at").eq("studio_id", studioId).eq("direction", "outbound").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("cost_events").select("kind, cost_eur, created_at, meta").eq("studio_id", studioId),
    post.data.voice_media_id ? db.from("media_assets").select("transcript").eq("id", post.data.voice_media_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("brand_profiles").select("version, profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Its charter as the Reel used it: colours, fonts (and the ones swapped for a free twin), art direction.
  const profile = (brand.data?.profile ?? {}) as {
    colors?: string[];
    fonts?: string[];
    font_twins?: Record<string, string>;
    art_direction?: string;
    logo_url?: string;
    tone?: string;
    signature?: unknown;
    moodboard?: { reading?: string };
  };
  const fonts = await usableFonts(profile.fonts, [], "doux", profile.font_twins).catch(() => ({ fonts: profile.fonts, swaps: [] }));
  const planIds = (plans.data ?? []).map((p) => p.id as string);
  const renders = planIds.length
    ? ((await db.from("renders").select("id, edit_plan_id, status, storage_path, duration_ms, error, created_at").in("edit_plan_id", planIds).order("created_at")).data ?? [])
    : [];
  const paths = renders.flatMap((r) => (r.storage_path ? [r.storage_path as string] : []));
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 86_400)).data ?? []) : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const kept = (plans.data ?? []).find((p) => p.id === post.data!.edit_plan_id);
  // A designed carousel: its slides as rendered (and published), its outline and its words.
  const design = slidesPlanSchema.safeParse(post.data.slides).data?.design;
  const slidePaths = ((post.data.slides_render as { paths?: (string | null)[] } | null)?.paths ?? []).filter((p): p is string => Boolean(p));
  const slideUrls = design && slidePaths.length ? ((await db.storage.from("media").createSignedUrls(slidePaths, 86_400)).data ?? []).map((s) => s.signedUrl) : [];
  const plan = editPlanSchema.safeParse(kept?.plan);
  // What this Reel cost (from its post's creation: montage, animations, review, renders, music), and what
  // the lab studio has spent over all its runs (with the one-time reading of its media).
  const byKind = (since?: string) => {
    const sums: Record<string, number> = {};
    for (const c of costs.data ?? []) {
      if (since && new Date(c.created_at as string) < new Date(since)) continue;
      sums[c.kind as string] = Math.round(((sums[c.kind as string] ?? 0) + Number(c.cost_eur)) * 1000) / 1000;
    }
    return sums;
  };
  // A Reel a montage skill played on its own model (model=, or the one Edith picked): its render kept as that skill
  // version's bench, for Tristan's review on /admin. Never a Reel sent to copy that a model played (steal=): it is
  // dressed like the copy, not like the model he validates.
  const played = plan.success ? plan.data.skill : undefined;
  const model = played && post.data.inspiration_id ? (await db.from("inspirations").select("source, external_id").eq("id", post.data.inspiration_id as string).maybeSingle()).data : null;
  const ownModel = Boolean(played && model?.source === HOUSE_SOURCE && model.external_id === played.key);
  const benched = played && ownModel ? renders.findLast((r) => r.edit_plan_id === kept?.id && r.status === "done" && r.storage_path) : undefined;
  if (played && benched) {
    await keepBench(played, benched.storage_path as string, {
      seconds: benched.duration_ms ? Math.round((benched.duration_ms as number) / 10) / 100 : null,
      costEur: Object.values(byKind(post.data.created_at as string)).reduce((a, b) => a + b, 0),
      labCase: key,
    }).catch((error: unknown) => console.warn("skill bench: not kept", error));
  }
  // Its animations: who wrote them, and what they cost for this Reel (with their fixes and the director's look).
  const motionCost = (costs.data ?? [])
    .filter(
      (c) =>
        new Date(c.created_at as string) >= new Date(post.data!.created_at as string) &&
        ["motion_designer", "motion_look"].includes((c.meta as { purpose?: string } | null)?.purpose ?? ""),
    )
    .reduce((sum, c) => sum + Number(c.cost_eur), 0);
  // A model whose voice says its words (« Celui-là, celui-là… »): the voice saying them and each word at its moment on its track.
  const saidTrack = plan.success && plan.data.says_words && plan.data.voice ? (await db.from("media_assets").select("transcript, ai").eq("id", plan.data.voice.media_id).maybeSingle()).data : null;
  return {
    studioId,
    studio: { name: studio.data.name, business: studio.data.business_type, facts: studio.data.memory },
    motion: { model: (studio.data.motion_model as string | null) ?? "claude", cost_eur: Math.round(motionCost * 1000) / 1000 },
    brand: {
      version: brand.data?.version ?? null,
      colors: profile.colors ?? [],
      fonts: profile.fonts ?? [],
      fonts_used: fonts.fonts ?? [],
      font_swaps: fonts.swaps,
      logo: profile.logo_url ?? null,
      font_twins: profile.font_twins ?? {},
      art_direction: profile.art_direction ?? null,
      tone: profile.tone ?? null,
      signature: profile.signature ?? null,
      reading: profile.moodboard?.reading?.slice(0, 1200) ?? null,
    },
    post: { ...post.data, slides: undefined, slides_render: undefined },
    ...(design ? { carousel: { name: design.name, count: design.count, outline: design.outline, fonts: design.fonts, photos: design.photos, texts: design.texts, slides: slideUrls, code_chars: design.code?.length ?? design.js.length } } : {}),
    plans: (plans.data ?? []).map((p) => ({ id: p.id, version: p.version, at: p.created_at })),
    renders: renders.map((r) => ({ plan: r.edit_plan_id, status: r.status, seconds: r.duration_ms ? Math.round((r.duration_ms as number) / 100) / 10 : null, error: r.error, url: r.storage_path ? url.get(r.storage_path as string) : null })),
    message: message.data?.body ?? null,
    voice: (voice.data?.transcript as { text?: string; duration?: number } | null) ?? null,
    ...(plan.success && plan.data.says_words
      ? { said_words: { voice_id: plan.data.says_words.voice_id, track: plan.data.voice?.media_id ?? null, words: (saidTrack?.transcript as { words?: unknown } | null)?.words ?? null, ai: saidTrack?.ai ?? null } }
      : {}),
    // Her own voice leading its model (« Celui-là, celui-là… »): her recording, how it plays, each word of the model on
    // screen when she says it, and each cut (the shots' starts on the Reel's clock).
    ...(plan.success && plan.data.voice_leads
      ? {
          voice_leads: {
            from: plan.data.voice_leads.media_id,
            voice: plan.data.voice ?? null,
            cut: plan.data.voice?.media_id !== plan.data.voice_leads.media_id,
            words: plan.data.texts.map((t) => ({ text: t.text, from: t.from, to: t.to })),
            cuts: planTimeline(plan.data).segments.map((s) => Math.round(s.start * 100) / 100),
          },
        }
      : {}),
    costs: byKind(post.data.created_at as string),
    studio_costs: byKind(),
    steal: await stolenStyles(studioId),
    // The effects of Edith's models its animations borrowed (« [borrow: <key>] » in their briefs; lib/agent/borrowed-effects.ts).
    borrowed: plan.success
      ? [
          ...new Set(
            borrowedEffects(
              [...plan.data.segments.flatMap((s) => (isMotionSegment(s) ? [s.motion.brief] : [])), ...(plan.data.layers ?? []).map((l) => l.motion.brief)],
              HOUSE_MODELS.map((m) => m.key),
            ).flat(),
          ),
        ]
      : [],
    // The effects of the bank its layers played as they are (pieces.ts: no motion designer), with their words.
    pieces: plan.success
      ? (plan.data.layers ?? []).flatMap((l) =>
          l.motion.piece ? [{ key: l.motion.piece.key, version: l.motion.piece.version, from: l.from, to: l.to, coded: Boolean(l.motion.js), texts: l.motion.texts ?? {}, drawn: l.motion.drawn ?? null }] : [],
        )
      : [],
    // The plan kept, readable: the scenes' code left out.
    plan: plan.success
      ? {
          ...plan.data,
          segments: plan.data.segments.map((s) =>
            isMotionSegment(s)
              ? { motion: { brief: s.motion.brief, template_id: s.motion.template_id, coded: Boolean(s.motion.js), photos: s.motion.photos, fonts: s.motion.fonts }, duration: s.duration, over: s.over }
              : s,
          ),
          layers: plan.data.layers?.map((l) => ({ brief: l.motion.brief, from: l.from, to: l.to, coded: Boolean(l.motion.js), photos: l.motion.photos, fonts: l.motion.fonts, ...(l.motion.piece ? { piece: l.motion.piece.key } : {}) })),
        }
      : null,
  };
}

/** The lab studio of a case or a site, once set up. */
async function labStudioId(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("studios").select("id").eq("website_url", key).order("created_at").limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** No member: nothing of the lab studio's ever reaches a phone. */
const LAB_MEMBER = "00000000-0000-4000-8000-000000000000";

/** One message of hers to Edith in the app, in a web conversation of the lab studio, and her answer. */
async function labChat(key: string, params: URLSearchParams) {
  const text = params.get("text")?.trim().slice(0, 2000);
  if (!text) return { error: "text=…" };
  const studioId = await labStudioId(key);
  if (!studioId) return { error: "case not set up" };
  const db = supabaseAdmin();
  let conversationId = params.get("c");
  if (conversationId) {
    const own = await db.from("conversations").select("id").eq("id", conversationId).eq("studio_id", studioId).maybeSingle();
    if (!own.data) return { error: "conversation" };
  } else {
    const created = await db.from("conversations").insert({ studio_id: studioId, started_by: "web", title: "Banc d’essai" }).select("id").single();
    if (created.error) return { error: created.error.message };
    conversationId = created.data.id as string;
  }
  const inserted = await db.from("whatsapp_messages").insert({ studio_id: studioId, conversation_id: conversationId, channel: "web", direction: "inbound", type: "text", body: text }).select("id").single();
  if (inserted.error) return { error: inserted.error.message };
  const answer = await replyInConversation({ studioId, memberId: LAB_MEMBER, conversationId, reactToRowId: inserted.data.id as string, channel: "web" });
  if (answer.reply) {
    await db
      .from("whatsapp_messages")
      .insert({ studio_id: studioId, conversation_id: conversationId, channel: "web", direction: "outbound", type: "text", body: answer.reply, payload: { ...answer.extras, notes: answer.notes } });
  }
  // A montage she started runs after the answer, as in the app.
  after(async () => {
    for (const job of answer.afterReply) await job().catch((e: unknown) => console.error("lab: chat job failed", e));
  });
  return { conversation: conversationId, reply: answer.reply, extras: answer.extras, notes: answer.notes };
}

/** The version kept of the case's latest post, rendered again with a newly composed piece. */
/**
 * Her own words on the lab Reel's effect (words=[{"id":…,"text":…}], the ids step=result shows), as she
 * saves them on its page: its kit draws the effect again; step=result then shows the new version.
 */
async function labWords(key: string, params: URLSearchParams) {
  const studioId = await labStudioId(key);
  if (!studioId) return { error: "case not set up" };
  const { data: post } = await supabaseAdmin().from("posts").select("id").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!post) return { error: "no post" };
  let given: unknown;
  try {
    given = JSON.parse(params.get("words") ?? "");
  } catch {
    given = null;
  }
  const changes = z.array(z.object({ id: z.string().max(40), text: z.string().max(400) })).min(1).max(12).safeParse(given);
  if (!changes.success) return { error: 'words=[{"id":"…","text":"…"}]' };
  return startEffectWords(studioId, post.id as string, changes.data);
}

async function newMusic(key: string) {
  const db = supabaseAdmin();
  const studio = await db.from("studios").select("id").eq("website_url", key).order("created_at").limit(1).maybeSingle();
  if (!studio.data) throw new Error("case not set up");
  const post = await db.from("posts").select("id").eq("studio_id", studio.data.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!post.data) throw new Error("no post");
  const rendered = await renderPost(studio.data.id as string, post.data.id as string, { freshMusic: true });
  console.log("lab: new music", key, rendered.renderId);
}

/**
 * Whether the API compiles the director's answer into a grammar (a nested composition had been refused, 400 « compiled
 * grammar is too large »): a few tokens of a call, before a bench makes Reels with it.
 */
async function directorGrammar(): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await anthropic().beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16,
      output_config: { format: outputFormat(directorOutputSchema) },
      messages: [{ role: "user", content: "Réponds par un plan vide." }],
    });
    return { ok: true, detail: String(response.stop_reason) };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message.slice(0, 300) : String(error) };
  }
}

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  if (params.get("step") === "grammar") return Response.json(await directorGrammar());
  // A Reel to copy, as its reading gets it: its video for an hour, to look at it frame by frame (no studio needed).
  if (params.get("step") === "model") {
    const link = params.get("steal") ?? "";
    if (!/^https:\/\/\S{8,500}$/.test(link)) return Response.json({ error: "steal=<https url>" }, { status: 400 });
    return Response.json(await modelVideo(link));
  }
  // A real business, from its website.
  const site = params.get("site");
  if (site) {
    const kind = params.get("kind") ?? "";
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
    } catch {
      return Response.json({ error: "site" }, { status: 400 });
    }
    if (params.get("step") === "result") return Response.json(await result(siteKey(url.href)));
    if (params.get("step") === "chat") return Response.json(await labChat(siteKey(url.href), params));
    if (params.get("step") === "words") return Response.json(await labWords(siteKey(url.href), params));
    if (params.get("step") === "music") {
      after(() => newMusic(siteKey(url.href)).catch((error: unknown) => console.error("lab: new music failed", url.href, error)));
      return Response.json({ ok: true, site: url.href, music: true });
    }
    if (kind && !KINDS[kind]) return Response.json({ error: `kind=${Object.keys(KINDS).join("|")}` }, { status: 400 });
    // A video of hers, as for a case: uploaded to the lab studio (step=upload), then used with own=.
    if (params.get("step") === "upload") {
      const file = params.get("file") ?? "";
      if (!LAB_FILE.test(file)) return Response.json({ error: "file=<name>.mp4|mov|jpg|png" }, { status: 400 });
      const studioId = await siteStudio(url.href, KINDS[kind] ?? ANY_KIND);
      const signed = await supabaseAdmin().storage.from("media").createSignedUploadUrl(`${studioId}/lab/${file}`, { upsert: true });
      if (signed.error) return Response.json({ error: signed.error.message }, { status: 500 });
      return Response.json({ path: signed.data.path, url: signed.data.signedUrl });
    }
    const own = params.get("own")?.split(",") ?? [];
    if (own.length > MAX_MEDIA || !own.every((f) => LAB_FILE.test(f))) return Response.json({ error: "own=<file>,…" }, { status: 400 });
    // An ambiance chosen for the post (as she would pick « Façon collage »), else the editor's choice.
    const template = params.get("template") ? motionTemplateSchema.safeParse(params.get("template")) : null;
    if (template && !template.success) return Response.json({ error: "template" }, { status: 400 });
    const asCarousel = params.get("format") === "carrousel";
    const motion = motionOf(params);
    if (motion === "bad") return Response.json({ error: "motion=claude|<gemini model>|<kimi model>" }, { status: 400 });
    const steal = params.get("model") ? `house:${params.get("model")}` : params.get("steal");
    if (steal && !/^https:\/\/\S{8,500}$/.test(steal) && !/^house:[a-z-]{2,40}$/.test(steal)) return Response.json({ error: "steal=<https url>|model=<key>" }, { status: 400 });
    const stealing = { url: steal, only: params.get("steal_only") === "1" };
    after(() =>
      startSite(url.href, kind, params.get("clips") === "1", params.get("reset") === "1", voiceOf(params), ideaOf(params), template?.data, asCarousel, motion, stealing, own).catch((error: unknown) =>
        console.error("lab: site failed", url.href, error),
      ),
    );
    return Response.json({ ok: true, site: url.href, kind, started: true, ...(asCarousel ? { format: "carrousel" } : {}), ...(steal ? { steal } : {}) });
  }
  const name = params.get("case") ?? "";
  const c = CASES[name];
  if (!c) return Response.json({ error: `case=${Object.keys(CASES).join("|")}` }, { status: 400 });
  if (c.template && !motionTemplateSchema.safeParse(c.template).success) return Response.json({ error: "template" }, { status: 400 });
  if (params.get("step") === "result") return Response.json(await result(labUrl(name)));
  if (params.get("step") === "chat") return Response.json(await labChat(labUrl(name), params));
  if (params.get("step") === "words") return Response.json(await labWords(labUrl(name), params));
  if (params.get("step") === "music") {
    after(() => newMusic(labUrl(name)).catch((error: unknown) => console.error("lab: new music failed", name, error)));
    return Response.json({ ok: true, case: name, music: true });
  }
  // A file of hers (a video she filmed, a Reel to copy) uploaded straight to the lab studio's storage.
  if (params.get("step") === "upload") {
    const file = params.get("file") ?? "";
    if (!LAB_FILE.test(file)) return Response.json({ error: "file=<name>.mp4|mov|jpg|png" }, { status: 400 });
    const studioId = await labStudio(name, c);
    const signed = await supabaseAdmin().storage.from("media").createSignedUploadUrl(`${studioId}/lab/${file}`, { upsert: true });
    if (signed.error) return Response.json({ error: signed.error.message }, { status: 500 });
    return Response.json({ path: signed.data.path, url: signed.data.signedUrl });
  }
  // Other free stock clips for this run, as many as a montage takes; or her own uploaded videos instead.
  const stock = params.get("stock");
  if (stock && !new RegExp(`^\\d{1,7}(,\\d{1,7}){0,${MAX_MEDIA - 1}}$`).test(stock)) return Response.json({ error: "stock=<mixkit id>,…" }, { status: 400 });
  const own = params.get("own")?.split(",");
  if (own && (own.length > MAX_MEDIA || !own.every((f) => LAB_FILE.test(f)))) return Response.json({ error: "own=<file>,…" }, { status: 400 });
  const route = params.get("route");
  if (route && route !== "agent" && route !== "chain") return Response.json({ error: "route=agent|chain" }, { status: 400 });
  // The creative test (free=1): in none of Edith's models; its care (effort=rapide|soigne|max), else the default.
  const effort = params.get("effort");
  if (effort && !effortSchema.safeParse(effort).success) return Response.json({ error: "effort=rapide|soigne|max" }, { status: 400 });
  const media = own ? { ...c, clips: [], own } : stock ? { ...c, clips: stock.split(",").map(Number) } : c;
  const run = {
    ...media,
    ...(route ? { route: route as "agent" | "chain" } : {}),
    ...(params.get("free") === "1" ? { free: true } : {}),
    ...(effort ? { effort: effort as Effort } : {}),
    // effects=0: none of the models' effects lent, the chain as before (to compare with the test on the same videos).
    ...(params.get("effects") === "0" ? { effects: false } : {}),
  };
  // « Steal »: a Reel's link, a video file's URL (https), or a video uploaded to the lab studio (lab:<file>).
  const steal = params.get("model") ? `house:${params.get("model")}` : params.get("steal");
  if (steal && !/^https:\/\/\S{8,500}$/.test(steal) && !(steal.startsWith("lab:") && LAB_FILE.test(steal.slice(4))) && !/^house:[a-z-]{2,40}$/.test(steal)) {
    return Response.json({ error: "steal=<https url>|lab:<file>" }, { status: 400 });
  }
  const stealing = { url: steal, only: params.get("steal_only") === "1" };
  const asCarousel = params.get("format") === "carrousel";
  const motion = motionOf(params);
  if (motion === "bad") return Response.json({ error: "motion=claude|<gemini model>|<kimi model>" }, { status: 400 });
  // call_app gives up after a few seconds: the work goes on after the answer.
  after(() => start(name, run, params.get("reset") === "1", voiceOf(params), ideaOf(params), stealing, asCarousel, motion).catch((error: unknown) => console.error("lab: case failed", name, error)));
  return Response.json({ ok: true, case: name, started: true, ...(steal ? { steal } : {}), ...(asCarousel ? { format: "carrousel" } : {}), ...(motion !== undefined ? { motion: motion ?? "claude" } : {}) });
}
