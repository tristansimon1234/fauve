import { PLANS, reelsPerMonth, weeklyPosts } from "@fauve/agent";
import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { ChartIcon, CheckIcon, ClockIcon, EyeIcon, GridIcon, LayersIcon, MicIcon, MusicIcon, PenIcon, RepeatIcon, WhatsAppIcon, ZapIcon } from "@/components/icons";
import { HeroScene } from "@/components/landing/hero-scene";
import { IdeaToPost } from "@/components/landing/idea-to-post";
import { Play } from "@/components/landing/play";
import { ReelWall } from "@/components/landing/reel-wall";
import { fr, frNodes } from "@/components/landing/fr";
import { CaptionVisual, CopyReelVisual, GestureVisual, LayoutsVisual, MusicVisual, ReminderVisual, ReportVisual, RetouchVisual, VoiceVisual } from "@/components/landing/visuals";
import { Mascot } from "@/components/mascot";
import { Logo } from "@/components/orb";
import { whatsappLink } from "@/lib/public-env";
import "./landing.css";

export const metadata: Metadata = {
  description:
    "Edith est une IA, tes Reels n’en ont pas l’air. Envoie tes vidéos sur WhatsApp : il les monte comme un créateur, écrit tes légendes et publie sur Instagram et TikTok. Pour les studios, salons, restaurants et boutiques.",
};

const steps: [string, string][] = [
  ["Ton site", "Donne-lui l’adresse : il comprend ton commerce, ton offre et ta façon de parler."],
  ["Ton style", "Il prend tes couleurs, ta typo et tes plus belles photos pour ton moodboard."],
  ["Ton rythme", "Combien de posts et de stories par semaine : il te fait signe quand ça fait longtemps."],
  ["Un premier essai", "Une première publication ensemble, ajustée jusqu’à ce qu’elle te ressemble."],
  ["Ton Instagram", "En dernier, quand ta publication est prête : elle part dès que tu dis oui. TikTok aussi, si tu veux."],
];

/** What gives a post away as « AI content », and what Edith does instead: each line is a rule the editor, the voice and the captions follow. */
const cringe: [string, string][] = [
  ["« Découvrez notre offre exceptionnelle ! »", "Des phrases courtes, avec un verbe, comme un créateur les écrit."],
  ["Une voix de synthèse qui récite", "Une vraie voix choisie à l’oreille parmi huit, sur un texte écrit pour être dit. Ou la tienne."],
  ["Le même modèle que tout le monde", "Ta typo, tes couleurs, ta lumière : on reconnaît ton commerce sans voir ton nom."],
  ["Des transitions qui tournent, des glitchs, des flashs", "Des coupes franches, posées sur le temps de la musique."],
  ["Un texte collé sur ton visage", "Chaque texte posé à côté des visages, suivis image par image."],
  ["La musique de banque de sons", "Une musique composée pour chaque Reel, calée sur ses coupes."],
  ["« Plongez dans l’univers… » et trente hashtags", "Une légende sans tics d’IA, cinq hashtags au plus."],
  ["Des prix, des avis, des horaires inventés", "Rien d’inventé : il ne dit que ce que tu lui as dit."],
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
  ["Ça ne va pas faire « contenu IA » ?", "C’est tout le travail d’Edith. Il ouvre sur ta meilleure image, coupe sur le temps, écrit comme on parle et suit ta charte : pas de modèle tout fait, pas de voix de robot, pas d’effets gadgets. Et si quelque chose ne te ressemble pas, tu le lui dis d’un mot."],
  ["Edith, c’est une vraie personne ?", "Non, c’est un assistant IA, et il le dit. Il écrit, monte et publie comme un community manager, te fait signe au bon moment, et tu gardes toujours la main."],
  ["Est-ce qu’il publie sans me demander ?", "Jamais. Chaque publication attend ta validation, sur WhatsApp ou dans l’app. Tu peux corriger un texte, déplacer une date ou demander une autre version."],
  ["Je n’ai pas de vidéo, ça marche quand même ?", "Oui. Il part des photos de ton site, de celles que tu lui envoies, ou fait un Reel tout en animation à tes couleurs. Quand tu filmes, il te dit quoi et comment."],
  ["Pour quel commerce ?", "Studios de sport ou de yoga, salons de coiffure et de beauté, restaurants, cafés, boutiques : il parle ta langue et adapte ses idées à ton activité."],
  ["Je peux lui montrer un Reel que j’aime ?", "Oui : colle son lien. Edith en reprend la forme, le rythme, la mise en page et le style des textes, avec tes images et tes mots. Ça vaut pour ce Reel-là ; les suivants restent à ton style."],
  ["Et la musique ?", "Edith compose une musique pour chaque Reel, calée sur les coupes et libre de droits. Pour un son tendance, Instagram ne laisse pas une autre appli l’ajouter : tu le poses en un geste au moment de publier."],
  ["Il y a un essai ?", `Edith lit ton site, trouve ton style, regarde tes vidéos et te propose le plan de ton premier Reel, sans rien payer. Pour le fabriquer, tu choisis ton abonnement, dès ${PLANS.decouverte.priceEur} € par mois pour ${reelsPerMonth("decouverte")} Reels. Sans engagement, tu arrêtes quand tu veux.`],
  ["Où vont mes photos et mes données ?", "Elles sont hébergées en Europe. Tes fichiers sont supprimés peu après la publication, et tout disparaît si tu pars."],
];

