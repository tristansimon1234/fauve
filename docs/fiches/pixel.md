# « Recette cosy, typo pixel » (`pixel`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis sa première note (0,30 s).

**L'original** : `house/originals/pixel.mp4`, 15,53 s (466 images), 720 × 1280, 30 i/s, **vertical 9:16** plein écran, avec son. Le modèle le prend en entier (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : un piano seul, doux, sans batterie mesurée. Une note toutes les 0,300 s (200 par minute, régulières à 16 ms près) : **100 BPM** en comptant deux notes par temps (un temps toutes les 0,600 s). Sûr pour le pas ; la mesure (deux ou trois notes par temps : 100 ou 67 en 6/8, le même pas) n'est pas claire. La première note à 0,30 s ; presque le silence de 4,25 à 4,75 s (−33 dB, 17 dB sous le reste) ; des notes graves tenues (une basse) entrent à 8,98 s, 3 images avant la coupe sur la marmite, et restent jusqu'au bout. Pas de fondu à la fin. Gemini disait 85 BPM et « rythmique lo-fi » (faux) ; `measure.py` 133,5 (choisi d'après les coupes, qui ne suivent pas la musique ; sa pulsation, 100, était la bonne) ; le skill v1 84. Sous le piano, les bruits de la cuisine (effet 8).
**Mesuré avec** : `scripts/fiche/measure.py` (coupes, clignotements, tempo), des planches à 30 i/s de tout le Reel, les pixels de chaque texte image par image (place, taille, couleur, forme), les écarts d'image dans chaque cadre (coupes dans le même cadre, zooms, mouvements), les attaques du son par bandes de fréquence, des polices Google rendues à côté du titre, et la lecture de Gemini (`house/breakdowns/pixel.json`).

## Déroulé

