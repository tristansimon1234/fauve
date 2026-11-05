# « Mots mêlés » (`mots-meles`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; il n'a pas de son, la colonne « Images » donne donc les numéros d'image à 30 i/s.

**L'original** : `house/originals/mots-meles.mp4`, 18,67 s (560 images), 720 × 406, 30 i/s, **horizontal 16:9** montré tel quel, **sans piste son**. Un seul plan fixe : une personne aux cheveux courts, assise sur un tabouret dans sa cuisine, mange un yaourt à la cuillère. Par-dessus, une grille de mots mêlés où six boucles tracées à la main trouvent la phrase « SATURDAY AFTERNOON CALL FOR GREEK YOGURT ». Tout l'original sert au modèle (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : aucune dans le fichier. Pas clair s'il y en avait une sur Instagram (une musique posée dans l'appli ne vient pas toujours avec la vidéo). La musique du modèle est le choix d'Edith.
**Son rythme, sans son** : celui de la main. Six boucles presque bout à bout, de 0,13 à 13,30 s. Chacune dure selon la longueur de son mot (1,4 à 2,6 s). D'un départ au suivant : 2,80 · 2,67 · 1,97 · 1,57 · 2,17 s. Ni pas réguliers, ni accélération : deux longs mots, deux courts, deux longs. Puis la phrase tenue 5,37 s. Aucune coupe, rien ne tombe sur un temps. Une musique calme sans batterie marquée, de 70 à 90 BPM, va dessous sans rien à caler. Avec un temps net, chaque boucle peut partir sur le premier temps après la fermeture de la précédente. À 80 BPM, le Reel fait 25 temps : 17,7 pour les boucles, 7,2 pour la tenue.
**Mesuré avec** : `scripts/fiche/measure.py` (aucune coupe, aucun clignotement, aucun flash, pas de son), des planches à 30 i/s de chaque boucle, la date de chaque pixel de trait (la première image d'où il reste blanc jusqu'à la fin), la corrélation de phase pour la caméra, des mesures au pixel (grille, lettres, traits, couleurs), la recherche de tous les mots de la grille, et la lecture de Gemini (`house/breakdowns/mots-meles.json`).

## Déroulé

| De – à (s) | Images | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,13 | 0 – 3 | La grille de 16 × 10 lettres sur tout le plan ; dessous, la personne mange, caméra posée | **La grille** (1), **le plan posé** (7), **la vidéo dans les gris** (6) et **les mots leurres** (5), tous là jusqu'à la fin. L'image 0 est un autre moment du même plan (sans doute la couverture) : une image, invisible |
| 0,13 – 2,70 | 4 – 81 | Une boucle entoure SATURDAY (rangée 1) | **Mot entouré à la main** (2), 78 images |
| 2,93 – 5,37 | 88 – 161 | Un seul contour entoure AFTER (rangée 4) et NOON (rangée 5) | **Un mot sur deux rangées** (3), 74 images |
| 5,60 – 7,40 | 168 – 222 | CALL (rangée 7, à gauche) | (2), 55 images |
| 7,57 – 8,93 | 227 – 268 | FOR (rangée 7, au milieu) | (2), 42 images |
| 9,13 – 11,17 | 274 – 335 | GREEK, en diagonale qui monte de la rangée 9 à la rangée 5 | **Un mot en diagonale** (4), 62 images |
| 11,30 – 13,27 | 339 – 398 | YOGURT (rangée 8, à droite) | (2), 60 images |
| 13,30 – 18,67 | 399 – 559 | Les six boucles tenues ; la personne mange toujours | **La phrase tenue à la fin** (8), 5,37 s |

Entre deux boucles, 3 à 6 images sans rien de nouveau : le stylo se lève (images 82 – 87, 162 – 167, 223 – 226, 269 – 273, 336 – 338).

Rien ne s'allume ni ne clignote. La luminosité monte doucement de 79 à 82 sur 255 en 18,7 s (la lumière du jour). Les lettres sont les mêmes de la première à la dernière image. Ni coupe, ni zoom, ni poussée, ni ralenti : seule la main bouge, et un peu la personne.

## Effets (ce qu'on veut savoir refaire)

