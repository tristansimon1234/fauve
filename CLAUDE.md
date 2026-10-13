# CLAUDE.md — Fauve, l'agent réseaux sociaux des studios

## Produit en une phrase
Fauve est une community manager IA qui vit **dans WhatsApp**. La gérante d'un studio de Pilates, yoga ou barre envoie ses vidéos, et Fauve les monte, écrit les légendes, programme sur Instagram et TikTok, relance quand il manque un contenu, et fait un bilan chaque semaine. Une petite web app (desktop + mobile) sert à voir le calendrier, valider, déposer des vidéos en pleine qualité et suivre les résultats.

- Prix cible : **49 € / mois**. Pour l'instant on optimise la **qualité et la vitesse**, pas les coûts, mais on **journalise le coût par studio dès le jour 1**.
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
  - `draft_ready` : « Ton {type} pour {jour} est prêt. Je le programme ? »
  - `weekly_report` : « Ton bilan de la semaine est prêt. »
  - `login_code` (catégorie authentification) : code de connexion.
- **Naturel** :
  - marquer comme lu + indicateur « en train d'écrire » dès réception ;
  - **réactions emoji** pour les accusés de réception simples, avec un vocabulaire fixe : 👍 reçu, 🔥 super contenu, ✅ publié. Jamais sur chaque message ; une question appelle toujours une vraie réponse ;
  - Fauve est transparente sur le fait d'être une IA.
- **Médias** : télécharger chaque média reçu vers Supabase Storage. WhatsApp compresse les vidéos : Fauve invite à envoyer les clips **en tant que document**, ou à passer par le lien de dépôt de la web app pour les gros fichiers.

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

Règles de montage : coupes franches (fondu ou léger zoom ponctuels seulement), 7 à 15 s, accroche dès la 1re seconde, sous-titres mot à mot, logo en fin, **zones de sécurité** (pas de texte en bas ni à droite).

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
`get_studio_context`, `get_calendar`, `create_post`, `update_post`, `request_content`, `analyze_clips`, `create_edit_plan`, `update_edit_plan`, `render`, `send_preview`, `schedule_post`, `get_metrics`, `draft_reply` (commentaires/DM), `update_brand_profile`, `react_to_message`.

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

RLS : tout est filtré par `studio_id` via `members`. Le webhook et les jobs passent par la clé service role côté serveur uniquement.

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
- Fond `#FFFFFF`, fond doux `#FBF7F4`, traits `#ECE6EF`
- Texte `#1C1530`, secondaire `#5E5670`
- Violet `#5B3FD9` (actions principales), violet clair `#EFEBFF`
- Corail `#F2694E` (décor), pêche `#FFE9E1` / texte `#9A3412`
- Polices : **Plus Jakarta Sans** (interface), **Instrument Serif italique** (accents : prénom, accroches)
- Boutons en pilule, cartes arrondies 16–22 px, orbe dégradé comme identité de Fauve. Icônes au trait, jamais d'emoji dans l'interface.

---

## Mesure (dès la v1)
- Liens de réservation suivis (UTM) dans la bio et les stories, et un code d'essai propre à Instagram.
- La question « Comment nous avez-vous connus ? » côté studio, si possible.
- Le chiffre roi du produit : **réservations venues des réseaux**, chaque mois, par studio.

## Droits et conformité
- **Droit à l'image** : `media_assets.consent_ok`. Fauve rappelle d'avoir l'accord des élèves filmés, et propose des cadrages sans visage (mains, pieds, machines) ou le floutage.
- RGPD : données hébergées en Europe, suppression complète quand un studio part, contrat de sous-traitance avec chaque studio.
- Musique : aucune musique protégée intégrée au rendu ; son tendance ajouté dans l'appli, ou bibliothèque libre de droits sous licence.

## Hors MVP
Intégration bsport (planning et données élèves), relances aux élèves (bsport le fait déjà), mise à jour du site web, fiche Google, publicité locale (« boost »), offre à 99 €.

## Conventions
- TypeScript strict, Zod sur toutes les entrées (webhook, tools, plan de montage).
- Migrations SQL versionnées dans `supabase/migrations`.
- Secrets en variables d'environnement uniquement : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AYRSHARE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`.
- Avant chaque intégration (WhatsApp, Instagram, TikTok, Ayrshare, Gemini, Supabase Auth), lire la doc à jour : les API changent souvent.

