# « Face caméra et références » (`createur`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; les « images » sont comptées à 30 i/s depuis la première (0). Il n'y a pas de musique, donc pas de temps à compter : c'est sa voix qui mène.

**L'original** : `house/originals/createur.mp4`, 62,0 s (1 860 images), 720 × 1280, 30 i/s, **vertical 9:16** plein cadre, avec son. Un créateur parle face caméra, micro à la main, et ce dont il parle apparaît à l'image. Le modèle en garde les **31 premières secondes** (`HOUSE_PASSAGES`, images 0 à 930). La suite (31 → 62 s) reprend les mêmes formes : le mur d'images qui devient rose sur « couleur », une salle de cinéma, des captures posées au-dessus de lui, des gros plans, jusqu'à la recommandation finale. C'est une publicité pour un outil de références (Flim).
**Sa musique** : **aucune qui se mesure**. On entend sa voix seule, à −14,3 LUFS, très tassée (écart de volume 1,1 LU, crête −4,2 dBFS), avec un bourdon de pièce dans le studio (une note tenue à 44 Hz, de 0 à 14 s). Sur les coupes entre deux phrases, le son tombe à −38 / −46 dBFS (14,89 · 18,24 · 20,65 · 23,02 · 24,65 · 27,57 s) : aucune musique ne court dessous. Dans le studio, ses silences restent vers −30 / −35 dBFS (le bourdon), et aucune note tenue n'y apparaît, sauf le carillon. Le « tempo » de `measure.py` (95,5 BPM, candidats 95,5 · 83,75 · 73,75, accord des coupes 0,25 à 0,28, c'est-à-dire aucun) vient de sa voix. Gemini entendait « un beat lo-fi avec des claps doux » : rien ne le confirme. Trois bruitages : un **carillon** aigu sous le logo (13,96 → 14,85 s : un souffle clair de 0,1 s, puis des notes de mi majeur entre 1,1 et 2,3 kHz), la **neige de cassette** (14,97 s), puis le **son de l'extrait** de film (15,1 → 17,2 s : une voix d'homme, un son étouffé de vieille bande, bien plus pauvre en aigus que sa voix ; pas clair, à écouter). Peut-être un petit souffle quand le mur d'images glisse (23,77 s, pas clair).
**Le montage**, lui, suit sa voix. Les coupes tombent dans ses respirations (12,07 · 14,97 · 18,30 · 20,67 · 23,00 · 27,70 · 30,03 s), ou sur l'attaque d'un mot, à une ou deux images près : celui qui nomme l'image (6,87 · 7,80 · 8,67 · 24,73 · 25,73 · 26,37 · 26,90 s) ou le premier d'une phrase (4,03 · 9,67 · 30,80 s). Celle de 21,70 s suit le geste : le mot écrit continue tapé. Pas de jump cut dans sa parole, et aucune transition sauf la neige de cassette.
**Mesuré avec** : `scripts/fiche/measure.py`. Il a manqué la coupe de 26,37 s (deux captures de même mise en page) ; ses 59 « clignotements » sont les mots qui passent du gris au blanc, ses mains et les entrées (le logo, le mur). Puis des planches à 30 i/s de chaque seconde du passage, des gros plans (sous-titres, carte, mur), des mesures de pixels (places, tailles, couleurs, zoom) et du son (niveaux toutes les 10 ms, bandes, silences, notes tenues), et la lecture de Gemini (`house/breakdowns/createur.json`).

## Déroulé

