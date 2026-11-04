# « Plans fixes de cinéma » (`plans-fixes`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps.

**L'original** : `house/originals/plans-fixes.mp4`, 12,5 s, 720 × 540, 30 i/s, **horizontal 4:3** montré tel quel, l'image pleine (dans un fil vertical, du noir dessus et dessous), avec son. Filmé en 24 i/s (une image sur cinq est doublée). Neuf plans fixes d'une ville (Porto) : il commence au coucher du soleil et finit la nuit. Tout l'original sert au modèle (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : des accords de piano électrique feutré qui ondulent (trémolo lent, 3 à 4 Hz) sur une basse ronde, **sans batterie** (ni grosse caisse, ni caisse claire, ni charleston : rien de bruité au-dessus de 5 kHz après le début). **64,6 BPM** (65 en rond) : un temps toutes les 0,928 s, le premier à 0,47 s, sur « The » ; la musique est déjà lancée à 0 s. Un nouvel accord et sa basse sur chaque temps, joués un peu à la main (jusqu'à 0,1 temps de retard). Au début, un **clic sec** et un nouvel accord sur chaque mot du titre (temps 0 · 0,4 · 1 · 1,6 · 2,5). À la fin, deux notes plus serrées (temps 11,5 et 12), puis elle s'éteint (de −16 à −27 dB) et se coupe avec l'image. Gemini disait lo-fi chillhop, « boîte à rythmes boom-bap », 85 BPM : le genre est proche, la batterie et le tempo sont faux.
**Mesuré avec** : `scripts/fiche/measure.py` (les coupes ; son tempo, 120, est faux ici : la musique n'a que cinq attaques franches, les clics ; ses six « clignotements » sont des choses qui passent), des planches à 30 i/s de chaque plan, des différences d'images pour les mots et ce qui bouge, la corrélation de phase pour la caméra, le spectre et la forme d'onde pour le son, et la lecture de Gemini (`house/breakdowns/plans-fixes.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,47 | −0,5 – 0 | Plan large au coucher du soleil : le fleuve et la ville en contre-jour, le ciel orange ; presque rien ne bouge | **Caméra posée** (tous les plans) |
| 0,47 – 2,77 | 0 – 2,5 | Le même plan. Au centre, sur la partie sombre, le titre arrive mot par mot : « The », « power », « of », puis dessous « Static », « shot » | **Titre en deux niveaux, un clic par mot** |
| 2,77 – 4,17 | 2,5 – 4 | Le titre entier, tenu 1,5 temps | Il part avec la coupe (image 125) |
| 4,17 – 5,17 | 4 – 5,1 | Une rue en contre-plongée vers une église blanche, ciel bleu profond, de tout petits passants en bas | **Une coupe par temps, sur l'accord** (jusqu'à 10,63 s) |
| 5,17 – 6,10 | 5,1 – 6,1 | Des gens assis sur un muret au-dessus du fleuve, à contre-jour doré, filmés de loin | Les têtes bougent (6 % de l'image) |
| 6,10 – 7,00 | 6,1 – 7 | Un café de nuit, de face : sa façade éclairée, ses parasols | Rien ne bouge, rien ne clignote |
| 7,00 – 7,87 | 7 – 8 | Une rue qui descend vers le fleuve, les maisons colorées en face ; une voiture avance, feux allumés, des passants | — |
| 7,87 – 8,83 | 8 – 9 | Une rue au soleil ; un cycliste en rouge traverse tout le cadre au premier plan, de droite à gauche | **Le passage au premier plan** |
| 8,83 – 9,77 | 9 – 10 | Le tablier d'un pont en silhouette au crépuscule, un métro qui glisse dessus | — |
| 9,77 – 10,63 | 10 – 10,9 | Une église à l'heure bleue, sa place, ses kiosques ; rien ne bouge | — |
| 10,63 – 12,50 | 10,9 – 13 | Une rue de nuit en pente et ses lumières ; une silhouette tire sa valise vers le bord gauche | **« Follow for more » se fond au centre** de 11,40 à 12,03 s ; la musique s'éteint |

## Effets (ce qu'on veut savoir refaire)

Rien ne s'allume ni ne clignote dans l'original. Les « clignotements » de la mesure sont des choses qui passent : les feux de la voiture qui avance (7,50 et 7,63 s), le cycliste (8,0 – 8,6 s), une petite lumière entre les jambes et la valise de la silhouette (11,2 – 11,8 s). L'enseigne du café et la croix verte d'une pharmacie (6e plan) restent allumées. Ni zoom, ni poussée, ni transition, ni ralenti, ni bandes dans le cadre : l'effet, c'est l'immobilité.

### 1. La caméra posée, le monde bouge dedans
- **Mesuré** : dans les neuf plans, la caméra ne bouge pas : moins d'un pixel de dérive sur 720 (2 px au plus sur le pont, filmé de très loin), aucun zoom, aucun panoramique. Ce qui bouge : presque rien dans quatre plans (le couchant, l'église au ciel bleu, le café, l'église à l'heure bleue : moins de 1 % de l'image) ; des gens ou une voiture dans trois (6 à 14 %) ; un métro sur le pont ; le cycliste (effet 4). Vitesse réelle, pas de ralenti visible. Beaucoup de longue focale (plans 3, 5, 7 et 9 : filmés de loin, la perspective écrasée).
- **Sur quoi** : ses vidéos filmées le téléphone posé (une table, une étagère, un muret, un pied), 5 à 10 s sans le toucher : sa rue et ses passants, sa devanture, sa salle et ses clients, son comptoir, des mains au travail, la vapeur d'un café, une porte qui s'ouvre, des phares.
- **Outil** : `Footage` tel que filmé (existant). Manquant : **verrouiller un plan tenu à la main** (vid.stab en mode trépied : chaque image recalée sur la première, zoomée juste assez pour cacher les bords). La stabilisation d'aujourd'hui lisse le mouvement sur une demi-seconde (`smoothing=15`), et seulement pour une vidéo qui bouge 30 % du temps (`stabilizeIfShaky`). Manquant aussi, plus petit : le remplisseur ne sait pas si la caméra est posée dans un passage. Gemini le lit pour chaque plan de ses vidéos (`camera` : static, handheld, moving), mais `skillFiles` ne lui donne que leur description, pas leur format non plus.
- **Si rien ne s'y prête** : ses passages les plus calmes, verrouillés. Une photo reste immobile : ni poussée lente, ni relief (Tristan trouve les poussées posées d'office cheap). Et Edith lui demande de poser son téléphone.

### 2. Une coupe par temps, sur l'accord
- **Mesuré** : le premier plan tenu jusqu'au temps 4 (image 125, 4,17 s), puis une coupe sur chaque temps (images 155, 183, 210, 236, 265, 293, 319 : des plans de 26 à 30 images), à 2 images près de la grille. Le dernier plan tenu 2 temps (56 images), jusqu'à la fin. Chaque coupe tombe sur un nouvel accord (une image avant son attaque, en moyenne) ; la basse la plus forte tombe sur la première coupe. Que des coupes franches.
- **Sur quoi** : n'importe quels plans fixes.
- **Outil** : le déroulé du skill sur ses temps (`beatSpans`, existant) et la musique composée au tempo du Reel puis calée sur ses coupes (`alignMusicInSandbox`, existant). Attention : la grille d'une musique se lit sur ses attaques graves (`beatGrid`), et une musique sans batterie se cale mal : sa logique, rejouée en local sur la musique de l'original, trouve 61,5 BPM au lieu de 64,6. Consigne de musique proposée : « mellow electric piano chords with a slow tremolo, a new chord on every beat, a round bass note with a clear attack on every beat, no drums, 65 BPM ».
- **Si rien ne s'y prête** : toujours possible.

### 3. Le titre en deux niveaux, un clic par mot
- **Mesuré** : cinq mots, chacun posé entier en une image (ni fondu, ni glissement, ni grossissement), à sa place finale : les lignes sont composées d'avance, leurs mots révélés un à un. « The » image 14 (0,47 s, temps 0), « power » 26 (0,87 s, temps 0,4), « of » 41 (1,37 s, temps 1), « Static » 59 (1,97 s, temps 1,6), « shot » 83 (2,77 s, temps 2,5). Les écarts : 12, 15, 18 puis 24 images, chaque mot attend un peu plus que le précédent. Chaque mot arrive avec un clic sec, à une image près (0,468 · 0,889 · 1,379 · 1,962 · 2,755 s) : une attaque de 2 ms et une queue de 10 à 20 ms, sur tout le spectre, au centre de la stéréo. Pas clair si c'est un bruitage ajouté ou une coupe dans la musique : ça s'entend comme un clic, avec un nouvel accord. Tout le titre part avec la coupe (image 125).
- **En haut** : « The power of », une sans géométrique demi-grasse (type Poppins), en minuscules, blanc #FFFFFF, les mots très espacés (un blanc d'une hauteur de capitale, trois fois l'espace normal). Boîte x 39,9 – 57,6 %, y 44,1 – 47,6 % ; capitale 2,4 % de la hauteur de l'image (13 px sur 540).
- **En bas** : « Static shot », un serif de titre gras, lettres serrées qui se touchent presque, contraste moyen, une goutte au bout du a et du c (type Times ou Lora en gras ; pas un Cormorant comme le dit Gemini : son œil est bien plus grand, 0,65 de la capitale). Boîte x 32,9 – 64,3 %, y 48,5 – 56,1 % ; capitale 7,4 % de la hauteur (40 px), trois fois celle du haut ; 11 px (2 %) entre les deux lignes.
- **Ensemble** : les deux lignes centrées l'une sur l'autre (à 48,7 % de la largeur), le bloc au milieu de la hauteur, posé sous l'horizon sur la partie sombre du plan (le fleuve et la ville, environ 60 sur 255), pas dans le ciel clair. Un halo sombre serré autour des lettres (−12 niveaux à 4 px, plus rien à 9 px) ; ni bande, ni boîte. À 1080 px de large (l'image en 4:3 fait 1080 × 810) : capitale du serif 60 px (une police d'environ 88 px), celle du haut 19 px (environ 28 px : une petite étiquette, `data-fauve-accent`).
- **Sur quoi** : le milieu de son premier plan, sur une zone calme et plutôt sombre (une rue au loin, un mur, la salle).
- **Outil** : le code du modèle (la v1 le fait déjà mot par mot, aux bons moments à 3 images près). Le clic : son déroulé le pose depuis la v2 (un « light click » sur chaque mot, à l'image où son code le pose, d'après ses mots : `sounds` de sa `timeline`, copiés dans `plan.sounds`, que le moteur place et mixe ; `docs/son.md`, « Bruitages »).
- **Si rien ne s'y prête** : le titre reste au centre, sur la zone la plus calme de son premier plan. Bruitages coupés (`sfx` off) : pas de clic.

### 4. Le passage au premier plan, au milieu
- **Mesuré** : au 6e plan (temps 8 à 9), un cycliste en rouge entre par la droite dès la coupe (image 236) et sort à gauche à l'image 258 (0,77 s), tout près de l'objectif, flou. Jusqu'à 16 % de l'image à la fois, 70 % de l'image traversée ; le plan reste vide ses 6 dernières images. C'est le seul plan qui bouge fort, au milieu du Reel, entre des plans presque immobiles.
- **Sur quoi** : quelqu'un ou quelque chose qui passe tout près de son téléphone posé : un serveur, un client, un vélo, une voiture, un chien.
- **Outil** : le choix du passage par le remplisseur, d'après les moments de la lecture de ses vidéos (`moments` de `skillFiles`, existant).
- **Si rien ne s'y prête** : un plan où des gens bougent, à sa place. Jamais un faux passage.

### 5. La fin : une petite ligne qui se fond, sans voile
- **Mesuré** : le dernier plan, de nuit, tenu 2 temps. « Follow for more » se fond de 11,40 à 12,03 s (images 342 à 361, 19 images, à peu près linéaire), 0,77 s après la coupe, et reste jusqu'à la fin. La sans du haut, grasse, blanche, espacement normal ; boîte x 38,5 – 61,7 %, y 48,0 – 51,3 % (centrée sur le milieu) ; capitale 3,15 % de la hauteur (17 px), 1,3 fois celle de « The power of » ; une ombre à peine (4 px). L'image ne s'assombrit pas : ses parties fixes gardent la même luminosité. Ni logo, ni nom.
- **Sur quoi** : sa phrase de fin (« Suis-nous », son @, « Réserve ta table »), 3 ou 4 mots, sur un plan du soir.
- **Outil** : la carte de fin du skill (`end`, existant), dessinée comme l'original : une seule ligne dans la sans du haut, qui se fond en 19 images, sans voile. À 1080 px de large, elle ferait environ 36 px : sous les 48 px que le contrôle des scènes demande pour un texte à lire. Elle passe donc à 48 px, un tiers plus grande que l'original.
- **Si rien ne s'y prête** : son nom ou son @.

### 6. Étalonnage : chaque plan dans sa lumière
- **Mesuré** : contrasté, noirs profonds (1 à 11 sur 255), couleurs riches. Chaque plan garde la lumière de son heure : le couchant orange (#FED17C à l'horizon), un ciel bleu profond (#005397), le tungstène du café, l'heure bleue (#214A86), la nuit bleu-noir. Ombres souvent froides (bleu-vert, #081112), hautes lumières chaudes. Aucun grain visible (la copie est très compressée : pas clair s'il y en avait), pas de coins sombres mesurables, aucune couleur posée sur tout.
- **Outil** : la finition du modèle (`finish` : contraste et saturation un peu montés ; ni chaleur, ni grain, ni vignettage), existante. Une chaleur posée sur tout, comme celle de la v1, réchaufferait l'heure bleue.

## Format
L'original est une vidéo horizontale 4:3 montrée telle quelle, l'image pleine. Réglage « format », comme dans `frappe` v2 (`setting("format", "auto")`, lu sur `shots[i].aspect`) :
- `auto` : horizontal quand la plupart de ses vidéos le sont, sinon vertical ;
- `horizontal` : 4:3 sur du noir, comme l'original (1080 × 810 au milieu du cadre). Une vidéo 16:9 y perd un huitième de chaque côté, recadrée sur son sujet ; une vidéo verticale y perdrait plus de la moitié de sa hauteur : le remplisseur la garde pour l'autre format ;
- `vertical` : plein écran ; le titre garde sa part de la largeur, au milieu de l'image.

Les places et les tailles des effets 3 et 5 sont des parts de l'image : elles valent dans les deux formats. La cadence 24 i/s (une image sur cinq doublée) est un reste de la conversion en 30 i/s : pas à refaire, à confirmer avec Tristan.

## Ce que Gemini a vu, et ce qu'il a raté
Vu : les neuf plans et leurs coupes (une image plus tôt : il regarde à 15 i/s), les cinq mots et leurs moments, leurs places et leurs tailles à peu près, le blanc et l'ombre douce, des coupes franches partout, la caméra fixe, le format 4:3, l'étalonnage (couchant doré, heure bleue, tungstène), des claviers feutrés et une basse ronde. Raté : le **tempo** (85 au lieu de 64,6) ; une **batterie** qui n'existe pas (« boom-bap », « coupes sur les caisses claires » : elles tombent sur les accords) ; les **clics** sur chaque mot (« aucun bruitage ») ; le **fondu** de « Follow for more » (il le disait posé d'un coup) ; le serif (pas un Cormorant) ; la cadence 24 i/s.

## Ce que le modèle v1 ratait
Juste : 65 BPM, l'ouverture de 4,5 temps, un plan par temps, le dernier tenu 2 temps, les mots aux bons moments (à 3 images près). Raté : tout en vertical plein cadre ; aucun clic sur les mots ; un serif fin et étroit (Instrument Serif, graisse 400) au lieu d'un serif gras et serré ; « en fondu » dans sa fiche de modèle (les mots arrivent nets) ; une fin inventée (un titre serif et des petites capitales sur un voile noir de 24 %) au lieu d'une petite ligne qui se fond sans voile ; une poussée lente sur une photo qui ouvre, et un recadrage zoomé à 1,35 pour une vidéo revue ; « de l'heure dorée à l'heure bleue » demandé à chaque plan (l'original mêle jour, couchant et nuit, et ne va du crépuscule à la nuit que sur ses trois derniers plans) ; une finition chaude avec grain et coins sombres que l'original n'a pas ; une musique « ambient piano » ; rien pour rendre fixe un plan tenu à la main.

## Le modèle v3 (4 novembre)
Réécrit sur cette fiche (`packages/agent/src/skills/plans-fixes.ts`, version 3), rendu en local sur les douze plans horizontaux de la fleuriste (`scripts/skill-render.mts`, aucun appel facturé) :
- **Format** : réglage `format`, `auto` par défaut (4:3 sur du noir, 1080 × 810 au milieu du cadre, quand la plupart de ses fichiers sont horizontaux, lu sur `shots[i].aspect`), `horizontal`, `vertical` (plein écran). Le banc v2 sur la fleuriste était sorti recadré en vertical (Tristan : « C'est pas censé être horizontal ? »).
- **Coupes** : 64,6 BPM, l'ouverture tenue 4,5 temps, un plan par temps, le dernier deux : images 125, 153, 181, 209, 237, 265, 293 et 320, à 2 images au plus de l'original, 12,5 s pour ses neuf plans ; avec une carte de fin, le dernier plan tenu deux temps de plus.
- **Titre** : mots aux temps 0 · 0,44 · 1 · 1,6 · 2,5 (images 14, 26, 42, 59 et 84), chacun posé d'un coup avec son clic sec ; petits mots en sans demi-grasse de 28 px très espacés (étiquette), serif gras et serré de 88 px, centrés, sur la zone la plus calme du milieu de son premier plan (`ClearBox`), sinon au centre.
- **Fin** : sa phrase de fin, sinon son nom, en sans grasse de 48 px au milieu du dernier plan, fondue en 19 images 0,83 temps après la coupe, sans voile ; la musique s'éteint sur le dernier temps (`music.end`).
- **Caméra et lumière** : aucun mouvement (plus de poussée sur une photo, plus de recadrage zoomé d'une vidéo revue) ; sa finition retire la chaleur, le grain et les coins sombres de « Heure dorée » (`finish`).
- **Ce qui manque** : la levée de la musique (son premier temps à 0,47 s ; notre musique composée l'a à 0 s, `alignMusicInSandbox` : nos coupes tombent un demi-temps à côté de ses accords) ; verrouiller un plan tenu à la main ; le format et la caméra de chaque fichier pour le remplisseur (`skillFiles` : une vidéo verticale jouée en 4:3 y perd plus de la moitié de sa hauteur) ; une zone dégagée qui soit aussi sombre (`ClearBox` ne lit pas la lumière) ; au catalogue, sa finition, sa musique (« cinematic ambient piano », que la consigne du compositeur complète de batterie), son tempo (65) et ses polices (Instrument Serif n'a pas de gras : simulé ; Lora 700 et Poppins 600, essayés en local, sont l'original).

## Ce qu'il faut filmer
Le téléphone posé, sans le toucher, 5 à 10 s par plan, à l'horizontale de préférence, souvent de loin avec le zoom (×2, ×3). Un plan large et beau pour ouvrir (sa rue ou sa devanture au coucher du soleil), le milieu de l'image calme ; des plans où quelque chose bouge dans un cadre fixe (des passants, un client qui entre, des mains, de la vapeur, des phares) ; quelqu'un qui passe tout près du téléphone ; son lieu à plusieurs heures (le jour, l'heure dorée, le soir éclairé) ; un dernier plan du soir ou de nuit, calme, avec des lumières.
