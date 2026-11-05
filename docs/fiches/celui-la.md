# « Celui-là, celui-là… » (`celui-la`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa grille (plus bas) depuis son temps 0.

**L'original** : le Reel d'une céramiste (https://www.instagram.com/reel/DfU-Bg6ultD/), à garder dans `house/originals/celui-la.mp4` : 8,66 s (260 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son. Neuf plans, huit coupes. Le modèle prend tout l'original.
**Le second exemple** : Tristan a envoyé un second Reel fait sur le même modèle par une autre céramiste (https://www.instagram.com/reel/DeaRi9QsBva/, 8,57 s, 720 × 1280). **Le même son**, à l'échantillon près (décalage 0 ms, corrélation des enveloppes 0,994), les mêmes mots aux mêmes instants à trois images près, d'autres images, d'autres places pour les mots, des mots plus petits. Ce qui ne change pas entre les deux est le modèle ; ce qui change, ce sont ses images à elle.
**Son son** : **une voix d'homme seule, sans musique** (voix parlée vers 125 à 150 Hz, son « aaand » montée à 250 Hz) : « Heeeeey ! Stop ! Stop ! Stop ! Look at this, this, this, this, this, this, this… aaaand… this », presque le silence entre les mots (−60 à −65 dB, et deux silences numériques : 0 – 0,11 s et 1,36 – 1,52 s). Ce n'est pas une musique : c'est un son tendance d'un autre compte, jamais recopié. Mais la voix est **sur une pulsation régulière : 96,5 BPM**, un « this » par temps (un temps toutes les 0,622 s, 18,65 images ; ajusté sur les coupes, chacune à 2,2 images au plus de la grille, et sur la voix à 56 ms près). `measure.py` disait 97,75 BPM (pulsation 93,75), Gemini « non musical ».
**Mesuré avec** : `scripts/fiche/measure.py` sur les deux Reels (7 coupes chacun : il manque à l'original celle de 6,07 s, deux plans aux mêmes couleurs ; ses « clignotements » sont une main), des planches à 30 i/s numérotées de tout l'original et du second exemple, la place, la taille, la couleur et l'opacité de chaque mot image par image (ses pixels jaune pâle), des gros plans de ses lettres, le son par bandes toutes les 20 ms (basse, bas médium, voix, aigus, souffle, centroïde, platitude), la hauteur de la voix, la corrélation des deux sons, l'intensité (−14,2 LUFS), et la lecture de Gemini (`house/breakdowns/celui-la.json`).

## Sa grille

Temps 0 à −0,11 s (le Reel commence au temps 0,18), temps 1 à 0,51 s, puis un temps toutes les 0,622 s : le premier produit tombe sur le temps 4 (2,37 s ; coupe à 2,30 s, une voix un peu en avance), le septième sur le temps 10, la série réunie sur le temps 11, le dernier mot sur le temps 13½, la fin au temps 14,1.

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Ce qu'on entend | Effets |
|---|---|---|---|---|
| 0 – 2,30 | 0,18 – 3,9 | Le tabouret vide devant le mur blanc, plan fixe | | — |
| 0,03 – 0,57 | 0,23 – 1,04 | « Heeeeeyyy » tapé lettre à lettre (images 1 à 12), son bord gauche à 25,6 % de la largeur, à mi-hauteur ; tenu une image, fondu en 4 images (13 à 16) | « Heeeeey » (0,14 – 0,60) | 2 |
| 0,70 · 0,87 · 1,10 | 1,31 · 1,58 · 1,95 | « Stop! » trois fois, chaque fois ailleurs : en haut à gauche (28 % ; 27 %), à droite (60 % ; 44 %), en bas à gauche (33 % ; 66 %), le troisième 9 % plus grand ; parti à 1,50 s | trois « stop » (0,70 · 0,88 · 1,08) | 1 |
| 1,73 – 2,27 | 2,97 – 3,9 | « Look at » seul au milieu (50 % ; 49 %) | « look at » (1,72 – 2,04) | — |
| 2,30 – 6,77 | 4 – 11 | Sept tasses, une par temps, vues d'en haut sur le même tabouret ; coupes sèches à 2,30 · 3,03 · 3,63 · 4,30 · 4,87 · 5,47 · 6,07 s ; « This » sur chacune, chaque fois ailleurs | sept « this » (2,34 · 3,03 · 3,67 · 4,30 · 4,88 · 5,47 · 6,09) | **1** |
| 6,77 – 8,66 | 11 – 14,1 | Toute la série réunie sur le tabouret, de face, un peu plus large (six tasses) ; une main pose la dernière à droite, puis se retire (6,77 – 7,55) | | 4 |
| 6,80 – 8,10 | 11,1 – 13,2 | « Aaaaaaanndddd » tapé lettre à lettre (6,80 – 7,33), son bord gauche à 14,2 %, tenu, fondu en 4 images (7,97 – 8,10) | « aaaand » tenu 1,1 s (6,82 – 7,94), puis un « nnn » grave (8,00 – 8,40) | 2 |
| 8,10 – 8,27 | 13,2 – 13,5 | Rien d'écrit, cinq images | | 3 |
| 8,27 – 8,66 | 13,5 – 14,1 | « This » seul au milieu (50 % ; 49 %) jusqu'à la fin | « this » (8,46, coupé par la fin) | 3 |

Ni zoom, ni poussée, ni fondu entre les plans, ni grain : des coupes sèches, des plans fixes.

## Effets (ce qu'on veut savoir refaire)

### 1. Un mot pointé sur chaque produit, sur le temps, chaque fois à un autre endroit (sa signature)
- **Mesuré** : un produit par temps (17 à 22 images, 18,6 en moyenne), coupe sèche juste avant le mot dit (une à deux images). Le mot entre **d'un coup** sur la coupe et part sur la suivante : ni grossissement, ni fondu, ni rebond (le « pop franc » de Gemini n'est qu'une coupe). Toujours le même mot (« This »), à la même taille (161 × 83 px sur 720 × 1280 : 22 % de la largeur, 6,5 % de la hauteur), **jamais deux fois au même endroit** : son centre à (24,5 % ; 28,6 %), (69 % ; 40,4 %), (31,6 % ; 53,4 %), (36 % ; 70,4 %), (71 % ; 64,8 %), (67 % ; 26,7 %), (49,7 % ; 69,6 %) ; gauche et droite en alternance, haut et bas, tantôt sur la tasse (son flanc, sa soucoupe), tantôt sur le mur à côté. Toutes dans la zone de sécurité d'Edith (bord droit à 82 %, soit 886 px ; bas à 73,7 %, 1 415 px). Les trois « Stop! » du début sont le même effet avant les produits : trois places en 0,4 s, le troisième 9 % plus grand. Dans le second exemple, les mêmes sept mots à d'autres places ((50 % ; 42 %), (21 % ; 24 %), (67 % ; 70 %), (60 % ; 73 %), (61 % ; 31 %), (72 % ; 58 %), (50 % ; 23 %)), plus petits (14 % × 4 %), et ses coupes 5 à 13 images avant les mots (sa créatrice a moins calé).
- **Sur quoi** : les produits de n'importe quel commerce, un par un : ses pièces (céramiques, bijoux, bougies), ses gâteaux, ses bouquets, ses plats, ses vêtements, ses bouteilles, ses réalisations (des coupes, des ongles). Plus fort quand chaque pièce est posée au même endroit, filmée du même angle (l'original) ; marche aussi sur des plans différents (le second exemple : tenues à la main, posées sur une table).
- **Outil** : existant : `Footage` (un plan par temps), `FitText` (le mot dans sa boîte, à sa taille) ; ses places, une chorégraphie fixe : les sept de l'original, puis cinq autres qui alternent de même, chaque boîte gardée dans la zone de sécurité.
- **Lisibilité** : le jaune pâle de l'original sur son mur gris clair a un contraste de 1,7 environ : le contrôle des scènes d'Edith le dirait perdu (sous 2,5 et trop proche en couleur). Le modèle lui donne un bord sombre fin (1 à 2 px, comme « Titre qui se décode »), qu'on ne voit pas sur une image sombre.
- **Si rien ne s'y prête** : rien n'est lu dans ses plans : le mot va à sa place sur n'importe quelle image.

### 2. Les mots étirés, tapés lettre à lettre, puis fondus
- **Mesuré** : « Heeeeeyyy » : 9 lettres en 12 images (environ 23 lettres par seconde, en saccades d'une ou deux images), son bord gauche fixe à 25,6 %, le mot grandit vers la droite ; tenu une image, fondu en 4 images (0,43 – 0,57 s). « Aaaaaaanndddd » : 13 lettres en 17 images (6,80 – 7,33 s), bord gauche à 14,2 %, tenu 0,6 s, fondu en 4 images. Les lettres finissent avant la voix (son « aaaand » tenu jusqu'à 7,94 s). Dans le second exemple, « Heeeeeeeey » tapé de même (images 1 à 13), mais « Aaaaaaaand » arrive entier d'un coup : la frappe de la fin est un choix de la première créatrice.
- **Sur quoi** : ses mots : un appel étiré comme on le crie (« Hééééé »), une hésitation (« Eeeeet… »).
- **Outil** : le code du modèle (chaque lettre visible à son image, le mot entier en place dès le début : le contrôle le lit en entier), ou `TypeOn` (existant).

### 3. La chute : le dernier mot seul
- **Mesuré** : après le fondu de « Aaaand » (8,10 s), cinq images sans rien, puis « This » seul au milieu (49,9 % ; 49,3 %), à la même taille, de 8,27 s à la fin (0,4 s : la vidéo s'arrête sur la voix, Instagram la reboucle).
- **Pour Edith** : le dernier mot tient 1,5 temps (0,93 s) avant la fin, sinon il ne se lit pas ; une carte de fin (son offre, son annonce) en option après lui.

### 4. Toute la série réunie, la dernière pièce posée par une main
- **Mesuré** : le dernier plan (6,77 – 8,66 s) montre les tasses alignées sur le tabouret, de face, et une main qui pose la dernière à droite puis se retire (vers 7,55 s), avant le dernier mot. Dans le second exemple, le même moment sur une pile : une main pose la quatrième tasse en haut (7,0 – 8,1 s) et le dernier « This » tombe quand elle se retire (8,13 s).
- **Sur quoi** : toute sa collection ensemble, ou sa pièce préférée posée en dernier ; sa vitrine pleine.
- **Outil** : son passage choisi pour que la main ait fini avant le dernier mot (2,5 temps après la coupe).

### 5. Le son : une voix seule, en rythme
- **Mesuré** : plus haut. La voix fait tout le rythme : appel étiré, trois arrêts rapides, un mot par temps, l'hésitation tenue dans le silence, le dernier mot.
- **Outil** : la voix est à l'original, jamais recopiée. Le modèle prend une musique composée à 96,5 BPM et la façonne comme la voix (`music-shape.ts`) : sans sa basse pendant l'appel, entière dès le premier produit (sa basse entre sur le premier mot), arrêtée sur la série réunie avec son dernier coup qui résonne (l'hésitation dans le silence), de retour sur le dernier mot, finie sur un coup un temps après lui.
- **Si rien ne s'y prête** : la musique continue, les mots tombent sur ses temps.

### 6. Étalonnage
Naturel, lumière du jour douce, tons neutres et chauds (le mur blanc, le bois clair), contraste doux, ni grain ni coins sombres : rien d'autre qu'une finition légère.

## Ce qui appartient à l'original (à l'original, jamais recopié)
- **Ses mots** (« Heeeeey », « Stop! », « Look at », « This », « Aaaand ») et **sa voix** : un son tendance d'un autre compte. Les mots du modèle sont les siens, en français : un appel (« Hééééé »), un mot qui arrête (« Attends ! »), « Regarde », un mot pointé (« Celui-là », « Celle-là », « Ça »), une hésitation (« Eeeeet… »), le dernier (« Celle-là ! », « Tout ça ! »).
- Les tasses de la céramiste et son tabouret. Rien d'autre : ni logo, ni marque, ni symbole.

## Format
L'original est vertical 9:16, chaque plan plein cadre. Réglage `format` :
- `auto` (par défaut) : comme ses fichiers : plein écran vertical, ou chaque plan entier dans une bande 16:9 au milieu du noir quand la plupart sont horizontaux ;
- `vertical` : chaque plan plein écran, un plan horizontal recadré sur son sujet, comme l'original ;
- `horizontal` : chaque plan entier dans une bande 16:9 au milieu du noir, les mots posés sur la bande et sur le noir.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, les neuf plans et leurs coupes (à une image près, dont celle de 6,07 s que `measure.py` a manquée), chaque tasse, la série réunie (six tasses) et la main qui pose la dernière, la serif élégante, son jaune crème (#FFFAB3 ; mesuré #FFFCC0), l'ordre des mots, « Hey » et « And » tapés lettre à lettre, les coupes calées sur la voix, une voix d'homme.

**Raté** : le **tempo** (« non musical » : la voix est sur une pulsation régulière de 96,5 BPM, un « this » par temps) ; les **trois « Stop! »** à trois places (il en voit un, qui « se déplace en bas à 1,067 s ») ; « Heeeeeyy » au lieu de « Heeeeeyyy » ; la voix (« hey hey hey stop stop » : c'est un seul « Heeeeey » et trois « stop ») ; ses « coups » sont les coupes, pas la voix (les « this » sont dits jusqu'à 70 ms après) ; le « pop franc » (une simple coupe, sans animation) ; les **fondus de 4 images** des mots tapés ; le silence entre « Aaaand » et le dernier mot ; le dernier « This » jusqu'à 8,53 s au lieu de la fin (8,66 s).

## Ce qu'il faut filmer
Téléphone posé, en vertical, à la lumière du jour :
1. **Son présentoir vide** (un tabouret, une table, une étagère, son comptoir) ou sa vitrine, 3 s ;
2. **chacun de ses produits** posé au même endroit, filmé du même angle, l'un après l'autre (2 s chacun suffisent ; une photo de chacun marche aussi) : cinq au moins, sept comme l'original, jusqu'à quatorze ;
3. **toute la série réunie**, et sa main qui pose la dernière pièce puis se retire, 4 s.
