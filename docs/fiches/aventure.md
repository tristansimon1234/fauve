# « Un an de plus » (`aventure`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de la grille de ses coupes depuis son temps 0 (0,347 s).

**L'original** : le Reel n° 15 de la vague du 5 novembre (le lien de Tristan : https://www.instagram.com/reel/DPntrtmE207/), 46,88 s (1 405 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son (stéréo, −14,1 LUFS). L'année d'un créateur de voyage racontée comme une aventure : un compteur « LAP 32 » qui passe à « 33 » sur le temps fort (son âge, un tour du soleil de plus), ses voyages à toute allure, un accident et l'hôpital, la reprise, ses amis à la fin. 51 plans, dont 10 coupes cachées derrière ce qui passe devant l'objectif. Plus long qu'un Reel d'Edith (45 s au plus, `MAX_REEL_SECONDS`) : le modèle garde sa structure dans 45 s, carte de fin comprise.
**Sa musique** : une **folk acoustique**, guitare grattée en croches (un coup tous les demi-temps), à **134,8 BPM** (un temps toutes les 0,4451 s, le premier à 0,24 s ; mesuré sur ses attaques, toutes bandes : la grille la plus forte, à 134,8 ± 0,05). Sa basse : un peu dans la première demi-seconde, **absente de 0,55 à 1,65 s** (le grave à −14 à −25 dB contre +45 après), qui remonte de 1,65 à 1,95 s et **tombe à 2,02 s** (son temps 4, le premier de sa deuxième mesure) sur le visage du compteur. **Étouffée sous l'eau** : de 13,30 s (la caméra plonge, image 399) à 15,00 s (le premier plan hors de l'eau, image 451), les aigus perdent 45 dB et les médiums 15, le grave reste : comme entendue sous l'eau. **Le dernier plan sans basse** : coupée net à 44,85 s, sur la coupe du dernier plan (image 1345), la guitare seule jusqu'à la fin, éteinte sur ses 0,3 dernières secondes. Ses médiums montent de 5 dB sur les amis qui courent de nuit (41,6 – 42,6 s) : la voix de la chanson ou leurs cris, impossible à trancher sur un spectre. Aucun bruitage : le fouet, la plongée et l'eau qui monte ne s'entendent pas (rien ne sort de la musique). Gemini disait 115 BPM : faux ; `measure.py` 135 (juste, son premier temps à 0,239 s).
**Ses coupes** : sur une grille à **134,87 BPM décalée de 0,107 s** (3,2 images) après les temps de sa musique : ses 41 coupes visibles tombent à 1,4 image en moyenne d'un quart de temps de cette grille (la plupart sur un temps entier, toutes les deux temps de 13,35 images : 0,89 s), un montage qui coupe juste après le coup. Ses flux audio et vidéo commencent ensemble (aucun décalage dans le fichier). Le modèle coupe **sur** ses temps : la musique d'Edith est posée sur ses coupes.
**Mesuré avec** : `scripts/fiche/measure.py` (le format, 42 coupes dont il manque les cachées, 50 « clignotements » qui sont des mouvements et des passages devant l'objectif, cinq « flashs » qui sont le fouet, le poncho et la plongée), des planches à 2 et 30 i/s de tout l'original, chaque coupe cachée image par image (exactes, sans saut de lecture), des gros plans du compteur à pleine résolution, sa place et sa taille relevées sur les pixels, son opacité estimée sur les pixels contre le fond, la luminosité et la saturation de chaque plan, les couleurs de ses ombres et de ses hautes lumières, le bruit d'un ciel uni, le son par bandes (grave, bas, médiums, aigus) toutes les 10 ms, ses attaques à 2,5 ms près et leur grille ajustée, ses coupes placées sur cette grille, et la lecture de Gemini (`house/breakdowns/aventure.json`, lue une fois en base, aucun appel).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,30 | −0,8 – 0 | Une tour en contre-plongée, ciel bleu ; à la coupe, quelque chose de sombre passe tout près de l'objectif (images 9 à 12) | Effet 2 |
| 0,30 – 0,77 | 0 – 1 | Une façade à horloge, la caméra qui recule vite | — |
| 0,77 – 1,20 | 1 – 2 | Un tuk-tuk de nuit qui passe ; l'image plonge dans le noir (images 30 à 39 : la coupe s'y cache) | Effet 2 |
| 1,20 – 2,07 | 2 – 4 | Un tissu rouge et un pied qui sortent du noir, au ralenti ; la musique sans sa basse | Effets 2 et 7 |
| **2,07 – 3,20** | **4 – 6,5** | **Le temps fort** : la basse tombe sur un visage frappé de poudre rouge au ralenti ; « LAP 32 » au milieu, qui passe à « 33 » un temps plus tard (image 76) ; la poudre remplit l'objectif (images 90 à 95) | Effets 1 et 2 |
| 3,20 – 3,53 | 6,5 – 7,25 | La foule, floue ; le compteur part d'un coup au milieu du plan (image 102) | Effet 1 |
| 3,53 – 20,33 | 7,25 – 45 | **L'élan** : 19 plans de 0,3 à 1,8 s, le plus souvent un tous les deux temps : un fouet (image 125), un rickshaw au ralenti dans une fumée jaune qui remplit l'image (5,4 – 6,0 s), un enfant qui sort de la fumée, un lama, un poncho qui passe devant l'objectif (7,53 – 7,93), des îles d'en haut, des temples, des moines, une cascade où la caméra plonge (13,2 s) ; sous l'eau trois plans, la musique étouffée ; la plage d'en haut (la musique revient), une barque, un selfie, la neige, des amis, une voiture | Effets 2 et 3 |
| 20,33 – 23,50 | 45 – 52 | **Le coup dur** : le bras en écharpe, l'hôpital, la tête basse, les doigts sur la cicatrice ; quatre plans de un à deux temps | Effet 6 |
| 23,50 – 41,30 | 52 – 92 | **La reprise** : des randonneurs au-dessus d'un lac, deux amies assises face à lui, une vallée, un long plan qui tourne sur une via ferrata (2,2 s), l'appareil montré à table puis le même sous l'eau (l'eau qui monte, 29,27 – 29,40), une raie manta, des amis, un homme accoudé, des vagues, un profil qui se fond dans un coucher de soleil (33,9 – 35,0), deux pilotes et le drone qui file, le carnet | Effets 4 et 5 |
| 41,30 – 46,88 | 92 – 104,5 | **Les siens** : des amis qui courent de nuit vers la caméra en riant, la photo de groupe, les embrassades ; le dernier plan (2 s) sans la basse, la musique qui s'éteint | Effet 7 |

