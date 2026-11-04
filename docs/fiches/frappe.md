# « Lieu tapé lettre à lettre » (`frappe`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps.

**L'original** : `house/originals/frappe.mp4`, 13,35 s, 720 × 406, 30 i/s, **horizontal 16:9** montré tel quel (des bandes noires dans un fil vertical), avec son.
**Sa musique** : un beat lo-fi hip-hop, **82,4 BPM** (un temps toutes les 0,727 s, le premier à 0 s ; la pulsation mesurée, 164,75, en est la croche ; Gemini disait 95 : faux). Caisse claire sur chaque temps pair (1,42 · 2,89 · 4,31 · 5,80 · 7,24 · 8,71 · 10,13 · 11,56 s), un roulement de 11,56 à 12,48 s.
**Mesuré avec** : `scripts/fiche/measure.py` (coupes, clignotements, tempo), des planches à 30 i/s de chaque passage, et la lecture de Gemini (`house/breakdowns/frappe.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 1,60 | 0 – 2,2 | Plan large ensoleillé du lieu (une jetée, sa grande roue, la foule), la caméra avance un peu | — |
| 1,60 – 1,73 | 2,2 – 2,4 | **Zoom rapide** de 4 images (46 à 51) vers le même lieu, plus serré | Refait en coupe franche (Tristan trouve les zooms en transition cheap) ; à confirmer avec lui |
| 1,73 – 4,87 | 2,4 – 6,7 | Plan serré : l'enseigne « PACIFIC PARK » devant la grande roue, la caméra avance lentement | **Allumage lettre par lettre** de 3,20 à 4,10 s, puis **tout s'allume d'un coup** à 4,33 s (voir Effets) |
| 4,87 – 7,87 | 6,7 – 10,8 | Plan fixe : du ciel à côté d'un bâtiment | **Nom tapé** « IN-N-OUT » de 5,47 à 7,17 s, puis **son logo se dessine** de 7,40 à 7,87 s |
| 7,87 – 8,40 | 10,8 – 11,55 | Le restaurant de nuit, son enseigne allumée à l'endroit où le nom était tapé (**raccord**) | **Clignotement** de ses auvents et de son enseigne à 8,03 s (3 images) |
| 8,40 · 8,60 · 8,77 | 11,55 · 11,8 · 12,05 | Trois plans éclair de 0,2 · 0,17 · 0,2 s | — |
| 8,97 – 10,17 | 12,3 – 14 | Plan large : la foule d'un stade qui agite des drapeaux | — (ce qui bouge, ce sont les drapeaux : pas un effet) |
| 10,17 – 11,60 | 14 – 16 | Une façade de face | **Bandes de cinéma** qui se ferment vers 10,9 s (2,35:1), gardées jusqu'à la fin |
| 11,60 – 12,60 | 16 – 17,3 | **Rafale** de six plans de 5 images entre les bandes, sur le roulement de caisse claire | Le premier : un passant au premier plan **flashe en blanc** 2 images |
| 12,60 – 13,35 | 17,3 – 18,4 | Noir | — |

## Effets (ce qu'on veut savoir refaire)

### 1. Allumage morceau par morceau
- **Mesuré** : les lettres de l'enseigne s'allument une à une, de gauche à droite, chacune 2 ou 3 images, la précédente éteinte quand la suivante s'allume (P 96–98, A 99–100, C 101–103, I 104–105, F 106–108, I 109–110, C 111–113, P 114–115, A 116–118, R 119–120, K 121–122) : 11 lettres en 27 images (0,9 s, environ un seizième de temps chacune), à partir du temps 4,4. Une lettre allumée devient crème (≈ #FFF3D9) avec un léger halo. Puis tout est éteint 7 images (123 à 129).
- **Sur quoi** : l'enseigne de l'original. Dans ses vidéos à elle : **les morceaux de ce qui peut s'allumer** dans son plan : les lettres de son enseigne, les carreaux d'une fenêtre, chaque fenêtre d'une façade (« every window »), les ampoules d'une guirlande, des lampes.
- **Outil** : nouveau, `SubjectParts` (les morceaux d'un objet suivi, dans l'ordre de lecture ; un objet d'un seul tenant coupé en tranches) avec `Subject object=…` (sa découpe, éclaircie, posée dans la boîte de chaque morceau). Le nom de l'objet est choisi pour son plan par le remplisseur du modèle (ce qu'il voit dans la lecture de sa vidéo).
- **Si rien ne s'y prête** : pas d'allumage morceau par morceau ; l'effet 2 reste (les lumières du plan).

### 2. Tout s'allume d'un coup, sur le temps
- **Mesuré** : à 4,33 s (images 130 à 135, 6 images ; le temps 6, sur la caisse claire), toute l'enseigne allumée et les nacelles de la grande roue qui brillent, puis tout s'éteint.
- **Sur quoi** : le même objet entier, et les parties claires du plan qui rayonnent.
- **Outil** : `Subject object=…` éclairci (existant) et une copie du plan éclaircie et floutée posée en « screen » sur ses parties claires (code du modèle).
- **Si rien ne s'y prête** : seules les parties claires du plan rayonnent.

### 3. Clignotement de nuit
- **Mesuré** : 0,17 s après la coupe sur le restaurant de nuit (images 241 à 243, 8,03 à 8,10 s), ses auvents rouges et son enseigne s'allument fort 3 images.
- **Sur quoi** : l'enseigne ou les lumières de sa devanture, de nuit ou éclairée.
- **Outil** : comme l'effet 2, sur ce plan (un second objet nommé).

### 4. Son nom tapé dans le ciel
- **Mesuré** : « IN-N-OUT » tapé caractère par caractère (les traits d'union aussi), de 5,47 à 7,17 s : un caractère toutes les 6 images environ, avec deux pauses plus longues (11 images avant le second trait d'union, 10 avant la dernière lettre) : une frappe à la main, pas une machine. Capitales géométriques extra-grasses, rouge orangé #FF2B00, un liseré clair fin et une ombre douce ; le bord gauche à 38,8 % de la largeur, le haut à 34,3 % de la hauteur, hauteur des capitales 5,8 % de l'image ; posé dans le ciel, là où l'enseigne sera au plan suivant.
- **Sur quoi** : un plan avec du ciel ou un mur dégagé.
- **Outil** : code du modèle (comme TypeOn) ; le rythme de frappe avec ses deux pauses.

### 5. Son logo qui se dessine, et le raccord sur son enseigne
- **Mesuré** : de 7,40 à 7,87 s, une flèche jaune #FFCC00 se dessine trait par trait autour du nom (de sous le nom, vers le haut, puis par-dessus vers la droite) ; la coupe tombe sur l'enseigne réelle au même endroit de l'image.
- **À l'original, jamais recopié** : cette flèche est le logo d'In-N-Out, et le rouge orangé et le jaune sont ses couleurs (Tristan, de la flèche redessinée sur le nom d'un bar : « le symbole à la fin a été repris mais fait partie d'un visuel spécifique à la vidéo originale »). L'effet, c'est « son logo à elle apparaît autour de son nom ».
- **Outil** : son logo (balayé) quand elle en a un, sinon rien ; son nom dans sa couleur ; le raccord tient à ce qu'elle filme (son enseigne dans le haut de l'image).

### 6. Trois plans éclair, une rafale entre des bandes de cinéma, un passant qui flashe en blanc
- **Mesuré** : voir le déroulé ; les bandes se ferment en 0,25 s environ (2,35:1) ; le passant flashe 2 images au début de la rafale.
- **Outils** : coupes du modèle, bandes (code du modèle ou `Letterbox`), `Subject fill="#ffffff"` (sa silhouette en blanc).

### 7. Étalonnage
Teal and orange : ciels cyan, peaux et enseignes orangées, chaud et saturé, contrasté.

## Format
L'original est une vidéo horizontale 16:9 montrée telle quelle. Réglage « format » : `auto` (horizontal quand la plupart de ses vidéos le sont, sinon vertical plein écran), `horizontal` (16:9 sur du noir, comme l'original), `vertical` (plein écran, chaque place en part de l'image).

## Ce que Gemini a vu, et ce qu'il a raté
Vu : le découpage, le nom tapé, sa couleur et sa place, la flèche jaune, les bandes, le passant blanc, l'étalonnage. Raté : le **tempo** (95 au lieu de 82,4), l'**allumage lettre par lettre** de l'enseigne (3,20 – 4,10 s), le **zoom rapide** à 1,6 s (pris pour une coupe), le **clignotement de nuit** (8,03 s).

## Ce que le modèle v1 ratait
Il jouait tout en vertical, à 95 BPM, sans aucune lumière (ni allumage, ni flash, ni clignotement), un nom tapé à intervalles réguliers, sans logo dessiné ni bandes.

## Ce qu'il faut filmer
Un plan large de son lieu en plein jour ; son enseigne de près (des lettres séparées ou un néon, c'est mieux) ; un plan fixe avec du ciel ou un mur dégagé à côté d'un bâtiment ; sa devanture de nuit ou éclairée, l'enseigne dans le haut de l'image ; des détails ; un plan large et vivant ; une façade de face ; un plan avec un passant au premier plan.
