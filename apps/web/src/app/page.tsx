import { HOUSE_MODELS, PLAN_ORDER, PLANS, reelsPerMonth, weeklyPosts } from "@fauve/agent";
import { priceTax } from "@/lib/legal";
import type { Metadata } from "next";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { ChartIcon, CheckIcon, ClockIcon, EyeIcon, LayersIcon, MicIcon, MusicIcon, PenIcon, RepeatIcon, ZapIcon } from "@/components/icons";
import { HeroScene } from "@/components/landing/hero-scene";
import { IdeaToPost } from "@/components/landing/idea-to-post";
import { Play } from "@/components/landing/play";
import { ModelWall, ReelStrip, type StripReel } from "@/components/landing/reel-strip";
import { ReelWall } from "@/components/landing/reel-wall";
import { WORK } from "@/components/landing/work";
import { fr, frNodes } from "@/components/landing/fr";
import { faqPage, JsonLd, LastCall, SectionTitle, SiteFooter, SiteHeader, Start } from "@/components/landing/site";
import { CaptionVisual, CopyReelVisual, GestureVisual, LayoutsVisual, MusicVisual, ReminderVisual, ReportVisual, RetouchVisual, VoiceVisual } from "@/components/landing/visuals";
import { whatsappLink } from "@/lib/public-env";
import { SITE_URL } from "@/lib/site";
import "./landing.css";

const description = `Edith monte tes vidéos en Reels qui n’ont pas l’air d’une IA, écrit tes légendes et te fait signe au bon moment pour poster. Sur WhatsApp, dès ${PLANS.decouverte.priceEur} € par mois.`;

