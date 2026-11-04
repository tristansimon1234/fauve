# « Écran partagé titré » (`ecran-partage`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte une grille de 120 BPM partie de 0 s, celle de ses coupes (sa musique n'a pas de tempo tenu : voir plus bas).

**L'original** : `house/originals/ecran-partage.mp4`, 12,77 s (383 images), 720 × 540, 30 i/s, **horizontal 4:3** : une carte aux coins arrondis sur du noir, coupée en deux moitiés verticales 2:3 côte à côte, avec son. Monté à 25 i/s (une image sur six est doublée dans la copie à 30 i/s). Le modèle prend tout l'original (pas de passage).
**Sa musique** : instrumentale et lente, des notes tenues (cordes ou clavier), des arpèges rapides par-dessus (chaque temps en trois notes de 0,16 s) et une basse tenue qui entre à 4,55 s. **Sans batterie** : 6 % seulement de l'énergie est percussive, aucune frappe au-dessus de 6 kHz. Aucun bruitage. **Pas de tempo tenu** : un temps toutes les 0,48 s en moyenne (≈ 124 BPM), mais de 0,45 à 0,56 s selon le moment, qui s'étire vers 4,5 s et vers 9 s ; le meilleur tempo fixe n'aligne que 4 attaques sur 10. Elle commence sur sa première note (0,11 s) et finit coupée net. Gemini disait 80 BPM et « un beat hip-hop doux », le catalogue (`house-measures.ts`) 155 BPM : faux tous les deux.
**Le montage**, lui, suit une grille de **0,5 s (120 BPM)** : comptées depuis 0 s, trois coupes tombent sur ses demi-temps (4,5 · 11,5 · 15,5) à une demi-image près, la 4e à 21,3 (2,5 images avant 21,5) ; les paires durent 4,47 · 7,0 · 4,0 · 5,87 · 4,2 temps. Une seule coupe tombe sur une note forte (5,73 s). Sûr pour l'absence de batterie et de tempo tenu ; la grille de 0,5 s est peut-être un hasard.
**Mesuré avec** : `scripts/fiche/measure.py` (coupes, tempo, clignotements), puis chaque moitié mesurée à part (ses coupes, ses mouvements, sa vitesse), des planches à 30 i/s de chaque passage, des gros plans du partage, des coins et des titres, l'analyse du son par bandes (attaques, notes, part percussive), et la lecture de Gemini (`house/breakdowns/ecran-partage.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 2,23 | 0 – 4,5 | Gauche : un chef en toque, de dos, à son poste, caméra fixe. Droite : vue du dessus d'une table en bois rayée de lumière ; une cocotte entre par le bas (images 4 à 32, 0,13 à 1,07 s), ralentit et se pose au centre | La carte et ses deux titres dès la 1re image (1, 5) ; le plat qui entre (4) |
| 2,23 – 5,73 | 4,5 – 11,5 | Gauche : un chef penché sur le passe, qui dresse à la cuillère. Droite : un plat en gros plan ; des doigts y plantent une tuile en dentelle en forme de feuille (de 2,33 à 5,0 s), puis la main sort (5,17 s) | Les deux moitiés coupent sur la même image (2) |
| 5,73 – 7,73 | 11,5 – 15,5 | Gauche : un chef en gros plan, pris d'en bas, une petite tasse à la main ; la caméra bouge un peu avec lui. Droite : un risotto aux crevettes ; des flocons tombent dessus à vitesse réelle, de 6,0 s à la coupe | Le même geste des deux côtés (3) ; la coupe tombe sur une note forte |
| 7,73 – 10,67 | 15,5 – 21,3 | Gauche : plan large et fixe du passe, un chef dresse, un autre derrière. Droite : sur la table rayée de lumière, une assiette (couronne de tomates, burrata) entre par le bas, déjà en mouvement à la coupe, posée 0,9 s après ; la main qui la tient repart vers 9,4 s | Le plat qui entre (4) |
| 10,67 – 12,77 | 21,3 – 25,5 | Gauche : des mains et une poêle dans une lumière vert-bleu ; elles font sauter les légumes à 12,4 s. Droite : une assiette de poisson dans un bouillon orangé entre par le bas à gauche (0,7 s), la main repart vers 12 s | Le plat qui entre (4) ; fin nette, sans carte de fin ni logo |

Rien ne clignote, rien ne s'allume, aucun flash, aucun noir : les « clignotements » de `measure.py` sont des plats qui entrent, une main, des flocons et le reflet de la hotte (paire 3).

## Effets (ce qu'on veut savoir refaire)

