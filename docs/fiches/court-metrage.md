# « Court métrage » (`court-metrage`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de la grille de ses coupes depuis son premier temps (0,49 s).

**L'original** : le lien de Tristan https://vm.tiktok.com/ZGdXrMR9G/ (`house/originals/court-metrage.mp4` une fois gardé ; au labo, `lab/models/7937e61f-41a8-4af3-b337-81364e6ba741.mp4`), 24,40 s (732 images), 720 × 406, 30 i/s, **horizontal 16:9**, avec son (AAC stéréo, −10,3 LUFS). Dans ce cadre, l'image elle-même fait **720 × 371 (1,94:1)**, ses **coins arrondis** (un rayon de 30 px : 8 % de sa hauteur, 4,2 % de sa largeur), posée sur un **noir doux** (14, 12, 13) : 17 px de marge en haut, 18 en bas, aucune sur les côtés. Un petit film de voyage en huit plans, sans personne qui parle : une chambre au soir, une rue de Paris au couchant, un métro, un tram, un quai de gare, un train à quai, la vitre d'un ferry, une terrasse au bord d'un fleuve devant une vieille ville. Tout l'original sert au modèle (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : un lo-fi calme, des accords de piano feutré frappés sur le temps, des nappes douces, une basse ronde et une grosse caisse légère sur chaque temps (la bande sous 120 Hz plus forte de 4 dB sur le temps, repliée sur la grille), un shaker sur le contretemps (2 à 8 kHz, +3,5 dB aux six dixièmes du temps), rien au-dessus de 8 kHz (−85 à −93 dB : étouffé, comme un vinyle). **Une boucle de quatre accords, un accord par mesure de quatre temps, un plan par accord** (lus sur le spectre : fa mineur, ré bémol, la bémol, la bémol puis mi bémol, et de nouveau fa mineur sur la pellicule qui saute, ré bémol, la bémol). **Elle n'entre qu'à 3,96 s**, sur la première coupe (+25 dB d'un coup) : avant, le bruit d'un projecteur. Sa basse manque sur la première mesure (3,96 – 6,8 s), entre au temps 9 (6,8 s), repart de 13,9 à 17,8 s (autour de la pellicule qui saute) et revient au temps 25 (18,04 s) ; elle s'éteint avec l'image (de −12 à −32 dB entre 23,65 et 24,2 s). **Tempo** : les sept coupes tiennent à une image près sur **85,5 BPM** (un temps toutes les 0,7018 s, le premier à 0,49 s ; régression sur leurs premières images, écarts de 0 à 0,03 s) ; les attaques de la musique donnent 85,3 (`measure.py` : 85,25, premier temps à 0,434 s) : les coupes tombent une image après ses temps. Gemini disait 75 BPM : faux.
**Mesuré avec** : `scripts/fiche/measure.py` (format, coupes, clignotements, tempo), toutes les images extraites, des planches à 30 i/s de chaque passage, des mesures au pixel (la boîte de l'image et ses coins, la fente qui s'ouvre ligne par ligne, la place et la couleur du titre, les brûlures zone par zone, les lignes et les perforations de la pellicule qui saute, la luminosité du fondu, le grain, les coins), la corrélation de phase pour la caméra de chaque plan, le son par bandes, ses attaques, son spectre par passage, replié sur le temps, et la lecture de Gemini (`house/breakdowns/court-metrage.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,13 | −0,7 – −0,5 | Ses quatre premières images : le plan de la chambre avec son titre entier | **La vignette** (effet 11) |
| 0,13 | −0,5 | Le noir, un déclic | Effet 8 |
| 0,17 – 2,50 | −0,5 – 2,9 | Une fente au milieu, qui s'ouvre à vitesse égale sur la chambre (le soleil du soir dessine la fenêtre sur le mur, un tableau, une étagère et ses paniers) ; le bruit d'un projecteur, pas de musique | **La fente** (effet 3), effets 1 et 8 |
| 2,57 | 3 | Le titre posé d'un coup : « MOMENTS » en haut, « SHORT / CINEMA » au milieu, « Archived by : your name » en bas, en jaune citron ; un déclic | **Le générique** (effet 2) |
| 3,83 – 4,13 | 4,8 – 5,2 | Une brûlure entre par la gauche et blanchit l'image ; la coupe dessous à 4,0 s ; la musique entre | **La brûlure** (effet 4), effet 7 |
| 4,0 – 6,83 | 5 – 9 | Une rue au couchant à contre-jour, des passants, des reflets de soleil ; la caméra avance à peine | **Un plan par mesure** (effet 6) |
| 6,83 – 9,6 | 9 – 13 | Le plafond d'un métro en contre-plongée, ses lampes, ses fenêtres | La basse entre (effet 7) |
| 9,6 – 12,4 | 13 – 17 | Un tram qui descend une grande avenue pleine de monde, caméra posée | — |
| 12,4 – 15,03 | 17 – 20,7 | Une foule de dos sur un quai, le long d'un train | La basse part à 13,9 s |
| 15,03 – 15,33 | 20,7 – 21,1 | Une brûlure, la pellicule qui remonte par à-coups six images, le nouveau plan sur le temps 21 (15,2 s), une image crème, une brûlure | **La pellicule qui saute** (effet 5), un bruit de pellicule (effet 8) |
| 15,2 – 18,03 | 21 – 25 | Un train à quai sous un auvent, en plein soleil rasant | — |
| 18,03 – 20,87 | 25 – 29 | Une femme assise regarde la mer et des falaises par la vitre d'un ferry | La basse revient |
| 20,87 – 24,40 | 29 – 34,1 | Des gens assis de dos au bord d'un fleuve, devant une vieille ville et sa cathédrale ; le fondu au noir de 23,90 à 24,37 s | **Le fondu au noir** (effet 9) |

Les plans sont des images de banque (l'original les a pris tels quels, certains peut-être ralentis : pas mesurable) ; ce qui fait le Reel, c'est leur projection et leur rythme.

## Effets (ce qu'on veut savoir refaire)

### 1. Une image de pellicule projetée : coins arrondis sur un noir doux
- **Mesuré** : tout du long, l'image occupe 720 × 371 du cadre 720 × 406 (lignes 17 à 387), 1,94:1, toute la largeur ; ses quatre coins arrondis d'un rayon de 30 px (la première colonne éclairée passe de 29 à 0 entre les lignes 17 et 45) ; autour, un noir doux (14, 12, 13), jamais pur. Aucun coin assombri dans l'image elle-même (coins plus clairs que le milieu sur la moitié des plans). C'est le cadre d'un vieux projecteur, la « fenêtre » de la pellicule.
- **Sur quoi** : n'importe quels plans. À l'horizontale, ils remplissent la bande sans rien perdre (un 16:9 y perd 4 % en haut et en bas) ; en vertical, la même idée tient le cadre entier, ses coins arrondis et une fine marge noire en haut et en bas.
- **Outil** : le code du modèle (une boîte aux coins arrondis qui coupe ses plans, `Footage` dedans).
- **Si rien ne s'y prête** : toujours possible.

### 2. Le générique : trois niveaux posés d'un coup sur un temps
- **Mesuré** : à l'image 77 (2,57 s, temps 3), une fois la fente ouverte, les trois lignes arrivent ensemble, entières, à leur place, sans fondu ni mouvement, et restent jusqu'à la coupe (4,0 s, environ deux temps) :
  - en haut, **un petit mot en capitales serif un peu espacées** (« MOMENTS », capitales de 9 px, 2,4 % de la hauteur de l'image ; centré à 10 % de sa hauteur ; le mot fait 7,9 fois sa capitale : un interlettrage d'environ 0,1 em, pas 0,22 comme la v1) ;
  - au milieu, **le titre en grandes capitales serif sur deux lignes serrées** (« SHORT / CINEMA » : capitales de 35 px, 9,4 % de la hauteur de l'image, 27 % de sa largeur ; 5 px seulement entre les deux lignes ; centré à 48,5 % de sa hauteur), un serif de titre **à fort contraste** (déliés très fins, empattements plats et nets, des lettres larges : un O presque rond, un M aux jambes écartées), sa graisse régulière (fûts de 0,17 de sa capitale), « CINEMA » 5,4 fois sa capitale, les deux lignes à la même largeur (« SHORT » un peu plus grand et plus espacé) ; mesuré sur ses pixels le 6 novembre : Noto Serif Display 500 est le plus proche (fûts 0,16, « CINEMA » 5,5), Cormorant Garamond 600, que disait cette fiche, est plus étroit et plus pâle (0,15, 5,85), Playfair Display et Bodoni Moda plus étroits ; son H a une barre ondulée qu'aucune famille de Google Fonts n'a ;
  - en bas, **une signature en petit romain** (« Archived by : your name », 2,2 % de la hauteur, centrée à 90 %), droite, étroite et serrée : pas un italique (la v1 le croyait, d'après Gemini).
  Les trois **jaune citron** (le cœur des lettres #F4EE48, la médiane #E6E329 : rouge et vert égaux, pas de bleu ; pas l'or #F3C94E que dit Gemini), tous centrés sur la largeur, sans ombre ni bande. Un déclic tombe dessus (effet 8).
- **Sur quoi** : son titre de film, sur son premier plan : son nom ou ce que raconte le film, un petit mot d'ouverture, sa signature (« par Maison Farine »).
- **Outil** : le code du modèle (`FitText`, sa paire « Générique de film » : Noto Serif Display depuis la v2, `font-pairs.ts`). Le titre ne reste que deux temps (1,4 s) : une signature de 4 mots est notée trop rapide par le contrôle des scènes (il lui en faut 2,0) ; à 3 mots, elle passe.
- **Si rien ne s'y prête** : le titre seul ; son premier plan assombri dessous quand il est clair (l'original est une chambre dans la pénombre).

### 3. L'image qui s'ouvre depuis une fente
- **Mesuré** : image 4 (0,13 s), noir. De l'image 5 à l'image 75 (2,50 s), **deux bandes noires s'écartent depuis la ligne du milieu, à vitesse parfaitement égale** : la part montrée vaut (image − 3,86) × 0,0140 de la hauteur (6 px à l'image 5, 84 à l'image 20, 187 à l'image 40, 291 à l'image 60, toute l'image à l'image 75), sur toute la largeur, bords droits. L'image ne bouge pas dessous : c'est un masque, pas un zoom. Ce n'est **pas un clignement** (Gemini : « fermeture et réouverture ») : rien ne se ferme, l'image ne fait que s'ouvrir.
- **Sur quoi** : son premier plan, calme.
- **Outil** : le code du modèle (un `clipPath` sur son plan). `Letterbox` (des bandes qui glissent) ne part pas d'une fente fermée.

### 4. La brûlure de pellicule qui blanchit la coupe
- **Mesuré** (images 115 à 124, la coupe à l'image 120) : 115, une ombre de rouge ; 116, un rouge-orangé profond qui entre par la gauche (#A44310 à gauche, #5B3622 à droite) ; 117, tout l'orange (#DD900C à gauche, #C87016 à droite) ; 118, orange-ambre (#E49F1B) ; **119, jaune pâle presque blanc (#E8E090), le titre encore deviné dessous** ; 120, la rue arrive lavée d'orange à gauche et de jaune à droite (#DD9524 → #E7D265) ; 121 à 123, la lumière s'en va vers la droite (#D79539 au milieu, puis #B4763C) ; 124, plus rien. La musique entre sous elle.
- **Sur quoi** : n'importe quelle coupe.
- **Outil** : `Burn` du kit (une lumière posée en écran, image par image autour de sa coupe), avec ces images-là (`steps`).

### 5. La pellicule qui saute dans le projecteur (le moment signature)
- **Mesuré** (images 451 à 461, le nouveau plan à l'image 456, temps 21) : 451, une brûlure du jaune pâle à gauche au rouge-orangé à droite (#E8D989 → #E47135) ; **452 à 457, la pellicule remonte par à-coups** : deux images empilées, séparées par une ligne noire de 31 px (8,4 % de la hauteur), chacune un peu plus étroite que la fenêtre (18 px de chaque côté, 2,5 % de la largeur), ses coins arrondis ; le haut de la ligne à 31,5 %, 21,3 %, 90,8 %, 82,5 %, 10,5 % puis 81,4 % de la hauteur (des sauts de 39, 144, 31, 267 et 140 px : rien de régulier) ; à gauche, une perforation crème (#AEA87B, 26 × 78 px : 21 % de la hauteur, au milieu de chaque image) qui dépasse du bord ; les deux images montrent le quai jusqu'à l'image 455, puis le nouveau plan dans les deux à partir de 456 ; **458, une image crème unie (#EBE5BB), brûlée** ; 459, une brûlure de l'orange à gauche au jaune citron à droite (#E5AA3B → #E3E974) ; 460, un reste rouge dans le coin en bas à droite ; 461, posé. Deux bouffées de bruit (14,95 et 15,21 s), aussi fortes que la musique. Il tombe au milieu du film, sur le retour de la boucle d'accords (fa mineur), et la basse s'est retirée deux temps avant.
- **Sur quoi** : n'importe quelle coupe entre deux plans ; le plan qui arrive plein de lumière (un quai au soleil, sa rue, ses clients qui entrent).
- **Outil** : le code du modèle : son plan dessiné deux fois (`Footage`) dans deux cadres décalés, la ligne et les perforations dessinées, `Burn` avant et après, l'image crème. Aucun outil du kit ne fait « la pellicule qui saute » ; il ne manque rien pour la dessiner.
- **Si rien ne s'y prête** : toujours possible.

### 6. Un plan par mesure, coupé sur l'accord
- **Mesuré** : après l'ouverture (4 s), sept plans de quatre temps chacun (2,77 à 2,87 s), coupés sur un nouvel accord ; le dernier tenu 5,1 temps jusqu'à la fin. Que des coupes franches, sauf la brûlure de la première et la pellicule de la cinquième. Caméras posées ou qui avancent doucement (corrélation de phase : 0 px de dérive sur la chambre et le fleuve, 18 px en 2,6 s sur la rue, 29 px sur le ferry qui tangue) ; ce qui bouge est dans le cadre (passants, tram, train, la mer).
- **Sur quoi** : les moments de sa journée, chacun dans une vraie lumière.
- **Outil** : le déroulé du skill sur ses temps (`beatSpans`), la musique composée au tempo et calée sur ses coupes.

### 7. La musique qui entre sur la première coupe, sa basse qui part et revient
- **Mesuré** : sous l'ouverture, pas de musique : un souffle (0,15 – 2,35 s, platitude 0,48, centré vers 3 kHz, −32 dB), une nappe très douce (−35 dB) ; la musique entre à 3,96 s (le temps 5, sa grosse caisse), sans basse sur sa première mesure ; la basse entre au temps 9, part au temps 19 (13,9 s), revient au temps 25 (18,04 s), une petite relance d'aigus juste avant (17,6 – 17,98 s).
- **Outil** : la forme de la musique d'un skill (`music` : un départ tardif sur sa première coupe, `pauses` depuis 0 ; `thin` sur la première mesure et autour de la pellicule ; `end` en fondu ; `docs/son.md`, « Forme de la musique d'un modèle »).
- **Tant qu'il manque** : la nappe douce sous l'ouverture (la musique composée ne peut pas commencer par sa propre nappe seule) : le projecteur la remplace.

### 8. Les bruits du projecteur
- **Mesuré** : un déclic sec à 0,139 s (le noir ; très aigu, au-dessus de 8 kHz), le ronronnement d'un projecteur sous la fente, un déclic sur le titre (2,54 s, temps 3), deux bouffées de bruit sur la pellicule qui saute (14,95 et 15,21 s).
- **Outil** : les bruitages d'un skill (`sounds` de son déroulé : « film projector switch click », « old film projector running », « film projector click », « film reel flutter », faits une fois par la bibliothèque de sons).
- **Si rien ne s'y prête** : bruitages coupés (`sfx` off), seule la musique.

### 9. Le fondu au noir de la fin
- **Mesuré** : de l'image 717 (23,90 s) à l'image 731 (24,37 s), le dernier plan s'éteint à vitesse égale (luminosité de 115 à 15) jusqu'au noir doux ; la musique s'éteint avec lui.
- **Outil** : le code du modèle (un noir qui monte) et la fin de la musique (`end` en fondu).

### 10. Étalonnage
**Doré, chaud et riche** (mesuré de nouveau le 6 novembre, plan par plan, au milieu de chacun) : les tons moyens franchement ambrés, le bleu à la moitié du rouge (la rue 98/71/37, le métro 103/81/38, le quai 76/62/36, le train 120/85/43), les ombres brunes (41/30/15), les hautes lumières crème (199/161/91) ; saturation de 0,38 à 0,59 (0,18 sur le fleuve bleu-vert, 0,35 sur la chambre) ; noirs à peine relevés (2e centile de 10 à 25), hautes lumières retenues (98e de 200 à 223) ; la chambre très sombre (médiane 35). Chaque plan garde sa couleur (le ferry vert, le fleuve), mais tout est tiré vers l'or. Ni grain visible (copie à 0,35 Mb/s), ni coins assombris. La v1 posait « film » sur chaque plan (contraste 0,96, saturation 0,86, sépia 0,14) et « Pellicule dorée » (noirs relevés, contraste baissé) sur tout : ses plans sortaient gris et plats, saturation 0,11 à 0,31 (Tristan : « lumière ne va pas »).
- **Outil** (v2) : le code du modèle pose sa lumière sur ses plans seulement (`sepia(0.45) saturate(1.7) contrast(1.05) brightness(0.93)`, essayé sur quatorze vidéos libres : tons moyens ambrés, saturation 0,3 à 0,52, noirs et hautes lumières gardés) ; son titre, son noir doux et ses brûlures gardent leurs couleurs mesurées. Réglage `lumiere` : `doree` (par défaut) ou `naturelle` (ses plans tels que filmés).

### 11. La vignette : ses quatre premières images
- **Mesuré** : les images 0 à 3 sont le générique entier (le plan, ses trois lignes), puis le noir à l'image 4 : la vignette qu'un fil affiche par défaut (la première image) est le titre du film, pas un noir.
- **Outil** : le code du modèle les refait. **Manquant** : dans l'app, la vignette par défaut d'un Reel est son image à 1,2 s (`DEFAULT_COVER_SECONDS`), ici la fente à moitié ouverte, tant qu'elle n'en choisit pas une ; il faudrait qu'un skill puisse donner la sienne (2,7 s, sur le titre).

## Ce qui appartient à l'original
« MOMENTS », « SHORT CINEMA » et « Archived by : your name » sont les mots du modèle CapCut que son auteur a repris (« your name » est même resté tel quel) : **à l'original, jamais recopiés**. Le modèle écrit les siens : un petit mot, le titre de son film, sa signature. Ses plans de voyage (Paris, un tram, un ferry, une cathédrale) sont des images de banque : ils ne disent que ce qu'il faut filmer.

## Format
**6 novembre** : quand tous les modèles sont passés en vertical par défaut (Tristan : « tout vertical please »), celui-ci a gardé le sien, `auto` : sa pellicule projetée aux coins arrondis sur un noir doux est sa signature ; `horizontal` est sa bande (ses vidéos entières, à sa demande), `vertical` le plein écran à sa demande. `docs/modeles.md`, « Décisions de Tristan sur les originaux ».

L'original est horizontal (16:9), son image en 1,94:1 aux coins arrondis. Réglage « format » :
- `auto` (par défaut) : en horizontal quand la plupart de ses vidéos le sont (1080 × 557 au milieu du cadre, sur le noir doux), sinon plein écran ;
- `horizontal` : comme l'original ; une vidéo verticale y perd l'essentiel de sa hauteur (le remplisseur la garde pour l'autre format) ;
- `vertical` : le cadre entier, coins arrondis, une marge noire de 4,2 % en haut et en bas ; le titre et ses petits mots un tiers plus grands, sa signature remontée au-dessus du quart du bas.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format horizontal et le cadre aux coins arrondis, les huit plans et leurs coupes (à 0,1 s près), leur contenu, une coupe toutes les 2,8 s environ, les trois lignes du titre et leurs places à peu près, un serif élégant, la brûlure de la première coupe (3,86 – 4,00 s), « la pellicule qui défile » vers 15,0 – 15,3 s (« glissement vertical rapide simulant un saut d'image »), le fondu au noir final (24,00 – 24,33 s), un piano feutré lo-fi sans drop.

**Raté** : le **tempo** (75 au lieu de 85,5) ; une « fermeture et réouverture d'obturateur » de 0,13 à 2,13 s là où l'image ne fait que s'ouvrir depuis une fente, à vitesse égale, jusqu'à 2,50 s ; le titre « de 0 à 3,86 s », alors qu'il n'est là que sur les quatre premières images (la vignette) puis de 2,57 s à la coupe ; sa **couleur** (un or #F3C94E au lieu d'un jaune citron) ; la musique qui **n'entre qu'à la première coupe**, ses **bruits de projecteur** (deux déclics, un ronronnement, la pellicule) et sa **basse qui part et revient** ; la pellicule qui saute **par à-coups**, ses perforations, son image crème et ses deux brûlures ; un « étalonnage doré uniforme » (le ferry et le fleuve ne le sont pas) et un grain « présent partout » (rien de mesurable). `measure.py`, lui, avait le bon tempo (85,25), mais prenait le pic de la brûlure (image 119) et l'image crème (458) pour des coupes, et ses « clignotements » sont des choses qui passent (le soleil de la rue, le tram, la lumière du train) : rien ne s'allume.

## Le modèle v1 (5 novembre)
`packages/agent/src/skills/court-metrage.ts`, version 1, rendu en local sur une journée de café (huit vidéos horizontales libres de Mixkit : une tasse le matin, une rue vue d'en haut aux longues ombres avec un tram, une pancarte retournée sur « ouvert », une machine à café qui fume, le café tassé, un latte art, une tasse servie, un train au bord de la mer ; `scripts/skill-render.mts`, aucun appel facturé). Ses coupes : images 120, 204, 288, 373, 457, 541 et 625 (l'original : 120, 205, 288, 372, 456, 541 et 626), 24,40 s pour ses huit plans, 85,5 BPM.
- **Cases** : quatre à huit plans de ses fichiers (douze pour une durée qu'elle demande : 35,6 s à son tempo, 42 s au plus à son tempo le plus lent, 72 BPM) : l'ouverture (5,7 temps, le titre s'y pose), un plan par mesure, la pellicule qui saute sur le sixième (sur son dernier quand elle en a moins de sept), le dernier calme et large (5,1 temps) en fondu au noir. Trois mots : un petit mot en capitales espacées (`surtitre`, facultatif), le titre de son film (`titre`), sa signature en italique (`signature`, facultative, 3 mots au plus).
- **Images** : les quatre premières, son générique entier (la vignette) ; le noir avec un déclic ; la fente qui s'ouvre à vitesse égale jusqu'à l'image 76 ; le générique d'un coup à l'image 78 (temps 3), en jaune citron #F2EA4A (réglage `couleur` : `jaune`, `sienne` pour sa couleur quand elle se lit sur une image sombre, `blanc`), une ombre légère sous les lettres, son premier plan assombri dessous quand il est clair (`LightUnder`) ; la brûlure de l'original autour de la première coupe ; un plan par mesure ; la pellicule qui saute sur six images aux places mesurées, ses perforations, l'image crème, les deux brûlures ; le fondu au noir des images 717 à 731 ; une carte de fin en option sur le noir, dans son serif et son italique.
- **Son** : la musique part sur la première coupe (un départ tardif sur son premier temps), sans basse sur sa première mesure et de deux temps avant la pellicule à la coupe suivante, éteinte avec l'image ; quatre bruitages (le déclic du noir, le projecteur sous la fente, le déclic du titre, la pellicule qui saute).
- **Léger** : rien de détouré ni de suivi, une seule lecture (la lumière de son premier plan sous le titre) ; 12 500 caractères de code.
- **Ce qui manque** : la vignette par défaut donnée par un skill (effet 11) ; la nappe douce sous l'ouverture (effet 7) ; la boucle de quatre accords, un par plan (la musique composée a ses propres accords : la consigne du compositeur le demande, rien ne le vérifie).

## Le modèle v2 (6 novembre)
Tristan, sur /admin (le banc de Budapest) : « lumière ne va pas, et la police au début pareil ». `packages/agent/src/skills/court-metrage.ts`, version 2 :
- **Lumière** (effet 10) : dessinée par son code sur ses plans, ceux de la pellicule qui saute compris, la lumière dorée de l'original (plus haut) au lieu du gris de « film » ; plus rien de sa finition posé par-dessus (`finish` à zéro : elle teintait aussi son titre, son noir doux et ses brûlures) ; la lecture du catalogue passe à `natural` et sa finition « Pellicule dorée » devient l'or de l'original (pour la chaîne quand elle fait le Reel sans le skill ; `HOUSE_VERSION` 21). Réglage `lumiere` pour garder ses plans tels que filmés.
- **Générique** (effet 2) : son titre en Noto Serif Display 500 (le serif à fort contraste de l'original, mesuré sur ses lettres), un interlettrage de 0,01 em, des lignes à 0,84 ; ses capitales à 9,4 % de la hauteur de l'image comme l'original (73 px en horizontal, 95 en vertical) ; son petit mot espacé de 0,1 em ; sa signature et la ligne de sa carte de fin en romain, plus en italique. La paire « Générique de film » change pour lui seul (`font-pairs.ts`) ; son effet de la banque aussi (`pieces/court-metrage.ts`, v2 : ses lettres, pas sa lumière, qui est celle du Reel où il est posé).
- **Rendus locaux** (vidéos libres verticales de Mixkit, une journée de café, format vertical) : `/tmp/claude-0/renders/court-metrage/v2-vertical-b.mp4` et sa planche `v2-vertical-b-sheet.jpg`. Pas vérifié en local : la musique et les bruitages (pas de compositeur ici), la lecture `LightUnder` en production.

## Ce qu'il faut filmer
À l'horizontale de préférence, dans une belle lumière (le matin, l'heure dorée, un contre-jour), le téléphone posé ou qui avance doucement, 5 s au moins par plan :
1. pour ouvrir, un intérieur calme et plutôt sombre : un rayon de soleil sur un mur, sa salle avant l'ouverture, une tasse qui fume près d'une fenêtre (le titre s'y pose au milieu) ;
2. sa journée en moments : sa rue à l'heure dorée, son trajet (un tram, un vélo, une fenêtre de train ou de bus), son lieu qui ouvre (le rideau, la pancarte), ses gestes, ses clients ;
3. un plan plein de lumière pour la deuxième moitié (la pellicule y saute) : ses clients qui arrivent, sa terrasse en plein soleil ;
4. pour finir, une vue calme et large : l'eau, sa terrasse le soir, des gens de dos qui regardent, sa devanture à la tombée du jour.