| De – à (s), images | Ce qu'il dit | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 4,03 (0–120) | « Avoir une très bonne culture visuelle, je pense que c'est un des points les plus importants en réalisation. » | Lui devant un fond bordeaux, **cadré bas** (le haut de sa tête vers 53 % de la hauteur). Il se tourne vers la caméra sur les 10 premières images. Au-dessus de sa tête, **détouré sur son mur**, l'extrait d'un clip qui bouge (une femme assise sur une planète bleue) | **Détourage au-dessus de lui** (1) ; **accroche en bandeaux, mot à mot** (10) |
| 4,03 – 6,87 (121–205) | « Les clips de Théodora qui nous ont tous marqués, on peut y trouver des références » | **Écran partagé** à 50 % : en haut un autre clip (une silhouette noire devant une lune), en bas lui. **Son fond passe du bordeaux au bleu nuit** | **Moitié du haut** (1) ; **mur recoloré** (2) ; petits sous-titres sur la ligne de partage (10) |
| 6,87 – 9,67 (206–289) | « à Jean-Paul Goude, à Lotte Reiniger ou à Saul Bass. » | Trois images plein cadre, **une par nom** : une photo de Goude (Grace Jones), une silhouette de Reiniger, l'affiche de *Vertigo* (0,93 · 0,87 · 1,0 s) | **Une image par nom** (3) |
| 9,67 – 12,07 (290–361) | « Derrière un clip iconique, il y a des références iconiques. » | Écran partagé : en haut un clip (une femme sur une cerise géante), en bas lui, sur le bordeaux revenu. Dans le clip, une ligne noire coupe l'image en deux et ses moitiés glissent à 10,67 s : c'est le montage du clip lui-même (pas clair) | Moitié du haut (1) |
| 12,07 – 14,97 (362–448) | « Un de mes outils préférés à moi pour trouver des bonnes références, » puis le nom (pas sous-titré) | Lui en plan américain plein cadre, **un autre cadre** (la tête en haut) | **Le logo surgit** à 13,83 s avec un carillon (4) ; un autre cadre (9) |
| 14,97 – 18,30 (449–548) | (le son de l'extrait) | 4 images de neige de cassette, puis le carton bleu de *La Classe américaine* (« ATTENTION CE FLIM N'EST PAS UN FLIM SUR LE CYCLIMSE »), qui saute 5 images (456–460) | **Carton-blague de cassette** (5) |
| 18,30 – 20,67 (549–619) | (pas sous-titré) | Second lieu : son salon. Assis dans un fauteuil rond, l'ordinateur sur les genoux, cadré large (la tête vers le milieu). La carte du logo est au-dessus de sa tête tout le plan | Le logo reste (4) |
| 20,67 – 23,00 (620–689) | (pas sous-titré) | Vue de dessus, une main écrit « NÉO SURR… » dans un carnet (1,03 s). Puis l'écran de l'outil, où le mot continue tapé : « NEO SURREALISM » (1,3 s) | **Écrit puis tapé** (6) |
| 23,00 – 24,73 (690–741) | « Et ça vous donne plein de références » | Le salon. Sur « plein de références » (23,80 s), **un mur de vignettes glisse des deux bords**, derrière lui | **Mur d'images** (7) |
| 24,73 – 27,70 (742–830) | « issues du cinéma, des séries, des clips et de la pub. » | Quatre captures de l'outil, **une par mot** (1,0 · 0,63 · 0,53 · 0,8 s) | **Une capture par mot** (8) |
| 27,70 – 30,03 (831–900) | « il y a plein de filtres pour faire le tri selon ce qui est attendu. » | Un autre mur (vignettes bleu-cyan) qui monte lentement, lui devant | Mur d'images (7) |
| 30,03 – 30,80 (901–923) | « Mon petit préféré, » | **Gros plan de côté** (un second angle) | Un autre cadre (9) |
| 30,80 – 31,00 (924–930) | « moi c'est le filtre par… » | Le mur, lui plus petit, et la palette de couleurs de l'outil posée dessus | (« couleur » tombe à 31,57 s et le mur devient rose à 31,60 s : juste après le passage) |

## Effets (ce qu'on veut savoir refaire)

