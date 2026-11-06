# « Création à quatre mains » (`en-boutique`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « images » compte ses images à 30 i/s depuis la première (0).

**L'original** : le Reel N° 16 de Tristan, https://vm.tiktok.com/ZGdXr2eac/ (`house/originals/en-boutique.mp4` une fois gardé ; mesuré ici sur sa copie locale), 71,73 s (2152 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son (−21,2 LUFS intégrés). Un créateur de contenu arrive chez un pizzaïolo d'une halle gourmande avec des fruits et légumes sauvés du gaspillage, et ils font une pizza ensemble devant la caméra, de l'idée à la dégustation ; **tout ce qu'ils se disent est sous-titré**, et le nom de la création surgit en **autocollant de bande dessinée** sur eux. Filmé à la main comme un vlog, micros-cravates. Il dure plus que les 45 s d'un Reel d'Edith (`MAX_REEL_SECONDS`) : le modèle garde sa structure et raccourcit ce qui se dit (pas de passage dans `HOUSE_PASSAGES` : chaque partie sert).

**Son son** : leurs **deux voix du début à la fin** (vers −20 dB au milieu), et dessous une **musique enjouée en stéréo** (Gemini : « comédie italienne, guitare acoustique et percussions légères », pas vérifiable au détail) dont la pulsation mesurée est de **133,75 BPM** (un temps toutes les 0,449 s, la plus forte dans les graves, 35 – 110 Hz). Elle n'est pas là tout du long : très douce sous l'idée (le côté, gauche moins droite, à −58 à −90 dB de 0 à 4,25 s), elle **entre sur un boum grave quand l'artisan paraît** (4,43 s : le côté monte à −23,7 dB, le plus fort de tout le Reel), puis **s'arrête net** sous une partie de l'échange (le côté à zéro, un son purement mono : rien que leurs voix, de 9,75 à 15,5 s) et des gestes (presque partout de 21,3 à 28,5 s), revient douce, plus nette dans la finale (sa grosse caisse sur les temps 4 à 5 fois plus forte qu'à côté de 56 à 64 s). **Ses coupes ne suivent pas ses temps** : `measure.py` met ses trois meilleures grilles à égalité (0,33 à 0,35 d'accord, autant que le hasard) ; elles suivent les répliques. **Quatre bruitages**, lus sur le côté et en spectrogrammes : le **boum** grave à 4,43 s ; un **pop** et une petite note claire avec l'autocollant (7,53 s, le côté à −37 dB) ; un **souffle** quand il repart (9,45 s) ; une **grosse basse qui glisse vers le grave** de 63,9 à 65,7 s, le moment le plus fort du Reel (−3 dB au milieu), qui monte pendant que l'un goûte et tombe sur le visage de l'autre (« Waouh ! »). La musique se coupe avec le logo de la fin.
**Mesuré avec** : `scripts/fiche/measure.py` (39 coupes, chacune regardée sur une planche avant/après : 7 dans le même endroit), des planches à 30 i/s de l'ouverture, de l'autocollant et de la marche derrière le comptoir, la bande des sous-titres lue au pixel image par image (son encre blanche ou jaune : place, taille, couleur, chaque changement : 75 groupes), l'autocollant mesuré image par image (sa part de blanc dans sa zone, son angle sur ses bords, sa taille à chaque image de son pop), des gros plans de lettres à côté de polices Google, les couleurs prises sur les pixels, le son en milieu et en côté par bandes, en spectrogrammes zoomés et en grille de temps contre les coupes, et la lecture de Gemini (`house/breakdowns/en-boutique.json`).

## Déroulé

40 plans, 39 coupes franches : 32 vers un nouvel endroit et **7 dans le même endroit** (des coupes dans ce qui se dit). Celui qui vient porte un t-shirt mauve et un tablier ; l'artisan, un t-shirt vert et une casquette rouge.

| De – à (s) | Images | Ce qu'on voit | Plans (images) | Ce qui se dit (sous-titré) | Effets |
|---|---|---|---|---|---|
| 0 – 4,43 | 0 – 132 | **L'idée** : celui qui vient, face caméra dans la halle, un bac de fruits et légumes dans les mains ; des tomates dans un plat émaillé, un doigt en touche une ; une grappe de raisin qu'on manipule ; lui, un concombre à la main, puis le même plan **resserré d'un coup** (image 70) ; son visage qui lance le défi, coupé une fois | 15 · 17 · 18 · 20 · 16 · 20 · 27 | « L'idée c'est de faire une pizza. Et ce qui va être bien… si c'est pas bon, nos têtes, elles ne mentiront pas » | **L'idée en plans rapides** (1), **les sous-titres à deux voix** (3) |
| 4,43 – 6,50 | 133 – 194 | **L'artisan** derrière son comptoir, impassible | 62 | « Santo, il ment pas. Depuis tout à l'heure, j'essaie de lui sourire, il veut pas. » | **L'artisan qu'on fait sourire** (2), le boum (7) |
| 6,50 – 9,03 | 195 – 270 | Les deux derrière le comptoir : il sourit enfin ; à l'image 226, 31 images dans le plan, **le nom de la création surgit en autocollant**, et y reste jusqu'à l'image 285, par-dessus la coupe | 76 | « Ha si c'est bon, je l'ai eu. » ; sous l'autocollant, « On est des hommes, on va aller affronter le pizzaïolo » | **Le titre en autocollant** (2, le moment signature), le pop (7) |
| 9,03 – 10,37 | 271 – 310 | Celui qui vient passe derrière le comptoir, de dos, la caméra le suit | 40 | « Santo, … » | le souffle (7) |
| 10,37 – 20,67 | 311 – 619 | **Leur échange** au comptoir, plan moyen, coupé deux fois dans le même endroit, puis un long plan d'un autre point de vue | 29 · 36 · 35 · 209 | « Oui, dis-moi » (jaune), « Je voulais partir sur une base avec ces tomates », « on enlèvera les pépins » | **L'échange** (4) |
| 20,67 – 33,37 | 620 – 1000 | **Les gestes** : les tomates jaunes coupées dans un bac inox, écrasées à la main ; celui qui vient qui commente face caméra (coupé une fois) ; l'artisan qui l'invite côté pâte | 69 · 38 · 93 · 50 · 79 · 26 · 26 | « Ça c'est la technique à l'italienne » (jaune), « Tu sais, les Italiens… beaucoup, beaucoup d'amour », « Tu veux venir à côté de moi ? » (jaune) | **Les gestes et leurs répliques** (5) |
| 33,37 – 58,50 | 1001 – 1754 | La pâte étalée sur la semoule en gardant le bord, étirée, garnie, enfournée sur la pelle, au four, sortie ; le concombre et les olives posés ; l'artisan qui réagit ; un filet d'huile | 247 · 42 · 160 · 66 · 31 · 38 · 26 · 64 · 52 · 28 | « La corniche ? » « Exactement ! » (la réponse en jaune), « Wow ! », « Voilà, notre pizza est prête », « Elle est magnifique ! », « Jamais ! » (jaune) | (5) |
| 58,50 – 61,93 | 1755 – 1857 | **Le résultat montré face caméra**, tenu à deux | 103 | « Et voilà la pizza anti-gaspillage. » | **Le résultat, la dégustation** (6) |
| 61,93 – 68,27 | 1858 – 2047 | Ils goûtent, plan large (coupé une fois) ; l'un de près ; le visage de l'autre (la grosse basse tombe dessus) ; le verdict de chacun | 33 · 18 · 28 · 39 · 38 · 34 | « Waouh ! », « Je la trouve très très très… », « C'est une explosion de saveurs » (jaune) | (6), la basse (7) |
| 68,27 – 71,73 | 2048 – 2151 | Le dernier plan large des deux, coupé une fois dans le même endroit ; 3 images après cette coupe (image 2085), le logo du créateur surgit dessus jusqu'à la fin | 34 · 70 | « Servez-vous. » | **Un logo qui surgit à la fin** (8) |

Des coupes franches partout : ni fondu, ni zoom en transition, ni rien qui s'allume (les « clignotements » de `measure.py` sont la caméra à la main et les sous-titres). Le seul resserrement est une coupe dans le même plan (image 70 : le concombre devient énorme au premier plan), que Gemini appelle « zoom punch ». Tout est filmé à la main, qui suit ce qui se passe.

## Effets (ce qu'on veut savoir refaire)

### 1. L'idée en plans rapides
- **Mesuré** : 7 plans en 4,43 s (15 à 27 images, 18 au milieu) : celui qui vient, face caméra, avec ce qu'il apporte ; deux gros plans de ce qu'on va utiliser (tenu, touché, manipulé) ; lui qui en montre un ; son visage qui lance le défi. Ses mots commencent à l'image 0, ses sous-titres aussi : on sait dès la première seconde ce qui va se passer.
- **Sur quoi** : n'importe quelle création à deux : la cliente qui vient avec ses fleurs préférées, le voisin caviste avec sa bouteille, une créatrice avec son tissu, quelqu'un de l'équipe avec son idée de boisson.
- **Outil** : le déroulé du skill (ses six premières cases partagent 10 temps de sa musique, 4,49 s, chacune à sa longueur dans l'original).
- **Si rien ne s'y prête** : quelqu'un dans son lieu, face caméra, et des gros plans de ses produits.

### 2. L'artisan qu'on fait sourire, et le nom de la création en autocollant (le moment signature)
- **Mesuré** : l'artisan impassible derrière son comptoir (62 images), puis il sourit (76 images) ; **31 images dans ce plan**, une carte blanche surgit au milieu de l'image : **800 px de large en 1080 (de 13 à 87 % de la largeur)**, son milieu à **60 % de la hauteur** (de 50,6 à 69 % au milieu de sa largeur), **penchée de 5,5° vers le haut à droite** (mesuré sur ses bords), d'épais bords noirs aux coins arrondis (10 px en 1080) et un **bloc noir décalé sous son coin bas gauche** (son relief : il dépasse de 18 px à gauche et de 21 px dessous), deux fins traits blancs de brillance en travers de ce bloc, sous son coin bas droit. Dedans, le nom de la création sur **deux lignes**, en **capitales rondes très grasses** (Paytone One à l'œil, comparée lettre à lettre), d'un **jaune #FCC83B** avec une **ombre noire pleine en bas à gauche** (un relief de 8 px) ; dessous, qui la fait, en petites capitales noires. **Son pop, image par image** : à 0,55 et flou à sa première image, 1,04 encore un peu flou, 1,08, 1,03, puis 1, net ; il tient **60 images** (2 s), par-dessus la coupe vers le plan suivant ; il repart d'un coup : 0,75 et flou, 0,42 et flou, puis plus rien. **Jamais de fondu.** Un pop et sa petite note quand il arrive, un souffle quand il part.
- **Sur quoi** : le nom de ce qu'on fait ensemble (la création du jour, un événement, une collab) sur la personne à son comptoir ou à son poste, de face, son visage en haut de l'image.
- **Outil** : le code du modèle ; sa police dans une nouvelle paire « Sous-titres de vlog et autocollant » (`autocollant` : Paytone One pour l'autocollant, Figtree 800 pour les sous-titres), Paytone One apportée par le skill quelle que soit la charte. Le nom à la couleur de la personne quand elle est assez vive et claire pour se voir sur le blanc avec son ombre noire, sinon le jaune de l'original ; jamais une première ligne qui finit sur un petit mot (« PIZZA DU » / « MARCHÉ »).
- **Si rien ne s'y prête** : son comptoir ou son poste de travail, l'autocollant posé dessus.

### 3. Tout ce qui se dit, sous-titré à deux voix
- **Mesuré** : **75 groupes de 1 à 3 mots** (22 images au milieu, la moitié entre 16 et 34), qui se remplacent d'un coup, sans animation ; **en blanc pour celui qui vient, en jaune (#F7CE18) pour l'artisan** (27 groupes sur 75) ; une grotesque très grasse aux lettres compactes (Proxima Nova Extrabold à l'œil ; Figtree 800 sur Google Fonts, comparée sur « On est des hommes, »), une ombre douce, sans contour ni boîte, centrée ; une ligne de 63,7 à 66,6 % de la hauteur (le bas à 66,6 %), deux lignes à partir de 56 % ; **plus bas pendant l'autocollant**, sous lui (de 76,2 à 78,4 % de la hauteur). La ponctuation est gardée (« Santo, », « Exactement ! »).
- **Sur quoi** : ce qui se dit dans ses vidéos, ou, sur des vidéos sans paroles, des répliques qu'Edith écrit pour les deux.
- **Outil** : le code du modèle, et un nouvel outil du moteur : **`MontageSkill.spoken`** (`packages/agent/src/skills.ts` ; `docs/monteur.md`, « Ce qui est dit dans ses plans, écrit par un modèle ») : un modèle fait de plans où l'on parle peut écrire lui-même ce qui se dit dans ses vidéos, dans son style, là où c'est dit (le moteur garde leur son et lui donne leurs mots) ; ses propres répliques ne se montrent que là où personne ne parle.
- **Manquant** : **qui parle**. Le moteur donne les mots dits, pas la voix qui les dit : ce qu'elle dit vraiment s'écrit tout en blanc ; le jaune ne va qu'aux répliques de l'artisan qu'Edith écrit.
- **Si rien ne s'y prête** : ses répliques à elle, en blanc et dans sa couleur.

### 4. L'échange au comptoir
- **Mesuré** : 10,3 s de discussion au comptoir, coupée deux fois dans le même endroit pour aller d'une réplique à l'autre, puis un plan de 209 images d'un autre point de vue.
- **Sur quoi** : les deux au comptoir, plan moyen : celui qui vient explique, l'artisan écoute.
- **Outil** : le déroulé du skill (deux cases, 4 s en tout : l'original parle plus que 45 s ne le permettent).
- **Si rien ne s'y prête** : l'artisan à son poste qui prépare.

### 5. Les gestes, un à un, et leurs répliques
- **Mesuré** : 17 plans de gestes et de réactions (26 à 247 images), de près, souvent de dessus : couper, écraser, étaler, garnir, enfourner, sortir, la touche finale ; entre eux, le visage de celui qui commente ou de l'artisan qui réagit. Les explications de l'artisan en jaune.
- **Sur quoi** : tout savoir-faire : une recette, un bouquet monté, une coupe, une boisson, une pièce.
- **Outil** : le déroulé du skill (11 cases de gestes, chacun 1,6 s au plus).
- **Si rien ne s'y prête** : des gros plans des mains au travail.

### 6. Le résultat montré, puis la dégustation
- **Mesuré** : le résultat tenu à deux face caméra (103 images) ; ils goûtent (plan large), chacun son visage, chacun son verdict (28 à 39 images).
- **Sur quoi** : le plat, le bouquet, la coupe, la boisson présentés à deux ; puis on goûte, on sent, on essaie, on se regarde.
- **Outil** : les dernières cases du skill.
- **Si rien ne s'y prête** : le résultat de près, puis quelqu'un qui goûte ou essaie.

### 7. Les bruitages
- **Mesuré** : en tête de fiche (le boum, le pop, le souffle, la basse).
- **Outil** : les sons du skill (`SkillSound` : « deep cinematic boom hit » sur le premier plan de l'artisan, « cartoon pop with a bright comic sting » avec l'autocollant, « quick soft whoosh » quand il part, « deep 808 bass drop sliding down » sur le visage de l'artisan qui goûte, un « cartoon pop » avec le logo).

### 8. Un logo qui surgit sur le dernier plan
- **Mesuré** : le dernier plan large des deux (104 images, une coupe dans le même endroit) ; 37 images dedans, le logo du créateur surgit au milieu avec un rebond, tenu jusqu'à la fin ; la musique se coupe avec lui.
- **Outil** : le code du modèle (son logo à elle sur une petite carte blanche penchée, avec le même pop ; sans logo, le nom de son commerce dans les lettres de l'autocollant ; avec une carte de fin, son titre et sa ligne dans l'autocollant).

### 9. Étalonnage
Lumineux, chaud et saturé : le vert du t-shirt de l'artisan, sa casquette rouge, les poivrons et la pâte dorée ; un contraste soutenu, ni grain, ni coins assombris. Finition du modèle : « Vlog chaud » (un peu de chaleur, de contraste et de saturation).

## Ce qui appartient à l'original
**À l'original, jamais recopiés** : le badge du créateur en haut à droite de tout le Reel et son logo animé de la fin, leurs visages et leurs prénoms, la halle, leur pizza « anti-gaspi » et tous leurs mots. Le modèle écrit les siens : le nom de sa création à elle, ses prénoms à elle seulement quand elle les a donnés, ses répliques.

## Format
L'original est vertical 9:16, plein cadre. Réglage « format » :
- `auto` (par défaut, comme ses vidéos) : plein écran vertical comme l'original ; en 16:9 sur du noir quand la plupart de ses vidéos sont en largeur ;
- `vertical` : plein écran, ses vidéos en largeur recadrées sur leur sujet ;
- `horizontal` : ses vidéos entières dans une bande 16:9 sur du noir, les sous-titres dessous, l'autocollant à mi-hauteur.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, les deux qui se parlent, ses quatre parties (l'idée, la préparation, la cuisson, la dégustation), l'autocollant à 7,53 s avec son rebond, sa place (« 48 % de la hauteur, 80 % de la largeur ») et son jaune, des sous-titres blancs en grotesque grasse vers 63 % de la hauteur, quelques répliques en jaune, le badge et le logo de la fin, le resserrement de l'image 70, des coupes franches, un étalonnage chaud et saturé.

**Raté** :
- **17 plans** : il en voit 23 sur 40 (les coupes dans le même endroit de l'échange et de la dégustation, la moitié des gestes) ;
- les **sous-titres** : 19 textes là où il y a 75 groupes de 1 à 3 mots ; le jaune n'est pas un hasard mais la voix de l'artisan (27 groupes) ;
- l'**autocollant image par image** : son pop flou à 0,55, ses 1,08 et 1,03, sa sortie à 0,75 puis 0,42 ; sa pente de 5,5°, son bloc noir en relief ;
- les **bruitages** : le boum, le pop, le souffle et la grosse basse de 64 s, le moment le plus fort du Reel ;
- la **musique** qui s'arrête sous une partie de l'échange et des gestes ; et ses coupes, qu'il dit « calées sur les répliques », ce que la mesure confirme : aucune sur ses temps.

## Le modèle v1 (6 novembre)
`packages/agent/src/skills/en-boutique.ts`, version 1 (ses tests dans `skills/en-boutique.test.ts`), rendu en local sur douze vidéos libres de Mixkit (une pizza : une main qui choisit des tomates au marché, des tomates cerises, une femme face caméra, un pizzaïolo en tablier à son plan de travail, la pâte, la sauce, le fromage, le four, la pizza finie, des amis qui goûtent dehors, un homme qui goûte, des parts prises sur la table ; `scripts/skill-render.mts`, aucun appel facturé) : 13 cases, 25,7 s, au format vertical (ces vidéos sont en largeur : `auto` les met dans une bande 16:9, contrôlée aussi), le contrôle des scènes sans une remarque. Au premier rendu, à côté de l'original, le bloc noir de l'autocollant était trop mince et ses traits de brillance cachés sur la carte (mesurés à nouveau : 18 px à gauche, 21 dessous, deux traits fins en travers du bloc) ; au deuxième, des groupes de cinq mots (« une pizza avec les légumes ») : quatre mots qui finiraient sur des petits mots les laissent maintenant au groupe suivant (« une pizza » / « avec les légumes »).
- **Ses cases** : 12 à 29 (22 avec ses fichiers seuls), de 4 à 16 fichiers. À 29, les sections de l'original dans l'ordre (l'idée en 6 plans sur 10 temps, l'artisan impassible 62 images, son sourire 76, le passage derrière le comptoir 40, l'échange 84 · 36, 11 gestes de 1,3 à 1,6 s, le résultat 103, la dégustation 33 · 28 · 39 · 38 · 34 et le dernier plan 104) : 43,8 s à 133,75 BPM ; à 22 cases 36,1 s ; à 12 (sa version la plus courte : l'idée en 3 plans, l'artisan, son sourire, l'échange, deux gestes, le résultat, la dégustation en trois plans) 24,4 s ; de 23,3 à 45 s sur ses tempos (114 à 140 BPM), jamais plus de 45 s. Avec moins de fichiers partent d'abord le passage, des gestes du milieu, des plans de la dégustation, dans un ordre fixé (`GONE`). Chaque case dit ce qu'elle veut et ce qui la remplace ; les cases où l'on parle gardent le son de sa vidéo.
- **Ses mots** : 7 textes : l'idée (72 signes, obligatoire), le nom de la création (22, obligatoire), la réplique sur l'artisan (52), qui la fait (22), l'échange (56), les gestes (110, obligatoire), le verdict (100, obligatoire) ; des répliques séparées par « / », celles de l'artisan commencées par « — » (en jaune). Le code les coupe en groupes de 1 à 3 mots, jamais un groupe qui finit sur un petit mot, chaque groupe tenu le temps de se lire.
- **Ce qui se dit vraiment** : quand ses vidéos parlent (`spoken: "own"`), leurs mots s'écrivent à la place des répliques d'Edith là où ils sont dits, dans le même style, en blanc.
- **L'autocollant** : comme l'original (sa carte, sa pente, son relief, ses lettres, son pop et sa sortie), 31 images dans le plan du sourire, tenu **66 images** (2,2 s, 6 de plus que l'original : ses deux lignes se lisent quels que soient leurs mots) ; son milieu à 55,5 % de la hauteur (50 % en 16:9) et les sous-titres, pendant qu'il est là, en bas à 73,5 % : dans l'original, 60 % et 78,4 %, sous la zone sûre (rien d'écrit plus bas que 75 % de la hauteur).
- **La fin** : son logo sur une petite carte blanche penchée, 37 images dans le dernier plan, avec le même pop ; sans logo, le nom de son commerce dans les lettres de l'autocollant ; une carte de fin en option (sa dernière vidéo tenue 1,6 s de plus, son titre et sa ligne dans l'autocollant).
- **Son** : la musique composée à 133,75 BPM (« playful Italian comedy groove, plucked guitar, light percussion »), douce sous l'idée (−9 dB) et ouverte sur le boum de l'artisan, coupée à la fin ; les cinq bruitages.
- **Étalonnage** : « Vlog chaud ».
- **Format** : réglage `format` (`auto`, `vertical`, `horizontal`).
- **Léger** : rien de détouré ni de suivi ; 16 500 caractères de code.
- **Ce qui manque** : qui parle (ce qu'elle dit vraiment est écrit en blanc, quelle que soit la voix) ; les arrêts de la musique sous l'échange (le modèle la garde, douce) ; le resserrement de l'image 70 (une coupe dans le même plan, pour une v2).

## L'effet de la banque
`packages/agent/src/pieces/en-boutique.ts`, « Titre en autocollant », version 1 (ses tests dans `pieces/en-boutique.test.ts`) : sur 1 ou 2 plans de quelqu'un (2 à 4 s), le nom de ce qu'on fait (`titre`, 22 signes, obligatoire) surgit en autocollant comme dans le modèle, qui le fait dessous (`avec`, 22 signes, facultatif), 31 images après son début quand il y a la place, tenu 66 images au plus, avec son pop et son souffle ; puis le montage reprend. Posé sous son visage tel que le moteur le suit (au-dessus quand son visage est bas, plus petit quand aucun des deux ne laisse la place), à mi-hauteur sans visage, toujours au-dessus de la ligne des sous-titres d'une voix (64 % de la hauteur), sa pente, son relief et son rebond compris. Proposé sur un plan où l'on voit quelqu'un ; ni musique façonnée, rien de détouré. Rendu en local sur trois des vidéos du modèle (le pizzaïolo au milieu, 3 s) : son pop 23 images après son début, sur sa poitrine, le nom à la couleur de la charte de test ; le contrôle des scènes sans remarque, une fois ses mots gardés dans la page, cachés, avant son pop et après sa sortie (il refusait une page vide à sa première image). Sa place sous un visage suivi n'a pas été rendue ici (pas de suivi des visages sur cette machine) : ses tests la vérifient.

## Ce qu'il faut filmer
À la main comme un vlog, en parlant : ce que vous vous dites sera écrit à l'écran.
1. Celui ou celle qui vient (une cliente, un ami, un créateur, un commerçant voisin), face caméra, avec ce qu'il apporte ; deux ou trois gros plans de ce qu'on va utiliser, tenu à la main ; puis son visage qui lance l'idée ou le défi.
2. Toi (ou celui qui fait) derrière ton comptoir, face caméra, d'abord sérieux, puis qui sourit, ton visage en haut de l'image : le nom de la création s'y pose.
3. Vous deux au comptoir qui discutez, plan moyen.
4. Les gestes un à un, de près, souvent de dessus, et entre eux vos visages qui commentent ou réagissent.
5. Le résultat montré face caméra, tenu à deux ; puis vous goûtez ou essayez ensemble (un plan large, chacun de près, chacun son verdict) ; un dernier plan large des deux.
Pour une fleuriste : une cliente avec ses fleurs préférées, le bouquet monté ensemble, puis elle qui le sent ; pour un café : un client qui invente sa boisson, le barista qui la prépare, puis ils la goûtent ; pour un coiffeur : la cliente avec sa photo d'inspiration, la coupe, puis le miroir.
