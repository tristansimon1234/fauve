# CLAUDE.md — Fauve, l'agent réseaux sociaux des studios

> Le détail de chaque fonction est dans `docs/<sujet>.md` (index en bas, « Où est le détail ») : le lire avant d'y toucher, et le tenir à jour là. Où on en est et le prochain chantier : `docs/reprise.md` (à mettre à jour à la fin de chaque chantier). Le cahier des charges ci-dessous date du début du projet : quand un fichier de `docs/` dit autre chose, c'est lui qui fait foi.

## Produit en une phrase
> **Nom : Edith.** Le produit et l'assistant s'appellent Edith pour les gérantes (app, WhatsApp, prompts : « Tu es Edith »). Il s'appelait Simone jusqu'en octobre 2026 (nom déjà déposé par d'autres en logiciels et marketing) ; les identifiants internes qui portent encore `simone` restent tels quels (valeurs `"simone"` des voix et de la musique, clés Stripe `simone_{offre}_monthly`, agents `simone-effects`, `SimoneLive`, `SIMONE_VOICES`…), et les migrations déjà appliquées ne changent pas. Edith est un prénom, pas un genre (Tristan : « il faut pas genrer Edith ») : partout « l'assistant IA », « le community manager », « il », et Edith parle de lui au masculin (« je suis prêt ») ; jamais « l'assistante » ni « elle » pour lui (prompt d'Edith, landing, app, mentions légales). « Fauve » reste le nom interne du code (repo, routes comme `/fauve`, classes `fauve-*`, composants `Fauve…`, ce document) : ne pas le montrer à l'écran.

Fauve est une community manager IA qui vit **dans WhatsApp**. La gérante d'un commerce de quartier (studio de Pilates ou de yoga, salon de coiffure, restaurant, boutique…) envoie ses vidéos, et Fauve les monte, écrit les légendes, programme sur Instagram et TikTok, relance quand il manque un contenu, et fait un bilan chaque semaine. Une petite web app (desktop + mobile) sert à voir le calendrier, valider, déposer des vidéos en pleine qualité et suivre les résultats.

- Prix : trois offres TTC (Tristan : « un abo à 19 TTC et 49 TTC en adaptant la marge pour garder un bon niveau », puis « 9 euros », « 3 réels », « il faut laisser à 9 »), **Découverte 9 € / mois** (24 crédits à chaque renouvellement, 2 Reels soignés par mois : c'est l'entrée), **Essentiel 19 € / mois** (54 crédits, 4 à 5 Reels, 1 publication soignée par semaine) et **Pro 49 € / mois** (144 crédits, 12 Reels, 3 publications soignées par semaine) ; chaque offre au-dessus fait le Reel moins cher (4,50 €, 4,22 €, 4,08 €) et le pack plus cher (5 €), pour qu'il y ait toujours intérêt à monter (Tristan : « l'offre a 19 n'est pas intéressante » quand Découverte donnait 3 Reels pour 9 €), avec 40 % de marge au moins sur chaque offre quand tous ses crédits sont dépensés (`OFFER_MARGIN`, `PLAN_MARGIN` ; Tristan a choisi « B » plutôt que 3 Reels à 9 € et environ 18 % partout) ; la qualité avant la quantité : les crédits paient le soin de chaque Reel (un Reel et une correction ≈ 12 crédits, mesuré, `CARED_REEL_CREDITS`, `reelsPerMonth`), pas plus de publications ; pas d'essai gratuit ; sans crédits, l'offre au-dessus est proposée (`PLAN_ORDER`, `nextPlan` dans `packages/agent/src/plans.ts` ; `studios.plan`, `planOf`). Pour l'instant on optimise la **qualité et la vitesse**, pas les coûts, mais on **journalise le coût par studio dès le jour 1**.
- Interface en français ; code, tables et commits en anglais.
- Maquette de référence : canvas Design « Agent studios — Maquette » (app : Fauve, Calendrier, Publication, Résultats ; onboarding : Landing, WhatsApp, Connexion Instagram, Compte prêt).

---

## Stack

```
Gérante ──WhatsApp──▶ Meta WhatsApp Cloud API ──webhook──▶ apps/web (Next.js, Vercel)
                                                              │  agent (Claude, tool use)
                                                              ├─▶ Supabase (Postgres, Auth, Storage, Realtime)
                                                              ├─▶ jobs (Inngest ou Trigger.dev) : relances, rendus, publication, stats
                                                              ├─▶ analyse vidéo (Gemini) ─▶ plan de montage JSON (Claude)
                                                              ├─▶ worker de rendu (ffmpeg / Remotion, hors Vercel)
                                                              └─▶ publication (Ayrshare au MVP ; API Instagram / TikTok en direct ensuite)
```

