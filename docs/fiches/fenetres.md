# « Fenêtres et étiquettes » (`fenetres`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original, les numéros sont ses images à 30 i/s ; « temps » compte les temps de sa musique depuis son premier temps (0,53 s : le Reel commence 0,8 temps avant).

**L'original** : `house/originals/fenetres.mp4`, 13,80 s, 720 × 406, 30 i/s (monté à 25 i/s : dans cette copie, une image sur six est un doublon), **horizontal 16:9** montré tel quel (des bandes noires dans un fil vertical), avec son. Un road trip en montagne (le col de Shinkun La, en Inde) : 22 plans en 13,8 s, souvent deux à la fois à l'écran.
**Sa musique** : un beat hip-hop lo-fi avec une voix parlée par-dessus (Gemini : un dialogue de film en sample ; ses harmoniques se voient sur tout le spectre), **92,9 BPM** (un temps toutes les 0,646 s, le premier à 0,53 s ; sûr : sur cette grille, presque tous les coups de grosse caisse et de caisse claire tombent à moins de 20 ms d'un temps ou d'un demi-temps, et elle colle 2,7 fois mieux que 86 ou 90,4 ; Gemini disait 86, l'outil de mesure 90,4 : faux). Intro sans batterie : la voix, une note tenue et trois coups de grosse caisse (0,52 · 1,17 · 1,81 s, les temps 0, 1 et 2), puis presque rien de 2,0 à 3,1 s. La batterie entre au temps 4 (3,12 s) ; caisse claire sur les temps impairs (3,76 · 5,05 · 6,35 · 7,64 · 10,22 · 11,52 · 12,81 s), les plus fortes à 5,05 et 7,64 s. Aucun clic ni bruitage net sur les fenêtres.
**Mesuré avec** : `scripts/fiche/measure.py` (coupes, clignotements, tempo), des planches à 30 i/s de chaque passage, des cartes des cases qui changent d'une image à l'autre, la comparaison du contenu de chaque fenêtre avec le plan suivant (à sa place ou non), les couleurs lues sur les pixels, et la lecture de Gemini (`house/breakdowns/fenetres.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 2,20 | −0,8 – 2,6 | Cinq plans qui coulent l'un dans l'autre : un randonneur de dos devant un pic rocheux, un homme de profil à la vitre d'une voiture, une borne kilométrique, une bande d'amis autour d'un 4x4 (un sur le toit), une rivière entre des pins | **Deux étiquettes fixes** tout le Reel. **Le plan suivant entre par les cases d'une grille 3 × 3** (images 4-22, 24-36, 40-52, 54-66). **Silhouettes** crème (22-23) et blanches (40-41) |
| 2,20 – 3,37 | 2,6 – 4,4 | La rivière seule, puis des **petites fenêtres** sur le plan suivant, dans le creux de la musique, jusqu'à l'entrée de la batterie (74-100) | Fenêtres qui sautent et se multiplient ; **silhouette blanche** du randonneur suivant (97-100) |
| 3,37 – 4,00 | 4,4 – 5,4 | Le randonneur de dos devant un glacier sombre | **Fenêtre au centre, derrière lui**, sur la cascade, en négatif puis en couleur (110-119) |
| 4,00 – 4,53 | 5,4 – 6,2 | Une cascade qui tombe d'une falaise | **Silhouette blanche** de l'homme du plan suivant (132-135, sur le temps 6) |
| 4,53 – 4,87 | 6,2 – 6,7 | Trois hommes devant une station-service, l'un remet ses lunettes | — |
| 4,87 – 5,20 | 6,7 – 7,2 | Une montagne sous les nuages, par la vitre d'une voiture | **Éclat blanc** : ses 3 premières images délavées (146-148) |
| 5,20 – 6,00 | 7,2 – 8,5 | La vallée depuis une voiture qui roule, deux coups de caméra rapides (160, 166) | — (le mouvement est filmé) |
| 6,00 – 6,47 | 8,5 – 9,2 | Un ruisseau glaciaire vu d'un drone, coupé deux fois par la vallée d'avant (182-185, 4 images ; 193, 1 image) | **Silhouettes** crème : la rivière (184-185), le danseur suivant (192-193, sur le temps 9) |
| 6,47 – 6,77 | 9,2 – 9,65 | Un homme qui danse devant le 4x4, sur la route | — |
| 6,77 – 8,83 | 9,65 – 12,85 | Un ciel de nuit (la Voie lactée en accéléré), puis un flanc de montagne au soleil | **Écran partagé jour / nuit** (216-234), **damier** (235-255), **négatif** (256, 258), **silhouette** du rétroviseur suivant (263-264) |
| 8,83 – 9,53 | 12,85 – 13,9 | Le conducteur à lunettes, dans le rétroviseur | — |
| 9,53 – 10,83 | 13,9 – 15,95 | Un village de montagne (temps 14), puis trois amis de dos devant un torrent (temps 15) | **Carrés qui balaient l'image** case par case, à travers la coupe (286-324) ; un éclat léger sur la coupe (304-305) |
| 10,83 – 11,57 | 15,95 – 17,1 | Un camion peint sur une route (temps 16), puis un homme debout devant une montagne dans la brume | **Le sujet avant son décor** (329-340) |
| 11,57 – 12,17 | 17,1 – 18 | Le pic rocheux du début, sans le randonneur | **Éclat chaud** (347-348) |
| 12,17 – 12,80 | 18 – 19 | Un ciel de nuit, une étoile filante | **Éclat crème** (365-366) ; un éclat bleu (368-369, pas clair) |
| 12,80 – 13,80 | 19 – 20,5 | Le portail d'entrée de la vallée ; le premier plan revient par fenêtres (384-407), puis seul (408-413) | **La boucle** : sa dernière image est presque sa première |

## Effets (ce qu'on veut savoir refaire)

### 1. Deux étiquettes techniques fixes
- **Mesuré** : « 14,800 FEET » (l'altitude) à gauche, de 10,3 à 20,7 % de la largeur, et « 32.9585° N, 77.2486° E » (les coordonnées) à droite, de 69,9 à 89,9 % : à la même distance des bords, à mi-hauteur (de 47,8 à 52,5 % de la hauteur). Capitales blanches (≈ #F1F2F4) très étroites (11 caractères sur 74 px pour 18 px de haut), traits fins (2 px), sans ombre ni contour : sur les nuages, elles se lisent à peine (150-155). Hauteur des capitales : 4,4 % de l'image. Là dès la première image, jamais animées, au même pixel jusqu'à la dernière, au-dessus de tout (sur les silhouettes blanches, elles disparaissent : 132-135).
- **Sur quoi** : deux repères vrais de son commerce, au ton d'un relevé : les coordonnées de son adresse, son adresse (« 12 RUE DES MARTYRS »), son quartier, l'heure ou l'année d'ouverture, une mesure de son métier (« 250 °C » pour un four à pizza).
- **Outil** : du texte dans le code du modèle (`FitText`), comme le brouillon. Pour les coordonnées, outil manquant : le géocodage de son adresse (ses coordonnées à quatre décimales, rien d'inventé).
- **Si rien ne s'y prête** : son quartier ou sa ville, et ce qu'elle fait en un ou deux mots (le brouillon).

### 2. Le plan suivant entre case par case
- **Mesuré** : l'image est coupée en 3 × 3 cases (des tiers : 240 × 136 px). Le plan suivant joue déjà dessous ; il prend une case, ou deux, d'un coup, toutes les 2 images, bord net, sans trait ni ombre ; ligne par ligne, presque toujours en serpentin (chaque ligne dans l'autre sens que la précédente) ; une fois depuis le haut, une fois depuis le bas (de la case en haut à droite : 4-22 ; en bas à gauche : 24-36 ; en haut à droite : 40-52 ; en bas à gauche : 54-66). 12 images par plan (18 pour le premier), et le suivant commence dès que le précédent a fini : cinq plans en 2,2 s, aucun seul plus de 4 images. Chaque case montre son morceau du plan, à sa place. Une case tombe sur chaque coup de grosse caisse de l'intro (images 16, 36, 54).
- **Sur quoi** : n'importe lesquels de ses plans : sa rue, sa devanture, sa salle, ses produits ; les plans larges se lisent mieux (une case n'en montre qu'un morceau).
- **Outil** : `Tiles cols={3} rows={3}` (existant), `reveal="cut"`, une vague `top` ou `bottom`. Il lui manque un ordre ligne par ligne en serpentin, une case à la fois (le brouillon le code lui-même).
- **Si rien ne s'y prête** : toujours possible.

### 3. Des fenêtres qui sautent avant la coupe
- **Mesuré** : de 74 à 100 (0,9 s, dans le creux de la musique ; la batterie entre pendant les dernières), des rectangles aux proportions de l'image s'ouvrent d'un coup sur le plan suivant, à sa place, et sautent ailleurs toutes les 1 à 3 images. Ils grandissent et se multiplient : un seul, de 21 % de l'image (74-83), puis deux, de 21 à 28 % (84-89), puis deux ou trois d'un tiers (90-100). Puis la silhouette (effet 5) et la coupe (101). Même chose à la fin, sur le premier plan (384-407 : deux ou trois de 28 % à la fois, 0,8 s).
- **Variante, les carrés qui balaient** : des carrés (un tiers de la hauteur, 19 % de la largeur, sur une grille de 5 × 3) s'allument un par un, de gauche à droite et de haut en bas, chacun 1 à 5 images, et continuent à travers la coupe du village aux trois amis (286-324, 1,3 s). Ils montrent d'autres plans du voyage, pas tous retrouvés ailleurs (l'un est le camion, deux plans plus loin, à sa place).
- **Sur quoi** : le plan qui vient (les fenêtres) ; ses autres plans (les carrés) : des détails, ses produits, ses mains au travail.
- **Outil** : `Window fit="cut" reveal="cut"` (existant), une par place, fermée par `close`, sur `Footage shot={suivant} at={…}` (le plan suivant joué en avance, existant) ; les carrés : `Window fit="cover"` sur ses autres plans.
- **Si rien ne s'y prête** : toujours possible.

### 4. Une fenêtre au milieu, derrière la personne
- **Mesuré** : à 110 (3,67 s, 3 images avant la caisse claire du temps 5), la case du centre s'ouvre d'un coup sur le plan suivant (la cascade), en négatif (les couleurs inversées : vérifié sur les pixels), 5 images ; à 115, elle prend aussi la case du dessus, en couleur ; négatif encore (116-117), couleur (118-119), puis la cascade plein cadre (120). Le randonneur reste devant : sa capuche passe sur le bord bas de la fenêtre.
- **Sur quoi** : un plan où elle, un client ou un objet se tient au milieu (sa devanture, un plat sur le comptoir) ; la fenêtre s'ouvre derrière, sur le plan suivant.
- **Outil** : `Window` (existant) sur la case du centre, `Footage` du plan suivant avec `filter: invert(1)` sur les images en négatif (du CSS), puis `Subject shot={actuel}` (existant) posé après, pour qu'elle reste devant.
- **Si rien ne s'y prête** : la fenêtre s'ouvre sans personne devant.

### 5. La silhouette blanche de ce qui arrive
- **Mesuré** : 2 à 4 images avant le plan suivant, son sujet découpé, plein d'une seule couleur, à sa place dans ce plan, posé sur le plan en cours : blanc #FCF9FD ou crème #FBF2DB, sans bord ni ombre. Huit fois : deux hommes (22-23, crème, d'un plan qu'on ne retrouve pas), la bande du 4x4 (40-41), le randonneur (97-100, 4 images), l'homme qui remet ses lunettes (132-135, 4 images, sur le temps 6, la caisse claire), la rivière (184-185, crème), le danseur (192-193, crème, sur le temps 9), le rétroviseur (263-264), l'homme devant la brume (329-330, crème).
- **Sur quoi** : le sujet de son plan suivant : elle, un client, un plat, une bouteille, un vélo, sa devanture.
- **Outil** : `Subject shot={suivant} at={…} fill="#FCF9FD"` (existant : sa silhouette d'une couleur, jouée en avance) ; un objet par `object="…"` (4 par Reel au plus). Outil manquant : ne détourer que les 2 à 4 images dessinées ; aujourd'hui, dès qu'un code dessine `Subject`, tout le passage de chaque plan est détouré (`subjectPassages`).
- **Si rien ne s'y prête** : pas de silhouette sur cette coupe (un ciel, un paysage sans sujet) ; l'original en fait 8 pour une vingtaine de coupes.

### 6. Le sujet arrive avant son décor
- **Mesuré** : l'homme du plan suivant d'abord en crème (329-330), puis en couleur, découpé, debout sur le plan du camion qui continue de rouler derrière lui (331-336) ; son propre décor (une montagne dans la brume) le remplace par grands rectangles (331-340), le bas du camion part en dernier (337-339).
- **Sur quoi** : elle (ou un client) debout, de face ou de dos : elle apparaît d'abord dans le plan d'avant, puis son lieu à elle se pose autour.
- **Outil** : `Footage` du plan d'avant, `Window fit="cut"` sur son plan, puis `Subject shot={son plan}` posé en dernier (existants).
- **Si rien ne s'y prête** : une transition par cases (effet 2).

### 7. Écran partagé et damier
- **Mesuré** : sur un ciel de nuit, un plan de jour entre par un bord vertical qui glisse du bord gauche jusqu'au milieu en 6 images, en ralentissant (216-221 : 21, 30, 37, 45, 50 %), tenu 13 images (jour à gauche, nuit à droite). Puis, sur une grille 4 × 4, le bloc du centre échange ses deux moitiés (la nuit passe à gauche à 235, le jour à droite à 240 : un damier), tenu 16 images ; puis ce bloc clignote, une image chacun : jour en négatif, nuit, négatif, nuit (256-259), jour (260). Chaque moitié montre son plan à sa place, sans recadrage.
- **Sur quoi** : deux plans du même endroit à deux moments : sa vitrine le jour et la nuit, la salle vide puis pleine, le matin et le soir, avant et après.
- **Outil** : `Window fit="cut" reveal="wipe-right"` (existant) pour le bord qui glisse, des `Window` sur les quarts pour le damier ; `Split` (existant) recadre chaque moitié, l'original non.
- **Si rien ne s'y prête** : deux plans différents côte à côte.

### 8. Négatif et éclats de lumière
- **Mesuré** : le négatif dans les fenêtres (110-114 et 116-117 sur la cascade, 256 et 258 sur le jour). Les éclats sur une coupe : les 1 à 3 premières images du plan qui arrive, délavées vers le blanc (146-148 : très éclaircies, presque sans couleur), vers le crème (365, puis 366 grisée ; 384), ou dans une lumière chaude (347-348 : orange-rouge, puis jaune et rose, comme une pellicule qui prend la lumière) ; un éclat léger sur la coupe du village (304-305). Ceux de la fin tombent sur les temps 17, 18 et 19. Un éclat bleu au ras des montagnes (368-369) : pas clair si c'est un effet ou la lumière du timelapse.
- **Sur quoi** : n'importe laquelle de ses coupes.
- **Outil** : le négatif, `filter: invert(1)` sur `Footage` (du CSS) ; les éclats, `Tint` (existant) en mode `screen`, blanc, crème ou un dégradé chaud (son `style`), sur 1 à 3 images ; `Flash` (existant) ne pose qu'une couleur pleine, pas l'image délavée. La consigne des compositions dit « jamais un flash blanc sur une coupe » : ici c'est le modèle, son code le pose lui-même.
- **Si rien ne s'y prête** : toujours possible.

### 9. Le rythme, les images éclair et la boucle
- **Mesuré** : avant la batterie, les plans coulent par cases, un toutes les 14 à 16 images (environ trois quarts de temps), sur les coups de grosse caisse. Ensuite, les moments forts tombent sur les temps (le glacier juste avant 4,5, la silhouette sur 6, le ruisseau sur 8,5, la silhouette du danseur sur 9, le damier sur 11,5), et à la fin un plan par temps : le village 14, les amis 15, le camion 16, le pic 17, la nuit 18, le portail 19. Le ruisseau est coupé deux fois par le plan d'avant (182-185, 4 images ; 193, 1 image). Le Reel finit sur son premier plan, revenu par fenêtres : ses 6 dernières images, fixes, sont presque sa première (écart moyen de 3 sur 255) : il tourne en boucle. Aucun zoom de transition ni poussée lente posée : les deux mouvements rapides (160, 166) sont ceux de la caméra.
- **Sur quoi** : tous ses plans ; le premier doit être assez beau pour être vu deux fois.
- **Outil** : le déroulé du skill (ses temps) et `Footage at` (le premier plan rejoué, existant).
- **Si rien ne s'y prête** : son plus beau plan large ouvre et ferme.

### 10. Étalonnage
Teal and orange : ciels cyan (#5F99BC, #4689AA), nuit bleu profond (#153046), terres et roches ocre et brunes (#967E45, #57413B), blancs crème (#FAF9E9), ombres un peu vertes (#414B46) ; contrasté, saturé sans excès. Ni grain ni vignettage visibles (la copie est très compressée, 570 kb/s).

## Format
L'original est une vidéo horizontale 16:9 montrée telle quelle. Tout y est en proportion de l'image : les tiers de la grille, les fenêtres de 21, 28 et 33 %, les étiquettes à 10 % des bords. Réglage « format » : `auto` (horizontal quand la plupart de ses vidéos le sont, sinon vertical), `horizontal` (16:9 sur du noir, comme l'original ; ses vidéos verticales y perdent beaucoup), `vertical` (plein écran : les cases et les fenêtres deviennent 9:16, les étiquettes juste au-dessus du milieu, hors des boutons des applis à droite).

## Ce que Gemini a vu, et ce qu'il a raté
Vu : le format, les deux étiquettes (leurs mots, leur place, des capitales blanches étroites, fixes), les transitions par blocs, quatre silhouettes blanches sur huit, la fenêtre au centre sur la cascade, le damier jour / nuit, l'éclat chaud sur le pic, la boucle, l'étalonnage, la voix. Raté ou faux : le **tempo** (86 au lieu de 92,9) et la synchro (« chaque caisse claire déclenche une tuile » : les cases changent toutes les 2 images, bien plus vite que le temps) ; une ombre des étiquettes qu'elles n'ont pas ; le **randonneur devant la fenêtre** et le **négatif** (110-117, 256-258) ; les silhouettes **crème** ; le **sujet avant son décor** (329-340, pris pour une silhouette) ; les images éclair dans le ruisseau (182-185, 193) ; les éclats blanc (146-148) et crème (365) ; les **fenêtres qui se multiplient** avant la batterie (74-100) ; les **carrés qui balaient** (286-324, pris pour une mosaïque) ; la montagne par la vitre (4,87-5,20 s), fondue dans ses voisins, et des limites de plans décalées jusqu'à 0,7 s.

## Ce que le modèle v1 ratait
Son entrée (`house-models.ts`) : vertical (« pov »), une musique « indie électronique entraînante » (c'est un beat hip-hop lo-fi avec une voix), une finition « Voyage » désaturée avec du grain (l'original est saturé, sans grain visible), une fenêtre à 1,6 s puis des coupes toutes les 0,7 s (l'original change de plan dès 0,13 s, toutes les 0,5 s par cases). Son brouillon (`skills/fenetres.ts`) avait juste la grille 3 × 3, les étiquettes, le tempo (93), la fenêtre du milieu en avance et la boucle. Il lui manquait les silhouettes, la personne devant la fenêtre, le négatif, les éclats, les fenêtres qui sautent, les carrés qui balaient, l'écran partagé et le damier, le sujet avant son décor, les images éclair ; il ombrait les étiquettes (l'original non) ; ses cases changeaient autour de la coupe (de 0,3 temps avant à 0,4 après) quand l'original enchaîne sans pause ; tout était vertical. Sa composition de référence ouvrait ses fenêtres en volet sur 10 images ; l'original les ouvre d'un coup.

## Ce qu'il faut filmer
Un beau plan large pour ouvrir (il revient à la fin) ; 10 à 20 plans courts de son lieu, de sa rue, de son quartier, plutôt larges (l'original en a 22 en 13,8 s) ; 3 ou 4 plans avec un sujet net au milieu, presque immobile (elle, un client, un plat, une bouteille) ; deux plans du même endroit à deux moments (de jour et de nuit, vide et plein) ; un plan en mouvement (en marchant, à vélo) ; en largeur si elle peut. Et deux repères vrais pour les étiquettes : son adresse, l'heure ou l'année d'ouverture.
