# « Vision machine » (`vision`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique (155 BPM, un temps toutes les 0,387 s) depuis son premier temps, à 0,05 s (reporté en arrière : le bip ne devient régulier qu'à 0,79 s).

**L'original** : `house/originals/vision.mp4`, 8,52 s (255 images), 720 × 1280, 30 i/s, **vertical 9:16**, plein cadre, avec son. Un seul plan : une place pavée filmée de haut (en plongée), caméra fixe, un homme qui lit son journal sur un banc au milieu, une quinzaine de passants autour. Tout le Reel est ce plan passé dans une dizaine de « regards de machine » qui se relaient en clignotant. Le modèle prend tout le Reel (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : ni batterie ni mélodie. Un bip aigu tenu (1 229 à 1 234 Hz, un ré dièse un peu bas, avec ses harmoniques à 2,46, 3,69 et 4,92 kHz), relancé à chaque temps : une coupure de 20 ms toutes les 0,387 s, régulière à 27 ms près de 0,79 à 5,44 s, soit **155 BPM** (sûr à 1 BPM près ; 77,6 si on compte un temps tous les deux bips, pour un skill qui compte entre 60 et 140). Dessous, un grondement très grave (surtout entre 20 et 80 Hz) et un souffle qui crépite. Au début, un accord de bips (vers 0,5, 1, 1,6 et 10 kHz) coupé net sur le premier noir (0,11 s), un souffle qui descend, puis le bip qui hoquette (0,13 à 0,58 s) avant de tenir. À 5,44 s (temps 14), il est relancé deux fois par temps ; de 7,38 à 7,65 s, il bégaie (trois coupures de 70 à 80 ms) ; il se tait à 8,27 s. Très compressé : −14,1 LUFS, 0,4 LU d'écart. Gemini disait « tempo non mesurable », `measure.py` 119 BPM : faux tous les deux (le souffle grave trompe le second).
**Mesuré avec** : `scripts/fiche/measure.py` (coupes, clignotements, tempo), des planches à 30 i/s de tout le Reel, des mesures au pixel (cadres, étiquettes, couleurs, trames, part de l'image montrée pendant les dalles), le spectre et l'enveloppe du bip, et la lecture de Gemini (`house/breakdowns/vision.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,37 | −0,1 – 0,8 | L'homme et son banc seuls sur blanc, dans leurs cadres : bleu (image 0), noir à points (1), bleu (2), noir (3 à 5), noir à points (6), l'homme noir et le banc bleu (7), noir (8 à 10) | **Cadres qui clignotent** (3), noirs (10) |
| 0,37 – 0,47 | 0,8 – 1,1 | Le même, seul sur blanc, tel que filmé (3 images) | **Le sujet seul** (1) |
| 0,47 – 1,20 | 1,1 – 3 | La place se construit dalle par dalle autour de lui ; presque tout le sol d'un coup à 0,70 s ; les ouvertures du fond restent blanches | **Dalle par dalle** (1) |
| 1,20 – 3,63 | 3 – 9,3 | Premier clignotement : 23 passes de 1 à 8 images, dont 6 noirs (détail dessous) | (1) à (3), (5), (6), (8) à (10) |
| 3,63 – 3,90 | 9,3 – 10 | Le graphe seul sur blanc : un point par passant, des fils, des codes binaires (8 images) | **Le graphe** (7) |
| 3,90 – 4,53 | 10 – 11,6 | Les passants apparaissent dans leurs cadres sur le graphe, sur blanc (19 images : la plus longue passe) | (7) |
| 4,53 – 7,23 | 11,6 – 18,6 | Second clignotement, plus serré : 24 passes, dont 3 noirs ; de 5,47 à 6,07 s, une passe toutes les 2 images, quand le bip double ; toute la place en caractères à 6,70 s | (2), (3), (6) à (10) |
| 7,23 – 8,03 | 18,6 – 20,7 | La place s'efface dalle par dalle, du fond vers lui, jusqu'à l'homme et son banc seuls (24 images) | **Effacement** (2) |
| 8,03 – 8,20 | 20,7 – 21,1 | L'homme et son banc en caractères clairs sur noir (5 images) | (8) |
| 8,20 – 8,52 | 21,1 – 21,9 | Noir (9 images) ; le son se tait 2 images après | — |

Passe par passe (image de départ, puis nombre d'images ; les noms sont ceux des effets) :
- **Premier clignotement** : 36 noir (2) · 38 réseau (1) · 39 place (2) · 41 cadres (4) · 45 sujet (2) · 47 points (2) · 49 place (4) · 53 noir (3) · 56 profondeur (3) · 59 noir (4) · 63 profondeur (5) · 68 caractères (1) · 69 réseau (1) · 70 caractères, ses dalles qui partent (7) · 77 noir (2) · 79 place (1) · 80 sujet cadré (2) · 82 réseau (1) · 83 cadres (7) · 90 sujet cadré (8) · 98 noir (1) · 99 place, son fond qui blanchit (5) · 104 noir (5).
- **Second clignotement** : 136 sujet cadré (4) · 140 réseau (6) · 146 caractères (5) · 151 noir (3) · 154 cadres (7) · 161 sujet cadré (3) · 164 place (2) · 166 dalles (4, deux états) · 170 cadres (2) · 172 réseau (2) · 174 points (2) · 176 dalles (2) · 178 cadres (2) · 180 réseau (2) · 182 caractères, avec les cadres (1) · 183 noir (3) · 186 caractères, ses dalles qui reviennent (10) · 196 graphe (2) · 198 noir (2) · 200 points (1) · 201 caractères de toute la place (5) · 206 points (4) · 210 place, son fond qui blanchit (4) · 214 points (3).

## Effets (ce qu'on veut savoir refaire)

### 1. Le sujet seul sur blanc, puis le lieu qui se construit dalle par dalle autour de lui
- **Mesuré** : de 0,37 à 0,47 s (images 11 à 13), l'homme et son banc détourés seuls sur un blanc pur (#FDFDFD), tels que filmés, sans bord ni ombre. Leur boîte va de 21 à 78,5 % de la largeur et de 55,4 à 71,1 % de la hauteur : centrée en largeur, à 63 % de la hauteur. À l'image 14, les dalles autour du banc arrivent une ou deux à la fois, la moitié d'un coup, les autres en fondu depuis le blanc en 2 à 4 images. La part de l'image montrée passe de 3,3 à 12 % en 7 images, puis à 54 % d'un coup à 0,70 s (image 21 : presque tout le sol), 67 % à l'image 28, 80 % quand le bâtiment arrive (29 à 31), 93 % à l'image 35 ; les ouvertures des arcades, au fond, restent blanches. Ce sont les vraies dalles du sol, en perspective : près du banc, environ 11 à 12 % de la largeur sur 3,5 à 5,5 % de la hauteur. Un passant arrive avec la dalle où il marche, pâle tant qu'elle l'est. L'homme ne bouge pas : il est au même endroit dans toutes les passes, c'est l'ancre du Reel.
- **Sur quoi** : dans ses vidéos à elle, celui ou celle qui reste immobile au milieu (elle au comptoir, une cliente dans le fauteuil, la prof sur son tapis, quelqu'un qui lit à une table) avec la chose sur laquelle il est (le comptoir, le fauteuil, la table) ; et le sol autour (carrelage, dalles, parquet).
- **Outil** : `Subject shot={n}` (la personne) et `Subject object="…"` (son banc : « counter », « barber chair ») posés sur du blanc (existants) ; les dalles par `Tiles` (existant : `reveal: "fade"` en 2 images, `wave: "center"`, environ 8 colonnes de cases plus larges que hautes), son plan dans les cases, le blanc dessous. Manquent : **des cases qui suivent son sol** (en perspective, plus petites et plus plates vers le haut) et **une vague qui part de son sujet** (aujourd'hui elle part du centre du cadre).
- **Si rien ne s'y prête** : des cases droites depuis le centre ; personne d'immobile : son sujet principal, ou un objet nommé.

### 2. Le lieu qui s'efface en blanc, du fond vers lui
- **Mesuré** : de 7,23 à 8,03 s (images 217 à 240), l'inverse : les dalles repassent au blanc une ou deux à la fois, les plus lointaines d'abord (les deux tiers d'un coup, les autres en fondu de 2 à 4 images). La part montrée descend régulièrement de 60 à 5,9 % (environ 2,3 % par image), jusqu'à l'homme, son banc et deux ou trois dalles ; puis une coupe sur noir, sans fondu. Ce départ est annoncé deux fois : de 3,30 à 3,47 s (99 à 103) et de 7,00 à 7,13 s (210 à 213), le fond (les ouvertures des arcades, le bâtiment, le haut du sol) passe au blanc par grands morceaux, et les passants qui y sont deviennent des fantômes pâles avant de disparaître. L'état de la fin des dalles (le fond encore blanc) revient en éclair dans les clignotements (32–35, 39–40, 49–52, 164–165), et l'effacement lui-même deux fois (166–169, 176–177).
- **Sur quoi** : le même plan ; le fond de sa salle, la rue derrière sa vitrine.
- **Outil** : `Tiles` vers le blanc avec `wave: "top"` (existant : dans un plan en plongée, le haut est le fond). Manque : **l'effacement par la profondeur** : ce qui est plus loin qu'un seuil passe au blanc, découpé à chaque image (le `Subject near` déjà noté dans la fiche `decode`, pris à l'envers).
- **Si rien ne s'y prête** : les cases du haut vers le bas.

### 3. Un cadre sur chaque passant, qui clignote entre bleu et noir à points
- **Mesuré** :
  - Sur la place (« cadres » : 1,37 à 1,47 s, 2,77 à 3,00 s, 5,13 à 5,37 s, et 2 images à 5,67 et 5,93 s) : chaque passant (12 à 16 cadres à la fois, les lointains aussi ; deux qui marchent ensemble dans un seul cadre) et les bancs ont un cadre serré qui les suit. Dans chaque cadre, l'un de deux regards, tiré au hasard à chaque image et pour chaque cadre : (a) l'image du cadre en deux tons de bleu, le sol compris, qui gardent sa lumière (le noir devient #142754, les gris moyens #475C88, les clairs #AABCDD, le blanc #C8D6EF), sans trait autour ; (b) le cadre noir (#07070E), la personne redessinée en points clairs (voir 8). Autour, la place reste telle que filmée.
  - Sur le sujet seul sur blanc (« sujet cadré » : 0 à 2, 6–7, 80–81, 90–97, 136–139, 161–163) : l'homme et le banc ont chacun un cadre au trait gris de 1 px (#A0A0A0, sur 720) ; seul leur détourage passe en bleu (le cadre reste blanc), ou leur cadre devient noir à points ; chacun change de son côté (le banc bleu, l'homme noir).
  - Au-dessus du coin gauche de chaque cadre, une étiquette (voir 4).
- **Sur quoi** : les gens de son lieu (les clientes qui entrent, passent, s'assoient), celui ou celle qui reste immobile, et ce qui compte dans le lieu (le comptoir, les fauteuils, un vélo).
- **Outil** : `Detect` existe (des cadres qui suivent les gens, leur étiquette, des liens), mais il ne voit que deux corps au plus (le suivi MediaPipe, `num_poses=2`, qui voit mal aussi les petits passants lointains). Manque : **chaque personne suivie à part** : le suivi d'objets « every person » (12 au plus) qui donnerait à chaque image la boîte de chacun, et trouverait ceux qui entrent pendant le plan ; aujourd'hui il donne un seul détourage de tous, et leurs boîtes seulement sur l'image où ils ont été trouvés (`SubjectParts` les replace ensuite sur la boîte d'ensemble). Les deux tons de bleu : code du modèle (une `Window fit="cut"` par cadre, avec un filtre SVG en deux couleurs) ; `Subject tint` multiplie et laisse le noir noir : pas pareil. Les points : voir 8.
- **Si rien ne s'y prête** (une ou deux personnes) : les cadres sur elle et sur les objets nommés de son lieu ; ce qui ne bouge pas (« every chair », « every lamp ») se suit déjà, chacun à sa place.

### 4. Des étiquettes qui perdent leurs lettres
- **Mesuré** : sur chaque étiquette, le même mot, « REPROGRAMMING », dont des lettres manquent au hasard, remplacées par un blanc ou un signe (« · », « ? », « < », « > », « / ») : « R PROGRA », « REPR GR MMING », « RE·ROGRAMMING », « <PG ». Elles changent à chaque image et d'une étiquette à l'autre. Capitales blanches d'une mono pixel à empattements (laquelle : pas clair), sur un aplat bleu nuit (#243250) dans « cadres » et « sujet cadré », noir dans le réseau et sur le graphe. Toute petite : 10 à 11 px de haut sur 1 280 (0,8 %), des capitales de 0,45 % (9 px en 1920), 7 à 9 % de la largeur pour le mot entier. Celle du banc : de 21 à 30,4 % de la largeur, à 60,1 % de la hauteur. C'est un décor : on devine un mot, on ne le lit pas.
- **Sur quoi** : son mot à elle (le nom de son lieu, ce que dit le Reel : « OUVERTURE », « BRUNCH ») sur toutes les étiquettes.
- **Outil** : `Detect label` (existant : un mot fixe et un score inventé). Manque : **les lettres qui tombent au hasard à chaque image** (une option de `Detect`, ou code du modèle).

### 5. La profondeur en gris
- **Mesuré** : de 1,87 à 1,97 s (56 à 58) et de 2,10 à 2,27 s (63 à 67) : la carte de profondeur, le proche en blanc. L'homme et son banc gris clair (≈ 210 sur 255), juste derrière eux du noir, le bas du cadre blanc (253), les coins du haut gris. C'est la profondeur du sujet détouré sur blanc (d'où le dôme noir derrière lui) ; une dalle y apparaît à l'image 67.
- **Sur quoi** : n'importe lequel de ses plans.
- **Outil** : `Depth shot={n}` (existant), ici sur son plan entier (c'est aussi le fond du réseau, 6).
- **Si rien ne s'y prête** (pas de profondeur : une photo, pas de carte graphique) : un noir à la place.

### 6. Le réseau : la profondeur en fond, les passants dans leurs cadres, reliés par des fils
- **Mesuré** : à 1,27 s (38), 2,30 (69), 2,73 (82), de 4,67 à 4,83 (140 à 145), à 5,73 (172–173) et 6,00 s (180–181). En fond, la profondeur de toute la place, aux noirs levés (≈ 15 à 60 en haut, 80 au milieu, 210 en bas ; le passant le plus proche y est une silhouette blanche). Dessus, chaque passant dans son cadre, tel que filmé (en couleur, avec le sol derrière lui), un trait noir de 2 px (sur 720), son étiquette noire. Des fils gris clair (≈ #C8C8C8, 1 px), un peu courbes comme des câbles, partent des coins de chaque cadre vers plusieurs autres et convergent vers les passants les plus lointains, en haut : une toile, pas une chaîne.
- **Sur quoi** : son lieu avec du monde (une salle, une boutique, un cours).
- **Outil** : `Depth` (existant), une `Window fit="cut"` par cadre (existant), et les cadres de chacun (manque, voir 3). Manque aussi : **des liens en toile** (chaque cadre relié à ses deux ou trois voisins et aux plus lointains ; les `links` de `Detect` font une seule chaîne, d'un cadre au suivant de gauche à droite).
- **Si rien ne s'y prête** : la profondeur seule, avec le cadre de son sujet.

### 7. Le graphe seul, puis les passants qui y apparaissent
- **Mesuré** : de 3,63 à 3,90 s (109 à 116, 8 images) et à 6,53 s (196–197) : sur blanc (#FBFDFA), un point gris foncé (≈ 8 px sur 720, 1,1 % de la largeur) pour chaque passant, à sa place, qui bouge avec lui. De nombreux fils gris (1 px, ≈ #C8C9C6 ; quelques-uns plus foncés, de 2 px) les relient en courbes. À côté de 4 à 6 points, un code binaire en toute petite mono gris foncé (« 0000000000001010 00000000 11101000 10001101 » : 16, 8, 8 et 8 chiffres ; 25 % de la largeur, capitales de 0,4 %). Puis de 3,90 à 4,53 s (117 à 135, 19 images, la plus longue passe), les passants apparaissent dans leurs cadres sur ce graphe (tels que filmés, trait noir de 2 px, étiquette noire), sur le blanc ; ils marchent dans leurs cadres, qui les suivent.
- **Sur quoi** : les gens de son lieu (comme 3).
- **Outil** : pas d'outil tel quel, mais du code du modèle à partir des cadres de chacun (le manque de 3) : des cercles et des courbes SVG, des codes tirés par `random` ; les cadres sur blanc : `Window fit="cut"` (existant).
- **Si rien ne s'y prête** : les points sur ce qui se répète dans son lieu (« every chair », « every table »).

### 8. L'image redessinée en caractères, clair sur noir
- **Mesuré** : l'homme et son banc avec leurs dalles (68, 70 à 76, 146 à 150, 182, 186 à 195, 241 à 245) et une fois toute la place (201 à 205, de 6,70 à 6,87 s), redessinés en minuscules caractères façon ASCII, clairs sur noir : des cases d'environ 2,7 × 5,3 px sur 720 (4 × 8 px en 1080), trop petites pour se lire. La pierre, pleine de détails, devient un semis dense ; les manteaux sombres restent noirs ; le fond est noir et le bâtiment s'y dessine à 204–205. Ses dalles partent (70–76) ou reviennent (186–195) comme en 1 et 2 ; à 182, les cadres du sujet y sont aussi. La même trame, en points (≈ 3 × 7 px sur 720), remplit les cadres noirs de 3.
- **Sur quoi** : n'importe quel plan ; ce qui a de la matière (un sol en pierre, un mur, un tissu, des étagères pleines) donne le plus.
- **Outil** : manquant, **une passe en caractères** : l'image redessinée en petits caractères (ou en points) selon sa lumière, clair sur noir ou sombre sur blanc, sur un plan, un détourage ou une case. Le plus proche aujourd'hui : `Sketch invert={false}` (des traits clairs sur noir : les contours, pas la matière).
- **Si rien ne s'y prête** : `Sketch invert={false}`.

### 9. Les passants en points
- **Mesuré** : à 1,57 s (47–48), 5,80 (174–175), 6,67 (200), de 6,87 à 6,97 (206 à 209) et de 7,13 à 7,20 s (214 à 216) : sur blanc, les gens seuls (l'homme du banc compris, sans son banc), en points gris foncé de 2 à 3 px (sur 720), serrés sur leurs contours et épars dedans : un nuage de points. Ni sol ni banc.
- **Sur quoi** : les gens de son plan.
- **Outil** : en partie existant : `Sketch` (traits sombres sur blanc) autour de `Subject shot={n} object="every person"` (tous les passants détourés ensemble) posé sur du blanc donne leurs contours en traits ; des points au lieu des traits : un masque de points (code du modèle). Ceux qui entrent pendant le plan : le même manque qu'en 3.
- **Si rien ne s'y prête** : elle seule (`Subject shot={n}`), en points.

### 10. Le clignotement des passes, et les noirs
- **Mesuré** : 71 changements en 8,5 s. Une passe tient le plus souvent 1 ou 2 images, 3,5 en moyenne ; plus longues : le graphe et le sujet cadré (8), les caractères qui reviennent (10), les passants sur le graphe (19), les dalles (22 et 24). Uniquement des coupes franches : ni zoom, ni fondu, ni flash blanc, et la caméra ne bouge jamais (rien de ce que Tristan trouve cheap). 11 noirs purs (#000) de 1 à 5 images avant la fin (31 images, 12 % du Reel), puis 9 images de noir final. Les coupes rapides ne suivent pas les temps (mesuré : pas mieux que le hasard, à aucun tempo). Ce qui tombe avec la musique : le premier noir sur la fin de l'accord (0,10 s), le premier clignotement sur le temps 3, les cadres sur blanc sur le temps 10, les passes de 2 images (5,47 à 6,07 s) quand le bip double (temps 14), le noir final sur le temps 21. Sa vidéo est à 24 i/s (une image sur cinq doublée là où seule la vidéo change : 121, 126, 131) ; de 1,30 à 1,77 s et de 5,47 à 6,07 s, chaque image est tenue 2 images (15 i/s). Chaque passe garde son propre temps : les passants ne sont pas au même endroit d'une passe à l'autre (des rendus séparés du même plan, montés ensuite).
- **Outil** : code du modèle (l'enchaînement des passes, image par image), avec les outils ci-dessus ; `Footage at={…}` pour qu'une passe reprenne un autre moment du plan, `Footage hold={2}` pour les images tenues (existants) ; un noir : rien à dessiner.

### 11. Étalonnage
Le plan est laissé tel que filmé par temps gris : peu de couleur (saturation moyenne de 0,09 à 0,12), noirs profonds un peu bleus (#0B0F15), gris neutres (#7F8182), clairs #C7C8C9. Les blancs des passes sont purs (#FDFDFD, à peine vert pour le graphe et les points, #FBFDFA). Pas de grain qui bouge (deux images de suite identiques sur les parties fixes), pas de vignettage. La seule couleur ajoutée : le bleu des cadres.

## Format
L'original est vertical (720 × 1280), filmé en vertical, de haut, caméra fixe. Tout se joue dans le plein cadre : les fonds blancs et noirs, les dalles, le graphe. Réglage « format » :
- `vertical` (l'original, par défaut) : son plan vertical plein cadre.
- `auto` : vertical ; un plan en largeur est recadré sur son sujet immobile, gardé au milieu du cadre.
- `horizontal` : son plan en largeur dans une bande 16:9 au milieu, sur le blanc des passes (le sujet seul, les dalles, les cadres et le graphe y jouent ; les noirs et les caractères de toute la place en plein cadre). L'original n'en a pas : à voir avec Tristan.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, la place en plongée et l'homme sur son banc, la place qui se construit par dalles et qui s'efface à la fin, les cadres bleus et noirs qui suivent les passants, la profondeur, le graphe et ses codes binaires, les caractères sur noir, les passants en points, le mot « REPROGRAMMING » et la place de l'étiquette du banc (20,5 % · 60 % ; mesuré 21 % · 60,1 %), le peu de couleur.
**Raté** :
- la **musique** : « tempo non mesurable » ; le bip est relancé toutes les 0,387 s (155 BPM), double à 5,44 s et bégaie à 7,38 s. Son « changement de fréquence à 3,6 s » n'existe pas (le bip reste entre 1 229 et 1 234 Hz du début à la fin) ;
- les **11 noirs** et le passage où chaque passe tient 2 images (5,47 à 6,07 s) ;
- le **bleu** : il dit #3366CC semi-transparent ; ce sont deux tons de bleu qui gardent la lumière de l'image, et chaque cadre passe du bleu au noir à points à chaque image ;
- les **lettres qui tombent** des étiquettes (il lit « REPROGRAMMING » partout) ;
- le **fond du réseau**, qui est la profondeur de la place, et les passants qui ne sont pas au même endroit d'une passe à l'autre ;
- la **fin** : pas de fondu au noir, une coupe sur le sujet en caractères, puis le noir ;
- le **grain** : il dit « grain numérique fin » ; il n'y en a pas.

## Ce que le modèle v1 ratait
Il n'a pas encore de skill ; sa lecture (`house-models.ts`) se trompait sur presque tout, et une version doit corriger ceci :
- **Tempo et musique** : 120 au lieu de 155 (77,6 en temps lents), et « des clics précis » au lieu d'un bip tenu relancé à chaque temps sur un grondement grave, qui double au temps 14 et se tait au temps 21.
- **Texte** : « un mot ou un chiffre en sans serif très grasse qui se décode » : l'original n'a aucun titre. Ses seuls mots sont les étiquettes qui perdent leurs lettres et les codes binaires, minuscules, en décor. Un titre, si elle en veut un, est un ajout.
- **Forme** : trois moments en 1,4 s (cadres sur le vrai plan, gens teintés seuls sur blanc, plan au trait). L'original enchaîne dix passes en 8,5 s, en clignotant : le sujet seul, les dalles, les cadres, la profondeur, le réseau, le graphe, les caractères, les points, les noirs, l'effacement. « Épuré » ne va pas : c'est un stroboscope de coupes franches.
- **Le bleu** : « les personnes détourées teintées de bleu » ; ce sont les cadres qui sont bleus (le sol dedans aussi), ou noirs à points, et ça change à chaque image. Seul le sujet sur blanc a son détourage teinté.
- **« Le plan redessiné en traits noirs sur blanc »** : ce sont des caractères clairs sur noir, et les gens en points sur blanc.
- **La fin** : « le plan au trait, les cadres reliés » ; c'est la place qui s'efface dalle par dalle jusqu'au sujet seul, le sujet en caractères, puis le noir.
- **Ce qu'il lui faut** : « une vidéo fixe d'un lieu où des gens passent » ; il faut aussi la hauteur (un plan en plongée) et quelqu'un d'immobile au milieu. Un plan suffit (toutes les passes en viennent).

## Ce qu'il faut filmer
- Un seul plan fixe de 5 à 10 s (téléphone posé, ou tenu très immobile), filmé de haut sur son lieu : depuis une mezzanine, un escalier, un premier étage, une échelle.
- Au milieu, quelqu'un qui ne bouge pas (elle au comptoir, une cliente dans le fauteuil, quelqu'un qui lit à une table), et autour des gens qui passent, près et loin.
- Un sol où se voient des carreaux, des dalles ou des lattes : ce seront les dalles.
- Une lumière égale (un jour gris va très bien), aucun mouvement de caméra.
