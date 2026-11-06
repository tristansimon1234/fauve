# « Interrupteur » (`interrupteur`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps.

**L'original** : `house/originals/interrupteur.mp4`, 9,17 s (275 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son. Un seul plan fixe, aucune coupe. Le modèle prend tout l'original (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : **deux morceaux et un silence** (le détail : effets 5 et 6). Le premier, un beat à motif mélodique haché, à **143,7 BPM** (un temps toutes les 0,4175 s, le premier à 0,24 s ; cinq coups forts sur la grille à 8 ms près ; `measure.py` le plie à 72), **coupé net à 2,29 s**. Puis **2,1 s de silence**, un seul « bip » dedans. Le second, un beat hip-hop à grosse basse 808, à **106 BPM environ** (106 à 108 ; une autre tonalité : pas la suite du premier), **entre d'un coup à 4,41 s**, quand elle retombe, et s'arrête à 9,00 s. Gemini disait 88 BPM, sans silence : faux. Sûr pour le premier tempo, assez sûr pour le second (8 temps à 22 ms près). Pour le modèle, une seule grille suffit, celle du premier (71,9 BPM en comptant un temps sur deux : le moteur veut 60 à 140).
**Mesuré avec** : `scripts/fiche/measure.py` (aucune coupe, aucun mouvement rapide ; ses cinq « clignotements » sont ses mouvements à elle), des planches à 30 i/s de chaque seconde, des gros plans de l'interrupteur, de sa main et de l'affiche, chaque image comparée au mur nu de l'image 273, le niveau, le spectre et les attaques du son (basse, caisse claire, aigus), et la lecture de Gemini (`house/breakdowns/interrupteur.json`).

## Déroulé

Temps : la grille du premier morceau (143,7 BPM), gardée pendant le silence et après. L'arrêt tombe juste avant le temps 5, la reprise sur le temps 10, la fin du son sur le temps 21.

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,95 | −0,6 – 1,7 | Le mur vide au-dessus d'une banquette, l'interrupteur éteint en haut. Son ombre entre à droite à 0,57 s | Interrupteur dessiné (effet 1) |
| 0,95 – 1,57 | 1,7 – 3,2 | Elle entre par la droite et marche jusque sous l'interrupteur | — |
| 1,70 – 2,29 | 3,5 – 4,9 | Elle lève le bras : sa main s'arrête bien sous l'interrupteur | La musique s'arrête net à 2,29 s (effet 5) |
| 2,29 – 3,53 | 4,9 – 7,9 | Silence. Elle pose la main à plat sur le mur, trop bas (2,87 – 3,17 s) | « Bip » à 3,06 s (effet 6) |
| 3,53 – 4,10 | 7,9 – 9,25 | Elle s'accroupit (3,53 – 3,80), saute ; ses doigts touchent l'interrupteur à 4,00 s | Elle passe devant lui (effet 3) |
| **4,10** | **9,25** | Au sommet du saut, **l'interrupteur bascule et l'affiche est là, en une image** (image 123) | Effets 2 et 4 |
| 4,10 – 4,41 | 9,25 – 10 | En l'air, la main sur l'interrupteur, un genou levé. Toujours le silence | — |
| **4,41** | **10** | Elle retombe et lâche l'interrupteur : **le second morceau entre** | Effet 5 |
| 4,41 – 5,77 | 10 – 13,2 | Elle se retourne et sort à gauche, devant l'affiche | Effet 3 |
| 5,77 – 9,10 | 13,2 – 21,2 | Le mur, l'interrupteur allumé et l'affiche, sans elle (3,3 s) | Mur rallongé à 7,50 s (effet 7) ; son coupé à 9,00 s |
| 9,10 – 9,17 | 21,2 – 21,4 | Deux images de mur nu, sans rien de dessiné | Un reste du montage : pas à refaire |

Plan fixe, téléphone posé : il flotte de 7 px au plus (1 % de la largeur). Ni zoom, ni poussée, ni coupe : rien de ce que Tristan trouve cheap.

## Effets (ce qu'on veut savoir refaire)

### 1. Un interrupteur dessiné sur son mur, au-dessus d'elle
- **Mesuré** : un interrupteur de téléphone, plat (ni ombre, ni contour, ni lumière du mur dessus). Piste en gélule de 28,75 % de la largeur sur 7,4 % de la hauteur (hauteur = 0,46 × largeur), centrée à x 49,9 %, y 20,5 % (haut à 16,8 %, bas à 24,2 %). Pastille blanche #FFFFFF en gélule elle aussi, 13,3 % × 5,9 % (1,28 fois plus large que haute), à 10 px des bords (10,5 % de la hauteur de la piste). Éteint : piste #605E5A, pastille à gauche. Il est là dès l'image 0, fixe, sans aucune pulsation. Il est posé hors de sa portée : debout, sa main levée monte à 31,6 % de la hauteur au plus, 7 % sous le bas de l'interrupteur. Il faut sauter.
- **Sur quoi** : toute surface claire et unie qu'elle peut toucher en sautant ou en tendant le bras : un mur, une porte, une vitrine vue de dedans, le côté d'un comptoir.
- **Outil** : `Toggle` existe, mais ne fait pas celui-ci : sa hauteur fait 0,6 × sa largeur, sa pastille est ronde avec une ombre, et il glisse en 6 images en s'étirant. À compléter : ses proportions, une pastille en gélule sans ombre et une bascule sèche en une image. En attendant, le code du modèle le dessine (comme la v1, qui a les bonnes proportions).
- **Si rien ne s'y prête** : il se pose là où sa main monte le plus haut ; gris et blanc, il se lit sur n'importe quel fond.

### 2. La bascule sur sa main, en une image
- **Mesuré** : ses doigts entrent dans la piste à l'image 120 (4,00 s), dans sa moitié droite (53 % de la largeur), puis arrivent à mi-hauteur à l'image 122. L'interrupteur bascule à l'image 123 (4,10 s) **d'un coup** : éteint à l'image 122, allumé à l'image 123, aucune image entre les deux (ni glissé, ni étirement, ni enfoncement). La pastille saute de 89 px (12,4 % de la largeur) à droite et la piste passe au vert #234134, le vert de l'affiche. Elle est au sommet de son saut, les pieds en l'air (images 122 à 130 environ). Sa main reste dessus jusqu'à l'image 131 et le quitte à l'image 132 (4,40 s), quand elle retombe. **Rien d'autre ne change** : la lumière du mur reste la même à 0,2 niveau près, ni flash, ni couleur, et le son reste muet.
- **Sur quoi** : sa main (une tape, une claque, au sommet d'un saut), ou celle de quelqu'un de l'équipe.
- **Outil** : `track(frame)` (existant) : ses mains et son corps lus à chaque image, et lus d'avance pour poser l'interrupteur dès l'image 0 là où sa main ira le plus haut. Il bascule quand ses doigts y arrivent, au sommet. La piste allumée prend sa couleur à elle (`brand.accent`, si elle est assez foncée).
- **Si rien ne s'y prête** (aucune main lue) : la bascule tombe sur le temps 9¼ (4,1 s).

### 3. Elle passe devant ce qui est dessiné
- **Mesuré** : ses doigts passent devant la piste grise (images 120 à 122), puis devant la pastille blanche (123 à 127) ; son bras et son corps passent devant l'affiche (« Goo… » coupé par son bras, images 124 à 145), avec un bord net.
- **Outil** : `Subject shot={0}` (existant), posé après l'interrupteur et l'affiche. Il faut son plan à sa vraie vitesse : un plan ralenti n'est pas détouré.
- **Si rien ne s'y prête** (détourage manquant) : l'interrupteur et l'affiche passent devant elle, comme un autocollant.

### 4. Son affiche s'allume d'un coup sur le mur
- **Mesuré** : à l'image 123, toute l'affiche d'un coup, sans fondu, sans grossir, sans halo, identique de l'image 123 à 272. Elle fait 87 % de la largeur (7,8 – 94,6 %) et 40 % de la hauteur (28,6 – 68,9 %). Elle est centrée, à 4,3 % de la hauteur sous l'interrupteur. Du haut vers le bas :
  - une mascotte au trait vert (un journal qui court avec un mégaphone, le mur visible à travers), avec deux étincelles rouges et les traits rouges du cri (x 27,8 – 82,5 %, y 28,6 – 50,7 %) ;
  - « Good News » dans un gros script rouge #DD2E19 penché, souligné d'un long trait (x 7,8 – 94,6 %, capitales de 10 % de la hauteur, y 48,3 – 62,9 %) ;
  - « — EVENTS WEEK — » en capitales vertes espacées entre deux traits (capitales de 1,6 %, y 61,3 – 62,8 %) ;
  - la date « 8TH - 14TH FEBRUARY 2027 », minuscule (capitales de 0,9 %, y 63,8 – 64,6 %) ;
  - une étincelle rouge à quatre branches (y 65,6 – 68,9 %).

  Deux couleurs seulement : le vert de l'interrupteur et le rouge. L'affiche est posée à plat : sous elle, le mur va de 117 à 150 niveaux, et son rouge reste à 221 ± 7 sans le suivre. Ses petits points blancs ne bougent pas (la texture du dessin) : rien ne scintille.
- **Sur quoi** : son logo (la mascotte, c'est le logo de l'événement), son nom, ce qu'elle annonce, une date ou un détail (une adresse, une heure), dans ses deux couleurs, sur son mur.
- **Outil** : code du modèle avec `brand.logoUrl` (`Img`), `FitText` pour son nom et ses lignes, `Scribble kind="star"` pour l'étincelle (existants).
- **Si rien ne s'y prête** : sans logo, son nom en grand dans sa police de titre, à la place de « Good News » ; sans annonce, le logo ou le nom seul.
- **Autres choses qu'on peut allumer** (l'original ne le fait pas, à voir avec Tristan) : son enseigne dans le plan (`Subject object="shop sign"` éclairci, comme « Lieu tapé »), le noir et blanc qui passe en couleur (`ColorPop frames={1}`), un avant/après (deux prises au même endroit, coupées sur la bascule).

### 5. La musique s'arrête, puis repart quand elle retombe
- **Mesuré** : le premier morceau joue pendant qu'elle entre et lève la main, puis s'arrête net à 2,29 s (de −18 à −47 dB en 40 ms, juste avant son temps 5). Suivent 2,1 s de silence (−65 à −74 dB) pendant qu'elle n'y arrive pas, s'accroupit et saute. La bascule (4,10 s) tombe dans ce silence. Le second morceau entre d'un coup à 4,41 s, 0,31 s après la bascule, quand elle retombe et lâche l'interrupteur. Son premier coup tombe sur le temps 10 de la grille du premier ; ses temps suivants à 4,75 · 5,33 · 5,89 · 6,46 · 7,02 · 7,59 · 8,15 · 8,72 s. Il joue jusqu'à 9,00 s, puis plus rien.
- **Sur quoi** : n'importe quel geste qui déclenche quelque chose : le silence fait l'attente, la reprise fait le « ta-da ».
- **Outil** : **manquant**. Il faut un silence voulu : couper la musique net sur un temps, puis la faire repartir sur un moment du plan (son atterrissage, lu sur ses suivis). Aujourd'hui, la musique d'Edith est une boucle continue : la consigne du compositeur interdit pause, silence, drop et arrêt, et un creux de plus d'une seconde la fait recomposer (`grooveGaps`, `docs/son.md`). Pour la reprise, le même morceau ou un second, plus fort : à décider.
- **Tant qu'il manque** : la musique continue, et la bascule tombe sur un temps fort.

### 6. Un « bip » dans le silence
- **Mesuré** : à 3,06 s (image 92), un son court (0,1 s) et aussi fort que la musique, une note aiguë vers 1,2 kHz qui monte un peu. C'est le seul son du silence, pendant que sa main est à plat sur le mur, trop bas (images 86 à 95). Il tombe au temps 6¾ de la grille. Il y a aussi deux souffles à peine audibles (−45 dB), à 3,5 s et juste avant la reprise.
- **Sur quoi** : son essai raté, sa main qui touche le mur sous l'interrupteur.
- **Outil** : les bruitages existent (ElevenLabs, les `sounds` d'une composition, `plan.sounds`), mais un skill ne peut pas en poser. **Manquant** : un `sounds` dans le déroulé d'un skill, posé sur un temps ou au moment d'un geste lu sur ses mains.
- **Si rien ne s'y prête** (sa main ne touche pas le mur) : pas de bip.

### 7. Le mur vide rallongé
- **Mesuré** : elle sort à gauche vers 5,77 s, et le mur garde l'affiche 3,3 s sans elle. À 7,50 s (image 225), le plan du mur revient 1,43 s en arrière : il rejoue ses images de 6,07 à 7,47 s. Le raccord est invisible : le mur saute de 7 px et s'éclaircit à peine. L'interrupteur et l'affiche ne bougent pas : ils sont posés sur l'écran, pas suivis sur le mur.
- **Outil** : `Footage at={…}` pour rejouer un passage, ou l'image tenue (existants).
- **Si rien ne s'y prête** : sa dernière image tenue.

### 8. Étalonnage
Neutre et doux : un mur gris chaud un peu rosé (#8C7C77 au milieu, #A19692 en bas, presque blanc en haut sous une lumière), peu saturé, contraste doux, ni grain ni vignettage. L'exposition automatique du téléphone éclaircit le mur de 10 niveaux quand elle entre (0,6 – 2 s), puis l'assombrit quand elle sort (5,8 – 6,7 s) : ce n'est pas un effet.

## Format
**Depuis le 6 novembre** (Tristan, sur sept bancs : « vertical please », « tout vertical please ») : `vertical` par défaut, plein écran, ses fichiers horizontaux recadrés sur leur sujet ; `horizontal` (sa bande) seulement à sa demande, ou quand elle veut ses vidéos entières (le `frame` letterbox de son contrat) ; `auto` (comme ses vidéos, ci-dessous) seulement si elle le demande. `docs/modeles.md`, « Réglages d'un modèle ».

L'original est vertical 9:16, un seul plan plein cadre. Réglage « format » :
- `vertical` (par défaut) : sa vidéo plein cadre. Une vidéo horizontale est recadrée en vertical sur une fenêtre fixe, centrée sur l'endroit où sa main monte le plus haut. La fenêtre ne la suit jamais : l'interrupteur et l'affiche restent sur le mur, et elle entre puis sort du cadre.
- `horizontal` : sa vidéo horizontale entière sur du noir. L'interrupteur est au-dessus de sa main, l'affiche sous lui ou à côté, à l'échelle de la bande.
- `auto` : vertical quand sa vidéo l'est ; sinon recadrée si tout son saut tient dans la fenêtre (lu par `track`), sinon horizontal.

Dans tous les cas, sa vidéo est filmée fixe. Si elle bouge, l'interrupteur et l'affiche glissent sur le mur : sur un mur nu, il n'y a rien à suivre pour les y accrocher.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format vertical, le plan fixe unique, l'entrée à droite et la sortie à gauche, le saut, l'interrupteur (sa place à 1 % près, ses couleurs à peu près), la bascule et l'affiche ensemble et d'un coup (à 4,07 s au lieu de 4,10 s : une image trop tôt), les textes de l'affiche, leurs places et leurs couleurs, son ombre, l'étalonnage doux, les images vides de la fin (9,00 – 9,07 s au lieu de 9,10 – 9,17 s).

**Raté** : le **tempo** (88 au lieu de 143,7 puis 106), l'**arrêt de la musique** à 2,29 s et ses **2,1 s de silence**, le **changement de morceau**, le **bip** de 3,06 s (il invente un clic d'interrupteur à 4,07 s, où l'on mesure le silence), la reprise sur son **atterrissage** et non sur la bascule, son **essai raté** et son accroupissement, le fait qu'elle **passe devant** l'interrupteur et l'affiche, le **mur rejoué** à 7,50 s. `measure.py`, lui, voyait 72 BPM (la moitié du premier tempo, rien du second) et cinq « clignotements » qui sont ses mouvements à elle : rien ne s'allume.

## Ce que le modèle v1 ratait
Juste : la place, la taille et les couleurs de l'interrupteur, la bascule lue sur sa main, elle devant, 4 s avant la bascule puis 5 s d'affiche. Raté :
- la **musique** : 120 BPM, « bright playful pop, claps », en boucle continue, sans arrêt, ni silence, ni bip, ni reprise sur l'atterrissage ;
- la **bascule** : l'interrupteur glissait en 4 images, pastille étirée et enfoncée ; un voile sombre (−14 %) couvrait la pièce jusque-là, et le logo arrivait en fondu en grossissant. Dans l'original, la lumière ne change pas et l'affiche est là d'un coup ;
- le **gag** : « elle lève la main et touche le mur », sans essai raté ni saut ;
- l'**affiche** : sans ligne de détail (la date) ni étincelles ; sa composition de référence (`Z-interrupteur`) ajoutait un curseur qui clique et un « C'EST OUVERT » rouge penché, absents de l'original ;
- le **format** : vertical seulement, et une vidéo trop courte était ralentie (alors plus détourée : elle ne passait plus devant).

## Le modèle v2 (5 novembre)
`skills/interrupteur.ts`, version 2, dans la bibliothèque (à valider sur /admin). Un seul plan, aucune coupe, 9,1 s (l'original sans ses deux dernières images) sur la grille de son premier morceau, 143,7 BPM comptés un temps sur deux (71,85 pour le moteur, de 64 à 80).
- **L'interrupteur** : dessiné par son code (`Toggle` n'a pas encore ces proportions), plat, aux mesures de l'original (piste 28,75 % de la largeur, 0,46 de haut, pastille en gélule 1,28 fois plus large que haute, à 10,5 % des bords), là dès l'image 0 ; posé là où sa main monte le plus haut, son doigt juste à droite du milieu, à mi-hauteur (ses mains suivies, `track`, autour de la bascule ; sinon le haut du contour de son détourage quand son bras passe au-dessus de sa tête), sinon à la place de l'original (49,9 %, 20,5 %).
- **La bascule** : d'un coup, en une image, quand ses doigts arrivent à moins d'un cheveu du sommet (sinon sur le temps 9¼, l'image 123) : la pastille à droite, la piste à sa couleur ; la lumière ne change pas.
- **L'affiche**, là d'un coup avec la bascule, posée à plat sous l'interrupteur (au-dessus quand sa main monte bas), 87 % de la largeur sur 40 % de la hauteur : son logo ; son titre en grand dans sa police de titre, souligné à la main (le nom de ce qu'elle lance, ou son nom, jamais deux fois sous un logo qui le dit ; seul et plus grand sans logo) ; sa ligne en capitales espacées entre deux traits ; un petit détail (une date, une heure : une nouvelle case, `detail`) ; une étincelle à quatre branches. Ses deux couleurs : la première assez foncée pour l'interrupteur, les traits et les petites lignes, la seconde pour le titre et l'étincelle (sinon le vert d'un téléphone et une encre). Rien de « Good News », de sa mascotte ni de ses couleurs.
- **Elle passe devant** : son détourage (`Subject`, son seul plan dans `cutouts`) posé après l'interrupteur et l'affiche, seulement à partir de 20 images avant la bascule.
- **Le son** : la musique sans sa basse jusqu'à son arrêt net (2,29 s), un silence avec son bip sur le temps 6¾ (3,06 s, aussi fort que la musique), la reprise sur le temps 10 (4,41 s) avec sa basse, coupée sur le temps 21 (9,0 s).
- **Rendu** : mesuré en local sur un mur blanc (un onglet, la machine chargée) : 0,64 s par image avant la bascule, 0,93 après (son détourage et l'affiche), « Plans fixes de cinéma » sur le même plan 0,56 et 0,57 ; son détourage n'est demandé que sur son plan et posé qu'à partir de 20 images avant la bascule.
- **Format** : réglage `format` : `auto` (vertical plein écran quand sa vidéo l'est ; une vidéo horizontale recadrée sur une fenêtre fixe centrée sur sa main quand tout son geste y tient, lu sur ses suivis, sinon entière dans une bande 16:9 sur du noir, l'interrupteur à l'échelle de la bande), `vertical`, `horizontal`. Le remplisseur lit ses gestes (`reads: ["gestures"]`) pour que le haut de son geste tombe sur la bascule. Carte de fin en option : elle prend la place de son titre et de sa ligne sur l'affiche.
- **Ce qui manque** : un second morceau (le moteur compose un seul morceau : sa basse qui revient le remplace) ; la reprise calée sur son atterrissage lu sur ses suivis (une pause revient sur son temps : c'est le départ de son passage qui cale son saut) ; le mur rejoué (effet 7) : un raccord pour une vidéo trop courte, que le moteur ralentit à la place sans que le code le sache (il faudrait la vitesse du passage dans `shots[i]`) ; les deux souffles à −45 dB.

## Ce qu'il faut filmer
Le téléphone posé ou sur pied, en vertical, l'exposition bloquée (un appui long sur l'écran ; sinon, le mur s'éclaire quand elle entre). Devant un mur clair et uni (une porte, une vitrine, le côté d'un comptoir), avec de la place au-dessus de sa tête. D'une traite, à vitesse réelle, environ 9 s :
1. 1 s de mur vide ;
2. elle entre par un côté, s'arrête, lève la main vers un point du mur au-dessus d'elle ;
3. elle n'y arrive pas (la main à plat sur le mur), s'accroupit, saute et tape le point au sommet du saut ;
4. elle retombe et sort par l'autre côté ;
5. 3 à 4 s de mur vide.

Et aussi son logo (un PNG détouré), ce qu'elle annonce en une ligne, et une date ou un détail.

**Version 3** (5 novembre, après son premier banc, une femme qui colle des photos sur un mur blanc ; Tristan : « une main qui traîne à la fin sur l'interrupteur ») : dès qu'elle est sortie (personne vu pendant six images après la bascule, lu sur son suivi, sinon sur son détourage), son mur est tenu sur cette image jusqu'à la fin, comme l'original finit sur son mur seul : rien d'elle ne revient dans l'image.

**Version 4** (5 novembre ; Tristan sur la v3, au banc d'une friperie : « ça a figé toute l'image ») : la v3 lisait sa présence sur le suivi de son corps, qui la perd quand elle est de dos ou à moitié sortie, et avait figé un Reel où elle ne partait pas. Elle est maintenant partie quand son détourage ne la tient plus (sinon son suivi, s'il la voyait à la bascule), huit images de suite ; rien ne dit qu'elle était là : jamais figé.

**Version 5** (5 novembre, au banc de la friperie) : en v4, sa main qui revenait dans l'image la gardait « présente » (son détourage la tenait) ; elle est maintenant sortie quand son détourage tient moins d'un quart de ce qu'il tenait à la bascule : une main ou un bras qui reviennent ne sont pas elle, et le mur est tenu dès qu'elle est partie.

**Version 6** (5 novembre, au second banc de la friperie, Interrupteur v5 : 10,8 s) : en v5, son corps sortait à droite mais ses deux mains restaient au bord de l'image, à épingler des photos ; moins d'un quart de son détourage valait « partie », et toute l'image se figeait avec ses mains dedans. Elle n'est plus partie que quand il ne reste rien d'elle (moins d'un cinquantième de son détourage à la bascule, huit images de suite) : sur ce plan, où elle ne sort jamais tout à fait, la vidéo joue jusqu'au bout ; une main qui revient une fois qu'elle est vraiment partie n'est toujours pas vue.

**Version 7** (5 novembre ; Tristan sur la v6 : « bizarre que la main reste », puis « problème de détourage non ? ») : ce n'était pas le détourage. Sa vidéo de la friperie dure 13,3 s : elle sort du cadre vers 10 s, puis 3 s de mur vide ; le remplisseur avait mis son geste le plus haut sur la bascule, donc pris la vidéo depuis le début, et le Reel (9,1 s) s'arrêtait avant sa sortie. Son passage finit maintenant sur son mur vide, au moins une seconde après qu'elle est sortie, comme l'original, quitte à basculer sur un geste un peu moins haut.

**Version 8** (5 novembre, banc de la v7 : 10,8 s, 0,17 €, son passage pris de 2,2 à 13 s, jusqu'au mur vide) : deux défauts. L'image se figeait sur sa main qui sortait au bord (un centième de son détourage, sous le cinquantième de la v6) : elle n'est plus partie qu'en dessous d'un cinq-centième. La ligne de sa carte de fin (« Deux salles, de nouvelles pièces chaque semaine ») débordait des deux côtés : une boîte `FitText` ne se mesure qu'une fois, et elle reprenait la boîte de « Nouvelle saison » ; son titre et ses lignes ont maintenant une boîte par texte (une clé faite de leurs mots).

**Version 9** (5 novembre ; Tristan sur la v7 : « le bouton n'est pas au centre ») : l'original le pose au milieu (49,9 % de la largeur), l'affiche centrée dessous ; le modèle le posait là où sa main monte le plus haut, et sur la vidéo de la friperie sa main est à droite (64 %). Il est maintenant à la hauteur de sa main, et en largeur aussi près du milieu que son doigt reste dessus (son doigt à 42 % de sa largeur de son centre au plus) : ici, à 52 % de la largeur.
