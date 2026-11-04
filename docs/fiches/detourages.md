# « Détourages qui surgissent » (`detourages`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps fort, le drop à 6,22 s. L'intro (0 – 6,22 s, 14,5 temps) n'a pas de batterie : ses moments sont en secondes.

**L'original** : `house/originals/detourages.mp4`, 16,47 s (494 images), 720 × 608, 30 i/s, **presque carré, un peu plus large que haut (1,18:1)**, coins arrondis sur du noir, avec son. Le Reel entier (aucun passage dans `HOUSE_PASSAGES`). Monté à 25 i/s : la copie double une image sur six (les numéros d'image ci-dessous sont ceux de la copie). C'est un montage de voyage en Islande, la référence « ICELAND » que Tristan avait envoyée avec « détourage aussi pour faire des collages sophistiqués ? » (`docs/detourage.md`). **Aucun objet détouré n'y surgit** : le seul détourage est le décor posé devant le titre.
**Sa musique** : un morceau indie-électro à **140 BPM** (mesuré 140,3 : six mesures de 1,711 s de suite ; un temps toutes les 0,428 s). L'atelier disait 94 et Gemini 120 : faux. 94, c'est le rythme pointé des coupes (0,32 s) pris pour des croches ; à 94, les coupes sortent de la grille dès la deuxième mesure. Sûr. Intro sans batterie : ses aigus s'ouvrent de 0 à 3 s, de petits coups aigus de 3,6 à 4,8 s (sous les lettres), un creux de 0,3 s à 5,4 s, puis le drop à 6,22 s. Plus forte dès 9,0 s. La basse s'arrête de 15,0 à 15,8 s, sur le dernier plan, et repart à 16,1 s ; la vidéo finit sur la mesure suivante (16,47 s).
**Mesuré avec** : `scripts/fiche/measure.py` (coupes, clignotements, tempo), une analyse du son par bandes (grille du beat, coups de l'intro), des mesures sur les pixels en pleine taille (la fente image par image, l'opacité de chaque lettre, les coins, l'étalonnage), des planches à 30 i/s de tout le Reel, et la lecture de Gemini (`house/breakdowns/detourages.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,03 | intro | Noir (1 image) | — |
| 0,03 – 4,17 | intro | Plan fixe large : une colline sombre, une cabane au sommet, un ciel vert sauge. Une personne marche vers la cabane et s'arrête à côté (vers 2,9 s) | **Fenêtre qui s'ouvre** : une fente verticale au centre, pleine hauteur, qui s'élargit jusqu'à toute la largeur (images 1 à 125) |
| 3,60 – 4,83 | intro | Le même plan, immobile | **Nom qui clignote lettre par lettre** : « ICELAND » en grand, D, C, L, E, I, N, A (images 108 à 145) |
| 4,83 – 6,23 | intro | Le titre entier, tenu 1,4 s | **Titre derrière le décor** : la crête, la cabane et la personne devant lui. Il part avec la coupe, sans s'effacer |
| 6,23 – 9,67 | 0 – 8 | **Drop.** Rafale de 9 plans : un homme qui danse devant une cascade, des aiguilles de roche dans la mer, une main dans le sable noir, de la glace sur une plage, un homme qui sourit, une épave d'avion, le nom « HÚSAVÍK » peint sur une coque, des galets, un homme qui lève les bras | **Rafale** en coupes franches sur le rythme pointé : ¾ de temps (0,32 s) le plus souvent |
| 9,67 – 10,00 | 8 – 8¾ | Un sol de galets qui file, très flou | **Plan filé** (10 images) |
| 10,00 – 13,13 | 8¾ – 16¼ | 7 plans : l'écume sur un galet, un homme qui lève un appareil photo, un vol au ras de l'herbe vers le soleil, une route vue d'un drone, une cascade, un homme qui danse sur un tronc au coucher du soleil, un homme qui filme en Super 8 | Coupes franches, ¾ à 1½ temps |
| 13,13 – 13,47 | 16¼ – 17 | De l'eau qui file de côté | **Plan filé** (10 images) |
| 13,47 – 14,83 | 17 – 20 | 3 plans vus d'en haut : une rivière glaciaire, des falaises et leurs oiseaux, des crevasses | — |
| 14,83 – 16,47 | 20 – 24 | **Dernier plan, tenu** : quelqu'un de dos devant un vieil avion, les bras levés comme des ailes | La basse s'arrête puis repart ; coupe nette à la fin : la vidéo reboucle sur la fente noire |
| 0 – 16,47 | tout | — | **Cadre aux coins arrondis** sur du noir, tout du long |

## Effets (ce qu'on veut savoir refaire)

### 1. La fenêtre qui s'ouvre
- **Mesuré** : noir 1 image, puis une fente verticale au centre, sur toute la hauteur, aux bouts ronds (une pilule tant qu'elle fait moins de 46 px). Elle s'élargit à **vitesse constante**, sans ralentir : 7 px par image d'origine, de 1 % de la largeur (image 1, 0,03 s) à toute la largeur (image 125, 4,17 s), soit un quart de la largeur par seconde. Ses coins gardent ensuite un rayon d'environ 22 px. Sous elle, le plan fixe ; elle découvre la personne qui marche. La musique s'ouvre avec elle (ses aigus montent de 0 à 3 s). Lente : à 1 s, la fente ne fait que 24 % de la largeur.
- **Sur quoi** : son plan d'ouverture, fixe et large (sa rue, sa façade, son lieu vide le matin).
- **Outil** : `Window` (existant) avec `radius`, mais son `reveal="grow"` s'ouvre aussi en hauteur et ralentit à la fin. Manque : `reveal="slit"` (pleine hauteur, la largeur seule, à vitesse constante). Sinon trois lignes du code du modèle (un `clipPath` animé).
- **Si rien ne s'y prête** : toujours faisable, sur son premier plan.

### 2. Le nom qui clignote lettre par lettre
- **Mesuré** : chaque lettre fait un **flash** à environ 60 % (2 à 4 images), **s'éteint** 2 à 4 images (un fantôme de 8 % au plus), puis **s'allume pour de bon**. Flash : D 108–111, C 116–119, L 124–125, E 128–131, I 133–135, N 137–138, A 140–142. Noir : D 112–115, C 120–123, L 126–129, E 132–133, I 136–138, N 139–141, A 143–144. Allumée : D 116, C 124, L 130, E 134, I 139, N 142, A 145. Dans le désordre, et ça accélère : un nouveau flash toutes les 8, 8, 4, 5, 4 et 3 images. 7 lettres en 1,23 s (3,60 à 4,83 s). C, E, I, N, A et le titre entier tombent chacun à une image près d'un petit coup aigu de la musique ; D et L une à deux images avant le leur.
- **Le dessin** : capitales très grasses d'une grotesque ronde et large (genre Montserrat ExtraBold : le fût du I fait un quart de la hauteur des capitales). Blanc (#EFECEE après l'étalonnage), sans contour ni ombre. Le mot couvre 87,6 % de la largeur (de 6,2 % à 93,8 %, centré). Le haut des capitales à 42,6 % de la hauteur, leur pied à 59,4 % : des capitales de 16,8 % de la hauteur (14,2 % de la largeur). Interlettrage normal (13 à 21 px entre deux lettres pour 102 px de capitales).
- **Sur quoi** : son nom, sa rue, son quartier ou un mot de sa demande (4 à 10 lettres), posé dans le ciel ou sur un mur dégagé de son plan d'ouverture.
- **Outil** : `Reveal by="letter" from="flicker"` (existant : lettres dans le désordre qui clignotent avant de tenir ; sa note « a title of a travel film: 7 letters in 1.1 s » vient sans doute de cette référence, mesurée ici en 1,23 s). À régler : aujourd'hui, chaque lettre est allumée ou éteinte au hasard toutes les deux images, à écart fixe. Manque : le motif mesuré (un flash à 60 %, un noir, puis tenue) et des lettres posées sur des images données (les coups de sa musique) plutôt qu'à écart fixe.
- **Si rien ne s'y prête** : toujours faisable ; son nom par défaut.

### 3. Le titre derrière le décor
- **Mesuré** : le pied du mot passe sous la crête. La colline cache le bas du L (son pied en entier) et du A, la cabane (47,6 à 52,2 % de la largeur) cache la jambe gauche du A, la personne est debout devant le L. Environ un huitième du mot est caché, seulement au milieu : à gauche et à droite, la colline descend sous les lettres. La caméra ne bouge pas (la cabane reste au même pixel de l'image 30 à 186) : le titre reste en place sur le décor.
- **Sur quoi** : ce qui se détache sur le ciel ou un mur au premier plan de son plan fixe : le toit ou la devanture de son lieu, son comptoir, une table, quelqu'un debout.
- **Outil** : `Subject shot={0}` posé après le titre (existant : son plan détouré, lu une seule fois quand rien ne bouge, « une colline, une façade »). `Subject object="…"` (existant) pour un objet nommé (« shop front »). Derrière quelqu'un, le contrôle des scènes renvoie un mot caché à plus de 40 % (`FAUVE_HIDDEN`) : ici, un huitième seulement.
- **Si rien ne s'y prête** (rien devant, ou un plan qui bouge) : le titre devant, sans détourage ; l'effet 2 reste.

### 4. La rafale sur le rythme de la chanson
- **Mesuré** : 21 plans en 8,6 s (6,23 à 14,83 s, temps 0 à 20), quatre à cinq par mesure. 12 font ¾ de temps (0,32 s, environ 10 images), 6 un temps (0,43 s), 3 un temps et demi à 1¾ (0,64 à 0,75 s). Les coupes suivent le rythme pointé de la chanson (trois doubles croches), pas chaque temps ; chacune tombe à deux images près de son coup, le plus souvent juste après (15 à 65 ms). Coupes franches : aucun zoom en transition, aucune poussée posée. Les plans alternent gens (6 : quelqu'un qui danse, sourit, lève les bras, prend une photo, filme), matières et détails (7 : une main dans le sable, des galets, de la glace, l'écume, un nom peint, une cascade de près, des crevasses), paysages larges ou vus d'en haut (6) et les 2 plans filés, rarement deux du même genre de suite. Presque tous bougent (caméra à la main, drone).
- **Sur quoi** : ses plans courts : son équipe et ses clients qui font un geste, ses mains et ses matières de près (farine, café, tissu, ses produits), son nom écrit quelque part (vitrine, tablier, enseigne), sa rue ou son lieu de haut.
- **Outil** : les cases du skill sur la grille (existant, `beatSpans`), en ¾, 1, 1½ et 1¾ temps à 140 BPM ; plusieurs passages d'une même vidéo quand elle en a peu (existant, `skillPassages`).
- **Si rien ne s'y prête** : moins de plans, plus longs (1 temps), toujours coupés sur les coups.

### 5. Deux plans filés
- **Mesuré** : 9,67 – 10,00 s (images 290 à 299) : un sol de galets qui file vers le haut, très flou. 13,13 – 13,47 s (images 394 à 403) : de l'eau qui file de côté. 10 images chacun, filmés (un vrai mouvement de caméra très rapide), pas un effet. Pas de bruit de souffle mesurable : on entend le beat.
- **Sur quoi** : son téléphone balayé très vite sur son sol, son comptoir, sa rue.
- **Outil** : son plan s'il y en a un ; sinon `Whip` (existant : coup de fouet, flou de bougé, 8 images) entre deux plans.
- **Si rien ne s'y prête** : une coupe franche.

### 6. Le cadre aux coins arrondis
- **Mesuré** : tout le Reel, l'image dans un rectangle aux coins arrondis (rayon d'environ 22 px, 3 % de la largeur), un filet noir de 2 px sur les côtés, noir dans les coins. Les bouts de la fente ont le même rond.
- **Outil** : code du modèle (un `borderRadius` sur ses plans, ou `Window radius` ouvert).

### 7. Le dernier plan tenu, en boucle
- **Mesuré** : 14,83 – 16,47 s (49 images, 4 temps) : quelqu'un de dos devant un vieil avion, les bras levés comme des ailes, caméra fixe. Pas de texte, pas de logo, pas de fondu : la vidéo coupe net sur la mesure suivante et reboucle sur la fente noire.
- **Sur quoi** : quelqu'un de dos devant son lieu, un geste large (bras levés, un salut), tenu.
- **Outil** : la dernière case du skill (existant). Une carte de fin, si elle en veut une, se pose sur ce plan (existant).
- **Si rien ne s'y prête** : son plan le plus large et le plus calme, tenu.

### 8. Étalonnage
Film doux : blancs tenus sous 225 sur 255 (jamais de blanc pur), hautes lumières crème (≈ #D1CFC3), tons moyens un peu olive (≈ #7C7A6E), noirs à peine levés, saturation moyenne. L'ouverture en vert sauge (ciel ≈ #B5C2B5) sur une colline presque noire. Pas de vignettage mesurable. Grain : pas mesurable sur la copie, trop compressée. Outil : la finition du modèle (`finish` : `fade` léger, hautes lumières crème par `highlights` et `split`, saturation un peu baissée), pas « Ville chaude ».

## Format
L'original est une image presque carrée, un peu plus large que haute (1,18:1), aux coins arrondis sur du noir : dans un fil vertical, des bandes noires dessus et dessous. Réglage « format » : `auto` (vertical plein écran quand la plupart de ses vidéos sont verticales, la fenêtre sinon), `fenêtre` (1,18:1 aux coins arrondis sur du noir, comme l'original, ses vidéos recadrées sur leur sujet), `vertical` (plein écran 9:16, coins arrondis et fente gardés, chaque place en part de l'image).

## Ce que Gemini a vu, et ce qu'il a raté
Vu : le découpage (à une ou deux images près), la fente qui s'ouvre, « ICELAND » derrière la crête et sa place (largeur 88 %, haut à 42 %, capitales de 16 % : juste), le cadre arrondi, les deux plans filés, le drop, les verts et les couchers de soleil dorés. Raté : le **tempo** (120 au lieu de 140), le **clignotement** de chaque lettre (un flash, un noir, puis tenue : il dit « apparition ») et leur ordre (D, C, L, E, I, N, A, pas « de l'extérieur vers le centre »), les lettres calées sur les coups aigus, la cabane et la personne devant le titre, la durée de l'ouverture (4,1 s, pas 2,5), le format (1,18:1, pas 4:5), le drop (6,22 s, pas 6,13), la basse qui s'arrête sur le dernier plan et la boucle. Son grain 16 mm, son vignettage et sa voix chantée en anglais ne se vérifient pas à la mesure.

## Ce que le modèle v1 ratait
Il ne décrivait pas cet original : des objets détourés au bord blanc de ciseau qui surgissent toutes les deux secondes sur des plans de rue, un mot au feutre à côté, un titre au feutre, une carte de fin. Rien de tout ça n'y est. Il jouait en vertical plein cadre, à 94 BPM, coupé sur le temps et le demi-temps, en « Ville chaude », sans fente, sans nom qui clignote, sans décor devant le titre, sans cadre arrondi ni plans filés, et il demandait 3 à 6 photos d'objets sur fond simple. Son brouillon de skill disait que l'ouverture était « celle d'un autre modèle » : non, c'est la sienne (l'original de « Titre derrière toi » est un autre Reel, à Los Angeles, son cousin). Son nom, sa phrase, ce qu'il demande et son « pour » sont à revoir avec Tristan.

## Ce qu'il faut filmer
Un plan large et fixe de son lieu (téléphone posé, 6 s au moins), avec du ciel ou un mur dégagé au-dessus de ce qui sera devant le titre (son toit, sa devanture, son comptoir), et quelqu'un qui y entre et s'arrête ; 10 à 20 plans courts qui bougent : des gens qui font un geste (rire, lever les bras, danser, servir), des mains et des matières de près, son nom écrit quelque part, sa rue ou son lieu vus d'en haut ; un ou deux balayages très rapides du téléphone (le sol, le comptoir) ; pour finir, quelqu'un de dos devant son lieu, les bras levés, tenu deux secondes.