### 1. La carte coupée en deux
- **Mesuré** : une carte aux coins arrondis (rayon ≈ 20 px sur 720, 2,8 % de sa largeur) posée sur du noir pur, immobile du début à la fin. Marges noires : 0,9 % de la largeur sur les côtés, 1,8 % de la hauteur en haut, 1,5 % en bas. Une ligne verticale droite la coupe, sans espace ni trait : les deux moitiés se touchent, coins carrés au milieu. Chaque moitié fait 2:3 (348 × 522 px), la carte 4:3. Le partage ne bouge pas pendant une paire, mais change de quelques pixels d'une paire à l'autre (49,2 · 49,2 · 52,1 · 48,8 · 49,1 % de la largeur) : fait à la main, pas un effet ; le modèle le garde à 50 %.
- **Sur quoi** : deux vidéos d'elle, n'importe lesquelles.
- **Outil** : `Split` (existant : `direction="row"`, `gap={0}`), posé dans une carte aux coins arrondis sur du noir (code du modèle). Le `radius` de `Split` arrondit chaque moitié, coins du milieu compris : l'arrondi va sur la carte, pas sur les moitiés.
- **Si rien ne s'y prête** : toujours possible.

### 2. Les deux moitiés en même temps, coupées ensemble
- **Mesuré** : les deux moitiés coupent sur la même image, quatre fois (images 67, 172, 232 et 320 : 2,23 · 5,73 · 7,73 · 10,67 s). Jamais l'une sans l'autre, jamais un plan seul en plein cadre. Cinq paires de 2,23 · 3,5 · 2,0 · 2,93 · 2,1 s. Chaque moitié joue à sa vitesse réelle : les flocons ne restent qu'une ou deux images, les légumes sautent vite. Caméras fixes, sauf la paire 3 à gauche (à la main). Aucun zoom, aucune poussée lente, aucune transition.
- **Sur quoi** : deux vidéos d'elle qui vont ensemble.
- **Outil** : manquant : **des plans simultanés**, deux passages de la même longueur posés sur le même moment, chacun à sa vitesse réelle. Aujourd'hui une case suit l'autre : le v1 donne à chaque moitié la moitié de la paire et la joue au ralenti (vitesse ½) pour la remplir.
- **Si rien ne s'y prête** : une vidéo trop courte pour sa paire est ralentie (jamais sous la moitié de sa vitesse, comme dans tout skill) ; un nombre impair de plans prend un second passage d'une de ses vidéos, jamais un plan seul en plein cadre.

### 3. Le geste à gauche, ce qu'il donne à droite
- **Mesuré** : à gauche, toujours des gens au travail (un chef de dos à son poste, un chef qui dresse, un chef qui assaisonne en gros plan, le passe en plan large, des mains qui font sauter la poêle). À droite, toujours le plat : il arrive, ou il reçoit sa dernière touche. La paire 3 montre le même geste des deux côtés : il assaisonne, les flocons tombent.
- **Sur quoi** : elle ou son équipe au travail, et ce que ça donne : les ciseaux et la coupe qu'on découvre, les mains qui lient et le bouquet posé, la pâte pétrie et le pain sorti du four, le lait versé et la tasse posée, l'aiguille et le tatouage fini.
- **Outil** : existant : la consigne de chaque case du remplisseur (`want`). À lui dire : les deux cases d'une paire parlent du même moment (le même plat, la même coupe).
- **Si rien ne s'y prête** : une photo du résultat, immobile. Sans aucun résultat filmé, ce n'est pas son modèle (son « pas pour » : un seul sujet, un lieu).

### 4. Le résultat qui entre dans l'image
- **Mesuré** : dans trois paires sur cinq, le plat entre par le bas de sa moitié, la table immobile. Il ralentit et se pose au centre en 0,7 à 1 s (paire 1 : images 4 à 32 ; paires 4 et 5 : déjà en mouvement à la coupe, posé 0,9 et 0,7 s après), puis la main qui le tenait repart. Dans les deux autres, la dernière touche : des doigts plantent une tuile (2,7 s), des flocons tombent.
- **Sur quoi** : le moment où elle pose ce qu'elle a fait devant la caméra (une assiette, une tasse, un bouquet sur le comptoir, un paquet tendu), ou la dernière touche (une feuille posée, une pincée qui tombe, un ruban noué).
- **Outil** : filmé, pas un effet : le départ du passage, choisi juste avant que l'objet entre (le remplisseur, d'après les moments datés de la lecture de sa vidéo : existant).
- **Si rien ne s'y prête** : le résultat posé, immobile. Jamais un glissé ni un zoom ajoutés pour le faire « arriver » (Tristan trouve les zooms cheap).

