import { PLAN_ORDER, PLANS, reelsPerMonth, weeklyPosts } from "@fauve/agent";
import { priceTax } from "@/lib/legal";
import type { Metadata } from "next";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { ChartIcon, CheckIcon, ClockIcon, EyeIcon, LayersIcon, MicIcon, MusicIcon, PenIcon, RepeatIcon, ZapIcon } from "@/components/icons";
import { CarouselDecks, type Deck } from "@/components/landing/carousel-decks";
import { HeroScene } from "@/components/landing/hero-scene";
import { MorphWord, type MorphItem } from "@/components/landing/morph-word";
import { ScrollWords, type Token } from "@/components/landing/scroll-words";
import { Techniques, type Technique } from "@/components/landing/techniques";
import { Play } from "@/components/landing/play";
import { ReelBelt, type StripReel } from "@/components/landing/reel-strip";
import { ReelWall } from "@/components/landing/reel-wall";
import { WORK, workById, workMedia, type WorkId } from "@/components/landing/work";
import { landingFonts } from "./landing-fonts";
import { fr, frNodes } from "@/components/landing/fr";
import { faqPage, JsonLd, LastCall, SectionTitle, SiteFooter, SiteHeader, Start } from "@/components/landing/site";
import { CaptionVisual, CopyReelVisual, GestureVisual, LayoutsVisual, MusicVisual, ReminderVisual, ReportVisual, RetouchVisual, VoiceVisual } from "@/components/landing/visuals";
import { whatsappLink } from "@/lib/public-env";
import { SITE_URL } from "@/lib/site";
import "./landing.css";

const description = `En 5 minutes, sans app, directement sur WhatsApp : Edith invente pour chacune de tes vidéos sa forme, sa typo et son rythme, et écrit la légende. Pas d’IA slop. Dès ${PLANS.decouverte.priceEur} € par mois.`;

export const metadata: Metadata = {
  title: { absolute: "Edith · community manager IA pour commerces et créateurs" },
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Edith", locale: "fr_FR", url: "/", title: "Tes Reels, jamais pareils.", description },
  robots: { index: true, follow: true },
};

const steps: [string, string][] = [
  ["Ton activité", "Ton site, ou deux mots sur ce que tu fais."],
  ["Ton style", "Tes couleurs, ta typo, des images que tu aimes."],
  ["Ton rythme", "Combien de posts par semaine."],
  ["Un premier Reel", "Ajusté jusqu’à ce qu’il te ressemble."],
  ["Ton Instagram", "Relié en dernier. TikTok aussi."],
];

/** What gives a post away as « AI content », and what Edith does instead: each line is a rule the editor, the voice and the captions follow. */
const cringe: [string, string][] = [
  ["« Découvrez notre offre exceptionnelle ! »", "Des mots de créateur, jamais de pub."],
  ["Une voix de synthèse qui récite", "De vraies voix, ou la tienne."],
  ["Le même Reel que tout le monde", "Ta typo, tes couleurs, ta lumière."],
  ["Des glitchs, des flashs, des transitions qui tournent", "Des coupes nettes, sur le temps."],
  ["Un texte collé sur ton visage", "Les textes à côté des visages."],
  ["La musique de banque de sons", "Une musique composée pour chaque Reel."],
  ["« Plongez dans l’univers… » et trente hashtags", "Une légende sans tics, cinq hashtags au plus."],
  ["Des prix, des avis, des horaires inventés", "Rien d’inventé."],
];

/** The three offers (the same work; quality over quantity: Pro has room for more care on each Reel). */
const offers = [
  {
    id: "decouverte",
    label: PLANS.decouverte.label,
    price: PLANS.decouverte.priceEur,
    pitch: "Pour commencer : de beaux Reels chaque mois, sans y passer tes soirées.",
    points: [weeklyPosts("decouverte"), `${PLANS.decouverte.credits} crédits par mois`, "Edith sur WhatsApp et dans l’app"],
    dark: false,
  },
  {
    id: "essentiel",
    label: PLANS.essentiel.label,
    price: PLANS.essentiel.priceEur,
    pitch: "Pour être là chaque semaine avec une publication soignée, sans y penser.",
    points: [`${weeklyPosts("essentiel")}, plus les stories`, `${PLANS.essentiel.credits} crédits par mois`, "Edith sur WhatsApp et dans l’app"],
    dark: false,
  },
  {
    id: "pro",
    label: PLANS.pro.label,
    price: PLANS.pro.priceEur,
    pitch: "Pour aller plus loin : plus de Reels et le plus grand soin sur chacun.",
    points: [`${weeklyPosts("pro")}, plus les stories`, `${PLANS.pro.credits} crédits par mois`, "Assez de crédits pour des montages Max : deux versions, la meilleure gardée"],
    dark: true,
  },
] as const;

