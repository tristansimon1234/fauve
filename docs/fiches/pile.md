# « Pile de photos » (`pile`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original et en images à 30 i/s ; pas de « temps » ici : sa musique n'a pas de tempo.

**L'original** : `house/originals/pile.mp4`, 9,13 s (274 images ; le son va jusqu'à 9,17 s), 720 × 1280, 30 i/s, **vertical 9:16** plein cadre, avec son. Aucune coupe : une seule page blanche où 37 photos se posent puis repartent.
**Sa musique** : ni batterie ni tempo. Un accord tenu (la, mi, si, avec un sol ; stable de 2,5 à 7,9 s) et, par-dessus, un cliquetis sec qui ralentit sans cesse, comme une roue qui finit de tourner (quel instrument au juste : pas clair) : 40 tics par seconde à 0,3 s, 17 à 1,5 s, 10 à 2,3 s, 6 à 3,3 s, 4 à 4,3 s, 3 à 5,1 s, 2 à 6,4 s, 1,5 à 7,6 s, jusqu'à un coup sec à 7,96 s, le plus fort du Reel. Après, 10 dB plus bas et plus clair (sol, si, ré) : des notes rapides, 12 par seconde, jusqu'à la fin. La mesure disait 92 BPM, Gemini 88 : faux, les écarts entre deux tics grandissent du début à la fin, aucun coup ne revient à intervalle fixe.
**Mesuré avec** : `scripts/fiche/measure.py` (format, son ; « aucune coupe » est juste), la différence de chaque image avec la précédente (chaque pose, chaque départ, sa boîte au pixel près), une reconstruction de chaque image à partir de ces poses et départs (pour vérifier les départs cachés), les attaques du son par bande de fréquences, des planches à 30 i/s, et la lecture de Gemini (`house/breakdowns/pile.json`).

## Déroulé

| De – à (s) | Images | Le son | Ce qu'on voit | Effets |
|---|---|---|---|---|
| 0 – 0,10 | 0 – 2 | Le cliquetis part, très vite | Page blanche, les quatre mots jaunes seuls | — |
| 0,10 – 2,53 | 3 – 76 | 40 → 10 tics par seconde | 28 photos se posent d'un coup, une toutes les 2 ou 3 images (11 par seconde), en zigzag du haut de la page vers le bas | **Pose en rafale** ; de 1,6 à 2,7 s, chaque pose sur un tic |
| 2,53 – 3,80 | 76 – 114 | 8 → 5 par seconde | Sept photos de plus en plus espacées (4, 5, 4, 6, 6, 6, 7 images) | **La rafale ralentit** |
| 3,80 – 4,10 | 114 – 123 | 5 par seconde | La pile au plus plein (35 photos) ; rien ne bouge 9 images | — |
| 4,10 – 6,43 | 123 – 193 | 4 → 2 par seconde | Le haut commence à partir pendant que les deux dernières se posent en bas (4,10 et 4,33 s) ; la pile se vide par le haut, une photo toutes les 2 ou 3 images | **Chaque photo repart 4 s après sa pose** |
| 6,43 – 7,97 | 193 – 239 | 2 → 1,5 par seconde ; coup sec à 7,96 | Les départs s'espacent ; l'avant-dernière part sur le coup sec | — |
| 7,97 – 8,13 | 239 – 244 | — | La dernière (deux voitures sur une route) seule 5 images | — |
| 8,13 – 9,13 | 244 – 273 | Plus doux et plus clair | Les quatre mots seuls sur le blanc (1 s) | — |

## Effets (ce qu'on veut savoir refaire)

