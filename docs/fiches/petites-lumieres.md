# « Petites lumières » (`petites-lumieres`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps (0,09 s).

**L'original** : le Reel envoyé par Tristan (https://www.instagram.com/reel/DcMR2E3z519/), à garder sous `house/originals/petites-lumieres.mp4` : 9,83 s (295 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son. **Trois images fixes** (des photos : rien ne bouge dans l'image que ce qui s'allume), deux coupes franches, à 4,13 s (image 124) et 6,67 s (image 200). Aucun texte, aucun logo, aucune marque, aucun filigrane. Le modèle prend tout l'original.

**Le second exemple** (le même modèle, envoyé ensuite par Tristan : https://www.instagram.com/reel/DcatVwsqmlp/) : 9,73 s, 720 × 406, **horizontal 16:9**, quatre images fixes (une applique murale, une rue avec ses parasols, l'enseigne d'un café, un feu rouge sur un mur). **Le même son** : corrélé à 0,98 avec celui de l'original, commencé 0,10 s plus loin dans le morceau (3 images). Ce qui ne change pas d'un exemple à l'autre est le modèle : la même chanson, des images immobiles de la ville le soir, et sur chacune une lumière qui s'allume, clignote ou flashe sur les coups de la musique. Ce qui change, ce sont les images, l'endroit des coupes (l'original coupe sur la reprise de la musique et sur le tic de son troisième arrêt ; le second sur les caisses claires des temps 4, 8 et 11) et la manière d'allumer (effet 7). **Même modèle, pas le même gabarit figé** : chacun a posé ses coupes et ses lumières sur la même chanson.

**Sa musique** : un beat trap lo-fi sombre, **83 BPM** (un temps toutes les 0,723 s, le premier à 0,09 s : le coup grave de l'ouverture ; `measure.py` : 83,0, sûr : les coups des temps 2, 4, 6, 7, 8, 9, 11 et 12 tombent sur la grille à 20 – 50 ms près, l'attaque mesurée en tête du coup), une basse 808, des charlestons, une caisse claire sèche. Surtout, **elle s'arrête trois fois** : un coup grave à 0,06 s coupé net à 0,41 s ; un arrêt de 0,41 à 1,18 s ; la reprise sur le contretemps du temps 1 (1,5) ; un arrêt de 3,28 à 4,06 s ; la reprise sur 5,5 ; un arrêt de 6,21 à 6,96 s ; la reprise sur 9,5 ; la fin coupée à 9,03 s (temps 12,37), puis 0,8 s de quasi-silence jusqu'à la fin. Chaque arrêt dure un temps (les temps 0,44 – 1,5 ; 4,41 – 5,5 ; 8,47 – 9,5) : la musique tombe de −14 à −30 dBFS (il reste un souffle, une queue de réverbération), et repart d'un coup. **Un tic** seul dans le troisième arrêt, à 6,62 s (temps 9,03) : court (0,1 s), aigu (vers 3 kHz), −20 dBFS ; l'original coupe sur lui (1,5 image après).
**Mesuré avec** : `scripts/fiche/measure.py` (deux coupes, aucun mouvement rapide, quatre « clignotements » : le lampadaire), des planches à 30 i/s de chaque plan, la lumière du lampadaire image par image, le disque rouge suivi comme une tache (sa boîte, son rayon dans huit directions), les fenêtres rouges ramenées sur la première image de leur plan à travers son lent mouvement (points ORB, une similitude par image), les couleurs prises sur les pixels, le son par bandes toutes les 10 ms, le niveau de chaque passage (dBFS), le son du second exemple corrélé à celui-ci, et la lecture de Gemini (`house/breakdowns/petites-lumieres.json`).

## Déroulé

Temps : la grille de sa musique, 83 BPM, depuis son premier temps (0,09 s).

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,13 | −0,1 – 0,06 | Un lampadaire en contre-plongée devant un ciel de couchant (nuages roses, bleu au milieu, orange en bas), sa lampe éteinte | Image fixe |
| 0,13 – 0,27 | 0,06 – 0,24 | **La lampe s'allume quatre images**, sur le coup grave de l'ouverture | Lampe (1) |
| 0,27 – 1,10 | 0,24 – 1,4 | Éteinte ; la musique s'arrête à 0,41 s | Arrêt (5) |
| 1,10 – 1,70 | 1,4 – 2,23 | **Trois clignotements**, quatre images allumée, deux éteinte (1,10 · 1,30 · 1,50 s), quand la musique revient (1,18 s) | Lampe (1) |
| 1,70 – 3,10 | 2,23 – 4,16 | **Allumée, tenue** 1,4 s | Lampe (1) |
| 3,10 – 4,13 | 4,16 – 5,59 | Éteinte (juste après la caisse claire du temps 4) ; la musique s'arrête à 3,28 s, repart à 4,06 s | Arrêt (5) |
| **4,13** | **5,59** | **Coupe** (2 images après la reprise) : une cour d'immeubles vue d'en bas, le ciel en croix entre eux, **un disque rouge au milieu du ciel**, derrière les immeubles | Soleil (3) |
| 4,20 – 6,00 | 5,69 – 8,17 | **Ses fenêtres s'allument en rouge par vagues** : 4,20 · 4,33 · 4,53 · 5,13 · 5,27 · 6,00 s, du bas vers le haut ; le disque rétrécit ; l'image avance et tourne lentement | Fenêtres (2), mouvement (6) |
| 6,21 – 6,96 | 8,47 – 9,5 | La musique s'arrête ; le tic à 6,62 s | Arrêt (5) |
| **6,67** | **9,10** | **Coupe** sur le tic : des tours au soleil couchant sur un ciel sarcelle uni, un renfoncement sombre entre deux tours | — |
| 7,07 – 7,60 | 9,65 – 10,39 | **Une colonne de fenêtres s'allume en rouge du bas vers le haut**, en quatre pas (7,07 · 7,23 · 7,43 · 7,60 s), après la reprise (6,96 s) ; l'image recule lentement | Colonne (4), mouvement (6) |
| 7,60 – 8,90 | 10,39 – 12,19 | La colonne allumée | — |
| **8,90** | **12,19** | **Tout s'éteint d'un coup** | Colonne (4) |
| 9,03 – 9,83 | 12,37 – 13,48 | La musique coupée ; l'image tenue, immobile (dès 9,47 s), 0,8 s de quasi-silence | Fin |

## Effets (ce qu'on veut savoir refaire)

Ce que l'original fait sur trois photos de ville, le modèle le fait sur les photos ou les vidéos fixes de son lieu à elle : sa lampe, son enseigne, ses fenêtres. Tristan : « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image ».

### 1. Sa lampe qui clignote, puis tient
- **Mesuré** : une lampe de lampadaire (tête plate sur un mât courbé) en contre-plongée à gauche du cadre (sa zone : x 30 – 45 %, y 37,5 – 42,7 %), devant un ciel de couchant : le reste de l'image ne change pas d'un pixel (écart moyen 0,04 niveau sur 124 images). **Tout ou rien** : éteinte, le verre est noir (#0B0B08) ; allumée, il est jaune chaud (#F1C728), blanc au cœur (#F2F2F6), d'une image à l'autre, sans fondu ni montée, sans halo sur le ciel (le ciel autour ne bouge pas). Allumée aux images 4 – 7 (le coup grave de l'ouverture), 33 – 36, 39 – 42, 45 – 48 (trois clignotements de quatre images, deux images éteinte entre eux), puis de 51 à 92 (1,4 s), éteinte de 93 à la coupe. Ses clignotements tombent tous les 6 images, autour de la reprise de la musique et de ses charlestons (1,37 · 1,54 · 1,72 s), deux images en avance sur eux ; elle s'éteint quatre images après la caisse claire du temps 4, avant que la musique s'arrête.
- **Sur quoi** : une de ses lumières de près, sur une photo ou une vidéo fixe : un lampadaire, une lanterne, une applique, une suspension, son enseigne lumineuse, un néon, une guirlande, sa vitrine éclairée.
- **Outil** : existant. `Subject object="…"` (un objet trouvé par son nom sur sa photo, ou suivi dans sa vidéo, `docs/detourage.md`, « Suivi d'un objet ») posé par-dessus son image : éteinte, son détourage assombri (45 % de sa lumière) ; allumée, son détourage plus clair et sa forme remplie d'une lumière chaude en `screen` (`Subject fill`, la plus forte en son milieu), avec un halo flou de la même lumière autour. Une lampe déjà allumée sur sa photo s'éteint ainsi aussi bien qu'une éteinte s'allume.
- **Si rien ne s'y prête** (aucune lumière nommée ni trouvée) : ce qui brille déjà dans son image (ses hautes lumières, floutées, en `screen`) s'allume et s'éteint sur le même rythme.

### 2. Ses fenêtres qui s'allument en rouge, par vagues
- **Mesuré** : une cour d'immeubles vue d'en bas, toute en bleu-vert sombre (#061C1E à #04282D), le ciel en croix entre les immeubles. **Ses fenêtres se remplissent de rouge** (rouge orangé #B72D0F, de #92 0F 0B à #E9 43 17 selon la fenêtre : la teinte posée sur la vitre en garde un peu la matière), par **vagues** : 12 fenêtres à 4,20 s, 10 à 4,33 s, 19 à 4,53 s, 16 à 5,13 s, 5 à 5,27 s, 18 à 6,00 s (80 en tout), en gros du bas de l'image vers le haut (les étages du bas d'abord) ; chacune s'allume d'un coup et reste allumée jusqu'à la coupe. En temps : 5,69 · 5,87 · 6,15 (trois vagues serrées juste après la reprise de 5,5), 6,98 · 7,16 (le coup du temps 7), 8,17 (après celui du temps 8).
- **Sur quoi** : ses fenêtres (« every window », chacune à part, douze au plus), ou ce qu'elle a plusieurs fois et qui peut s'allumer : ses lampes, ses ampoules, ses bougies, les lettres de son enseigne. Une vitrine d'un seul tenant se remplit par tranches.
- **Outil** : existant. `SubjectParts(shots[1], frame, laid, "every window")` donne ses fenêtres une à une (leurs boîtes), `Subject object="every window" fill={rouge}` leur silhouette d'une seule couleur ; le modèle ne montre que celles déjà allumées (le détourage masqué par leurs boîtes), chacune dans sa vague, de la plus basse à la plus haute.
- **Si rien ne s'y prête** : ses hautes lumières scintillent sur chaque vague (un éclat de trois images).

### 3. Un soleil rouge dans son ciel, derrière ses toits
- **Mesuré** : un disque **rouge pur (#FE0000), plat** (ni dégradé, ni halo, ni bord), centré au milieu exact de l'image (360, 639 px), posé dans le ciel **derrière les immeubles** (leurs angles le coupent en croix, puis en octogone). Il est là dès la coupe et **rétrécit lentement** pendant tout le plan : son rayon passe de 145 à 113 px (de 20 à 15,7 % de la largeur), d'un mouvement régulier, pendant que l'image avance de 10 % : il n'est pas collé à la photo. Rien ne pulse.
- **Sur quoi** : son ciel au-dessus de ses toits (une rue, une façade, une terrasse vue de loin), au crépuscule ou de jour.
- **Outil** : existant. Sa ligne de ciel (`SkylineAt`, lue sur son plan) découpe le disque au-dessus de ses toits, et son plan sans son ciel (`Skyline`) se pose par-dessus, ses toits, ses arbres et ses poteaux devant lui. Le disque au milieu de la largeur, son centre juste au-dessus de la ligne de ciel, le bas caché derrière ses toits, comme un soleil qui se couche.
- **Si rien ne s'y prête** (pas de ciel lu : un intérieur, une vidéo ralentie) : pas de soleil. Réglage `soleil` : `non` le retire.

### 4. Une colonne de fenêtres qui monte, puis tout s'éteint
- **Mesuré** : deux tours au soleil (une grise, une orange #BE6C2A) et entre elles un renfoncement sombre (#1E3227) percé de deux colonnes de fenêtres (x 40 et 44 % de la largeur). **Elles s'allument en cramoisi plat (#A50C21) du bas vers le haut**, en quatre pas : 2 fenêtres à 7,07 s, 4 à 7,23 s, 3 à 7,43 s, 7 à 7,60 s (16 en tout ; tous les 5 à 6 images, les deux dernières étages d'un coup), après la reprise de 6,96 s (temps 9,65 · 9,88 · 10,16 · 10,39). Elles tiennent 1,3 s, puis **s'éteignent toutes d'un coup à 8,90 s** (image 267, quatre images après le coup du temps 12), juste avant que la musique se coupe (9,03 s) ; l'image reste ensuite seule.
- **Sur quoi** : sa façade de face ou un immeuble, ses fenêtres les unes au-dessus des autres ; une guirlande, une enseigne verticale, ses étagères éclairées.
- **Outil** : existant, comme l'effet 2 (`SubjectParts` et `Subject fill` sur son dernier plan), ses morceaux pris du plus bas au plus haut.
- **Si rien ne s'y prête** : ses hautes lumières s'allument sur les quatre pas et s'éteignent avec elles.

### 5. La musique qui s'arrête trois fois, le tic dans le dernier arrêt
- **Mesuré** : voir « Sa musique ». Chaque arrêt tient un temps, après le premier demi-temps de la mesure (0,44 · 4,41 · 8,47), et la musique repart sur le contretemps (1,5 · 5,5 · 9,5) ; la lampe se tait avec elle, la première coupe tombe sur la deuxième reprise, la seconde sur le tic du troisième arrêt.
- **Outil** : existant (`music` du déroulé, `docs/son.md`, « Forme de la musique d'un modèle ») : son premier temps à 0,09 s (`downbeat`), trois `pauses` sur ses temps, la fin coupée au temps 12,37 ; le tic est un bruitage du déroulé (« short high rim click ») posé sur le temps 9,03.

### 6. Les lents mouvements et les ciels en aplat
- **Mesuré** : le plan 1 est immobile ; le plan 2 **avance et tourne** (x 1,099 et 3,6° en 2,5 s, autour du milieu, d'un mouvement régulier) ; le plan 3 **recule** (x 0,951 en 2,8 s, en montant de 31 px), puis s'arrête à 9,47 s. Leurs ciels sont **remplacés par un aplat** : cyan #0BA2B2 dans la cour (écart 2 niveaux), sarcelle #084543 derrière les tours (écart nul : une couleur unie jusque dans les coins), quand celui du plan 1 est une vraie photo.
- **Pas gardé** : ses photos restent figées et ses vidéos jouent comme filmées (Tristan : « si photos envoyées, figées ; si vidéos, ça joue » ; et une poussée lente posée d'office lui paraît cheap). Son ciel reste le sien : l'effet, ce sont ses lumières. Un ciel en aplat derrière ses toits (`Skyline` sur un aplat) serait un réglage à proposer à Tristan.

### 7. Le second exemple : des lumières en éclairs blancs
- **Mesuré** (sur l'horloge de l'original, +0,10 s) : sur l'applique, ses abat-jour changent de couleur sur le coup de l'ouverture (vert, ambre, rouge en quatre images), puis flashent en blanc une image sur les charlestons de la reprise (1,37 · 1,57 · 1,77 s : le même triple clignotement, tous les 6 images, que la lampe de l'original), son bras s'allume en jaune ; la coupe vers la rue est un éclair blanc chaud sur toute l'image (82 %, deux images) juste après la caisse claire du temps 4 ; dans la rue, des morceaux entiers de l'image (un immeuble, le parasol, un balcon, le ciel) **surexposés en blanc chaud (#FEFCD8) une image, puis à demi-lumière deux images**, un par coup (4,10 · 4,27 · 4,43 · 5,13 s…) ; sur l'enseigne, le tableau du menu flashe sur le tic (6,63 s) et quelques lettres scintillent ; sur le feu rouge, la fenêtre (8,07 s, le temps 11), tout le mur (8,43 s), puis le feu lui-même (8,80 s, le temps 12).
- **Outil** : le même que l'effet 1 (`Subject object` éclairci jusqu'au blanc). Pas dans le modèle v1, qui suit l'original (ses rouges) ; une manière d'allumer à proposer en réglage (« en éclairs blancs »).

### 8. Étalonnage
Teal et orange marqué : ciels sarcelle et cyan, ombres bleu-vert presque noires, tours orange (#BE6C2A) et brun chaud, couchant rose et orange sur le plan 1 (#A26F61 en haut, #2D4468 au milieu, #7C5F59 en bas) ; les rouges (lampe, disque, fenêtres) francs, posés par-dessus. Contraste fort, ni grain (l'aplat du plan 3 n'a aucun bruit), ni coins sombres.

## Format
L'original est vertical plein cadre, le second exemple horizontal 16:9 : le format suit ses fichiers. Réglage « format » :
- `auto` (par défaut) : vertical plein cadre quand ses fichiers le sont, sinon sa vidéo horizontale entière dans une bande 16:9 au milieu du noir (comme le second exemple) ;
- `vertical` : plein cadre, ses fichiers horizontaux recadrés ;
- `horizontal` : la bande 16:9 sur du noir.

## À l'original, jamais recopié
Ses lieux (la cour d'immeubles vue d'en bas, ses tours) et la place exacte de son soleil dans cette cour : le modèle allume ses lieux à elle. Le second exemple montre l'enseigne d'un café et ses mots : jamais repris (son nom à elle, ou rien).

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, les trois plans fixes et leurs deux coupes (4,13 et 6,67 s, justes), le lampadaire qui clignote (0,13 · 1,07 · 1,27 · 1,47 · 1,67 à 3,00 s : une image en avance sur les trois clignotements, deux sur la fin, 3,07 s), le disque rouge (#FF0015 pour #FE0000), les fenêtres de la cour allumées en rouge « par paliers », la colonne qui monte au plan 3 (dès 7,07 s, juste), le teal et orange.

**Raté** : le **tempo** (65 au lieu de 83), les **trois arrêts** de la musique (il décrit « une intro rythmée avec montée » puis « le groove principal »), le **tic** du troisième arrêt et la coupe sur lui, le **disque qui rétrécit** (il le dit « fixe, léger pulsing »), sa taille (30 % de la largeur au lieu de 40 % de diamètre au départ, 32 % à la fin), le **rouge des fenêtres** (#FF1C24 au lieu de #B72D0F et #A50C21, plus sombres), la **fin** (toutes les fenêtres s'éteignent d'un coup à 8,90 s, puis 0,8 s de quasi-silence ; il les fait monter « jusqu'à 8,80 »), les **ciels en aplat**, la **poussée qui tourne** et le **recul** des plans 2 et 3 (il les dit fixes), la cadence exacte des clignotements (quatre images allumée, deux éteinte). Ni grain ni vignettage (il voit « un léger bruit numérique » et « une légère vignette »).

## Le modèle v1 (5 novembre)
`skills/petites-lumieres.ts`, version 1. Trois plans (quatre avec un couplet), 9,83 s (12,73 s à quatre plans) à 83 BPM, ses coupes sur celles de l'original à son tempo (4,13 et 6,67 s), sa longueur réglée par le tempo (de 60 à 100 BPM).
- **Plan 1, sa lumière** (`lumiere`, nommée par le remplisseur : « street lamp head », « neon sign », « wall lamp »…) : éteinte (assombrie) sauf sur les temps de l'original : allumée quatre images sur le coup de l'ouverture, trois clignotements, tenue de 1,70 à 3,10 s, éteinte jusqu'à la coupe.
- **Plan 2, ses fenêtres** (`fenetres`, « every window ») en six vagues du bas vers le haut, à sa couleur, et **le soleil** dans son ciel derrière ses toits, qui rétrécit de 20 à 15,7 % de la largeur (son rayon).
- **Dernier plan, sa colonne** (`colonne`) : quatre pas du bas vers le haut, tout éteint d'un coup à 8,90 s, l'image tenue jusqu'à la fin.
- **Couplet** (un quatrième fichier, `suite`) : un plan de quatre temps de plus entre le deuxième et le dernier, allumé comme le dernier mais tenu jusqu'à sa coupe, sur le tic de l'arrêt suivant.
- **Son nom** (facultatif, `nom`) : l'original n'a aucun texte ; quand le Reel a besoin de mots, son nom s'allume comme un néon (un tube qui prend : éteint, allumé, presque éteint, allumé) dans la partie calme de son dernier plan (son ciel d'abord), avec le premier pas de la colonne, et reste allumé après que tout s'est éteint : la dernière lumière. Carte de fin en option : à sa place, allumée de même, après l'image tenue.
- **Couleur** (`couleur`) : `rouge` (celui de l'original : fenêtres #B4201A, soleil #FE0000, néon rouge), `chaude` (la lumière d'une fenêtre, un soleil orange, un néon blanc chaud), `sienne` (sa couleur, si elle est assez vive pour briller, sinon le rouge).
- **Le son** : sa musique composée à 83 BPM, son premier temps à 0,09 s, ses trois arrêts d'un temps, coupée au temps 12,37 ; le tic dans le dernier arrêt.
- **Ce qui manque** : les ciels en aplat et la manière « en éclairs blancs » du second exemple (à proposer en réglages) ; ses lents mouvements, laissés exprès.

## Ce qu'il faut filmer
Le soir, à la tombée de la nuit, téléphone posé (ou trois photos) :
1. une de ses lumières de près, devant un ciel ou un mur calme : son lampadaire, sa lanterne, son applique, son enseigne lumineuse, un néon ;
2. sa rue ou sa façade en plan large, avec des fenêtres (éclairées ou pas) et un peu de ciel au-dessus des toits ;
3. une façade ou un immeuble de face, ses fenêtres les unes au-dessus des autres.

Rien ne bouge : c'est la lumière qui bouge.
