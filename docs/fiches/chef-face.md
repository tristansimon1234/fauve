# « Le plat, puis la dégustation » (`chef-face`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original.

**L'original** : le lien de Tristan (https://vm.tiktok.com/ZGdXrkNh9/), à garder dans `house/originals/chef-face.mp4` (la copie du banc : `lab/models/977fe39a-10d4-4572-927b-bd4771509646.mp4`, n° 12 de la vague du 5 novembre), 59,87 s (1 796 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son. Un créateur culinaire raconte une recette en voix off : son plat (un curry japonais au poulet) d'abord dressé en gros plans, puis il le goûte face caméra, puis toute la recette en gros plans, puis il regoûte et finit sur sa formule. 49 coupes franches (50 plans), aucun fondu, aucun zoom posé, aucun mouvement rapide (`measure.py` : aucun), rien qui s'allume ni ne clignote. Plus long qu'un Reel d'Edith (45 s au plus) : le modèle garde sa structure en moins de temps (sa longueur est celle de sa parole à elle).

**Son son : sa voix, presque rien d'autre.** Sa voix off du début à la fin : 237 mots en 59,9 s (4 mots par seconde), ses pauses de 0,06 à 0,16 s, jamais plus avant la fin. Dessous, les bruits de ses gestes, plus bas (le versement, le sésame à 2,03 s, la poêle, un croquant à 57,65 s). **Pas de musique qu'on entende** : dans ses pauses, de 300 Hz à 2 kHz, rien de plus que dans le vrai silence de 57,4 s ; sous 65 Hz (sous sa voix), un fond très bas, 30 dB sous elle, sans temps réguliers (une pulsation faible vers 133 BPM, autocorrélation 0,11 : ses consonnes et ses gestes, pas une batterie). **Deux vrais silences** avant sa chute : 57,1–57,9 s (il mange) et 58,6–58,9 s (après « Allez… »), puis sa formule. Niveau : −16,5 LUFS (une voix, pas une musique). Gemini entendait « une musique de fond instrumentale rythmée, tempo moyen » : rien ne la mesure ; `measure.py` donnait 135,5 BPM (sa pulsation 73,25) : ses syllabes. **Aucun tempo à compter : sa voix mène, et ses coupes tombent sur ses gestes ou sur ses mots, jamais sur des temps** (0,21 à 0,32 des coupes près d'un temps, quel que soit le tempo essayé).

**Mesuré avec** : `scripts/fiche/measure.py` (coupes, mouvements, niveau), des planches à 1,5, 5, 10, 15 et 30 i/s des passages (le dressage, la dégustation, la chute), les textes lus sur les pixels (leur boîte, la hauteur de leurs capitales, leur couleur) à chacun des 73 morceaux, le son par bandes (voix 300–3 000 Hz, sous la voix 30–65 Hz, aigus), ses pauses comparées au vrai silence, et la lecture de Gemini (`house/breakdowns/chef-face.json`).

## Déroulé

Le visage à l'écran 25,5 s (43 %), le plat et ses gestes 34,4 s (57 %).

| De – à (s) | Ce qu'on voit | Ce qu'il dit | Effets |
|---|---|---|---|
| 0 – 8,23 | **Le plat qui se finit**, neuf gros plans de 0,47 à 1,67 s (0,92 s en moyenne), chacun un geste entier : le riz démoulé, la sauce versée autour, le sésame, le poulet posé, la sauce encore, les oignons, la ciboulette ; puis le plat fini, un lent mouvement de caméra (6,07 s), et plus serré (7,4 s) | Sa question, puis sa réponse : « … ça doit avoir le goût de la punition ?! Moi perso je préfère que ça ait le goût d'un curry japonais bien crémeux » | Effets 1 et 4 |
| 8,23 – 10,2 | **La bouchée** : la cuillère qui prend, deux très gros plans | « Et en plus d'être indécemment canon » | Effet 2 |
| 10,2 – 15,67 | **Il goûte face caméra**, le plat au premier plan : quatre réactions de 0,5 à 0,7 s (la cuillère en bouche, les baguettes, les yeux fermés, la main à l'oreille), puis il parle à la caméra 3,1 s et s'approche | Pourquoi c'est bon : le temps, la facilité, le goût | Effet 2 ; deux morceaux en grand |
| 15,67 – 20,2 | Il tend l'ingrédient cru à la caméra (le bol à bout de bras, grand angle), deux plans | Ce qu'on prend, ce qu'on peut remplacer | Le cadre change sur l'attaque de sa phrase (effet 3) |
| 20,2 – 39,83 | **La recette en gros plans**, quinze plans de 0,3 à 3,5 s : les épices, le poulet massé, la poêle froide, le poulet posé, retourné, les oignons, la sauce soja, le lait de coco, les cubes, l'eau, la sauce qui nappe la cuillère | Chaque étape, l'une après l'autre | Effet 3 ; un morceau en grand (« DÉPART À FROID ») |
| 39,83 – 43,63 | Lui au comptoir, face caméra, qui filtre la sauce | Une blague sur ses enfants | Un morceau en grand |
| 43,63 – 48,17 | Les derniers gestes (la passoire, les oignons gardés en bol), puis le plat et la cuillère | « T'as plus qu'à dresser ça » | — |
| 48,17 – 51,97 | **Il regoûte** face caméra, six plans en sauts dans le même cadre (0,37 à 1,1 s) | L'appel à s'abonner | Deux morceaux en grand |
| 51,97 – 57,2 | L'accompagnement tenu à la caméra (une salade de chou), goûté aux baguettes, 5,2 s | Le conseil, « la recette en description » | — |
| 57,2 – 59,87 | **La chute** : il mange (silence), « Allez… », un silence, puis sur une coupe sa formule en très grand sur deux lignes, le doigt pointé sur nous | Sa formule de fin | Effet 5 |

## Effets (ce qu'on veut savoir refaire)

### 1. Le résultat d'abord : le plat qui se finit, en gros plans rapides, sous sa voix
- **Mesuré** : de 0 à 8,23 s, neuf plans de 0,47 à 1,67 s, 0,92 s en moyenne, puis deux plans du plat fini (le second plus serré : deux plans de beauté). Chaque plan est un geste entier (verser, saupoudrer, poser) : la coupe tombe à la fin du geste, ni sur un temps ni sur sa voix (à 0,1 à 0,4 s de ses morceaux de texte). Filmés de haut et de trois quarts, en très gros plans, à vitesse réelle (la ciboulette tombe des doigts au plat en quatre images, comme sans ralenti). Sa voix commence à la première image ; on ne le voit pas avant 10,2 s.
- **Sur quoi** : tout ce qu'un commerce finit de ses mains : un plat dressé, un gâteau nappé, un café versé, un bouquet noué, une coupe terminée.
- **Outil** : un modèle calé sur sa voix (`SkillVoice`), ses images posées sur ce qu'elle dit (`refs`) : les images de sa première idée l'une après l'autre plein cadre, chacune sa part de l'idée, 1,5 s au plus, à sa propre vitesse depuis son meilleur moment (**ajouté** : `SkillVoice.turns`, plus bas ; sans lui, chaque image courait sur toute l'idée, une vidéo courte ralentie pour la remplir).
- **Si rien ne s'y prête** : sans image pour sa première idée, son visage dès la première image.

### 2. La bouchée, puis elle qui goûte face caméra
- **Mesuré** : 8,23 – 10,2 s, deux très gros plans de la cuillère qui prend ; coupe à 10,2 s sur lui à table, le plat au premier plan ; il mange (quatre réactions de 0,5 à 0,7 s : la cuillère en bouche, les baguettes, les yeux fermés, la main à l'oreille) **pendant que sa voix continue** (c'est une voix off : il a la bouche pleine sur « il prend moins de 30 min »), puis 3,1 s face caméra, il s'approche de l'objectif ; à 48,17 – 51,97 s il regoûte (six sauts dans le même cadre). Ses deux temps face caméra changent de cadre sur l'attaque de sa phrase (15,667 s pour « ON UTILISERA… » à 15,67 ; 39,833 pour « ET SI COMME… » à 39,8 ; 51,967 pour « POUR ÉQUILIBRER… » à 52,0 : à une image près).
- **Sur quoi** : elle (ou le chef) à table devant son plat, face caméra ; ses vidéos qui goûtent.
- **Outil** : sa vidéo où elle parle, coupée par le moteur (ses « euh » et ses longues pauses retirés, `skillTalk`), le cadre qui change entre deux idées sur l'attaque du premier mot de la suivante (`cut: "attack"`), un cadre plus serré une idée sur deux (existant). La bouchée dans sa vidéo où elle parle, elle, disparaîtrait : le moteur coupe ses silences de plus de 0,4 s (`speechCuts`) ; d'où ses vidéos qui goûtent, à part, posées comme images de l'idée où elle parle du goût, l'une après l'autre avant son visage (1,5 s au plus chacune).
- **Si rien ne s'y prête** : sans vidéo où elle goûte, son visage directement après le plat.

### 3. Chaque étape sur le mot qui la nomme
- **Mesuré** : de 15,67 à 52 s, les coupes qui ouvrent une étape tombent sur l'attaque du morceau qui la nomme, à une ou deux images près : « ASSAISONNE AVEC » 20,2 / coupe 20,2 ; « DÉPART À FROID » 25,07 / 25,067 ; « LAIT DE COCO ALLÉGÉ » 33,47 / 33,533 ; « ET 2 CUBES… » 34,67 / 34,733 ; « MAIS COMME NOUS… » 43,6 / 43,633. Les autres coupes de la recette (huit sur vingt) tombent au milieu d'une phrase, à la fin d'un geste. L'image de l'étape reste jusqu'à l'étape suivante (1,2 à 3,5 s). Les épices : un seul plan (20,2 – 23,73 s) où chacune tombe dans le bol quand il la nomme (c'est filmé ainsi, pas monté).
- **Sur quoi** : une recette, une préparation, un soin ou une coupe en étapes, une liste qu'elle dit.
- **Outil** : les noms d'une liste qu'elle dit (`items`), chacun avec sa vidéo (`file`) : plein cadre de l'instant où elle le dit jusqu'au suivant (existant, `SkillSaid.refs`).
- **Si rien ne s'y prête** : ses images de l'idée l'une après l'autre (effet 1).

### 4. Ses mots en petits morceaux au milieu, le mot fort en grand
- **Mesuré** : 73 morceaux de 1 à 7 mots (3 en médiane : 4 d'un mot, 23 de deux, 17 de trois, 13 de quatre, 13 de cinq), 17 signes en médiane, 29 au plus, tenus de 0,2 à 1,8 s (0,8 s en médiane) ; chacun posé **en une image** quand il le dit, remplacé par le suivant (aucune animation : image 78 « ÇA DOIT AVOIR », image 79 « LE GOÛT DE LA PUNITION ?! ») ; rien quand il se tait (57,2 s). En capitales d'une linéale très condensée et grasse, aux bouts de traits à peine évasés (l'allure de Bebas Neue), **crème #F2E9DC**, pas blanc pur (lu sur les pixels : #EFE9DD à #FFEDDC), une ombre sombre et floue autour des lettres, sans contour ni bandeau. Centrés en largeur (49,9 %) sur **une seule ligne à 59,3 % de la hauteur**. Les petits : capitales de 23 px sur 1 280 (1,8 % de la hauteur) ; **neuf en grand**, capitales de 41 px (3,2 %, 1,75 fois), un par idée environ, sa formule forte : « LE GOÛT DE LA PUNITION ?! », « CURRY JAPONAIS », « DE 30 MIN. À FAIRE », « DÉRAISONNABLE EN GOÛT », « DÉPART À FROID », « TE TERRORISENT », « ET À T'ABONNER », « FIT & GOURMANDES ! » ; aucun pendant les étapes (27 – 42 s).
- **Sur quoi** : ses mots à elle, pour n'importe quel commerce.
- **Outil** : son code écrit tout ce qu'elle dit (`subtitles: "own"`, `spoken` : ses mots chacun à son image), par morceaux de quatre mots et 22 signes au plus, coupés sur ses virgules, ses points et ses pauses ; le mot fort de chaque idée (le `key` de son remplisseur : deux à quatre mots qu'elle dit d'un trait, écrits comme elle les dit) en grand à la même place, de l'instant où elle le dit à la fin de ses mots (existant). Sa police de titre ; Bebas Neue (la paire « condensée géométrique ») quand elle choisit le modèle.
- **Si rien ne s'y prête** : le moteur réécrit ses sous-titres sous la composition si elle en écrit moins de six sur dix (le contrôle des scènes le mesure).

### 5. Sa formule de fin en très grand, après un silence
- **Mesuré** : à 59,03 s, sur une coupe dans le même cadre, sa formule en très grand **sur deux lignes à la fois** (capitales de 81 px, 6,3 % de la hauteur, 3,5 fois les petits), centrées sur la même ligne (54,4 % et 62,8 % de la hauteur), crème, jusqu'à la fin (0,87 s), lui qui pointe la caméra du doigt. Juste avant, deux silences : 0,8 s pendant qu'il mange, 0,3 s après « Allez… ». Son nom de communauté dans la formule (« … les Lukum ! ») est **à l'original, jamais recopié** : ses derniers mots à elle à la place (« Bon appétit ! », « Venez la goûter ! »).
- **Sur quoi** : la fin de n'importe quel Reel où elle parle : sa formule, son invitation.
- **Outil** : sa dernière idée, dont le mot clé est sa formule de fin, écrite en très grand sur deux lignes de l'instant où elle la dit à la fin, sur son visage (aucune image alors) ; **la musique coupée net à cet instant** (`music.end`) : le moteur raccourcit ses pauses à 0,24 s, son silence à lui devient l'arrêt de la musique (Tristan : les pauses de musique, « oui pourquoi pas si c'est bien fait »).
- **Si rien ne s'y prête** : une seule idée : son mot fort en grand, sans formule.

### 6. Étalonnage et prise de vue
Chaud, contrasté et saturé : des noirs denses, des reflets sur l'inox, la sauce orangée, un mur orange vif derrière lui (son décor, à l'original). Les gestes en très gros plans, téléphone tenu au-dessus ou de trois quarts ; lui en plan moyen, cadre fixe, un grand angle quand il tend le bol. Ni grain ni coins sombres.

## Ce qui appartient à l'original
À l'original, jamais recopié : son nom de communauté (« les Lukum »), sa ligne (« fit & gourmandes »), son appel à s'abonner et sa recette en description, ses mots et sa blague, son curry, son mur orange. Le modèle garde la forme : le plat d'abord, la bouchée, la dégustation, les étapes sur ses mots, la formule de fin, avec ses images et ses mots à elle.

## Musique
L'original n'en a pas qu'on entende (plus haut) ; ses gestes ont leur son. Le moteur ne fait pas entendre les images posées sur sa parole (`refs`, jamais entendues) : une musique douce les remplace sous sa voix (la mise en forme du mixage la baisse quand elle parle), choisie à 96 BPM puisqu'aucun tempo ne se compte, et coupée net sur sa formule de fin. Si Tristan préfère sa voix seule, comme l'original : `music: { none: true }`.

## Format
**Depuis le 6 novembre** (Tristan, sur sept bancs : « vertical please », « tout vertical please ») : `vertical` par défaut, plein écran, ses fichiers horizontaux recadrés sur leur sujet ; `horizontal` (sa bande) seulement à sa demande, ou quand elle veut ses vidéos entières (le `frame` letterbox de son contrat) ; `auto` (comme ses vidéos, ci-dessous) seulement si elle le demande. `docs/modeles.md`, « Réglages d'un modèle ».

Vertical 9:16, plein cadre. Réglage `format` : `auto` (comme sa vidéo où elle parle : verticale, tout plein cadre ; horizontale, toutes ses images entières dans une bande 16:9 sur du noir, ses mots sur la même ligne), `vertical`, `horizontal`.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, l'ordre (le plat dressé, la dégustation, la préparation, l'accompagnement et la fin), chaque geste de la recette, la voix off, les mots à l'écran (ses 73 morceaux, à leurs instants à quelques images près), « l'accroche culinaire inversée » (le résultat avant la recette).

**Raté** : les **coupes** (24 plans au lieu de 50, et seulement trois « transitions » sur 49 : les quatre réactions de 10,2 à 12,57 s et les sauts de la fin fondus en un plan) ; la **musique** (il en entend une, rythmée : on ne mesure que sa voix et ses gestes) ; la **taille des mots** (tous à 5 % de haut : il manque les neuf morceaux 1,75 fois plus grands et la formule 3,5 fois plus grande) ; leur **couleur** (« #FFFFFF » : crème #F2E9DC) ; un **contour noir** de 2 px qui n'existe pas (une ombre floue) ; leur **ligne** (57 % : 59,3 %) ; la **formule de fin**, donnée en deux morceaux successifs, alors que ses deux lignes arrivent ensemble sur une coupe à 59,03 s ; les **deux silences** qui la précèdent.

## Ce qu'il faut filmer
1. **Toi (ou le chef) à table, face caméra**, ton plat devant toi, le téléphone posé à hauteur des yeux, en vertical : tu racontes ton plat en 15 à 40 s (ce qu'il a de bon, comment il se fait, en nommant les étapes l'une après l'autre), et tu finis sur une formule (« Bon appétit ! », « Venez le goûter ! »).
2. **Ton plat qui se finit**, 3 à 8 vidéos de 2 à 4 s en très gros plans, téléphone au-dessus ou de trois quarts, chaque geste en entier : la sauce versée, le dressage, la dernière touche, le plat fini ; la cuillère ou la fourchette qui prend une bouchée.
3. **Toi qui goûtes**, une ou deux vidéos à part de 2 à 4 s (la bouchée, les yeux fermés).
4. **Les étapes** que tu nommes, une vidéo de 2 à 4 s par étape, dans l'ordre où tu les dis.

## Le modèle v1 (5 novembre)
`skills/chef-face.ts`, version 1, calé sur sa voix : sa vidéo où elle parle fait le Reel (sa longueur, 45 s au plus), ses autres fichiers posés sur ce qu'elle dit.
- **Le plat d'abord** : les images de sa première idée l'une après l'autre plein cadre (1,5 s au plus chacune, à leur vitesse ; la bouchée en dernier, son remplisseur les range ainsi) avant qu'on la voie.
- **La dégustation** : les images de chaque idée suivante passent de même puis son visage, le cadre changeant sur l'attaque de son idée suivante, plus serré une idée sur deux.
- **Les étapes** : l'image de chaque nom de sa liste plein cadre de l'instant où elle le dit au suivant.
- **Ses mots** : tous écrits par son code, quatre au plus à la fois, crème, sur la ligne des 59 % (plus bas sous son menton ou au-dessus de sa tête quand son visage est dessus, lu une fois par plan) ; le mot fort de chaque idée en grand, à la même place ; sa formule de fin en très grand sur deux lignes jusqu'à la fin, sur son visage.
- **Le son** : sa voix ; une musique douce dessous, coupée net sur sa formule.
- **Ce qui manque** : le son de ses gestes sous sa voix (les images posées sur sa parole ne sont jamais entendues) ; ses silences avant la chute (le moteur les raccourcit : l'arrêt de la musique en tient lieu) ; les sauts rapides de la fin (un cadre par idée).
