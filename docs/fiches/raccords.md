# « Plans qui s'emboîtent » (`raccords`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « double » compte les doubles-croches de sa musique (un quart de temps, 0,158 s) depuis son premier temps (0,334 s), « temps » ses temps.

**L'original** : le lien de Tristan https://www.instagram.com/reel/DdNZHPNIjj9/ (n° 24 de sa vague du 5 novembre ; au labo, `lab/models/8f2ec49a-9e5f-4c75-b657-93208502c470.mp4` ; `house/originals/raccords.mp4` une fois gardé), 7,23 s (217 images), **720 × 540, horizontal 4:3 plein cadre** (pas 720 × 1280 : mesuré par ffprobe, et Gemini l'a vu aussi), 30 i/s, avec son (AAC stéréo 44,1 kHz, −14,1 LUFS). Six plans d'une journée de créatrice à Londres (elle dans la rue, une station de métro aérienne, un plafonnier, son salon, une platine vue d'en haut, un carnet illustré tenu devant le salon), **enchaînés par des raccords** : à chaque coupe, ce qu'il y a dans le plan suivant arrive d'abord sur le plan en cours, à sa place exacte, en morceaux sur les coups de la musique, puis la coupe le fait jouer. Un seul texte : « OK » qui clignote sur la première demi-seconde. Tout l'original sert au modèle (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : un beat hip-hop lo-fi (boom bap) à **95,0 BPM** (une double toutes les 0,1579 s, le premier temps à 0,334 s), une basse tenue et une note de synthé à 1,2 kHz tenue avec elle, des coups sur un rythme pointé de 3-3-2 doubles. Chaque mesure (2,53 s) a sa **cassure** : la basse et la note s'arrêtent à la double 10,5 de la mesure (1,99 · 4,53 · 7,04 s), restent des coups hachés sans basse (les attaques à 2,23 · 2,39 · 2,69 s, puis 4,76 · 4,92 · 5,07 · 5,21 s), une demi-double presque muette juste avant le temps fort (2,70 – 2,75 s, 5,24 – 5,27 s), et **la basse revient sur le premier temps de la mesure suivante** (2,86 · 5,39 s). Le Reel finit au milieu de la cassure de sa troisième mesure. Avant le premier temps, un coup sec dans toutes les bandes à 0,09 s puis 0,16 s, pendant que « OK » clignote (l'échantillon de voix « OK » selon Gemini). Mesuré sur 15 attaques ajustées à une grille de doubles : 95,0 BPM, toutes à 15 ms près (neuf à 3 ms). `measure.py` voyait 126,75 BPM (les 3 doubles de son rythme pointé, 0,474 s, pris pour un temps), Gemini 90 et un coup « toutes les secondes » : faux tous les deux. Sûr.
**Mesuré avec** : `scripts/fiche/measure.py` (format, coupes, clignotements, tempo), des planches à 30 i/s de tout le Reel numérotées image par image, des gros plans des passages (le « OK », la surimpression, les cases, la lampe, les pièces du salon et de la platine, le carnet), la part de rouge par image, la boîte de ce qui change entre deux images à chaque morceau qui arrive, la clarté de chaque image (la lampe qui s'allume), le son par bandes toutes les 10 ms (graves, bas-médiums, médiums, aigus), son spectre, ses attaques par bande et une grille ajustée dessus, et la lecture de Gemini (`house/breakdowns/raccords.json`).

## Déroulé

| De – à (s) | Doubles | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,50 | −2,1 – 1 | Elle, en selfie dans la rue, cheveux bouclés au vent, qui sourit puis tourne la tête ; « OK » rouge géant qui clignote image par image | **Le mot qui clignote** (effet 1) |
| 0,50 – 0,77 | 1 – 2,75 | Elle tourne sur elle-même, ses cheveux volent ; un métro passe derrière elle | — |
| 0,77 – 1,30 | 2,75 – 6 | Le plan suivant (la station, sa verrière, son quai) apparaît dans les clairs de son plan, ses cheveux sombres restent devant | **La surimpression** (effet 2) |
| 1,30 – 2,60 | 6 – 14,25 | La station vue du quai, fixe, la rame qui arrive | Coupe à la double 6 |
| 1,77 – 2,57 | 9 – 14 | Les cases de la lampe suivante se posent au milieu : 1, 3, 5, puis 9 | **L'image d'après en neuf cases** (effet 3) |
| 2,60 – 2,87 | 14,25 – 16 | Coupe sur la lampe, un plafonnier carré à 3 × 3 caissons sur du noir, éteinte à 41 % ; elle s'allume sur le temps fort | **Elle s'allume** (effet 4) |
| 2,87 – 4,13 | 16 – 24 | La lampe allumée ; à 3,37 · 3,53 · 3,80 s les meubles du salon détourés se posent sur le noir autour d'elle | **L'objet d'après en morceaux** (effet 5) |
| 4,13 – 5,40 | 24 – 32 | Le salon entier (une image fixe), elle allongée sur le canapé ; à 4,73 · 4,87 · 5,13 s la platine arrive détourée par morceaux | Effet 5 |
| 5,40 – 6,27 | 32 – 37,5 | La platine vue d'en haut, le disque qui tourne ; à 5,87 s une main qui tient un carnet illustré se pose dessus, détourée | Effet 5 (en un morceau) |
| 6,27 – 7,23 | 37,5 – 43,7 | Le carnet tenu devant le salon (un autre angle), à la même place ; caméra à la main jusqu'à la fin | **Le raccord sur l'objet** (effet 6) |

Sept coupes pour `measure.py`, cinq vraies : 1,30 · 2,60 · 4,13 · 5,40 · 6,27 s (celles de 5,13 et 5,87 s sont des morceaux qui arrivent : le disque, le carnet). Ni zoom, ni glissé, ni fondu, ni flash : rien de ce que Tristan trouve cheap. Ce qui fait le Reel, c'est que l'œil ne saute jamais : la chose qu'on regarde est déjà là avant la coupe.

## Effets (ce qu'on veut savoir refaire)

### 1. Un mot géant qui clignote image par image sur le premier plan
- **Mesuré** : « OK » en capitales d'une grotesque géométrique très grasse (un O rond), rouge plein #A50404, sans contour ni ombre, qui couvre toute la largeur (1 – 100 %) et les deux tiers de la hauteur (17 – 84 %), posé sur elle, son visage dessous. Allumé aux images **0, 2, 4 à 10, 12 et 14**, éteint aux images 1, 3, 11 et 13 : deux éclairs, un tenu de sept images, deux éclairs, puis plus rien dès l'image 15 (0,5 s). Il passe sur le premier temps (0,334 s, image 10) sans s'y arrêter : c'est une levée, sur le coup sec de 0,09 s.
- **Sur quoi** : n'importe quel premier plan, mieux quelqu'un de près qui regarde l'objectif.
- **Outil** : existant, le code du modèle (`FitText` dans une boîte, allumé ou non image par image).
- **Ce qui est à l'original, jamais recopié** : le mot « OK » et son rouge. Le modèle met son mot à elle (le mot de son nom qui la distingue, ou le mot de sa demande qui accroche), dans sa couleur, choisie assez sombre ou assez claire pour se lire sur ce qu'il y a dessous (lu par `LightUnder`).
- **Si rien ne s'y prête** : il clignote quand même ; sans couleur à elle, une encre presque noire, ou du blanc sur une image sombre.

### 2. La surimpression : le plan suivant dans les clairs du premier
- **Mesuré** : de l'image 23 à l'image 38 (0,77 – 1,30 s, 16 images avant la coupe), la station du plan suivant apparaît **là où son plan est clair** (le ciel blanc : la verrière s'y dessine dès l'image 23), pendant que ses cheveux et ce qui est sombre restent devant ; de l'image 29 à 38, la station a pris presque toute l'image, ses cheveux en traînées sombres devant. Comme un mélange « obscurcir » (chaque pixel garde le plus sombre des deux), qui monte en un demi-temps. Puis la coupe nette sur la station, à la double 6.
- **Sur quoi** : n'importe quels deux plans, mieux un premier plan avec du clair (un ciel, une vitrine, un mur blanc) et quelqu'un de sombre qui bouge devant.
- **Outil** : existant : `Footage` du plan suivant (sa première image, tenue) posé sur le premier dans la même boîte, `mixBlendMode: "darken"`, son opacité de 0 à 1.
- **Si rien ne s'y prête** : un premier plan tout sombre ne laisse rien passer : la coupe arrive quand même.

### 3. L'image d'après en neuf cases (le moment signature)
- **Mesuré** : sur la station, les caissons de la lampe du plan suivant se posent au milieu, **exactement là où ils seront** dans son plan, dans son état éteint (brun sombre) : un à l'image 53 (double 9), trois à l'image 58 (la colonne, double 10), cinq à l'image 66 (la croix, double 12), les neuf à l'image 71 (double 13). Chaque case est carrée, 11,5 % de la largeur (15,4 % de la hauteur), à 4,2 % de la largeur l'une de l'autre ; la grille fait 43 % de la largeur sur 57 % de la hauteur, centrée à 49 % et 54 %. Elles arrivent d'un coup, sans fondu ni rebond, sur les coups hachés de la cassure (la basse est partie à 1,99 s). Coupe à l'image 78 sur la lampe elle-même : les mêmes cases, à la même place, sur le noir.
- **Sur quoi** : n'importe quel plan suivant : son image vue par neuf fenêtres carrées au milieu de l'écran, autour de son sujet. Mieux un plan graphique, son sujet au milieu (une lampe, son enseigne, une vitrine, un présentoir, un produit posé).
- **Outil** : existant : `Footage` du plan suivant (sa première image, tenue) dans la même boîte, découpé par un `clipPath` fait des cases déjà posées.
- **Si rien ne s'y prête** : rien à faire, ça marche sur toute image.

### 4. Elle s'allume sur le temps fort
- **Mesuré** : la lampe, éteinte à 41 % de sa clarté (images 78 à 83), s'allume en trois images (84, 85, 86 : 59 %, 82 %, 100 %), pleine sur le premier temps de la deuxième mesure (2,87 s, double 16), **là où la basse revient**. Rien ne grossit (le halo de la lampe allumée fait seulement paraître les cases plus grandes).
- **Sur quoi** : n'importe quel plan : il arrive sombre, la lumière se fait sur le temps fort.
- **Outil** : existant : un voile noir sur le plan qui part en trois images.
- **Si rien ne s'y prête** : rien à faire.

### 5. L'objet d'après qui arrive détouré, en morceaux
- **Mesuré** : deux fois en trois morceaux, une fois en un, chacun d'un coup, à sa place exacte dans le plan suivant, sans bord ni ombre :
  - sur la lampe allumée (le noir autour d'elle), les meubles du salon : un cabinet noir à gauche (image 101, double 19,25), le grand tableau, une plante et un tabouret (image 106, double 20,25, 15 % de l'image), elle allongée sur le canapé (image 114, double 22) ; coupe sur le salon entier à l'image 124 (double 24, le troisième temps), les meubles là où ils étaient ;
  - sur le salon, la platine : son bras (image 142, double 28), son panneau de réglages à droite et une boîte claire à gauche (image 146, double 28,75), le disque au milieu (image 154, double 30,5, 16,5 % de l'image) ; coupe sur la platine vue d'en haut à l'image 162 (double 32), **sur le premier temps de la troisième mesure, la basse revenue** (sa cassure avait commencé à 4,53 s, juste avant le bras) ;
  - sur la platine, la main qui tient le carnet (image 176, double 35, 25 % de l'image), en un seul morceau.
  Les morceaux du bord d'abord, celui du milieu en dernier (le disque, elle).
- **Sur quoi** : ce qui se détache dans le plan suivant : quelqu'un, un produit, une tasse, une assiette, un bouquet, un meuble, ses mains au travail.
- **Outil** : existant : `Subject shot={le plan suivant}` (son détourage, sa première image tenue), découpé en trois tranches le long de sa boîte (`SubjectBox`), les deux du bord puis celle du milieu ; ou d'un seul morceau. Le moteur ne détoure que ces plans (`cutouts`).
- **Si rien ne s'y prête** (pas de détourage, ou un sujet minuscule) : son image en neuf cases (effet 3), les cases posées sur les mêmes coups.

### 6. Le raccord sur l'objet
- **Mesuré** : la main et le carnet, posés détourés sur la platine à l'image 176, restent immobiles jusqu'à la coupe (image 188, double 37,5) ; le plan suivant les a au même endroit (le carnet tenu devant le salon, filmé d'ailleurs) : la coupe ne change que ce qu'il y a autour. Le Reel finit sur ce plan, à la main, 0,97 s.
- **Sur quoi** : quelqu'un qui tient un produit devant l'objectif, ou un produit posé au milieu.
- **Outil** : existant (effet 5 en un morceau).
- **Si rien ne s'y prête** : les neuf cases d'un coup.

### 7. Étalonnage
Naturel, à peine chaud dedans (rouge, vert, bleu à 126 · 107 · 87 dans le salon, neutre dehors : 125 · 113 · 105), contraste moyen, un grain discret. Pas de coins sombres mesurés (les coins plus sombres du salon sont ses meubles).

## Ce qui est à l'original, jamais recopié
Le mot « OK » et son rouge ; le métro de Londres et son logo rond ; les marques de ses appareils ; le dessin du carnet. Le modèle prend son mot à elle, ses couleurs, ses images.

## Format
**Depuis le 6 novembre** (Tristan, sur sept bancs : « vertical please », « tout vertical please ») : `vertical` par défaut, plein écran, ses fichiers horizontaux recadrés sur leur sujet ; `horizontal` (sa bande) seulement à sa demande, ou quand elle veut ses vidéos entières (le `frame` letterbox de son contrat) ; `auto` (comme ses vidéos, ci-dessous) seulement si elle le demande. `docs/modeles.md`, « Réglages d'un modèle ».

L'original est horizontal 4:3, ses six plans plein cadre. Réglage « format » :
- `auto` (par défaut) : comme ses vidéos, plein écran vertical quand la plupart le sont ; sinon ses vidéos horizontales entières dans une bande 16:9 au milieu, sur du noir.
- `vertical` : plein écran vertical, une vidéo horizontale recadrée sur son sujet.
- `horizontal` : la bande 16:9 sur du noir.
Les cases, les morceaux et la surimpression se posent dans la boîte de ses plans, quelle qu'elle soit.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format 4:3 horizontal, les six plans et ce qu'ils montrent, le « OK » rouge au début, la grille 3 × 3 qui se pose case par case au milieu de la station puis le plafonnier, l'allumage de la lampe, les meubles détourés posés sur le noir avant le salon (coupe à 4,13 s), la platine qui arrive en morceaux (le bras puis le disque), le raccord sur le carnet à 6,27 s, un beat hip-hop lo-fi.

**Raté** : le **tempo** (90 au lieu de 95,0, et des coups « toutes les secondes » au lieu du rythme pointé en doubles), les **cassures** de chaque mesure et la basse qui revient sur les coupes, le **clignotement** du « OK » (il le voit de 0,13 à 0,33 s et « masqué par le train » : il clignote de 0 à 0,5 s, image par image), la **surimpression** (il voit un « masque de découpe du train » de 0,26 à 0,66 s et fait commencer la station à 0,26 s : elle n'apparaît qu'à 0,77 s, dans les clairs de son plan, coupée à 1,30 s), l'**ordre des cases** (le centre, la colonne, la croix, les coins ; il dit centre, croix, coins), qu'elles sont **la lampe éteinte** à sa place, le carnet qui **arrive détouré** sur la platine 0,4 s avant la coupe (il dit qu'une main le pose dans le plan), le « zoom léger » de la lampe (rien ne grossit). Son conseil de refaire (« chaque couche sur les temps forts, toutes les secondes ») est faux : les morceaux tombent sur les doubles de la cassure, 0,16 s l'un après l'autre.

## Ce qu'il faut filmer
Six courtes vidéos (ou photos), chacune avec quelque chose de net au milieu, chacune d'au moins 1,5 s :
1. quelqu'un de près qui regarde l'objectif et bouge (un sourire, un tour sur soi, les cheveux au vent), dehors avec du ciel ou devant une vitrine claire ;
2. un plan large et fixe de sa rue, de sa devanture ou de sa salle, où il se passe quelque chose ;
3. un plan graphique de près, le sujet au milieu (une lampe, son enseigne, un présentoir, une vitrine), mieux un peu sombre autour ;
4. un plan large et fixe de son intérieur avec quelqu'un ou quelque chose de net devant (quelqu'un assis ou au travail, un comptoir, une table dressée) ;
5. vu d'en haut, un objet net au milieu (une tasse, une assiette, ses mains au travail) ;
6. quelqu'un qui tient un produit devant l'objectif, son lieu derrière.

Et son mot : le mot de son nom qui la distingue, ou celui de ce qu'elle annonce.

## Le modèle v1 (6 novembre)
`skills/raccords.ts`, version 1 (à valider sur /admin). Sa grille : 95 BPM en doubles depuis son premier temps (0,334 s), toutes ses coupes et tous ses coups à une image au plus de ceux de l'original (coupes aux images 38, 78, 124, 162, 188 ; cases à 53, 57, 67, 72 ; morceaux à 101, 106, 114 puis 143, 146, 154 ; l'objet entier à 176 ; fin à 217).
- **Son mot** (case `mot`, un seul mot de 2 à 10 lettres : le mot de son nom qui la distingue, ou le plus fort de sa demande) : en capitales très grasses, rondes et larges (Montserrat de sa paire « ronde-large », ou la police de titre de sa charte quand Edith l'habille), sur toute la largeur de la moitié haute (x 40 – 1040, y 150 – 930 ; dans une bande, entre les marges des boutons), plein, sans contour ni ombre, allumé aux images 0, 2, 4 à 10, 12 et 14 comme le « OK ». Sa couleur à elle, assez sombre sur une image claire, assez claire sur une image sombre (la clarté sous lui lue sur son premier plan, `LightUnder`), sinon une encre ou du blanc.
- **La surimpression** : dès l'image 23, la première image du plan suivant posée sur le sien en « obscurcir » (`mixBlendMode: "darken"` : le plan suivant dans ses clairs, ses sombres devant, comme le ciel de l'original), de 0,6 à pleine opacité en six images, jusqu'à la coupe ; sur un premier plan sombre (sa clarté sous 0,45), en « éclaircir » (`lighten` : le plan suivant dans ses ombres, son visage devant ; au premier rendu, « obscurcir » posait la terrasse sur son visage).
- **Les neuf cases** : aux doubles 9, 10, 12 et 13, la première image du troisième plan dans 1, 3, 5, puis 9 cases carrées (la grille 0,7 de la largeur, chaque case 27 % de la grille, autour du sujet du plan qu'elles montrent, là où `Footage` le cadre, sa `focus` lue par l'analyse, sinon autour du milieu à 53 % de la hauteur ; 0,62 de la hauteur d'une bande ; au premier rendu, centrées sur l'écran, elles montraient le noir à côté d'une ampoule posée à gauche), éteinte à 41 % ; la coupe, puis la lumière en trois images sur le temps fort (image 86).
- **Les morceaux** : aux doubles 19,25, 20,25 et 22, le sujet du plan suivant détouré sur sa première image (`Subject`), par tiers de sa boîte : un bord, l'autre, puis le milieu ; de même aux doubles 28, 28,75 et 30,5 (de l'autre côté d'abord), puis entier à la double 35, que la coupe garde à sa place. Sans détourage, ou un sujet sous 4 % de l'image : son image en cases sur les mêmes coups (1, 5, 9 ; ou 9 d'un coup).
- **La musique** : son premier temps fort à 0,334 s ; dans chaque mesure, sans sa basse de sa double 10,5 au premier temps de la suivante (1,99 – 2,86 s, 4,52 – 5,39 s, 7,04 s – la fin) ; en fondu à la fin. Aucun bruitage : les coups de l'original sont ceux de sa musique.
- **Ses cases** : 4 à 9 plans de ses fichiers, jusqu'à 22 pour une longueur qu'elle demande (29 s à son tempo) : son ouverture, son milieu par trois (les cases, deux fois les morceaux), le raccord sur l'objet, son dernier plan ; 4,43 s pour 4 plans, 7,23 s pour 6, 11,33 s pour 9 ; tempo de 80 à 112. Chaque case dit comment son plan arrive et ce qu'il lui faut (avec ce qui le remplace sinon).
- **Format** : réglage `format`, `auto` (comme ses vidéos : plein écran, ou une bande 16:9 sur du noir si la plupart sont horizontales), `vertical`, `horizontal`.
- **Carte de fin** (en option) : son dernier plan tenu onze doubles de plus sous un voile sombre, son titre qui clignote en entrant comme son mot, sa ligne dessous.
- **Détourés** : seulement les plans dont le sujet arrive en morceaux (3, 4 et 5 pour six plans).

**Ce qui manque** : la surimpression montre la première image du plan suivant, tenue (dans l'original, la station bouge déjà) ; l'allumage est un voile qui se lève, pas sa lampe qui s'allume ; les morceaux sont des tiers de son détourage, pas des objets à part (les meubles du salon, les pièces de la platine : il faudrait que le remplisseur nomme « every … » sur ces plans, huit objets par Reel, sur la carte louée) ; l'échantillon de voix « OK » de 0,09 s (sa musique à lui) ; et la musique composée n'a pas forcément un coup sur chaque double où un morceau arrive.