### 1. La grille de lettres sur tout le cadre
- **Mesuré** :
  - 16 colonnes × 10 rangées, fixes à l'écran de la première à la dernière image (elles ne suivent rien).
  - Les centres des lettres vont de 4,4 à 95,6 % de la largeur (un pas de 43,7 px, 6,1 %) et de 6,9 à 93,3 % de la hauteur (un pas de 39 px, 9,6 %). Du bord à la première lettre : 0,73 pas. Les cases sont un peu plus larges que hautes (1,12).
  - Des capitales d'une sans grotesque régulière (type Helvetica ou Inter), centrées dans leur case, au trait d'un pixel. Capitale de 8 px : 2,0 % de la hauteur, un cinquième du pas. Une grille très aérée, une trame plus qu'un texte.
  - Blanc opaque (le sommet d'un A monte à 247 sur 255 : 95 % au moins), sans ombre visible. Si fines, elles paraissent grises de loin.
  - Les lettres de remplissage sont tirées dans tout l'alphabet, presque à parts égales : sur 99, Z 5 fois, Q 4, J 4, X 3, autant que E ou T.
- **Sur quoi** : rien de particulier dans ses vidéos : la grille se pose sur n'importe quel plan calme. Elle se lit le mieux sur une image sombre et douce (effet 6), avec de grandes zones calmes (un mur, un comptoir, le sol).
- **Outil** : existant, `WordSearch` (`Type.tsx`), mais loin de l'original. Sa police fait 0,46 de la case (l'original : 0,28). Ses lettres sont blanches à 62 % d'opacité (grises), sa marge fait une demi-case, ses cases sont carrées, ses mots posés au hasard dans quatre sens (ses leurres, `decoys`, depuis le 5 novembre). La grille codée par la v1 du skill est plus juste (ses mots dans l'ordre de la phrase, de haut en bas, ses leurres) : la garder, aux proportions mesurées ici.
- **Si rien ne s'y prête** : toujours faisable.