const faq: [string, string][] = [
  ["Ça ne va pas faire « IA slop » ?", "C’est tout le travail d’Edith : ta meilleure image en premier, des coupes sur le temps, des mots de créateur, ta charte. Et si quelque chose ne te ressemble pas, tu le lui dis d’un mot."],
  ["Tous mes Reels vont se ressembler ?", "Non. Il part de tes images, de ton style et de ce que tu demandes, et donne à chaque Reel sa propre forme. Tu peux aussi lui montrer un Reel que tu aimes : il le refait avec tes images."],
  ["C’est pour qui ?", "Les maisons qui soignent leur image, et les créateurs : studio de Pilates, restaurant, cave, boutique de créateur, joaillier, salon, fleuriste, photographe, styliste, céramiste… Tous ceux qui vivent de leur travail, avec ou sans site."],
  ["Il faut télécharger une app ?", "Non. Tout se passe sur WhatsApp, en 5 minutes pour commencer. Une app web existe pour voir tes Reels en grand sur ordinateur, si tu veux, sans rien installer."],
  ["Edith, c’est une vraie personne ?", "Non, c’est un assistant IA, et il le dit. Tu gardes toujours la main."],
  ["Qui publie sur Instagram ?", "Toi. Edith te prépare la vidéo et sa légende, et te fait signe au bon moment : tu la télécharges, tu la postes, et tu peux y ajouter un son tendance. Il suit ensuite ses chiffres depuis ton @."],
  ["Je n’ai pas de vidéo, ça marche quand même ?", "Oui : il part de tes photos, ou fait un Reel tout en animation. Quand tu filmes, il te dit quoi."],
  ["Il y a un essai ?", `Edith découvre ton activité, trouve ton style et te propose le plan de ton premier Reel, sans rien payer. Pour le fabriquer, tu t’abonnes, dès ${PLANS.decouverte.priceEur} € par mois pour ${reelsPerMonth("decouverte")} Reels, sans engagement.`],
  ["Où vont mes photos et mes données ?", "En Europe. Tes fichiers sont supprimés peu après la publication, et tout disparaît si tu pars."],
];

/** What she can ask, in her words: one row passing by. Content people follow, never a promotion. */
const ideas: [string, string][] = [
  ["Les coulisses du service de midi", "Reel"],
  ["3 erreurs en planche", "Carrousel"],
  ["La coupe de Léa, du bac au miroir", "Reel"],
  ["Mon cours au parc dimanche", "Reel"],
  ["Mes 3 pièces préférées du mois", "Carrousel"],
  ["Le plat du jour en 10 secondes", "Reel"],
  ["Ce qu’on fait avant d’ouvrir", "Story"],
  ["Un shooting, de la prise au rendu", "Reel"],
];

/** The manifesto passing under the hero. */
const NOT = ["pas d’IA slop", "pas d’app à installer", "pas de Reel générique", "pas de voix de robot", "pas deux Reels pareils", "une infinité de façons"];

/** What search engines and AI assistants read about Edith: the product, its offers and the FAQ. */
const structuredData = () => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Edith",
      url: SITE_URL,
      description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, WhatsApp",
      inLanguage: "fr",
      offers: PLAN_ORDER.map((id) => ({
        "@type": "Offer",
        name: PLANS[id].label,
        price: PLANS[id].priceEur,
        priceCurrency: "EUR",
        description: `${reelsPerMonth(id)} Reels soignés par mois`,
        url: `${SITE_URL}/#tarif`,
      })),
    },
    faqPage(faq),
  ],
});

const vars = (values: Record<string, string | number>) => values as CSSProperties;

const reel = (id: WorkId, small = true): StripReel => {
  const w = workById(id);
  const m = workMedia(id);
  return { key: id, src: small ? m.small : m.video, poster: m.poster, label: `${w.trade} · ${w.brand}` };
};
/** The belt under the hero: the site's Reels, endlessly (Edith's models never shown: « je préfère ne pas divulguer nos modèles »). */
const BELT: StripReel[] = WORK.map((w) => reel(w.id));

