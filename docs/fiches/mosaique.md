# « Mosaïque qui change » (`mosaique`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps.

**L'original** : `house/originals/mosaique.mp4`, le Reel entier (pas de passage dans `HOUSE_PASSAGES`), 6,0 s, 180 images, 720 × 1280, 30 i/s, **vertical 9:16**, avec son. Aucun texte, aucun bruitage.
**Sa musique** : un beat neo-soul / lo-fi hip-hop, **130 BPM** (un temps toutes les 0,4617 s, le premier coup à 0,405 s ; 13 coups, chacun à moins de 9 ms de la grille : sûr). Il est joué en demi-mesure : un clap tous les quatre temps (1,33 · 3,18 · 5,02 s, les temps 2, 6 et 10), qu'on peut aussi compter à 65, le clap sur 2 et 4. Un charleston léger sur presque chaque temps, des accords tenus, une basse ronde ; des bribes de voix selon Gemini (pas clair). Gemini disait 105 : faux. Le modèle dit 100 : c'est le pas des cases, pas la musique. Les cases ne suivent pas la musique (effet 2).
**Mesuré avec** : `scripts/fiche/measure.py` (format, tempo ; aucune coupe, normal : l'image n'est jamais remplacée d'un coup), une mesure case par case (ce qui change dans chacune des 12 cases, image par image), le recalage de chaque case qui arrive (de combien elle penche et se décale), des planches à 30 i/s, des agrandissements des traits et des marges, des couleurs prélevées, un spectrogramme, et la lecture de Gemini (`house/breakdowns/mosaique.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,10 | −0,9 – −0,7 | La 1re photo entière : un dessert en verre sur une table en bois, une cuillère. Elle est déjà coupée en 12 cases posées sur un papier gris clair | Grille (1), photos figées (4) |
| 0,10 – 1,30 | −0,7 – 1,9 | La 2e photo (un poisson sur un risotto, vue du dessus) remplace les cases une à une, de gauche à droite et de haut en bas, une toutes les 3 images (images 3 à 36). Entière 3 images (36 à 38) | Remplacement (2), atterrissage (3) |
| 1,30 – 2,50 | 1,9 – 4,5 | La 3e (un cocktail et sa rondelle d'orange séchée, sur du noir), images 39 à 72. Entière de 72 à 74 | Idem |
| 2,50 – 3,70 | 4,5 – 7,1 | La 4e (des pâtes : la fourchette en haut, l'assiette en bas, sur du vert), images 75 à 108. Entière de 108 à 110 | Idem |
| 3,70 – 4,90 | 7,1 – 9,7 | La 5e (un dessert rond vu du dessus, sur une table ronde, un tissu beige en haut), images 111 à 144. Entière de 144 à 146 | Idem |
| 4,90 – 6,00 | 9,7 – 12,1 | La 1re photo revient case par case (147 à 177). Sa 12e case tombe à l'image 180, la 1re de la boucle | Boucle (5) |

## Effets (ce qu'on veut savoir refaire)

### 1. Une photo coupée en 12 tirages posés sur du papier
- **Mesuré** : 3 colonnes × 4 rangées, soit **12 cases** (pas 3 × 3, comme le dit Gemini). Chaque case fait 231 × 315 px à 720 × 1280 (32,1 % de la largeur × 24,6 % de la hauteur), debout en 3:4. Entre les cases, un trait clair de 2 à 3 px (0,4 % de la largeur) : le papier qui passe. Par endroits, deux cases se touchent sans trait (rangée 2, entre les colonnes 1 et 2). Autour, une marge du même papier, un aplat gris clair chaud #D5D0C6 sans texture : 8 à 10 px sur les côtés (1,2 %), 4 à 5 px en haut et en bas (0,35 %). Les cases sont posées à la main : chacune à 1 à 3 px de sa place, un trait penché d'environ 0,5° (rangée 2, entre les colonnes 2 et 3). La photo reste à sa place dans les cases, qui se rejoignent en une seule image. La grille ne bouge jamais.
- **Plus de cases ?** L'original en a 12. À 3 images par case, une photo met 1,2 s à passer et chaque morceau reste lisible. Avec 24 ou 48 cases, c'est une mosaïque fine qui scintille : un autre effet, à garder en réglage, pas par défaut.
- **Sur quoi** : n'importe quelle série de ses photos de même famille : ses plats, ses produits, ses créations, ses coupes, ses bouquets. Les traits se lisent sur un fond sombre ; sur du clair (l'assiette du risotto), ils se perdent.
- **Outil** : existant, le code du skill (`skills/mosaique.ts` v2 : grille, marges, traits, cases décalées à la main). `Tiles` sait la grille et ses traits, pas la marge de papier ni les cases posées à la main.
- **Si rien ne s'y prête** : avec moins de 4 images différentes, plusieurs passages de ses vidéos (`skillPassages`).

### 2. Le remplacement case par case, sans arrêt
- **Mesuré** : dès l'image 3 (0,10 s), une case change toutes les 3 images (0,1 s), dans l'ordre de lecture : de gauche à droite, de haut en bas. Elle change d'une image à l'autre, sans fondu ni glissé. Une photo met 12 × 3 = 36 images (1,2 s) à couvrir la grille, et la suivante repart aussitôt de la case 1. La grille n'est donc entière que 3 images toutes les 1,2 s (images 36–38, 72–74, 108–110, 144–146) : une case change toujours. Les 59 changements tombent tous à l'image prévue : 3 + 3 × le rang de la case (0 à 11) + 36 × la vague (0 à 4). Ils ne suivent pas la musique : 9 sur 59 tombent à moins de 34 ms d'un temps, ce que donne le hasard. Mais un temps tombe toujours à moins de 50 ms d'un changement : n'importe quelle musique a l'air calée.
- **Sur quoi** : ses photos, ou ses vidéos figées (effet 4), le sujet de chacune au centre : la vague remplace alors un plat par le suivant à la même place.
- **Outil** : existant, le code du skill (ordre `lecture`, une vague de 36 images), et `Footage`, qui cadre chaque image sur son sujet. Manquant dans `Tiles` : l'ordre de lecture (son « top » change une rangée à la fois, dans le désordre). Le pas de 3 images tombe juste à 100 BPM (une case par sixième de temps, une photo en deux temps : le choix du v2) ou à 150 (une case par double croche, une photo en trois temps). À 130, comme l'original, il ne tombe sur rien, et ça ne se voit pas.
- **Si rien ne s'y prête** : toujours possible.

### 3. Chaque case atterrit de travers, puis se pose droite
- **Mesuré** : la case qui arrive reste 3 images (0,1 s) penchée de 0,3 à 2,1° (environ 1° le plus souvent) et décalée de 1 à 3 px, à la même taille. Puis elle se redresse d'un coup à sa place, à l'image où la suivante arrive. Le sens alterne en damier : la 1re case penche vers la gauche (sens inverse des aiguilles d'une montre), la 2e vers la droite, et ainsi de suite. Mesuré sur 39 des 59 arrivées : 36 penchées, toutes dans ce sens alterné, 3 droites ; les autres tombent sur du noir uni, où rien ne se mesure. Penchée, la case déborde un peu sur le trait et la marge. C'est ce qui fait « posé à la main » : des tirages plaqués puis redressés, image par image. Les deux « clignotements » relevés par l'outil (3,60 et 5,70 s) sont deux de ces atterrissages, pas des lumières (aucune case ne s'éclaircit en arrivant).
- **Sur quoi** : chaque case, quelle que soit la photo.
- **Outil** : manquant. Dans le skill : chaque case dessinée comme son propre calque, penchée de ±1° (sens en damier) et décalée de 2 px ses 3 premières images, puis droite. Dans `Tiles` : une arrivée « posée » (`reveal: "land"`) qui fait de même.
- **Si rien ne s'y prête** : il s'applique toujours.

### 4. Des photos figées
- **Mesuré** : entre deux changements, rien ne bouge dans une case (aucune différence d'une image à l'autre). L'original n'a que des photos (5, puis la 1re qui revient) : ni vidéo, ni zoom, ni poussée lente, ni grain qui bouge.
- **Sur quoi** : ses photos ; ses vidéos, chacune figée sur sa plus belle image, comme un tirage.
- **Outil** : existant, `Footage` avec `hold` (une image tenue), sur le départ que choisit le remplissage. Le skill v2, lui, joue ses vidéos dans les cases (à trancher).
- **Si rien ne s'y prête** : —

### 5. La boucle
- **Mesuré** : la dernière vague (4,90 s) ramène la 1re photo. Sa 12e case tomberait à l'image 180, qui est l'image 0 de la boucle : le Reel tourne sans couture (à un détail près : à l'image 0, cette case est déjà droite).
- **Outil** : existant (skill v2 : la dernière vague ramène la première image). Sa carte de fin (des cases de papier où s'écrivent ses mots) n'est pas dans l'original.

### 6. Étalonnage
Des photos de plats sombres, en lumière dure et chaude (un rayon de soleil, des ombres franches) : 42 % et 66 % de l'image sous 16 % de luminosité pour le dessert et le cocktail. Noirs relevés et bruns (#1D1B18, jamais de noir pur), hautes lumières crème vers 78 % (#D8C3A3, jamais de blanc) : un rendu mat et chaud, saturation moyenne. Ni grain, ni vignette (le papier est égal jusqu'aux coins). Le papier, plus clair que toutes les photos, les encadre. Outil : la finition du modèle, `fade` (noirs relevés) et `warmth` (existants), sans grain ni vignette.

## Format
L'original est vertical 9:16 : des photos verticales plein cadre, coupées en 3 × 4 cases debout (3:4), qui remplissent l'image jusqu'à 1 % du bord. Ses images à elle peuvent être horizontales : dans des cases debout, une image horizontale ne garde que son milieu. Réglage « format » : `auto` (vertical quand la plupart de ses images le sont, sinon horizontal), `vertical` (comme l'original : plein cadre, chaque image cadrée sur son sujet), `horizontal` (ses images horizontales entières : 4 × 3 cases couchées dans un bloc 16:9 au milieu du papier, le papier au-dessus et au-dessous, où peut aller son titre), `carré` (3 × 3 cases dans un bloc 1:1, pour un mélange des deux). Chaque format garde le pas de l'original : une case toutes les 3 images.

## Ce que Gemini a vu, et ce qu'il a raté
Vu : le vertical, le remplacement case par case, les plats (dessert en verre, poisson sur risotto, cocktail, pâtes, dessert rond, puis le premier qui revient), la boucle, aucun texte, aucun bruitage, la lumière chaude et les ombres profondes. Raté : la **grille** (3 × 3 au lieu de 3 × 4 : 12 cases), le **tempo** (105 au lieu de 130), l'**ordre** (il propose en diagonale ou au hasard : c'est l'ordre de lecture), le **pas continu** (il donne des transitions séparées par des pauses : il n'y en a aucune), le **calage** (« sur les subdivisions du beat » : non, les cases vont à leur propre pas), l'**atterrissage** de chaque case, le **papier** et ses marges, les **photos figées**. Il coupe la 4e photo en deux (la fourchette et l'assiette sont une seule photo) et invente un grain argentique et une vignette.