### 1. La moitié du haut pour ce dont il parle
- **Mesuré** : il est cadré bas (le haut de sa tête vers 53 % de la hauteur), avec un mur uni au-dessus. De 0 à 4,03 s, ce dont il parle est **détouré et posé sur son mur**, au-dessus de sa tête : 25 à 75 % de la largeur, de 9 % de la hauteur jusque sous les sous-titres (43 %), sans bord ni ombre. C'est une vidéo : la femme assise sur sa planète bouge. Puis, de 4,03 à 6,87 s et de 9,67 à 12,07 s, l'image prend **toute la moitié du haut**, coupée net à 640 px sur 1 280, sans trait ni marge, et lui la moitié du bas, au même cadre (la moitié basse de son image, sans réduction). Les sous-titres sont sur la ligne de partage.
- **Sur quoi** : sa vidéo face caméra filmée avec de la place au-dessus de sa tête (un mur uni), et ses photos ou vidéos de ce dont elle parle : un produit, un plat, une réalisation, un avant/après. Détouré quand c'est un objet sur un fond simple ; en moitié d'écran quand c'est une scène.
- **Outil** : existant. Dans une composition : sa `Footage` plein cadre, puis la référence détourée par-dessus, dans la zone libre (`Cutout` d'une photo avec `rim={0}` et `shadow={false}`, ou `Subject shot={n}` / `Subject object="…"` d'une de ses vidéos, qui bouge). La moitié du haut se fait par `Split direction="column"` ou par deux `Footage` posées à la main. Les sous-titres vont sur la ligne de partage (`subtitle_y` de la composition).
- **Si rien ne s'y prête** : sans place au-dessus de sa tête (un plan serré), l'écran partagé seul, son visage gardé dans la moitié du bas (`Footage` se cadre sur son sujet). Sans image de ce dont elle parle : elle seule, plein cadre.