Tout le Reel : 10 cadres (le premier revient à la fin), tous fixes (ni zoom ni mouvement mesurés), 26 morceaux. 25 coupes franches, dont 15 dans le même cadre : un geste par morceau. Chaque étape a son texte, posé sur sa première coupe, parti avec sa dernière.

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,17 | −0,5 – −0,2 | Le bol fini vu de dessus, la marmite en haut sur la cuisinière ; une main pose la ciboulette | Le plat fini, 5 images sans texte |
| 0,17 – 1,33 | −0,2 – 1,7 | Le titre « (๑˃ᴗ˂) chayote / soup!! ☆ », deux petites lignes et le @ arrivent d'un coup (image 5), avant la première note ; à 0,53 s, même cadre, une cuillère d'ail frit | **Titre en pixels** (2), **petites lignes** (4), **tout tremble** (3), **coupe dans le geste** (1) |
| 1,33 – 3,47 | 1,7 – 5,3 | Le bol de biais, un verre d'eau derrière ; une cuillère prend quatre bouchées (coupes à 1,77 · 2,33 · 2,87 s) ; le titre reste à sa place | (1), (3) |
| 3,47 – 5,00 | 5,3 – 7,8 | Le chayote coupé sur la planche, vu de côté, en trois gestes (3,77 · 4,23 s) ; « chayote » sur l'assiette derrière ; la musique se tait de 4,25 à 4,75 s | **Une légende par étape** (5) ; le couteau s'entend (8) |
| 5,00 – 8,17 | 7,8 – 13,1 | La farce de dessus en six gestes : vermicelles, sauce d'huître (5,83), poivre (6,20), sauce soja (6,73), on mélange (7,20 · 7,67) ; la liste des ingrédients en bas, sur deux lignes | (1), (5) |
| 8,17 – 9,07 | 13,1 – 14,6 | Les boulettes faites à la main, deux gestes (8,57) ; « (´•ω•`) » seul au milieu, sur la boulette | **Kaomoji à la place des mots** (6) |
| 9,07 – 12,17 | 14,6 – 19,8 | La marmite : le cube dans l'eau qui bout (deux gestes, 9,47), le chayote versé (9,87, autre cadre), les boulettes (10,77, autre cadre ; 11,27 · 11,70) ; deux paires d'étoiles aux coins opposés ; la basse entre juste avant (8,98 s) | **Étoiles à la place des mots** (6) ; l'eau qui bout (8) |
| 12,17 – 14,13 | 19,8 – 23,1 | La soupe qui cuit, de plus près ; puis une louche sort une boulette, un champignon et du chayote (12,87, autre cadre) ; « smells so good! » en haut à gauche | (5) |
| 14,13 – 15,53 | 23,1 – 25,4 | Le premier cadre revient : on verse le bouillon sur le bol, juste avant la première image ; « enjoy cooking 🥣 » ; ni carte de fin ni noir | **La boucle** (7) |

## Effets (ce qu'on veut savoir refaire)

### 1. Des gestes en plans fixes, coupés geste par geste
- **Mesuré** : sur chacun des 26 morceaux, ni zoom ni glissement mesurés (échelle 1,00 de sa première à sa dernière image) : le téléphone est posé. Dans un même cadre, la vidéo saute d'un geste au suivant (15 coupes sur 25 : le décor reste identique, seul le geste change). Morceaux de 9 à 42 images (0,3 à 1,4 s), la moitié sous 16 images (0,5 s), un temps en moyenne. Une étape fait 1 à 6 gestes. Les coupes ne suivent pas la musique (en moyenne à 0,14 temps du demi-temps le plus proche : ce que donne le hasard) ; elles tombent quand un geste finit.
- **Sur quoi** : tout savoir-faire filmé téléphone posé : une recette, un soin, une coupe, un bouquet, une pièce tournée, un café. Chaque étape d'un seul endroit, en quelques gestes.
- **Outil** : existant en partie : plusieurs passages d'une même vidéo, une case chacun (le remplissage choisit le départ de chaque case). Manquant : une étape de 2 à 6 gestes à la suite, pris dans la même vidéo, chacun coupé à son début et à sa fin. Aujourd'hui le remplissage évite le même fichier sur deux cases de suite et ne compte que trois passages par vidéo, de 1,2 s au moins (`PASSAGES_PER_VIDEO`, `PASSAGE_MIN` dans `skills.ts`). Les gestes se liraient dans l'analyse de la vidéo (ses moments) ou sur ses mains (`measured_gestures`, déjà donnés au motion designer).
- **Si rien ne s'y prête** : une vidéo par étape, sans saut, un passage d'un à deux temps.

### 2. Le titre en pixels, posé d'un coup
- **Mesuré** :
  - « chayote / soup!! » en minuscules, avec « !! », sur deux lignes centrées (le milieu de chacune à 49,9 % de la largeur ; « chayote » de 32,8 à 67,1 %, « soup!! » de 38,5 à 61,3 %), de 29,8 à 38,8 % de la hauteur : au tiers haut, sur la cuisinière.
  - Une police pixel : minuscules de 5 pixels, hampes de 7, traits d'un pixel (un pixel fait 7 × 5,7 px sur 720 × 1280). Hampes 2,9 % de la hauteur (37 px), minuscules 2,2 % (28 px), interligne 5,5 %.
  - Vert d'eau très pâle #D4F7E9, un liseré sombre gris-vert d'un pixel tout autour (il se voit sur le bol blanc), sans ombre portée.
  - Devant, en exposant à hauteur des hampes, le kaomoji « (๑˃ᴗ˂) » blanc, au trait fin (24,2 – 31,7 % × 28,9 – 30,3 %). Après « soup!! », sur sa ligne, une étoile blanche au trait fin « ☆ » (63,9 – 68,2 % × 36,3 – 38,9 %).
  - Tout arrive en une image, à l'image 5 (0,17 s), avant la première note. Aucune lettre ne s'allume ni ne se tape. Il reste 3,3 s sur deux cadres, à la même place, et part avec la coupe (image 104).
- **Sur quoi** : son résultat fini, en gros plan de dessus (le plat, la coupe finie, le bouquet, la pièce), avec le tiers haut sombre ou uni (le plan de travail, la cuisinière, un mur). Sur le bol blanc du 2e cadre, le vert d'eau se lit mal : un fond clair derrière le titre est à éviter.
- **Outil** : existant : la paire « pixel » (Pixelify Sans 500), presque identique (à 89 px en 1080 × 1920, « chayote » et « soup!! » ont la largeur de l'original à 1 % près, ses minuscules la même hauteur) ; `FitText` ; le liseré en contour fin d'un pixel (pas l'ombre dure du v1) ; le kaomoji et l'étoile en SVG dans le code (v1) ou `Scribble kind="star"`.
- **Si rien ne s'y prête** : si le haut de son premier plan est clair, le titre garde sa place, avec un liseré un peu plus épais. Le moteur veut l'accroche lisible dès la première image : les 5 images sans titre de l'original sont à confirmer.

### 3. Tout tremble, six fois par seconde
- **Mesuré** : chaque texte et chaque dessin change de forme toutes les 5 images exactement (0,167 s) et ne bouge pas entre deux : le titre aux images 10, 15, 20… 100, « chayote » à 109, 114…, la liste à 155, 160… : chacun depuis sa propre arrivée. À chaque pas, chaque lettre (et chaque étoile, chaque kaomoji) prend sa propre petite inclinaison, de 2 à 6° le plus souvent (jusqu'à 10°), et un décalage d'un ou deux pixels (0,1 à 0,3 % de la largeur). La première pose du titre (images 5 à 9) est droite. C'est ce qui vit dans ce Reel : rien ne clignote ni ne s'allume (les 22 « clignotements » de `measure.py` sont des mains, des cuillères, l'eau qui bout et ce tremblé).
- **Sur quoi** : n'importe quel texte sur n'importe quelle image : c'est une matière du texte.
- **Outil** : manquant : un tremblé pour les textes et les dessins (« boil ») : toutes les n images (5 ici), chaque lettre redessinée avec une inclinaison et un décalage tirés au hasard (±2 à 6°, ±1 à 3 px en 1080), sa première pose droite, chaque texte sur son horloge depuis son arrivée. Le kit le fait pour un trait (`Scribble boil`), pas pour des lettres.
- **Si rien ne s'y prête** : toujours faisable.

### 4. Les deux petites lignes et le @ du début
- **Mesuré** : avec le titre (image 5), en machine à écrire (une mono à empattements), blanc un peu crème (#FFF5DA à #FFFBEF), minuscules de 10 px sur 1280 (0,8 % de la hauteur, une police d'environ 30 px en 1080) :
  - « comfort food » à gauche, sur le bord du bol (13,6 – 33,8 % × 52,0 – 53,0 %) ;
  - « perfect for cold days » en bas à droite, sur le bouillon (46,4 – 82,2 % × 74,8 – 76,4 %) ;
  - le @ du compte en haut, sur la marmite (43,9 – 57,6 % × 13,1 – 14,8 %).
  Sans ombre. Ils tremblent avec le titre et partent avec lui.
- **Sur quoi** : deux petites phrases sur ce qu'elle fait (pour qui, pour quand : « fait maison », « pour les soirs froids »), et son compte.
- **Outil** : existant : des étiquettes `data-fauve-accent` (4 mots au plus, 20 px au moins) ; une mono de Google Fonts (Courier Prime en est proche ; Space Mono, celle de la paire, est plus géométrique). La ligne du bas passe sous les 75 % de la hauteur, où le contrôle refuse un texte (l'interface d'Instagram) : le modèle la pose juste au-dessus. Manquant : son @ : le code d'un modèle ne connaît que son nom (`brand`), pas son compte Instagram.
- **Si rien ne s'y prête** : sans compte connu, son nom en petit, ou rien.

### 5. Une toute petite légende par étape
- **Mesuré** : chaque étape a son texte, posé sur sa première coupe, tenu toute l'étape (1,4 à 3,2 s), dans un vide de l'image :
  - « chayote », le nom de ce qu'on coupe, sur l'assiette derrière (25,4 – 35,1 % × 32,2 – 33,6 %) ;
  - la farce, sur deux lignes centrées sous le bol (« minced pork, glass noodles / oyster sauce, soy sauce, and black pepper », 22,6 – 77,2 % × 75,1 – 78,3 %) ;
  - « smells so good! » en haut à gauche (20,8 – 40,4 % × 30,9 – 32,2 %), puis « enjoy cooking 🥣 » au même endroit sur le dernier plan (20,0 – 41,8 %).
  Une linéale simple (type Helvetica), blanche, minuscules de 10 à 11 px sur 1280 (0,8 %), sans ombre, qui tremble. Ce n'est pas la machine à écrire du début.
- **Sur quoi** : ce qu'on voit à chaque étape : l'ingrédient ou l'outil, ce qu'on y met, ce que ça sent ; puis le mot de la fin.
- **Outil** : existant : les textes du modèle à leurs moments, une étiquette `data-fauve-accent` chacune ; leur place dans un vide : les trois places fixes du v1, ou à côté de ce qu'on prépare (`SubjectBox` sur un objet nommé, comme les objets de « Lieu tapé »). Manquant : les mains suivies pour un skill (son code reçoit `track` vide), pour poser la légende loin du geste. À décider : la liste de 9 mots en tout petit n'entre pas dans le kit (plus de 4 mots : 48 px au moins) ; l'emoji au bout de la dernière ligne (le kit trouve cheap un emoji qui flotte ; celui-ci est dans la phrase).
- **Si rien ne s'y prête** : une étape sans mots prend un kaomoji ou les étoiles (effet 6).

### 6. Un kaomoji ou des étoiles à la place des mots
- **Mesuré** : sur les boulettes (8,17 – 9,07 s), seul au milieu de l'image, « (´•ω•`) » blanc au trait fin (45,4 – 54,4 % × 49,3 – 50,6 %), posé sur la boulette, qu'il ne suit pas. Sur toute la cuisson (9,07 – 12,17 s, trois cadres), deux paires d'étoiles blanches au trait (une petite, une grande, en diagonale qui monte), aux coins opposés : en haut à gauche (12,5 – 20,6 % × 18,5 – 21,9 %), en bas à droite (76,2 – 82,4 % × 72,3 – 74,9 %). Elles tremblent ; elles ne scintillent pas.
- **Sur quoi** : une étape qui se passe de mots (un geste doux, la cuisson, l'attente).
- **Outil** : existant : dessinés en SVG dans le code (v1) ou `Scribble kind="star"` (qui a déjà son tremblé), en `data-fauve-decor`.
- **Si rien ne s'y prête** : toujours faisable.

### 7. La boucle : la fin rejoint le début
- **Mesuré** : le dernier plan (14,13 – 15,53 s) est le premier cadre, sans décalage (le bas de l'image, le bol, ne diffère que de 6 niveaux sur 255 entre les images 30 et 465). Il est filmé juste avant lui : on y verse le bouillon, la ciboulette n'y est pas encore. Quand Instagram relance le Reel, le bouillon versé mène à la ciboulette posée. Ni carte de fin, ni logo, ni noir : la dernière image est un plan.
- **Sur quoi** : son premier plan et son dernier filmés du même endroit, le dernier geste juste avant le résultat (verser, la dernière touche, le dernier coup de ciseaux, le ruban du bouquet).
- **Outil** : existant : l'ordre des cases et ce que chacune attend (`timeline` : la dernière case veut la même vidéo que la première, son passage d'avant), `Footage`.
- **Si rien ne s'y prête** : le résultat fini à la fin, vu autrement. Une offre à annoncer : la carte de fin du moteur après lui (l'original n'en a pas).

### 8. Le son : un piano doux et les bruits de la cuisine
- **Mesuré** : la musique (en tête de fiche). Sous elle, le son des vidéos, au moment où on le voit : trois petits clics quand la main garnit le bol (0,19 · 0,28 · 0,39 s), le couteau qui traverse le chayote (un craquement de 3,8 à 4,1 s), l'eau qui bout et le cube qui tombe (9,1 – 9,8 s), la soupe qui frémit (13,3 – 14,0 s). Aucun bruitage ajouté : ni « pop » sur les textes, ni souffle sur les coupes. Personne ne parle.
- **Sur quoi** : ses vidéos avec leur son (sans parler, sans musique derrière).
- **Outil** : existant : la musique composée au tempo du modèle (100 BPM ; « soft solo piano, warm, no drums ») ; le son de ses vidéos sous la musique (`finish.video_sound` « all »). Manquant : qu'un modèle pose ce son par défaut (seul son réglage le fait ; sans lui, un Reel sans voix n'a que la musique) ; une musique qui change à un moment donné (la basse qui entre sur la cuisson).
- **Si rien ne s'y prête** : la musique seule.

