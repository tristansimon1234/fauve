# « Un clic sur tes produits » (`curseur`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original, les images comptées à 30 i/s depuis 0.

**L'original** : le Reel d'un restaurant de brunch (https://www.instagram.com/reel/DZDChwzokNT/, n° 21 de la vague du 5 novembre), à garder dans `house/originals/curseur.mp4` : 10,20 s (306 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son. Trois plans, deux coupes (2,267 et 5,967 s, images 68 et 179). Monté à 24 i/s puis sorti à 30 : une image sur cinq répétée, sur la vidéo comme sur le curseur. Le modèle prend tout l'original.
**Son son** : **aucune musique qu'on puisse compter** : un fond sonore de rue (grave et large bande, sous 300 Hz pour l'essentiel, sans temps, sans accord tenu ; −17,3 LUFS) qui joue de 0 à 1,35 s, **s'arrête net sur le premier clic**, et **revient d'un coup sur le dernier** (7,25 s) jusqu'à la fin. Entre les deux, 5,9 s de silence numérique (−53 dB) où l'on n'entend que **les clics de la souris**. Deux piaillements de poussins à 9,37 et 9,75 s (le gag de l'original). `measure.py` disait 120,25 BPM (ses autres candidats, 136,5 et 102,75, ne s'accordent pas) ; sur ses deux bouts de son (1,35 et 2,9 s), l'autocorrélation par bandes ne trouve aucun tempo commun (80, 101, 128 BPM selon la bande et le bout) ; aucune grille n'explique les huit clics (5 sur 8 au mieux, à 131 BPM). Ce n'est pas une musique rythmée : c'est le son de sa rue.
**Mesuré avec** : `scripts/fiche/measure.py` (ses deux coupes ; ses deux « clignotements », 7,33 – 8,60 s, sont le serveur qui passe au soleil), des planches à 30 i/s numérotées de tout l'original, **le curseur suivi image par image** (un gabarit de la flèche à neuf échelles, sa place et sa taille à chaque image), **les images figées** (l'écart d'une image à la suivante hors du curseur), sa flèche relevée pixel par pixel sur fond uni, les mots et les flèches mesurés sur leurs pixels, les couleurs par tons, le son par bandes toutes les 50 ms et en spectrogramme, sa platitude et sa corrélation gauche-droite, l'intensité (ebur128), et la lecture de Gemini (`house/breakdowns/curseur.json`).

## Sa grille

Aucune : ses moments suivent un geste de souris, pas un temps (ils tombent n'importe où entre deux temps de toute grille essayée). Pour le moteur, ses moments sont comptés à **90 BPM**, un temps toutes les 20 images : son premier clic tombe sur le temps 2, la pause dure jusqu'au dernier clic, et la musique d'Edith repart sur un temps à ce clic. À un autre tempo, tout le suit.

## Déroulé

| De – à (s) | Images | Ce qu'on voit | Ce qu'on entend | Effets |
|---|---|---|---|---|
| 0 – 1,33 | 0 – 40 | La devanture d'un restaurant au soleil, plan fixe ; un serveur sort par la porte, deux assiettes à la main ; à 0,33 s (image 10) **un curseur d'ordinateur** entre par le bord gauche (à 39 % de la hauteur) et file en ligne droite jusqu'à la droite du serveur (images 10 – 31), où il s'arrête | le fond sonore de la rue | 1 |
| **1,33** | **40** | **Clic** à côté du serveur : la flèche se rétracte une image ; **l'image se fige** (dès l'image 41) | **le son s'arrête net** (1,35 s) ; un clic | **2** |
| 1,37 – 2,27 | 41 – 67 | L'image figée ; le curseur glisse sur les assiettes qu'il tient (images 54 – 65) | silence | 2 |
| **2,27** | **68** | **Clic** sur les assiettes : **coupe sur le gros plan des deux plats**, figé lui aussi (une poêle en haut, une assiette en bas, sur le tee-shirt rouge du serveur) | un clic | **3** |
| 2,27 – 2,77 | 68 – 83 | Le curseur monte sur le premier plat (68 – 75), s'en approche (75 – 80) | silence | — |
| **2,77** | **83** | **Clic** : le nom du plat en grandes capitales condensées blanches au-dessus de lui, une flèche fine dessinée à la main du plat au mot, **d'un coup** | un clic | **4** |
| 2,93 – 3,63 | 88 – 109 | Le curseur descend sur le second plat ; **clic** (image 109) : son nom et sa flèche, d'un coup, dans l'espace libre au-dessus et à droite de lui | un clic | 4 |
| 4,13 – 4,70 | 124 – 141 | Le curseur s'écarte à droite, sur le tee-shirt vide ; **clic** (141) : **les deux noms et leurs flèches partent d'un coup** | un clic | 4 |
| 4,80 – 5,97 | 144 – 179 | Le curseur monte en haut de l'image ; **double clic** (174 et 179, 0,17 s d'écart) : **retour sur la devanture**, toujours figée | deux clics | **5** |
| 5,97 – 7,27 | 179 – 218 | La devanture figée, sur une autre image que celle de la pause, un peu plus loin (le serveur a avancé d'un pas : le montage a coupé là) ; le curseur redescend sur le serveur (199 – 213) | silence | 5 |
| **7,27** | **218** | **Clic** sur le serveur : **la vidéo repart** (dès l'image 219) | **le son revient** (7,25 s) ; un clic | **2** |
| 7,27 – 10,20 | 219 – 305 | Le serveur s'en va à droite et sort du cadre (8,5 s) ; le curseur descend vers la gauche, plus lentement, et sort par le bord gauche en bas (image 262, à 82 % de la hauteur) ; les poussins entrent dans le restaurant | le fond sonore ; deux piaillements | — |

Ni zoom, ni poussée, ni fondu, ni flash : deux coupes sèches, chacune sur un clic, et des images figées. Tout l'effet tient à la vidéo qu'on « pilote » comme sur un ordinateur.

## Effets (ce qu'on veut savoir refaire)

### 1. Un curseur d'ordinateur sur une vraie vidéo
- **Mesuré** : la flèche classique d'un ordinateur, **en pixels** (12 × 19 pixels visibles : un corps blanc #FFFFFF cerclé d'un pixel noir, sa queue en escalier), sans ombre ni flou. Au repos elle fait 70 × 108 px sur 720 (9,7 % de la largeur, 8,4 % de la hauteur ; un pixel de la flèche vaut 5,7 px). Elle file **en ligne droite à vitesse constante** d'un point à l'autre (18 à 37 px par image sur 720, soit 2,5 à 5 % de la largeur), puis s'arrête net ; elle tremble à peine à l'arrêt (3 px au plus) ; elle bouge à 24 i/s comme le montage. Elle entre par le bord gauche à l'image 10 et sort par le bord gauche en bas à l'image 262 ; entre les deux, toujours là, par-dessus tout (le gros plan compris).
- **Sur quoi** : n'importe quelle vidéo de son lieu, d'un produit, d'un geste : la flèche dit « c'est une vidéo qu'on regarde sur un écran ».
- **Outil** : `Cursor` existe dans le kit, mais ne fait pas celle-ci : flèche lisse noire au liseré blanc, ombre portée, anneau à chaque clic, trajet amorti. Le code du modèle dessine la flèche en pixels (un SVG net, deux tracés : le blanc et le noir) et ses trajets en ligne droite, d'une image clé à la suivante. À ajouter au kit un jour, pour tous : `Cursor kind="pixel"` sans anneau ni ombre (la fiche d'« Interface minimaliste » demandait déjà un clic sans anneau).
- **Si rien ne s'y prête** : toujours possible.

