# « Coulisses façon fiche » (`coulisses`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original, ses images (30 i/s) entre parenthèses. Il n'a pas de musique, donc pas de temps à compter : chaque moment est calé sur un bruitage.

**L'original** : `house/originals/coulisses.mp4`, 10,52 s, 720 × 1280, 30 i/s, **vertical 9:16**, avec son, pris en entier (pas de passage). C'est le « sound effects breakdown » d'un créateur : l'intro de son vlog (« 24 hours in Vancouver »), une vidéo **horizontale 16:9** montrée dans une carte, avec dessous le nom de chaque bruitage au moment où on l'entend, puis la timeline de son montage. Monté à 24 i/s (le timecode compte 24 images par seconde ; à 30 i/s, une image sur cinq est doublée).
**Sa musique** : **aucune**. Rien que des bruitages (whooshes, déclics d'appareil photo, clics, bips d'ordinateur, un cliquet), séparés par des silences complets (sous −80 dBFS). Pas de temps régulier : les 95,5 BPM de l'outil viennent des bips réguliers du « data processing » ; les 85 BPM de Gemini (« beat lo-fi, claviers feutrés, boîte à rythmes ») sont inventés. −15,9 LUFS ; les whooshes montent à −1,6 dBFS, les clics restent vers −18.
**Mesuré avec** : `scripts/fiche/measure.py` (format et son ; la carte est trop petite pour ses coupes : sur 27, il ne voit que les flashs, et ses 16 « clignotements » sont des coupes et des cases dans la carte), des planches à 30 i/s de toute la carte, des gros plans (titre, pops, fenêtres, détourages, timeline), la carte coupée en 5 × 3 cases comparées une à une au plan suivant, les couleurs lues sur les pixels, le spectrogramme et les attaques du son toutes les 5 ms, et la lecture de Gemini (`house/breakdowns/coulisses.json`).

## Déroulé