### 2. Son mur prend la couleur de l'image du dessus
- **Mesuré** : de 4,03 à 6,87 s, sous le clip de nuit, son fond passe du bordeaux (#551B24, teinte 351°) au bleu nuit (#002946, teinte 205°), avec la même lumière (plus clair en bas : #7D2533 devient #01365E). Sa peau ne bouge pas (#A17A6F, puis #9E726E). Le fond redevient bordeaux à 9,67 s, sous le clip à la cerise rouge.
- **Sur quoi** : le mur uni derrière elle (de couleur ou clair), recoloré pour aller avec l'image du haut.
- **Outil** : existant, en combinant deux choses. D'abord sa `Footage` avec un filtre CSS (`hue-rotate`, `saturate`). Puis `Subject` dans la même boîte, en couleur. C'est le procédé déjà décrit pour « elle en couleur, le reste en noir et blanc ». Le détourage compte dans les 30 s d'un Reel (`SUBJECT_MAX_SECONDS`).
- **Si rien ne s'y prête** : un fond chargé (une boutique, une cuisine) garde sa couleur.

### 3. Une image plein écran pour chaque nom qu'il cite
- **Mesuré** : « à Jean-Paul Goude », « à Lotte Reiniger », « ou à Saul Bass. ». Trois images plein cadre (9:16), chacune coupée sur le premier mot qui la nomme (6,87 · 7,80 · 8,67 s) et tenue 0,93 · 0,87 · 1,0 s. Ce sont trois images fixes, avec une avancée à peine visible (0,5 à 1 % en 0,9 s ; à ne pas reprendre : Tristan trouve cheap les poussées lentes posées d'office). Le sous-titre reste au milieu (49 à 51 % de la hauteur). Il n'est sur une pastille sombre, translucide et arrondie que sur l'affiche, qui est blanche. Le sous-titre suivant arrive 2 images avant la coupe (288).
- **Sur quoi** : quand elle énumère (trois produits, trois plats, trois services, trois clients), une photo ou une vidéo de chacun.
- **Outil** : existant. Les mots datés de ce qu'elle dit (`spoken` dans une composition) ; chaque `Footage` plein cadre commence sur l'image de son mot.
- **Si rien ne s'y prête** : avec moins d'images que de noms, les noms sans image sont écrits en grand sur elle (`Kinetic`), et les images vont aux noms qui en ont une.

### 4. Le logo qui surgit sur son nom, avec un carillon, et qui reste
- **Mesuré** : à 13,83 s, une carte blanche grandit depuis le centre de l'image (50 %, 55 %). Ses coins sont à peine arrondis (environ 1 % de la largeur) et une ombre douce tombe dessous. Elle atteint 74 % de la largeur en 14 images (415 à 428 ; l'essentiel entre 419 et 424, freinée à la fin, floue de bougé au début). Elle se pose sur son buste, sous son visage (13 à 87 % × 43 à 65 %, environ 1,9:1), et cache les sous-titres. C'est la bannière de l'outil (« Made for Directors / Built for Storytellers. », le nom en très grand). Le carillon part avec elle (13,96 s). Au plan suivant (18,30 s), la même carte est en haut, au-dessus de sa tête (12 à 88 % × 20 à 42 %), dès la coupe et tout le plan (2,4 s).
- **Sur quoi** : son logo, la bannière de son site, sa devanture, son produit phare, sa page de réservation. Elle surgit quand elle dit son nom ou celui de ce qu'elle présente.
- **Outil** : existant. `brand.logoUrl` ou une de ses photos dans une carte : `Window` avec `radius` et `shadow`, ou un bloc qui grandit, flou au départ. Le carillon est un bruitage du motion designer (`sounds`, « sparkle chime »). La carte se pose sur son buste puis au-dessus de sa tête, jamais sur son visage (`track(frame).faces`).
- **Si rien ne s'y prête** : sans logo, son nom écrit dans sa police sur la carte blanche.

### 5. La blague en carton de vieille cassette
- **Mesuré** : d'abord 4 images de neige de cassette (449 à 452 : du noir et des traits blancs horizontaux). Puis un carton plein cadre bleu acier (#1F5A8B), au texte pâle en capitales (#A6B7BA, 11 à 86 % × 37 à 67 %) : « ATTENTION CE FLIM N'EST PAS UN FLIM SUR LE CYCLIMSE / MERCI DE VOTRE COMPRÉHENSION ». C'est l'ouverture de *La Classe américaine*, un jeu sur le nom de l'outil. L'image saute comme une bande qui décroche (456 à 460). Le carton garde son propre son et dure 3,2 s.
- **Sur quoi** : un jeu de mots sur son nom ou son métier, quand elle en fait un. Jamais l'extrait d'un film (ses droits) : un carton fait par le moteur, avec ses mots à elle.
- **Outil** : `Glitch` (existant, permis quand le Reel suivi en a un) pour la neige sur la coupe ; le carton lui-même (fond uni, capitales pâles, image qui saute) en code du modèle. **Manquant** : le look « cassette VHS » sur un seul passage (les looks, `LOOK_PRESETS`, valent pour tout le Reel). Existant depuis le 5 novembre : `<Look preset="vhs" from to>` autour du carton (`docs/outils-video.md`, « Un look sur un passage »).
- **Si rien ne s'y prête** : pas de carton.

### 6. Le mot écrit à la main qui continue tapé à l'écran
- **Mesuré** : vue de dessus, une main écrit « NÉO SURR… » dans un carnet ligné (20,67 à 21,70 s). Coupe sur l'écran de l'outil, où le mot continue dans la barre de recherche. « NEO SURREA » est déjà là, puis viennent L (654), I (662), S (668), M (671). Il y a 8, 6 puis 3 images entre deux lettres : une frappe à la main. Le texte est en capitales à chasse fixe, gris ardoise, dans un champ arrondi bleu pâle. Le curseur fin reste allumé jusqu'à 685 puis s'éteint. L'écran avance de 3 à 4 % en 1,3 s (à ne pas reprendre).
- **Sur quoi** : ses mains qui écrivent (une commande, l'ardoise du jour, un rendez-vous), puis son écran avec le même mot (son site, sa page de réservation, une recherche de son nom).
- **Outil** : existant. Deux de ses plans coupés sur le mot. Sans écran filmé : `TypeOn` (`speed` 4,5, `jitter`, `caret="bar"`) dans un champ dessiné fidèlement.
- **Si rien ne s'y prête** : le mot tapé sur son plan face caméra, ou rien.

### 7. Le mur d'images derrière lui
- **Mesuré** : sur « plein de références » (23,80 s), deux colonnes de vignettes glissent des deux bords, la gauche depuis la gauche, la droite depuis la droite. Elles mettent 7 images (714 à 720), floues de bougé, et sont posées à 723. Les colonnes vont de 6 à 48 % et de 54 à 92 % de la largeur, du haut de l'image jusqu'à 73 % de la hauteur, sur son salon. Les vignettes sont fixes, en 16:9 ou plus hautes, avec une ombre douce (environ 5 % de la largeur). Il est **devant** : sa tête et son fauteuil passent devant les vignettes du bas (il est détouré). Au plan de 27,70 s, un autre mur (3,5 à 48 % et 52 à 96 %) est là dès la coupe, lui devant, et monte lentement (2 % de la hauteur en 2,2 s). À 30,80 s, la palette de couleurs de l'outil, avec sa flèche, se pose dessus (30 à 70 % × 26 à 42 %).
- **Sur quoi** : ses photos (ses produits, ses plats, ses réalisations, les vignettes de ses Reels), en mur derrière elle, sur un plan où elle est assise avec de la place au-dessus.
- **Outil** : existant. Des `Footage` ou `Img` posées en colonnes, puis `Subject shot={n}` dans la boîte de son plan, pour qu'elle passe devant. `Stack layout="grid" enter="slide"` fait glisser les images une sur deux de chaque côté, mais passe à 3 colonnes au-delà de 4 images (un nombre de colonnes à choisir lui manque).
- **Si rien ne s'y prête** : avec moins de 4 photos, un mur de 2 × 2 ; sans détourage, le mur s'arrête au-dessus de sa tête.

### 8. Une capture d'écran par mot
- **Mesuré** : « issues du cinéma, des séries, des clips et de la pub. » : quatre captures de l'outil, une par mot. Chacune est coupée sur son mot (24,73 · 25,73 · 26,37 · 26,90 s), et elles raccourcissent (1,0 · 0,63 · 0,53 puis 0,8 s). Sur chaque capture : un fond gris très sombre (#1E1D20), l'image en haut (de 22 à 52 % de la hauteur environ), sa palette et sa fiche dessous. Le sous-titre, qui ne dit que le mot, descend sous l'image (55 à 57 %).
- **Sur quoi** : les captures de son site, de sa page de réservation, de ses avis, de sa carte en ligne.
- **Outil** : existant. Ses captures en photos plein cadre, coupées sur les mots (`spoken`), la rangée des sous-titres sous l'image (`subtitle_y`).
- **Si rien ne s'y prête** : ses photos, comme à l'effet 3.

### 9. Un autre cadre pour une autre idée
- **Mesuré** : le studio a deux cadres. Bas, la tête au milieu, de 0 à 12,07 s, pour laisser la place aux images ; puis en plan américain, la tête en haut (vers 11 %), de 12,07 à 14,97 s, quand il présente l'outil. Le salon aussi : large (18,30 · 23,00 · 27,70 s), puis un gros plan de côté, de 30,03 à 30,80 s (« Mon petit préféré »), puis de nouveau large. Le gros plan vient sans doute d'une seconde caméra : la phrase continue d'un plan à l'autre (pas clair). Pas de jump cut dans sa parole : voir « Le montage » plus haut.
- **Sur quoi** : une seconde vidéo d'elle (de côté, ou plus serrée), ou une seconde prise.
- **Outil** : existant : les coupes du monteur sur ses phrases (`speechCuts`, `jumpCut`). Existant depuis le 5 novembre : deux vidéos d'une même prise (deux téléphones) calées sur leur son (`docs/son.md`, « Deux prises calées sur leur son »), un skill calé sur sa voix passant de l'une à l'autre entre deux idées, au milieu de ce qu'elle dit (`docs/modeles.md`, « Skills calés sur sa voix »).
- **Si rien ne s'y prête** : un cadre resserré dans sa propre vidéo (le plan resserré des coupes de parole), seulement sur une phrase forte.

### 10. Les sous-titres : l'accroche en bandeaux mot à mot, puis petits au milieu
- **Mesuré** : la première phrase (0 à 4,03 s) est en grasses condensées blanches, sur des bandes noires pleines (#010101), une par ligne, collées l'une à l'autre. La hauteur des capitales fait 2,8 % de l'image (54 px en 1080 × 1920). Le bloc est au milieu (43 à 53 % de la hauteur), sur le bas du détourage. Toute la phrase est là d'avance : les mots pas encore dits sont en gris foncé (#505050), et chacun passe en blanc à l'image où il est dit (Avoir 4, une 7, très 14, bonne 20, culture 25, visuelle 34…). La phrase tient en quatre cartons : 6 mots, 9 mots, « importants » seul, « en réalisation. ». Le premier bloc grandit de l'image 2 à 7 (108 % à l'image 5), flou au début ; les suivants remplacent net. Dès 4,03 s viennent de petits sous-titres blancs : une grotesque demi-grasse, capitales à 1,9 % de l'image (36 px en 1920), 2 à 8 mots sur une ou deux lignes, une ombre douce, aucun mot en couleur. Ils restent vers le milieu (45 à 57 % de la hauteur) : sur la ligne de partage, sur son buste, sous l'image d'une capture. Il n'y en a aucun de 14,0 à 23,0 s, pendant le logo, la blague, l'arrivée au salon et les mains, alors qu'il parle.
- **Sur quoi** : ce qu'elle dit (ses mots datés par Scribe).
- **Outil** : les petits sont proches des sous-titres du moteur, avec leur rangée posée par la composition (`subtitle_y`). Mais le moteur les coupe par 2 ou 3 mots et met toujours le mot dit en couleur (`Subtitles` dans `Reel.tsx`) : il faudra un réglage par phrase, sans mot coloré. Pour l'accroche : `Captions style="bands"` dans une animation ou une composition (existant depuis le 5 novembre : la phrase entière sur des bandes noires, les mots à venir en gris, chacun en blanc à son instant, la première phrase qui sort d'un flou ; `docs/animations.md`, « Accroche en bandeaux ») ; les sous-titres du moteur (`CAPTION_STYLES`) n'ont toujours que native, kinetic et stickers. **Manquant** encore : que le moteur s'efface seulement pendant la phrase qu'une composition écrit elle-même (aujourd'hui `writes_spoken` vaut pour toute l'animation).

### 11. Étalonnage
Pas de look commun. Le studio est sombre et saturé : fond bordeaux #551B24, la moitié de l'image sous 19 % de luminosité. Le salon est clair et presque gris : murs #73716E, lumière du jour. Les images citées restent telles quelles. Pas de grain.

## Format
L'original est **vertical 9:16** (720 × 1280), plein cadre, sans bande. Ce dont il parle prend la forme de la place : détouré au-dessus de lui, dans la moitié du haut (9:8, recadré), plein cadre (9:16, recadré), en carte (≈ 1,9:1), en vignettes 16:9 dans un mur, en captures d'écran verticales. Réglage « format » :
- `auto` : sa vidéo verticale plein cadre, les images comme l'original. Une vidéo horizontale passe dans la moitié du bas, recadrée sur son visage, et les images dans celle du haut tout du long. Une image horizontale va en haut ou dans le mur, une image verticale plein cadre.
- `partagé` : moitié-moitié tout du long, comme de 4 à 12 s.
- `plein écran` : elle plein cadre, et les images plein cadre sur leur mot.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : la plupart des coupes et ce qu'elles montrent (les trois références nommées, le clip à la cerise, le plan américain, la carte du logo, la neige de cassette et le carton de *La Classe américaine*, le salon, la main, la barre de recherche, les quatre captures, la palette), et les mots jusqu'à 15 s.
**Raté** :
- la **musique** : il entend « un beat lo-fi avec des claps doux », mais rien ne se mesure, et le son tombe à −46 dBFS sur les coupes ;
- le **détourage sur le mur** à 0 s (pour lui, « un extrait de clip circulaire ») ;
- la **coupe de 4,03 s** et le **mur recoloré** : il met le fond bleu de 9,67 à 12 s, où il est bordeaux ;
- le **mot à mot** de l'accroche et le **changement de sous-titres** à 4,03 s ;
- le **carillon** du logo ;
- le **mur qui glisse, avec lui devant** (pour lui, « une grille animée ») ;
- le **gros plan** de 30,03 s (pour lui, un seul plan de 27,67 à 31 s) ;
- les mots après 15 s.

Il se trompe aussi trois fois : les bandes de l'accroche ne sont pas « semi-transparentes » (noires pleines dès l'image 5) ; le carton n'est pas « en 4:3 avec des barres » (le bleu remplit l'image) ; son texte n'est pas jaune #EFDE7B mais gris-bleu pâle (#A6B7BA).