export const metadata: Metadata = {
  title: { absolute: "Edith · community manager IA pour commerces et indépendants" },
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Edith", locale: "fr_FR", url: "/", title: "Edith est une IA. Tes Reels n’en ont pas l’air.", description },
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
  ["Le même modèle que tout le monde", "Ta typo, tes couleurs, ta lumière."],
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
  ["Ça ne va pas faire « contenu IA » ?", "C’est tout le travail d’Edith : ta meilleure image en premier, des coupes sur le temps, des mots de créateur, ta charte. Et si quelque chose ne te ressemble pas, tu le lui dis d’un mot."],
  ["C’est pour qui ?", "Les commerces de quartier comme les indépendants : studio, salon, resto, boutique, prof de yoga, coach, photographe, céramiste… Tous ceux qui vivent de leurs clients, avec ou sans site."],
  ["Edith, c’est une vraie personne ?", "Non, c’est un assistant IA, et il le dit. Tu gardes toujours la main."],
  ["Qui publie sur Instagram ?", "Toi, d’un toucher : ton Reel s’ouvre dans Instagram, sa légende déjà copiée, et tu peux y ajouter un son tendance. Edith suit ensuite ses chiffres depuis ton @."],
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
const NOT = ["pas de modèle tout fait", "pas de voix de robot", "pas de « offre exceptionnelle »", "pas de glitch", "des Reels qui te ressemblent"];

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

/** A model of Edith's as the site shows it: its loop, its poster, its name and what it does. */
const model = (key: string): StripReel => {
  const m = HOUSE_MODELS.find((h) => h.key === key);
  return { key, src: `/modeles/${key}.mp4`, poster: `/modeles/${key}.jpg`, label: m?.name ?? key, note: m?.pitch };
};
const work = (id: (typeof WORK)[number]["id"]): StripReel => {
  const w = WORK.find((x) => x.id === id)!;
  return { key: `work-${id}`, src: `/landing/work-${id}.mp4`, poster: `/landing/work-${id}.webp`, label: w.trade };
};

/** The hero's strip: the landing's three Reels between models of Edith's, the strongest pictures first. */
const HERO_STRIP: StripReel[] = [model("aplat"), work("pilates"), model("titre-derriere"), work("cafe"), model("carte-feutre"), work("cave"), model("pile")].map((r) => ({ ...r, note: undefined }));

/** Every model, the most striking first (the rest open on a tap). */
const WALL_ORDER = [
  "aplat", "titre-derriere", "mot-cle", "pile", "carte-feutre", "detourages", "journee", "mosaique", "quatre-coins", "coulisses", "cadre", "fenetres",
  "frappe", "interrupteur", "mots-meles", "pixel", "nike", "eventail", "coups-de-fouet", "tourne", "plans-fixes", "table", "ecran-partage", "facade",
  "gaufre", "photo-dump", "decode", "silhouette", "vision", "createur", "interface",
];
const WALL: StripReel[] = [...WALL_ORDER.filter((k) => HOUSE_MODELS.some((m) => m.key === k)), ...HOUSE_MODELS.map((m) => m.key).filter((k) => !WALL_ORDER.includes(k))].map(model);

export default function LandingPage() {
  const waUrl = whatsappLink();

  return (
    <div className="land-paper min-h-dvh overflow-x-clip bg-white">
      <JsonLd data={structuredData()} />
      <SiteHeader waUrl={waUrl} home />

      {/*
        Hero (lot 6: paper and ink, thin lines, big type; « le site devra être ultra visuel »): the promise across the
        whole width in the biggest type of the site, then what it is, then a strip of Reels playing: the colour comes
        from them.
      */}
      <section className="mx-auto flex max-w-[1360px] flex-col gap-10 px-4 pt-8 pb-16 sm:px-8 sm:pt-12 lg:pb-24">
        <span className="land-intro mono-label flex items-center justify-between gap-4 text-ink" style={vars({ "--i": 0 })}>
          <span>Community manager IA</span>
          <span className="hidden sm:inline">Sur WhatsApp et dans l’app</span>
        </span>
        <h1 className="land-intro text-[clamp(52px,10.4vw,168px)] leading-[0.88] font-semibold tracking-[-0.065em]" style={vars({ "--i": 1 })}>
          Edith est une IA.
          <span className="block font-[family-name:var(--font-serif)] text-[1.04em] leading-[0.92] font-normal tracking-[-0.035em] italic">Tes Reels n’en ont pas l’air.</span>
        </h1>
        <div className="land-intro grid gap-6 border-t border-ink pt-6 lg:grid-cols-[1fr_auto] lg:items-end" style={vars({ "--i": 2 })}>
          <p className="max-w-[620px] text-[19px] leading-[1.5] sm:text-[22px]">
            Envoie tes vidéos sur WhatsApp, telles quelles. Edith les monte comme un créateur, écrit la légende, et tu postes d’un toucher sur Instagram et TikTok.
          </p>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <Start waUrl={waUrl} size="lg" />
              <a href="#travail" className="btn btn-secondary h-14 px-6 text-base">
                Voir ses Reels
              </a>
            </div>
            <ul className="mono-label flex flex-wrap gap-x-5 gap-y-1.5 text-muted">
              {["Rien ne part sans ton oui", "En place en 5 minutes", `Dès ${PLANS.decouverte.priceEur} € par mois`].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckIcon size={13} className="text-ink" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="land-intro" style={vars({ "--i": 3 })}>
          <ReelStrip reels={HERO_STRIP} />
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

      {/* N° 01, the work: Reels people watch to the end, never ads. */}
      <section id="travail" className="mx-auto flex max-w-[1360px] scroll-mt-6 flex-col gap-12 px-4 pt-24 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={1} kicker="Le travail">
            Des Reels qu’on regarde <span className="accent">jusqu’au bout.</span>
          </SectionTitle>
        </div>
        <p className="land-reveal -mt-4 max-w-[520px] text-[17px] leading-relaxed text-muted">
          Pas des pubs&nbsp;: des Reels comme ceux des comptes qu’on suit pour le plaisir.
          <span className="mono-label mt-2 block text-muted/80">Commerces d’exemple · vidéos libres de droits</span>
        </p>
        <div className="land-reveal">
          <ReelWall />
        </div>
      </section>

      {/* N° 02, Edith's models: every one plays, the colour of the page. */}
      <section id="modeles" className="mx-auto flex max-w-[1360px] scroll-mt-6 flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={2} kicker="Ses modèles">
            {HOUSE_MODELS.length} façons de raconter ton commerce. <span className="accent">Avec tes images.</span>
          </SectionTitle>
        </div>
        <p className="land-reveal -mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted">
          Choisis-en un dans l’app, ou montre-lui un Reel que tu aimes&nbsp;: Edith le refait avec tes photos, tes vidéos et ta charte.
          <span className="mono-label mt-2 block text-muted/80">Aperçus · vidéos libres de droits</span>
        </p>
        <ModelWall reels={WALL} />
      </section>

      {/* N° 03, zero cringe: what gives AI content away, and what Edith does instead. */}
      <section id="cringe" className="mx-auto max-w-[1360px] scroll-mt-6 px-4 pb-28 sm:px-8">
        <div className="land-reveal mb-12">
          <SectionTitle n={3} kicker="Zéro cringe">
            Le «&nbsp;contenu IA&nbsp;», tout le monde le repère. <span className="accent">Edith fait l’inverse.</span>
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

      {/* N° 04, ta-da: her ideas, Edith does the rest (the real carousel). */}
      <section className="mx-auto flex max-w-[1360px] flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={4} kicker="Ta-da !">
            Toi, tu as les idées. <span className="accent">Moi, j’exécute.</span>
          </SectionTitle>
        </div>
        <IdeaToPost />
        <div className="land-reveal flex flex-col gap-3">
          <span className="mono-label text-muted">Et toutes tes autres idées</span>
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

      {/* N° 05, what she can ask */}
      <section className="mx-auto flex max-w-[1360px] flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={5} kicker="Ce que tu peux lui demander">
            Une idée, un lien, un vocal&nbsp;: <span className="accent">il s’en occupe.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-px border border-ink/20 bg-ink/20 md:grid-cols-2 lg:grid-cols-3">
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
      </section>

      {/* N° 06, what else she does */}
      <section className="mx-auto flex max-w-[1360px] flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={6} kicker="Ce qu’il fait aussi">
            Tout ce qu’un community manager fait, <span className="accent">à ta façon.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-px border border-ink/20 bg-ink/20 md:grid-cols-2 lg:grid-cols-4">
          <Card i={0} icon={PenIcon} title="Les légendes" visual={<CaptionVisual />}>
            Dans ton ton, avec ton lien de réservation.
          </Card>
          <Card i={1} icon={ClockIcon} title="Un signe au bon moment" visual={<ReminderVisual />}>
            Il te prévient quand poster, tout est prêt en un toucher.
          </Card>
          <Card i={2} icon={ChartIcon} title="Ce qui marche, chaque dimanche" visual={<ReportVisual />}>
            Ce qui a marché, et ce qu’on ajuste.
          </Card>
          <Card i={3} icon={EyeIcon} title="Des photos plus belles" visual={<RetouchVisual />} loop>
            Lumière, couleurs, visages floutés si besoin.
          </Card>
        </div>
      </section>

      {/* N° 07, how it works: the product alive (WhatsApp and the app), and the five steps. */}
      <section id="comment" className="mx-auto flex max-w-[1360px] scroll-mt-6 flex-col gap-12 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={7} kicker="Comment ça marche">
            En place en <span className="accent">5 minutes</span>, sans rien installer.
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

      <LastCall waUrl={waUrl} line="Dis-lui ce que tu fais : dans cinq minutes, il te montre ce qu’il ferait pour toi.">
        Tes vidéos sont déjà là. <span className="font-[family-name:var(--font-serif)] font-normal tracking-[-0.03em] italic">Edith en fait des Reels.</span>
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
    <div className={`land-reveal flex min-w-0 flex-col bg-white p-6 sm:p-7 ${className}`} style={vars({ "--i": i })}>
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