### 9. Étalonnage
- Chaud et sombre : une luminosité médiane de 59 à 108 sur 255 selon le plan. Une lampe chaude sur la table, le reste dans l'ombre.
- Noirs profonds, un peu rouges (#100B0B à #1A0804), jamais levés ; hautes lumières crème (#DCD9C1 à #F2E3C2), blanches seulement dans les reflets de l'eau.
- Couleurs assez saturées (0,39 à 0,64) : le vert du chayote, l'orange des carottes, le bois.
- Pas de grain qui bouge (une zone fixe reste identique d'une image à l'autre), pas de vignettage ajouté (les coins sombres suivent la lumière : de 0,38 à 1,25 fois le centre selon le plan).
- Ni zoom, ni poussée lente, ni mouvement de caméra : rien de ce que Tristan trouve cheap.
- **Outil** : existant : la finition du modèle (chaude, un peu de contraste), sans grain, sans vignettage, sans noirs levés.

## Format
**Depuis le 6 novembre** (Tristan, sur sept bancs : « vertical please », « tout vertical please ») : `vertical` par défaut, plein écran, ses fichiers horizontaux recadrés sur leur sujet ; `horizontal` (sa bande) seulement à sa demande, ou quand elle veut ses vidéos entières (le `frame` letterbox de son contrat) ; `auto` (comme ses vidéos, ci-dessous) seulement si elle le demande. `docs/modeles.md`, « Réglages d'un modèle ».

L'original est vertical 9:16, filmé en vertical, plein écran, sans bandes. Réglage « format » : `vertical` seulement (défaut, comme l'original) : les gros plans remplissent l'image et les petits textes se posent dans ses vides. Une vidéo horizontale est recadrée en 9:16 autour du geste (les mains, au milieu). Pas de version horizontale ni carrée : rien à y gagner.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format ; les étapes et leurs moments (à une image près, sauf la coupe de 12,17 s) ; le titre et son coin haut gauche (à un point près) ; les petites lignes et leurs places (« comfort food », « perfect for cold days », « chayote », « smells so good! », « enjoy cooking ») ; le kaomoji du titre ; des étoiles sur la cuisson ; l'étalonnage chaud ; les bruits du couteau et de l'eau.

