# « Mot clé en grand » (`mot-cle`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original (l'image n tombe à n / 30 s) ; « temps » compte les temps de sa musique (108 BPM) sur sa grille prolongée jusqu'au début : le temps 0 tombe à 0,04 s (l'image 1, l'entrée de l'accroche), et la musique elle-même n'entre qu'au temps 5.

**L'original** : `house/originals/mot-cle.mp4`, 23,43 s (703 images), 720 × 1280, 30 i/s, **vertical 9:16** plein cadre, avec son. Le modèle prend tout le Reel (pas de passage dans `HOUSE_PASSAGES`). Un créateur assis sur une chaise en bois, devant un fond rouge uni, parle face caméra en anglais du début à la fin ; ce qu'il dit s'écrit au-dessus de sa tête.
**Ce qu'il dit** (relu dans ses sous-titres) : il annonce « a couple of fonts » à associer dans ses vidéos, en cite cinq paires (Inter avec Tempting, Avant Garde avec Cooper, Impact avec Poppins, Helvetica avec Courier New, Bebas Neue avec Montserrat), dit que c'est le jour 41 de son défi de 60 jours, puis au revoir. Une parole continue : aucune pause de plus de 0,2 s, aucune coupe dans une phrase.
**Sa musique** : un beat à la basse très grave (40 à 50 Hz, en croches, une boucle d'une mesure de 2,22 s), **108 BPM** (107,9 mesurés sur sa basse, un temps toutes les 0,556 s ; la pulsation de `measure.py`, 108,25, est juste ; Gemini disait 85 : faux). Elle **n'entre qu'à 2,82 s** (temps 5, sur « together »), **perd sa basse** de 11,71 s (temps 21) à 20,61 s (temps 37), 16 temps, puis joue jusqu'au bout et se coupe avec l'image. La voix reste devant (autour de −17 dBFS ; la basse autour de −20 quand elle joue). Deux **souffles graves**, le même son deux fois, sous les deux mots qui glissent (effets 1 et 3).
**Mesuré avec** : `scripts/fiche/measure.py` (ses 2 coupes et son tempo, justes ; ses 40 « clignotements » sont ses gestes et les deux glissés), des planches à 30 i/s de tout le Reel, la boîte de chaque texte mesurée image par image (blanc pur sur le rouge), chaque sous-titre relu à son image, le suivi de la chaise pour la caméra, le spectre et l'enveloppe du son, et la lecture de Gemini (`house/breakdowns/mot-cle.json`).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 1,03 | 0 – 1,8 | Plan 1, de trois-quarts : il est assis, le haut de la tête à mi-hauteur, toute la moitié haute est du fond rouge ; il parle à partir de 0,30 s | **Accroche** « SO, TODAY » qui glisse de la gauche dès l'image 1, avec un souffle grave (effet 1) |
| 1,07 – 1,70 | 1,9 – 3 | « show », « you », « couple », « of » s'écrivent un à un, en petit, sur une ligne | **Petite ligne mot à mot** (effet 2) |
| 1,73 – 5,40 | 3 – 9,7 | « FONTS » glisse de la gauche sous la ligne, sur le mot dit, et reste ; la ligne se vide (2,13 s) et se réécrit deux fois : « you can pair together » (2,27 – 3,30), « in your videos » (3,50 – 4,53) ; la musique entre à 2,82 s | **Mot clé tenu toute l'idée** (effet 3) |
| 5,43 – 7,07 | 9,7 – 12,7 | Plus rien au-dessus de sa tête ; coupe à 5,67 s sur le plan 2, de face | **Coupe entre deux idées**, puis une respiration (effet 7) |
| 7,10 – 16,67 | 12,7 – 30 | Cinq paires de noms, chacun écrit dans sa police, le second quand il le dit : inter / Tempting, avant garde / cooper, impact / poppins, Helvetica / courier new, BEBAS NUEUE / montserrat ; la basse s'arrête à 11,71 s | **Une liste, deux par deux, chaque nom dans sa police** (effet 4) |
| 16,70 – 17,57 | 30 – 31,6 | Coupe sur le plan 3, de trois-quarts comme le plan 1, un peu décalé ; la dernière paire part avec la coupe | Effet 7 |
| 17,60 – 21,57 | 31,6 – 38,7 | « 41 » très condensé, et « consistent / creative / copycat » empilés à sa droite ; la basse revient à 20,61 s | **Le chiffre et ses trois mots** (effet 5) |
| 21,60 – 23,43 | 38,8 – 42,1 | Il dit au revoir ; plus rien au-dessus de sa tête | — |
| 0,23 – 23,43 | tout du long | Ce qu'il dit, en tout petit, sur sa poitrine | **Sous-titres** (effet 6) |

Tout ce qui s'écrit apparaît et part d'un coup, en une image, sans fondu, sauf les deux mots qui glissent (l'accroche et « FONTS »).

## Effets (ce qu'on veut savoir refaire)

### 1. L'accroche : ses premiers mots en grand, déjà là avant qu'il parle
- **Mesuré** : « SO, TODAY » (ses deux premiers mots, la virgule gardée) entre dès l'image 1, avant sa voix (0,30 s). Il arrive du bord gauche, d'abord hors du cadre, à 19 % de la largeur par image (3 images, avec un flou de bougé horizontal), dépasse sa place de 3 % de la largeur (image 4), revient 4 % en deçà (image 5) et se pose à l'image 6 : 0,2 s en tout. Un souffle grave et court (0,06 à 0,24 s, au plus fort à 0,16 s, presque rien au-dessus de 1 kHz) tombe sur le rebond. Capitales d'une sans géométrique grasse (type Poppins Bold), blanc pur, sans ombre ; hauteur des capitales 3,5 % de la hauteur, 42 % de la largeur, centré (50,1 %), le haut à 28,9 % de la hauteur. Tenu 1 s, pendant « So today I'm going » ; il part d'un coup (image 32) quand la petite ligne commence.
- **Sur quoi** : ses deux ou trois premiers mots, quand ils annoncent déjà quelque chose (« Alors aujourd'hui », « Trois secrets », « Le meilleur pain »).
- **Outil** : l'accroche dès la 1re image existe (`hookAtStart`, `HOOK_LEAD`). Le glissé avec rebond et flou de bougé : code du modèle (un ressort et un flou horizontal en SVG, comme celui de `Whip` ; `Reveal from="left"` ne bouge que de 0,6 em, en fondu). Le souffle : les bruitages d'un skill, manquants (voir la fiche `decode`, effet 6).
- **Si rien ne s'y prête** (elle commence par « Bonjour, je suis… ») : l'accroche prend le mot clé de sa première idée, toujours sur la 1re image.

### 2. La petite ligne : les mots dits, un à un, au-dessus du mot clé
- **Mesuré** : une ligne de petits mots en minuscules (la même géométrique, en normal, type Poppins Regular), blancs ; hauteur des minuscules 1,4 % de la hauteur, des hampes 2,0 % (environ 49 px de police dans une image de 1080 × 1920, juste au minimum lisible de 48 px) ; de 20,3 à 23,1 % de la hauteur, sa ligne de base 6,4 % au-dessus du haut du mot clé. Chaque mot apparaît d'un coup sur l'image où il est dit (à 3 images près), un toutes les 0,17 à 0,2 s, à sa place finale : la ligne ne bouge pas quand un mot s'ajoute. Des mots très espacés : 4 à 14 % de la largeur entre deux mots (4 à 12 espaces). La ligne fait 37 à 74 % de la largeur, à peu près centrée (son milieu à 48,5 – 52 %). Trois lignes de suite sous « FONTS » : « show you couple of » (images 32, 37, 43, 49 ; les petits « to » et « a » sautés, « fonts » jamais répété), « you can pair together » (68, 73, 79, 85), « in your videos » (105, 110, 116). Chacune se vide d'un coup à la fin de sa phrase (images 64, 100, 137) ; après les deux premières, la suivante commence 4 à 5 images plus tard au même endroit ; « to have an amazing look » ne s'écrit pas (seulement en sous-titre).
- **Sur quoi** : ses mots à elle, ceux qui entourent son mot clé.
- **Outil** : ses mots datés existent (`spoken`, lus par Scribe). La ligne : code du modèle. À savoir : le contrôle du temps de lecture (`tooQuick`, 1,2 s au moins une fois tous les mots là) refuserait ces lignes, vidées 0,5 à 0,7 s après leur dernier mot ; ici on lit ce qu'on entend. `Captions kinetic` fait bien arriver chaque mot à son image, mais en gras, en fondu qui monte, avant et après le mot fort, et en changeant de côté d'une phrase à l'autre : pas cette ligne.
- **Si rien ne s'y prête** : toujours faisable dès qu'elle parle.

### 3. Le mot clé de l'idée, en grand, tenu toute l'idée
- **Mesuré** : « FONTS » arrive sur le mot dit (1,73 s), du bord gauche, exactement comme l'accroche : même vitesse, même rebond (dépassé à l'image 55, revenu à la 56, posé à la 57), même souffle grave (au plus fort à 1,80 s). Capitales grasses (la police de l'accroche), blanc ; hauteur des capitales 5,1 % de la hauteur (une fois et demie l'accroche), 37 % de la largeur, centré, de 28,8 à 33,8 % de la hauteur. Il reste 3,7 s (jusqu'à 5,40 s), toute l'idée, pendant que trois petites lignes passent au-dessus, puis part d'un coup à la fin de l'idée (« …amazing look. »), 0,23 s avant la coupe.
- **Sur quoi** : le mot qui porte son idée, dit tôt : « SOINS », « BRUSHING », « PAINS », « EXERCICES ».
- **Outil** : existant depuis le 5 novembre, **un skill calé sur sa voix** (`voice` d'un skill, `docs/modeles.md`, « Skills calés sur sa voix ») : ses mots datés passés à sa timeline et à son code (`said`, `spoken`), et son remplisseur qui choisit dans ce qu'elle dit l'accroche, le mot clé de chaque idée et l'instant où l'idée finit, puis la liste (effet 4 : `items`) et le chiffre (effet 5 : une idée dont le mot clé est le chiffre, ses trois mots en liste), chacun à l'instant où il est dit. Le mot fort de `Captions kinetic` (`strongIndex` : le mot le plus long de chaque phrase de 2,6 s au plus) change trop souvent. Le dessin : code du modèle.
- **Si rien ne s'y prête** (elle bavarde, sans idée qu'un mot résume) : le mot fort de chaque phrase, tenu le temps de la phrase.

### 4. Une liste : chaque nom dans sa police, deux par deux, sur le mot dit
- **Mesuré** :
  - Cinq paires de 7,10 à 16,67 s. Chaque nom apparaît d'un coup sur le début du mot dit (à 2 images près : le « t » de Tempting, le « c » de cooper, le « p » de poppins, le « b » de Bebas se voient dans le son). Le premier dit va en haut, le second dessous, à 2,3 % de la hauteur. Une paire part d'un coup quand il dit le premier nom de la suivante ; la dernière part avec la coupe.
  - Les temps : inter 7,10 / Tempting 7,80 ; avant garde 8,47 / cooper 9,57 ; impact 10,23 / poppins 11,33 ; Helvetica 12,03 / courier new 13,20 ; BEBAS NUEUE 14,03 / montserrat 15,47. Le premier nom reste seul 0,7 à 1,4 s, la paire entière 0,67 à 1,23 s.
  - Chaque nom dans sa police et sa casse : Inter grasse, Tempting (une manuscrite à boucles), Avant Garde grasse, Cooper Black, Impact, Poppins, Helvetica grasse, Courier New, Bebas Neue (que des capitales), Montserrat fine. Tout en blanc, sans ombre.
  - Un nom grand, l'autre petit : le grand fait 53 à 75 % de la largeur (Tempting 55 %, cooper 75 %, impact 57 %, Helvetica 68 %, BEBAS NUEUE 53 %) et 5 à 7 % de haut ; le petit 13 à 31 % de la largeur, 2 à 7 fois moins haut. Chaque paire tient entre 20 et 34 % de la hauteur, centrée ; seul « inter » est niché en haut à droite de « Tempting », dans le creux de la manuscrite.
- **Sur quoi** : une liste qu'elle dit : ses produits, ses prestations, des étapes, des ingrédients (« le gommage, le masque, l'huile », « la tresse, le chignon, la queue haute »). Dans l'original, chaque nom de police est écrit dans sa police ; chez elle, chaque mot dans la police qu'il évoque (une manuscrite pour « soin », une ronde et grasse pour « gourmand », une condensée pour « fort », une machine à écrire pour « recette »).
- **Outil** : la mise en page, code du modèle (`FitText` pour la largeur). Existant depuis le 5 novembre, **une police par mot, qui l'évoque** (`WORD_FONTS`, `fonts: ["item"]` d'un skill sur sa voix, `docs/modeles.md`, « Une police par mot ») : une bibliothèque de familles Google Fonts rangées par ce qu'elles évoquent, où le remplisseur prend la police de chaque nom, au-delà de ses deux polices, trouvée par le code sur son texte (`reelTexts[i].font`). Le même contrôle du temps de lecture refuserait une paire entière tenue 0,67 s.
- **Si rien ne s'y prête** (pas de liste, ou sa charte avant tout) : les noms dans sa police des titres en grand et sa police des textes en petit ; le contraste de taille reste.

### 5. Le chiffre et ses trois mots empilés
- **Mesuré** : à 17,60 s, sur « forty-one », d'un coup : « 41 » dans une sans condensée très grasse (type Anton), 8,1 % de la hauteur, 15 % de la largeur ; à sa droite, 3 % de la largeur plus loin, trois mots en minuscules (la police des petites lignes) empilés, « consistent / creative / copycat », la pile aussi haute que le chiffre (trois lignes serrées), 22 % de la largeur. Le bloc est centré (de 29,6 à 68,9 % de la largeur), de 25 à 33 % de la hauteur. Tenu 4,0 s juste, il part d'un coup à 21,60 s ; puis 1,8 s sans rien au-dessus de sa tête jusqu'à la fin.
- **Sur quoi** : un chiffre qu'elle dit, et ce qu'il compte en trois mots : « 20 » avec « ans / de / métier », « 3 » avec « soins / pour / l'hiver », « 12 » avec « jours / avant / Noël », un prix.
- **Outil** : l'association `condensee-geometrique` existe (Bebas Neue et Jost 300 : « un chiffre ou un mot clé très serré à côté d'une phrase fine sur trois lignes ») ; la mise en page (le chiffre aussi haut que ses trois lignes), code du modèle ; le chiffre et ses mots, le remplisseur du skill calé sur sa voix (effet 3).
- **Si rien ne s'y prête** (pas de chiffre) : pas de bloc ; sa dernière idée garde son mot clé.

