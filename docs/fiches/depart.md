# « Le grand départ » (`depart`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique (110,9 BPM, un temps toutes les 0,541 s) depuis sa première image.

**L'original** : le n° 23 de la vague du 5 novembre (https://www.instagram.com/reel/C5Lyex9Sdet/, `house/originals/depart.mp4`), 11,17 s (335 images, la dernière noire), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son, **en noir et blanc**. Un voyage en onze secondes : un homme debout sur un trottoir de Paris, un bus passe tout près devant l'objectif et il a disparu ; le trajet en éclairs (un métro, une aile d'avion, la vitre d'un train, un escalator) ; l'arrivée dans une foule de Tokyo, accélérée, et deux petites lignes dorées au milieu.
**Sa musique** : **pas de musique pendant le départ et le trajet** : chaque plan s'entend avec son propre son (la rue, le grondement du tunnel, le moteur de l'avion, le souffle du train). **La musique entre à 3,23 s, avec l'arrivée** : un lo-fi calme et mélodique (guitare et claviers, aucune basse sous 120 Hz), un coup léger toutes les 1,082 s (4,43 · 5,50 · 6,60 · 7,71 · 8,80 · 9,82 · 10,92 s, à 30 ms près), un plus faible juste avant chacun (7,44 · 8,48 · 9,57 · 10,65 s) : un contretemps sur les temps 2 et 4 d'une mesure à **110,9 BPM**. Le cycle de 1,082 s se partage aussi en trois (la pulsation de 164,75 que lit `measure.py`, 0,364 s) : un balancement ternaire. Coupée par la fin de la vidéo. Gemini disait 82 BPM, `measure.py` 79,1 : faux tous les deux (la moitié de la pulsation ternaire).
**Mesuré avec** : `scripts/fiche/measure.py`, la différence et la corrélation de chaque image avec la précédente, le flux optique image par image (Farneback : le mouvement de la caméra et ce qui bouge dedans), les trois zooms recalés sur les images de l'original (la taille et le centre où une image s'emboîte dans une autre), des planches à 30 i/s de tout le Reel, des gros plans du titre et du panneau du bus, les couleurs lues sur les pixels, le son par bandes (niveaux toutes les 50 ms, attaques par bande, spectrogrammes, pics tonaux), la sonie (EBU R128 : −16,5 LUFS) et la lecture de Gemini (`house/breakdowns/depart.json`).

## Déroulé

| De – à (s) | Images | Temps | Ce qu'on voit | Effets |
|---|---|---|---|---|
| 0 – 0,17 | 0 – 4 | 0 – 0,3 | L'homme debout sur le trottoir, de près, puis de plus en plus loin : 2,88 fois (image 0), 2,04 (1 – 2), 1,56 (3 – 4) | Zoom arrière en trois sauts (effet 1) |
| 0,17 – 0,70 | 5 – 20 | 0,3 – 1,3 | Toute la rue, lui au milieu ; un bus entre par la droite (image 9) et cache toute l'image (13 à 20) | 15 i/s (effet 2), le bus (effet 3) |
| 0,70 – 0,83 | 21 – 24 | 1,3 – 1,5 | L'arrière du bus, flou, qui part vers la gauche ; une seule image tenue quatre images | Effet 3 |
| **0,83** | **25** | **1,5** | **Coupe sous le bus** : le même trottoir, sans lui ni le bus | Effet 3 |
| 0,83 – 1,07 | 25 – 31 | 1,5 – 2 | Le trottoir vide, tenu (deux images presque pareilles) | Effet 4 |
| 1,07 – 1,40 | 32 – 41 | 2 – 2,6 | L'avant d'un métro dans un tunnel éclairé, qui fonce | Trajet (effet 5) |
| 1,40 – 1,70 | 42 – 50 | 2,6 – 3,1 | Une aile d'avion sur la piste, par le hublot ; le moteur gronde | Trajet |
| 1,70 – 2,73 | 51 – 81 | 3,1 – 5 | La vitre arrondie d'un train, la ville puis les montagnes qui défilent, deux poteaux qui passent | Trajet |
| 2,73 – 3,20 | 82 – 95 | 5 – 5,9 | Un escalator qui monte vers un panneau d'arrivée ; ses huit dernières images foncent sur le panneau (3,64 fois) | Trajet, la poussée (effet 6) |
| **3,20** | **96** | **5,9** | **L'arrivée : la musique entre** (3,23 s) | Effet 7 |
| 3,20 – 4,93 | 96 – 147 | 5,9 – 9,1 | Une foule serrée au téléobjectif, sombre, **accélérée** | Effet 8 |
| 4,93 – 7,27 | 148 – 217 | 9,1 – 13,4 | La foule devant un bus ; ses six dernières images montent d'un coup sur le panneau du bus | Effet 8 |
| 7,27 – 11,13 | 218 – 333 | 13,4 – 20,6 | Une autre foule, plus claire, accélérée ; à 7,80 s deux petites lignes dorées apparaissent au milieu en fondu (entières à 8,07 s), jusqu'à la fin | Effets 8 et 9 |
| 11,13 – 11,17 | 334 | 20,6 | Une image noire | Un reste du montage : pas à refaire |

