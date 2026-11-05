# « Pas à pas raconté » (`recette`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « images » compte ses images à 30 i/s depuis la première (0).

**L'original** : le lien de Tristan https://vm.tiktok.com/ZGdXr6N3n/ (`house/originals/recette.mp4` une fois gardé ; mesuré ici sur sa copie locale), 44,97 s (1349 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son (AAC à 44,1 kHz, stéréo mais en fait mono : sa différence gauche moins droite est à −52 dB ; −14,3 LUFS intégrés). Une recette de raviolis (une pâte au yaourt, une farce de poulet et de légumes, cuits à la poêle puis à la vapeur, une sauce soja, miel et sésame) **racontée par son créateur en voix off**, du plat fini à la dégustation. Tout l'original sert au modèle (pas de passage dans `HOUSE_PASSAGES`).

**Son son** : **sa voix off du début à la fin**, un homme qui parle au tutoiement, vite (environ 210 mots en 45 s, 4,7 par seconde), presque sans respirer : deux pauses de plus de 0,15 s en tout (28,63 – 28,79 s et 37,07 – 37,23 s). **Dessous, un fond musical tenu, une douzaine de dB sous elle** : dans ses deux pauses, −27,7 et −23 dB RMS, de l'énergie entre 63 et 500 Hz avec des notes tenues (des pics à 484, 226 et 129 Hz, une ligne vers 550 Hz qui traverse le spectre), pendant qu'elle parle vers −15 dB. **Aucune batterie qu'on puisse mesurer** : rien de régulier dans les graves (35 – 110 Hz : la voix y descend, et dans la pause de 37,1 s elles tombent à 4,7 dB, sans un coup), rien dans les aigus que ses « s » (6 – 11 kHz), aucune boucle (la ressemblance du spectre avec lui-même de 1 à 25 s plus tard reste sous 0,04). **Pas de tempo mesurable**, et **les coupes ne suivent aucun temps** : la meilleure grille (86,25 BPM) les place en moyenne à 0,092 temps du demi-temps le plus proche, et 56 coupes tirées au hasard sur 45 s donnent 0,085 à 0,099 avec la même recherche. Elles suivent sa voix : une étape par phrase, un geste par bout de phrase. Gemini disait « lo-fi / chillhop, 85 BPM » (pas vérifiable : rien de mesuré ne le dément ni ne le confirme) ; `measure.py` 105,5 (sa « pulsation » de 74,5 est le débit des syllabes) ; le modèle compose la sienne à **85 BPM**, où un temps (21,2 images) dure à peu près un geste de l'original (la moitié des gestes de ses étapes font de 18 à 23 images, 20 au milieu). Aucun bruitage : la différence gauche moins droite ne garde que des claquements de bouche de 20 à 60 ms sous −36 dB (un seul plus fort, −24,8 dB à 1,12 s), et le son des gestes (le couteau, la poêle) ne s'entend pas sous la voix.
**Mesuré avec** : `scripts/fiche/measure.py`, puis la différence de chaque image avec la précédente (90 × 160, la bande des sous-titres masquée, chaque pic plus de 2,5 fois au-dessus de ses voisines : 56 coupes), une planche avant/après de chacune et des planches à 30 i/s des gestes, la bande des sous-titres lue au pixel image par image (son encre blanche : place, taille, couleur, chaque changement), des gros plans de lettres à côté de polices Google, les couleurs prises sur les pixels, le son en milieu et en côté (gauche ± droite), par bandes, en spectrogrammes zoomés, en autocorrélation et en ressemblance du spectre avec lui-même, la grille des coupes contre des coupes au hasard, et la lecture de Gemini (`house/breakdowns/recette.json`).

## Déroulé

14 endroits (un par réglage de caméra), 57 plans : 13 coupes vers un nouvel endroit et **43 coupes dans le même endroit**, un geste chacune. Les longueurs sont celles des gestes en images.

