import { PLANS } from "@fauve/agent";
import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import {
  ChartIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  GridIcon,
  LayersIcon,
  MicIcon,
  MusicIcon,
  PenIcon,
  RepeatIcon,
  WhatsAppIcon,
  ZapIcon,
} from "@/components/icons";
import { HeroScene } from "@/components/landing/hero-scene";
import { IdeaToPost } from "@/components/landing/idea-to-post";
import { PHOTOS, unsplash } from "@/components/landing/photos";
import { Play } from "@/components/landing/play";
import { ReelsFeed } from "@/components/landing/showcase";
import { CaptionVisual, CopyReelVisual, GestureVisual, LayoutsVisual, MusicVisual, ReminderVisual, ReportVisual, RetouchVisual, VoiceVisual } from "@/components/landing/visuals";
import { Mascot } from "@/components/mascot";
import { Logo } from "@/components/orb";
import { whatsappLink } from "@/lib/public-env";
import "./landing.css";

const steps: [string, string][] = [
  ["Ton site", "Donne-lui l’adresse : il comprend ton commerce, ton offre et ton ton."],
  ["Ton style", "Il prend tes couleurs, ta police et tes plus belles photos pour ton moodboard."],
  ["Ton rythme", "Combien de posts et de stories par semaine : il te fait signe quand ça fait longtemps."],
  ["Un premier essai", "Une première publication ensemble, ajustée jusqu’à ce qu’elle te ressemble."],
  ["Ton Instagram", "En dernier, quand ta publication est prête : elle part dès que tu dis oui. TikTok aussi, si tu veux."],
];

/** The two offers (the same work; quality over quantity: Pro has room for more care on each Reel). */
const offers = [
  {
    id: "essentiel",
    label: PLANS.essentiel.label,
    price: PLANS.essentiel.priceEur,
    pitch: "Pour être présent chaque semaine avec des publications soignées, sans y penser.",
    points: [`${PLANS.essentiel.postsPerWeek} publications soignées par semaine, plus les stories`, `${PLANS.essentiel.credits} crédits par mois`, "Simone sur WhatsApp et dans l’app"],
    dark: false,
  },
  {
    id: "pro",
    label: PLANS.pro.label,
    price: PLANS.pro.priceEur,
    pitch: "Pour aller plus loin : plus de Reels et le plus grand soin sur chacun.",
    points: [`${PLANS.pro.postsPerWeek} publications soignées par semaine, plus les stories`, `${PLANS.pro.credits} crédits par mois`, "Assez de crédits pour des montages Max : deux versions, la meilleure gardée"],
    dark: true,
  },
] as const;

const faq: [string, string][] = [
  ["Simone, c’est une vraie personne ?", "Non, c’est un assistant IA, et il le dit. Il écrit, monte et publie comme un community manager, te fait signe au bon moment, et tu gardes toujours la main."],
  ["Est-ce qu’il publie sans me demander ?", "Jamais. Chaque publication attend ta validation, sur WhatsApp ou dans l’app. Tu peux corriger un texte, déplacer une date ou demander une autre version."],
  ["Je n’ai pas de vidéo, ça marche quand même ?", "Oui. Il part des photos de ton site, de celles que tu lui envoies, ou fait un Reel tout en animation à tes couleurs. Quand tu filmes, il te dit quoi et comment."],
  ["Pour quel commerce ?", "Studios de sport ou de yoga, salons de coiffure et de beauté, restaurants, cafés, boutiques : il parle ta langue et adapte ses idées à ton activité."],
  ["Je peux lui montrer un Reel que j’aime ?", "Oui : colle son lien. Simone en reprend la forme, le rythme, la mise en page et le style des textes, avec tes images et tes mots. Ça vaut pour ce Reel-là ; les suivants restent à ton style."],
  ["Et la musique ?", "Simone compose une musique pour chaque Reel, calée sur les coupes et libre de droits. Pour un son tendance, Instagram ne laisse pas une autre appli l’ajouter : tu le poses en un geste au moment de publier."],
  ["Il y a un essai ?", "Oui. Simone fait ta première publication pendant l’inscription, puis tu as 3 jours d’essai pour tout tester (ta carte est demandée, rien n’est prélevé avant la fin de l’essai). Sans engagement, tu arrêtes quand tu veux."],
  ["Où vont mes photos et mes données ?", "Elles sont hébergées en Europe. Tes fichiers sont supprimés peu après la publication, et tout disparaît si tu pars."],
];