| De – à (s) | Son (l'étiquette) | Ce qu'on voit dans la carte | Effets |
|---|---|---|---|
| 0 – 0,27 | **WHOOSH** (0,08 – 0,29, le plus fort à 0,15) | Une ville de nuit vue d'en haut, fixe | Les petits mots « 24 HOURS IN » **tombent** à leur place en 2 images (4, 5) |
| 0,27 – 0,60 | **SHUTTER CLICKS** : 8 déclics, un par image | Le même plan | « VANCOUVER, CA » **clignote** en s'allumant (9 à 16) |
| 0,60 – 1,10 | **CLICK x 3** (0,61 · 0,78 · 0,90) | Le même plan | **Trois pops**, un par clic : « SHOT ON » (18), le logo DJI (23), « OSMO POCKET 3 » (26 à 28) |
| 1,10 – 1,60 | **WHOOSH x 2** (le plus fort à 1,15 et 1,49) | L'intérieur d'une voiture de nuit (35), puis un bâtiment de verre de jour (45) | Deux coupes franches, chacune sur le plus fort de son whoosh |
| 1,60 – 2,33 | **DATA PROCESSING** : un bip toutes les 2 ou 3 images | Le bâtiment de verre | **Chargement** : une case du plan suivant fait le tour de la carte (dès 45) |
| 2,33 – 2,67 | **WHOOSH** (le plus fort à 2,48) | Une rue (75) | La case continue par-dessus la coupe |
| 2,67 – 3,50 | **DATA PROCESSING** | La rue, puis la ville de nuit (100) | Quatre cases au hasard, trois blocs (93, 95, 98), puis le plan suivant remplit la carte (100) |
| 3,50 – 4,00 | **RATCHET** : 7 crans (3,57 – 3,91) | **Rafale** de 6 plans de 1 à 3 images (108 à 117), puis le bâtiment de verre (118) | Un plan par cran |
| 4,00 – 4,33 | **MOUSE CLICK** : un double clic (4,13 · 4,16) | Un café et son sapin doré (125) | Coupe sur le 2e clic |
| 4,33 – 5,13 | **WHOOSH x 2** (le plus fort à 4,40 et 4,86) | Un comptoir (135), puis une table vue d'en haut (148) | Les deux pâtisseries de la table, **détourées**, arrivent sur le comptoir 5 images avant la coupe (143 à 147), à leur place dans le plan suivant |
| 5,13 – 5,30 | silence | La table | L'étiquette s'efface |
| 5,30 – 6,37 | **DATA PROCESSING** (5,39 – 6,24) | Un selfie au fisheye dans le café (160), puis une boutique au fisheye (188) | **Chargement**, de droite à gauche, puis de plus en plus de cases à la fois |
| 6,37 – 7,30 | **SHUTTER x 3** (6,47 · 6,77 · 7,07) | Une friperie (198), une table basse et ses magazines (206), une boutique (215) | **Un flash blanc** sur chaque coupe (196-197, 205, 214) |
| 7,30 – 8,10 | **WHOOSH x 2** (le plus fort à 7,44 et 7,90) | Une boutique claire (226), puis une main qui tient une boîte (239) | La main et la boîte, détourées, arrivent 5 images avant la coupe (234 à 238), à leur place |
| 8,10 – 8,50 | **SHUTTER CLICKS** : 6 déclics (8,20 – 8,37) | La boîte, puis un panneau sur le trottoir | **La coupe bégaie** : 6 images qui alternent les deux plans (246 à 251) |
| 8,50 – 9,00 | silence | Deux coupes muettes : une friperie (258), un comptoir de café (265) | L'étiquette s'efface |
| 9,00 – 9,43 | **SHUTTER CLICKS** (9,07 – 9,25) | Le comptoir, puis une patinoire | La coupe bégaie (273 à 278) |
| 9,43 – 9,67 | silence | Coupe muette sur une chorale et des lumières de Noël (285) | L'étiquette s'efface |
| 9,67 – 10,52 | **SHUTTER CLICKS** (9,74 – 9,92), puis silence | La chorale, puis une ville de nuit vue d'en haut, tenue jusqu'au bout | La coupe bégaie (293 à 298) ; l'étiquette reste ; la fin ressemble au début (une boucle) |

Autour de la carte, rien ne bouge : le fond, le titre et la timeline sont là de la 1re image à la dernière, sans entrée ni sortie. Seuls changent l'étiquette, la tête de lecture et le timecode.

## Effets (ce qu'on veut savoir refaire)

### 1. Sa vidéo dans une fiche technique
- **Mesuré** :
  - Fond bleu électrique uni #14017A, quadrillé de traits violet clair ≈ #432DA9 (1,5 px à 720, donc 2 px à 1080), cases carrées de 3,14 % de la largeur (32 en largeur), fixes. Ni dégradé, ni grain, ni ombre.
  - Titre sur deux niveaux : un grand mot, « BREAKDOWN », aussi large que la carte (de 12,4 à 87,4 % de la largeur ; capitales de 5,0 % de la hauteur, de 24,9 à 30,0 %), et deux petits mots posés sur ses deux bouts, « SOUND » à gauche, « EFFECTS » à droite (capitales de 2,2 %, à partir de 22,3 %), 5 px au-dessus. Blanc, une grotesque grasse à approche serrée, **pas condensée** : le mot fait 8,4 fois sa hauteur de capitale, comme Inter Tight (Anton, condensée, ferait 5,2).
  - La carte : de 12,2 à 87,9 % de la largeur, de 30,5 à 54,5 % de la hauteur (16:9), coins arrondis de 2,8 % de la largeur (30 px à 1080), le titre posé dessus (0,5 % d'écart), ni trait ni ombre.
  - L'étiquette : capitales blanches centrées, de 59,0 à 61,6 % de la hauteur (2,6 %), la même grotesque grasse ; un compte s'écrit « x 2 », x minuscule.
  - La timeline : de 12,5 à 87,4 % de la largeur, de 63,75 à 77,6 % de la hauteur, coins de 2 % de la largeur.
  - Le tout centré en hauteur (de 22,3 à 77,6 %), aligné sur les bords de la carte.
- **Sur quoi** : n'importe quelles vidéos : elles passent dans la carte.
- **Outil** : existant. `Grid` (le « blueprint » ; ses traits font 1 px) ou le fond dessiné du v1 ; le titre par `FitText` et les plans par `Footage` dans une boîte arrondie, comme le v1, dont la mise en page était juste à 1 % près.
- **Si rien ne s'y prête** : toujours possible.

### 2. Le nom de chaque son, au moment où on l'entend
- **Mesuré** : 16 étiquettes en 10,5 s, de 0,23 à 1,07 s chacune, qui changent d'un coup (ni fondu, ni pop). Chacune arrive avec son son, de 4 images avant son attaque à 1 image après (1 à 2 images avant, le plus souvent), et tient jusqu'au son suivant. Un silence de plus d'un tiers de seconde l'efface, 2 à 4 images après la fin du son (5,13 · 8,50 · 9,43 s), sauf le dernier. Un son répété se compte (« WHOOSH x 2 », « CLICK x 3 », « SHUTTER x 3 »). Les noms sont ceux des bruitages, en anglais.
- **Sur quoi** : les sons de son Reel. Soit les bruitages qu'Edith pose sur chaque effet (« WHOOSH », « CLIC x 3 » : les coulisses du montage, comme l'original), soit les vrais sons de son métier qu'on entend dans ses vidéos (le moulin, la vapeur, les ciseaux). À décider avec Tristan.
- **Outil** : le code du modèle (un texte par son, à son moment) : existant. Il lui faut les sons eux-mêmes : manquant (effet 11). Pour les sons de son métier, leur nom et leur instant dans ses vidéos : manquant aussi (l'analyse de ses vidéos ne les note pas).
- **Si rien ne s'y prête** : les bruitages d'Edith, toujours là.

### 3. La timeline du Reel et sa tête de lecture
- **Mesuré** : une capture de la timeline du montage (DaVinci Resolve), gris foncé #232128 : 9 pistes vidéo et 3 audio avec leurs en-têtes, la règle, le timecode qui tourne en haut à gauche (« 01:00:05:02 »). Seule la tête de lecture bouge : un trait rouge fin et son repère, qui traverse les pistes (de 23,3 à 87,2 % de la largeur de l'image) à vitesse constante, de la 1re image à la dernière. Les clips verts (#2E8162) des pistes audio sont les bruitages, chacun à son instant : la tête passe sur un clip quand on l'entend et que l'étiquette le nomme. Sur la piste V1, les plans en vignettes.
- **Sur quoi** : du décor : ses plans à elle sur V1, les sons de son Reel sur les pistes audio.
- **Outil** : `Timeline` existe mais il est trop simple (tête jaune, ni timecode ni en-têtes). Le dessin du v1 est plus fidèle (en-têtes, timecode, tête rouge) : à garder, ses clips audio posés sur les vrais sons du Reel (le v1 en mettait un sous chaque coupe) et ses plans en petites vignettes sur V1 (`Footage`).
- **Si rien ne s'y prête** : toujours possible (décor).

### 4. Un titre posé en trois temps, chacun sur son son
- **Mesuré** : sur le 1er plan, le titre de la vidéo, en deux blocs sur la ligne du milieu de la carte (de 46 à 55 % de sa hauteur), dans la même mise en page que le titre du haut (petits mots étalés au-dessus d'un plus gros) : à gauche « 24 / HOURS / IN » sur « VANCOUVER, CA » (de 10 à 38 % de la largeur de la carte), à droite « SHOT ON » et le logo DJI sur « OSMO POCKET 3 » (de 65 à 92 %). Gros mots ≈ 5 % de la hauteur de la carte, petits ≈ 2 %, blancs. Il s'écrit en trois temps :
  - les petits mots de gauche **tombent** du haut de la carte (19 % de sa hauteur) à leur place (48 %) en 2 images, sur le whoosh (4, 5) ;
  - « VANCOUVER, CA » **clignote** sur les 8 déclics, image par image (allumé 9, éteint 10, allumé 11-12, éteint 13, allumé 14, éteint 15, allumé dès 16) ;
  - à droite, **trois pops** sur les trois clics : chaque morceau paraît à la moitié de sa taille 1 ou 2 images, puis à sa taille (18-19, 23-24, 26-28).
  
  Puis il reste jusqu'à la fin, par-dessus tous les plans, les cases et les détourages.
- **Sur quoi** : son nom et son lieu : à gauche quoi et chez qui (« 24 H CHEZ » sur « LINO »), à droite où, son logo à la place de celui de la caméra (« À » et son logo sur « PARIS 11e »).
- **Outil** : existant. Le clignotement : `Reveal by="line" from="flicker"` (≈ 8 images). Les pops : `Reveal from="scale" frames={2}`, un par clic. La chute : le code du modèle (`Reveal from="fall"` ne tombe que d'une ligne, dans un masque). Son logo : `brand.logoUrl`.
- **Si rien ne s'y prête** : sans logo, deux pops (« CLIC x 2 »).

### 5. Le plan suivant qui se charge case par case
- **Mesuré** : la carte est coupée en 5 × 3 cases (20 % de sa largeur et un tiers de sa hauteur chacune, presque carrées), sans trait. Une case montre le morceau du plan suivant **à sa place**, sans bord, et saute d'une case à l'autre toutes les 2 ou 3 images (12 sauts par seconde), un bip par saut.
  - La 1re fois (1,50 – 3,33 s) : elle fait le tour de la grille dans l'ordre de lecture (15 cases, 45 à 82, par-dessus la coupe du bâtiment à la rue), puis 4 cases au hasard, puis trois blocs (3 cases en haut, 6 à droite, 5 en bas à gauche : 93, 95, 98), et le plan suivant remplit la carte (100).
  - La 2e fois (5,33 – 6,27 s), plus vite : de droite à gauche sur la 1re ligne, puis 2, 2, 2, 3, 8 et 11 cases à la fois, puis tout (188).
- **Sur quoi** : deux plans quelconques ; le mieux, deux plans très différents (dehors puis dedans, de jour puis de nuit, large puis serré).
- **Outil** : existant, à assembler dans le code du modèle : `Window fit="cut"` (le morceau d'une autre image, à sa place) qui saute de case en case (`moves` d'une image), puis `Tiles` (`reveal: "cut"`) pour les blocs et la carte entière. Un mode « une seule case qui fait le tour » de `Tiles` le dirait en une ligne (petit manque, pas indispensable).
- **Si rien ne s'y prête** : toujours possible.

### 6. Une rafale de plans éclair
- **Mesuré** : sur les 7 crans du cliquet (un toutes les 1,7 image), 6 plans de 1, 1, 3, 1, 1 et 3 images (108 à 117), puis un plan déjà vu (le bâtiment de verre, 118) : un plan par cran, à une image près.
- **Sur quoi** : des moments de ses autres plans.
- **Outil** : existant : les cases du skill (des plans de 1 à 3 images), `Footage at=` pour revoir un moment d'un de ses plans.
- **Si rien ne s'y prête** : peu de vidéos : la rafale reprend des moments de ses autres plans.

### 7. Le détourage du plan suivant, avant la coupe
- **Mesuré** : deux fois, sur le second whoosh d'un « WHOOSH x 2 ». L'objet du plan suivant, détouré net (les deux pâtisseries avec leur assiette et leur papier ; la main qui tient la boîte), paraît d'un coup sur le plan en cours, exactement là où il sera, 5 images avant la coupe (143 à 147, coupe à 148 ; 234 à 238, coupe à 239). La coupe amène le reste du plan autour de lui : il ne bouge pas.
- **Sur quoi** : ce qu'elle montre au plan suivant : un plat ou une assiette vus d'en haut, un produit dans sa main, une tasse, un bouquet, une bouteille.
- **Outil** : existant. `Subject shot={le plan suivant} at={sa 1re image} object="@objet"`, posé dans la boîte de ce plan les 5 images avant la coupe ; l'objet nommé par le remplisseur d'après ce que montre son fichier (`objects` du skill).
- **Si rien ne s'y prête** : rien de nommable au plan suivant : la coupe sur son whoosh, sans détourage.

### 8. Trois flashs photo
- **Mesuré** : sur les trois déclencheurs de « SHUTTER x 3 » (6,47 · 6,77 · 7,07 s), un flash blanc sur chaque coupe, dans la carte seulement (la fiche autour ne bouge pas) : 2 images blanches (196, 197), puis une image à 80 % de blanc sur le plan suivant (205, 214). Chaque flash tombe au milieu de son déclencheur.
- **Sur quoi** : n'importe quelles coupes ; des produits, des rayons, des détails.
- **Outil** : `Flash` (existant, blanc plein) posé dans la carte ; le blanc à 80 % d'une image par le code du modèle (`Flash` n'a pas d'opacité).
- **Si rien ne s'y prête** : toujours possible.

### 9. La coupe qui bégaie
- **Mesuré** : trois fois, sur une salve de 6 déclics (un toutes les 35 ms, à peu près un par image), la coupe hésite 6 images entre les deux plans, une image chacun (B B A B A B la 1re fois, puis deux fois B A B A A B : le montage à 24 i/s alterne image par image), puis reste sur le nouveau (246 à 251, 273 à 278, 293 à 298).
- **Sur quoi** : deux plans quelconques.
- **Outil** : existant : le code du modèle, `Footage` des deux plans en alternance (`at=`).
- **Si rien ne s'y prête** : toujours possible.

### 10. Des coupes franches sur des whooshes, et des coupes muettes
- **Mesuré** : aucun zoom, aucun filé, aucun fondu : des coupes franches. Sur un whoosh, la coupe tombe sur son moment le plus fort (35, 45, 75) ou 2 à 3 images après (135, 148, 226, 239). Trois coupes tombent dans le silence, sans son ni étiquette (258, 265, 285).
- **Outil** : les coupes du skill, avec leurs whooshes (effet 11).

### 11. Le son : rien que des bruitages
- **Mesuré** : pas de musique. 24 sons sous 16 étiquettes, collés aux effets à une image près, chacun court (de 0,06 à 0,4 s ; les bips du chargement tiennent 1,8 puis 0,85 s), parfois à 0,1 ou 0,16 s l'un de l'autre, et des silences complets entre eux.
- **Sur quoi** : son Reel entier.
- **Outil** : manquant. La bibliothèque de bruitages existe (ElevenLabs, `placeSounds`, le mixage sans musique, `soundsOnlyFilter`), mais un skill ne porte pas ses sons, et un Reel fait sur un skill a toujours sa musique. Il faut qu'un skill dise ses sons (chacun nommé en anglais pour ElevenLabs et posé à son image ; son nom lu par son code pour l'étiquette et la timeline), tous gardés même à 0,1 s d'écart (le moteur n'en garde qu'un toutes les 0,25 s, même demandés), et qu'il puisse se jouer sans musique.

### 12. Étalonnage
Celui de la vidéo : naturel, contrasté, froid la nuit, chaud dedans ; deux plans au fisheye (l'objectif de la caméra, avec ses coins noirs, pas un effet du montage). La fiche autour est plate, sans grain. La finition « Net » du v1 suffit.

## Format
L'original est vertical (9:16) ; sa vidéo, horizontale (16:9), passe entière dans la carte, qui prend 75,7 % de la largeur et 24 % de la hauteur. Ses vidéos à elle seront souvent verticales : dans une carte 16:9, il n'en reste qu'une bande (32 % de leur hauteur). Réglage « format » : `auto` (la carte 16:9 quand la plupart de ses vidéos sont horizontales, sinon carrée), `horizontal` (16:9, comme l'original ; une vidéo verticale y est cadrée sur son sujet), `vertical` (une carte carrée de la même largeur : il reste 56 % de la hauteur d'une vidéo verticale ; le bloc reste centré, l'étiquette vers 68 à 71 % de la hauteur, sous la limite des 75 %, et la timeline en décor dessous ; une carte 4:5 pousserait l'étiquette au-delà).

## Ce que Gemini a vu, et ce qu'il a raté
Vu : la mise en page (fond quadrillé, titre, carte, timeline et sa tête rouge, à 1 % près), toutes les étiquettes dans l'ordre et à une ou deux images près, les bruitages (whooshes, déclics, bips, clic de souris, cliquet), des fenêtres « pop-up », des pâtisseries détourées, un flash blanc (6,53 s), les plans au fisheye, et la signature : le nom du son sous la tête de lecture. Raté : la **musique** (il n'y en a pas ; il décrit un beat lo-fi à 85 BPM : inventé), les **trois silences** où l'étiquette s'efface (il garde « SHUTTER CLICKS » de 8,07 s à la fin), le **titre de la vidéo** et ses trois temps (chute, clignotement, trois pops : il ne le voit pas du tout), la **logique des fenêtres** (des morceaux du plan suivant, à leur place, qui font le tour d'une grille 5 × 3 puis remplissent la carte), la **rafale** sur le cliquet, les **deux autres flashs** (6,83 et 7,13 s), le **détourage avant la coupe** (il voit des « photos découpées », pas qu'elles sont l'objet du plan suivant, à sa place ; et pas la main et la boîte à 7,80 s), les **coupes qui bégaient**. Et le titre n'est pas condensé.

## Ce que le modèle v1 ratait
Sa mise en page était juste (carte, étiquette, timeline, quadrillage, à 1 % près ; ses traits un peu trop sombres, #2c1a98 au lieu de ≈ #432DA9). Il ratait le reste : une musique composée à 120 BPM (« playful lo-fi electronic ») au lieu de bruitages seuls ; un plan toutes les 2 temps (1 s), 6 à 10 plans, au lieu de 22 plans et 6 plans éclair de 0,03 à 1,17 s, coupés sur leurs sons ; une étiquette par plan qui dit ce qu'on voit (« le four », « farine x2 »), au lieu du nom du son qu'on entend, effacé dans les silences ; aucun effet dans la carte (titre en trois temps, chargement case par case, rafale, détourage avant la coupe, flashs, coupes qui bégaient) ; des clips audio posés sous chaque coupe de sa timeline, pas sur ses sons ; une carte de fin qui s'assombrit, alors que l'original finit sur son plan, en boucle avec le premier. Sa fiche dans `house-models.ts` disait aussi un titre « condensé », un fond #2a14d6 (il est #14017A) et un plan qui change « toutes les 1,3 s » ; et son « pas pour » (« un lieu en plan large ») contredit l'original, fait surtout de lieux en plan large.

## Ce qu'il faut filmer
Des vidéos horizontales, de préférence (la carte est en 16:9). Un plan large et calme de son lieu, éclairé ou de nuit, pour poser le titre, et un plan du même genre pour finir (la boucle). Deux plans très différents pour le chargement (dehors puis dedans, de jour puis de nuit). Un plat ou un produit bien net, vu d'en haut ou tenu en main, et le plan qui le précède : pour le détourage avant la coupe. Une vingtaine de moments courts (une à deux secondes chacun suffisent) : des gestes, des détails, des rayons, l'équipe, la vitrine. Si les étiquettes nomment les sons de son métier : des vidéos avec leur son (le moulin, la vapeur, les ciseaux), sans musique derrière.
