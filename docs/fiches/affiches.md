# « Tes produits en affiches » (`affiches`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier coup.

**L'original** : le n° 20 de la vague du 5 novembre (https://www.instagram.com/reel/DfP_kCWopUU/), gardé dans `house/originals/affiches.mp4` : 10,0 s (300 images), 720 × 1280, 30 i/s, **vertical 9:16**, avec son. **Dix plans d'une seconde chacun**, neuf coupes à 1,000 s pile (images 30, 60, 90… 270 ; `measure.py` les trouve toutes, à l'image près). C'est le Reel d'un compte qui vend des « prompts » d'images faites par IA : une ouverture titrée, huit fausses affiches publicitaires « japonaises rétro » (une image par affiche, un aplat de couleur vive, parfois un nom en japonais et en anglais), et un appel à commenter sur du noir. Tout est immobile : d'une image à l'autre, rien ne bouge dans un plan (0,00 à 0,03 niveau d'écart moyen ; seules les pops de mots de l'ouverture changent l'image), pas de zoom, pas de fondu, pas de grain qui scintille.
**Sa musique** : un beat trap minimal, sans voix : charleston serré sur les croches, coups secs sur les temps, et une **basse 808 grave en rythme pointé** (trois croches pointées puis une noire par mesure : doubles croches 0, 3, 6, 9, 12), entière à partir de 3,73 s ; les deux premières mesures n'en ont que quelques coups. **134 BPM** (un temps toutes les 0,4478 s, ajusté sur 14 attaques des aigus à 1,3 ms près en moyenne, sur 11 attaques du médium à 2,5 ms près) ; son premier coup à **0,16 s** (image 5 : le Reel commence par 0,16 s de silence, −56 à −68 dB) ; mesures à 0,16 · 1,95 · 3,74 · 5,54 · 7,33 · 9,12 s. **La basse se tait une demi-mesure** de 5,07 à 5,52 s (−30 à −44 dB entre de petits coups), puis repart sur la mesure 4 (5,54 s). Coupée net par la fin du Reel (10,0 s), sans fondu. −14,2 LUFS. `measure.py` disait 89,25 BPM (sa pulsation, 133,75, écartée parce qu'elle ne tombe pas sur les coupes) ; Gemini « 60 BPM (ou 120 au demi-temps) » : faux.
**Ses coupes ne suivent pas sa musique** : elles sont sur une grille d'une seconde (un modèle de montage à diapositives d'une seconde, comme CapCut en propose), une coupe tous les 2,23 temps, qui glisse contre les temps : le coup le plus proche de chaque coupe tombe de −120 à +155 ms. Le rythme qu'on voit est celui des coupes, une affiche par seconde, pas celui de la musique.
**Mesuré avec** : `scripts/fiche/measure.py`, des planches à 30 i/s de chaque seconde, chaque affiche mesurée en pleine taille (son aplat : la couleur la plus fréquente du bord de l'image ; son tirage : ses traits de papier blanc ; son étiquette : ses lignes d'encre), des gros plans du papier, des lettres et des bords, l'écart d'une image à l'autre dans chaque plan, le son par bandes toutes les 10 ms (basse < 150 Hz, médium, aigus > 4 kHz), une grille de temps ajustée sur ses attaques, son intensité (ebur128), et la lecture de Gemini (`house/breakdowns/affiches.json`).

## Déroulé

Une seconde par plan ; les places en part de la largeur (x) et de la hauteur (y) de l'image.