/** « Tes Reels, jamais pareils. »: the last word changes face, and now and then fills with one of the Reels. */
const PAREILS: MorphItem[] = [
  { text: "pareils.", face: "serif" },
  { text: "pareils.", face: "anton" },
  { text: "pareils.", face: "pixel", image: workMedia("concept-store").poster },
  { text: "pareils.", face: "bodoni" },
  { text: "pareils.", face: "marker" },
  { text: "pareils.", face: "unbounded", image: workMedia("styliste").poster },
  { text: "pareils.", face: "fraunces" },
  { text: "pareils.", face: "dela" },
  { text: "pareils.", face: "mono" },
  { text: "pareils.", face: "caveat", image: workMedia("patissier").poster },
  { text: "pareils.", face: "syne" },
  { text: "pareils.", face: "archivo" },
];

const AUCUN: MorphItem[] = [
  { text: "aucun autre.", face: "serif" },
  { text: "aucun autre.", face: "archivo" },
  { text: "aucun autre.", face: "fraunces", image: workMedia("hotel").poster },
  { text: "aucun autre.", face: "pixel" },
  { text: "aucun autre.", face: "bodoni" },
  { text: "aucun autre.", face: "marker", image: workMedia("coffee-shop").poster },
  { text: "aucun autre.", face: "unbounded" },
];

const mini = (id: WorkId, alt: string): Token => ({ video: workMedia(id).mini, poster: workMedia(id).miniPoster, alt });

/** The principle, written as the page scrolls: never twice the same, her images, her Reel. */
const PRINCIPLE: Token[] = [
  { text: "Une fleuriste", face: "caveat" },
  mini("fleuriste", "Reel d’une fleuriste"),
  { text: "ne raconte pas son métier" },
  { text: "comme un caviste", face: "serif" },
  mini("cave", "Reel d’un bar à vins"),
  { text: "ni comme" },
  { text: "un studio de yoga.", face: "archivo" },
  mini("yoga", "Reel d’un studio de yoga"),
  { text: "Alors Edith ne fait" },
  { text: "jamais deux fois le même.", face: "anton" },
  { text: "Il regarde tes images," },
  mini("patissier", "Reel d’une pâtisserie"),
  { text: "ton style, ta demande,", face: "fraunces" },
  { text: "et il invente", face: "pixel" },
  { text: "ton Reel.", face: "bodoni" },
];

/** What it knows how to do, each technique shown by the Reel that uses it. */
const TECHNIQUES: Technique[] = [
  { name: "Détourée sur un aplat", face: "anton", line: "Elle se détache sur un rouge franc, puis le décor de la boutique passe en trame.", ...pick("concept-store") },
  { name: "Ça s’allume dans le noir", face: "serif", line: "Le Reel s’ouvre sur un seul verre éclairé, puis la salle apparaît.", ...pick("cave") },
  { name: "Par sa silhouette", face: "archivo", line: "Sa silhouette s’ouvre sur la rue suivante, puis sur l’atelier.", ...pick("styliste") },
  { name: "Un verbe par geste", face: "dela", line: "Saisir, napper, dresser : un mot à chaque coupe, en noir, blanc et rouge.", ...pick("restaurant") },
  { name: "Une étoile qui s’ouvre", face: "bodoni", line: "Des bandes d’image partent du flacon et dessinent une étoile avant le premier plan.", ...pick("parfumeur") },
  { name: "Une grille, case par case", face: "mono", line: "Chaque case change à son tour : on passe d’un geste à l’autre sans couper.", ...pick("joaillier") },
  { name: "Une couleur par coupe", face: "unbounded", line: "Chaque création dans son cadre, avec son nom, sur un aplat qui change de couleur.", ...pick("patissier") },
  { name: "De la pose à l’écran", face: "syne", line: "La pose, puis la photo sur l’écran de l’appareil, puis une grille de fenêtres.", ...pick("photographe") },
  { name: "Une carte au feutre", face: "marker", line: "Un mot de plus à chaque coupe, écrit à la main, pendant que le service passe derrière.", ...pick("hotel") },
  { name: "La couleur par éclats", face: "pixel", line: "Le set en noir et blanc, et la couleur des lumières qui revient par moments.", ...pick("dj") },
  { name: "Deux mots par plan", face: "fraunces", line: "Une phrase lente qui avance au rythme des mains.", ...pick("ceramiste") },
  { name: "Du calme au rush", face: "caveat", line: "Des fondus lents avant l’ouverture, puis des coupes vives quand ça se remplit.", ...pick("coffee-shop") },
  { name: "Des passages filés", face: "bricolage", line: "D’un plan à l’autre, l’image file comme un coup.", ...pick("boxe") },
];
function pick(id: WorkId) {
  const w = workById(id);
  return { video: workMedia(id).small, poster: workMedia(id).poster, trade: `${w.trade} · ${w.brand}` };
}