| De – à (s) | Images | Ce qu'on voit | Gestes (images) | Ses mots (sa voix) | Effets |
|---|---|---|---|---|---|
| 0 – 1,03 | 0 – 30 | **De face** : il pose la poêle de raviolis dorés au vert d'oignon sur son plan de travail en bois, devant l'objectif ; son buste en t-shirt bordeaux derrière, sans sa tête | 31 | « si tu veux vraiment perdre du poids » | **Le résultat d'abord** (1) |
| 1,03 – 3,67 | 31 – 109 | De tout près : un ravioli soulevé aux baguettes devant l'objectif, la poêle floue dessous | 79 | « il te faut deux trucs : du plaisir et du volume » | (1), **les mots qui racontent** (4) |
| 3,67 – 7,90 | 110 – 236 | De face, au comptoir : un saladier de verre ; la farine versée, le yaourt, le sel, la levure, il pétrit, la boule montrée | 18 · 23 · 21 · 23 · 19 · 23 | « et c'est exactement pour ça que j'ai créé cette recette, tu vas commencer par faire ta pâte en 2 minutes » | **Une étape, geste par geste** (2), **de face** (3) |
| 7,90 – 10,23 | 237 – 306 | La planche, de face et d'en haut : carotte, courgette, poivron, oignon nouveau | 19 · 17 · 15 · 19 | « en mélangeant 4 ingrédients tout simplement » | (2) |
| 10,23 – 15,43 | 307 – 462 | **De dessus** : la poêle en fonte vide, l'oignon, la carotte, le poivron, on remue, la courgette et le couvercle | 49 · 17 · 20 · 20 · 20 · 30 | « ensuite tu tailles tes légumes puis tu les fais revenir dans une poêle bien chaude, les courgettes en dernier… » | (2), **de dessus** (3) |
| 15,43 – 17,60 | 463 – 527 | De face : les hauts de cuisse coupés au couteau | 15 · 11 · 19 · 20 | « tu mets un couvercle et tu laisses cuire, ensuite tu tailles ta viande » | (2) |
| 17,60 – 21,80 | 528 – 653 | De dessus : le bois nu, un saladier glisse dedans, la viande, les légumes versés de la poêle, la sauce, la spatule, on mélange | 24 · 27 · 16 · 20 · 20 · 19 | « et tu la haches au couteau, pas besoin que ce soit trop fin, tu la mets dans un saladier… » | (2) |
| 21,80 – 25,20 | 654 – 755 | De dessus : la boule de pâte arrive, coupée au couteau deux fois, prise, roulée entre ses paumes | 23 · 18 · 20 · 12 · 29 | « …et la sauce soja, maintenant tu vas détailler ta pâte » | (2) |
| 25,20 – 27,17 | 756 – 814 | De dessus : douze boules en deux rangs sur le bois fariné, le rouleau, le disque | 19 · 18 · 22 | « pour faire tes 12 raviolis, tu fais des boules » | (2) |
| 27,17 – 29,10 | 815 – 872 | De dessus, plus près : la farce posée, le pliage | 17 · 19 · 22 | « et y a plus qu'à les étaler et y disposer la farce » | (2) |
| 29,10 – 34,27 | 873 – 1027 | De dessus : la poêle noire vide, les raviolis posés un à un en couronne, un dessous doré montré aux baguettes, l'eau, le couvercle | 18 · 21 · 15 · 18 · 33 · 21 · 29 | « tu fais un pliage assez simple puis tu les fais griller dans ta poêle, il faut que ça ressemble à ça, tu rajoutes de l'eau, un couvercle… » | (2) |
| 34,27 – 39,20 | 1028 – 1175 | De face : un petit bol de verre ; le miel, la sauce soja, l'huile de sésame, les graines, on mélange | 34 · 27 · 32 · 36 · 19 | « …et pendant que ça cuit 10 minutes, tu fais ta sauce avec miel, sauce soja, huile de sésame et quelques graines de sésame » | (2), (3) |
| 39,20 – 42,03 | 1176 – 1260 | De dessus : la poêle découverte, la sauce versée sur les raviolis, le vert d'oignon | 27 · 35 · 23 | « tu verses ça sur tes raviolis avec un peu de vert d'oignon que t'as gardé » | (2) |
| 42,03 – 44,97 | 1261 – 1348 | **Dans sa cuisine, face à l'objectif** : le ravioli ouvert tendu vers l'objectif, il croque, il mâche, la tête penchée, l'air conquis | 26 · 20 · 42 | « et pour moins de 100 calories le ravioli, tu te régales » | **La fin : il goûte** (5) |