Des coupes franches partout, sauf ses coupes cachées et un long fondu ; ni zoom posé, ni poussée, ni flash d'appareil : ses mouvements sont ceux de ses caméras (un recul, un fouet, une perche qui tourne, un drone), jamais ceux du montage.

## Effets (ce qu'on veut savoir refaire)

### 1. Le compteur qui prend un an sur le temps fort
- **Mesuré** : « LAP » sur une ligne, « 32 » dessous, centrés au milieu de l'image, sur son visage : « LAP » de 40,0 à 60,1 % de la largeur et de 44,0 à 52,0 % de la hauteur, le nombre de 42,8 à 57,6 % et de 53,4 à 61,3 % ; des capitales de 8 % de la hauteur (103 px pour 1 280), un interligne de 1,17 fois leur hauteur ; une grotesque très étroite, de graisse moyenne, aux fûts égaux (comme Bebas Neue). Blanches et **translucides** : environ 40 % (l'image se voit à travers, mesuré sur les pixels contre le fond) ; ni ombre, ni contour. Là **d'un coup sur la coupe** où la basse tombe (image 62), immobile ; **le nombre passe à « 33 » d'un coup un temps plus tard** (image 76, 14 images), puis **gonfle** de 25 à 35 % sur trois images, flou de bougé (77 à 79), et retombe à sa taille à l'image 80 ; « LAP » ne bouge pas. Il reste par-dessus la poudre qui remplit l'objectif, passe la coupe sur la foule et **part d'un coup au milieu de ce plan** (image 102), trois temps après son arrivée. C'est le seul texte du Reel.
- **Sur quoi** : ce que compte son histoire, en un ou deux mots, sur son plan le plus fort : son âge (« 5 ANS », le nombre d'avant d'abord), une saison (« SAISON 3 »), une édition, l'année qu'elle raconte (« 2026 », après « 2025 ») ; sans nombre, un ou deux mots (« UN AN », « L'ÉTÉ ») qui gonflent sur le temps.
- **Outil** : le code du modèle (deux `FitText` et un changement de texte sur un temps ; existants). Un nombre plus petit d'un s'en déduit : jamais inventé, toujours le sien.
- **Si rien ne s'y prête** : sans nombre, ses mots seuls, le même gonflement sur le temps.
- **À l'original, jamais recopié** : le mot « LAP » (son tour du soleil) et son âge.

### 2. Les coupes cachées derrière ce qui passe devant l'objectif
- **Mesuré** : dix coupes ne se voient pas, chacune derrière quelque chose qui remplit l'image : **du sombre** qui passe devant l'objectif (la tour, images 9 à 12, entré en une image, reparti en trois vers le haut à gauche ; la nuit qui tombe dans le noir, images 30 à 39), **la poudre** du plan qui sort (elle grandit sur six images, 90 à 95, jusqu'à tout couvrir, puis la coupe), **la fumée** (jaune, 163 à 179, la coupe dedans), **un tissu** du plan qui entre (le poncho flou tout contre l'objectif, douze images, 226 à 237, puis la scène se dévoile), **un fouet** (images 125 à 129, quelqu'un passe devant et la caméra balaie, flou de bougé), **un drone** qui file (deux images fondues, 1088 – 1089, dans un plan qui fonce), plus la plongée, l'eau qui monte et le fondu (effets 3 à 5).
- **Sur quoi** : n'importe quel commerce a des passages tout près de l'objectif : quelqu'un qui passe devant, un plateau, un tablier, une main, de la vapeur, de la farine, de la fumée, une porte, ou un fouet de la caméra.
- **Outil** : `reads: ["moves", "covered"]` (existants, `video_read.py`) : le remplisseur cale la coupe sur son vrai fouet ou son objectif couvert quand ses vidéos en ont. Sinon le code les dessine : un voile fait de son propre plan agrandi et flou (comme les bandes d'« Une journée chez toi »), sombre pour ce qui passe, de la couleur du plan qui sort pour la poudre et la fumée, du plan qui entre pour le tissu ; `Whip` (existant) pour les fouets.
- **Si rien ne s'y prête** : le voile dessiné, toujours.

### 3. La plongée : la musique étouffée sous l'eau
- **Mesuré** : la caméra suit la cascade vers le bas, entre dans l'eau (un éclair turquoise, images 395 à 397), et le plan suivant commence flou sous l'eau (398 à 403, net à 404) ; la musique est étouffée dès la coupe (13,30 s) et le reste sur les trois plans sous l'eau, jusqu'à la coupe sur la plage vue d'en haut (15,00 s) : la musique s'ouvre d'un coup, à l'air libre.
- **Sur quoi** : de l'eau ou un liquide (une fontaine, un café qu'on verse, un verre, une piscine, la mer), sinon un passage calme : la musique étouffée fait le « dessous ».
- **Outil** : la forme de la musique (`filters` muffled : existant) ; le plan qui entre, flou puis net en six images, dessiné par le code (le même voile, clair).
- **Si rien ne s'y prête** : la musique étouffée sur ses plans les plus calmes.

### 4. Le raccord sur un objet : l'eau qui monte
- **Mesuré** : il montre une caméra d'action à table (28,80 – 29,40 s), l'eau monte du bas de l'image en quatre images (878 à 881), et il est sous l'eau, la même caméra dans la main, à la même place (image 882) : un raccord sur l'objet.
- **Sur quoi** : un objet qu'on montre (un produit, une tasse, un outil), puis le même ailleurs (en action, dehors, servi).
- **Outil** : le code du modèle (le plan qui entre, dévoilé du bas par un bord ondulé sur quatre images) ; le remplisseur met le même objet dans les deux cases quand elle l'a.
- **Si rien ne s'y prête** : deux plans qui se suivent, le même bord qui monte.

### 5. Le long fondu
- **Mesuré** : le seul fondu du Reel, 1 s (images 1020 à 1050) : un profil avec des lunettes de pilote se fond dans un coucher de soleil sur un champ, les deux à moitié au milieu (une double exposition).
- **Sur quoi** : un visage de profil, calme, puis une lumière (un coucher de soleil, une vitrine éclairée, une lampe).
- **Outil** : le code du modèle (l'opacité du plan qui entre ; `Footage` tient la première image de l'un avant son moment et la dernière de l'autre après, sous 50 %).
- **Si rien ne s'y prête** : le même fondu entre ses deux plans.

### 6. Le coup dur, puis la reprise
- **Mesuré** : quatre plans de un à deux temps (le bras en écharpe, l'hôpital, la tête basse, la cicatrice), les deux derniers plus sombres (une luminosité moyenne de 61 et 42 sur 255 contre 84 pour l'ensemble) ; la musique ne change pas, ni l'étalonnage : ce sont les images qui baissent. La reprise repart sur un grand décor (des randonneurs au-dessus d'un lac, 1,3 s).
- **Sur quoi** : un moment dur que tout commerce connaît (des travaux, la pluie, la salle vide, la fatigue, une fermeture), puis la reprise (on rouvre, on se remet au travail).
- **Outil** : rien de plus : ses cases le demandent, avec leur plan B (un plan calme et sombre ; un plan large qui bouge).
- **À l'original, jamais recopié** : son accident et son hôpital.

### 7. Les siens, et la musique qui s'en va
- **Mesuré** : des amis qui courent vers la caméra de nuit (1,67 s), une photo de groupe sous une lanterne (0,93 s), deux plans d'embrassades (0,93 et 2 s) ; la basse coupée sur la coupe du dernier plan, la musique éteinte sur ses 0,3 dernières secondes. Rien d'écrit, ni carte, ni logo.
- **Sur quoi** : son équipe, ses clients, une soirée, des gens dans les bras les uns des autres.
- **Outil** : la forme de la musique (`thin` sur le dernier plan, `end` en fondu : existants). **En option** : une carte de fin sur le dernier plan tenu (Tristan : « en option »).

### 8. Étalonnage
Un film doux de voyage : des ombres un peu froides (#191C1D, le bleu et le vert au-dessus du rouge), des médiums et des hautes lumières chauds (#7B756A, #C6C1B2), des blancs retenus (jamais au-dessus de 222 sur 255), des noirs à peine levés (9 au plus sombre), une saturation moyenne de 38 % (les plans saturés le sont d'eux-mêmes : la poudre, la mer). Aucun grain visible (le ciel du coucher de soleil, uni, a 0,4 niveau de bruit), ni coins sombres.

## Format
L'original est vertical 9:16, plein cadre. Réglage « format » :
- `auto` (par défaut) : comme ses vidéos : vertical plein cadre, ses vidéos horizontales entières dans une bande 16:9 sur du noir quand la plupart le sont ;
- `vertical` : vertical plein cadre, ses vidéos horizontales recadrées sur leur sujet ;
- `horizontal` : ses vidéos entières dans une bande 16:9 sur du noir.
Le compteur reste au milieu de l'image (de la bande quand elle y est, plus grand pour qu'il se lise).

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, ses lieux et ses plans dans l'ordre (à quelques images près pour la plupart), « LAP 32 » puis « LAP 33 », leur place (38 %, 44 % : juste à deux points près) et leur police étroite, le tissu qui occulte une coupe, la fumée jaune qui en masque une autre, la plongée, le raccord sur la caméra, la double exposition, les cinq parties du récit, une folk acoustique.

**Raté** : le **tempo** (115 au lieu de 134,8), la **basse qui tombe** sur le compteur (2,02 s) et son absence avant, la **musique étouffée sous l'eau** (13,30 – 15,00 s), le **dernier plan sans basse** ; le compteur « à 80 % d'opacité » (environ 40 %), son changement à 2,50 s (2,53 s, image 76) **sans son gonflement**, son départ « en fondu masqué par la foule » (d'un coup, image 102, au milieu du plan) ; un « whip pan » à 0,27 s (du sombre qui passe devant l'objectif), un « flash » à 1,33 s (rien), le fouet de 4,17 s et le fondu du drone ; un « grain argentique fin tout le long » (aucun) ; la partie « Épreuve & Blessure » dès 17,6 s (la neige et les amis : le coup dur commence à 20,33 s). `measure.py`, lui, voyait 135 BPM (juste) et 42 coupes (il manque les cachées).

## Ce qu'il faut filmer
Tout au long de son année (ou de sa saison), de courtes vidéos, en vertical de préférence, 12 à 30 :
1. **Son plan le plus fort**, de près, au milieu de l'image : un visage dans un moment fort (de la farine, des confettis, de la vapeur, un éclat de rire, un toast), au ralenti si son téléphone le fait : le compteur s'y pose.
2. **Ses moments**, variés : son lieu (sa façade, sa rue, le soir), son travail, ses clients, son équipe, une sortie ; et des passages tout près de l'objectif (quelqu'un qui passe devant, un plateau, une main, de la vapeur) : ses coupes s'y cachent.
3. **De l'eau** qu'on verse ou qui coule, la caméra qui la suit vers le bas ; un plan dedans (le fond d'une tasse, des bulles, une piscine).
4. **Un moment dur** (des travaux, la pluie, la salle vide, la fatigue) et **la reprise** (on rouvre, on se remet au travail).
5. **Un objet qu'on montre** à l'objectif, puis le même ailleurs ; **un profil** calme, puis **une lumière** (un coucher de soleil, une vitrine éclairée).
6. **Les siens pour finir** : son équipe, ses clients, une soirée, des gens qui rient, courent vers la caméra, se prennent dans les bras ; une photo de groupe.

Et ce que compte son histoire, en un ou deux mots (« 5 ANS », « SAISON 3 », « 2026 »).