## Effets (ce qu'on veut savoir refaire)

### 1. L'image qui recule en trois sauts
- **Mesuré** : ses cinq premières images sont le même plan de plus en plus large, recalé sur la rue entière de l'image 5 : 2,88 fois plus près à l'image 0 (centré sur lui, à 40 % de la largeur et 55 % de la hauteur), 2,04 fois aux images 1 et 2, 1,56 fois aux images 3 et 4 (centrées au milieu), puis la rue entière. Trois sauts nets, sans glissé ni flou : un zoom arrière en paliers d'environ 1,4 fois chacun, en un sixième de seconde. `measure.py` en fait trois coupes « même lieu ».
- **Sur quoi** : n'importe quel plan fixe où quelqu'un se tient au milieu : elle devant sa porte, sa devanture, son comptoir.
- **Outil** : son code pose son plan dans une boîte 2,88, 2,04 puis 1,56 fois plus grande que l'image, centrée sur son milieu (`Footage` dans un cadre qui coupe ce qui dépasse) : existant.
- **Si rien ne s'y prête** : il recule sur le milieu de l'image (une photo aussi).

### 2. Le départ à 15 images par seconde
- **Mesuré** : de l'image 1 à l'image 20, chaque image est tenue deux images (le flux optique est nul une image sur deux) ; puis l'arrière du bus tenu quatre images (21 – 24), le trottoir vide sept (25 – 31, deux images presque pareilles). Le reste du Reel est à 30 i/s. Ce saccadé fait passer le bus en quatre bonds (47 % de l'image à chaque bond) : la coupe sous lui ne se voit pas.
- **Outil** : `Footage hold={2}` (existant).