| De – à (s) | Images | Aplat | Ce qu'on voit | Effets |
|---|---|---|---|---|
| 0 – 1 | 0 – 29 | rouge #FF1E1A | Une **fente** d'image : un bandeau horizontal (x 8,1 – 93,9 %, y 36,3 – 55,5 %, 2,5 fois plus large que haut) qui ne montre que les yeux d'un enfant ; cinq mots noirs qui tombent un à un, **un toutes les 6 images** (0,2 s), collés à ses bords : en haut à gauche (image 0), en haut à droite (6), en bas à gauche (12), en bas à droite (18), puis un cinquième plus bas à droite (24) | 1 |
| 1 – 2 | 30 – 59 | rouge #FC1F10 | Tirage A, au milieu et grand (x 11,2 – 87,5 %, y 15,6 – 78,6 %) : des feuilles, et sous elles son étiquette (une ligne en japonais, une en anglais) | 2, 3 |
| 2 – 3 | 60 – 89 | bleu #0052B9 | Tirage B, un portrait presque carré (0,95) au milieu (x 19,0 – 80,3 %, y 34,1 – 70,3 %) | 2 |
| 3 – 4 | 90 – 119 | orange #FF6127 | Tirage C, en largeur (1,31), bas, **coupé par le bord gauche** de l'image (x 0 – 93,6 %, y 48,4 – 88,6 %) | 2 |
| 4 – 5 | 120 – 149 | rose #FFA7AF | Tirage D, **coupé par le haut** de l'image, vers la droite (x 17,4 – 98,6 %, y 0 – 57,3 %), avec son étiquette | 2, 3 |
| 5 – 6 | 150 – 179 | gris #97989B | Tirage E, un portrait (0,79) au milieu, un peu haut (x 16,2 – 84,3 %, y 23,2 – 71,8 %) | 2 |
| 6 – 7 | 180 – 209 | noir #020204 | Tirage F, bas (x 13,1 – 86,2 %, y 44,3 – 94,8 %), la plus grande étiquette (ses deux caractères font 17 % de la hauteur) | 2, 3 |
| 7 – 8 | 210 – 239 | bleu ciel #2391D6 | Tirage G, un portrait (0,79) bas (x 16,5 – 84,4 %, y 43,8 – 92,2 %) | 2 |
| 8 – 9 | 240 – 269 | jaune #FFC91B | Tirage H, carré (1,0), haut (x 8,3 – 95,3 %, y 3,9 – 52,8 %), avec son étiquette | 2, 3 |
| 9 – 10 | 270 – 299 | noir #000000 | Deux lignes de capitales blanches condensées au milieu (x 21 – 74 %, y 45,3 – 54,8 %), un mot en gras italique entre guillemets | 4 |

Coupes sèches, rien ne bouge dans un plan : ni zoom, ni poussée, ni fondu, ni flash.

## Effets (ce qu'on veut savoir refaire)

### 1. Son titre qui tombe mot à mot autour d'une fente d'image
- **Mesuré** : sur l'aplat rouge, un bandeau d'image de 85,7 % de la largeur sur 19,2 % de la hauteur (x 8,1 – 93,9 %, y 36,3 – 55,5 %), centré, sans bord ni ombre, posé dès l'image 0 : il ne montre qu'une bande du visage d'un enfant, ses yeux et le haut de ses joues. Autour, cinq mots en capitales grotesques grasses et serrées, noirs (#0D0202), d'une même taille (capitales de 4,7 à 4,8 % de la hauteur), **collés aux bords du bandeau** : les deux du haut à 8 px (0,6 %) au-dessus de lui, le premier calé sur son bord gauche (x 7,8 – 49,4 %), le second sur son bord droit (67,2 – 94,2 %) ; les deux du bas à 11 px dessous, à gauche (7,5 – 31,7 %) et à droite (81,7 – 93,3 %) ; le cinquième encore 2,7 capitales plus bas, à droite (53,5 – 93,6 %, y 69,1 – 73,8 %). Ils tombent d'un coup, un toutes les **6 images** (0, 6, 12, 18, 24 : un cinquième de seconde, ni sur les temps ni sur les croches de la musique), sans fondu ni glissé, et restent jusqu'à la coupe. Le titre complet ne se lit que 0,2 s : on le lit en même temps qu'il tombe, mot à mot.
- **Sur quoi** : n'importe quel commerce : son titre en deux à cinq mots (ce qu'elle présente), et dans la fente un gros plan de ses images : un regard (les yeux de quelqu'un de l'équipe), un détail de son produit, une matière (de la farine, un tissu, des pétales). Sans gros plan, n'importe lequel de ses plans : seule sa bande du milieu se voit.
- **Outil** : code du modèle (`Footage` dans le bandeau, `FitText` pour chaque mot dans sa case, existants).
- **Ses mots, ceux de l'original** (« Japanese retro print ad prompts ») : à l'original, jamais recopiés.