### 6. Les sous-titres de tout ce qui est dit, en tout petit sur sa poitrine
- **Mesuré** : de 0,23 s à la fin, sans interruption, par 1 à 4 mots (« So today », « I'm going », « to show you »…), un nouveau toutes les 0,3 à 1,7 s ; une sans géométrique demi-grasse en italique (type Poppins), blanche, avec un fin liseré et une ombre sombres ; hauteur des capitales 0,9 % de la hauteur (environ 24 px de police dans une image de 1080 × 1920) ; centrés, la ligne de base à 74,7 % de la hauteur, sur sa poitrine, devant ses mains. Des sous-titres automatiques, fautes comprises (« ones » pour « fonts », « copper », « Career », « Monserrat »). Les mots écrits en grand passent donc deux fois : au-dessus de sa tête et dans les sous-titres.
- **Sur quoi** : sa voix, toujours.
- **Outil** : existant, les sous-titres du moteur (`Subtitles` dans `Reel.tsx`, une seule rangée pour tout le Reel, `reelSubtitleRow`), en 50 à 56 px et jamais en italique (le choix de Tristan). Ils restent tant que le modèle dessine ses mots lui-même : `captions: "kinetic"` les remplace, et une animation qui écrit plus de 60 % des mots dits aussi (`SPOKEN_WRITTEN`). L'original garde les deux couches.
- **Si rien ne s'y prête** : toujours là.

### 7. Trois angles, une coupe entre deux idées, puis une respiration
- **Mesuré** : trois plans fixes (la chaise ne bouge pas d'un pixel dans chacun : un pied, aucun zoom, aucune poussée lente), à la même taille (la tête fait 15 % de la largeur, son haut à 44 – 46 % de la hauteur, au milieu) : de trois-quarts (0 – 5,63 s), de face (5,67 – 16,67 s), de trois-quarts comme le premier, un peu décalé (16,70 s à la fin ; deux caméras ou deux prises, pas clair). Deux coupes franches seulement, chacune à la fin d'une idée : 5,67 s, après « …amazing look. » (0,23 s après le départ de « FONTS »), et 16,70 s, après « …with Montserrat. » (la dernière paire part avec la coupe, sur le temps 30). Aucune coupe dans une phrase. Après chaque coupe, rien au-dessus de sa tête tant qu'il n'est pas arrivé au premier mot de la nouvelle idée : 1,4 s (« So you can decide to pair »), 0,9 s (« So this is day »).
- **Sur quoi** : sa vidéo face caméra : deux téléphones (de face et de trois-quarts), deux prises, ou une seule prise.
- **Outil** : existant, les coupes entre deux mots (`spokenShot`, `jumpCut` dans `speech.ts`) et, avec une seule prise, le recadrage serré tenu (`move: "punch"`, un cadre plus serré, jamais un zoom animé). Réglé pour un skill calé sur sa voix (`skillSaid`, 5 novembre) : ses pauses et ses « euh » coupés comme partout, mais le cadre ne change qu'entre deux idées (son autre prise calée sur leur son, sinon un cadre plus serré une idée sur deux), comme l'original.
- **Si rien ne s'y prête** (une seule prise courte) : aucune coupe ; les mots portent le rythme.

### 8. Une seule place pour tous les mots : au-dessus de sa tête, au milieu
- **Mesuré** : tout ce qui s'écrit en grand tient entre 20 et 34,4 % de la hauteur et entre 14 et 89 % de la largeur, centré sur l'image (le milieu de chaque bloc entre 48,5 et 52 %), jamais sur lui ni derrière lui : le haut de sa tête est 10 % plus bas. Le fond y est uni, rien derrière les mots.
- **Sur quoi** : le mur derrière elle, au-dessus de sa tête.
- **Outil** : existant, ses visages suivis (`track(frame).faces`, `SubjectBox`) pour poser le bloc au-dessus de sa tête, plan par plan, et le contrôle de contraste (`FAUVE_INK`) pour un mur clair. Pas comme `Captions kinetic` : jamais derrière elle (`behindHer`), jamais d'un côté puis de l'autre.
- **Si rien ne s'y prête** (sa tête en haut de l'image) : le bloc plus petit dans la place qui reste, sinon devant son buste, jamais sur son visage ; sur un mur clair, les mots à l'encre.

### 9. Le son : la voix devant, un beat qui attend l'accroche
- **Mesuré** : voir l'en-tête. Les textes suivent les mots, pas la musique : leurs instants tombent n'importe où entre deux temps (temps 12,7 · 14 · 15,2 · 17,1 · 18,3 · 20,3 · 21,6 · 23,7 · 25,2 · 27,7). Seuls les deux souffles accompagnent une image (les deux glissés).
- **Outil** : existant, la musique composée au tempo (`brief` de `lib/render/music.ts`) et posée sous une voix (`MIX_CASES`). Manquants (comme pour `decode`) : une musique qui n'entre qu'après l'accroche et perd sa basse 16 temps au milieu, et les bruitages d'un skill.
- **Si rien ne s'y prête** : la musique sous sa voix dès le début, sans souffle.

### 10. Étalonnage
Un rouge profond et saturé (saturation moyenne 0,71 à 0,79), une image sombre (luminance médiane 0,20 à 0,25), un contraste doux, la peau chaude. Le fond va de #480C01 – #6A1814 en haut à gauche à #B43C1E à droite, d'où vient la lumière (au milieu #972713, #992915 puis #A82F17 : le plan 3 est plus clair). Les coins du haut plus sombres, pas de grain qui bouge. La finition « Studio » du modèle (couleurs franches, contraste propre) va.

## Format
L'original est vertical 9:16, plein cadre : une vidéo face caméra filmée en vertical, la tête à mi-hauteur. Réglage « format » :
- `auto` : vertical quand sa vidéo l'est (le cas courant), horizontal sinon.
- `vertical` : plein écran, sa tête vers 45 % de la hauteur (le recadrage suit son visage), les mots dans la moitié haute, les sous-titres dans leur rangée.
- `horizontal` : une vidéo filmée en largeur, entière au milieu sur du noir (comme `frappe` ; le cadre « letterbox » du moteur) : les mots dans le noir au-dessus, les sous-titres dessous. Recadrée en vertical, sa tête serait en haut de l'image, sans place au-dessus.

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, le fond rouge uni, la caméra fixe, l'homme assis qui parle ; l'ordre et à peu près les temps de chaque texte (de inter / Tempting à 7,07 s jusqu'au « 41 » de 17,6 à 21,6 s, justes à une à trois images près) ; chaque nom écrit dans sa police, toutes bien nommées ; les petits mots au-dessus de « FONTS » ; les sous-titres à 74 % de la hauteur ; le micro-cravate ; l'étalonnage.

**Raté** :
- les **trois angles** : il voit un seul plan, « pas de changement de caméra » ; il y a deux coupes, à 5,67 et 16,70 s ;
- le **glissé** de « SO, TODAY » et de « FONTS » depuis la gauche, avec son rebond, son flou et son souffle grave : il dit « pop sec » et « apparition directe » ;
- les **places** : toutes ses boîtes sont entre 11 et 13,5 % de la hauteur ; les mots sont entre 20 et 34 %, juste au-dessus de la tête ;
- le **second nom de chaque paire**, qui arrive plus tard, quand il est dit : il fait de chaque paire un bloc « remplacé au cut » (il n'y a pas de coupe là) ;
- les **trois petites lignes** qui passent au-dessus de « FONTS », et sa sortie à 5,43 s (il dit 5,67 s, la coupe) ;
- les **sous-titres** : une géométrique italique demi-grasse, pas « sans-serif regular » ;
- le **tempo** (85 au lieu de 108), l'entrée de la musique à 2,82 s et sa basse coupée de 11,7 à 20,6 s.

## Ce que le modèle v1 ratait
Pas encore de skill : un Reel avec voix passe par la chaîne (monteur et motion designer). Ce qu'une version doit réussir, là où sa lecture (`house-models.ts`) et ses mesures (`house-measures.ts`) se trompent :
- **L'accroche** : sa lecture ouvre sur « une petite phrase qui s'écrit mot à mot » ; c'est l'inverse : ses deux premiers mots en grand, déjà là sur la 1re image, puis la petite ligne.
- **Le mot clé** : à 3,5 s, « qui remplace la petite phrase » ; il arrive à 1,73 s sur son mot, sous la petite ligne, et reste 3,7 s pendant que trois petites lignes passent.
- **La liste** : absente de ses moments, alors que c'est le cœur du Reel (7,1 à 16,7 s) : deux noms à la fois, chacun dans sa police, le second quand il est dit.
- **Le chiffre** : à 19 s, « tenus deux secondes » ; il arrive à 17,6 s, tenu 4 s, et le Reel finit 1,8 s plus tard sur ses mots seuls.
- **Le cadre** : « un seul plan fixe » ; trois angles, deux coupes entre les idées (`house-measures.ts` ne voit aucune coupe).
- **Les sous-titres** : « en tout petit en bas » ; à 74 % de la hauteur, sur sa poitrine, tout du long, en plus des mots en grand.
- **Les textes** : « casse normale, graisse black » ; l'accroche et le mot clé sont en capitales grasses d'une géométrique (type Poppins Bold, pas la condensée Bebas Neue de sa paire, qui ne vaut que pour le chiffre), les petits mots en minuscules normales, les noms dans leur casse.
- **La musique** : le tempo (108) est juste ; il manque son entrée après l'accroche et sa basse coupée au milieu.

## Ce qu'il faut filmer
- Elle (ou quelqu'un de l'équipe), face caméra, assise ou debout, téléphone vertical posé (un pied), devant un mur uni, plutôt foncé ou coloré : les mots sont blancs.
- Cadrée de la tête aux cuisses, **le haut de la tête vers le milieu de l'image** : toute la moitié haute reste libre pour les mots.
- Un son propre : un micro-cravate, ou le téléphone près d'elle.
- Ce qu'elle dit, 20 à 30 s d'une traite : deux mots pour commencer (« Alors aujourd'hui »), une idée portée par un mot (« trois SOINS pour l'hiver »), une liste qu'elle nomme (ses produits, ses prestations, des étapes), un chiffre pour finir (« 20 ans », « jour 12 »), puis au revoir.
- Si elle peut : la même prise de deux endroits (de face et de trois-quarts, deux téléphones), ou deux prises ; sinon le moteur recadre entre les idées.
