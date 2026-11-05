# « Interface minimaliste » (`interface`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps.

**L'original** : `house/originals/interface.mp4`, en entier (pas de passage), 12,70 s d'image (le son va à 12,75 s), 720 × 1280, 30 i/s, **vertical 9:16** plein cadre, avec son. **Aucune coupe** : un seul plan de motion design sur un fond clair uni. Aucune image filmée, sauf une photo de profil fixe en noir et blanc.
**Son principe** : chaque élément devient le suivant. Le dernier mot devient l'étiquette, la liste laisse monter la phrase, la phrase est aspirée dans l'icône, l'icône s'ouvre en carte, la carte ne laisse que la photo et le bouton, le bouton devient une pastille, la photo devient l'« @ ». Tout entre et sort par le flou, sur les temps, avec de longs amortis.
**Sa musique** : une musique électronique légère, sans voix, **110,5 BPM** (un temps toutes les 0,543 s, le premier à 0,04 s ; sûr : les entrées et le clic tombent sur sa grille ; 73,75 et 147,5, les autres candidats, en sont les 2/3 et les 4/3 ; Gemini disait 120 : faux). Douce jusqu'à 7,09 s (temps 13, un début de mesure), où elle s'ouvre : environ 10 dB plus fort, une note aiguë tenue (vers 1,2 kHz), des pincements qui glissent, et à chaque mesure des coups syncopés à 0, ¾, 1½, 2½ et 3 temps (7,09 · 7,50 · 7,91 · 8,45 · 8,72 s, puis 9,27 · 9,68 · 10,09 · 10,63 · 10,90 s). Deux bruitages doux : une frappe pendant la phrase tapée (une vingtaine de petits clics de 5,72 à 6,64 s) et un double clic (9,79 et 9,88 s) ; trois tics au tout début (0,12 – 0,25 s), pas clair : la musique ou un bruitage. Elle s'éteint sur la dernière seconde.
**Mesuré avec** : `scripts/fiche/measure.py` (aucune coupe, le tempo ; son seul « clignotement », à 9,20 s, est faux : c'est la carte qui s'efface pendant que la photo bouge), des planches à 30 i/s de chaque passage et des gros plans, la place, la taille et la couleur de chaque texte, du blanc et du bleu image par image, le trajet du curseur, le spectre du son par bandes, et la lecture de Gemini (`house/breakdowns/interface.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 0,13 | 0 – 0,2 | Le fond clair, vide | — |
| 0,13 – 1,47 | 0,2 – 2,6 | « A new beginning » au centre, petit, « beginning » en serif italique | **Mots qui sortent du flou lettre à lettre** (0,13 – 0,67 s) |
| 1,47 – 2,30 | 2,6 – 4,2 | « A new » s'en va par la gauche ; « beginning » monte, rapetisse, grise, puis se change en « WHAT I DO ». « Video Editing » monte d'en bas sur le temps 3 | **Le dernier mot devient l'étiquette** ; **liste qui défile** |
| 2,27 – 3,10 | 4,1 – 5,6 | La liste avance d'un cran sur les temps 4 et 5 : « Motion Design », puis « Storytelling » sur la ligne du milieu | **Liste qui défile** |
| 3,17 – 4,03 | 5,8 – 7,3 | « Storytelling » souligné | **Trait de feutre** (3,17 – 3,50 s) |
| 4,03 – 5,50 | 7,3 – 10,1 | La liste part vers le haut ; deux lignes montent d'en bas, mot à mot (« Introducing my new Instagram page / to showcase my editing work. ») | **Phrase qui monte mot à mot** |
| 5,50 – 7,23 | 10,1 – 13,2 | Elle s'efface depuis la gauche ; un curseur bleu tape « Giving brands a story worth watching. » (5,73 – 6,70 s) | **Phrase tapée** |
| 7,09 | 13 | La musique s'ouvre | — |
| 7,23 – 7,70 | 13,2 – 14,1 | L'icône d'Instagram se pose sur « watching », glisse au centre et aspire la phrase | **Phrase aspirée dans l'icône** |
| 7,80 – 9,00 | 14,3 – 16,5 | L'icône s'ouvre en carte de profil blanche, son contenu sort du flou | **Icône qui s'ouvre en carte** |
| 9,00 – 9,80 | 16,5 – 18 | Zoom ×1,5 vers « Follow » ; la carte s'efface (temps 17), restent la photo et le bouton ; le curseur arrive d'en bas à droite | **Zoom sur le bouton** ; **curseur** |
| 9,83 – 10,17 | 18 – 18,7 | Clic sur le temps 18 : le bleu s'éteint, « Followed » monte | **Clic** |
| 10,17 – 11,07 | 18,7 – 20,3 | Photo et bouton se replient en pastille blanche (photo, « tejya.iro », coche) ; le curseur s'en va | **Repli en pastille** |
| 11,07 – 11,90 | 20,3 – 21,8 | La pastille s'efface, la photo devient l'« @ » (temps 21), le compte passe au dégradé bleu ; « FOLLOW ALONG » au-dessus, lettre à lettre | **La photo devient l'@** |
| 11,90 – 12,70 | 21,8 – 23,3 | Tenu jusqu'à la fin | — |

## Effets (ce qu'on veut savoir refaire)

### 1. Des mots qui sortent du flou, lettre à lettre
- **Mesuré** : de 0,13 à 0,67 s (images 4 à 20), une lettre de plus à chaque image, de gauche à droite (15 caractères en 13 images) ; chacune arrive floue, transparente et un peu bas (environ 0,4 de la hauteur des capitales), nette en 5 images. La ligne monte encore de 7 px pendant qu'on la lit : la fin d'un long amorti, pas une poussée. Grotesque grasse, dernier mot en serif italique fine, un peu plus grand. Boîte : 36 à 64 % de la largeur (28 %), 48,6 à 50,9 % de la hauteur ; capitales à 1,6 % de la hauteur. « A new » ressort pareil, depuis la gauche (images 44 à 50). « FOLLOW ALONG » entre de la même façon à la fin.
- **Sur quoi** : ses mots, dans n'importe quel commerce (« Un nouveau départ », « Bienvenue chez Lune »). Rien à filmer.
- **Outil** : `Reveal by="letter" from="blur"` (existant), une lettre par image, 5 images chacune ; il lui manque la petite montée en même temps que le flou (`blur` ne monte pas, `rise` ne floute pas).
- **Si rien ne s'y prête** : toujours possible.

### 2. Le dernier mot devient l'étiquette
- **Mesuré** : pendant que « A new » s'en va, « beginning » monte d'environ 80 px, rapetisse de moitié (de 119 à 64 px de large) et grise (images 48 à 56). Puis il se change en « WHAT I DO » lettre à lettre depuis la gauche : chaque ancienne lettre se floute pendant qu'une capitale arrive à sa place (images 57 à 69, 1,90 – 2,30 s, à partir du contretemps 3,5). L'étiquette : capitales espacées (environ 0,4 em), hautes de 8 px (0,6 % de la hauteur), gris #87888E, à 42,8 % de la hauteur, 7 % au-dessus de la ligne du milieu.
- **Sur quoi** : ses mots : le dernier mot de son accroche devient le titre de sa liste (« ce qu'on fait », « au menu »).
- **Outil** : code du modèle (la boîte du mot animée de sa place à celle de l'étiquette) et deux `Reveal` au même endroit, l'un qui sort, l'autre qui entre (existants).
- **Si rien ne s'y prête** : sans étiquette (facultative), le dernier mot s'efface comme les autres.

### 3. La liste qui défile sur la ligne du milieu
- **Mesuré** : trois éléments de deux mots au plus. Le premier monte d'en bas (68 px) en sortant du flou sur le temps 3 (1,70 s, images 51 à 60). Puis un cran par temps, sur les temps 4 et 5 (images 68 à 76 et 85 à 93, à deux images près, 8 images chacun, amortis des deux côtés). L'élément de la ligne du milieu (50 % de la hauteur) est net et noir, capitales à 1,7 % ; ses voisins, à 50 px au-dessus et au-dessous (3,9 % de la hauteur), sont très flous (environ 5 px sur 720) et très pâles (environ 10 % du noir). La liste repart vers le haut dans le flou (images 121 à 134) quand la phrase suivante monte.
- **Sur quoi** : trois choses qu'elle fait ou propose (« Coupe · Couleur · Soin », « Brunch · Café · Desserts »).
- **Outil** : `WordList` (existant) ; il lui manque le flou des voisins (il ne fait que les pâlir) et l'entrée du premier par le bas.
- **Si rien ne s'y prête** : deux choses, un seul cran ; quatre, trois crans.

### 4. Un trait de feutre sous le dernier mot
- **Mesuré** : de 3,17 à 3,50 s (images 95 à 105, du temps 5,75 au temps 6,4), un seul trait se dessine de gauche à droite : sa partie épaisse en 5 images, sa queue jusqu'à la 11e. Épais de 8 à 9 px à gauche (0,7 % de la hauteur), il s'effile jusqu'à un fil à droite. Presque droit, juste sous les jambages (51,2 à 51,8 % de la hauteur), il dépasse un peu le mot (8 px à gauche, 16 px à droite). Du bleu roi #1051C4 à l'indigo #222853 (le dégradé du bouton). Aucun rebond.
- **Sur quoi** : le mot qui compte, le dernier de sa liste.
- **Outil** : `Scribble kind="underline"` et `Marker shape="underline"` existent, mais d'une épaisseur constante (`Marker` trace même deux traits) ; il manque un trait qui s'effile, en dégradé. Sinon, le code du modèle (un tracé plein dévoilé de gauche à droite).
- **Si rien ne s'y prête** : toujours possible.

### 5. Une phrase qui monte mot à mot
- **Mesuré** : de 4,03 à 4,70 s (images 121 à 141), deux lignes centrées (61 % et 51 % de la largeur, capitales à 1,56 %, interligne 3,7 % de la hauteur) montent ensemble d'environ 100 px (8 % de la hauteur). Leurs mots sortent du flou l'un après l'autre, ligne 1 puis ligne 2, les deux derniers en serif italique. Au-dessus, la liste monte et s'efface : une poussée verticale d'un bloc de texte à l'autre. Lue entière 0,8 s, puis effacée lettre à lettre depuis la gauche (images 165 à 172).
- **Sur quoi** : son annonce (« J'ouvre ma page pour montrer mes coupes »).
- **Outil** : `Reveal by="word" from="blur"` dans un bloc qui monte (code du modèle), sortie par `Reveal exit` (existants).
- **Si rien ne s'y prête** : facultative ; sans annonce, la liste laisse place à la phrase tapée.

### 6. La phrase tapée derrière un curseur bleu
- **Mesuré** : le curseur apparaît au bord gauche de l'annonce qui s'efface (image 166). De 5,73 à 6,70 s (images 172 à 201, du temps 10,5, un coup grave fort, au temps 12,3), « Giving brands a story worth watching. » se tape : 37 caractères en 29 images (environ 1,3 par image, 38 par seconde), réguliers, sans pause. Chaque lettre reste floue une ou deux images. Tapée depuis le bord gauche de la phrase d'avant (17,6 % de la largeur), elle finit centrée (17,6 à 81,7 %). Ses deux derniers mots en serif italique. Le curseur : une barre bleue de 2 px, haute de 34 px (2,7 % de la hauteur, 1,6 fois les capitales). Il **ne clignote pas**, et s'efface 7 images après la frappe (images 208 à 211). On entend une frappe douce (5,72 – 6,64 s).
- **Sur quoi** : sa promesse en une phrase (« Des coupes qui vous ressemblent. »).
- **Outil** : `TypeOn` (existant : `speed` 38, `jitter` 0, `caret="bar"`, `caretColor`) ; il lui manque un curseur qui ne clignote pas et s'efface à une image donnée, et le court flou de chaque lettre. Le bruitage : voir l'effet 10.
- **Si rien ne s'y prête** : toujours possible.

### 7. La phrase aspirée dans l'icône
- **Mesuré** : juste après l'ouverture de la musique, de 7,23 à 7,70 s (images 217 à 231), une icône se pose sur le dernier mot (images 217 à 220) : le pictogramme d'Instagram au trait sombre (#1E1E21), dans un carré blanc de 79 × 76 px (11 % de la largeur), coins de 18 px, ombre très légère. Puis elle glisse au centre en ralentissant (images 220 à 231). Les mots à sa gauche glissent vers elle et disparaissent dans le flou, depuis la gauche ; ceux qu'elle couvre passent dessous.
- **Sur quoi** : son réseau (son compte Instagram), ou son logo dans le carré.
- **Outil** : code du modèle (le carré, le pictogramme en SVG, chaque mot qui glisse vers l'icône en se floutant). Aucun outil n'aspire des mots vers un point, et il n'en faut pas un exprès.
- **Si rien ne s'y prête** : toujours possible.

### 8. L'icône qui s'ouvre en carte de profil
- **Mesuré** : de 7,80 à 8,27 s (images 234 à 248, temps 14,3 à 15,2), le carré grandit en carte, de 79 × 76 à 514 × 323 px (71 × 25 % de l'image, centrée). Vite au milieu, amorti au bout, sans rebond ; même rayon tout du long (environ 20 px, 2,8 % de la largeur) ; le pictogramme s'efface (images 238 à 241). Le contenu sort du flou de haut en bas (images 242 à 250) : en haut son compte et un chevron, à droite « ⊕ » et « ≡ » ; à gauche la photo ronde (89 px, 12 % de la largeur, en noir et blanc), à côté le nom en grotesque grasse et le métier en serif italique grise (#939393) ; deux lignes de bio (« Colours. Visuals. Creative direction. », puis la phrase tapée) ; « Follow » (225 × 42 px, coins de 9 px, dégradé #0450D1 → #332B7F, qui passe du pâle au bleu, images 250 à 257) et « Message » (gris #EBECF1). Ombre très légère (environ 5 %, 40 px sous la carte). Tenue 0,4 s.
- **Sur quoi** : son compte : sa photo de profil ou son logo (ou une vidéo d'elle qui joue dans le rond), son nom, son métier, sa bio (sa liste, sa promesse).
- **Outil** : `Window` (existant) pour l'ouverture, du carré à la carte, avec son rayon et son ombre ; le contenu dans le code du modèle (`Footage` ou `Img` dans le rond). `ProfileCard` existe mais ne ressemble pas à cette carte : rayon de 44, ombre lourde, textes de 48 à 60 px, boutons en pastille, ni icônes en haut ni métier, et il ne s'ouvre pas d'une icône. Ses textes sont minuscules (la bio à 0,9 % de la hauteur) : à 48 px, la taille que demande le moteur, la carte prend presque toute la largeur, ou ses petites lignes passent en décor.
- **Si rien ne s'y prête** : sans photo, son logo ; sans les deux, son initiale sur sa couleur. Les mots de l'appli en français (sur Instagram, « Suivre » et « Message » : à vérifier).

### 9. Le zoom sur le bouton
- **Mesuré** : de 9,00 à 9,80 s (images 270 à 294, temps 16,5 à 18), toute la carte grossit ×1,5 et le bouton vient au centre (de 31 à 47 % de la largeur ; son centre passe de 34 %, 59 % à 50 %, 50 %), lent au départ et à l'arrivée. Le blanc de la carte disparaît en 3 images, sur le temps 17 (images 276 à 278), et le reste s'efface dans le flou (images 276 à 281) : restent la photo (135 px, au-dessus) et le bouton.
- **Sur quoi** : sa carte.
- **Outil** : code du modèle (une échelle et un déplacement sur toute la carte, comme une caméra).
- **Si rien ne s'y prête** : c'est un zoom qui sert de transition (Tristan les trouve cheap) : à confirmer avec lui. Sinon, sans zoom : le reste de la carte s'efface, la photo et le bouton grandissent sur place (comme la v1).

### 10. Le curseur qui clique
- **Mesuré** : une flèche noire au liseré blanc (17 × 27 px, 2,4 % de la largeur), floue de bougé quand elle va vite. Elle entre en bas à droite (65 %, 86 %) à l'image 271, monte, puis s'incurve vers le bouton : un arc, le plus rapide aux images 279 à 283 (45 à 60 px par image). Elle se pose sur sa droite (60 %, 51 %) à l'image 293. Clic à 9,83 s, sur le temps 18 : ni anneau, ni enfoncement visible. Le bleu s'éteint en 3 images (296 à 298), le bouton devient blanc avec son ombre, et « Followed » monte d'en bas en 4 images (302 à 305). On entend un double clic doux (9,79 et 9,88 s). La flèche repart en bas à droite en s'effaçant (images 312 à 320).
- **Sur quoi** : son bouton « S'abonner ».
- **Outil** : `Cursor` et `Button` (existants). Il manque à `Cursor` un clic sans anneau et un chemin courbe (il s'arrête à chaque point) ; à `Button`, le bleu qui s'éteint en fondu et le nouveau mot qui monte (son changement est un saut). Et un skill ne pose pas de bruitages (la frappe, le clic) : `plan.sounds` existe, mais un skill ne l'écrit pas.
- **Si rien ne s'y prête** : toujours possible.

### 11. Le repli en pastille
- **Mesuré** : de 10,17 à 10,60 s (images 305 à 318, temps 18,7 à 19,5), le bouton blanc rétrécit en pastille blanche (214 × 64 px, 30 × 5 % de l'image, centrée, ronde aux bouts). La photo rapetisse de 135 à 38 px et file vers son bout gauche, floue de bougé. « Followed » se fond en « tejya.iro » (images 312 à 315), une coche gris-bleu (#69768B) arrive à droite (images 316 et 317). Tenue 0,5 s.
- **Sur quoi** : sa photo et son compte.
- **Outil** : code du modèle (les boîtes interpolées) ; `Window` le ferait s'il pouvait changer de rayon pendant un déplacement (coins de 9 px pour le bouton, pastille ronde).

### 12. La photo qui devient l'@
- **Mesuré** : de 11,07 à 11,57 s (images 332 à 347, temps 20,3 à 21,2), le blanc de la pastille et la coche s'effacent. La photo grise et rapetisse en un point bleu pâle (images 339 à 342), qui devient l'« @ » du compte (images 343 à 346), sur le temps 21, un début de mesure. Le compte prend le dégradé du bouton (#0C3A83 à gauche, #181744 à droite). Fin : « @tejya.iro » au centre (40 à 59,4 % de la largeur, 48,4 à 50,9 % de la hauteur, capitales à 1,9 %). Puis « FOLLOW ALONG » au-dessus, lettre à lettre comme l'accroche (images 347 à 357 : capitales espacées, 0,7 % de la hauteur, gris #919297, à 45 % de la hauteur). Tenu 0,8 s jusqu'à la fin.
- **Sur quoi** : son @ et sa photo.
- **Outil** : code du modèle (le rond qui devient un point, l'« @ » sorti du flou à sa place, le dégradé par `background-clip: text`) et `Reveal by="letter" from="blur"` pour l'étiquette (existant).
- **Si rien ne s'y prête** : son @ inconnu n'est jamais inventé : son nom dans le dégradé, sans « @ ».

### 13. Matière et couleurs
Fond uni #F4F5FA, le même dans les coins et au centre : ni grain, ni dégradé, ni vignettage. Encre presque noire (#121317 à l'œil, #010104 au cœur des lettres). Un seul accent : le dégradé bleu roi → indigo (bouton, soulignement, compte final). Gris #87888E et #919297 pour les étiquettes, #939393 pour le métier. Ombres très légères ; la photo en noir et blanc tient dans cette palette. Tout est petit au centre, avec beaucoup de vide. Aucune coupe, aucun flash, rien qui s'allume.

## Format
L'original est vertical 9:16, plein cadre, sans image filmée : pas de réglage « format » pour ce modèle. Sa photo ou sa vidéo n'entre que dans le rond (89, puis 135, puis 38 px sur 720), recadrée sur son visage : horizontale ou verticale, peu importe.
**Tailles et lecture** : l'original est plus petit et plus rapide que ce que demande le moteur. Ses lignes ont des capitales à 1,6 % de la hauteur (environ 43 px de corps en 1080 × 1920), ses étiquettes à 0,6 % (environ 17 px). Le minimum du moteur (48 px, 20 px pour une étiquette de 4 mots au plus) ne les grossit que de 10 à 20 % : on peut garder le vide. Il tient l'annonce de 9 mots entière 0,8 s et la phrase tapée 0,5 s, quand le moteur demande 0,8 s plus 0,3 s par mot : le modèle allonge ces tenues de quelques temps, au même tempo.

## Ce que Gemini a vu, et ce qu'il a raté
Vu : l'ordre des textes, la liste qui défile et son soulignement bleu, la frappe et son curseur bleu, l'icône qui devient la carte, le curseur qui clique vers 9,8 s, le bouton blanc puis la pastille, le compte final, la frappe à 5,73 s et le clic à 9,8 s. Raté : le **tempo** (120 au lieu de 110,5) et la **musique** (il n'entend que des bruits d'interface ; c'est une vraie musique, qui s'ouvre à 7,09 s, avec deux bruitages doux), « A new » en grotesque (il lit toute l'accroche en serif), le **dernier mot qui devient l'étiquette**, le curseur qui **ne clignote pas** (il le dit clignotant), l'icône qui **aspire la phrase**, le **zoom sur le bouton** (il dit que la carte rétrécit), la **photo qui devient l'@**, l'interlettrage des étiquettes (0,15 em au lieu d'environ 0,4). Et il invente deux rebonds élastiques, au soulignement et à la carte : aucun n'est mesuré.

## Ce que le modèle v1 ratait
Il jouait à 100 BPM (sa mesure n'avait pas trouvé de tempo) et durait environ 16 s au lieu de 12,7. L'accroche sortait mot à mot, « deux mots » au lieu de trois ; il n'y avait ni dernier mot qui devient l'étiquette, ni « WHAT I DO » qui le remplace. L'annonce de deux lignes avait disparu, fondue dans la phrase tapée. La phrase tapée était centrée au lieu de partir du bord gauche de la précédente, et son curseur clignotait. L'icône apparaissait au centre au lieu d'aspirer la phrase depuis son dernier mot. Pas de zoom sur le bouton. Le clic avait un anneau (celui de `Cursor`) au bout d'un trajet droit, et « Abonné(e) » remplaçait « S'abonner » d'un coup. La photo ne devenait pas l'« @ ». Et ses textes faisaient 66 à 94 px, jusqu'à deux fois l'original, qui perdait son vide. Son « pour » tient (faire suivre son compte) ; l'original dit aussi un nouveau départ.

## Le modèle v2 (5 novembre)
Écrit sur cette fiche (`packages/agent/src/skills/interface.ts`, version 2), rendu en local sur la photo de la céramiste « Atelier Argile » (`b5/mon-travail/her.jpg` en photo de profil ; « Un nouveau départ », « tournage, émail, cuisson », « ce que je fais », « j'ouvre ma page pour montrer mes pièces », « des pièces qui durent », « céramiste », « @atelier.argile » ; `scripts/skill-render.mts`, aucun appel facturé) :
- **Tempo et moments** : 110,5 BPM, son premier temps à 0,04 s ; chaque moment sur l'image de l'original, à deux images près (ses images comptées en temps, si bien qu'un autre tempo les suit toutes). Deux tenues allongées pour un téléphone : l'annonce deux temps de plus, la phrase tapée un de plus (le moteur lit une phrase en 0,8 s plus 0,3 s par mot) : 14,3 s au lieu de 12,7, sans aucune coupe.
- **Accroche** (1, 2) : ses mots sortent du flou une lettre par image au centre, 50 px (un peu au-dessus des 48 du moteur), le dernier en Instrument Serif italique, la ligne qui monte encore un peu ; les premiers repartent dans le flou depuis la gauche, le dernier monte, rapetisse de moitié et grise, puis se change lettre à lettre en son étiquette (`etiquette`, 21 px, capitales espacées de 0,4 em, une accentuation), à 42,8 % de la hauteur. Sans étiquette, il part avec les autres.
- **Liste** (3, 4) : ses trois choses sur la ligne du milieu, un cran par temps, amorti des deux côtés, la première montant d'en bas hors du flou ; celle du milieu nette et noire, ses voisines à 75 px, pâles (12 %) et floues (7 px) ; la dernière soulignée d'un trait qui s'effile, du bleu roi à l'indigo, tracé de gauche à droite (sa partie épaisse en 5 images, sa queue à la 11e). Deux à quatre choses : un à trois crans.
- **Annonce** (5, facultative) : deux lignes équilibrées qui montent ensemble, mot à mot hors du flou, ses deux derniers mots en italique, la liste poussée vers le haut ; effacée lettre à lettre depuis la gauche.
- **Phrase tapée** (6) : 38 lettres par seconde, chaque lettre floue une ou deux images, ses derniers mots en italique, tapée depuis le bord gauche de sa ligne (posée centrée dès le début, ses lettres invisibles tant qu'elles ne sont pas tapées) ; un curseur bleu de 3 px qui ne clignote jamais et s'efface 7 images après la frappe.
- **Icône, carte, zoom** (7, 8, 9) : le carré blanc de l'icône se pose sur son dernier mot et glisse au centre en ralentissant, ses mots glissent vers lui et partent dans le flou depuis la gauche ; il s'ouvre en carte de 768 × 485 (vite au milieu, amorti au bout, son rayon le même), son contenu hors du flou de haut en bas : son compte et son chevron, ⊕ et ≡, sa photo ronde en noir et blanc, son nom, son métier (`metier`, facultatif) en italique gris, sa liste et sa promesse en bio (décor : déjà lues), « Suivre » qui passe du pâle au bleu, « Message » ; ses petits textes en accentuations (20 px au moins). Puis le zoom ×1,5 comme une caméra, « Suivre » au centre ; le blanc de la carte part en trois images, le reste dans le flou : restent sa photo et le bouton.
- **Clic, pastille, @** (10, 11, 12) : une flèche noire au liseré blanc, floue quand elle file, monte d'en bas à droite en arc et se pose sur la droite du bouton ; le clic sans anneau, le bleu qui s'éteint en trois images, « Suivi(e) » qui monte (les mots d'Instagram en français) ; le bouton se replie en pastille blanche ronde, sa photo file à son bout gauche, « Suivi(e) » se change en son compte, une coche gris-bleu ; puis la pastille s'efface, sa photo devient un point bleu pâle à la place du « @ », son compte en dégradé bleu, « À SUIVRE » au-dessus lettre à lettre. Son @ inconnu n'est jamais inventé : son nom, sans « @ ».
- **Sa photo** : la seule image, dans le rond, en noir et blanc, sur son visage quand il est suivi, sinon le haut du milieu d'une photo debout ; une vidéo d'elle y joue ; sans fichier, son logo, sinon son initiale sur sa couleur.
- **Son** : sa musique douce (10 dB sous son niveau) jusqu'à l'icône, ouverte d'un coup sur un premier temps de mesure, fondue sur sa dernière seconde ; une frappe douce, un clic toutes les deux lettres de sa promesse, et le double clic sur « Suivre » (les bruitages de l'original).
- **Couleurs** : fond #F4F5FA, encre #121317, gris #87888E, le dégradé bleu roi → indigo de l'original, ou sa couleur sur sa demande (réglage `couleur` : `bleu`, `sienne` ; le bleu si la sienne est trop pâle). Aucune finition posée dessus.
- **Format** : vertical, sans réglage (aucune image filmée). Carte de fin en option, hors du flou après son compte.
- **Léger à rendre** : du texte, une photo et aucune coupe ; mesuré en local, une image à la fois, sur six passages de 2 à 3 s (la machine chargée de 22 à 26) : 0,29 s par image, contre 0,36 pour `plans-fixes` sur la même photo (0,8 fois).
- **Pas fait** : la place de l'icône et des mots qu'elle aspire est estimée d'après leurs lettres (une composition ne mesure pas où tombent les mots dans sa ligne) ; la phrase tapée part du bord gauche de sa propre ligne, pas tout à fait de celui de l'annonce ; ses premiers mots s'effacent sur place sans partir vers la gauche ; les trois tics du début (pas clairs).
- **Au catalogue** (`house-models.ts`, `house-measures.ts`, à faire par la session qui les édite) : son tempo (110,5 au lieu de 100), ses moments, sa musique (« light minimal electronic, soft plucks, opening up with a bright held note »), ce qu'il lui faut, son « pour » et « Suivre » à la place de « S'abonner ».

## Ce qu'il faut filmer
Presque rien. Sa photo de profil (son visage net, bien éclairé, au centre) ou son logo ; mieux, 2 à 3 s d'elle qui regarde la caméra, qui joueront dans le rond. Et ses mots : son @ (jamais inventé), son nom, son métier en un mot, trois choses qu'elle fait, une annonce et sa promesse en une phrase chacune.