## Dans le repo
- Commandes : `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (à la racine).
- Next.js 16 avec Cache Components : lire `node_modules/next/dist/docs/` avant d'utiliser une API Next ; toute lecture de cookies/session doit être sous `<Suspense>`.
- Les écrans de la web app lisent les vraies données du studio connecté via `apps/web/src/lib/studio.ts` (`getStudioContext`).
- Supabase : projet `fauve` (ref `tfxkhktofgtljlqlksba`, eu-west-3). Les noms des fichiers de migration reprennent les versions appliquées en base.
- Connexion : téléphone + code envoyé sur WhatsApp via le Send SMS hook (`/api/auth/send-sms`). Lien magique et QR ouvrent la session côté serveur via `openSessionForPhone` (le hook capture le code dans `pending_server_logins` au lieu de l'envoyer).
- La maquette décompressée (un HTML par écran) est dans `docs/maquette/ecrans/`.

- Analyse vidéo : `apps/web/src/lib/video/analyze.ts` (Gemini, `GEMINI_MODEL`, un seul passage par clip via `media_assets.analysis_status`) ; outil `analyze_clips`.
- Montage : outil `montage` → tâche de fond `/api/jobs/montage` en deux invocations (design puis rendu + envoi). Le monteur Opus (`apps/web/src/lib/agent/editor.ts`, prompt et normalisation dans `packages/agent/src/editor.ts`, effort high, sortie structurée) écrit le plan ; les scènes libres de motion design sont codées par le motion designer Opus (`apps/web/src/lib/agent/motion-designer.ts`, contrat et contrôles dans `packages/agent/src/motion-scene.ts`), testées dans la sandbox (`apps/render/smoke.mjs`) avec une scène fixe de secours.
- Rendu : gabarits de motion design Remotion `doux` / `dynamique` / `chic` dans `apps/render` (hors workspaces npm ; après modification, `npm run render:pack` régénère `apps/web/src/lib/render/remotion-source.generated.ts`, vérifié en CI). Props calculées par `packages/agent/src/motion.ts`. Exécution dans une Vercel Sandbox persistante `fauve-render` (`apps/web/src/lib/render/sandbox.ts`), avec repli sur le moteur ffmpeg (`packages/agent/src/render.ts`). Outil `render` : la vidéo part sur WhatsApp après la réponse (`afterReply`).
- Instagram en direct (sans agrégateur) : OAuth `/api/instagram/connect` → `/api/instagram/callback`, jetons dans `social_credentials` (aucun accès client), publication des Reels par `/api/cron/publish` appelé toutes les 5 min par pg_cron (secret dans Vault `fauve_cron_secret` = `CRON_SECRET`). Variables : `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`. En mode développement Meta, seuls les comptes « testeurs Instagram » de l'app peuvent se connecter.
- Outils d'admin (clé `FAUVE_TEST_KEY`) : `/api/admin/whatsapp`, `/api/admin/gemini`, `/api/admin/render` (`?action=warm` prépare Remotion, `?post=…&design=1` monte puis rend).
- Conversations : chaque message (WhatsApp ou web) rejoint une ligne de `conversations` via le trigger `assign_conversation` (la dernière active depuis moins de 6 h, sinon une nouvelle). La page Fauve liste les conversations et peut en ouvrir une nouvelle (`started_by = 'web'`) : Fauve n'y voit alors que les messages de cette conversation (`lib/agent/conversation.ts`).
- Bibliothèque de scènes (`motion_templates`, `apps/web/src/lib/agent/motion-templates.ts`) : chaque scène libre réussie y est gardée avec ses « slots » de texte (la scène lit `texts`) ; le monteur réutilise une scène par `template_id` avec de nouveaux textes, sans appel au motion designer. Au plus 2 nouvelles scènes par Reel (`MAX_FREE_SCENES`), les réutilisations ne comptent pas. `studio_id` null = bibliothèque maison partagée.
- Crédits (`packages/agent/src/credits.ts` pour la grille, `apps/web/src/lib/credits.ts`) : registre `credit_ledger` (solde = somme, remonté à `MONTHLY_CREDITS` le 1er du mois par `ensure_monthly_credits`). Avant tout montage, l'outil `quote_montage` crée un devis (`credit_quotes`) que Fauve présente ; `montage` ne part qu'au tour suivant avec le `quote_id`, et le débit réel (scènes vraiment créées, jamais plus que le devis) se fait après la livraison de la vidéo. Admin : `/api/admin/credits?cle=…&studio=…&add=50`.
- « Ce qui marche » (`apps/web/src/lib/performance.ts`, prompt dans `packages/agent/src/performance.ts`) : `ANALYST_MODEL` (Sonnet 5.5) compare les 30 derniers posts Instagram (chiffres, formats, heures, légendes, recette des Reels de Fauve) et écrit leçons + preuves + idées dans `weekly_reports` ; les leçons guident le monteur. Chaque dimanche via `/api/cron/weekly-report` (pg_cron), à la demande via l'outil `analyze_performance` ou le bouton de la page Résultats. Gratuit en crédits.
- Instagram DM (`apps/web/src/lib/instagram-dm.ts`, webhook `/api/instagram/webhook`, champ « messages », secret `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`) : les gérantes écrivent au compte Instagram de Fauve (`platform_accounts`, connecté par `/api/instagram/connect?fauve=1&cle=…`). Le compte se relie au studio par un code à 6 chiffres (Réglages) ; un Reel partagé devient une inspiration lue par Gemini (`lib/video/inspiration.ts`, la vidéo n'est pas gardée) qui guide le monteur ; un texte part dans la même conversation que WhatsApp (canal `instagram`).
- Style (`/style`) : direction artistique, moodboard, couleurs, polices, logo, gabarit, ton. Chaque enregistrement crée une nouvelle version de `brand_profiles` (`apps/web/src/app/(app)/style/profile.ts`). Le moodboard (images dans `media/{studio}/brand/`) est lu une fois par Opus (`apps/web/src/lib/agent/moodboard.ts`) ; le montage ne reçoit que cette lecture. Le CSS de l'app est global (pas de CSS modules) : préfixer les classes.
- Modèles : conversation WhatsApp / web sur `CHAT_MODEL` (Claude Haiku 5.5, effort medium, sans repli serveur : Haiku le refuse) pour le coût ; montage sur `CLAUDE_MODEL` (Claude Opus 5.5 : monteur en effort high, motion designer en effort medium). Les deux dans `packages/agent/src/pricing.ts`.