- **Vercel** : Next.js (App Router, TypeScript strict, Tailwind). Pages, API routes, webhook WhatsApp. Rien de long ou de lourd ici (pas de ffmpeg).
- **Supabase** : Postgres + RLS, Auth par téléphone, Storage pour les médias, Realtime pour rafraîchir la web app.
- **Jobs** : Inngest ou Trigger.dev pour tout ce qui est planifié ou long (relances, rendus, publication à l'heure, collecte des stats). `pg_cron` acceptable pour les tâches simples.
- **Worker de rendu** : un service séparé (Fly.io ou Railway) avec ffmpeg, ou Remotion Lambda. Il reçoit un plan de montage JSON et renvoie un fichier.

Monorepo :
```
apps/web        Next.js (app + landing + API + webhook WhatsApp)
apps/render     worker de rendu (ffmpeg, Node ou Python)
packages/agent  prompts, définitions des tools, schémas Zod (plan de montage, post…)
supabase/       migrations, seed (gabarits, types de contenu)
```

---

## WhatsApp (Meta Cloud API en direct, sans Twilio)

- **Un seul numéro, celui de Fauve**. Toutes les gérantes écrivent au même numéro ; le studio est retrouvé par le numéro de l'expéditeur.
- Webhook : `POST /api/whatsapp/webhook` (vérification de signature `X-Hub-Signature-256`, idempotence sur l'id de message).
- **Fenêtre de 24 h** : réponse libre gratuite tant que la gérante a écrit dans les dernières 24 h. Au-delà, **uniquement des modèles validés par Meta** (payants). Prévoir dès le départ une petite liste de modèles :
  - `content_request` : « J'ai besoin de {quoi} pour le post de {jour}. Tu peux me l'envoyer ? »
  - `reel_ready` : « Ton Reel est prêt ! Touche le bouton pour le voir, le publier ou demander un changement. » avec le bouton « Voir mon Reel » (lien de connexion à usage unique vers sa page ; remplace `draft_ready`, « Ton {type} pour {jour} est prêt. Je le programme ? », classé Marketing par Meta) ;
  - `weekly_summary` : « Ton bilan de la semaine : {{1}}, {{2}} et {{3}}. Le détail est dans l’app, page Résultats. » (ses publications, visites du profil et clics sur son lien des 7 derniers jours, `weeklySummaryParams` ; sans compte connecté, d'après son @, ses vidéos publiées, leurs vues et ses abonnés, chacun avec la semaine d'avant, `weeklyPublicParams` : `weekly_report`, « Ton bilan de la semaine est prêt. », avait été classé Marketing par Meta) ;
  - `post_to_share` : « C’est l’heure de publier « {{1}} » ! Ta publication est prête : touche le bouton pour la voir, ou réponds-moi et je te l’envoie ici. » avec le bouton « Voir ma publication » (lien de connexion à usage unique vers sa page, `/l/{jeton}`, `sendTemplate(…, urlSuffix)` ; remplace `ready_to_post`, sans bouton).
  - `login_code` (catégorie authentification) : code de connexion.
  - Versions neutres (Tristan : « comment éviter le marketing ? ») : Meta avait classé Marketing `reel_ready`, `weekly_summary`, `post_to_share` et `nudge` (facturé plus cher et plafonné par personne). Pour rester Utility, un modèle ne doit rien avoir de promotionnel ni d'incitatif (ni « ! », ni invitation à en faire plus) et parler de ce qu'elle a demandé ou de son compte : `reel_done` (« Ton Reel « {{1}} » est terminé. Touche le bouton pour le voir. »), `weekly_statement` (« Le relevé hebdomadaire de ton compte Edith : {{1}}, {{2}} et {{3}}. Tu reçois ce relevé chaque semaine avec ton abonnement. ») et `post_due` (« Rappel : ta publication « {{1}} » est prévue pour maintenant. Touche le bouton pour l’ouvrir, ou réponds à ce message pour la recevoir ici. »), envoyés d'abord, l'ancienne version tant que Meta les relit (`sendFirstTemplate` dans `lib/whatsapp/client.ts`) ; soumis par `select public.call_app('/api/admin/whatsapp?action=create_templates&only=reel_done,weekly_statement,post_due')`. Une relance pour la faire revenir est Marketing quels que soient ses mots : `nudge` n'est plus envoyé (la relance hors des 24 h reste dans l'app). Pour un modèle déjà reclassé, une révision se demande dans WhatsApp Manager (Business Support, Template Category Updates, 60 jours).
- **Naturel** :
  - marquer comme lu + indicateur « en train d'écrire » dès réception ;
  - **réactions emoji** plutôt qu'un message quand il n'y a rien à dire de plus, avec un vocabulaire fixe : 👍 reçu, ⏳ ça tourne, ❤️ merci, 😂 drôle, 🔥 super contenu, ✅ publié. Une question appelle toujours une vraie réponse. Sans tour du modèle (`inbound.ts`) : 👍 sur le dernier fichier d'une rafale (plus sur chaque vidéo) ; ❤️ ou 👍 sur « merci », « top », « ok » quand Edith n'a rien demandé (`ackFor`) ; ⏳ sur « Alors ? », « ? », « Ok ? », « On en est où ? », « c'est bon ? » pendant qu'Edith répond ou qu'un montage tourne (`isChaser`, `busyNow` ; « Ok ? » avait reçu une phrase) ;
  - **messages courts** (Tristan : « un user aura la flemme de tout lire ») : 2 phrases au plus, une trentaine de mots, une idée par message, le détail seulement si on le demande (ligne du canal WhatsApp) ; la lecture d'un Reel à recopier en une phrase (`stolenStyleMessage`, `stolenStyleShort` : « Je reprends sa phrase tenue à l'écran, ses plans très rapides, ses détourages posés par-dessus et sa fin sur fond noir. ») ; la livraison d'un montage : prêt, la durée, une limite s'il y en a (`deliveryWords` : jamais la phrase du monteur sur son choix, que la vidéo montre), les crédits, plus de mode d'emploi ni d'offre de variante ; le plan avant un Reel en 3 à 5 points de 8 mots au plus, sans « pourquoi » sous les points (seul un « Conseil : » d'Edith reste, `planMessage`) ; le bilan du dimanche sans « Ce que je retiens » ; tout ce qu'Edith écrit lui parvient, entre deux outils aussi : jamais une note pour elle-même (consigne d'Edith : « Création sans médias, puis montage avec tous. » lui était arrivé) ; seuls les « Travaux en cours » de son contexte tournent : un montage annoncé plus tôt qui n'y est pas est fini, remplacé ou arrêté, jamais « en route » (elle l'avait dit de deux montages remplacés) ;
  - Fauve est transparente sur le fait d'être une IA.
- **Médias** : télécharger chaque média reçu vers Supabase Storage. WhatsApp a deux qualités (Tristan : « le niveau de qualité d'une vidéo ne diminue pas vraiment sur WhatsApp si je les envoie direct ») : en standard une vidéo de téléphone arrive vers 1,7 Mb/s, en HD vers 6 à 11 Mb/s, comme envoyée depuis l'app. Chaque vidéo reçue est mesurée (son image et sa durée lues dans l'en-tête MP4, `mp4Video` dans `packages/agent/src/video-quality.ts`, rangées dans `media_assets.width`, `height`, `duration` ; compressée sous 3 Mb/s ou sous 480p, `compressedVideo`) : la première qui arrive compressée, Edith ajoute une fois à sa réponse comment passer WhatsApp en HD (`HD_TIP`, `studios.hd_tip_at`, `lib/video-quality.ts`) ; tant que ses vidéos arrivent en HD, pas de lien de dépôt sous un message qui demande des vidéos, et son contexte le dit (`whatsappVideos`) ; compressées, son lien de dépôt (`/depot`, pleine qualité depuis sa galerie) reste le secours.

---

## Connexion (téléphone, sans mot de passe)

Supabase Auth en mode **téléphone + code** :
- le code est envoyé **par WhatsApp** (modèle `login_code`) via le **Send SMS Hook** de Supabase (livraison personnalisée), SMS en secours ;
- **lien magique** : chaque lien envoyé par Fauve contient un jeton opaque, à usage unique, valable 15 min, lié au numéro. La route `/auth/link/[token]` vérifie le jeton côté serveur et ouvre la session (cookies `@supabase/ssr`) ;
- **QR code sur ordinateur** (comme WhatsApp Web) : l'ordi affiche un QR lié à une demande de connexion ; le téléphone déjà connecté le scanne et confirme ; l'ordi reçoit la session via Realtime ;
- liste des sessions ouvertes, déconnexion à distance ; confirmation WhatsApp pour les actions sensibles (déconnecter Instagram, changer de paiement).

Vérifier dans la doc Supabase à jour la meilleure façon d'ouvrir une session côté serveur pour un utilisateur téléphone : ne pas se fier à sa mémoire.

---

## Connecteurs Instagram / TikTok

**MVP : un agrégateur, pour ne pas attendre les validations.** Ayrshare couvre 13 réseaux (dont Instagram, TikTok, Google Business Profile), gère l'autorisation OAuth de chaque compte, l'hébergement des médias et le multi-comptes pour les SaaS. Alternatives à évaluer : Upload-Post, Late, Postiz (open source, auto-hébergeable).
- un « profil » agrégateur par studio ; la page `/connect` (étape 2 de l'onboarding) ouvre leur flux de connexion ;
- publication programmée, statistiques et commentaires passent par le même fournisseur.

**Ensuite : API officielles en direct**, pour les coûts et la maîtrise :
- **Instagram** (compte professionnel requis) : API Instagram avec connexion Instagram ; publication de photos, carrousels, Reels et stories ; lecture des statistiques ; messages et commentaires. Nécessite la **revue d'app Meta** (vérification d'entreprise, démo vidéo) : la lancer tôt, elle prend des semaines.
- **TikTok** : Content Posting API. **Tant que l'app n'est pas auditée, les publications restent privées.** Alternative : envoyer dans les **brouillons TikTok** de la gérante, qui publie elle-même.

Limites à connaître : la **musique tendance** et les **stickers interactifs** (sondages, questions) ne sont pas disponibles par API. Fauve les suggère, la gérante les ajoute dans l'appli au moment de publier.

---

## IA : le meilleur modèle pour chaque rôle

- **Cerveau de Fauve : Claude (`claude-opus-5-5`) partout pour l'instant.** Conversation WhatsApp, planification des campagnes, légendes, profil de style, plan de montage, bilans. Tool use avec schémas Zod stricts.
- **Analyse vidéo : Gemini 3.7 Flash** (entrée vidéo native, horodatages, mode « agentic video understanding » qui choisit quoi regarder). Il reçoit les clips et renvoie, en JSON : découpage en plans, horodatages, qualité (flou, sombre, bougé), ce qui se passe, transcription si voix.
- **Rendu : outils déterministes**, jamais le modèle directement. Le modèle **décide**, le moteur **exécute**.
- À tester plus tard : Gemini Omni Flash (montage vidéo conversationnel), mais seulement si la qualité est constante.
- Toujours vérifier les noms et capacités des modèles dans la doc à jour avant de coder.

### Pipeline vidéo
1. Clips reçus (WhatsApp ou dépôt web) → Storage.
2. Gemini analyse chaque clip → `clip_analysis` (JSON).
3. Claude choisit les plans, l'ordre, l'accroche des 2 premières secondes, le gabarit, les textes et leur timing → **plan de montage JSON** (`edit_plan`, validé par Zod, versionné).
4. Worker de rendu : JSON → MP4 9:16 1080×1920 (Reels/TikTok) + variantes (story, carré, carrousel de captures).
5. Aperçu envoyé sur WhatsApp et dans la web app. Une correction (« enlève le 2e plan », « texte plus gros ») **modifie le JSON**, puis on relance le rendu.

Règles de montage : coupes franches (un fondu ponctuel ; jamais de zoom en transition ni de poussée lente posée d'office, Tristan : « je trouve ça cheap », `docs/monteur.md`, « Rythme et transitions » ; un modèle qui refait son original garde ses zooms, ses flashs et ses pauses de musique, `docs/modeles.md`, « Décisions de Tristan sur les originaux »), 20 à 30 s quand il y a une histoire (quelqu'un qui parle, un conseil, un avant/après), 7 à 15 s pour une annonce ou une ambiance, jusqu'à 45 s seulement quand quelqu'un parle ou qu'une voix raconte tout du long, ou que le Reel recopié dure aussi longtemps, jamais plus (`MAX_REEL_SECONDS` = 45 dans `packages/agent/src/editor.ts`, Tristan : « je mettrai 45 » ; un vocal de 42 s au plus, `VOICE_MAX_SECONDS` ; un rendu prend 4 à 7 s par seconde de vidéo ; les étapes des tâches de fond `/api/jobs/montage` et `/api/jobs/elements` ont 800 s, le maximum de Vercel Pro avec Fluid compute), accroche dès la 1re seconde (une personne ou le résultat, selon ce que la gérante accepte de montrer), sous-titres mot à mot, logo en fin, **zones de sécurité** (pas de texte en bas ni à droite).

Schéma minimal du plan de montage :
```json
{ "format": "9:16", "duration": 12, "template": "class_of_the_day",
  "segments": [{ "clip_id": "…", "in": 1.2, "out": 3.0, "zoom": "none|light" }],
  "texts": [{ "text": "…", "from": 0, "to": 2.5, "style": "hook|band|caption" }],
  "images": [{ "asset_id": "logo", "position": "bottom_right", "from": 9, "to": 12 }],
  "transitions": "cut", "subtitles": true, "music": null }
```

### Images (texte sur photo)
Gabarits **HTML/CSS** à la charte du studio (planning de la semaine, nouvel atelier, citation, témoignage, places restantes), rendus en image (Satori/@vercel/og ou Playwright côté worker). Le modèle choisit le gabarit et le texte ; il ne dessine pas.

---

## Le cycle de l'agent

1. **Onboarding dans WhatsApp** : nom du studio → rythme (ex. 3 posts + 4 stories / semaine) → 2-3 posts d'exemple → lien de connexion Instagram (+ TikTok) → « compte prêt ».
2. **Profil de style** : tirés des exemples (ton, longueur, emojis, hashtags, visuels). Chaque correction de la gérante l'affine (`brand_profile`, versionné).
3. **Campagne** : calendrier du mois avec des thèmes récurrents (cours, coulisses, profs, témoignages, offres, conseils Pilates) et les temps forts (rentrée, janvier, avant l'été, ateliers).
4. **Liste de tournage** hebdomadaire : quoi filmer, avec angle et lumière conseillés.
5. **Relances** : la veille de chaque publication s'il manque un média ; plan B (bibliothèque, post texte) si rien n'arrive.
6. **Production → validation → publication** : rien n'est publié sans validation au début.
7. **Bilan du dimanche** : ce qui a marché, pourquoi, et les ajustements du calendrier.

### Statuts d'un post (machine à états)
`planned → content_requested → media_received → draft → validated → scheduled → published → measured`
(+ `skipped`, `failed`). C'est ce statut qui décide des relances.

### Tools de l'agent
`get_studio_context`, `get_calendar`, `create_post`, `update_post`, `request_content`, `analyze_clips`, `montage`, `render`, `send_preview`, `schedule_post`, `get_metrics`, `draft_reply` (commentaires/DM), `update_brand_profile`, `react_to_message`.

---

## Modèle de données (Supabase)

```sql
studios (id, name, timezone default 'Europe/Paris', plan, created_at)
members (id, studio_id, user_id, phone_e164, role)            -- 'owner' | 'staff'
whatsapp_messages (id, studio_id, wa_message_id unique, direction, type, body, media_id, created_at)
brand_profiles (id, studio_id, version, profile jsonb, examples jsonb, created_at)
content_plans (id, studio_id, posts_per_week, stories_per_week, platforms text[], themes jsonb)
posts (id, studio_id, kind, platforms text[], scheduled_at, status, caption, hashtags text[],
       template, edit_plan_id, render_id, external_ids jsonb, created_at)
media_assets (id, studio_id, storage_path, kind, source, duration, tags text[], consent_ok bool)
clip_analyses (id, media_id, analysis jsonb, model, created_at)
edit_plans (id, post_id, version, plan jsonb, created_at)
renders (id, edit_plan_id, status, storage_path, duration_ms, created_at)
social_accounts (id, studio_id, platform, handle, provider, provider_ref, status)
metrics (id, post_id, platform, captured_at, views, reach, likes, saves, shares, comments, profile_visits)
bookings_attribution (id, studio_id, source, post_id null, utm jsonb, created_at)
login_tokens (id, user_id, token_hash, purpose, expires_at, used_at)
cost_events (id, studio_id, kind, provider, units, cost_eur, created_at)   -- dès le jour 1
```

RLS : tout est filtré par `studio_id` via `members`. Le webhook et les jobs passent par la clé service role côté serveur uniquement. Le navigateur ne fait que lire les tables (il n'écrit que dans le Storage, dans le dossier de son studio) : chaque écriture passe par une action serveur qui vérifie le studio puis écrit avec la clé service role (politiques de lecture « members read … », les anciennes politiques d'écriture passées au rôle service_role plutôt que supprimées, `browser_reads_only` ; revue de sécurité d'octobre 2026 : une politique d'écriture sur `posts` laissait un membre y poser le code d'un carrousel, exécuté ensuite dans l'atelier de rendu, ou le chemin d'un fichier d'un autre studio). Une page visée par un lien passe par `safePath` (`lib/auth/link-route.ts` : ni `//`, ni `\`, ni caractère de contrôle).

---

## Web app

Écrans (voir maquette) :
- **Fauve** : accueil « ce qui t'attend » + conversation. Le canal principal reste WhatsApp : bouton « Continuer sur WhatsApp », et l'historique sert surtout à retrouver une demande.
- **Calendrier** : semaine, statut par post, filtres, liste « À filmer », progression du rythme.
- **Publication** : aperçu Instagram / TikTok, légende, plateformes, horaire, plan de montage, explication de Fauve, Valider.
- **Résultats** : 7 / 30 jours, avec en premier les **réservations venues d'Instagram**, puis le bilan de Fauve, les meilleurs posts et les meilleurs moments.
- **Médiathèque**, **Réglages** (comptes, rythme, style, sessions, abonnement Stripe).
- Onboarding web : **Landing** (CTA « Commencer sur WhatsApp » + QR code), **Connexion Instagram**, **Compte prêt**.

Responsive : desktop d'abord pour la web app (le dépôt de vidéos et le calendrier y sont plus confortables), parfait sur mobile pour les pages ouvertes depuis WhatsApp. PWA installable.

### Design
Lot 6 (Tristan : « bord non arrondi, ligne et très fin, contraste avec des grosses polices », « noir et blanc simple, les vidéos et photos rajoutent de la couleur », « blanc cassé j'aime bien, encre aussi », « tout clair ») :
- Papier `#F5F2EC` (pages et cartes), un ton plus foncé `#ECE8E0` (bulles, creux, survol), trait `#D4CEC3`, encre `#121110` (texte et actions), secondaire `#6B675F`. Aucune couleur de marque : la couleur vient des photos et des vidéos. Seuls l'erreur (rouge), la réussite (vert) et l'alerte (papier chaud, encre brune, crédits bas) gardent une teinte. Les noms des jetons de la première identité restent (`violet`, `peach`, `lilac`…) et portent ces valeurs (`globals.css`) : `bg-violet` est l'encre d'une action.
- Polices : **Inter Tight** (interface et grands titres, `--font-grotesk`), **Instrument Serif italique** (accents), **IBM Plex Mono** (petites étiquettes en capitales, utilitaire `mono-label` : « N° 01 », un statut, un compte). Les titres de page sont très grands et serrés (44 à 60 px, graisse 600, `tracking-[-0.05em]`) ; `font-bold` vaut 600 et `font-extrabold` 700 : le contraste vient de la taille, pas du noir.
- Angles droits partout (plus de pilules ni de cartes arrondies ; seuls les vrais cercles restent ronds : photos de profil, points, et les imitations d'appareils ou d'applis : téléphone, WhatsApp, profil Instagram de la Grille), traits fins de 1 px plutôt qu'ombres portées, boutons pleins à l'encre ou au trait (`btn-primary`, `btn-secondary`), menu actif en bloc d'encre. Icônes au trait, jamais d'emoji dans l'interface.
- Logo et mascotte : la tête d'Edith en gribouillis (`components/mascot.tsx`, Tristan : « plus simple, presque un gribouille de cheveux, ultra minimaliste ») : une ligne de cheveux lâche qui boucle (chemin généré une fois, `HAIR_PATH`), les lunettes (`GLASSES_PATH`) et deux points pour les yeux (`EYES`) ; sourcils et bouche seulement pour une humeur, de la couleur du texte, traits de même épaisseur à toutes les tailles (`vector-effect: non-scaling-stroke`) ; « Edith » en Inter Tight serré à côté (`Logo`). Icône : la tête en blanc sur un carré d'encre (`app/icon.svg`, `public/icon.svg`). `Orb` n'est plus qu'Edith qui réfléchit (états d'attente). Image d'aperçu des liens (`opengraph-image.tsx`) en papier et encre, polices dans `app/_og/` (`intertight-500/600.ttf`, instances fixes de la police variable ; les fichiers Jakarta y restent pour la vidéo d'intro).

---

## Mesure (dès la v1)
- Liens de réservation suivis (UTM) dans la bio et les stories, et un code d'essai propre à Instagram.
- La question « Comment nous avez-vous connus ? » côté studio, si possible.
- Le chiffre roi du produit : **réservations venues des réseaux**, chaque mois, par studio.

## Droits et conformité
- **Droit à l'image** : ce que la gérante envoie est utilisable (elle est d'accord pour qu'on le voie) : Edith n'écarte rien et ne fait pas la leçon ; elle floute seulement sur demande. Le monteur se sert de chaque clip et photo reçus.
- RGPD : données hébergées en Europe, suppression complète quand un studio part, contrat de sous-traitance avec chaque studio.
- Musique : aucune musique protégée intégrée au rendu ; son tendance ajouté dans l'appli, ou bibliothèque libre de droits sous licence.

## Hors MVP
Intégration bsport (planning et données élèves), relances aux élèves (bsport le fait déjà), mise à jour du site web, fiche Google, publicité locale (« boost »), offre à 99 €.

## Conventions
- TypeScript strict, Zod sur toutes les entrées (webhook, tools, plan de montage).
- Migrations SQL versionnées dans `supabase/migrations`.
- Secrets en variables d'environnement uniquement (`SOCIAL_CONNECT`, réglage et non secret : `on` pour proposer de relier Instagram et TikTok) : `TYPESAFE_API_KEY` (Jev), `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AYRSHARE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`.
- Avant chaque intégration (WhatsApp, Instagram, TikTok, Ayrshare, Gemini, Supabase Auth), lire la doc à jour : les API changent souvent.
- Avec Tristan et dans les textes de l'app, ne pas dire « la gérante » (Tristan : « c'est pas forcément une gérante », puis « dans l'app on parle encore de gérante ! ») : « tu » à l'écran, sinon « la personne », « l'utilisateur » ; le rôle du compte principal s'affiche « Responsable » (menu, Réglages), et ce qu'un écran écrit en son nom dans le chat aussi (« Le plan validé », `validatedPlanBrief`). Seules les consignes des modèles gardent « la gérante ».
- Consignes des modèles en anglais (Tristan : « il faut les mettre en anglais pour moi tous les prompt système ») : chacune dit ce qui s'écrit en français, ce que la gérante lit (textes à l'écran, messages, légendes, noms) ; ses mots, les exemples de phrases et les valeurs qu'on lui montre restent en français. Restent en français : celles des Composants retirés (`elements.ts`, `text-layer.ts`). Celles d'Edith dans le chat (`FAUVE_SYSTEM_PROMPT`) et du monteur sont réécrites en anglais, en experts, plutôt que traduites (plus bas, « Consigne d'Edith » et « Qui décide »).

## Dans le repo
- Commandes : `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (à la racine).
- Un push qui ne change que des fichiers `.md`, `docs/`, les réglages des sessions (`.claude/`, dont les outils permis sans demander : `permissions.allow` de `.claude/settings.json`), l'outil de rendu local des skills ou des brouillons de skills que `skill-library.ts` n'importe pas ne reconstruit pas l'app sur Vercel (`ignoreCommand` dans `apps/web/vercel.json` → `scripts/vercel-ignore.sh`, comparé au dernier déploiement réussi, `VERCEL_GIT_PREVIOUS_SHA` ; Tristan : « ba oui », chaque build se paie en minutes de CPU). Un fichier `.md` lu par l'app au déploiement ne doit donc jamais exister.
- Next.js 16 avec Cache Components : lire `node_modules/next/dist/docs/` avant d'utiliser une API Next ; toute lecture de cookies/session doit être sous `<Suspense>`.
- Les écrans de la web app lisent les vraies données du studio connecté via `apps/web/src/lib/studio.ts` (`getStudioContext`).
- Supabase : projet `fauve` (ref `tfxkhktofgtljlqlksba`, eu-west-3). Les noms des fichiers de migration reprennent les versions appliquées en base.
- La maquette décompressée (un HTML par écran) est dans `docs/maquette/ecrans/`.
- Gérant ou gérante : les prompts disent « la gérante » mais Edith ne devine jamais le genre (ni d'après le prénom) et n'accorde rien tant que la personne ne l'a pas dit (tournures neutres).
- Le but, ce sont des clients, pas du buzz ; la qualité avant la quantité (prompts d'Edith, du monteur et de l'analyste « Ce qui marche ») : visites du profil, clics sur le lien, réservations et abonnés d'abord, les vues seules comptent peu ; jamais pousser à publier plus pour publier plus.

## Règles de travail avec Tristan

- Dire la correction avant de la faire ; en français, court.
- Expliquer d'abord ce qu'on veut faire et où on en est, avec ce qu'il connaît (Edits, CapCut), avant de proposer : il veut comprendre, pas une liste de fonctions.
- Aucun appel d'API facturé hors d'un banc d'essai annoncé (quelques centimes à 1 € par essai, le coût dit après).
- Toujours dire qui a fait un Reel : la chaîne d'Edith ou Claude à la main. Ne pas toucher la landing sans qu'il le demande.
- Jamais de secret affiché ni demandé : les appels d'admin passent par la base (`net.http_post` avec les secrets du Vault, réponse lue dans `net._http_response`).
- À l'écran : « tu », jamais « la gérante » ; Edith n'est pas genré (« il », « l'assistant IA »).

## Règles transverses

- Tout appel payant (un modèle, un fournisseur, un atelier) journalise son coût dans `cost_events`, dès le premier jour ; les prix sont dans `packages/agent/src/pricing.ts`, à mettre à jour quand un prix change (`docs/ia.md`).
- Une sortie structurée de Claude ou de Gemini passe par `outputFormat` et `readAnswer` (`@fauve/agent/answer`), jamais par `betaZodOutputFormat`, que le lint refuse (`docs/ia.md`, « Réponses des modèles »).
- Une consigne de modèle est écrite en anglais et vaut pour n'importe quel commerce (« studio » n'est que le nom interne) ; ce que la personne lit reste en français (Conventions ; `docs/edith.md`, « Activité »). La consigne d'Edith tient sous 12 000 caractères (vérifié par les tests).
- Un écran qui change met à jour le mode d'emploi qu'Edith lit (`app_guide`, `packages/agent/src/app-guide.ts`).
- Après un changement dans `apps/render/src`, `npm run render:pack` régénère `apps/web/src/lib/render/remotion-source.generated.ts` (vérifié en CI ; `docs/rendu.md`).
- Une nouvelle page de l'app passe par `PageSuspense` ; un éditeur qui garde une copie locale a sa clé `versionKey(...)` (`docs/ecrans.md`, « Transitions » et « Fluidité »).
- Un travail sur un atelier (Vercel Sandbox) ou chez un fournisseur qui ne prend que quelques travaux à la fois prend sa place avec `withSlot` (`lib/work-slots.ts` ; `docs/exploitation.md`, « Montée en charge »).
- La suppression d'un studio retire ses fichiers sous `{studio}/` du bucket `media`, puis la ligne `studios`, le reste suivant en cascade : un nouveau fichier d'un studio va sous `{studio}/`, une nouvelle table a son `studio_id` en `on delete cascade` (`docs/legal.md`). Un média qu'une nouvelle colonne garde doit être connu de la rétention (`expired_media()`), sinon il est supprimé (`docs/medias.md`, « Conservation des médias »).
- Les pages légales disent ce que fait le code (sous-traitants, durées de conservation, données gardées, suppression) : changer l'un, c'est changer l'autre (`docs/legal.md`).
- Sur téléphone, tout passe par WhatsApp et les pages faites pour lui (groupe `(action)` : `/v`, `/depot`, `/connect`…) ; l'app elle-même ne s'ouvre pas sur un téléphone (`proxy.ts` ; `docs/whatsapp.md`).

## Où est le détail

Un fichier par sujet dans `docs/`, un paragraphe par fonction (ses fichiers, ses identifiants, le pourquoi et les mots de Tristan). Le lire avant de toucher au sujet ; pour un nom de fonction, de table ou de variable : `grep -rn <nom> docs/`. Quand une fonction change, son paragraphe change dans son fichier ; une nouvelle fonction y ajoute le sien ; un nouveau sujet ajoute son fichier et sa ligne ici. CLAUDE.md reste court : le produit, la stack, les règles et cet index.

**Créer et monter**

- `docs/creer.md` — Créer une publication : Nouvelle publication ; Nouvelle publication depuis la page Edith.
- `docs/montage.md` — La chaîne du montage d'un Reel : Montage ; Plus d'ambiances ; Ajouter sans rien refaire ; Niveaux de soin d'un montage ; Noms des gabarits à l'écran ; Reel composé ; Monteur (`look_name`) et ce qu'Edith demande avant de produire ; Suivi des travaux ; Reels de photos ; Contrat d'un Reel ; Sa demande, mot pour mot, à chaque agent.
- `docs/monteur.md` — Le métier du monteur : Face caméra sans les « euh » ; Sous-titres créatifs ; Un texte par plan ; Vidéos horizontales entières sur du noir ; L'accroche décide si on reste ; Monteur pro ; Rythme et transitions.
- `docs/animations.md` — Animations (motion designer) : Bibliothèque de scènes ; Le motion designer voit le Reel avant d'écrire ; Plus de relecture des animations ; Animations libres ; Kit d'effets des animations ; Boîte à outils des animations ; Textes et matières des animations ; Interface, formes et transitions des animations ; Kit d'image des animations ; Flash qui surexpose ; Brûlure de pellicule ; Demi-tour ; Bords d'objectif ; Filé dans un plan ; Zoom coup de poing dans un plan ; Étoile de fenêtres ; Mosaïque en ordre de lecture et cases posées ; Un morceau d'un objet seul ; Fondu par la lumière ; Traîne ; Ombre portée d'un détourage ; Trame de points ; Passe en caractères ; Petites étiquettes et mots coupés par le bord ; Texte tapé qui s'efface ; Tracés à l'allure d'une main ; Mots leurres d'une grille ; Écriture à la main qui ne se répète pas ; Accroche en bandeaux ; Fenêtre en amande ; Pictogrammes au trait par métier ; Écrans du moteur sous une composition.
- `docs/modeles.md` — Les modèles d'Edith : Les modèles d'Edith ; Les originaux des modèles et leurs planches ; Associations de polices ; Une police par mot ; DA d'Edith par défaut et regard du réalisateur ; Un seul réalisateur pour un Reel qui suit un modèle ; Skills de montage ; Validation des modèles ; Réglages d'un modèle ; La chaîne des modèles ; Objets d'un modèle ; Plans simultanés ; Skills calés sur sa voix ; Son adresse en coordonnées ; Décisions de Tristan sur les originaux ; Modèles repérés. Les fiches des originaux, effet par effet : `docs/fiches/<clé>.md`.
- `docs/recopie.md` — Recopier un Reel (« Steal ») : Garder le son du Reel recopié ; Un Reel recopié simple est refait par le code ; Style et inspiration d'un Reel ; Textes d'un Reel recopié dessinés comme le modèle ; Recopie fidèle par défaut ; « Steal » ; Ses Reels comme modèles.
- `docs/effets.md` — Atelier d'effets.
- `docs/detourage.md` — Suivi et détourage : Ce qui bouge dans ses vidéos ; Détourage d'une vidéo plus net ; Détourage sur carte graphique louée ; Suivi d'un objet ; Les détourages aussi dans une animation posée sur le montage ; Du texte autour d'un élément ou derrière lui ; Son sujet détouré à chaque image ; Les morceaux d'un objet ; Où poser un texte dans son plan ; Seuls les plans où elle est dessinée sont détourés ; Le ciel de son plan, détouré ; Le point de fuite de son plan ; La lumière sous une zone ; Un geste de tête mesuré et nommé.
- `docs/outils-video.md` — Outils vidéo : Vidéos stabilisées ; Photos et vidéos trop petites agrandies ; Ralenti fluide et rampe de vitesse ; Photos en relief ; La profondeur d'une vidéo, montrée ; Looks à la Prequel, n'importe lequel ; Un outil de montage, pas une IA qui fabrique des images ; Ses finitions ; Stories animées express ; Un look sur un passage ; Sa profondeur en masque ; Ce que le remplisseur lit sur ses fichiers.
- `docs/rendu.md` — Rendu : Rendu ; Le rendu Remotion attend une image 60 s au plus ; Rendu sûr ; Graisses des polices ; Logo en fin de Reel.
- `docs/son.md` — Musique et son : Musique d'Edith ; Forme de la musique d'un modèle ; Bruitages ; Le son de ce qui est dit ; Deux prises calées sur leur son ; Caler un Reel sur un son donné.
- `docs/voix.md` — Voix off : Sa voix sur un Reel ; Sa propre voix clonée ; Voix moins expressives ; Scénariste des voix off ; Voix d'Edith sur un Reel.
- `docs/carrousels.md` — Carrousels et texte sur photo : Texte sur les photos ; Carrousel composé ; Calques de texte ; Éditeur de carrousel ; Mises en page dans l'éditeur de carrousel ; Mises en page souples ; Designer de texte ; Composants (retirés).
- `docs/marque.md` — Marque et style du commerce : Signature du commerce ; Charte, source unique des polices et des couleurs ; Ton style en onglets sur ordinateur ; Ton style ; Style (réglages) ; Styles de texte ; Polices que Google Fonts ne sert pas ; Polices de la gérante ; Sa DA sans site ; Son site change.
- `docs/medias.md` — Photos et vidéos reçues : Analyse vidéo ; Images par IA ; Médiathèque ; Médiathèque pour Fauve ; Retouche et floutage ; Conservation des médias ; Photos lues dès leur arrivée ; Envoi au compte-gouttes.

**Publier et mesurer**

- `docs/publication.md` — La page d'une publication : Édition simple pour les non-pros ; « Modifier » ; Page d'un Reel ouverte depuis WhatsApp ; Page d'un carrousel ou d'une photo ouverte depuis WhatsApp ; Page mobile d'action `/v/[id]` ; Ta publication dans l'app, réduite à l'essentiel ; Vignette d'un Reel.
- `docs/reseaux.md` — Publier sur Instagram et TikTok : Plus de programmation ; Valider une publication ; Instagram en direct ; Légendes vers Instagram ; Musique d'Instagram et « Je publie moi-même » ; TikTok ; Connexion des comptes mise de côté ; Désautorisation et suppression des données Instagram ; Connexion Instagram ; Plus de messages privés au compte Instagram d'Edith ; Partager sur Instagram depuis le téléphone ; Un carrousel ou un post photo publié par elle-même ; Story avec un lien.
- `docs/resultats.md` — Résultats : Chiffres publics sans connexion ; Chiffres du compte ; « Ce qui marche » ; Résultats d'abord orientés clients.
- `docs/tendances.md` — Tendances.

**Edith et la conversation**

- `docs/edith.md` — Edith, l'assistant : Mascotte et humeurs ; Outils d'Edith, qui se fabriquent et se mettent à jour tout seuls ; Activité ; Relire et retoucher les textes ; Mode d'emploi ; Mémoire de Fauve ; Pas de planning imposé ; Consigne d'Edith courte ; Consigne d'Edith ; Conseiller, jamais obliger.
- `docs/chat.md` — Le chat : Conversations ; Photos et vidéos dans le chat de l'app ; Panneau Fauve ; Boutons et cartes dans le chat ; Chat en direct ; Bulles en direct ; Chat fluide ; Canal ; Zone de dépôt dans le chat.
- `docs/whatsapp.md` — WhatsApp (détails) : Une réponse que WhatsApp refuse ; WhatsApp est l'interface principale sur téléphone.
- `docs/connexion.md` — Connexion : Connexion et liens ; Commencer et se connecter sur ordinateur sans SMS ni modèle Meta.
- `docs/onboarding.md` — Onboarding : Premier Reel ; Étape Style de l'onboarding ; Accueil sur WhatsApp ; Onboarding ; Carte du rythme.

**Le commerce et l'exploitation**

- `docs/abonnement.md` — Abonnement, crédits et marge : Crédits ; Marge ; Crédits toujours en vue ; Abonnement.
- `docs/ia.md` — Modèles d'IA et coûts : Prix des fournisseurs pour `cost_events` ; Coût du chat ; Modèles (chat et montage) ; Réponses des modèles.
- `docs/exploitation.md` — Exploitation : Outils d'admin ; Retours des utilisateurs ; Garde-fou anti-spam ; Freins d'un afflux ; Budgets des fournisseurs ; Montée en charge ; Ateliers éteints dès qu'ils ne servent plus.
- `docs/banc.md` — Banc d'essai du montage : Banc d'essai du montage en prod.
- `docs/legal.md` — Pages légales et RGPD : Pages légales ; Suppression complète d'un studio.
- `docs/landing.md` — Landing et référencement : Landing ; Référencement.
- `docs/ecrans.md` — Écrans de l'app : Pas de calendrier ni de liste de tâches dans l'app ; Réglages en onglets sur ordinateur aussi ; Grille ; Transitions ; Fluidité ; Page Edith : trois raccourcis.