### 2. Les mots de sa phrase entourés un à un, à la main
- **Mesuré** :
  - Six boucles, une par mot (AFTERNOON en une seule, effet 3), dans l'ordre de la phrase. Chacune est tracée d'un seul geste.
  - L'allure d'une main, pas d'un temps. La durée suit la longueur du mot : 42 images pour FOR, 55 pour CALL, 60 pour YOGURT, 62 pour GREEK, 74 pour AFTERNOON, 78 pour SATURDAY. Le stylo va un peu plus vite sur un long mot : 6,5 px par image en moyenne sur FOR et CALL, 9 à 11 sur SATURDAY, GREEK et YOGURT (à 720 px de large). Soit une lettre toutes les 4 à 6 images à l'aller, et une quinzaine d'images pour les deux bouts.
  - Presque à vitesse constante : aux quarts de son temps, chaque boucle a fait 21 %, 47 % puis 70 % de son tracé (un adoucissement « ease-out » en ferait 58, 88 et 98 %). Moitié moins vite dans les virages des bouts, plus vite au retour (jusqu'à 15 à 25 px par image sur les longs mots), puis le stylo ralentit pour fermer.
  - Chaque boucle part de son côté haut, juste au-dessus de la première lettre. Elle tourne dans le sens inverse des aiguilles d'une montre : elle descend autour de la première lettre, longe le bas, contourne la dernière, revient par le haut et se ferme sur son départ (à 5 px près). La suivante part 3 à 6 images plus tard (0,1 à 0,2 s).
  - Sa forme : une gélule faite main, blanche #FFFFFF, aux bouts ronds, sans ombre. Trait de 1,5 px : 0,4 % de la hauteur, 3,8 % du pas d'une rangée, une fois et demie le trait des lettres. Entre ses deux grands côtés : 0,87 à 0,91 du pas d'une rangée. Ses bouts : 0,36 à 0,45 du pas d'une colonne au-delà du centre de la première et de la dernière lettre. Ses côtés ondulent de 2 à 3 px et penchent parfois un peu.
  - Une fois tracée, elle ne bouge plus : ni tremblé, ni « boil » (immobile au pixel ; seule la compression change, aux images 250 et 500).
  - Les lettres entourées ne changent pas : même blanc, même graisse avant et après (comparées à la rangée de BLACKBERRY, jamais entourée).
  - La phrase dit ce que montre la vidéo : « un samedi après-midi appelle un yaourt grec », sur quelqu'un qui mange un yaourt.
- **Sur quoi** : sa phrase à elle, qui dit ce que montre sa vidéo, comme on le dirait : « Samedi matin café croissant » sur une table en terrasse, « Une coupe et un brushing » sur des mains qui coiffent, « Mardi soir yoga doux » sur un cours. Quatre à six mots de 3 à 9 lettres. Ses accents : `WordSearch` les enlève (É devient E, comme dans un mots mêlés imprimé), la v1 les garde ; à choisir.
- **Outil** : existant, `Scribble kind="capsule"` (un trait fait main, `wobble`, `angle`, immobile sans `boil`). Trois écarts, que ses options du 5 novembre comblent (`docs/animations.md`, « Tracés à l'allure d'une main ») :
  1. Sa durée : `frames` (14 par défaut, une demi-seconde ; 18 dans la v1), avec un adoucissement qui trace l'essentiel tout de suite (`Easing.out(cubic)`). L'original est deux à cinq fois plus lent, et à vitesse constante. Désormais `speed` : une vitesse en px par image (le pas d'une rangée divisé par 4 à 5 : une lettre toutes les 4 à 5 images), sans adoucissement, plus lent dans les bouts, plus vite au retour (aux quarts de son temps, 20, 46 et 71 % du tracé).
  2. Son départ : il part du bas, à gauche, et tourne dans le sens des aiguilles d'une montre. L'original part du haut, au-dessus de la première lettre, dans l'autre sens. Désormais `start="top-left"` et `direction="ccw"`.
  3. L'enchaînement : `WordSearch` espace les mots d'un nombre fixe d'images (`every`, 60). L'original les enchaîne, chacun dès que le précédent est fermé. Désormais `Scribble.frames(props)` (sa durée, pour lancer la boucle suivante 3 à 6 images après), et `WordSearch pace` (images par lettre) qui enchaîne les siennes.
- **Si rien ne s'y prête** : toujours faisable. Une phrase courte (2 ou 3 mots) donne moins de boucles et un Reel plus court, jamais des boucles plus lentes que la main.

### 3. Un mot sur deux rangées, d'un seul contour
- **Mesuré** : AFTERNOON est coupé en AFTER (rangée 4, colonnes 1 à 5) et NOON (rangée 5, colonnes 1 à 4), calés à gauche. Un seul trait fermé fait le tour des deux, en escalier, en 74 images. Parti au-dessus du A comme les autres, il descend par la gauche, longe le bas de NOON, contourne son dernier N (18 px au-delà), remonte en marche entre les deux rangées, contourne le R d'AFTER (19 px au-delà) et revient par le haut.
- **Sur quoi** : un mot de sa phrase trop long pour une rangée (« après-midi », « croissants »), ou deux mots qui vont ensemble.
- **Outil** : `Scribble kind="cells" rows={[after, noon]}` (existant depuis le 5 novembre : un seul trait autour de plusieurs rangées, le contour arrondi de leurs cases, en escalier quand elles n'ont pas la même longueur). Une gélule autour des deux rangées (la v1) fait un gros ovale.
- **Si rien ne s'y prête** : le mot sur une seule rangée. Trop long pour elle (plus de 9 lettres en vertical) : deux boucles enchaînées.

### 4. Un mot en diagonale, qui se lit en montant
- **Mesuré** : GREEK va du G de la rangée 9 (colonne 7) au K de la rangée 5 (colonne 11), vers le haut à droite (41,7°, une colonne et une rangée par lettre). Sa boucle part du G, en bas, comme les autres partent de leur première lettre. Elle le contourne, monte par le côté droit, tourne autour du K et redescend. 62 images. Même largeur que les autres (0,91 du pas), décalée de 7 px vers le bas à droite de l'axe : une main.
- **Sur quoi** : un mot court de sa phrase (4 à 6 lettres), au milieu de la grille.
- **Outil** : existant, `Scribble kind="capsule" angle={…}` (et le sens « u » de `WordSearch`). La v1 pose sa diagonale vers le bas à droite.
- **Si rien ne s'y prête** : le mot sur une rangée.

### 5. Des mots leurres de son monde, cachés sans boucle
- **Mesuré** : quatre mots de ce qui va avec un yaourt grec, jamais entourés. BLACKBERRY (rangée 2, colonnes 3 à 12). CINNAMON (rangée 10, colonnes 8 à 15). HONEY, en diagonale qui monte, du H de la rangée 6 au Y de la rangée 2, qu'il partage avec BLACKBERRY. DILL, en colonne de haut en bas (colonne 15, rangées 3 à 6). Un second FOR (rangée 10, colonnes 4 à 6) piège l'œil. Le hasard donne aussi de petits mots (YOU, ALOE, AGUA, TEA à l'envers).
- **Sur quoi** : 2 à 4 mots de son univers : ses produits, ses gestes, son lieu (« brioche », « cannelle » ; « frange », « lissage »).
- **Outil** : la grille codée par la v1 (`autres`, le long d'une rangée ou d'une colonne). `WordSearch decoys={[…]}` (existant depuis le 5 novembre : des mots placés mais jamais entourés, en rangée, en colonne ou en diagonale, croisant les siens sur une même lettre).
- **Si rien ne s'y prête** : rien que des lettres au hasard.

### 6. Sa vidéo dans les gris, la grille seule en blanc
- **Mesuré** : l'image reste sombre et douce. Sans la grille, 99 % de l'image restent sous 155 sur 255 (61 % de blanc), et rien ne dépasse 187 (73 %) ; ses 2 % les plus clairs font en moyenne #9D9C9D. Noirs à peine levés (#141011, 16 à 18). Couleurs passées (saturation médiane 0,14) : un mur gris chaud (#696461), du bois brun (#382E28). Seuls les lettres et les traits sont blancs (220 à 255) : c'est ce qui les fait lire. Pas de vignettage (les coins sont plus clairs que le centre), pas de grain qui bouge.
- **Sur quoi** : n'importe laquelle de ses vidéos, assombrie juste assez pour que ses parties claires restent sous 60 % de blanc environ.
- **Outil** : un voile noir sur sa vidéo (code du modèle ; 20 % dans la v1) et la finition (`finish` : exposition, contraste, saturation ; existants). **Manquant**, petit : la clarté de sa vidéo, pour doser le voile (une salle blanche en plein jour en demande bien plus qu'une cuisine sombre).
- **Si rien ne s'y prête** : une vidéo déjà sombre reste telle quelle.

### 7. Un seul plan, le téléphone posé
- **Mesuré** : 18,67 s sans coupe. La caméra ne bouge pas (moins de 0,02 px de dérive en 18,7 s) : ni zoom, ni poussée, vitesse réelle. Presque rien ne bouge : en une demi-seconde, 0,5 % de l'image change (3,6 % au plus). Sur tout le Reel, moins d'un dixième du cadre bouge : la personne qui mange et regarde autour d'elle.
- **Sur quoi** : sa vidéo la plus calme, le téléphone posé : quelqu'un attablé, un café qu'on boit, quelqu'un qui lit, des mains au travail, une posture tenue, son lieu au repos avec quelqu'un dedans.
- **Outil** : `Footage` tel que filmé (existant). Une vidéo tenue à la main serait à verrouiller (**manquant**, déjà noté dans `docs/fiches/plans-fixes.md`). Ni poussée lente ni zoom (Tristan les trouve cheap).
- **Si rien ne s'y prête** : son passage le plus calme. Une photo tenue fixe marche aussi (la grille ne demande pas de mouvement), sans poussée.

### 8. La phrase tenue à la fin
- **Mesuré** : de 13,30 s (image 399) à la fin, 161 images : 5,37 s, 29 % du Reel. Les six boucles, la grille, la vidéo qui continue. Ni carte de fin, ni fondu, ni logo. Le temps de relire la phrase et de chercher les autres mots.
- **Outil** : le déroulé du skill (existant).
- **Si rien ne s'y prête** : toujours faisable. Une carte de fin (une offre) viendrait après la tenue, pas à sa place : à voir avec Tristan.

## Format
L'original est horizontal 16:9 (720 × 406), montré tel quel : la grille couvre toute l'image. Réglage « format », comme dans `frappe` (`setting("format", "auto")`) :
- `auto` : horizontal quand la plupart de ses vidéos le sont, sinon vertical.
- `horizontal` : sa vidéo en 16:9 sur du noir (1080 × 608 au milieu du cadre), la grille sur la vidéo seule, 16 × 10 comme l'original. Les mots à entourer évitent les boutons d'Instagram (les deux dernières colonnes, sur les cinq rangées du bas). Mais les lettres y feraient 12 px de capitale (une police d'environ 17 px), loin des 48 px que le contrôle demande à un texte à lire. À décider avec Tristan : les mots entourés comptent comme décor (on les lit par leurs boucles, comme dans l'original), ou la grille grossit et perd l'air de l'original.
- `vertical` : plein écran, la grille sur tout le cadre, sa densité tournée d'un quart : 9 colonnes × 16 rangées (un pas de 115 à 120 px, une marge de 0,73 pas), comme la v1. Les mots à entourer dans la zone sûre (de y 80 à 75 % de la hauteur, à gauche des boutons sous le milieu), les lettres de remplissage partout (décor). Lettres à 48 px : capitale d'environ 34 px, 0,3 du pas, un peu plus serrées que l'original (0,2). Les boucles aux proportions mesurées : 0,9 du pas de haut (environ 105 px), les bouts 0,4 pas au-delà des lettres (environ 48 px), un trait de 3,8 % du pas (4 à 5 px), une lettre toutes les 4 à 6 images.
- Ses vidéos de l'autre sens sont recadrées sur leur sujet : la grille ne dépend pas de l'image.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** :
- le plan fixe unique en 16:9, sans transition ;
- la grille de capitales blanches sur tout le cadre, très espacées ;
- SATURDAY, AFTERNOON (« entoure AFTER puis descend pour englober NOON »), YOGURT, et deux leurres (CINNAMON, BLACKBERRY) ;
- les boucles blanches tracées à la main l'une après l'autre, une en diagonale ;
- l'étalonnage doux.

**Raté** :
- le **son** : le fichier n'en a pas. Il décrit une musique « lo-fi / ambient acoustique », une guitare feutrée, 75 BPM : inventée ;
- la **grille** : « ~11 × 16 » au lieu de 16 × 10 ; capitale de 2,2 % au lieu de 2,0 ; une « ombre douce » qu'on ne voit pas ;
- les **mots** : « CALI » et « CALIFOR » pour CALL FOR ; FOR « rangée 8 » (c'est la 7) ; « AGUA » entouré à 9,2 s (AGUA n'a pas de boucle : c'est le bas de celle de GREEK, dont il partage le G) ; la boucle de GREEK coupée en deux (« AGUA » puis « une ligne diagonale »), jamais lue comme GREEK ; HONEY et DILL ; la phrase elle-même ;
- les **temps** : SATURDAY dès 0,00 s (0,13), AFTERNOON de 3,20 à 5,10 s (2,93 à 5,37) ; les autres justes à 0,2 s près ;
- la **tenue** de 5,4 s à la fin, le sens et l'allure des boucles. Il parle de « stop-motion » : les boucles ne bougent plus une fois tracées.

## Ce que le modèle v1 ratait
Le skill (`skills/mots-meles.ts`, version 1, un brouillon hors de la bibliothèque) et sa lecture (`house-models.ts`) :
- **Juste** : la grille sur tout le cadre en décor, jusqu'aux bords ; les mots dans l'ordre de la phrase, de haut en bas ; une diagonale ; un mot sur deux rangées ; des leurres (`autres`) ; un seul plan calme et fixe ; les mots à entourer dans la zone sûre ; des gélules faites main, immobiles ; un trait de 4 px pour des cases de 120 px. Son « pour » (un jeu, une devinette, un message caché, un lieu calme) et son « pas pour » (un Reel rythmé).
- **Format** : tout en vertical.
- **Allure** : chaque boucle en 18 images (0,6 s) avec un adoucissement qui trace presque tout d'un coup, au lieu de 42 à 78 images à vitesse de main. La première à 0,75 s au lieu de 0,13. Entre deux mots, 1,5 à 4 temps pour remplir la durée, au lieu de les enchaîner (3 à 6 images). Sa lecture dit « un premier mot en 0,6 s ; un nouveau mot toutes les 3 s environ », à partir de 2 s.
- **Lettres** : grises à 60 % avec une ombre, puis blanches et plus grasses (300 → 500) une fois entourées. Dans l'original, elles sont blanches et ne changent jamais.
- **Boucles** : une ombre portée que l'original n'a pas ; 0,72 d'une case de haut au lieu de 0,9 ; tracées dans le sens des aiguilles d'une montre depuis le bas ; un mot sur deux rangées dans un gros ovale au lieu d'un contour en escalier ; la diagonale vers le bas au lieu du haut.
- **Remplissage** : des lettres tirées « à la française » (les fréquentes plus souvent). L'original tire tout l'alphabet à parts égales, Z, Q, J et X compris.
- **Durée et fin** : 15 s au lieu de 18,7. La phrase tenue 5 temps (3,75 s) au lieu de 5,37 s, et sa lecture dit « tenue deux secondes ». Une carte de fin (un titre sur la grille assombrie) que l'original n'a pas.
- **Finition** : un grain fin que l'original n'a pas ; un voile fixe de 20 %, trop léger pour une vidéo claire.

## Ce qu'il faut filmer
Une seule vidéo calme, le téléphone posé (un pied, une étagère, une table), 20 s ou plus sans le toucher, à l'horizontale de préférence. Quelqu'un qui fait une chose simple dans son lieu : manger, boire un café, lire, des mains au travail, une posture tenue. De la place autour. Une lumière douce plutôt qu'un plein soleil. Et sa phrase : ce que montre la vidéo, en 4 à 6 mots de 3 à 9 lettres, plus 2 à 4 mots de son monde à cacher.