## Ce que le modèle v1 ratait
Il n'a pas encore de code (pas de skill) : il passe par la chaîne, menée par sa voix. Ce qui est écrit de lui est loin de l'original : sa fiche dans `house-models.ts`, et sa composition de référence de 2,1 s dans `house-examples.ts`. On y trouve la personne détourée sur un aplat bordeaux, une image dans une fenêtre aux coins arrondis derrière elle, une ligne tapée, un beat lo-fi à 90 BPM, « une nouvelle image à côté d'elle à chaque idée », « des sous-titres blancs sobres sous le visage ». L'original garde sa vraie pièce (son mur n'est recoloré qu'une fois) et n'a pas de musique. Il pose les images au-dessus de lui, jamais à côté ni dans une fenêtre derrière. Il change de forme à chaque idée et écrit l'accroche en bandeaux, mot à mot. Ses mesures (`house-measures.ts`) n'ont que 13 des 19 coupes : il manque 4,03 · 12,07 · 15,10 · 25,73 · 26,37 · 26,90 s.

Une version doit tenir :
- la voix qui décide des coupes : dans ses respirations, ou sur le mot qui nomme une image ;
- la moitié du haut pour ce dont elle parle ;
- une image par nom cité ;
- son logo qui surgit avec un carillon et qui reste ;
- le mur d'images derrière elle ;
- une capture par mot ;
- un autre cadre pour une autre idée ;
- l'accroche en bandeaux mot à mot, puis de petits sous-titres au milieu ;
- pas de musique, ou à peine.

## Ce qu'il faut filmer
- Une vidéo face caméra, téléphone fixe, avec de la place au-dessus de sa tête (la tête vers le milieu de l'image), devant un mur uni, de couleur si possible. Qu'elle commence en se tournant vers la caméra et parle d'un trait.
- La même prise de plus près ou de côté (un second téléphone), ou une seconde prise plus serrée.
- Un plan large d'elle assise dans son lieu.
- Une photo ou une vidéo de chaque chose qu'elle nomme (un objet sur un fond simple se détoure mieux).
- Son logo.
- Des captures de son site, de sa réservation, de ses avis.
- Ses mains qui écrivent un mot, puis son écran qui le tape.