### 2. Le clic qui met la vidéo en pause, et le son avec
- **Mesuré** : le premier clic (image 40, 1,33 s) fige l'image dès l'image 41 (l'écart d'une image à la suivante tombe de 1,7 à 0,1) et coupe le son net (de 46 à 23 dB en 50 ms, éteint à 1,7 s : une petite traîne). Le dernier clic (image 218, 7,27 s) fait repartir la vidéo dès l'image 219 et le son revient d'un coup à 7,25 s. Entre les deux, **5,9 s sans aucun son que les clics** : c'est la pause d'un lecteur vidéo.
- **Le clic** : la flèche se rétracte sur son centre, **à 69 % de sa taille pendant une image** (84 % l'image d'avant et celle d'après), puis revient ; ni anneau, ni changement de couleur.
- **Sur quoi** : une vidéo de son lieu où quelqu'un bouge (quelqu'un de l'équipe qui sort, sert, s'avance avec ce qu'il porte) : la pause se voit parce que tout s'arrête.
- **Outil** : `Footage` (existant) : un plan tenu sur sa dernière image après son moment, ou joué depuis une autre image (`at`). La musique : `music.pauses` d'un skill (existant, comme « Interrupteur »), son retour posé sur un temps.
- **Si rien ne s'y prête** : une photo à la place de la vidéo : la pause ne se voit pas, le reste joue.

### 3. Le clic sur ce qu'il tient, qui ouvre le gros plan
- **Mesuré** : le second clic tombe sur les assiettes que tient le serveur (à 47 % de la largeur, 60 % de la hauteur) et coupe sur leur gros plan, sur l'image même du clic (68). Le gros plan est **figé** tout du long (l'écart d'une image à la suivante reste sous 0,2) : une image tenue, la poêle en haut à gauche (0 – 43 % de la largeur, 38 – 62 % de la hauteur), l'assiette en bas (3 – 62 %, 63 – 93 %).
- **Sur quoi** : une photo de près de deux de ses produits, nets et séparés, avec de la place libre autour : deux plats, deux pâtisseries, deux boissons, deux pièces, un bouquet et un vase.
- **Outil** : `Footage` tenu sur sa première image (existant) ; le curseur trouve la personne et ce qu'elle tient sur ses suivis (`track` : son corps et ses mains, sur l'image où la vidéo s'arrête).
- **Si rien ne s'y prête** : sans personne suivie, les places de l'original.

### 4. Le clic qui écrit le nom d'un produit, avec sa flèche
- **Mesuré** : sur un clic sur le plat, son nom en **grandes capitales condensées blanches** (une police très étroite, comme Bebas Neue ; blanc chaud #FBF8F3, ni contour ni ombre), là d'un coup, sur l'image du clic, et tenu jusqu'au clic qui les efface. Le premier fait 32 % de la largeur, ses capitales 4,1 % de la hauteur (40,6 – 72,5 % ; 22,9 – 26,9 %), au-dessus et à droite de la poêle ; le second 25 % (61,4 – 86,7 % ; 43,8 – 47,7 %), au-dessus et à droite de l'assiette, dans le vide du tee-shirt. Sous chacun, **une flèche fine dessinée à la main** (un trait de 5 px sur 720, à peine courbe, une pointe ouverte) qui va du plat (sa queue au bord du plat) au mot (sa pointe 26 px sous lui) : 245 et 175 px de long sur 1080. Les deux partent d'un coup sur le clic de 4,70 s. Le second nom ne reste que 1,07 s.
- **Sur quoi** : les noms de ses produits tels qu'on les lit sur sa carte, dans l'espace libre près de chacun.
- **Outil** : `FitText` pour le nom, `Scribble kind="arrow"` dessiné en une image (existants) ; ses produits trouvés sur le gros plan par leur nom (`SubjectBox` avec un objet nommé par le remplisseur, « @produit1 »), sinon les places de l'original. La place du mot : au-dessus de son produit d'abord, sinon dessous ou à côté, jamais sur l'autre produit ni sur l'autre nom, dans la zone sûre, sur un endroit sombre et calme (sa lumière lue sous lui, `LightUnder`) ; sur un fond clair, son encre foncée.
- **Si rien ne s'y prête** : un seul produit, un seul nom.

### 5. Le double clic qui revient, le clic qui relance
- **Mesuré** : le curseur monte en haut de l'image (62 % ; 20 %), double clic (images 174 et 179 : deux clics, 0,17 s d'écart) : coupe sur la devanture, **toujours figée**, sur une image un peu plus loin que celle de la pause (le serveur a avancé d'un pas). Le curseur redescend sur le serveur (50 % ; 62 %), clique : la vidéo repart.
- **Sur quoi** : la même vidéo que le premier plan, reprise là où elle s'était arrêtée.
- **Outil** : `Footage` tenu sur sa première image avant son moment, puis joué (existant).

### 6. Les clics qu'on entend
- **Mesuré** : chaque clic, un vrai bruit de souris : deux petits coups à 80 – 90 ms l'un de l'autre (appui, relâché), aussi forts que le fond sonore, **environ 0,1 s avant** que la flèche se rétracte : 1,21/1,29 · 2,08/2,17 · 2,57/2,66 · 3,45/3,54 · 4,54/4,63 · 5,62/5,71 et 5,79/5,88 (le double clic) · 7,08/7,17 s. Seuls dans le silence, sauf le premier et le dernier.
- **Outil** : les `sounds` d'un skill (existant) : « computer mouse click » sur chaque clic, posé sur l'image où la flèche se rétracte.

### 7. Étalonnage
Chaud et net, à la manière d'un « teal & orange » doux : des ombres bleu-vert (#081215 sur la devanture), des hautes lumières crème (#D2B998), les rouges francs de l'enseigne, du store et du tee-shirt (#87111E au milieu du gros plan). Ni grain, ni coins sombres.

### Ce qui est à l'original, jamais recopié
Le nom et le logo du restaurant (son enseigne, son store, l'inscription de sa vitrine, le logo du tee-shirt), les noms de ses plats (« Shakshuka », « Halloumi »), ses poussins qui traversent le trottoir et rentrent dans le restaurant, leurs piaillements, le son de sa rue. Le modèle met ses produits à elle, leurs noms, sa vidéo et la musique d'Edith.

## Format
L'original est vertical 9:16, ses trois plans plein cadre. Réglage « format » :
- `auto` (par défaut) : comme ses vidéos : une verticale plein écran, une horizontale entière dans une bande 16:9 sur du noir (chaque plan comme il a été filmé : son gros plan vertical s'ouvre alors plein écran entre deux bandes) ; dans une bande, les noms de ses produits sur le noir au-dessus ou au-dessous, leurs flèches dans l'image ;
- `vertical` : tout plein écran, ses vidéos horizontales recadrées sur leur sujet ;
- `horizontal` : tout dans la bande.
Le curseur garde la même taille d'un plan à l'autre (c'est celui de l'écran), un peu plus petit quand tout est en bande.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, les trois plans (à 2,27 et 5,93 s au lieu de 5,97), le curseur en pixels blanc cerclé de noir, les deux noms, leur police, leurs places à 0,3 % près et leurs flèches, des clics à 2,27, 2,73, 3,60 et 5,93 s (à une ou deux images près), l'étalonnage chaud aux ombres bleu-vert, le serveur qui s'en va à droite, les poussins.
**Raté** : **les pauses**, le cœur du Reel (la vidéo qui se fige au premier clic et repart au dernier) ; **le silence** (il entend une pop lo-fi continue à 115 BPM : il n'y a pas de musique, mais le son d'une rue, coupé 5,9 s) ; le premier clic (1,33 s) et le dernier (7,27 s), qui sont la pause et la lecture ; le clic qui efface les noms (4,70 s : il les dit partis à 4,67 s sans clic) ; le double clic (5,80 et 5,97 s : il n'en voit qu'un) ; la flèche qui se rétracte à chaque clic ; la devanture figée après le gros plan ; le curseur qui sort en bas à gauche à 8,73 s (il le dit parti à 8,00 s après un clic sur la façade) ; les clics entendus 0,1 s avant ceux qu'on voit ; des « canetons » qui sont des poussins, et un « cancanement de canard à 9,00 s » qui est deux piaillements à 9,37 et 9,75 s.

## Le modèle v1 (6 novembre)
`skills/curseur.ts`, version 1, dans la bibliothèque (à valider sur /admin). Trois plans : son lieu jusqu'à la pause, le temps de la pause (son gros plan), son lieu qui repart. 10,87 s à 90 BPM : l'original et un temps de plus après le second nom (lu en 1,73 s au lieu de 1,07 s, trop court pour le lire) ; de 76 à 104 BPM (12,9 à 9,4 s), tout le suit.
- **Le curseur** : la flèche classique en pixels (12 × 19, blanche cerclée de noir, 9 px par pixel en 1080 × 1920 : 108 × 171 px, la taille de l'original), dessinée nette, sans ombre ni anneau ; elle file en ligne droite à vitesse constante d'une image clé à la suivante (celles de l'original, relevées image par image) et s'arrête net ; à chaque clic elle se rétracte sur son centre (69 % une image, 84 % celle d'avant et celle d'après). Elle entre par la gauche à l'image 10 et sort en bas à gauche à l'image 282.
- **Ses cibles** : à côté de la personne, à la hauteur de ses mains (son corps et ses mains suivis, `track`, sur l'image où la vidéo s'arrête), puis ce qu'elle tient ; chaque produit du gros plan, trouvé par le nom que lui donne le remplisseur (« @produit1 », « @produit2 » : un peu à droite de son milieu, plus haut) ; un endroit à l'écart des noms pour les effacer ; le haut de l'image pour le double clic ; la personne pour relancer. Rien de lu : les places de l'original.
- **La pause** : son lieu joue 1,37 s puis tient sa dernière image (le premier clic) ; le gros plan est tenu sur sa première image, du clic sur ce qu'elle tient (2,27 s) au double clic (6,63 s) ; son lieu revient, tenu sur sa première image jusqu'au dernier clic (7,93 s), puis il joue. Le remplisseur prend pour le troisième plan la suite de la même vidéo (son départ plus 1,37 s) : elle repart d'où elle s'était arrêtée.
- **Les noms** : ses deux produits (`produit1`, obligatoire ; `produit2`, facultatif ; 18 signes), en capitales de sa police de titre (Bebas Neue quand elle choisit le modèle, paire `condensee-geometrique`), 104 px, blancs à l'ombre douce, là d'un coup sur leur clic et partis ensemble sur le clic qui les efface. Chacun dans l'espace libre près de son produit : au-dessus d'abord (à quatre hauteurs), sinon dessous ou à côté ; jamais sur l'autre produit ni sur l'autre nom ; dans la zone sûre ; là où le plus clair sous lui est le plus sombre (sa lumière lue sur le gros plan, `LightUnder`) ; sur un fond clair, son encre foncée. Une flèche dessinée à la main (`Scribble kind="arrow"`, tracée en une image) va du produit au mot, sur un fin liseré de l'autre ton pour qu'elle se lise aussi sur une assiette blanche.
- **Le son** : la musique d'Edith jusqu'au premier clic, l'arrêt net, puis le retour au dernier clic, sur un temps (`music.pauses`) ; un « computer mouse click » sur chaque clic, aussi fort que la musique (l'original coupe le son de sa rue : le modèle coupe la musique).
- **Format** : `auto`, `vertical`, `horizontal` (plus haut).
- **Carte de fin** en option : le curseur revient par la droite et clique ; son titre en capitales au tiers haut, sa ligne dessous.
- **Ce qui manque** : un curseur en pixels dans le kit, pour tous (`Cursor kind="pixel"`, sans anneau ni ombre : le code du modèle le dessine) ; le son de sa vidéo à la place de la musique (en réglage, à voir avec Tristan) ; l'original revient sur une image un peu plus loin que la pause (son montage) : le modèle reprend là où il s'est arrêté.

## Ce qu'il faut filmer
1. Une vidéo de ton lieu, téléphone posé, de préférence en vertical : quelqu'un de l'équipe qui sort, passe ou s'avance avec ce que tu vends à la main (un plateau, deux assiettes, deux cafés, un bouquet), 5 s au moins, la personne et ce qu'elle porte bien visibles.
2. Une photo de près de deux de tes produits côte à côte (ceux qu'elle porte, de préférence), nets, bien séparés, avec un peu de place libre autour pour leurs noms.
3. Les noms de tes deux produits, comme sur ta carte.