### 5. Deux petits titres qui se répondent
- **Mesuré** : « The Artists » sur la moitié gauche, « The Art » sur la droite, là de la première à la dernière image, immobiles. Ils sont posés sur la carte, pas sur les moitiés : quand le partage bouge (paire 3), ils restent. Un serif de labeur classique (de la famille des Times ou des Garamond : à 18 px de capitale on ne peut pas trancher ; plus large qu'Instrument Serif), romain, normal, en casse de titre, blanc, **sans ombre ni contour** : sur les assiettes claires des paires 3 et 4, « The Art » se lit mal. Capitale de 18 px, 3,4 % de la hauteur de la carte (≈ 42 px de corps sur une carte de 1080 de large). « The Artists » va de 12,8 à 29,5 % de la largeur de la carte, « The Art » de 69,1 à 81,4 %, tous les deux à 54 % de sa hauteur, juste sous le milieu. À peu près au centre de chaque moitié (43 % et 51 %) : le gauche sur la personne, le droit sur le plat. Un jeu de mots : le second est le premier raccourci (qui fait, puis ce qu'il fait).
- **Sur quoi** : ses deux mots, le second qui répond au premier (« Les artistes » / « L'art », « Les fleuristes » / « Les fleurs », « L'atelier » / « L'œuvre »).
- **Outil** : existant : les `labels` de `Split`, ou `FitText` (code du modèle). 48 px au moins (le contrôle des scènes), et une ombre douce pour les fonds clairs.
- **Si rien ne s'y prête** : toujours possible.

### 6. Étalonnage
Sombre et chaud : des noirs profonds (0 à 14 sur 255 dans les plans de cuisine), des bruns chauds dans les tons moyens, l'inox de la cuisine froid (vert-bleu), les plats orange et rouges saturés, les assiettes crème (≈ #CEC2BA). Pas de vignettage visible, pas de grain (les zones immobiles ne changent pas d'une image à l'autre). La lumière dure d'une fenêtre raye la table en diagonale dans les plats vus du dessus : filmée, pas ajoutée.

## Format
L'original est horizontal 4:3 : une carte de deux moitiés verticales 2:3, montrée sur du noir (sur un téléphone : une bande sur toute la largeur, du noir dessus et dessous). Ses moitiés étant verticales, ses vidéos verticales y vont bien : une vidéo 9:16 recadrée en 2:3 garde toute sa largeur et 84 % de sa hauteur. Une vidéo horizontale n'en garde que 38 % de la largeur. Réglage « format » :
- `carte` (comme l'original) : la carte 4:3 au milieu de l'écran vertical, 1080 × 810 sur du noir ;
- `plein écran` : la carte remplit l'écran, deux moitiés de 540 × 1920 (9:32) : chaque vidéo verticale ne garde que la moitié de sa largeur, son sujet au centre ;
- `l'un sur l'autre` : deux moitiés empilées de 1080 × 960 (9:8), la personne en haut, le résultat en bas, pour des vidéos horizontales (elles gardent 63 % de leur largeur) ; le titre du bas reste au-dessus du quart du bas, que couvre Instagram ;
- `auto` : `carte` quand la plupart de ses vidéos sont verticales, `l'un sur l'autre` quand elles sont horizontales (le code lit l'`aspect` de chaque plan).

## Ce que Gemini a vu, et ce qu'il a raté
Vu : le 4:3 et la carte aux coins arrondis sur du noir, les cinq paires et ce que montre chaque moitié, les coupes (à une ou deux images près), les deux titres fixes, leur place et leur couleur, l'étalonnage chaud. Raté : la **musique** (80 BPM et un beat hip-hop : ni batterie ni tempo tenu), les coupes « sur le temps » (une seule tombe sur une note), le **ralenti** des flocons (ils tombent à vitesse réelle), l'**ombre** des titres (il n'y en a pas), la « ligne médiane 50/50 » (pas de ligne, et le partage bouge de 48,8 à 52,1 %), et surtout les **plats qui entrent par le bas** dans trois paires sur cinq (« posée sur table »).

## Ce que le modèle v1 ratait
Sa lecture (`house-models.ts`) disait que les moitiés coupent chacune de son côté et qu'un plan de la personne passe seul en plein cadre vers 7 s : faux, elles coupent toujours ensemble et la carte ne quitte jamais l'écran. Le v1 jouait à 80 BPM, chaque moitié au ralenti (vitesse ½), un plan seul en plein cadre pour un nombre impair, en vertical seulement (deux moitiés de 9:32 au lieu d'une carte 4:3 de deux moitiés 2:3). Ses titres étaient vers 46 % de la hauteur au lieu de 54 %, en Instrument Serif (étroite) au lieu d'un serif de labeur. Il ajoutait une carte de fin et un vignettage (0,3) que l'original n'a pas, et ne demandait jamais le plat qui entre dans l'image.

## Ce qu'il faut filmer
Pour chaque geste, son résultat, tournés le même jour. D'un côté, elle ou son équipe au travail, caméra posée : de dos à son poste, les mains qui font, un gros plan du visage concentré pris d'en bas, un plan large de l'atelier avec quelqu'un derrière, les mains et l'outil en action. De l'autre, le résultat filmé du dessus, caméra fixe, sur une belle surface (bois, marbre), dans un rai de lumière : quelqu'un le pose devant la caméra (il entre par le bas et s'arrête au milieu), ou la dernière touche tombe dessus. Quatre ou cinq paires (8 à 10 vidéos), en vertical de préférence. La caméra ne bouge pas : c'est le plat qui arrive.