## Ce que le modèle v1 ratait
Sa lecture dans le catalogue (`HOUSE_MODELS`) dit une grille « tracée d'un trait blanc », des cases qui changent « au hasard », une image toutes les 0,7 s et une fin tenue une seconde. Sa composition de référence (`B-continu`) aussi : au hasard, une image toutes les 20 images, des traits blancs sur du noir, sans papier. L'original : des tirages posés sur du papier, l'ordre de lecture, une image toutes les 1,2 s, jamais tenue, en boucle. Le skill v2 a corrigé la grille, le papier, l'ordre, le pas de 3 images et la boucle. Il lui manque l'atterrissage des cases. Il joue ses vidéos dans les cases, quand l'original n'a que des photos figées. Sa finition (« Chaud doux ») ajoute un grain et une vignette que l'original n'a pas, sans son rendu mat. Son tempo de 100 vient des cases (une vague en deux temps), pas de la musique (130), et la musique du catalogue (« warm nu-jazz ») n'est pas celle de l'original.

## Le modèle v3 (5 novembre)
Réécrit sur cette fiche (`packages/agent/src/skills/mosaique.ts`, version 3), rendu en local sur les douze vidéos horizontales d'une friperie (`scripts/skill-render.mts`, aucun appel facturé) :
- **Tempo et pas** : 130 BPM, la musique de l'original ; une image en 2,6 temps (36 images), une case toutes les 3 images dans l'ordre de lecture : ses 59 changements tombent sur les images de l'original (3 + 3 × le rang + 36 × la vague). Toute la boucle fait un nombre entier de temps (13 pour 5 images, comme l'original ; pour un autre nombre, le pas bouge d'un dixième d'image), pour que la pulsation continue d'un tour à l'autre. Réglage `vitesse` gardé (une image en 1,2 s, 2,4 s ou 0,6 s).
- **Tirages sur papier** : papier gris clair uni (#D5D0C6), marge de 13 px sur les côtés et de 7 en haut et en bas, trait de 4 px ; chaque tirage à un ou deux pixels de sa place, un sur quatre penché de 0,4° au plus ; l'image reste à sa place d'une case à l'autre.
- **Atterrissage** : chaque case arrive penchée de 0,4 à 1,6°, un coup dans un sens, un coup dans l'autre (la première vers la gauche), décalée de 3 px au plus, débordant sur le trait, le papier visible là où elle n'est pas encore posée, et se redresse d'un coup quand la suivante arrive (3 images).
- **Photos et vidéos** : ses photos restent figées, ses vidéos jouent (décision de Tristan), chacune le temps d'une vague, centrée sur le moment où son image est entière ; la première, quand elle revient, tient l'image sur laquelle le Reel démarre.
- **Boucle et son** : la dernière vague ramène la première image, sa dernière case tombe sur la première image de la boucle ; la musique joue jusqu'à la dernière image et s'arrête net (`music.end`), sans le fondu du mixage ; aucun bruitage. Avec une carte de fin (en option), la dernière vague pose des cases de papier où s'écrivent ses mots, et le mixage fond la musique.
- **Format** : réglage `format`, `auto` par défaut (vertical plein cadre, 3 × 4 cases debout, quand la plupart de ses images sont verticales, lu sur `shots[i].aspect` ; sinon ses images horizontales entières dans un bloc 16:9 de 4 × 3 cases couchées au milieu du papier, son titre en serif sur le papier au-dessus), `vertical`, `horizontal`, `carre` (3 × 3 cases dans un bloc carré, au même pas d'une case toutes les 3 images).
- **Finition** : un tirage mat et chaud (noirs relevés `fade` 0,45, contraste −0,04, chaleur 0,15), sans grain ni coins sombres (`finish`).
- **Ce qui manque** : dans `Tiles`, pour le motion designer, l'ordre de lecture et une arrivée « posée » (`reveal: "land"`), que le modèle fait dans son propre code ; la composition de référence `B-continu` est toujours celle du v1 (au hasard, traits blancs sur du noir) ; au catalogue, son tempo (100), sa finition (grain et coins sombres), sa musique (« warm nu-jazz ») et ses moments (« au hasard », une image toutes les 0,7 s, une fin tenue une seconde).

## Ce qu'il faut filmer
5 à 10 photos de ses plats, produits ou créations (ou des vidéos courtes, dont on fige la plus belle image), toutes verticales et de près. Le sujet au centre, à la même place d'une photo à l'autre, avec un peu de place autour. La même lumière pour toutes (une fenêtre ou un rayon de soleil, des ombres franches), sur un fond sombre et simple ; vues du dessus ou de trois quarts. La plus belle en premier : elle ouvre et ferme la boucle.