**Raté** :
- le **tempo** : 85 au lieu de 100, et une « rythmique lo-fi » : c'est un piano seul ;
- le **tremblé** de tous les textes, toutes les 5 images ;
- les **15 coupes dans le même cadre** (il voit un plan par étape) et la coupe de 12,17 s ;
- la **boucle** : le dernier plan est le premier cadre ;
- les **polices** : il met toutes les petites lignes en machine à écrire (les étapes sont en linéale) ; le titre n'est pas blanc mais vert d'eau, son contour n'est pas noir mais un liseré gris-vert d'un pixel ;
- le kaomoji « (´•ω•`) » des boulettes et le @ du compte ;
- la liste : il la met à 85 % de la hauteur (75 à 78 %) ;
- les étoiles : ni pixelisées ni scintillantes, deux paires aux coins opposés, parties à 12,17 s (pas 12,87) ;
- un « léger tremblement » de caméra sur le 2e cadre : tout est fixe.

## Ce que le modèle v1 ratait
Le skill (`skills/pixel.ts`, version 1) et sa lecture (`house-models.ts`) :
- **Tempo** : 84 BPM (c'est 100).
- **Titre** : la lecture le fait « s'allumer lettre par lettre en clignotant » (l'exemple `AC-pixel` aussi, `Reveal … from="flicker"`) : il arrive d'un coup, puis tremble. La lecture le dit blanc (il est vert d'eau). Le skill lui met une ombre dure de 4 px dessous et un halo ; l'original n'a qu'un liseré d'un pixel.
- **Tremblé** : absent partout.
- **Gestes** : un plan par étape, de 3 ou 4 temps (2,1 à 2,9 s), au lieu de 1 à 6 gestes de 0,3 à 1,4 s dans un même cadre fixe. La lecture dit « caméra à la main » (tout est fixe) ; `house-measures.ts` compte 7 coupes (il y en a 25).
- **Textes** : toutes les petites lignes en machine à écrire (seules celles du début le sont) ; pas de @ ; un kaomoji calme « (˘ᴗ˘) » et des étoiles une étape sur deux, au lieu de « (´•ω•`) » pour une étape et des étoiles pour la cuisson.
- **Fin** : une carte de fin sur la dernière image assombrie ; l'original finit sur la boucle, sans carte.
- **Son** : « cozy lo-fi hip-hop, soft vinyl crackle » : c'est un piano seul, sans batterie (le crépitement : pas clair) ; et pas le son de ses vidéos.
- **Finition** « Cosy » : grain 0,25, vignettage 0,25, noirs levés 0,08 ; l'original n'en a aucun.
- Son « pas pour » devrait dire aussi : quelqu'un qui parle, des vidéos filmées à la main.