### 3. Il disparaît derrière le bus (le moment signature)
- **Mesuré** : le bus entre par la droite à l'image 9, flou de bougé, et couvre toute l'image des images 13 à 20 (son flanc sombre, ses vitres, son toit clair) ; aux images 21 – 24 on voit son arrière qui part vers la gauche, encore sur 65 % de l'image (une seule image tenue) ; à l'image 25 la coupe : le même trottoir, cadré pareil, **sans lui et sans le bus** (d'autres voitures garées : une autre prise). L'œil prend la coupe pour le bus qui s'en va : il a disparu.
- **Sur quoi** : n'importe quoi qui passe tout près de l'objectif devant elle (une voiture, un bus, un vélo, quelqu'un), puis le même endroit vide : la fin de sa vidéo une fois qu'elle est sortie du cadre, ou une autre prise.
- **Outil** : ce qui passe devant l'objectif est lu sur ses fichiers (`reads: ["covered"]`, `video_read.py` : « quelque chose passe tout près de l'objectif et cache toute l'image… : une coupe s'y cache »), et le remplisseur cale son passage pour que l'image la plus couverte tombe sur la coupe (existant). Comme le code ne sait pas si sa vidéo en a un, il pose en plus une masse sombre qui passe sur la coupe, de la droite vers la gauche, à 15 i/s : son plan tenu sur l'image d'avant la coupe, agrandi 1,6 fois, filé dans le sens où il passe (un flou horizontal, comme le flanc du bus) et assombri, qui couvre toute l'image six images avant la coupe et une après, puis découvre son lieu vide en partant (comme la bande floue d'« Une journée chez toi », mais filée).
- **Si rien ne s'y prête** : rien ne passe devant elle : la masse dessinée fait le passage ; sans prise de son lieu vide, le premier plan du trajet suit directement.

### 4. Le lieu vide, tenu
- **Mesuré** : sept images du trottoir vide, immobile, avant le trajet ; son passage du son de la rue continue.
- **Outil** : `Footage hold` sur toute sa durée : sa première image tenue (existant).

### 5. Le trajet en éclairs, au son de chaque plan
- **Mesuré** : quatre plans à leur vitesse, de 10, 9, 31 et 14 images (0,33 · 0,30 · 1,03 · 0,47 s) : l'avant d'un métro dans un tunnel (ce qui bouge dedans : 1,4 à 4,5 % de l'image par image), une aile sur la piste (presque fixe), la vitre arrondie d'un train (deux poteaux qui passent aux images 58 et 74), un escalator. **Aucune musique** : chaque plan s'entend avec son son, coupé net avec lui, ce qui fait les attaques que `measure.py` prend pour des coups : la rue de −14 à −20 dB, le tunnel qui gronde (−12 à −16 dB, ses basses), **le moteur de l'avion à 1,39 s, le plus fort du Reel** (0 à −5 dB, tout sous 1 kHz), le souffle large du train jusqu'à 8 kHz (−9 à −13 dB), l'escalator plus calme (−13 à −17 dB) avec un accord doux (fa : 175 · 350 · 700 · 1 050 · 1 575 Hz) dès 2,75 s.
- **Sur quoi** : ce que filme n'importe qui en route : la vitre d'un train, d'un bus ou d'une voiture, la route, un métro, un vélo, des pieds qui marchent, des portes, un escalier.
- **Outil** : ses cases de trajet gardent le son de leur passage (`SkillShot.sound`, existant) ; la musique attend l'arrivée (effet 7).
- **Si rien ne s'y prête** : n'importe quelle vidéo qui bouge ; une photo reste figée.

### 6. La poussée sur ce vers quoi on va
- **Mesuré** : les huit dernières images de l'escalator (88 – 95) foncent sur le panneau d'arrivée en haut à gauche : 1,44 fois à l'image 90, 1,76 à 92, 2,88 à 94, 3,64 à 95, de plus en plus vite, centrées sur le panneau (27 %, 36 %), un peu floues ; la coupe sur la foule au bout. Le deuxième plan de foule finit pareil, sa caméra montant d'un coup sur le panneau du bus (images 212 – 217) : un mouvement filmé, pas un effet.
- **Sur quoi** : la fin de son trajet : un escalier, un couloir, une porte, une enseigne, l'entrée de l'endroit où elle va.
- **Outil** : son code agrandit son dernier plan de trajet sur sa dernière demi-mesure de temps (huit images à son tempo) jusqu'à 3,6 fois, de plus en plus vite (un peu au-dessus du milieu, où sont une enseigne ou une porte), un flou qui monte à 2,5 px (existant : `Footage` dans une boîte qui grandit). Tristan : les zooms d'un original, « on garde ».

### 7. La musique qui arrive avec l'arrivée
- **Mesuré** : sous le trajet, rien que les sons des plans ; la musique entre à 3,23 s, une image après la coupe sur la foule (3,20 s) ; les bruits de la rue disparaissent (plus rien au-dessus de 4 kHz, plus de basse), ne reste qu'elle jusqu'à la fin.
- **Sur quoi** : n'importe quel voyage : le silence de musique fait le trajet, sa musique fait l'arrivée.
- **Outil** : un départ tardif de sa musique (`music.pauses` depuis 0, `downbeat` sur l'arrivée : `docs/son.md`, « Forme de la musique d'un modèle », existant), sa fin coupée net avec la dernière image.

### 8. L'arrivée : la foule en accéléré
- **Mesuré** : trois plans de foule au téléobjectif (52, 70 et 116 images), **accélérés** et non ralentis : deux images de suite ne se ressemblent presque plus (corrélation 0,1 à 0,3, quand celles de la vitre du train sont à 0,9), des gens qui marchent y avancent de 10 à 15 % de l'image par image (environ six fois leur vitesse), et la caméra à la main tremble d'une image à l'autre (2 à 5 % de l'image). Les deux premiers sombres (noirs écrasés), le troisième plus clair et à peine chaud (ses gris tirent vers le rouge de 5 à 6 niveaux).
- **Sur quoi** : l'endroit où elle arrive, plein de vie : une foule, une rue passante, un marché, un salon, une terrasse ou sa boutique pleine.
- **Outil** : **manquant, ajouté** : une case de modèle jouée plus vite qu'elle n'a été filmée (`SkillShot.speed`, `docs/outils-video.md`) ; 2 fois au plus, le plus que le moteur sache (l'original va à environ six), réglage « arrivée » pour la jouer à sa vitesse.
- **Si rien ne s'y prête** : sa vidéo trop courte pour deux fois sa durée est jouée moins vite, jusqu'à sa vitesse réelle.

### 9. Deux petites lignes dorées au milieu
- **Mesuré** : deux lignes centrées, de 37 à 62 % de la largeur et de 42 à 48 % de la hauteur (le milieu du bloc à 45 %), dans une grotesque fine et droite (une Helvetica régulière), ses capitales à 4 % de la largeur (58 px sur 1 080), d'un or éteint mêlé à l'image (#95895A en moyenne sur ses lettres), une ombre à peine. Elles arrivent en fondu de l'image 234 à 242 (7,80 – 8,07 s) et restent jusqu'à la fin. Les mots, « Slow down » et « Japan », sont **à l'original, jamais recopiés** : une courte invitation puis le lieu.
- **Sur quoi** : ses mots à elle, deux lignes : ce qu'on y fait ou ce qu'on y dit, puis le lieu ou l'événement où l'on arrive.
- **Outil** : `FitText`, 60 px (48 au moins), dans sa police de texte, à sa couleur quand elle se lit sur du gris (claire et colorée), sinon le même or éteint ; une ombre douce ; dans la zone sûre (x 140 – 940, au-dessus du milieu).

### 10. Étalonnage
Noir et blanc contrasté : noirs profonds (le 1 % le plus sombre à 9 – 13 niveaux), blancs à 230 – 244, aucune couleur (saturation 0 à 3) jusqu'à l'arrivée, dont le dernier plan a les noirs un peu levés (18) et des gris à peine chauds. Un grain fin dans les foules, pas de coins sombres visibles.

## À l'original, jamais recopié
Ses lieux et leurs mots : le panneau de rue parisien, la station de vélos, « ARRIVAL AT TOKYO », « SHIBUYA STA. » et les caractères du bus, « Slow down / Japan ». Le modèle met ses lieux à elle et ses mots, ou rien.

## Format
**Depuis le 6 novembre** (Tristan, sur sept bancs : « vertical please », « tout vertical please ») : `vertical` par défaut, plein écran, ses fichiers horizontaux recadrés sur leur sujet ; `horizontal` (sa bande) seulement à sa demande, ou quand elle veut ses vidéos entières (le `frame` letterbox de son contrat) ; `auto` (comme ses vidéos, ci-dessous) seulement si elle le demande. `docs/modeles.md`, « Réglages d'un modèle ».

L'original est vertical 9:16 plein cadre. Réglage « format » : `auto` (par défaut, comme ses vidéos : plein cadre quand la plupart sont en hauteur, sinon entières dans une bande 16:9 sur du noir), `vertical` (plein cadre, ses vidéos horizontales recadrées sur leur sujet), `horizontal` (toutes dans la bande). La masse qui passe, la poussée et ses deux lignes se posent dans la bande comme dans l'image entière.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, le noir et blanc contrasté, les huit plans à leur place (à une image près pour la plupart : 1,03 · 1,37 · 1,67 · 2,70 · 3,20 · 4,93 · 7,23 s), le bus qui masque, les quatre moyens de transport, la foule, les deux lignes, leur place (x 35 – 65 %, y 41,5 – 48,5 %) et leur fondu, l'absence de voix, la signature (le bus pour une ellipse).

**Raté** : le **tempo** (82 au lieu de 110,9) et la **musique** (pour lui une intro et une « accélération rythmique » dès 0 s : ce sont les sons des plans, la musique n'entre qu'à 3,23 s) ; le **zoom arrière en trois sauts** des cinq premières images ; les **15 images par seconde** du départ ; la **coupe sous le bus** (pour lui le bus révèle le tunnel : il révèle le trottoir vide, tenu sept images) ; la **poussée** sur le panneau d'arrivée ; surtout, il voit les foules « au ralenti » (« ralenti fluide », « ralenti marqué », 50 – 60 i/s ramenés à 24) : elles sont **accélérées** ; la couleur des lignes (#D4AF37, plus vif que l'or éteint mesuré) ; le « whoosh » du bus, qu'on ne trouve pas dans le son. `measure.py`, lui, voyait 79,1 BPM, prenait les trois paliers du zoom et les bonds du bus pour des coupes, ratait les trois coupes de foule (chaque image d'une foule accélérée change autant qu'une coupe) et appelait « flashs » la coupe de 7,27 s et deux chemises blanches.

## Le modèle v1 (6 novembre)
`skills/depart.ts`, version 1, dans la bibliothèque (à valider sur /admin). Neuf cases (six à neuf d'après ses fichiers, seize au plus pour une durée qu'elle demande), 11,17 s à 110,9 BPM (de 92 à 124), chaque coupe à une image près de l'original (24, 32, 43, 51, 81, 97, 148, 219 pour 25, 32, 42, 51, 82, 96, 148, 218).
- **Le départ** (1,5 temps) : elle devant son lieu, l'image qui recule en trois sauts (2,88, 2,04, 1,56 fois), à 15 i/s ; une masse floue qui passe de la droite vers la gauche, couvrant toute l'image autour de la coupe (des images 18 à 25), sur ce qui passe vraiment devant son objectif quand son remplisseur l'y a calé (`reads: ["covered"]`).
- **Son lieu vide** (0,5 temps) : sa première image tenue, découverte par la masse qui part.
- **Son trajet** (4 temps, deux à quatre cases : 0,625 · 0,5 · 1,875 · 1), chaque plan à sa vitesse avec son son (`sound`), aucune musique ; le dernier fonce 3,6 fois sur ce vers quoi elle va sur ses huit dernières images.
- **Son arrivée** (14,625 temps, deux ou trois cases : 3,125 · 4,375 · 7,125 ; quatre temps de plus par case pour une durée plus longue) : jouée deux fois plus vite (`SkillShot.speed`, le réglage « arrivée » la remet à sa vitesse), un gris à peine chaud ; la musique entre avec elle sur son premier temps.
- **Ses deux lignes** (`ligne`, facultative, 24 caractères ; `lieu`, 24 caractères) un temps après le début de son dernier plan, en fondu sur neuf images, jusqu'à la fin ; sa carte de fin en option prend leur place.
- **Son noir et blanc** dessiné par son code (sous ses mots en couleur) ; sa finition garde contraste, grain fin et coins à peine sombres (`finish: { saturation: 0 }`).
- **Ce qui manque** : une accélération au-delà de deux fois (l'original va à environ six) ; savoir si sa vidéo a vraiment quelque chose qui passe devant l'objectif (la masse se pose toujours, aussi sur un vrai passant) ; le son de ses plans de trajet n'a pas pu être vérifié en local (les vidéos libres n'en ont pas).

## Le modèle v2 (6 novembre, revue de Tristan)
Tristan sur /admin, du banc de la v1 (cas friperie, idée « Ce week-end, on part au marché aux puces. ») : « vertical, pas trop de rapport, voix off inutile ».
- **La voix off** : personne ne l'avait demandée. Ses sous-titres disent l'idée mot pour mot : le contrat avait lu cette phrase à la première personne comme ses mots à dire (`voice_text`), et une voix qui la lisait s'était posée sur le modèle (comme « Je me présente : Héloïse… » le 5 novembre). Corrigé dans le produit, pour tous les Reels : une demande qui décrit le Reel n'est jamais un texte à dire, seulement quand elle dit que la voix le dit (« la voix dit », « voix off : », « texte : », ses mots entre guillemets ; `CONTRACT_PROMPT`, et `keepAskedVoice` qui retire du contrat un texte que sa demande ne demande pas ; `docs/montage.md`, « Contrat d'un Reel »).
- **« Pas trop de rapport »** : ses plans ne racontaient pas sa demande. Le départ était une femme devant la porte d'une maison (pas sa boutique), et sous « au marché aux puces » passaient des tomates sur l'étal d'un marché alimentaire, des jambes et un chien : rien de vintage, rien qu'on chine. Ses cases disaient « un endroit plein de vie (une foule, une rue passante, un marché…) », que n'importe quel marché remplissait. En v2, ses cases suivent sa demande : son départ devant son lieu à elle, celui qu'elle quitte (sa boutique, sa devanture), jamais un autre endroit ; son trajet vers l'endroit que sa demande nomme, son dernier plan sur son entrée quand ses fichiers l'ont ; son arrivée à cet endroit tel qu'il est (le marché aux puces : ses stands, ses portants, ses objets, des gens qui chinent ; jamais un marché de fruits qui ne fait que remplir la case), sinon ce qui s'en approche le plus dans ses fichiers ; et, avec trois plans d'arrivée, celui du milieu de plus près : ce qu'on y fait (des mains qui fouillent un bac ou un portant, une pièce qu'on choisit). Le remplisseur l'entend aussi pour tous les modèles (`SKILL_FILL_PROMPT` : une case qui montre un lieu, une chose ou un moment que sa demande nomme montre celui-là).
- **Le vertical** : le format par défaut est le chantier du moteur ; ici le réglage `format` reste tel quel.
- **Rendu en local** (6 novembre, en vertical, `--settings '{"format":"vertical"}'`, rempli à la main comme ses cases le demandent ; `/tmp/claude-0/renders/depart2/skill-v2b.mp4`, planche `skill-v2b-sheet.jpg`) : une femme en veste rouge devant un rideau de fer baissé (Mixkit 3559, recadrée sur elle : le recadrage sur le sujet est fait par le moteur en prod), la masse qui passe et elle a disparu, une devanture vide (3494), son trajet (métro, rame, train, escalator), puis le marché aux puces (Mixkit 4147, ses stands sous une halle), des mains qui passent des cintres sur un portant (23327), et le marché en large sous « Ce week-end / au marché aux puces » ; 11,17 s, le contrôle des scènes à null. Les plans se répondent : on quitte la boutique, on va chiner. Pas de musique ni de son vérifiés en local.

## Ce qu'il faut filmer
Le téléphone posé ou calé, l'exposition bloquée :
1. **Ton départ** : toi debout devant ton lieu (ta porte, ta devanture, ton comptoir), au milieu de l'image, 3 à 5 s ; le mieux, pendant qu'une voiture, un bus, un vélo ou quelqu'un passe tout près devant le téléphone ; puis sors du cadre et laisse filmer 2 s le lieu vide, sans bouger le téléphone.
2. **Ton trajet** : 2 à 4 courtes vidéos qui bougent, avec leur son : par la vitre d'un train, d'un bus ou d'une voiture, la route, un métro, un vélo ; la dernière en avançant vers l'endroit où tu vas (son escalier, sa porte, son enseigne).
3. **Ton arrivée** : 1 à 3 vidéos de 4 à 8 s de l'endroit où tu vas, tel qu'il est (le marché aux puces : ses stands et les gens qui chinent ; un salon : ses allées), à hauteur des gens, de loin au zoom si tu peux, et une de plus près sur ce que tu y fais (tes mains qui fouillent un bac, une pièce que tu choisis) : elles seront jouées deux fois plus vite.

Et deux petites lignes : ce qu'on y fait (« Ce week-end », « Rendez-vous ») et le lieu.