/** What she can ask, in her words: two rows passing by. */
const ideas: [string, string][][] = [
  [
    ["Le menu de la semaine", "Post"],
    ["Un Reel du cours de 7 h", "Reel"],
    ["Nos horaires de Noël", "Story"],
    ["3 nouveautés en boutique", "Carrousel"],
    ["Un avant / après de balayage", "Reel"],
    ["La terrasse ouvre samedi", "Story"],
  ],
  [
    ["Présente notre nouvelle coloriste", "Carrousel"],
    ["Refais ce Reel avec mes vidéos", "Reel"],
    ["Le plat du jour en 10 secondes", "Reel"],
    ["Rappelle le cours d’essai offert", "Post"],
    ["Les coulisses du service", "Reel"],
    ["Nos 3 best-sellers", "Carrousel"],
  ],
];

const vars = (values: Record<string, string | number>) => values as CSSProperties;

export default function LandingPage() {
  const waUrl = whatsappLink();

  return (
    <div className="min-h-dvh overflow-x-clip bg-soft">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <Logo />
        <nav className="flex items-center gap-6">
          <a href="#ce-qu-elle-fait" className="hidden text-[15px] font-semibold lg:inline">
            Ce qu’il fait
          </a>
          <a href="#comment" className="hidden text-[15px] font-semibold lg:inline">
            Comment ça marche
          </a>
          <a href="#tarif" className="hidden text-[15px] font-semibold lg:inline">
            Tarif
          </a>
          <Link href="/commencer?connexion" className="hidden text-[15px] font-semibold md:inline">
            Se connecter
          </Link>
          <Start waUrl={waUrl} size="sm" />
        </nav>
      </header>

      {/* Hero: what it is, said first (Tristan: « on doit mettre en avant assistant IA sur WhatsApp et via une app web pour gérer tes réseaux, monter des Reels »), and shown alive beside it. */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pt-6 pb-20 sm:px-8 sm:pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="flex min-w-0 flex-col gap-6">
          <span className="land-intro self-start rounded-full bg-peach px-3 py-1.5 text-[13px] font-bold text-peach-ink" style={vars({ "--i": 0 })}>
            Pour les studios, salons, restaurants et boutiques
          </span>
          <h1 className="land-intro text-[clamp(38px,5vw,66px)] leading-[1.04] font-extrabold tracking-[-0.035em]" style={vars({ "--i": 1 })}>
            Ton assistant IA sur WhatsApp <span className="accent">qui gère tes réseaux.</span>
          </h1>
          <p className="land-intro max-w-[540px] text-[18px] leading-[1.55] text-muted sm:text-[19px]" style={vars({ "--i": 2 })}>
            Envoie tes photos et tes vidéos à Simone sur WhatsApp, comme à un collègue. Il monte tes Reels, crée tes carrousels, écrit tes légendes et publie sur Instagram et TikTok. Le but : <strong className="font-bold text-ink">plus de clients</strong>, pas juste des vues.
          </p>
          <ul className="land-intro grid max-w-[560px] gap-3 sm:grid-cols-2" style={vars({ "--i": 3 })}>
            {(
              [
                [WhatsAppIcon, "Sur WhatsApp", "Tu lui écris, tu envoies tes vidéos, tu valides d’un mot."],
                [GridIcon, "Dans l’app web", "Ta grille, tes Reels à retoucher, tes résultats."],
              ] as const
            ).map(([Icon, title, text]) => (
              <li key={title} className="flex gap-3 rounded-[18px] border border-line bg-white p-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet">
                  <Icon size={20} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold">{title}</span>
                  <span className="text-[14px] leading-snug text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="land-intro flex flex-wrap items-center gap-3" style={vars({ "--i": 4 })}>
            <Start waUrl={waUrl} size="lg" />
            <a href="#ce-qu-elle-fait" className="btn btn-secondary h-14 px-6 text-base">
              Voir ce qu’il fait
            </a>
          </div>
          <ul className="land-intro flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold text-muted" style={vars({ "--i": 5 })}>
            {["Rien ne part sans ta validation", "En place en 5 minutes", "3 jours d’essai, sans engagement"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckIcon size={16} className="text-violet" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="land-intro min-w-0 lg:pl-4" style={vars({ "--i": 3 })}>
          <HeroScene />
        </div>
      </section>

      {/* For whom */}
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-8">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              [PHOTOS.studioClass, "Studios de sport et de yoga"],
              [PHOTOS.salon, "Salons de coiffure et de beauté"],
              [PHOTOS.dish, "Restaurants et cafés"],
              [PHOTOS.shop, "Boutiques"],
            ] as const
          ).map(([id, label], i) => (
            <li key={id} className="land-reveal group relative h-[180px] overflow-hidden rounded-[22px] sm:h-[220px]" style={vars({ "--i": i })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={unsplash(id, 400, 300)} alt={label} loading="lazy" className="size-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-fauve)] group-hover:scale-[1.05]" />
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,21,48,0)_45%,rgba(28,21,48,.7)_100%)]" />
              <span className="absolute inset-x-4 bottom-3.5 text-[15px] leading-snug font-bold text-white">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Ta-da: her ideas, Simone does the rest (the real carousel) */}
      <section className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-24 sm:px-8">
        <div className="land-reveal flex flex-col gap-4">
          <SectionTitle kicker="Ta-da !">
            Toi, tu as les idées. <span className="accent">Moi, j’exécute.</span>
          </SectionTitle>
          <p className="max-w-[640px] text-[16px] leading-relaxed text-muted">
            Une phrase suffit, sur WhatsApp ou dans l’app. Simone écrit les textes, les pose sur tes photos à tes couleurs, retouche ce qu’il faut et te montre le résultat. Tu n’as plus qu’à dire oui.
          </p>
        </div>
        <IdeaToPost />
        <div className="land-reveal flex flex-col gap-2.5">
          <span className="text-[14px] font-semibold text-muted">Et toutes tes autres idées :</span>
          <div className="land-marquee-wrap flex flex-col gap-2.5 overflow-hidden">
            {ideas.map((row, r) => (
              <div key={r} className={`land-marquee flex w-max gap-2.5 pr-2.5 ${r === 1 ? "land-marquee-reverse" : ""}`} style={vars({ "--dur": r === 1 ? "54s" : "46s" })}>
                {[...row, ...row].map(([idea, kind], i) => (
                  <span
                    key={i}
                    aria-hidden={i >= row.length || undefined}
                    className={`flex shrink-0 items-center gap-2 rounded-full border border-line bg-white py-1.5 pr-1.5 pl-3.5 text-[14px] font-semibold whitespace-nowrap ${i >= row.length ? "land-marquee-dup" : ""}`}
                  >
                    « {idea} »<span className="rounded-full bg-violet-soft px-2.5 py-0.5 text-[12px] font-bold text-violet">{kind}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Her real work */}
      <section id="ce-qu-elle-fait" className="mx-auto flex max-w-[1200px] scroll-mt-6 flex-col gap-8 px-4 pb-24 sm:px-8">
        <div className="land-reveal flex flex-col gap-4">
          <SectionTitle kicker="Fait par Simone">
            De vraies publications, <span className="accent">faites par l’app.</span>
          </SectionTitle>
          <p className="max-w-[640px] text-[16px] leading-relaxed text-muted">
            Ces Reels sortent tels quels de Simone, pour trois commerces d’exemple : il a choisi les plans, écrit les textes, créé les animations à leurs couleurs, puis regardé chaque vidéo et corrigé ce qui n’allait pas.
          </p>
        </div>
        <div className="land-reveal overflow-hidden rounded-[28px] border border-line bg-[radial-gradient(ellipse_at_top,#fff_0%,#FBF7F4_70%)] px-4 py-10 sm:px-8">
          <ReelsFeed />
        </div>
      </section>

      {/* What she can be asked */}
      <section className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-24 sm:px-8">
        <div className="land-reveal">
          <SectionTitle kicker="Ce que tu peux lui demander">
            Une idée, un lien, un vocal : <span className="accent">il s’en occupe.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card i={0} icon={RepeatIcon} title="« Refais-moi ce Reel »" className="lg:row-span-2" visual={<CopyReelVisual />} center>
            Colle le lien d’un Reel que tu aimes : Simone reprend sa forme, son rythme, sa mise en page et le style de ses textes, avec tes images et ta marque.
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

      {/* What else she does */}
      <section className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-24 sm:px-8">
        <div className="land-reveal">
          <SectionTitle kicker="Ce qu’il fait aussi">
            Tout ce qu’un community manager fait, <span className="accent">à tes couleurs.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card i={0} icon={PenIcon} title="Les légendes et les hashtags" visual={<CaptionVisual />}>
            Écrits avec ton ton, ton offre et ton lien de réservation.
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

      {/* Her style */}
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-8">
        <div className="land-reveal grid items-center gap-10 overflow-hidden rounded-[28px] border border-line bg-white p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-4">
            <SectionTitle kicker="Ton style">
              Il apprend ton style, <span className="accent">pas un modèle.</span>
            </SectionTitle>
            <p className="max-w-[480px] text-[16px] leading-relaxed text-muted">
              Pas de gabarit tout fait. Simone part de ton site et de ce que tu aimes, te montre un premier essai, et chaque retour affine ta direction artistique pour toutes les publications suivantes.
            </p>
          </div>
          <Play>
            <ol className="grid gap-3 sm:grid-cols-3">
              <StyleStep n={1} title="Ton site">
                <span className="flex -space-x-1.5">
                  {["#2F3B2E", "#E9DFCF", "#C7835B", "#8C9A7E"].map((c, i) => (
                    <span key={c} className="land-once land-pop size-7 rounded-full border-2 border-white shadow-sm" style={vars({ background: c, "--d": `${0.15 + i * 0.12}s` })} />
                  ))}
                </span>
                <span className="land-once land-rise flex flex-col items-center gap-1" style={vars({ "--d": "0.7s" })}>
                  <span className="font-[family-name:var(--font-serif)] text-[30px] leading-none text-[#2f3b2e] italic">Aa</span>
                  <span className="text-[12.5px] text-muted">Couleurs, police, photos</span>
                </span>
              </StyleStep>
              <StyleStep n={2} title="Un premier essai">
                <span className="land-once land-rise relative block h-[132px] w-[74px] overflow-hidden rounded-[12px] border-[2.5px] border-ink bg-ink shadow-[0_14px_30px_rgba(28,21,48,.22)]" style={vars({ "--d": "0.4s" })}>
                  <video src="/landing/hero-reel.mp4" poster="/landing/post-new.webp" autoPlay muted loop playsInline preload="none" aria-label="Un Reel de Studio Lune, fait par Simone" className="size-full object-cover" />
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

      {/* How it works: on a computer, a line joins the steps as the page scrolls. */}
      <section id="comment" className="mx-auto flex max-w-[1200px] scroll-mt-6 flex-col gap-8 px-4 pb-24 sm:px-8">
        <div className="land-reveal">
          <SectionTitle kicker="Comment ça marche">
            En place en <span className="accent">5 minutes</span>, sans rien installer.
          </SectionTitle>
        </div>
        <ol className="land-steps relative grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          <span className="land-steps-line pointer-events-none absolute top-[17px] right-[calc(20%-37.2px)] left-[18px] hidden h-[2px] rounded-full bg-violet/30 lg:block" aria-hidden="true" />
          {steps.map(([title, text], i) => (
            <li key={title} className="land-reveal relative flex flex-col gap-2.5 rounded-[22px] border border-line bg-white p-5 lg:border-0 lg:bg-transparent lg:p-0 lg:pr-2" style={vars({ "--i": i })}>
              <span className="land-step-dot flex size-9 items-center justify-center rounded-full bg-violet-soft text-[15px] font-extrabold text-violet" style={vars({ "--i": i })}>
                {i + 1}
              </span>
              <h3 className="text-[17px] font-bold">{title}</h3>
              <p className="text-[14px] leading-[1.55] text-muted">{text}</p>
            </li>
          ))}
        </ol>
        <div className="grid gap-3 md:grid-cols-2">
          <Channel icon={WhatsAppIcon} title="Sur WhatsApp">
            Envoie tes photos et tes vidéos, réponds d’un mot, valide d’un bouton. Simone t’écrit quand ta publication est prête.
          </Channel>
          <Channel icon={GridIcon} title="Dans l’app">
            Ta grille Instagram, tes résultats, et l’éditeur pour changer un texte ou une scène, sur ordinateur comme sur téléphone.
          </Channel>
        </div>
      </section>

      {/* Price */}
      <section id="tarif" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 pb-24 sm:px-8">
        <div className="land-reveal mb-8">
          <SectionTitle kicker="Tarif">
            Deux offres, <span className="accent">sans engagement.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {offers.map((o, i) => (
            <div
              key={o.id}
              className={`land-reveal relative isolate flex flex-col gap-4 overflow-hidden rounded-[28px] p-7 sm:p-9 ${o.dark ? "bg-ink text-white" : "border border-line bg-white text-ink"}`}
              style={vars({ "--i": i })}
            >
              {o.dark && <span className="pointer-events-none absolute -top-28 -right-24 -z-10 size-80 rounded-full bg-[radial-gradient(circle,rgba(91,63,217,.5),transparent_68%)]" aria-hidden="true" />}
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm font-bold tracking-[0.06em] ${o.dark ? "text-lilac-ink" : "text-violet"}`}>{o.label.toUpperCase()}</span>
                {o.dark && <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold">Le plus complet</span>}
              </div>
              <span className="text-[52px] leading-none font-extrabold tracking-[-0.03em]">
                {o.price} € <span className={`text-xl font-semibold ${o.dark ? "text-lilac-ink" : "text-muted"}`}>/ mois</span>
              </span>
              <p className={`text-[15px] ${o.dark ? "text-[#E4DFF2]" : "text-muted"}`}>{o.pitch}</p>
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
        <p className="mt-5 text-center text-[14px] text-muted">
          Les deux font tout : Reels montés et relus, voix off et musique, carrousels, stories, légendes, publication sur Instagram et TikTok, bilan chaque semaine. Tu arrêtes quand tu veux.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto grid max-w-[1200px] gap-8 px-4 pb-24 sm:px-8 lg:grid-cols-[1fr_1.6fr]">
        <div className="land-reveal">
          <SectionTitle kicker="Questions">
            Ce qu’on nous <span className="accent">demande.</span>
          </SectionTitle>
        </div>
        <div className="flex flex-col gap-2.5">
          {faq.map(([q, a], i) => (
            <details key={q} className="land-reveal group rounded-[18px] border border-line bg-white px-5 py-4 open:pb-5" style={vars({ "--i": i * 0.5 })}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-soft text-lg leading-none text-violet transition-transform duration-300 ease-[var(--ease-fauve)] group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Last call */}
      <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-8">
        <div className="land-reveal flex flex-col items-center gap-5 rounded-[28px] bg-[radial-gradient(ellipse_at_top,#efebff_0%,#fbf7f4_70%)] px-6 py-12 text-center">
          <Mascot size={96} mood="happy" />
          <h2 className="text-[clamp(30px,4vw,44px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
            Simone <span className="accent">t’attend.</span>
          </h2>
          <p className="max-w-[460px] text-[16px] text-muted">Donne-lui ton site : dans cinq minutes, il te montre ce qu’il ferait pour toi.</p>
          <Start waUrl={waUrl} size="lg" />
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-10 text-sm font-semibold text-muted sm:px-8">
        <span>© Simone</span>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/conditions">Conditions d’utilisation</Link>
        <Link href="/suppression-des-donnees">Suppression des données</Link>
        <Link href="/connexion">Se connecter</Link>
        <span className="font-normal">Photos : Unsplash</span>
      </footer>
    </div>
  );
}

/** Getting started: in the app on a computer (a code sent from the phone), on WhatsApp on a phone. */
function Start({ waUrl, size, light = false }: { waUrl: string; size: "sm" | "lg"; light?: boolean }) {
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

function SectionTitle({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold tracking-[0.06em] text-violet uppercase">{kicker}</span>
      <h2 className="max-w-[720px] text-[clamp(30px,3.6vw,44px)] leading-[1.08] font-extrabold tracking-[-0.025em]">{children}</h2>
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
    <div
      className={`land-reveal flex min-w-0 flex-col rounded-[22px] border border-line bg-white p-6 transition-shadow duration-500 hover:shadow-[0_24px_50px_-28px_rgba(28,21,48,.35)] ${className}`}
      style={vars({ "--i": i })}
    >
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-violet-soft text-violet">
        <Icon size={20} />
      </span>
      <h3 className="text-[19px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-[1.55] text-muted">{children}</p>
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
    <div className="land-reveal flex items-start gap-4 rounded-[22px] border border-line bg-white p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
        <Icon size={20} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[16px] font-bold">{title}</span>
        <span className="text-[14.5px] leading-relaxed text-muted">{children}</span>
      </span>
    </div>
  );
}
