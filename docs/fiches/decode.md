# « Titre qui se décode » (`decode`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique (122 BPM) sur sa grille prolongée jusqu'au début : le temps 0 tombe à 0,36 s, et la musique elle-même n'entre qu'au temps 11. Après la respiration, elle repart sur une grille décalée d'environ un quart de temps, comptée depuis le temps 29 (14,73 s).

**L'original** : `house/originals/decode.mp4`, 22,64 s (679 images), 720 × 406, 30 i/s, **horizontal 16:9** montré tel quel, avec son. Le modèle prend tout le Reel (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : un beat électro-pop de voyage, **122 BPM** (121,7 et 122,1 mesurés sur ses deux moitiés, un temps toutes les 0,491 s ; sûr : sa double croche est régulière à 28 ms près ; Gemini disait 115 : faux). Quatre parties : des **bruitages seuls** jusqu'à 5,7 s (effet 6) ; la musique **étouffée** de 5,76 à 13,27 s (réduite à ses médiums, comme sortie d'un petit haut-parleur : environ 30 dB de moins sous 150 Hz et au-dessus de 4 kHz que dans la suite), une pulsation régulière en doubles croches ; **presque le silence** de 13,3 à 14,7 s (−41 dB) ; la musique **pleine** à 14,70 s, sur la coupe (graves, un clap ou une caisse claire sur chaque temps, un accent à contretemps tous les 8 temps, à 16,94 et 20,87 s).
**Mesuré avec** : `scripts/fiche/measure.py` (coupes, clignotements, tempo), des planches à 30 i/s de chaque passage, des mesures au pixel (bandes, repli, bande, titre, couleurs), le spectre du son, et la lecture de Gemini (`house/breakdowns/decode.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,13 | −0,7 – −0,5 | Noir (4 images) | — |
| 0,13 – 1,07 | −0,5 – 1,4 | Six bandes verticales entrent une à une, de gauche à droite (images 4, 9, 14, 19, 26, 32), chacune une autre vidéo | **Bandes qui entrent une à une**, un « tchh » chacune |
| 1,07 – 2,27 | 1,4 – 3,9 | Les six bandes jouent ensemble, plein cadre | Un grondement grave sous les dernières |
| 2,27 – 3,43 | 3,9 – 6,3 | La rangée se referme vers une ligne au milieu, en trois marches | **Repli en trois marches**, sur les temps 4, 5 et 6, un souffle chacune |
| 3,43 – 3,97 | 6,3 – 7,3 | Noir (16 images) | — |
| 3,97 – 5,27 | 7,3 – 10 | « A · Summer · In » et le titre brouillé apparaissent d'un coup sur le noir ; le titre se brouille puis se pose (image 158) | **Titre qui se décode**, sur un impact puis des tics |
| 5,27 – 5,73 | 10 – 11 | Le titre posé sur le noir (14 images) | — |
| 5,73 – 13,27 | 11 – 26,3 | Une bande de vidéo s'ouvre derrière le titre et grandit jusqu'au plein cadre ; 56 plans y défilent | **Bande qui revient et grandit**, **montage éclair**, musique étouffée |
| 13,27 – 14,70 | 26,3 – 29 | Le titre disparaît d'un coup ; un wapiti tenu 1,43 s | **Respiration** : presque le silence |
| 14,70 – 16,90 | 29 – 33,5 | Un skateur de dos sur une route de montagne, la caméra le suit | La musique revient pleine sur la coupe |
| 16,90 – 17,20 | 33,5 – 34 | Le ciel et la montagne du plan suivant derrière la route, les sapins et le skateur (9 images) | **Le décor change derrière ce qui est devant** |
| 17,20 – 19,73 | 34 – 39 | Deux randonneurs devant un pic, image fixe ; le skateur détouré y reste 14 images puis disparaît (17,67 s, temps 35) ; à 18,73 s (temps 37), le rocher et le randonneur du plan suivant apparaissent à droite | **La personne reste, le lieu change** ; **le premier plan du plan suivant arrive avant son décor** |
| 19,73 – 20,70 | 39 – 41 | Le plan du surplomb au coucher du soleil, image fixe, son randonneur à la même place | — |
| 20,70 – 22,60 | 41 – 45 | Un homme au sac à dos, détouré, surgit au premier plan (20,70 s) ; le décor change deux fois derrière lui (21,17 et 21,60 s), il ne bouge pas de place | **La personne reste, le lieu change** |
| 22,60 – 22,64 | 45 | Noir (la dernière image) | — |

## Effets (ce qu'on veut savoir refaire)

### 1. Bandes qui entrent une à une
- **Mesuré** : six bandes verticales égales (un sixième de la largeur chacune, environ 120 px sur 720), sur toute la hauteur, côte à côte sans trait entre elles. Chacune entre d'un coup, en une image (ni volet ni glissement), de gauche à droite, aux images 4, 9, 14, 19, 26 et 32 : toutes les 5 à 7 images (0,19 s en moyenne). Chacune est une autre vidéo qui joue, cadrée sur son sujet (un wapiti, une personne sur un rocher, au milieu de leur bande). Aucun zoom posé : une bande dérive de 8 px, c'est le mouvement de sa caméra. Chaque bande arrive avec un « tchh » clair (un bruit aigu de 0,1 à 0,2 s, comme un déclencheur), 1 à 3 images après elle. Un grondement grave monte sous les deux dernières et s'éteint vers 2,2 s.
- **Sur quoi** : six vidéos différentes de son lieu. Ce qui remplit le mieux une bande étroite : un sujet debout et au centre (une personne, une porte, une vitrine, une bouteille, une lampe, une plante).
- **Outil** : six `Footage` côte à côte (code du modèle, comme v1 ; `Split` s'arrête à quatre panneaux, `Tiles` découpe une seule image). Le « tchh » : voir l'effet 6.
- **Si rien ne s'y prête** : toujours faisable ; avec trois vidéos, deux moments de chacune.

### 2. Repli en trois marches
- **Mesuré** : la rangée de bandes se referme du haut et du bas vers le milieu, en trois marches de 6 images chacune, à vitesse constante (sans adoucissement) : 100 → 51,7 % de la hauteur (images 69 à 74), tenu jusqu'à l'image 83, → 22,7 % (84 à 89), tenu jusqu'à 97, → 0 (98 à 103). Les marches partent toutes les 14 à 15 images, soit un temps : les temps 4, 5 et 6. C'est un masque : l'image est rognée, pas écrasée (comparée au plan entier, la marche à 51,7 % ressemble à 0,97 à son milieu rogné, à 0,64 au plan écrasé). Chaque marche part 1 à 2 images après un souffle (whoosh) clair de 0,2 s. Puis 16 images de noir.
- **Sur quoi** : rien de particulier : c'est la forme qui fait l'effet, sur n'importe quelles bandes.
- **Outil** : code du modèle (une boîte `overflow: hidden` dont la hauteur descend par marches). Les souffles : voir l'effet 6.

### 3. Le titre qui se décode sur le noir, et ses trois petits mots
- **Mesuré** :
  - À l'image 119 (3,97 s, temps 7,3), tout apparaît d'un coup sur le noir, 3 images après un impact sec : les petits mots, et le titre déjà brouillé (« s4A 87ADNAS T0jDSMX »). Le brouillage reste figé 12 images (119 à 130).
  - De 131 à 149, quatorze chaînes au hasard, comme tapées sur un clavier (« sdj b732ASa TsdjsSM », « MN1 LAKSMD Y78SA ») : tout le titre change à la fois, toutes les 1 ou 2 images ; chaque mot garde à peu près sa longueur.
  - De 150 à 157, des sosies qui se rapprochent des vraies lettres (« T21 C232SA AS212S », « TH3 C4N2IAS R02K2S », « TH3 CaNadiAN R0CKi2S », « THe CAN4DIAN ROCKIEs »).
  - Posé à l'image 158 (5,27 s, sur le temps 10), sur le dernier tic. Sous le brouillage, des tics et des grésillements numériques de 4,33 à 5,27 s, après un vrai silence. 39 images en tout.
  - Le titre « THE CANADIAN ROCKIES » tient sur une ligne : les capitales d'une sans humaniste régulière (type Open Sans, rien de gras), blanc pur #FFFFFF, sans ombre ni contour, un espacement normal. Ses capitales font 9,85 % de la hauteur (40 px sur 406 ; 5,6 % de la largeur), de 48,8 à 58,6 % de la hauteur. Il couvre 7,1 à 92,6 % de la largeur (85,5 %), centré.
  - Les petits mots « A », « Summer », « In » sont en casse normale (pas en capitales), dans la même police, avec un espacement léger (environ 0,15 em, pas clair à 0,05 près). Leurs capitales font 3,7 % de la hauteur (15 px : 0,38 fois le titre). Ils sont posés de 41,9 à 45,8 % de la hauteur, 12 px au-dessus du titre : « A » sur le bord gauche du titre, « Summer » au centre, « In » sur son bord droit. Les deux lignes forment un bloc centré dans l'image (50,2 %). Titre et petits mots restent sans bouger jusqu'à 13,27 s, puis partent d'un coup.
- **Sur quoi** : son nom, son lieu, sa rue ou son quartier (court, une ligne) ; trois petits mots qui y mènent (« Un · samedi · à », « Bienvenue · chez · … », « Le · matin · au »).
- **Outil** : `Decode` (existant ; `hold` 12, `scramble` 19, `every` 1,4 pour une chaîne toutes les 1 ou 2 images, `resolve` 8 ; l'original mêle plus de minuscules à ses chaînes) ; les petits mots dans un élément `data-fauve-accent` (l'exception du kit pour « A · Summer · In » au-dessus d'un titre). L'impact et les tics : voir l'effet 6.

### 4. La bande qui revient et grandit
- **Mesuré** : à l'image 172 (5,73 s, temps 11), en même temps que la musique, une bande de vidéo s'ouvre d'un coup derrière le titre : 92 px de haut (22,7 % de la hauteur, 7,8:1), centrée. Ce sont exactement les lignes où le repli l'avait laissée au temps 5. Puis elle grandit à vitesse constante (1,4 px par image, 0,34 % de la hauteur), sans adoucissement, pendant tout le montage éclair, jusqu'au plein cadre vers 13,1 à 13,27 s (temps 26). L'image dedans ne grossit pas : c'est un masque qui s'ouvre, pas un zoom (mesuré : échelle 1,00 d'une image à l'autre).
- **Sur quoi** : rien de particulier (c'est un cadre de cinéma qui s'ouvre sur n'importe lequel de ses plans).
- **Outil** : code du modèle (une boîte `overflow: hidden` qui grandit linéairement, comme v1). `Letterbox` ne le fait pas : ses barres glissent en quelques images, adoucies, pas sur 7,5 s.

### 5. Le montage éclair dans la bande
- **Mesuré** : 56 plans entre les images 172 et 397. Le 1er et le 30e font 5 images, les 54 autres 4 images chacun (0,133 s : 7,5 plans par seconde), réguliers comme une machine du premier au dernier, sans accélérer. Environ 50 vidéos différentes : 6 reviennent une fois, 29 plans plus loin. On y voit des paysages, des animaux, des aurores, des cascades, un skateur, des randonneurs de dos ; quelques-uns sont des images arrêtées. 4 images, c'est un peu plus qu'une double croche de la musique (3,7 images) : les coupes glissent sur la pulsation sans la suivre exactement, l'œil ne le voit pas.
- **Sur quoi** : toutes ses vidéos, en morceaux de 4 images pris à des moments différents de chacune : gestes, visages, détails, la salle, la rue, la vie du lieu.
- **Outil** : `Footage at=…` (existant) : le code coupe lui-même ses morceaux de 4 images dans quelques passages choisis, plutôt que 56 cases à remplir.
- **Si rien ne s'y prête** : avec peu de vidéos, les morceaux reviennent (l'original en répète 6) ; avec des photos seulement, 8 images par photo (un demi-temps).

### 6. Le son : bruitages, musique étouffée, respiration, retour
- **Mesuré** :
  - Les bruitages de l'ouverture : six « tchh » à 0,21 · 0,38 · 0,56 · 0,74 · 0,92 · 1,10 s, un grondement grave de 0,7 à 2,2 s, trois souffles à 2,26 · 2,73 · 3,20 s, un impact sec à 3,87 s, des tics de 4,33 à 5,27 s.
  - La musique entre à 5,76 s, avec la bande, étouffée jusqu'à 13,27 s ; elle s'arrête sur un dernier coup quand la bande est pleine et le titre part. Puis le wapiti tenu 1,43 s presque en silence. Elle revient pleine sur la coupe du skateur (14,70 s, temps 29).
  - Chaque coupe et chaque apparition de la fin tombe sur un coup, à 2 images près : temps 29, 33½ (l'accent à contretemps), 34, 35, 37, 39, 41, 42, 43 et 45.
- **Sur quoi** : rien dans ses vidéos : c'est sa musique et ses bruitages. Le wapiti : un de ses plans calmes, fixe, qui tient 1,5 s (un visage, un animal, une tasse qui fume, son lieu au repos).
- **Outils** : deux manquent. (1) **Les bruitages d'un skill** : un skill n'a pas de `sounds` ; il faudrait que sa timeline pose les siens à leurs images, comme le motion designer (« camera shutter » à chaque bande, « whoosh » à chaque marche, un impact, des tics). (2) **Une musique qui se façonne** : qu'elle n'entre qu'au temps 11, filtrée en « radio » (un passe-bande d'environ 150 Hz à 2 kHz dans le mix) jusqu'au temps 26, coupée pour la respiration, pleine au temps 29.
- **Si rien ne s'y prête** : la musique pleine dès le début, sans bruitages ; la respiration reste en image (le plan calme tenu).

### 7. Le décor change derrière ce qui est devant
- **Mesuré** : de 16,90 à 17,20 s (images 507 à 515, l'accent à contretemps du temps 33½), le ciel et la montagne du plan suivant remplacent ceux du skateur. La route, les sapins et le skateur restent devant et continuent de bouger. La limite suit le bord des sapins, pas une ligne droite ; le décor posé derrière est une image fixe.
- **Sur quoi** : un plan avec un premier plan net et un fond dégagé. Par exemple : un comptoir et la salle derrière, une table de terrasse et la rue, une porte ou une fenêtre et le dehors, des plantes devant un mur. Le fond devient celui d'un autre de ses lieux, ou d'un autre moment.
- **Outil** : manquant, **le premier plan d'un plan par sa profondeur** : ce qui est plus près qu'un seuil, découpé à chaque image (un `Subject near`), pour poser le décor d'un autre plan derrière. `Depth` existe, mais il dessine une passe grise, pas un masque. En attendant : `Subject shot={n}` (la personne seule) ou `Subject object="…"` (une chose nommée : « counter », « bicycle ») sur la `Footage` du plan suivant.
- **Si rien ne s'y prête** : une coupe franche sur le temps 33½.

### 8. La personne reste, le lieu change
- **Mesuré** :
  - À 17,20 s (temps 34), le plan suivant (deux randonneurs devant un pic) arrive en entier, et le skateur détouré y reste à la même place de l'image, en mouvement, 14 images. Il disparaît d'un coup à 17,67 s (temps 35).
  - À 20,70 s (temps 41), un homme au sac à dos, détouré, surgit en une image au premier plan du surplomb. Le décor change deux fois derrière lui, en coupe franche (21,17 s, une vallée et un lac ; 21,60 s, une montagne, un glacier et un lac turquoise, temps 42 et 43). Il reste à la même place (au milieu, de 40 à 56 % de la largeur, de la mi-hauteur au bas), sa lumière ne change pas.
  - Les décors sont des images fixes (deux images de suite identiques à 0,02 près) : seules les personnes détourées bougent.
- **Sur quoi** : elle, quelqu'un de l'équipe ou une cliente, filmée en entier (debout, qui regarde, qui marche), posée sur ses autres lieux : ses photos de sa devanture, de sa salle, de sa rue, de sa terrasse. Ou son produit (un gâteau, un sac, un bouquet), qui reste pendant que les lieux défilent derrière.
- **Outil** : existant, `Subject shot={n}` posé sur la `Footage` d'un autre plan, une photo ou une image tenue (`hold`) : le « fond remplacé » du kit. Pour un produit : `Subject object="…"`. La faire disparaître sur un temps : le code cesse de la dessiner.
- **Si rien ne s'y prête** (personne en entier dans ses vidéos, rien à détourer) : des coupes franches sur les mêmes temps (34, 41, 42, 43).

### 9. Le premier plan du plan suivant arrive avant son décor
- **Mesuré** : à 18,73 s (image 562, temps 37), l'éperon rocheux et son randonneur, découpés dans le plan suivant, apparaissent d'un coup à droite des deux randonneurs, à la place exacte qu'ils auront ensuite. Une seconde plus tard (19,73 s, temps 39), le reste du plan arrive autour d'eux : son ciel, son pic, son lac. C'est l'inverse de l'effet 7. Gemini y a vu « un second marcheur qui le rejoint ».
- **Sur quoi** : la personne ou la chose du plan suivant (la coiffeuse, une chaise, la table dressée, son vélo), posée en avance sur le plan d'avant.
- **Outil** : existant pour une personne ou une chose nommée : `Subject shot={suivant} at={…}` (ou `object="…"`) sur le plan d'avant, puis la coupe. Pour un premier plan entier (le rocher et son randonneur ensemble), le même manque que l'effet 7.
- **Si rien ne s'y prête** : une coupe franche sur le temps 39.

### 10. Étalonnage
- Ombres vert-bleu sombre (#0A1514 à #16261E) et hautes lumières crème (#EDE9E0, #F3E5D9, #F5EBE6), pas orangées.
- Des couleurs douces : saturation moyenne de 0,2 à 0,4, sauf le vert du wapiti (0,6).
- Des noirs un peu levés sur la moitié des plans (15 à 19 sur 255 : le skateur, les randonneurs, le surplomb).
- Pas de vignettage (les coins sont en moyenne plus clairs que le centre), pas de grain qui bouge (sur un plan fixe, deux images de suite sont identiques).
- Aucun zoom posé par le monteur, ni en transition ni en poussée lente : la bande grandit par son masque, et la seule caméra qui avance est celle qui suit le skateur.

## Format
**Depuis le 6 novembre** (Tristan, sur sept bancs : « vertical please », « tout vertical please ») : `vertical` par défaut, plein écran, ses fichiers horizontaux recadrés sur leur sujet ; `horizontal` (sa bande) seulement à sa demande, ou quand elle veut ses vidéos entières (le `frame` letterbox de son contrat) ; `auto` (comme ses vidéos, ci-dessous) seulement si elle le demande. `docs/modeles.md`, « Réglages d'un modèle ».

L'original est une vidéo horizontale 16:9 (720 × 406), montrée telle quelle : ses bandes, sa bande et son titre vivent dans ce cadre. Réglage « format » (comme `frappe`) :
- `auto` : horizontal quand la plupart de ses vidéos le sont, sinon vertical.
- `horizontal` : tout dans un cadre 16:9 sur du noir, comme l'original. Les bandes font 180 px de large, la bande grandit jusqu'au cadre 16:9.
- `vertical` : plein écran. Les six bandes font 180 × 1920 px. La bande s'ouvre à 23 % de la hauteur (1080 × 442 px, presque le 2,39:1 du cinéma) et grandit jusqu'au plein écran. Le titre garde sa part de la largeur au-dessus du milieu ; sous le milieu, il tient dans 800 px (les boutons à droite).
- Ses vidéos de l'autre sens sont recadrées sur leur sujet. Les personnes détourées de la fin doivent être entières dans le cadre choisi.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** :
- le format, les six bandes de gauche à droite (0,13 à 1,07 s, « environ 150 ms par colonne ») et leur fermeture vers une ligne ;
- le titre brouillé sur le noir et sa place : sa boîte (6,8 · 41,5 · 86,4 × 17 %) est juste à un point près (7,1 · 41,9 · 85,5 × 16,7 % mesurés), et la fin du brouillage à 5,27 s ;
- la bande qui s'élargit jusqu'au plein cadre, les coupes très rapides, l'arrêt du rythme à 13,27 s ;
- les bruitages des bandes et du titre, l'étalonnage.

**Raté** :
- le **tempo** : 115 au lieu de 122 ;
- les **trois marches** du repli sur trois temps : il dit un écrasement continu de 1,07 à 3,37 s ;
- la **police** : il dit géométrique, Futura ou Montserrat, avec un titre gras ; c'est une humaniste, tout en régulier. La hauteur des capitales : 8,5 % au lieu de 9,85 % ;
- la **bande** : elle part de 23 % de la hauteur, là où le repli l'avait laissée, et grandit jusqu'à 13,27 s ; il dit 2,39:1 et plein cadre à 12,33 s ;
- des coupes **régulières de 4 images**, pas « sur chaque impact » ;
- la **musique étouffée** sous la bande, son retour pleine à 14,70 s, les trois souffles du repli et l'impact sous le titre ;
- **toute la fin par couches** :
  - le décor qui change derrière le skateur (16,90 s) ;
  - le skateur emporté dans le plan suivant puis effacé (17,20 à 17,67 s) ;
  - le rocher et le randonneur du plan suivant posés avant leur décor (18,73 s) ;
  - l'homme détouré qui surgit (20,70 s) et les deux décors qui changent derrière lui (21,17 et 21,60 s : il en fait un seul plan) ;
  - et le fait que ces décors sont des images fixes.

## Ce que le modèle v1 ratait
Le skill actuel (`skills/decode.ts`, version 2) et sa lecture (`house-models.ts`), plan par plan :
- **Format et nombre de bandes** : il joue tout en vertical. Il pose cinq bandes au lieu de six, chacune révélée par un volet tous les demi-temps, au lieu d'entrer d'un coup toutes les 5 à 7 images.
- **Repli** : un seul mouvement adouci, au lieu de trois marches linéaires sur trois temps.
- **Titre** : son décodage dure 50 images (figé 6, brouillé 28, posé 16) au lieu de 39 (12, 19, 8). Il ajoute une ombre au titre, que l'original n'a pas. Ses petits mots sont en capitales très espacées (0,32 em), en graisse 500, et arrivent l'un après l'autre ; dans l'original, ils sont en casse normale, peu espacés, et arrivent avec le titre.
- **Bande** : elle s'ouvre à 560 px en 10 images, puis grandit en 24 images vers la fin (sa lecture la met même avant le titre, à 1,9 s, et la fait grandir en 1,2 s). Dans l'original, elle s'ouvre d'un coup à 23 % après le titre et grandit à vitesse constante pendant 7,5 s.
- **Montage dans la bande** : une dizaine de plans au plus, de 2, 1 puis ½ temps, « de plus en plus vite », au lieu de 56 plans de 4 images réguliers.
- **Sortie du titre** : il s'efface en fondu, au lieu de partir d'un coup avec la musique.
- **Ce qui manque** : pas de respiration. Pas de fin par couches : il met des plans larges plein cadre, 4 temps chacun, puis un carton de fin que l'original n'a pas.
- **Musique** : « cinematic indie folk, guitare acoustique » au lieu d'un beat électro, d'abord absent, puis étouffé, coupé et plein.
- **Finition** : hautes lumières orangées (#FF9A50), grain et coins sombres, que l'original n'a pas.

## Le modèle v3 (5 novembre)
Réécrit sur cette fiche (`packages/agent/src/skills/decode.ts`, version 3), rendu en local sur les douze plans horizontaux de la fleuriste et quatre de leurs images comme ses photos (`scripts/skill-render.mts`, aucun appel facturé) :
- **Format** : réglage `format`, `auto` par défaut (16:9 sur du noir, 1080 × 608 au milieu du cadre, quand la plupart de ses fichiers sont horizontaux, lu sur `shots[i].aspect`), `horizontal`, `vertical` (plein écran). Ses photos restent fixes, ses vidéos jouent ; aucun zoom : les bandes et la bande sont des masques.
- **Temps et cases** : 122 BPM, chaque partie comptée en temps depuis le début du Reel : l'ouverture 11,75, la bande 15,25, le plan calme 3, la fin 16 (le plan suivi 6, le lieu 4, le suivant 2, la personne 4) : 22,63 s. Ses cases commencent à 2 images au plus des changements de l'original (0, 173, 398, 443, 531, 590, 620) et ses moments aussi (bandes 4, 9, 14, 19, 26, 32 ; marches 69, 84, 98 ; titre 119 à 158 ; 509, 561, 634, 649 ; noir 678). De 9 à 16 cases : le montage éclair en prend 3 à 10, ses deux dernières sont deux autres de ses lieux, vus derrière la personne à la fin. Jusqu'à 23 pour une durée demandée : ses plans en plein écran après le plan calme, deux temps chacun (29,5 s).
- **Bandes et repli** : six bandes de 180 px posées d'un coup, chacune jouée depuis son entrée : son plan d'ouverture, puis ses plus longs passages, d'autres fichiers d'abord (la fin s'y montre en avance, comme le wapiti de l'original) ; le repli en trois marches linéaires de 6 images (51,7 %, 22,7 %, rien).
- **Titre** : le titre en capitales régulières blanches, aussi large que sa place le permet (110 px au plus en 16:9, pour que le bloc tienne dans les 22,7 % de la bande, 138 px ; 150 px au plus en plein écran, où elle s'ouvre à 436 px ; tenu dans 800 px sous le milieu, à gauche des boutons) ; les petits mots à 0,375 de sa taille, en minuscules, dans sa police, espacés de 0,15 em, sur ses bords ; `Decode` 12, 19 et 8 images ; tous partis d'un coup au plan calme. Un bord sombre fin (2 px au plus) que l'original n'a pas : en blanc seul, le titre se perdait sur ses roses pâles et ses murs clairs.
- **Bande et montage éclair** : ouverte à 22,7 % avec la musique, elle grandit à vitesse constante jusqu'au plein cadre ; dedans, une coupe toutes les 4 images (8 avec des photos seules) : 56 morceaux de toutes ses cases, le montage d'abord, autant de chacune, pris d'un bout à l'autre de chaque passage, dans un ordre qui ne boucle pas, jamais deux fois la même de suite.
- **Fin par couches** : le sujet détouré du plan suivi (la personne, sinon ce qui est devant) reste quand le lieu change derrière lui au temps 34,5, le lieu figé comme les décors de l'original, puis part au temps 36 ; le sujet du plan suivant arrive en avance à sa place au temps 38 ; la personne détourée reste sur le lieu au temps 42, puis devant deux autres de ses lieux (43, 44) ; la dernière image noire. Sans détourage (personne, rien de net devant) : des coupes franches sur les mêmes temps. Vue en local avec des détourages grossiers faits sur place (GrabCut d'OpenCV, pas `matte.py`) : la fleuriste aux roses qui reste quand le mur aux tournesols remplace la chambre froide, le bouquet rouge posé en avance, la fleuriste en gris devant deux autres coins de la boutique.
- **Son** : ses bruitages (un déclencheur par bande, un grondement, un souffle par marche, un impact, un tic toutes les 3 images sous le brouillage) ; sa musique muette sous l'ouverture, « radio » sous la bande, arrêtée sur un dernier coup quand la bande est pleine, pleine de nouveau sur le temps 30 jusqu'à la dernière image (`music`).
- **Finition** : sans grain ni coins sombres, couleurs douces, noirs un peu levés (`finish`).
- **Ce qui manque** : le premier plan d'un plan par sa profondeur (effets 7 et 9 : la route et les sapins qui restent, le rocher et son randonneur) : en attendant, la personne ou la chose détourée ; la traîne de la musique qui s'éteint sur le plan calme (une pause coupe net ; **fait en v4** : sa traîne de 0,6 s, `tail`, et sa musique qui entre sur son premier temps avec la bande et reprend sur un temps après la respiration, `docs/son.md`, « Pause qui laisse sa traîne ») ; un détourage pour les seuls plans qui servent (`subjectPassages` détoure tous les passages vidéo du Reel jusqu'à 30 s ; fait le 5 novembre : son déroulé dit les trois de sa fin, `cutouts`, `docs/detourage.md`, « Seuls les plans où elle est dessinée sont détourés »).
- **Au catalogue** (`house-models.ts`, `HOUSE_VERSION` 11) : sa lecture sur ce déroulé (les bandes, le repli, le titre, la bande et son montage éclair, le plan calme, la fin par couches), ce qu'il lui faut (3 à 12 fichiers), sa finition « Vert et crème » sans le préréglage `cine` ni grain ni coins sombres (ombres #16261E, hautes lumières #EDE9E0, virage 0,3, saturation −0,1, noirs levés 0,05, et le contraste 0,06 de la finition de son code), sa musique (« upbeat electro-pop travel beat, kick and clap on every beat, 16th-note pulse »), le corps de sa paire (`decodage` : Open Sans 400 en minuscules un peu espacées, la police du titre) et ses coupes (`house-measures.ts` : les 56 plans de 4 images du montage éclair, puis le plan calme et la fin).

## Ce qu'il faut filmer
- Six plans de son lieu, chacun avec un sujet debout et au centre (une personne, une porte, une vitrine, une bouteille) : chacun sera vu dans une bande étroite.
- Beaucoup de petits moments différents : une dizaine de vidéos de 5 à 10 s (la salle, les gestes, les visages, les détails, la rue). Le montage éclair en prend 56 morceaux de 4 images.
- Un plan calme et fixe qui tient 1,5 s.
- Un plan qui suit quelqu'un, avec un premier plan net et un ciel ou un fond dégagé.
- Elle, ou quelqu'un de l'équipe, filmée en entier, caméra fixe, debout ou qui marche, sur un fond simple : on la détoure.
- Des photos de ses lieux prises à la même hauteur (sa devanture, sa salle, sa rue, sa terrasse) : ce sont les décors qui défilent derrière elle.