/** What she can ask, in her words: two rows passing by. Content people follow, never a promotion. */
const ideas: [string, string][][] = [
  [
    ["Les coulisses du service de midi", "Reel"],
    ["3 erreurs en planche", "Carrousel"],
    ["La coupe de Léa, du bac au miroir", "Reel"],
    ["Le vin de la semaine", "Post"],
    ["Ce qu’on fait avant d’ouvrir", "Story"],
    ["Refais ce Reel avec mes vidéos", "Reel"],
  ],
  [
    ["Mes 3 pièces préférées du mois", "Carrousel"],
    ["pov : ton premier cours", "Reel"],
    ["Le plat du jour en 10 secondes", "Reel"],
    ["Une journée au salon", "Reel"],
    ["Ce qu’on nous demande le plus", "Carrousel"],
    ["On ferme tôt ce soir", "Story"],
  ],
];

/** The manifesto passing under the hero. */
const NOT = ["pas de modèle tout fait", "pas de voix de robot", "pas de « offre exceptionnelle »", "pas de glitch", "des Reels qui te ressemblent"];

const vars = (values: Record<string, string | number>) => values as CSSProperties;

export default function LandingPage() {
  const waUrl = whatsappLink();

  return (
    <div className="land-paper min-h-dvh overflow-x-clip bg-soft">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <Logo />
        <nav className="flex items-center gap-7">
          {[
            ["#travail", "Ses Reels"],
            ["#cringe", "Zéro cringe"],
            ["#comment", "Comment ça marche"],
            ["#tarif", "Tarif"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="hidden text-[14.5px] font-semibold text-ink/80 transition-colors hover:text-ink lg:inline">
              {label}
            </a>
          ))}
          {OPEN && (
            <Link href="/commencer?connexion" className="hidden text-[14.5px] font-semibold md:inline">
              Se connecter
            </Link>
          )}
          <Start waUrl={waUrl} size="sm" />
        </nav>
      </header>

      {/*
        Hero: the promise first, in her words (Tristan: « des reels top quali et pas ai cringe »), what it is
        right under it (« assistant IA sur WhatsApp et via une app web »), and the product alive beside it.
      */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pt-8 pb-20 sm:px-8 sm:pt-12 lg:grid-cols-[1.08fr_1fr] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-7">
          <span className="land-intro flex items-center gap-3 text-[12px] font-bold tracking-[0.16em] text-muted uppercase" style={vars({ "--i": 0 })}>
            <span className="h-px w-8 bg-ink/30" />
            Ton community manager IA, sur WhatsApp
          </span>
          <h1 className="land-intro text-[clamp(38px,4.6vw,66px)] leading-[1] font-extrabold tracking-[-0.045em]" style={vars({ "--i": 1 })}>
            Edith est une IA.
            <span className="mt-1 block font-[family-name:var(--font-serif)] text-[1.22em] leading-[0.95] font-normal tracking-[-0.02em] text-violet italic">Tes Reels n’en ont pas l’air.</span>
          </h1>
          <p className="land-intro max-w-[540px] text-[18px] leading-[1.6] text-muted sm:text-[19px]" style={vars({ "--i": 2 })}>
            Envoie tes vidéos sur WhatsApp, telles quelles. Edith les monte comme un créateur&nbsp;: ta meilleure image en premier, des coupes sur le temps, des mots qui sonnent juste, ta lumière et ta typo. Il écrit la légende, et publie sur Instagram et TikTok quand tu dis oui.
          </p>
          <div className="land-intro flex flex-wrap items-center gap-3" style={vars({ "--i": 3 })}>
            <Start waUrl={waUrl} size="lg" />
            <a href="#travail" className="btn btn-secondary h-14 px-6 text-base">
              Voir ses Reels
            </a>
          </div>
          <ul className="land-intro -mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] font-semibold text-muted" style={vars({ "--i": 3 })}>
            {["Rien ne part sans ton oui", "En place en 5 minutes", `Dès ${PLANS.decouverte.priceEur} € par mois, sans engagement`].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckIcon size={14} className="text-violet" />
                {t}
              </li>
            ))}
          </ul>
          <ul className="land-intro grid max-w-[560px] gap-x-6 gap-y-3 border-t border-ink/10 pt-5 sm:grid-cols-2" style={vars({ "--i": 4 })}>
            {(
              [
                [WhatsAppIcon, "Sur WhatsApp", "Tu lui écris comme à un collègue, tu valides d’un mot."],
                [GridIcon, "Dans l’app web", "Ta grille, tes Reels à retoucher, tes résultats."],
              ] as const
            ).map(([Icon, title, text]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 text-violet">
                  <Icon size={20} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{title}</span>
                  <span className="text-[14px] leading-snug text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="land-intro min-w-0 lg:pl-2" style={vars({ "--i": 3 })}>
          <HeroScene />
        </div>
      </section>

      {/* The manifesto, passing by. */}
      <div className="land-ticker-band overflow-hidden bg-ink py-5 text-white" aria-label={NOT.join(", ")}>
        <div className="land-ticker-row flex w-max items-center" aria-hidden="true">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center">
              {NOT.map((t, i) => (
                <span key={t} className="flex items-center">
                  <span className={`px-7 text-[clamp(22px,2.6vw,34px)] leading-none whitespace-nowrap ${i === NOT.length - 1 ? "font-[family-name:var(--font-serif)] text-lilac italic" : "font-semibold tracking-[-0.02em] text-white/85"}`}>
                    {t}
                  </span>
                  <span className="size-1.5 rounded-full bg-coral" />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* N° 01, the work: Reels people watch to the end, never ads. */}
      <section id="travail" className="mx-auto flex max-w-[1240px] scroll-mt-6 flex-col gap-10 px-4 pt-24 pb-28 sm:px-8">
        <div className="land-reveal grid items-end gap-6 lg:grid-cols-[1.2fr_1fr]">
          <SectionTitle n={1} kicker="Le travail">
            Des Reels qu’on regarde <span className="accent">jusqu’au bout.</span>
          </SectionTitle>
          <p className="max-w-[460px] text-[16px] leading-relaxed text-muted lg:justify-self-end">
            Pas des pubs&nbsp;: des Reels comme en postent les comptes qu’on suit pour le plaisir. Une idée, un rythme, deux ou trois mots justes. Ici, trois commerces d’exemple, montés à partir de vidéos libres de droits.
          </p>
        </div>
        <div className="land-reveal">
          <ReelWall />
        </div>
      </section>

      {/* N° 02, zero cringe: what gives AI content away, and what Edith does instead. */}
      <section id="cringe" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 pb-28 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div className="land-reveal flex flex-col gap-5 lg:sticky lg:top-10 lg:self-start">
            <SectionTitle n={2} kicker="Zéro cringe">
              Le «&nbsp;contenu IA&nbsp;», tout le monde le repère. <span className="accent">Edith fait l’inverse.</span>
            </SectionTitle>
            <p className="max-w-[420px] text-[16px] leading-relaxed text-muted">
              Chaque ligne est une règle que suivent son monteur, sa voix et ses légendes. Pas une promesse de page d’accueil.
            </p>
          </div>
          <Play threshold={0.2}>
            <ol className="flex flex-col border-t border-ink/12">
              {cringe.map(([bad, good], i) => (
                <li key={bad} className="grid gap-2 border-b border-ink/12 py-5 sm:grid-cols-[1fr_1.15fr] sm:gap-8">
                  <span className="flex items-baseline gap-4 text-[15.5px] leading-snug text-muted">
                    <span className="w-6 shrink-0 font-[family-name:var(--font-serif)] text-[17px] text-ink/40 italic tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    {/* Inline inside its flex item, so a wrapped tic is struck line by line. */}
                    <span>
                      <span className="land-once land-strike" style={vars({ "--d": `${0.15 + i * 0.12}s` })}>
                        {fr(bad)}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-baseline gap-2.5 pl-10 text-[15.5px] leading-snug font-semibold text-ink sm:pl-0">
                    <CheckIcon size={15} className="shrink-0 translate-y-[2px] text-violet" />
                    {fr(good)}
                  </span>
                </li>
              ))}
            </ol>
          </Play>
        </div>
      </section>

      {/* N° 03, ta-da: her ideas, Edith does the rest (the real carousel). */}
      <section className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 pb-28 sm:px-8">
        <div className="land-reveal grid items-end gap-6 lg:grid-cols-[1.2fr_1fr]">
          <SectionTitle n={3} kicker="Ta-da !">
            Toi, tu as les idées. <span className="accent">Moi, j’exécute.</span>
          </SectionTitle>
          <p className="max-w-[460px] text-[16px] leading-relaxed text-muted lg:justify-self-end">
            Une phrase suffit, sur WhatsApp ou dans l’app. Edith écrit les textes, les pose sur tes photos à tes couleurs, retouche ce qu’il faut et te montre le résultat. Tu n’as plus qu’à dire oui.
          </p>
        </div>
        <IdeaToPost />
        <div className="land-reveal flex flex-col gap-2.5">
          <span className="text-[12px] font-bold tracking-[0.14em] text-muted uppercase">Et toutes tes autres idées</span>
          <div className="land-marquee-wrap flex flex-col gap-2.5 overflow-hidden">
            {ideas.map((row, r) => (
              <div key={r} className={`land-marquee flex w-max gap-2.5 pr-2.5 ${r === 1 ? "land-marquee-reverse" : ""}`} style={vars({ "--dur": r === 1 ? "54s" : "46s" })}>
                {[...row, ...row].map(([idea, kind], i) => (
                  <span
                    key={i}
                    aria-hidden={i >= row.length || undefined}
                    className={`flex shrink-0 items-center gap-2 rounded-full border border-ink/10 bg-white py-1.5 pr-1.5 pl-3.5 text-[14px] font-semibold whitespace-nowrap ${i >= row.length ? "land-marquee-dup" : ""}`}
                  >
                    {fr(`« ${idea} »`)}<span className="rounded-full bg-soft px-2.5 py-0.5 text-[12px] font-bold text-ink/70">{kind}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* N° 04, what she can ask */}
      <section className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={4} kicker="Ce que tu peux lui demander">
            Une idée, un lien, un vocal&nbsp;: <span className="accent">il s’en occupe.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card i={0} icon={RepeatIcon} title="« Refais-moi ce Reel »" className="lg:row-span-2" visual={<CopyReelVisual />} center>
            Colle le lien d’un Reel que tu aimes : Edith reprend sa forme, son rythme, sa mise en page et le style de ses textes, avec tes images et ta marque.
          </Card>
          <Card i={1} icon={MicIcon} title="Une voix off" visual={<VoiceVisual />} loop>
            Huit voix au choix, un texte qui parle de ton commerce comme un créateur. Ou ta propre voix, envoyée en vocal.
          </Card>
          <Card i={2} icon={MusicIcon} title="Une musique à lui" visual={<MusicVisual />} loop>
            Un morceau composé pour chaque Reel, calé sur les coupes, libre de droits.
          </Card>
          <Card i={3} icon={ZapIcon} title="Des effets qui suivent tes gestes" visual={<GestureVisual />} loop>
            Un mot qui grandit entre tes doigts, un titre qui passe derrière toi : il suit tes mains et ton visage image par image.
          </Card>
          <Card i={4} icon={LayersIcon} title="Bien plus qu’un diaporama" visual={<LayoutsVisual />} loop>
            Écran partagé, collage fait main, carrousels composés comme par un graphiste : la forme suit ton idée.
          </Card>
        </div>
      </section>

      {/* N° 05, what else she does */}
      <section className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={5} kicker="Ce qu’il fait aussi">
            Tout ce qu’un community manager fait, <span className="accent">à ta façon.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card i={0} icon={PenIcon} title="Les légendes" visual={<CaptionVisual />}>
            Écrites avec ton ton, ton offre et ton lien de réservation. Sans tics d’IA.
          </Card>
          <Card i={1} icon={ClockIcon} title="Un signe au bon moment" visual={<ReminderVisual />}>
            Pas de planning à tenir : il te prévient quand c’est le moment de poster, et publie d’un « oui ».
          </Card>
          <Card i={2} icon={ChartIcon} title="Ce qui marche, chaque dimanche" visual={<ReportVisual />}>
            Il compare tes posts et en tire des leçons pour les suivants.
          </Card>
          <Card i={3} icon={EyeIcon} title="Des photos plus belles" visual={<RetouchVisual />} loop>
            Lumière, couleurs, horizon, et les visages floutés quand il le faut. L’original ne bouge pas.
          </Card>
        </div>
      </section>

      {/* N° 06, her style */}
      <section className="mx-auto max-w-[1240px] px-4 pb-28 sm:px-8">
        <div className="land-reveal grid items-center gap-10 overflow-hidden rounded-[28px] bg-white p-6 shadow-[0_1px_0_rgba(28,21,48,.06)] sm:p-12 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-4">
            <SectionTitle n={6} kicker="Ton style">
              Il apprend ton style, <span className="accent">pas un modèle.</span>
            </SectionTitle>
            <p className="max-w-[480px] text-[16px] leading-relaxed text-muted">
              Pas de gabarit tout fait. Edith part de ton site et de ce que tu aimes, te montre un premier essai, et chaque retour affine ta direction artistique pour toutes les publications suivantes.
            </p>
          </div>
          <Play>
            <ol className="grid gap-3 sm:grid-cols-3">
              <StyleStep n={1} title="Ton site">
                <span className="flex -space-x-1.5">
                  {["#2F3B2F", "#EFE6DA", "#B4532A", "#8C9A7E"].map((c, i) => (
                    <span key={c} className="land-once land-pop size-7 rounded-full border-2 border-white shadow-sm" style={vars({ background: c, "--d": `${0.15 + i * 0.12}s` })} />
                  ))}
                </span>
                <span className="land-once land-rise flex flex-col items-center gap-1" style={vars({ "--d": "0.7s" })}>
                  <span className="font-[family-name:var(--font-serif)] text-[30px] leading-none text-[#2f3b2f] italic">Aa</span>
                  <span className="text-[12.5px] text-muted">Couleurs, typo, photos</span>
                </span>
              </StyleStep>
              <StyleStep n={2} title="Un premier essai">
                <span className="land-once land-rise relative block h-[132px] w-[74px] overflow-hidden rounded-[12px] border-[2.5px] border-ink bg-ink shadow-[0_14px_30px_rgba(28,21,48,.22)]" style={vars({ "--d": "0.4s" })}>
                  <video src="/landing/work-pilates.mp4" poster="/landing/work-pilates.webp" autoPlay muted loop playsInline preload="none" aria-label="Un Reel d’exemple pour un studio de Pilates" className="size-full object-cover" />
                </span>
              </StyleStep>
              <StyleStep n={3} title="Tes retours">
                <span className="flex flex-col gap-1.5">
                  {["Plus rapide", "Moins de texte", "Plus chaleureux"].map((l, i) => (
                    <span key={l} className="land-once land-rise" style={vars({ "--d": `${0.5 + i * 0.12}s` })}>
                      {i === 2 ? (
                        // The one she picks.
                        <span className="land-once land-press flex items-center justify-center gap-1 rounded-full border border-violet bg-violet px-2.5 py-1 text-[12px] font-bold text-white" style={vars({ "--d": "1.5s" })}>
                          <CheckIcon size={12} className="land-once land-pop" style={vars({ "--d": "1.6s" })} />
                          {l}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-bold text-violet">{l}</span>
                      )}
                    </span>
                  ))}
                </span>
              </StyleStep>
            </ol>
          </Play>
        </div>
      </section>

      {/* N° 07, how it works: on a computer, a line joins the steps as the page scrolls. */}
      <section id="comment" className="mx-auto flex max-w-[1240px] scroll-mt-6 flex-col gap-10 px-4 pb-28 sm:px-8">
        <div className="land-reveal">
          <SectionTitle n={7} kicker="Comment ça marche">
            En place en <span className="accent">5 minutes</span>, sans rien installer.
          </SectionTitle>
        </div>
        <ol className="land-steps relative grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          <span className="land-steps-line pointer-events-none absolute top-[17px] right-[calc(20%-37.2px)] left-[18px] hidden h-[2px] rounded-full bg-violet/30 lg:block" aria-hidden="true" />
          {steps.map(([title, text], i) => (
            <li key={title} className="land-reveal relative flex flex-col gap-2.5 rounded-[22px] bg-white p-5 lg:bg-transparent lg:p-0 lg:pr-2" style={vars({ "--i": i })}>
              <span className="land-step-dot flex size-9 items-center justify-center rounded-full bg-violet-soft text-[15px] font-extrabold text-violet" style={vars({ "--i": i })}>
                {i + 1}
              </span>
              <h3 className="text-[17px] font-bold">{title}</h3>
              <p className="text-[14px] leading-[1.55] text-muted">{fr(text)}</p>
            </li>
          ))}
        </ol>
        <div className="grid gap-3 md:grid-cols-2">
          <Channel icon={WhatsAppIcon} title="Sur WhatsApp">
            Envoie tes photos et tes vidéos, réponds d’un mot, valide d’un bouton. Edith t’écrit quand ta publication est prête.
          </Channel>
          <Channel icon={GridIcon} title="Dans l’app">
            Ta grille Instagram, tes résultats, et l’éditeur pour changer un texte ou une scène, sur ordinateur comme sur téléphone.
          </Channel>
        </div>
      </section>

      {/* N° 08, price */}
      <section id="tarif" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 pb-28 sm:px-8">
        <div className="land-reveal mb-10">
          <SectionTitle n={8} kicker="Tarif">
            Trois offres, <span className="accent">sans engagement.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {offers.map((o, i) => (
            <div
              key={o.id}
              className={`land-reveal relative isolate flex flex-col gap-4 overflow-hidden rounded-[28px] p-7 sm:p-10 ${o.dark ? "bg-ink text-white" : "bg-white text-ink"}`}
              style={vars({ "--i": i })}
            >
              {o.dark && <span className="pointer-events-none absolute -top-28 -right-24 -z-10 size-80 rounded-full bg-[radial-gradient(circle,rgba(91,63,217,.5),transparent_68%)]" aria-hidden="true" />}
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm font-bold tracking-[0.12em] ${o.dark ? "text-lilac-ink" : "text-violet"}`}>{o.label.toUpperCase()}</span>
                {o.dark && <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold">Le plus complet</span>}
              </div>
              <span className="text-[56px] leading-none font-extrabold tracking-[-0.04em]">
                {o.price} € <span className={`text-xl font-semibold tracking-normal ${o.dark ? "text-lilac-ink" : "text-muted"}`}>TTC / mois</span>
              </span>
              <p className={`text-[15px] ${o.dark ? "text-[#E4DFF2]" : "text-muted"}`}>{fr(o.pitch)}</p>
              <ul className={`grid gap-2 text-[15px] ${o.dark ? "text-[#E4DFF2]" : "text-ink/85"}`}>
                {o.points.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckIcon size={16} className={`shrink-0 ${o.dark ? "text-lilac-ink" : "text-violet"}`} />
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
        <p className="mt-6 text-center text-[14px] text-muted">
          Les deux font tout&nbsp;: Reels montés, voix off et musique, carrousels, stories, légendes, publication sur Instagram et TikTok, bilan chaque semaine. Tu arrêtes quand tu veux.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 pb-28 sm:px-8 lg:grid-cols-[1fr_1.6fr]">
        <div className="land-reveal">
          <SectionTitle n={9} kicker="Questions">
            Ce qu’on nous <span className="accent">demande.</span>
          </SectionTitle>
        </div>
        <div className="flex flex-col border-t border-ink/12">
          {faq.map(([q, a], i) => (
            <details key={q} className="land-reveal group border-b border-ink/12 py-5" style={vars({ "--i": i * 0.5 })}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold [&::-webkit-details-marker]:hidden">
                {fr(q)}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-lg leading-none text-ink transition-transform duration-300 ease-[var(--ease-fauve)] group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[640px] text-[15.5px] leading-relaxed text-muted">{fr(a)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Last call */}
      <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-8">
        <div className="land-reveal relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-[32px] bg-ink px-6 py-16 text-center text-white sm:py-20">
          <span className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 size-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(91,63,217,.55),transparent_65%)]" aria-hidden="true" />
          <Mascot size={92} mood="happy" />
          <h2 className="max-w-[760px] text-[clamp(34px,5vw,64px)] leading-[1.02] font-extrabold tracking-[-0.04em]">
            Tes vidéos sont déjà là. <span className="font-[family-name:var(--font-serif)] font-normal tracking-[-0.01em] text-lilac italic">Edith en fait des Reels.</span>
          </h2>
          <p className="max-w-[460px] text-[16px] text-white/70">Donne-lui ton site&nbsp;: dans cinq minutes, il te montre ce qu’il ferait pour toi.</p>
          <Start waUrl={waUrl} size="lg" light />
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-10 text-sm font-semibold text-muted sm:px-8">
        <span>© Edith</span>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/conditions">Conditions d’utilisation</Link>
        <Link href="/suppression-des-donnees">Suppression des données</Link>
        {OPEN && <Link href="/connexion">Se connecter</Link>}
        <span className="font-normal">Vidéos d’exemple : Mixkit · Photos : Unsplash</span>
      </footer>
    </div>
  );
}

/**
 * Whether the landing lets anyone in. Closed while WhatsApp and Instagram are set up again on the new
 * Meta account (Tristan: « enlève le bouton d'accès pour l'instant… rien n'est branché »): no
 * « Commencer » nor « Se connecter », a « Bientôt disponible » in place of the big buttons.
 */
const OPEN = false;

/** Getting started: in the app on a computer (a code sent from the phone), on WhatsApp on a phone. */
function Start({ waUrl, size, light = false }: { waUrl: string; size: "sm" | "lg"; light?: boolean }) {
  if (!OPEN) {
    if (size === "sm") return null;
    return (
      <span className={`inline-flex h-14 items-center rounded-full px-7 text-base font-bold ${light ? "bg-white/10 text-white" : "bg-violet-soft text-violet"}`}>
        Bientôt disponible
      </span>
    );
  }
  const look = `${size === "lg" ? "h-14 px-7 text-base" : "h-11 px-5"} ${light ? "bg-white text-ink hover:bg-soft" : "btn-primary"}`;
  return (
    <>
      <Link href="/commencer" className={`btn hidden md:inline-flex ${look}`}>
        Commencer
      </Link>
      <a href={waUrl} className={`btn md:hidden ${look}`}>
        <WhatsAppIcon size={size === "lg" ? 20 : 18} />
        {size === "lg" ? "Commencer sur WhatsApp" : "Essayer"}
      </a>
    </>
  );
}

/** A section's title, numbered like a magazine's pages: N° 01, a hairline, its name, then the line. */
function SectionTitle({ n, kicker, children }: { n: number; kicker: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <span className="flex items-center gap-3 text-[12px] font-bold tracking-[0.16em] text-muted uppercase">
        <span className="font-[family-name:var(--font-serif)] text-[17px] font-normal tracking-normal text-ink normal-case italic">N° {String(n).padStart(2, "0")}</span>
        <span className="h-px w-8 bg-ink/25" />
        {fr(kicker)}
      </span>
      <h2 className="max-w-[760px] text-[clamp(34px,4.4vw,58px)] leading-[1.02] font-extrabold tracking-[-0.04em]">{frNodes(children)}</h2>
    </div>
  );
}

/** A card: its icon, title and words, then the scene that shows it, played when it comes on screen. */
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
    <div className={`land-reveal flex min-w-0 flex-col rounded-[22px] bg-white p-6 transition-shadow duration-500 hover:shadow-[0_24px_50px_-28px_rgba(28,21,48,.35)] ${className}`} style={vars({ "--i": i })}>
      <span className="mb-4 flex items-center gap-2.5 text-violet">
        <Icon size={20} />
        <span className="h-px flex-1 bg-ink/10" />
      </span>
      <h3 className="text-[19px] font-bold tracking-[-0.01em]">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-[1.55] text-muted">{frNodes(children)}</p>
      <Play loop={loop} className={center ? "my-auto" : "mt-auto"}>
        {visual}
      </Play>
    </div>
  );
}

function StyleStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col items-center gap-3 rounded-[18px] bg-soft p-4 text-center">
      <span className="flex items-center gap-2 text-[14px] font-bold">
        <span className="flex size-6 items-center justify-center rounded-full bg-violet text-[12px] text-white">{n}</span>
        {title}
      </span>
      <span className="flex min-h-[140px] flex-col items-center justify-center gap-2.5">{children}</span>
    </li>
  );
}

function Channel({ icon: Icon, title, children }: { icon: ComponentType<{ size?: number }>; title: string; children: ReactNode }) {
  return (
    <div className="land-reveal flex items-start gap-4 rounded-[22px] bg-white p-5">
      <span className="mt-0.5 text-violet">
        <Icon size={22} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[16px] font-bold">{title}</span>
        <span className="text-[14.5px] leading-relaxed text-muted">{frNodes(children)}</span>
      </span>
    </div>
  );
}