### 1. Pose en rafale, en zigzag sur une page blanche
- **Mesuré** : 37 photos posées de 0,10 s (image 3) à 4,33 s (image 130). Chacune apparaît entière en une image : ni chute, ni zoom, ni glissé, ni rotation (bords droits au pixel), ni ombre, ni bord. Toujours par-dessus les précédentes, et rien ne bouge dans une photo posée (les 37 sont fixes). 34 sont recadrées **au carré**, de 185 à 318 px de côté (26 à 44 % de la largeur, côté médian 34 %), 3 en portrait (2:3 deux fois, dont la première ; 4:5 une fois), aucune en paysage. Elles descendent en dix allers-retours de 4 ou 5 photos (de gauche à droite, puis de droite à gauche) : chacune décalée de 13 % de la largeur sur la précédente, dont elle couvre la moitié (30 à 84 %), et 1,5 % de la hauteur plus bas. Les centres vont de 24 à 76 % de la largeur et de 22 à 78 % de la hauteur ; pleine, la pile couvre de 8 à 92 % de la largeur et de 10 à 88 % de la hauteur, les mots au milieu.
- **Sur quoi** : le portfolio d'un photographe (voitures, portraits, scènes de vie). Dans ses vidéos à elle : **ses photos de son travail en série** (coupes, plats, pièces, produits, son lieu, son équipe), d'autant mieux qu'elles sont nombreuses et changent de couleur. Une vidéo y entre comme une photo, figée sur son meilleur instant ; plusieurs instants d'une même vidéo font plusieurs photos.
- **Outil** : existant, la composition du modèle : `Footage` dans la boîte de chaque photo, cadrée sur son sujet (`focus`), une vidéo figée sur un instant avec `at`. `Stack` (existant) ne fait pas cette pile : intervalle fixe, pile en vrac autour d'un centre, penchée et ombrée par défaut, et il retire la dernière posée d'abord.
- **Si rien ne s'y prête** : sous 20 images, des carrés plus grands sur la même surface, et Edith lui demande d'abord si elle en a d'autres (`peu_de_fichiers`) ; jamais deux fois la même image.

### 2. La rafale qui ralentit, sur un son qui ralentit
- **Mesuré** : les 28 premières à cadence fixe, une toutes les 2 ou 3 images (0,09 s en moyenne, 11 par seconde) jusqu'à 2,53 s ; puis les 9 dernières de plus en plus espacées : 4, 5, 4, 6, 6, 6, 7, 9 et 7 images (0,13 à 0,30 s). Le cliquetis ralentit tout du long (voir « Sa musique ») : avant 1,6 s, il va plus vite que les photos ; de 1,6 à 2,7 s, chaque photo tombe sur un tic, à une image près ; après, elles ralentissent avec lui sans tomber exactement dessus (1 à 3 images à côté).
- **Sur quoi** : la musique de son Reel.
- **Outil** : les moments des poses, existant (le code du modèle et ses repères). Le son, **manquant** : une musique qui ralentit jusqu'à s'arrêter. Le compositeur ne fait que des boucles continues à tempo fixe, sans arrêt ni fin (`brief`, `beatGrid`, `alignMusicInSandbox`), et un bruitage dure 3 s au plus, à 0,25 s du suivant au moins. Le son de l'original ajouté par elle dans Instagram (« Utiliser l'audio », `posts.music.mode` = `model`) existe pour un Reel qu'elle envoie à recopier, pas pour un modèle d'Edith.
- **Si rien ne s'y prête** : sa musique à tempo fixe, et le ralenti dans l'image seulement.

### 3. Chaque photo repart 4 s après s'être posée
- **Mesuré** : 28 des 37 restent exactement 120 images (4,0 s), puis disparaissent d'un coup, en une image, ce qui découvre celles d'en dessous ; trois partent sans que ça se voie (déjà recouvertes). La pile se vide donc par le haut, au rythme où elle s'est faite, 4 s plus tard : une photo toutes les 2 ou 3 images de 4,10 à 6,43 s, puis plus espacées. **Pas de pile pleine tenue** : rien ne bouge seulement 9 images (3,80 à 4,10 s), et le haut part pendant que les deux dernières se posent en bas. Six partent plus tôt : la 17e (après 110 images) et la 31e (après 55) sans raison visible, et les quatre dernières de 4 à 16 images plus tôt, pour que la pile soit vide sur le coup sec (l'avant-dernière part sur lui, image 239 ; la dernière 5 images après, à 8,13 s).
- **Outil** : existant, la composition du modèle. `Stack` fait l'inverse (la dernière posée part la première, en glissant).

