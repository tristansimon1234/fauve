# « Collage qui s'emboîte » (`collage`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « pas » compte les changements d'image, un toutes les 6 images.

**L'original** : n° 22 de la vague du 5 novembre (https://www.instagram.com/reel/CgHuL8ko2iy/, le Reel d'un autre compte : jamais recopié, jamais montré), 8,37 s (251 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son. **Un collage de photos fixes en image par image** : rien ne bouge dans une image (0,02 niveau de différence d'une image à la suivante à l'intérieur d'un pas), tout change d'un coup toutes les **6 images (0,2 s, 5 changements par seconde)**. C'est **une boucle de 125 images (4,17 s) jouée deux fois**, identique (ses 21 pas, le dernier de 5 images la première fois, de 6 la seconde, où la vidéo s'arrête). Aucun texte posé sur l'image.
**Sa musique** : un beat hip-hop / trap à **80 BPM** (un temps toutes les 0,749 s ; une mesure de 3,0 s), qui **ne suit pas les coupes** : ses doubles croches durent 0,187 s, les pas de l'image 0,2 s, si bien que les coupes glissent sur la musique d'une double croche toutes les 16 coupes. Une **intro de 0,68 s sans batterie** (un échantillon mélodique seul, des harmoniques de 200 à 1 300 Hz, peut-être une voix), puis la **808 entre d'un coup à 0,683 s** sur le premier temps de la mesure ; la 808 joue en rythme pointé (doubles croches 0, 3, 6 et 10 de chaque mesure), les claps sur les temps 2 et 4, les charlestons en doubles croches, qui se taisent un instant à la fin de chaque mesure (2,6 – 2,9 s, 5,5 – 5,9 s). Elle ne boucle pas avec l'image (le son de la deuxième boucle n'a rien à voir avec celui de la première : corrélation 0,02) et s'arrête avec la vidéo, au milieu d'une mesure. Aucun bruitage.
**Mesuré avec** : `scripts/fiche/measure.py` (37 coupes, toutes sur des multiples de 6 images, sauf la reprise de la boucle à l'image 125 et les 6 images d'après ; quatre changements manqués parce que le fond ne change pas : un détouré posé sur la même image, l'œil qui devient fenêtre), des planches à 30 i/s des 251 images, des gros plans de chaque pas, les couleurs prises sur les pixels, la boucle comparée image par image (k contre k + 125), le son par bandes de fréquences (sous 120 Hz, 120 – 400, 400 – 2 000, 2 000 – 6 000, au-dessus de 6 000 Hz : attaques, autocorrélation de chaque bande) et son spectrogramme, la lecture de Gemini (`/tmp/claude-0/models/collage.breakdown.json`, la ligne 8988 de `net._http_response`).

## Déroulé (une boucle)

Les lettres nomment ses dix photos (A à J) et les trois personnes qui défilent (P1 à P3), dont on ne voit jamais le fond. Chaque pas dure 6 images.

| Images | Pas | Ce qu'on voit | Effet |
|---|---|---|---|
| 0 – 5 | 0 | A : des immeubles aux balcons verts vus d'en bas, qui encadrent un ciel bleu qui vire à l'orange | — |
| 6 – 11 | 1 | A, et l'homme de B détouré posé dessus, exactement à sa place dans sa photo, coupé par le bas du cadre | Il arrive avant son image (effet 2) |
| 12 – 17 | 2 | B : l'homme devant la terrasse d'un café, son store rouge en haut | — |
| 18 – 23 | 3 | B en haut, et les maisons de C sans leur ciel par-dessus : le store de B se voit là où C avait son ciel | Ses toits arrivent d'abord (effet 3) |
| 24 – 29 | 4 | C : des maisons, un ciel pâle, un réverbère | — |
| 30 – 47 | 5 – 7 | Sur C, un skateur en plein saut, un garçon qui filme, une femme en veste orange, détourés, un par pas | Le défilé (effet 4) |
| 48 – 53 | 8 | C, et le premier plan de D par-dessus : son mur en pente et la silhouette qui marche, en noir et blanc | Son premier plan arrive d'abord (effet 3) |
| 54 – 59 | 9 | D en noir et blanc : un grand bâtiment de brique vu d'en bas, la silhouette à son pied | Noir et blanc (effet 7) |
| 60 – 65 | 10 | E : l'œil d'un cheval en très gros plan | Coupe franche |
| 66 – 71 | 11 | E, et le visage de F dans son iris, à sa place et à sa taille dans sa photo | Une image vue dans une autre (effet 5) |
| 72 – 77 | 12 | F : le même homme de près, devant une forêt sombre | — |
| 78 – 83 | 13 | F, sa silhouette (tête et épaules) remplie par D, le bâtiment en noir et blanc | Effet 5 (un rappel de D, pas l'image suivante) |
| 84 – 89 | 14 | G : un homme torse nu au chapeau de paille sur un ciel bleu | Coupe franche |
| 90 – 95 | 15 | H : un chemin sous une arche d'arbres, des gens de dos au soleil | Coupe franche |
| 96 – 101 | 16 | L'arche de H gardée, et I en noir et blanc dans son ouverture : des mouettes sur l'eau | Effet 5 |
| 102 – 107 | 17 | I en noir et blanc : des mouettes, un horizon de ville | Effet 7 |
| 108 – 113 | 18 | I, et la femme de J détourée par-dessus (ses lunettes transparentes laissent voir les mouettes) | Effet 2 |
| 114 – 119 | 19 | J : la femme aux lunettes rondes sous un auvent de bois | — |
| 120 – 124 | 20 | A revient, et la femme de J détourée reste dessus ; puis A seule à l'image 125 : la boucle repart | La boucle (effet 6) |

Puis les images 125 à 250 rejouent les images 0 à 125 telles quelles. Ni zoom, ni glissé, ni fondu, ni flash : une image chasse l'autre, chaque morceau posé à sa place.

## Effets (ce qu'on veut savoir refaire)

### 1. Un collage image par image, 5 changements par seconde
- **Mesuré** : un changement toutes les 6 images, du début à la fin (21 pas par boucle, le dernier de 5 images), aucune image qui bouge : ce sont des photos. Les coupes ne tombent pas sur la musique (elles ont leur horloge, la musique la sienne).
- **Sur quoi** : ses photos et ses courtes vidéos, de 13 à 26 images (un passage de 0,2 à 1,2 s par case).
- **Outil** : les plans d'un skill sur ses pas, sa composition sur tout le Reel (existant). Ses photos restent figées, ses vidéos jouent (règle d'Edith : « si photos envoyées, figées ; si vidéos, ça joue »).
- **Le modèle** : ses pas sont des doubles croches à 75 BPM (0,2 s, les 6 images de l'original), et sa musique est composée à ce tempo, si bien que ses coupes tombent sur la musique d'Edith, ce que l'original ne fait pas (à 80 BPM, ses pas auraient 5,6 images).

### 2. Elle arrive détourée avant son image
- **Mesuré** : la personne de l'image suivante, détourée net (ni liseré, ni ombre), posée sur l'image d'avant pendant un pas, **exactement à la place et à la taille qu'elle aura dans sa propre image** (l'homme de B, images 6 à 11 ; la femme de J, images 108 à 113), puis son image entière. Les lunettes de J sont trouées dans le détourage : on y voit les mouettes de I.
- **Sur quoi** : quelqu'un de son équipe ou un client, en entier ou jusqu'à la taille, net sur son fond ; sinon ce qu'elle vend, bien détaché (le détourage garde « ce qui est devant »).
- **Outil** : `Subject` dans la boîte de la `Footage` (existant) : la même place, sans rien calculer ; avant son passage, la première image de son passage, tenue.
- **Si rien ne s'y prête** (aucun détourage) : une coupe franche, son image entière un pas plus tôt.

### 3. Ses toits, ou son premier plan, arrivent d'abord
- **Mesuré** : à l'image 18, les maisons de C, coupées le long de leurs toits (y ≈ 27 % de la hauteur), sont posées sur B, dont le store rouge se voit à la place du ciel de C ; à l'image 48, le mur en pente de D (son bord du haut en biais, de 82 % de la hauteur à gauche à 73 % à droite) et la silhouette qui marche sont posés sur C, sans le bâtiment de D. Ce qui arrive est le premier plan de l'image suivante, ce qui est le plus près.
- **Sur quoi** : ses plans de dehors avec du ciel (sa rue, sa façade, sa terrasse, ses toits).
- **Outil** : `Skyline` (son plan sans son ciel, existant) et `SkylineAt` pour savoir s'il a un ciel. `Near` (son plan gardé jusqu'à une distance, par sa profondeur) ferait le mur de D sans le bâtiment et marcherait dedans aussi, mais seulement sur une vidéo, et rien ne dit au code si sa profondeur a été lue : `Skyline`, que `SkylineAt` annonce, est le choix sûr. Quatre plans sans ciel au plus par Reel (`GROUND_MAX`).
- **Si rien ne s'y prête** (pas de ciel) : sa personne détourée arrive (effet 2), sinon une coupe franche.

### 4. Trois personnes défilent sur le même décor
- **Mesuré** : sur C, un skateur en plein saut (x 15 – 80 %, y 6 – 53 %), un garçon qui filme (x 27 – 72 %, y 13 – 88 %), une femme en veste orange (x 35 – 97 %, y 17 – 97 %), détourés, un par pas, chacun à la place qu'il a dans sa propre photo, dont on ne voit jamais le fond. Ils flottent : personne ne se soucie du sol.
- **Sur quoi** : son équipe, ses clients, ou ses produits, chacun dans sa photo ou sa vidéo, posés sur une image de son lieu.
- **Outil** : trois plans posés à côté du décor (`SkillShot.beside`, existant), dont le code ne dessine que le détourage.
- **Si rien ne s'y prête** (un détourage manquant) : son image entière pendant son pas.

### 5. Une image vue dans une autre
- **Mesuré** : trois fenêtres, chacune montrant l'autre image **à sa place et à sa taille** (jamais réduite) : l'iris de l'œil de E (x 26 – 83 %, y 30 – 56 %) laisse voir le visage de F (ses yeux tombent dans l'iris : l'original a choisi ses photos pour ça) ; la silhouette de l'homme de F (sa tête et ses épaules) laisse voir D, une image déjà vue (un rappel) ; l'ouverture claire de l'arche d'arbres de H (x 5 – 98 %, y 34 – 80 %) laisse voir I, son horizon à la même hauteur que dans I.
- **Sur quoi** : une chose de son image qui fait fenêtre (une vitrine, une fenêtre, un miroir, une porte, une assiette ou une tasse vue de dessus, des lunettes) ; la silhouette de quelqu'un ; le ciel ou l'ouverture claire d'un plan de dehors.
- **Outil** : `SubjectOutline` d'un objet nommé par le remplisseur (« @fenetre ») ou de sa personne, en `clipPath` sur la `Footage` de l'autre image, et `Skyline` de l'image d'avant posée sur l'image suivante pour son ciel (existants). Le modèle montre toujours l'image suivante, jamais un rappel : chaque image arrive d'abord en morceau, puis entière.
- **Si rien ne s'y prête** : la fenêtre devient sa silhouette, puis sa personne détourée qui arrive (effet 2), puis une coupe franche.

### 6. La boucle
- **Mesuré** : au dernier pas, la femme de J détourée reste posée sur la première image (A), qui revient ; puis A seule : la boucle repart sans couture (images 120 à 125). La boucle est jouée deux fois, à l'identique.
- **Outil** : `Subject` de la dernière image sur la `Footage` de la première, rejouée depuis son début (`at`, existant).
- **Le modèle** : une seule chaîne, de 13 à 26 de ses images différentes (Instagram la rejoue en boucle), plutôt que la même deux fois : 26 cases font les 8,4 s de l'original, et ses vidéos donnent plusieurs passages. La dernière personne détourée reste toujours sur sa première image.

### 7. Deux images en noir et blanc dense, les autres franches
- **Mesuré** : D et I sont en noir et blanc (saturation 0), contrastés (des noirs à 0,06, des blancs à 1,0 pour D) ; les autres franches et saturées (le ciel de A de #26658B à #F1BB69, le store de B #E9607D, la veste #FDA621), chacune avec sa propre lumière. Ni grain (0,23 niveau de bruit sur le ciel de A), ni coins sombres.
- **Outil** : un filtre `grayscale(1) contrast(1.18)` sur ses deux images de la place de D et de I, et quand elles arrivent en morceau (code du modèle) ; réglage `couleur` (« tout en couleur » pour s'en passer).

### 8. À l'original, jamais recopié
L'enseigne « CAFE CENTRAL » sur le store rouge (le seul texte, qui est dans la photo), ses personnes, sa ville (le Bosphore, ses minarets, ses maisons de bois), ses photos et sa musique. Le modèle prend ses images à elle et ses mots.

## Ses mots
L'original n'en a aucun. Un titre facultatif, dans sa matière : son nom ou deux à quatre mots en capitales blanches étroites sur une bande de sa couleur en travers de l'image, comme les lettres blanches du store de B (la seule écriture de l'original), dans le haut de ses dix premières images (2 s), ses morceaux qui arrivent passant devant, comme les toits de C recouvrent l'enseigne de B. La bande vient du premier rendu local : en lettres blanches seules, le titre disparaissait sur un studio blanc et sur le ciel blanc d'une image en noir et blanc. Sa couleur quand elle est assez foncée pour des lettres blanches, sinon sa couleur sombre, sinon de l'encre. Laissé vide quand c'est elle qui choisit le modèle, écrit quand c'est Edith (le modèle donne la forme, jamais le silence). En option, une carte de fin sur sa première image revenue, ses mots sur la même bande.

## Format
L'original est vertical plein cadre. Réglage `format` : `auto` (vertical plein cadre quand la plupart de ses images sont verticales ou carrées, sinon toutes dans une bande 16:9 sur du noir, ses morceaux à l'échelle de la bande), `vertical` (plein cadre, ses images horizontales recadrées sur leur sujet), `horizontal` (la bande).

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, les photos fixes, un changement toutes les 0,2 s (6 images), la boucle d'environ 4,1 s jouée deux fois à l'identique, presque tout le contenu de chaque pas (l'homme détouré sur le ciel, les maisons sur l'enseigne, le défilé des trois détourés, le visage dans l'œil, la silhouette remplie par le bâtiment, les mouettes dans l'arche, la femme détourée qui referme la boucle), les couleurs alternées et le noir et blanc, l'absence de bruitage.

**Raté** : le **tempo** (150 au lieu de 80 BPM) et l'idée que les coupes tombent sur chaque croche de la musique (elles suivent leur propre horloge de 0,2 s et glissent sur ses doubles croches de 0,187 s) ; l'**intro sans batterie** et la 808 qui entre à 0,68 s ; la boucle de **125 images** (4,17 s, son dernier pas de 5 images ; il dit 4,13 s) ; il prend le mur de D posé sur C (images 48 à 53) pour un plan à part ; il ne dit pas que chaque morceau est **à sa place et à sa taille** dans sa propre image (le visage n'est pas réduit dans l'iris), ni que la silhouette de F montre une image **déjà vue** (D). `measure.py`, lui, lisait 106,75 BPM (la pulsation pointée de la 808, 4/3 du vrai tempo).

## Le modèle v1 (6 novembre)
`skills/collage.ts`, version 1. Le cycle de l'original en 13 cases (A, B, C, P1 – P3, D à J), repris dans l'ordre pour 13 à 26 cases (39 pour une durée demandée), chaque case une image d'elle :
- **Le pas** : une double croche à 75 BPM (0,2 s), chaque image entière un pas, son morceau sur l'image d'avant un pas, les coupes de l'original à une image près (sa boucle de 126 images au lieu de 125) ; 13 cases font 4,2 s, 26 cases 8,4 s.
- **Ses mouvements**, dans l'ordre de l'original : sa personne qui arrive (A → B), ses toits sans leur ciel (B → C, puis C → D), le défilé de trois détourés sur C, une coupe (D → E), l'image suivante vue dans une chose qui fait fenêtre (E → F, l'objet « @fenetre » nommé par le remplisseur), dans la silhouette de quelqu'un (F → G), une coupe (G → H), dans le ciel de H (H → I), une personne qui arrive (I → J), et la dernière personne détourée qui reste sur l'image suivante (J → A, la boucle). Chaque mouvement a son repli, lu sur ses plans (un ciel par `SkylineAt`, un détourage par `SubjectBox`, un contour par `SubjectOutline`) : jamais un pas vide.
- **Ses images en noir et blanc** : celles de la place de D et de I (réglage `couleur`).
- **La musique** : composée à 75 BPM, un temps sans sa basse (l'intro sans batterie de l'original), sa basse qui entre sur le temps fort à 0,8 s, coupée net à la fin (la boucle). Aucun bruitage (l'original n'en a pas).
- **Ce qui est détouré** : seulement ce que ses mouvements dessinent (`collageCutouts`) : l'image dont la personne arrive, son défilé, l'image dont la silhouette (ou la chose) fait fenêtre, la personne qui reste, et dans sa première boucle les images qu'apportent ses toits et son ciel (sa personne arrive à leur place quand aucun ciel n'est lu, à l'intérieur). Treize cases détourent dix images, le plus de photos que le moteur détoure pour un Reel (`SUBJECT_PHOTO_MAX`) ; au-delà, des photos de la fin ne sont pas détourées, leur mouvement devient une coupe franche et la personne qui referme la boucle est la dernière détourée (les vidéos, elles, ont 30 s de détourage). Le ciel n'est lu que sur les cases 2, 6, 10 et 15 (`Skyline` et `SkylineAt` écrits avec leur numéro : quatre plans sans ciel par Reel au plus).
- **Rendu en local** (6 novembre) : 20 cases d'une friperie imaginée, « Lou Vintage » (des photos tirées de vidéos libres de Mixkit : des clientes et des clients posant, un portant de pulls, une rue de Paris, et quatre vidéos avec du ciel, une ville au bord d'un lac, un capitole, une tour), ses personnes détourées en local (le segmenteur de personnes de MediaPipe, plus grossier que celui du moteur), ses ciels lus par `shot_read.py` et ses plans sans ciel posés sur le rendu à la main (`skill-render.mts` n'en pose pas) ; 6,4 s. Tous les mouvements se voient (sa personne qui arrive, ses toits sans leur ciel, le défilé, le capitole en noir et blanc posé sur la ville, deux silhouettes qui servent de fenêtre, une rue en noir et blanc dans le ciel d'un lac, la boucle) ; la fenêtre dans une chose (« @fenetre ») n'est vérifiée qu'en test (le détecteur d'objets ne tourne pas ici), et faute de détourage des trois dernières photos (comme en production), la boucle se referme sur la dernière personne détourée.

## L'effet de la banque (`pieces/collage.ts`, « Images qui s'emboîtent », version 1)
Sur 2 à 8 de ses plans coupés par le monteur (1,2 à 6 s) : au dernier pas de chaque plan (une double croche du temps du Reel, une croche quand la double croche fait moins de 5 images, la moitié du plan au plus), le plan suivant arrive en morceau dessus, puis entier à la coupe : sa personne détourée, puis ses toits sans leur ciel (sinon sa personne), puis vu dans la silhouette de la personne d'avant (sinon sa personne), et ainsi de suite ; sans détourage, une coupe franche. Son titre facultatif sur la même bande, ses deux premières secondes. Tous ses plans sauf le premier sont détourés (déclarés), le ciel est lu sur ses plans. Laissés au modèle : le défilé, le noir et blanc, la fenêtre dans une chose, la boucle et la musique. Rendu en local sur six plans (3,6 s à 100 BPM) : une personne qui arrive, une autre, des pulls dans sa silhouette, un portrait qui arrive, une ville sans son ciel posée sur le portrait.

## Ce qu'il faut filmer
De 13 à 26 photos ou courtes vidéos verticales (2 à 5 s chacune), chacune avec un sujet net :
1. une belle image large de son lieu ou de sa rue pour ouvrir (et refermer) la boucle ;
2. son équipe et ses clients, debout, en entier ou jusqu'à la taille, sur un fond pas trop chargé (ils seront détourés) ;
3. sa façade, sa rue ou sa terrasse **avec du ciel en haut**, deux ou trois fois ;
4. une vitrine, une fenêtre, un miroir ou une porte, ou une assiette ou une tasse vue de dessus ;
5. un portrait de près ;
6. des détails (ses mains, ses produits, une matière) et un plan large et clair.

Des photos marchent aussi bien que des vidéos : l'original n'est fait que de photos.