Aucune transition : des coupes franches. Aucun zoom, aucune poussée, aucun mouvement de caméra (le téléphone est posé à chaque endroit ; le fil du bois ne bouge pas dans le premier plan, où c'est la poêle qui descend vers le comptoir). Ni flash, ni noir, ni rien qui s'allume : `measure.py` ne trouve aucun flash, et ses 99 « clignotements » sont ses mains, la farine, la vapeur et les sous-titres.

## Effets (ce qu'on veut savoir refaire)

### 1. Le résultat d'abord, puis une bouchée soulevée vers l'objectif
- **Mesuré** : image 0, le plat fini est déjà là, en mouvement : il pose la poêle sur son plan de travail, de face (elle descend de 25 – 45 % à 45 – 85 % de la hauteur en 30 images, le bois immobile dessous : un geste, pas un zoom). Son buste bordeaux remplit le haut de l'image, sa tête hors cadre. À l'image 31, coupe sur un plan serré : un ravioli soulevé aux baguettes juste devant l'objectif, la poêle floue dessous, tenu 79 images (2,6 s), le plus long plan du Reel. Les premiers mots arrivent à l'image 2. La promesse (« si tu veux vraiment perdre du poids, il te faut deux trucs : du plaisir et du volume ») se dit sur ces deux plans, jusqu'à la première étape (3,67 s).
- **Sur quoi** : le résultat de n'importe quel savoir-faire, fini, posé devant l'objectif (le plat sur le comptoir, le bouquet sur la table, la tête coiffée de face, la tasse tournée), puis de tout près, ce qu'on en prend ou qu'on en montre (une bouchée tenue, une fleur, une mèche, l'anse).
- **Outil** : le déroulé du skill (ses deux premières cases), `Footage`.
- **Si rien ne s'y prête** : une seule vidéo de son résultat, ses deux passages.

### 2. Une étape par endroit, coupée geste par geste
- **Mesuré** : 11 étapes, chacune d'un seul endroit, en 3 à 7 gestes coupés l'un après l'autre dans le même cadre (43 coupes dans le même endroit sur 56 : la farine, puis le yaourt, puis le sel, puis la levure dans le même saladier ; la carotte, puis la courgette, puis le poivron sur la même planche). Chaque coupe tombe sur le début du geste suivant : le saladier s'incline dès l'image 113 du plan qui commence à 110, la cuillère de yaourt est déjà au-dessus du saladier à l'image 128 ; les temps morts entre deux gestes sont coupés. Des gestes de 11 à 49 images (0,37 à 1,63 s), la moitié entre 18 et 23 images, à **vitesse réelle** (la farine tombe une dizaine d'images, comme versée ; le couteau sur la carotte frappe toutes les 5 à 6 images, un geste de cuisinier rapide ; la viande et le pliage, lents) : Gemini dit « accéléré » pour la pâte, la découpe et le hachage, rien ne le montre.
- **Sur quoi** : tout savoir-faire filmé téléphone posé, chaque étape d'un seul endroit : une recette, un bouquet monté tige par tige, une coupe, une pièce tournée, un soin, un café.
- **Outil** : le déroulé du skill (ses cases d'une même étape veulent la même vidéo, juste après, comme « Recette cosy, typo pixel »), plusieurs passages d'une vidéo.
- **Si rien ne s'y prête** : une vidéo par étape, ses gestes en deux ou trois passages de la même vidéo.

### 3. Deux points de vue : de face derrière le comptoir, et de dessus
- **Mesuré** : 3 étapes de face (la pâte, la viande, la sauce) : le téléphone à hauteur du plan de travail, son bord vers 40 % de la hauteur, son buste bordeaux (#4B0F15) en fond uni au-dessus, jamais son visage ; les 8 autres de dessus, le plan de travail en bois clair (#A67A42) remplissant l'image, la poêle, le saladier ou la planche au milieu. Le même bois partout : il tient les 57 plans ensemble.
- **Sur quoi** : son plan de travail (un comptoir, un établi, sa table de coupe, son tour), filmé de dessus ou de face.
- **Outil** : ce que ses cases demandent (`want`).
- **Si rien ne s'y prête** : ses vidéos comme elle les a filmées.

### 4. Les mots qui racontent : des sous-titres mot à mot, au milieu de l'image (le moment signature)
- **Mesuré** : tout ce qu'il dit est écrit **au milieu de l'image**, en **petits groupes de 1 à 3 mots** (au plus 5 : « que ce soit trop fin »), qui se remplacent au fil de sa voix : 104 groupes, de 6 à 17 images chacun (11 au milieu), parfois séparés de 2 à 10 images sans texte quand il reprend son souffle. Chaque groupe arrive **d'un coup** et part d'un coup (son encre est entière dès sa première image : ni fondu, ni pop, ni mot tapé), sans suivre les coupes. **En minuscules**, sans ponctuation, dans une **serif grasse** (Georgia Bold à l'œil : des boules au bout des « a » et des « r », un « g » à deux étages, des chiffres elzéviriens, le « 1 » et le « 0 » de « 100 calories » à la hauteur des minuscules), d'un **blanc chaud** (254, 250, 247), une ombre sombre très légère en bas à droite (sans contour, sans boîte). Toujours la même taille : œil (hauteur des minuscules) de 20 à 21 px sur 1280 (1,6 %), hampes de 31 à 32 px (2,5 %), soit une police d'environ 64 px en 1080 × 1920 ; le milieu de ses minuscules à **50,0 % de la hauteur**, centré sur la largeur (le plus long groupe en fait 56 %). Sur les plans de dessus, il tombe sur ce qui se passe (le saladier, la poêle) ; de face, sur le bord du plan de travail ; à la fin, sur sa bouche (« 100 calories »).
- **Sur quoi** : n'importe quels gestes : les mots disent ce qu'on fait, au moment où on le fait.
- **Outil** : le code du modèle (`FitText` pour chaque groupe ; tous les groupes d'un texte gardés dans la page, un seul visible, pour que le contrôle des scènes le trouve entier, comme les légendes de « Recette cosy, typo pixel ») ; sa police dans une nouvelle paire « Sous-titres serif » (Gelasio 700, la jumelle de Georgia sur Google Fonts, aux mêmes chiffres elzéviriens, comparée lettre à lettre sur « 12 raviolis »).
- **Manquant** : **sa voix**. Un modèle joué tel quel n'a pas de voix off (une voix fait passer le Reel par la chaîne, `beyondSkills` ; le chantier B de `docs/reprise.md`, « une voix off sur n'importe quel modèle », ses sous-titres dans le style du modèle). Sans elle, les mots ne peuvent pas aller à 4,7 par seconde : le modèle les écrit comme les sous-titres d'une voix qu'on n'entend pas, **un groupe par geste**, changé sur la coupe, chacun tenu le temps de son geste (un groupe de trois mots au moins 1,4 s, ce qu'il faut pour le lire).
- **Si rien ne s'y prête** : ses mots dans sa charte (ses polices quand c'est Edith qui choisit le modèle), toujours au milieu.

### 5. La fin : il goûte, face à l'objectif
- **Mesuré** : un autre endroit (sa cuisine, un mur gris-beige, des plantes) et le seul plan où on le voit : de face, en plan rapproché, il tend le ravioli ouvert vers l'objectif (flou, tout près, la farce visible : 26 images), croque (20), mâche, la tête penchée, les sourcils levés, l'air conquis (42 images) ; « tu te régales ». Ni carte de fin, ni logo, ni noir : le Reel s'arrête sur sa réaction.
- **Sur quoi** : elle (ou un client) qui goûte, sent le bouquet, se regarde dans le miroir, boit dans la tasse : la réaction, face à l'objectif.
- **Outil** : les dernières cases du skill ; ses mots posés sous son visage quand on le suit (`track(frame, box).faces`), jamais sur sa bouche comme l'original : un texte ne reste pas sur un visage.
- **Si rien ne s'y prête** : son résultat de tout près, une dernière fois.

### 6. Le son : sa voix et un fond doux, rien d'autre
- **Mesuré** : en tête de fiche. Aucun bruitage, aucun son des gestes, la musique jamais coupée ni étouffée.
- **Outil** : la musique composée au tempo du modèle (85 BPM), douce ; sa voix off quand une voix pourra se poser sur un modèle.
- **Tant qu'il manque** : la musique seule.

### 7. Étalonnage
Chaud et saturé, jamais clair : le bois miel (#A67A42 de dessus, #9D6E3B de face), la fonte presque noire (#1F130F), son t-shirt bordeaux ; saturation moyenne de 0,62 à 0,78 ; le 98e centile de la luminosité entre 148 et 174 sur 255 (des hautes lumières retenues, rien de blanc que la farine et la pâte) ; ni grain, ni coins assombris (sur le bois nu de l'image 540, les coins sont aussi clairs que le milieu ; Gemini disait « vignettage léger »). Finition du modèle : « Bois chaud » (un peu de chaleur, de contraste et de saturation), sur la lumière « warm » de chaque plan.

## Ce qui appartient à l'original
**À l'original, jamais recopiés** : sa voix, son visage et sa cuisine, ses mots (sa promesse de régime, « perdre du poids », « moins de 100 calories le ravioli », c'est la sienne : un commerce n'écrit jamais une promesse de santé qu'il ne peut pas tenir), sa recette, son t-shirt bordeaux. Le modèle écrit ses mots à elle : ce que montrent ses gestes, sa promesse à elle.

## Format
L'original est vertical 9:16, plein cadre. Réglage « format » :
- `auto` (par défaut, comme ses vidéos) : plein écran vertical comme l'original ; en 16:9 sur du noir quand la plupart de ses vidéos sont en largeur ;
- `vertical` : plein écran, ses vidéos en largeur recadrées sur leur sujet ;
- `horizontal` : ses vidéos entières dans une bande 16:9 sur du noir.
Dans tous les cas, ses mots au milieu de l'image (au milieu de la bande en 16:9).

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, la voix off qui raconte tout, les 14 endroits (ses 14 « plans » sont nos endroits, à 0,1 s près) et ce qu'on y fait, les mots dits (son texte suit la voix presque mot pour mot), une serif grasse blanche au milieu (« 47 % de la hauteur »), des mots qui changent « mot par mot », des coupes franches, un étalonnage chaud, la dégustation face caméra à la fin.

**Raté** :
- les **43 coupes dans le même endroit** : il voit un plan par endroit, là où chaque étape est coupée geste par geste ;
- le **premier plan** : « un plan en plongée sur la poêle », c'est de face, la poêle posée sur le comptoir pendant qu'on la regarde ;
- des gestes « accélérés » (la pâte, la découpe, le hachage, le mélange) : ils sont à vitesse réelle ;
- la **musique** : « lo-fi / chillhop à 85 BPM » ; on n'entend qu'un fond tenu une douzaine de dB sous la voix, sans batterie mesurable, sans tempo, et les coupes ne suivent aucun temps ;
- les **sous-titres** : il les place sur 80 % de la largeur (56 % au plus) et les date par phrases, alors qu'ils vont par groupes de 1 à 3 mots de 0,37 s environ ; il ne voit ni leur blanc chaud, ni leurs chiffres elzéviriens, ni leur ombre légère ;
- un « vignettage léger » qui n'est pas là.

`measure.py`, lui, voyait 105,5 BPM (sa pulsation de 74,5 est le débit des syllabes), 37 coupes (il en manque 19 dans le même endroit) et 99 « clignotements » qui sont des gestes : rien ne s'allume.

## Ce qu'il faut filmer
Le téléphone posé, jamais à la main : sur un pied au-dessus de son plan de travail (de dessus), ou à hauteur du plan de travail, elle derrière (de face : on voit ses mains et son buste, pas forcément sa tête). Une lumière chaude, un plan de travail qui revient d'un plan à l'autre (du bois, sa table, son établi).
1. Son résultat fini, de face, qu'elle pose devant l'objectif (le plat sur le comptoir, le bouquet sur la table) ; puis de tout près, ce qu'on en prend ou qu'on en montre (une bouchée tenue, une fleur, une mèche).
2. Chaque étape d'un seul endroit, en plusieurs gestes courts l'un après l'autre (ce qu'on ajoute, ce qu'on coupe, ce qu'on mélange, ce qu'on plie), sans bouger le téléphone : les temps morts entre deux gestes sont coupés.
3. La fin : elle, ou un client, qui goûte, sent, essaie ou reçoit, face à l'objectif, et sa réaction.
Pour une fleuriste : les tiges coupées en biais, le bouquet monté fleur par fleur, le ruban, puis la cliente qui le sent ; pour un barbier : la tondeuse, les ciseaux, le dégradé, puis le client qui se regarde ; pour une céramiste : la terre centrée, montée, tournassée, émaillée, puis quelqu'un qui boit dans la tasse.