### 2. Une affiche par seconde : un aplat de couleur, une seule image dans un tirage à bord blanc, chaque fois ailleurs
- **Mesuré** : huit affiches, chacune une seconde, chacune sur son aplat plein cadre : rouge #FC1F10 (le même que l'ouverture : la coupe garde le fond), bleu roi #0052B9, orange #FF6127, rose #FFA7AF, gris #97989B, noir #020204, bleu ciel #2391D6, jaune #FFC91B. Sur chaque aplat, **une seule image dans un tirage** : un bord de papier blanc (#F4F0EC à #F7F2F5) de 1,5 à 3 % de la largeur, plus épais en bas sur un portrait, plat (ni ombre, ni pente, ni coins arrondis). Chaque tirage a sa place et sa taille, de 22 à 48 % de l'aire de l'image : au milieu (A, B, E), bas (C, F, G), haut (D, H) ; **deux sortent du cadre** (C par le bord gauche, D par le haut), comme une page de magazine. Ses formes : un portrait (0,79 – 0,8), un presque carré (0,95 – 1,0), une largeur (1,31). Les images des tirages ont l'air imprimées : franches, un peu contrastées, sur le grain du papier.
- **Sur quoi** : ses produits, ses plats, ses créations, ses services, quelqu'un de l'équipe : une image par affiche, un sujet seul et bien en vue au milieu, sur un fond calme (le tirage le montre en entier, plus petit que l'écran). Ses vidéos jouent dans le tirage (une main qui pose, de la vapeur, un geste lent) ; ses photos restent fixes.
- **Outil** : code du modèle (`Paper` pour l'aplat et son grain, `Footage` dans le tirage, cadré sur son sujet, existants).
- **Si rien ne s'y prête** : n'importe lequel de ses plans, un détail de son lieu : le tirage cadre son milieu.

### 3. Son nom en très grand sur le papier du tirage
- **Mesuré** : quatre tirages sur huit (A, D, F, H : le premier, le dernier, et un sur deux entre eux depuis la fin) ont sous leur image une bande de papier (31 à 62 % de la hauteur du tirage) avec deux lignes noires (#110C0D) : en haut, le nom en japonais, très grand, sur **92 à 96 % de la largeur du tirage** (de 8,6 à 17 % de la hauteur de l'image) ; dessous, le même mot en anglais, en capitales grotesques très grasses, plus petit (3,4 à 7 % de la hauteur), centré. Le nom dit ce que montre l'image (« Autumn » sous des feuilles).
- **Sur quoi** : le nom de ce qu'elle montre (« Croissant », « Balayage », « Bouquet de mai »), en un ou deux mots.
- **Outil** : code du modèle (`FitText` dans la bande de papier, existant). Ses mots sont lus : dans la zone sûre (48 px au moins, au-dessus du dernier quart, entre x 140 et 940 sous le milieu), le tirage remonte s'il le faut.
- **Ses deux écritures**, le japonais au-dessus de l'anglais, sont le thème de l'original (« japonais rétro ») : à l'original, jamais recopiées. Le modèle garde une ligne, son nom à elle, qui remplit le papier.

### 4. Son appel sur le noir
- **Mesuré** : une seconde de noir pur (#000000), deux lignes de capitales grotesques condensées blanches (#F7F7F7), légères, de 3,9 % de la hauteur, centrées (x 21 – 74 %, y 45,3 – 54,8 %), un mot en gras italique entre guillemets. La musique continue dessous jusqu'à la fin.
- **Sur quoi** : son appel à elle (« Viens les goûter », « Réserve ta place »), un mot à retenir en gras italique ; ou son nom.
- **Outil** : code du modèle (`FitText`, existant).
- **Ses mots** (un appel à commenter pour recevoir des prompts, l'appât de son compte) : à l'original, jamais recopiés.

### 5. Le papier
- **Mesuré** : chaque aplat a la texture fixe d'une feuille de couleur scannée (des fibres en traînées, un peu de transparence d'une page imprimée : 7 à 12 niveaux d'écart sur l'orange), la même à chaque image : rien ne scintille.
- **Outil** : `Paper` (grain fixe, existant).

## Format
L'original est vertical 9:16, et c'est une mise en page : les tirages sont posés sur des aplats, jamais en plein cadre. Le modèle reste vertical ; ce qui suit ses vidéos, c'est la forme de chaque tirage (réglage « format ») :
- `auto` (par défaut) : comme ses fichiers : un tirage en portrait (4:5) pour une vidéo verticale, en largeur (4:3) pour une horizontale, carré pour une photo carrée ; les deux places carrées de l'original (B, H) restent carrées ;
- `vertical` : tous les tirages en portrait ;
- `horizontal` : tous en largeur (ses vidéos verticales y sont recadrées sur leur sujet).

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, dix plans d'une seconde, les coupes à chaque seconde, les aplats et leurs couleurs à peu près, les tirages à bord blanc, les quatre étiquettes en deux écritures, les mots de l'ouverture un toutes les 0,2 s (juste : images 0, 6, 12, 18, 24) et leurs places (à 0,5 % près), l'appel sur le noir et son mot en italique, la texture de papier.
**Raté** : le **tempo** (60 ou 120 au lieu de 134) et ce qu'il en déduit, « changement visuel strict à chaque battement » : les coupes ne suivent pas la musique, elles glissent contre elle ; la **demi-mesure sans basse** (5,07 – 5,52 s) ; les **deux tirages qui sortent du cadre** (« centré horizontalement » partout, pour lui) ; les places hautes et basses des tirages ; « images internes désaturées » : elles ont leurs couleurs (les feuilles rouge vif, le jean bleu), seulement franches et imprimées ; le silence des 0,16 premières secondes.

## Ce qu'il faut filmer
Cinq à douze photos ou courtes vidéos (2 à 3 s suffisent) de ce qu'elle veut montrer, **une chose par image** : un produit, un plat, une création, un service, quelqu'un de l'équipe, seul et bien en vue au milieu, sur un fond calme et bien éclairé (le tirage le montre en entier). Le téléphone posé ou tenu sans bouger. En vertical ou en horizontal : chaque tirage prend la forme de son image. Pour l'ouverture, un gros plan qui tient dans une fente horizontale : un regard, un détail, une matière. Et le nom de chaque chose montrée, son titre en deux à cinq mots, son appel de fin.

## Le modèle v1 (6 novembre)
`skills/affiches.ts`, version 1, dans la bibliothèque (à valider sur /admin). Ses temps en temps d'une grille à **120 BPM, deux temps par affiche** : chaque coupe tombe pile sur celle de l'original (1,000 s), et la musique, composée à 120, a ses temps sur les coupes (celle de l'original, à 134, glissait contre elles).
- **L'ouverture** (2 temps) : son premier plan dans une fente de 800 × 368 px (x 13 – 87 %, y 33,9 – 53,1 %, sur l'aplat rouge), les mots de son titre qui tombent un à un, un tous les 0,4 temps (6 images), collés à ses bords comme l'original (en haut à gauche, en haut à droite, en bas à gauche, en bas à droite, le cinquième plus bas) ; deux mots : en haut à gauche et en bas à droite ; trois : les deux du haut et celui du bas à gauche. La fente est un peu plus étroite que l'original (74 % de la largeur au lieu de 86 %) pour que les mots du bas restent entre x 140 et 940.
- **Ses affiches** (2 temps chacune, de 4 à 11 ; jusqu'à 27 pour une durée qu'elle demande) : les huit aplats de l'original dans son ordre (réglage « couleurs » : `vives`, sa charte en alternance, ou `noir`), sur chacun son plan dans un tirage à bord blanc posé à l'une des huit places de l'original, dans son ordre (deux sortent du cadre, à gauche et en haut), à la forme de son fichier (réglage « format ») ; son nom en très grand sur le papier sous l'image du premier tirage, du dernier, et d'un sur deux entre eux depuis la fin, comme l'original (réglage « etiquettes » : `une-sur-deux` ou `toutes`), d'une ligne, ou deux pour un nom de deux mots ; un tirage étiqueté remonte assez pour que son nom reste au-dessus du dernier quart de l'image et entre x 140 et 940 sous le milieu.
- **La fin** (4 temps, 2 s) : son appel sur le noir en deux lignes de capitales blanches, un mot entre « » en gras italique (sans appel, son nom) ; sa carte de fin, quand le Reel en a une, à la même place, son logo au-dessus. Plus longue que l'original (1 s) pour se lire.
- **Le son** : la musique composée à son tempo, son premier temps sur la première image, coupée net à la fin ; aucun bruitage (l'original n'en a pas).
- **Ses mots** : son titre (`titre`, obligatoire), le nom de chaque affiche dans l'ordre de ses cases, séparés par « / » (`noms`), son appel (`fin`). Police : la paire « affiche » (Anton pour le titre et les noms, Inter Tight pour l'appel), la sienne quand c'est Edith qui choisit le modèle.
- **Ce qui manque** : rien dans le moteur ; la demi-mesure sans basse de l'original n'est pas refaite (elle ne tombe sur rien de ce qu'on voit).