/** The carousels of the site (public/landing/carrousels), made like the Reels: demo businesses, free stock pictures. */
const DECKS: Deck[] = [
  { key: "pivoine", trade: "Fleuriste · Pivoine", title: "Le bouquet de la semaine, en 3 gestes" },
  { key: "comptoir", trade: "Bar à cocktails · Le Comptoir", title: "3 cocktails pour ce soir" },
  { key: "meche", trade: "Salon de coiffure · Atelier Mèche", title: "Le carré de Léa, avant / après" },
].map((d) => ({ ...d, slides: [1, 2, 3, 4, 5].map((n) => `/landing/carrousels/${d.key}-${n}.webp`) }));

export default function LandingPage() {
  const waUrl = whatsappLink();

  return (
    <div className={`land-paper min-h-dvh overflow-x-clip bg-white ${landingFonts}`}>
      <JsonLd data={structuredData()} />
      <SiteHeader waUrl={waUrl} home />

      {/*
        Hero (lot 6 bis, Tristan: « super animé, pas comme un site classique, un site qui a un ADN… des typos qui changent »):
        the promise, its last word never in the same face twice, then an endless belt of Reels: « une infinité de façons ».
      */}
      <section className="flex flex-col gap-10 pt-8 pb-14 sm:pt-12">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-4 sm:px-8">
          <span className="land-intro mono-label flex items-center justify-between gap-4 text-ink" style={vars({ "--i": 0 })}>
            <span>Edith · community manager IA · commerces et créateurs</span>
            <span className="hidden sm:inline">Sans app · directement sur WhatsApp</span>
          </span>
          <h1 className="land-intro text-[clamp(60px,11.5vw,184px)] leading-[0.86] font-semibold tracking-[-0.065em]" style={vars({ "--i": 1 })}>
            Tes Reels,
            <span className="block">
              jamais <MorphWord items={PAREILS} label="pareils." />
            </span>
          </h1>
          <div className="land-intro grid gap-6 border-t border-ink pt-6 lg:grid-cols-[1fr_auto] lg:items-end" style={vars({ "--i": 2 })}>
            <div className="flex max-w-[680px] flex-col gap-4">
              {/* Tristan: « en 5 minutes SANS APP, directement sur WhatsApp », and « pas d'IA slop ». */}
              <p className="text-[clamp(28px,3.4vw,46px)] leading-[1.02] font-semibold tracking-[-0.045em]">
                En 5 minutes, <span className="font-[family-name:var(--font-serif)] font-normal italic">sans app</span>, directement sur WhatsApp.
              </p>
              <p className="text-[18px] leading-[1.5] text-muted sm:text-[20px]">
                Pour les maisons qui soignent leur image, et les créateurs. Tu lui envoies tes vidéos : Edith invente pour chacune sa forme, sa typo et son rythme, écrit la légende et te fait signe au bon moment pour poster. Pas d’IA slop.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-3">
                <Start waUrl={waUrl} size="lg" />
                <a href="#travail" className="btn btn-secondary h-14 px-6 text-base">
                  Voir les Reels
                </a>
              </div>
              <ul className="mono-label flex flex-wrap gap-x-5 gap-y-1.5 text-muted">
                {["Pas d’IA slop", "Sans engagement", `Dès ${PLANS.decouverte.priceEur} € par mois`].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckIcon size={13} className="text-ink" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="land-intro" style={vars({ "--i": 3 })}>
          <ReelBelt reels={BELT} seconds={90} caption={false} />
        </div>
      </section>

      {/* The manifesto, passing by between two hairlines. */}
      <div className="land-ticker-band overflow-hidden border-y border-ink py-5" aria-label={NOT.join(", ")}>
        <div className="land-ticker-row flex w-max items-center" aria-hidden="true">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center">
              {NOT.map((t, i) => (
                <span key={t} className="flex items-center">
                  <span className={`px-8 text-[clamp(28px,3.6vw,52px)] leading-none whitespace-nowrap ${i === NOT.length - 1 ? "font-[family-name:var(--font-serif)] italic" : "font-semibold tracking-[-0.045em]"}`}>
                    {t}
                  </span>
                  <span className="size-2 bg-ink" />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* N° 01, the principle: written as the page scrolls, faces and pictures between the words. */}
      <section className="mx-auto flex max-w-[1360px] flex-col gap-10 px-4 pt-24 pb-28 sm:px-8">
        <div className="mono-label flex items-center justify-between border-t border-ink pt-4">
          <span>Le principe</span>
          <span>N° 01</span>
        </div>
        <ScrollWords tokens={PRINCIPLE} className="max-w-[1240px] text-[clamp(40px,6.2vw,100px)] leading-[1.02] font-semibold tracking-[-0.05em]" />
      </section>

      {/* N° 02, the work: the Reels, what each was asked and made from. */}
      <section id="travail" className="mx-auto flex max-w-[1360px] scroll-mt-6 flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={2} kicker="Le travail">
            Neuf maisons, quatre créateurs, <span className="accent">treize Reels qui ne se ressemblent pas.</span>
          </SectionTitle>
        </div>
        <p className="land-reveal -mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted">
          Ce qu’ils ont envoyé, ce qu’ils ont demandé, ce qu’Edith en a fait.
          <span className="mono-label mt-2 block text-muted/80">Commerces et créateurs d’exemple · vidéos libres de droits · montage et musique d’Edith</span>
        </p>
        <ReelWall
          after={
            // The cell left after the thirteenth on a computer (3 or 4 columns): hers, never an empty space.
            <div className="hidden flex-col justify-end gap-6 border-t border-ink pt-6 md:col-span-2 md:flex lg:col-span-3">
              <p className="max-w-[620px] text-[clamp(36px,4vw,60px)] leading-[0.95] font-semibold tracking-[-0.05em]">
                Et le prochain, <span className="font-[family-name:var(--font-serif)] font-normal italic">avec tes vidéos.</span>
              </p>
              <div>
                <Start waUrl={waUrl} size="lg" />
              </div>
            </div>
          }
        />
      </section>

      {/* N° 03, the techniques: each name in the face of its Reel, the Reel playing beside it. */}
      <section id="techniques" className="mx-auto flex max-w-[1360px] scroll-mt-6 flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={3} kicker="Ce qu’il sait faire">
            Des façons de raconter, <span className="accent">et toutes celles à inventer.</span>
          </SectionTitle>
        </div>
        <Techniques items={TECHNIQUES} />
      </section>

      {/* N° 04, the carousels: they swipe by themselves. */}
      <section id="carrousels" className="mx-auto flex max-w-[1360px] scroll-mt-6 flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={4} kicker="Les carrousels">
            Des carrousels qu’on garde, <span className="accent">et qu’on envoie à une amie.</span>
          </SectionTitle>
        </div>
        <CarouselDecks decks={DECKS} />
      </section>

      {/* N° 05, zero cringe: what gives AI content away, and what Edith does instead. */}
      <section id="cringe" className="mx-auto max-w-[1360px] scroll-mt-6 px-4 pb-28 sm:px-8">
        <div className="land-reveal mb-12">
          <SectionTitle n={5} kicker="Zéro cringe">
            Pas d’IA slop. <span className="accent">Tes Reels n’en ont pas l’air.</span>
          </SectionTitle>
        </div>
        <Play threshold={0.2}>
          <ol className="flex flex-col border-t border-ink">
            {cringe.map(([bad, good], i) => (
              <li key={bad} className="grid gap-2 border-b border-ink/20 py-6 sm:grid-cols-[64px_1fr_1.1fr] sm:items-baseline sm:gap-8">
                <span className="font-mono text-[12px] text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {/* Inline inside its grid item, so a wrapped tic is struck line by line. */}
                <span className="text-[clamp(18px,1.7vw,24px)] leading-snug tracking-[-0.02em] text-muted">
                  <span className="land-once land-strike" style={vars({ "--d": `${0.15 + i * 0.12}s` })}>
                    {fr(bad)}
                  </span>
                </span>
                <span className="text-[clamp(18px,1.7vw,24px)] leading-snug font-semibold tracking-[-0.025em] text-ink">{fr(good)}</span>
              </li>
            ))}
          </ol>
        </Play>
      </section>

      {/* N° 06, how it works: three words, the product alive (WhatsApp and the app), the five steps. */}
      <section id="comment" className="mx-auto flex max-w-[1360px] scroll-mt-6 flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={6} kicker="Comment ça marche">
            Tu envoies. <span className="accent">Il monte.</span> Tu postes.
          </SectionTitle>
        </div>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <ol className="flex flex-col border-t border-ink">
            {steps.map(([title, text], i) => (
              <li key={title} className="land-reveal grid grid-cols-[56px_1fr] items-baseline gap-x-4 border-b border-ink/20 py-5" style={vars({ "--i": i })}>
                <span className="text-[clamp(32px,3.2vw,44px)] leading-none font-semibold tracking-[-0.05em] tabular-nums">{i + 1}</span>
                <span className="flex flex-col gap-1">
                  <h3 className="text-[22px] font-semibold tracking-[-0.03em]">{title}</h3>
                  <p className="text-[15px] leading-[1.55] text-muted">{fr(text)}</p>
                </span>
              </li>
            ))}
          </ol>
          <div className="land-reveal min-w-0">
            <HeroScene />
          </div>
        </div>
        <div className="land-reveal flex flex-col gap-3">
          <span className="mono-label text-muted">Ce que tu peux lui écrire</span>
          <div className="land-marquee-wrap overflow-hidden border-y border-ink/20 py-3">
            <div className="land-marquee flex w-max gap-8 pr-8" style={vars({ "--dur": "50s" })}>
              {[...ideas, ...ideas].map(([idea, kind], i) => (
                <span
                  key={i}
                  aria-hidden={i >= ideas.length || undefined}
                  className={`flex shrink-0 items-baseline gap-3 text-[clamp(20px,2vw,28px)] font-medium tracking-[-0.03em] whitespace-nowrap ${i >= ideas.length ? "land-marquee-dup" : ""}`}
                >
                  {fr(`« ${idea} »`)}<span className="mono-label text-muted">{kind}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* N° 07, what she can ask */}
      <section className="mx-auto flex max-w-[1360px] flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={7} kicker="Ce que tu peux lui demander">
            Une idée, un lien, un vocal&nbsp;: <span className="accent">il s’en occupe.</span>
          </SectionTitle>
        </div>
        <div className="grid border-t border-l border-ink/20 md:grid-cols-2 lg:grid-cols-3">
          <Card i={0} icon={RepeatIcon} title="« Refais-moi ce Reel »" className="lg:row-span-2" visual={<CopyReelVisual />} center>
            Colle le lien d’un Reel que tu aimes : il en reprend la forme, avec tes images.
          </Card>
          <Card i={1} icon={MicIcon} title="Une voix off" visual={<VoiceVisual />} loop>
            Huit voix au choix, ou la tienne en vocal.
          </Card>
          <Card i={2} icon={MusicIcon} title="Une musique à lui" visual={<MusicVisual />} loop>
            Composée pour chaque Reel, calée sur les coupes.
          </Card>
          <Card i={3} icon={ZapIcon} title="Des effets qui suivent tes gestes" visual={<GestureVisual />} loop>
            Un mot qui grandit entre tes doigts, un titre qui passe derrière toi.
          </Card>
          <Card i={4} icon={LayersIcon} title="Bien plus qu’un diaporama" visual={<LayoutsVisual />} loop>
            Écran partagé, collage, carrousels de graphiste.
          </Card>
        </div>
        <div className="grid border-t border-l border-ink/20 md:grid-cols-2 lg:grid-cols-4">
          <Card i={5} icon={PenIcon} title="Les légendes" visual={<CaptionVisual />}>
            Dans ton ton, avec ton lien de réservation.
          </Card>
          <Card i={6} icon={ClockIcon} title="Un signe au bon moment" visual={<ReminderVisual />}>
            Il te prévient quand poster : la vidéo et sa légende sont prêtes.
          </Card>
          <Card i={7} icon={ChartIcon} title="Ce qui marche, chaque dimanche" visual={<ReportVisual />}>
            Ce qui a marché, et ce qu’on ajuste.
          </Card>
          <Card i={8} icon={EyeIcon} title="Des photos plus belles" visual={<RetouchVisual />} loop>
            Lumière, couleurs, visages floutés si besoin.
          </Card>
        </div>
      </section>

      {/* N° 08, price: three columns between hairlines, the price in the biggest type. */}
      <section id="tarif" className="mx-auto max-w-[1360px] scroll-mt-6 px-4 pb-28 sm:px-8">
        <div className="land-reveal mb-12">
          <SectionTitle n={8} kicker="Tarif">
            Trois offres, <span className="accent">sans engagement.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-px border border-ink bg-ink lg:grid-cols-3">
          {offers.map((o, i) => (
            <div key={o.id} className={`land-reveal flex flex-col gap-5 p-7 sm:p-9 ${o.dark ? "bg-ink text-white" : "bg-white text-ink"}`} style={vars({ "--i": i })}>
              <div className="mono-label flex items-center justify-between gap-3">
                <span>{o.label}</span>
                {o.dark && <span className="border border-white/40 px-2 py-1">Le plus complet</span>}
              </div>
              <span className="text-[clamp(72px,7vw,104px)] leading-[0.85] font-semibold tracking-[-0.06em]">
                {o.price}&nbsp;€
                <span className={`mono-label mt-3 block tracking-[0.08em] ${o.dark ? "text-white/60" : "text-muted"}`}>{priceTax ? "TTC par mois" : "par mois"}</span>
              </span>
              <p className={`text-[16px] leading-relaxed ${o.dark ? "text-white/75" : "text-muted"}`}>{fr(o.pitch)}</p>
              <ul className={`flex flex-col border-t text-[15px] ${o.dark ? "border-white/25" : "border-ink/20"}`}>
                {o.points.map((t) => (
                  <li key={t} className={`flex items-center gap-2 border-b py-2.5 ${o.dark ? "border-white/25" : "border-ink/20"}`}>
                    <CheckIcon size={15} className="shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                <Start waUrl={waUrl} size="lg" light={o.dark} />
              </div>
            </div>
          ))}
        </div>
        <p className="mono-label mt-5 text-muted">Les trois font tout&nbsp;: seul le nombre de Reels change.</p>
      </section>

      {/* FAQ */}
      <section className="mx-auto flex max-w-[1360px] flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={9} kicker="Questions">
            Ce qu’on nous <span className="accent">demande.</span>
          </SectionTitle>
        </div>
        <div className="flex flex-col border-t border-ink lg:ml-[33%]">
          {faq.map(([q, a], i) => (
            <details key={q} className="land-reveal group border-b border-ink/20 py-5" style={vars({ "--i": i * 0.5 })}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[clamp(19px,1.6vw,23px)] font-semibold tracking-[-0.025em] [&::-webkit-details-marker]:hidden">
                {fr(q)}
                <span className="flex size-8 shrink-0 items-center justify-center border border-ink text-lg leading-none font-light text-ink transition-transform duration-300 ease-[var(--ease-fauve)] group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[680px] text-[16px] leading-relaxed text-muted">{fr(a)}</p>
            </details>
          ))}
        </div>
      </section>

      <LastCall waUrl={waUrl} line="Sans app, directement sur WhatsApp : dis-lui ce que tu fais, dans cinq minutes il te montre ce qu’il ferait pour toi.">
        Ton prochain Reel ne ressemblera à <MorphWord items={AUCUN} label="aucun autre." />
      </LastCall>

      <SiteFooter />
    </div>
  );
}

/** A cell of the grid: its icon, title and words, then the scene that shows it, played when it comes on screen. */
function Card({
  i,
  icon: Icon,
  title,
  className = "",
  visual,
  loop = false,
  center = false,
  children,
}: {
  i: number;
  icon: ComponentType<{ size?: number }>;
  title: string;
  className?: string;
  visual: ReactNode;
  loop?: boolean;
  /** A tall card: its scene in the middle of the room left, not at the bottom. */
  center?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`land-reveal flex min-w-0 flex-col border-r border-b border-ink/20 p-6 sm:p-7 ${className}`} style={vars({ "--i": i % 5 })}>
      <span className="mb-5 flex items-center justify-between gap-2.5 text-ink">
        <Icon size={20} />
        <span className="font-mono text-[11px] text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
      </span>
      <h3 className="text-[22px] leading-[1.1] font-semibold tracking-[-0.035em]">{title}</h3>
      <p className="mt-2 text-[15px] leading-[1.55] text-muted">{frNodes(children)}</p>
      <Play loop={loop} className={center ? "my-auto" : "mt-auto"}>
        {visual}
      </Play>
    </div>
  );
}