### 4. Quatre mots fixes, devant la pile
- **Mesuré** : « THIS / IS / MY / WORK », un mot par ligne, en deux paires ; centré (le bloc de 39 à 61 % de la largeur, de 26,3 à 70,6 % de la hauteur) ; hauteur des capitales 7,2 % de l'image (92 px) ; 48 à 50 px (3,8 % de la hauteur) entre les lignes d'une paire, 98 px (7,7 %) entre les deux paires. Capitales grasses très étroites, comme étirées en hauteur : à la même hauteur, Anton est 1,5 fois plus large, et leurs barres horizontales (20 px) sont presque deux fois plus épaisses que leurs fûts (11 px). Lettres qui se touchent presque (2 à 8 px). Jaune #FBD201, ni contour ni ombre, de la première image à la dernière, toujours devant toutes les photos. Sur le blanc, ce jaune contraste à peine (1,4 pour 1) : il se lit par sa taille, et mieux sur les photos.
- **Sur quoi** : sa phrase de 2 à 4 mots courts.
- **Outil** : existant : `FitText` dans la composition ; l'étirement, un `scaleX` d'environ 0,66 sur Anton (paire « affiche »).

### 5. Page blanche, fin sur les mots seuls
- **Mesuré** : fond #FDFDFD uni du début à la fin (ni grain, ni vignettage, ni texture) ; les mots seuls 3 images au début et 1 s à la fin (8,13 à 9,13 s), pendant que le son repart plus doux. Aucun zoom ni poussée nulle part : tout se pose et part d'un coup.
- **Outil** : existant, la composition du modèle.

### 6. Étalonnage
Aucun sur l'ensemble : la page reste #FDFDFD et chaque photo garde ses couleurs (chaudes, argentiques : le style du photographe, dans ses photos, pas un filtre du montage). Les siennes gardent les leurs.

Pas des effets : un trait gris d'1 px au bord droit jusqu'à 4,97 s (un défaut d'export) ; les 15 « clignotements » que la mesure trouve avant 3,3 s sont des photos vues 2 à 5 images avant d'être recouvertes.

## Format
L'original est vertical 9:16, et la page blanche est toute l'image. Ses photos y sont recadrées au carré (34 sur 37) ou en portrait (3), jamais en paysage. Celles d'elle, horizontales ou verticales, entrent pareil : recadrées sur leur sujet. Réglage « format » de ce modèle : `carré` (défaut, comme l'original : une sur douze en portrait pour casser la grille), `à sa forme` (chacune garde la sienne, comme la v1), `portrait` (toutes en 4:5). Le Reel reste vertical.

## Ce que Gemini a vu, et ce qu'il a raté
Vu : le format, la page blanche, les quatre mots jaunes et leur boîte (juste), la pile qui se construit puis se vide, la dernière photo (deux voitures sur une route), les mots seuls à la fin, pas de voix. Faux : la **musique** (« boom-bap lo-fi, 88 BPM, batterie » : ni batterie ni tempo, un cliquetis qui ralentit sur un accord tenu) ; des « vidéos en boucle » et des « travellings » (37 photos fixes) ; des mots « parfois sous certaines couches » (toujours devant) ; une pause pile pleine de 4,40 à 6,77 s et un démontage à partir de 6,77 s (elle se vide dès 4,10 s, sans pause) ; une photo « toutes les 4 à 8 images » (2 ou 3). Raté : le ralenti des poses, les 4 s de chaque photo, le zigzag, les carrés, les lettres étirées.

## Ce que le modèle v1 ratait
Il comptait 110 BPM et une photo par sixième de temps : la cadence de départ était juste (0,09 s), mais il ne ralentissait que les 3 dernières, deux fois, au lieu des 9 dernières, de 1,5 à 3,4 fois. Il tenait la pile pleine un demi-temps avant de la vider, alors que chaque photo part 4 s après sa pose, le haut pendant que les deux dernières se posent (ses centres, `PX` et `PY`, étaient justes, mais s'arrêtaient à la 35e). Ses photos gardaient leur forme (de 0,72 à 1,6) au lieu du carré, ses vidéos bougeaient dans la pile, et ses mots, en Anton sans étirement, étaient 1,5 fois trop larges. Il demandait 8 à 12 fichiers : l'original pose 37 photos, et sous 20 il n'y a plus de rafale. Sa fiche (`look`) disait « une photo toutes les 0,2 s », une musique « punchy drums » et un jaune #ffe100 (mesuré : #FBD201, que son code avait bien).

## Ce qu'il faut filmer
20 à 40 photos de son travail (ou de courtes vidéos : chacune donne une ou plusieurs photos), qui changent de couleur et de cadrage, le sujet au centre : elles seront recadrées au carré et vues au tiers de la largeur, donc des gros plans qui se lisent petits. Sa plus belle en dernier : c'est celle qui part la dernière. Et une phrase de 2 à 4 mots qui dit qui on est.