## Le modèle v2 (5 novembre)
Réécrit sur cette fiche (`packages/agent/src/skills/pixel.ts`, version 2), rendu en local sur une séance de pâtisserie de Pexels (un fraisier à la menthe monté geste par geste, téléphone posé, douze vidéos de Los Muertos Crew ; `scripts/skill-render.mts --cast`, qui range ses fichiers comme le remplisseur suit les cases ; aucun appel facturé) :
- **Gestes** (1) : 100 BPM, les 26 morceaux de l'original en 11 endroits, chaque coupe à l'image près (`pixelSections`). Le geste suivant d'une étape demande « la même vidéo que la case précédente, juste après », la dernière case la vidéo de la première juste avant elle (la boucle, 7). Moins de fichiers (15 cases au moins) : les gestes partent d'abord des étapes sans mots, chaque endroit en garde un, le titre reste 1,6 s au moins et la liste 1,7 s ; le Reel raccourcit (10,7 s à 15 cases).
- **Titre** (2) : d'un coup à l'image 5 ; Pixelify Sans 500 à 89 px, vert d'eau #D4F7E9, un liseré gris-vert de 2 px tout autour, sans ombre, sur deux lignes équilibrées, centré au tiers haut sur la zone la plus calme de son premier plan (`ClearBox`, à sa taille ou presque, sinon la place de l'original) ; le petit visage levé devant, l'étoile après, hors de ses lignes centrées.
- **Tremblé** (3) : toutes les 5 images depuis son arrivée, chaque lettre, chaque étoile et chaque visage redessinés avec leur petite inclinaison (2 à 6°, 10 au plus) et un décalage de 2 px au plus, leur première pose droite (`wobble`, dans le code du modèle).
- **Petites lignes** (4) : en machine à écrire (Courier Prime, apportée par le modèle), 30 px, coupées à leur virgule : à gauche à mi-hauteur, puis en bas à droite, remontée juste au-dessus des 75 % ; son nom en tout petit en haut, à la place du @ de l'original (jamais recopié ; son compte n'est pas connu du code).
- **Légendes** (5) : en linéale (Inter), 29 px, ses mots entre « / » : la première étape en haut à gauche, la plus longue sur deux lignes centrées remontées au-dessus des 75 %, « presque prêt » en haut à gauche ; un 4e et un 5e mot prennent la place du visage et des étoiles. Un liseré sombre serré, invisible sur une image sombre, les tient sur une image claire.
- **Visage et étoiles** (6) : « (´•ω•`) » seul au milieu sur le geste à la main, deux paires d'étoiles au trait aux coins opposés sur toute la cuisson ; ils tremblent, ne clignotent pas.
- **Boucle** (7) : ni carte ni noir, le mot de la fin sur la boucle. Une carte de fin seulement quand elle en a une (en option, Tristan) : la boucle tenue trois temps de plus, assombrie, son titre en pixels, sa ligne en machine à écrire.
- **Musique** (8) : un temps de silence dans la première étape, la reprise sur le premier temps (4,2 – 4,8 s ; l'original 4,25 – 4,75) ; sans sa basse jusqu'à la cuisson (`thin` jusqu'à 9 s ; la basse de l'original entre à 8,98 s) ; coupée net à la dernière image, puisqu'il boucle. Aucun bruitage : ceux de l'original sont le son de ses vidéos.
- **Format** : réglage `format`, `auto` par défaut (Tristan : comme ses vidéos, plutôt que le vertical seul de cette fiche) : plein écran vertical comme l'original, 16:9 sur du noir quand la plupart de ses vidéos sont en largeur ; `horizontal`, `vertical` à sa demande.
- **Étalonnage** (9) : ni grain, ni coins sombres, ni noirs levés (`MontageSkill.finish`), un peu de contraste.

Pas fait : le son de ses vidéos posé par défaut sous la musique (le couteau, l'eau qui bout : il faudrait qu'un modèle règle `finish.video_sound` « all », sous son propre réglage) ; être sûr que le remplisseur garde la même vidéo sur les gestes d'une étape (il le lit dans « veut », mais sa consigne préfère changer de fichier : il faudrait une case « même fichier que la précédente » dans le moteur) ; poser les légendes loin du geste (les mains ne sont pas suivies pour un skill) ; une vraie basse qui entre (la musique est une boucle : le filtre la retire avant). À confirmer avec Tristan : les 5 images sans titre du début, gardées comme l'original.

## Ce qu'il faut filmer
- Le téléphone posé (un pied, ou calé), jamais à la main ; chaque étape d'un seul endroit.
- Le résultat fini de dessus, le tiers haut sombre ou uni pour le titre.
- Le même résultat de biais, qu'on goûte ou qu'on touche (une cuillère, une main).
- Chaque étape en 2 à 6 gestes courts, l'un après l'autre, sans parler : on coupe les temps morts entre eux.
- Le dernier geste (verser, la dernière touche), du même endroit que le premier plan, juste avant lui : c'est la boucle.
- Une lumière chaude de côté, le reste dans l'ombre ; le son des gestes gardé.
