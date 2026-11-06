# « Rituel du matin » (`routine`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps (0,214 s).

**L'original** : `house/originals/routine.mp4` (le lien de Tristan : https://vm.tiktok.com/ZGdXrS7u7/), 58,54 s (1 756 images), 720 × 1280, 30 i/s, **vertical 9:16 plein cadre**, avec son. Un « a day in my life » d'une instructrice de Pilates : une bande-annonce de 2 s sous un titre tapé, son petit-déjeuner préparé geste par geste au comptoir (un bol de fruits, puis un matcha glacé), posé et vu d'en haut, son studio, puis la suite de sa journée. 61 plans (13 dans la bande-annonce), un seul texte. Plus long qu'un Reel d'Edith (45 s au plus, `MAX_REEL_SECONDS`) : le modèle garde sa structure dans 45 s.
**Sa musique** : un **beat lo-fi doux à 90,73 BPM** (un temps toutes les 0,6613 s, le premier à 0,214 s ; une mesure de quatre temps = 2,645 s). Sa grosse caisse frappe le 1 de chaque mesure et le « et » de 2 en swing (1,61 temps plus loin : 1,537 · 2,604 · 4,182… s) : de ses 43 coups graves les plus forts, de 1,54 à 58,2 s, 35 tombent à 30 ms de cette grille (les 8 autres sont dans le pont ou sont la voix). Ses accords changent tous les deux temps (1,32 s) du début à la fin ; sa grosse caisse disparaît de 44 à 52,9 s (un pont, les accords continuent), puis revient. Très bas sous la voix : −45 à −50 dB dans ses silences, contre −20 dB quand elle parle. Il ne s'arrête jamais et finit coupé net avec la dernière image. Le tout est très calme : −25,5 LUFS (les autres originaux sont à −14). `measure.py` donnait 133,5 BPM (sa pulsation mesurée, 90,75, était la bonne) ; Gemini disait 100 à 110 BPM, « guitare acoustique, percussion douce » : faux, aucune guitare ne s'entend.
**Sa voix** : une **voix off de femme**, calme (sa fondamentale vers 220 Hz), qui parle du début à la fin, du français selon Gemini (ses mots ne se lisent pas sur un spectre) ; elle mène le montage : ses phrases et ses gestes font les coupes. Ni bruitage, ni le son des gestes (glaçons, versements) : seulement la voix et la musique, en mono (le côté stéréo est à −64 dB). Ses mots sont **à l'original, jamais recopiés**.
**Mesuré avec** : `scripts/fiche/measure.py` (le format, 58 coupes, dont il manque deux sauts sur le comptoir et dont il fait les 13 de la bande-annonce ; 77 « clignotements » qui sont des gestes et des mouvements de caméra : rien ne s'allume), une recherche des sauts image par image à seuil bas (les 60 coupes), des planches à 10 et 30 i/s de chaque passage, des gros plans du titre et de sa petite ligne, les pixels restés immobiles pendant que la bande-annonce change (le titre seul), les couleurs prises sur les pixels (le titre, son débardeur, le comptoir, chaque partie), le mouvement dans chaque plan (aucun arrêt sur image), le son par bandes, son spectre, son niveau par 50 ms et ses côtés stéréo, les coups graves repliés sur leur mesure, et la lecture de Gemini (`house/breakdowns/routine.json`, lue une fois en base, aucun appel).

## Déroulé

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 2,07 | −0,3 – 2,8 | La bande-annonce : 13 éclairs de 4 ou 5 images, chacun un moment d'un plan qui revient plus tard, dans l'ordre du Reel : le bol fini dans ses mains, le matcha versé sur le lait, le petit-déjeuner vu d'en haut, l'enseigne du studio, son coin café, les lavabos, un selfie sur la machine, un exercice, la cuisine, ses jambes dans la rue, un selfie au soleil, une grande porte, une terrasse | Effet 1 |
| 0 – 0,80 | | « a day / in my life » tapé lettre à lettre au milieu, un curseur blanc après la dernière lettre | Effet 2 |
| 0,93 – 2,07 | | D'un coup, la petite ligne « pilates reformer + matcha » dessous ; tout part à la coupe | Effet 2 |
| 2,07 – 9,00 | 2,8 – 13,3 | Le bol, 8 plans du même cadre fixe de face : le bol posé, le pot de yaourt, la cuillère, le muesli versé, les myrtilles, une fraise (0,37 s), la banane coupée, le bol fini présenté des deux mains, tenu (8,10 – 9,00) | Effet 3 |
| 9,00 – 23,00 | 13,3 – 34,5 | Le matcha glacé, 14 plans du même cadre : le verre posé, les glaçons, la brique, le lait versé (1,6 s), le bol et le fouet, le tamis, la boîte, la poudre deux fois, le tamisage, l'eau chaude, le fouet, le matcha versé sur le lait, le verre fini, sa main posée dessus (22,00 – 23,00) | Effet 3 |
| 23,00 – 24,40 | 34,5 – 36,6 | Le bol et le verre posés sur un drap à pois, vus d'en haut (il joue : pas d'arrêt sur image) | Effet 4 |
| 24,40 – 42,20 | 36,6 – 63,5 | Son studio, 11 plans : l'enseigne lumineuse au-dessus de l'accueil (1,47 s), le coin café (1,23), le portant de la boutique (1,50), elle et une amie au miroir (1,27), les lavabos (1,43), elle qui entre dans la salle, de dos (1,33 et 1,13), un selfie au miroir sur sa machine (1,53), trois exercices téléphone posé (1,80 · 2,53 · 2,57) | Effet 5 |
| 42,20 – 58,43 | 63,5 – 88,0 | La suite de sa journée, 13 plans : la cuisine, la tomate coupée, l'assiette vue d'en haut, ses jambes dans la rue, un selfie au soleil, en voiture avec sa sœur, devant une porte (un saut à 51,60), une poussette sous les arbres, une terrasse, ses tables, la table et un enfant qui rit, la route vue du tableau de bord | Effet 6 |
| 58,43 – 58,54 | 88,0 – 88,2 | Trois images noires, la voix et la musique coupées net | Effet 7 |

Ni zoom, ni poussée, ni flash, ni fondu nulle part : des coupes franches (rien de ce que Tristan trouve cheap). La caméra est posée pour le comptoir, l'assiette, les exercices et les lieux calmes ; à la main pour les selfies, l'entrée dans la salle et la rue.

## Effets (ce qu'on veut savoir refaire)

### 1. La bande-annonce : un éclair de chaque chapitre, toutes les quatre ou cinq images
- **Mesuré** : 13 plans de 5, 4, 5, 5, 5, 4, 5, 5, 4, 5, 5, 5 et 5 images (4,77 en moyenne, 0,159 s), coupés net, 2,07 s en tout (images 0 à 61). Chacun est un moment d'un plan qui revient plus tard, dans l'ordre du Reel : 2 du petit-déjeuner (ses deux résultats, jamais ses étapes : le bol fini dans ses mains, le matcha versé), le petit-déjeuner vu d'en haut, 5 du studio, 5 de la suite de sa journée. Ses coupes ne tombent pas sur la musique : la double croche de 90,73 BPM fait 4,96 images, et elles dérivent de la grille. Ni flash, ni fondu, ni zoom ; les éclairs des lieux calmes bougent à peine (deux ou trois images immobiles sur cinq).
- **Sur quoi** : ses propres plans, montrés en avance (n'importe quel commerce : son rituel, son lieu, ses gens, son travail).
- **Outil** : `Footage at` (existant, comme les bandes de « Titre qui se décode ») : chaque éclair est un plan à venir montré quelques images en avance, depuis son milieu.
- **Si rien ne s'y prête** (moins de plans à venir que d'éclairs) : ses autres étapes, puis les mêmes plans à un autre de leurs moments.

### 2. Son titre tapé lettre à lettre avec son curseur, puis une petite ligne
- **Mesuré** : « a day / in my life » en minuscules, sur deux lignes centrées un peu au-dessus du milieu de l'image (la première de 38,3 à 62,1 % de la largeur, la seconde, plus longue, de 31,7 à 68,1 % ; de 43,1 à 54,6 % de la hauteur, lignes de 5,6 % de la hauteur), une grotesque italique grasse aux lettres très serrées (les mots se touchent presque : « aday », « inmylife »), crème #F6E2C1, à plat : ni ombre, ni halo, ni contour (la « lueur chaude » de Gemini n'existe pas). Tapé par une main irrégulière : « a » à l'image 1, « d » 4, « a » 10, « y » 11, à la ligne 12, « i » 14, « n » 18, « m » 19, « y » 20, « l » 22, « if » 23, « e » 24 (environ 15 lettres par seconde, de 0 à 6 images entre deux lettres). Un curseur blanc, fin, aussi haut que la ligne, après la dernière lettre, des images 0 à 28 (au début de la seconde ligne quand elle va à la ligne). À l'image 28, d'un coup, la petite ligne « pilates reformer + matcha » dessous : une géométrique fine en italique (comme Futura Light, une trentaine de pixels pour un cadre de 1 080), crème, centrée (33 à 66 % de la largeur, 55,1 à 56,6 % de la hauteur). Tout reste immobile jusqu'à la coupe sur le comptoir (image 62), où tout part.
- **Sur quoi** : n'importe quelle journée : son titre à elle en deux à quatre mots (« un matin au fournil », « une journée avec moi »), et ce qui fait sa journée en deux ou trois mots reliés par « + » (« fournil + café crème »).
- **Outil** : `TypeOn` (existant : irrégulier comme une main, curseur `bar` blanc), `FitText` ; sa petite ligne en `data-fauve-accent`, un petit libellé à côté d'un titre qui se lit. Ses deux polices : la grotesque de la paire « grotesque » (Inter Tight, en italique 600 serrée) et l'italique fine de sa police de texte (300).
- **Si rien ne s'y prête** : sans ligne, le titre seul.
- **À l'original, jamais recopié** : ses mots (« a day in my life », une formule de tendance en anglais : en français pour elle ; « pilates reformer + matcha », son activité et sa boisson).

### 3. Son rituel geste par geste, téléphone posé
- **Mesuré** : 22 plans d'un même cadre fixe de face, à hauteur de poitrine : son débardeur blanc remplit le haut de l'image (#CFCCD2), ses mains au milieu, le plan de travail en bois sombre (#4D3123) dans le dernier cinquième. Une étape par plan, coupée « au même endroit » (seul le geste change : 21 coupes sur 22) : 23, 27, 36, 31, 25, 11, 28, 27, 29, 28, 23, 48, 28, 23, 36, 28, 29, 27, 30, 34, 27 et 30 images (0,37 à 1,6 s, 0,95 s en moyenne). Les ingrédients et les ustensiles entrent dans l'image un à un ; chaque préparation finit sur son résultat présenté des deux mains, tenu immobile environ une seconde (le bol, la main sur le verre). Les gestes à leur vitesse (Gemini y voit un léger accéléré : rien ne le montre) ; les coupes suivent les gestes et la voix, pas les temps.
- **Sur quoi** : tout ce qui se prépare devant un comptoir ou une table : un café, une boisson, un petit-déjeuner, un bouquet, une pâtisserie, un soin.
- **Outil** : rien de plus : ses plans coupés sur ses gestes, le cadre fixe filmé par elle. Le moteur prend chaque étape là où le remplisseur la trouve (une vidéo de toute sa préparation donne toutes ses étapes).
- **Si rien ne s'y prête** : ses étapes filmées d'ailleurs (de dessus, de côté) ; les mêmes coupes.

### 4. Ce qu'elle a préparé, servi, vu d'en haut
- **Mesuré** : 1,40 s (42 images), plan fixe zénithal : le bol et le verre posés sur un drap blanc à pois noirs. Il joue (de petits mouvements à chaque image) : ce n'est pas l'« arrêt sur image » de Gemini.
- **Sur quoi** : ce qu'elle a préparé, posé sur une table, un comptoir ou un tissu, téléphone au-dessus.
- **Outil** : rien de plus.

### 5. Son lieu, plan par plan
- **Mesuré** : 11 plans de 1,13 à 2,57 s, les décors d'abord, puis les gens, puis l'activité, les plus longs à la fin : l'enseigne lumineuse ronde au mur de l'accueil, le coin café avec son menu au mur, le portant de vêtements sous un lettrage au mur où une main passe les cintres, elle et une amie qui sourient au miroir, les lavabos sous des rideaux, elle qui entre dans la salle (de dos, suivie), un selfie au miroir sur sa machine, trois exercices filmés téléphone posé (1,80 · 2,53 · 2,57 s).
- **Sur quoi** : son enseigne ou sa devanture, ses coins, son équipe et ses clients, sa salle, son métier en action.
- **Outil** : rien de plus.
- **À l'original, jamais recopié** : le nom et le logo du studio sur son enseigne, son lettrage « REFORMER STUDIO », le « COFFEE SHOP » et les noms des boissons de son menu, les marques du yaourt, du lait et du matcha.

### 6. La suite de sa journée
- **Mesuré** : 13 plans de 0,9 à 2,1 s (16,2 s en tout) : son déjeuner à la maison, ses jambes dans la rue, un selfie au soleil, la voiture, une porte, une promenade, une terrasse en famille, la route ; la grosse caisse de la musique s'efface de 44 à 52,9 s, puis revient.
- **Sur quoi** : la suite de sa journée, chez n'importe qui : une pause, une sortie, une terrasse, le soir.
- **Outil** : rien de plus. Dans le modèle, seulement dans ses versions longues (30 plans et plus) : c'est le chapitre qui ne tient pas dans 45 s.

### 7. La fin : trois images noires, le son coupé
- **Mesuré** : la route (1,03 s), puis trois images noires (58,43 – 58,54 s) ; la voix et la musique coupées net avec la dernière image. Rien d'autre : ni carte, ni logo, ni texte.
- **Outil** : la composition (le noir) et la forme de la musique (`music.end`, coupée net).
- **En option** (une carte de fin) : sa phrase tapée comme le titre, sur le noir, sa ligne dessous (Tristan, sur les cartes de fin : « en option »).

### 8. Sa voix off et sa musique
- **Mesuré** : plus haut (« Sa voix », « Sa musique »).
- **Outil** : la musique composée d'Edith, à 90,73 BPM (« soft lo-fi hip-hop beat, mellow chords, swung kick, no vocals »), son premier temps fort à 0,214 s (`music.downbeat`), coupée net à la fin. Sa voix off est à l'original ; une voix sur un modèle (la sienne, celle d'Edith) envoie aujourd'hui le Reel à la chaîne (chantier B de `docs/reprise.md`).

### 9. Étalonnage
Naturel et doux, lumière du jour : des blancs neutres un peu froids (#E0E2E9 au plus clair du comptoir), des ombres chaudes (#3B1F14, le bois), des noirs un peu levés (le plus sombre à 30 – 47 sur 255), une saturation modérée, contraste doux ; ni grain, ni coins sombres. Gemini le voyait « chaud, doré » : seulement ses ombres le sont.

## Format
**Depuis le 6 novembre** (Tristan, sur sept bancs : « vertical please », « tout vertical please ») : `vertical` par défaut, plein écran, ses fichiers horizontaux recadrés sur leur sujet ; `horizontal` (sa bande) seulement à sa demande, ou quand elle veut ses vidéos entières (le `frame` letterbox de son contrat) ; `auto` (comme ses vidéos, ci-dessous) seulement si elle le demande. `docs/modeles.md`, « Réglages d'un modèle ».

L'original est vertical 9:16, plein cadre. Réglage « format » :
- `auto` (par défaut) : comme ses vidéos : vertical plein cadre, ses vidéos horizontales entières dans une bande 16:9 sur du noir quand la plupart le sont ;
- `vertical` : vertical plein cadre, ses vidéos horizontales recadrées sur leur sujet ;
- `horizontal` : ses vidéos entières dans une bande 16:9 sur du noir.
Dans tous les cas, son titre reste au même endroit, un peu au-dessus du milieu de l'image (dans la bande quand elle y est).

## Ce que Gemini a vu, et ce qu'il a raté
**Vu** : le format, la bande-annonce de 2 s qui résume la journée, le titre « tapé lettre par lettre » avec son curseur, ses deux niveaux (un titre et un sous-titre plus fin), sa place au milieu, la préparation du bol puis du matcha, la vue de dessus, le studio, la suite de la journée, la voix off de femme, la structure du Reel en sections (à quelques images près).

**Raté** : le **tempo** (100 – 110 au lieu de 90,73) et la musique (« guitare acoustique » : un beat lo-fi à la grosse caisse swinguée), le **nombre des éclairs** (« ~10 cuts » : 13), les **deux sauts** sur le comptoir (17,10 et 18,07 s), le **matcha versé et le selfie** parmi les éclairs, une « **lueur chaude** » derrière le titre (il est à plat), un « **arrêt sur image** » sur la vue de dessus (elle joue), un « **léger accéléré** » des gestes (rien ne le montre), un « **fondu au noir** » final (trois images noires d'un coup), la place de la petite ligne (elle n'arrive qu'à l'image 28, quand le titre est tapé). `measure.py`, lui, voyait 133,5 BPM, 58 coupes (deux sauts manquants) et 77 « clignotements » qui sont des gestes.

## Ce que fait le modèle v1 (5 novembre)
`skills/routine.ts`, version 1 (à valider sur /admin). 90,73 BPM ; chaque longueur est celle de l'original en images, comptée en temps de sa musique : ses coupes tombent où l'original coupe (à une image près) à son tempo, et suivent un autre tempo.
- **Sa structure dans 45 s** : la bande-annonce (2,07 s), son rituel en 6 à 16 gestes (gardés dans l'ordre parmi les 22 de l'original : toujours le premier, l'éclair de 11 images, le long versement de 48 et le résultat), ce qu'elle a préparé vu d'en haut (1,4 s), son lieu en 4 à 11 plans (toujours l'enseigne d'abord et son métier en action à la fin), et, à partir de 30 plans, la suite de sa journée (1 à 4 plans : le chemin du retour d'abord). 12 plans font 15,9 s, 16 en font 22,5, 22 (le plus qu'elle donne sans demander de durée) 30,2 s, 33 (pour une durée qu'elle demande) 42,2 s, 43,7 avec une carte de fin. Son tempo va de 89 à 109 BPM, jamais plus lent : 43 s au plus sans carte.
- **La bande-annonce** : 13 éclairs aux longueurs de l'original ; le premier est son propre plan (son résultat fini), puis le geste de versement, la vue de dessus et ses plans à venir, dans l'ordre du Reel, chacun depuis son milieu ; s'il en manque, ses autres gestes, puis ses derniers plans (son travail) revus à un autre moment.
- **Le titre** : tapé par `TypeOn` en deux lignes équilibrées (la seconde jamais plus courte), en italique 600 serré (−0,045 em) de sa police de titre, 110 px, crème (sa couleur claire quand elle l'est assez, sinon #F6E2C1), son curseur blanc jusqu'à sa ligne ; sa ligne d'un coup à l'image 28, en italique 300, 36 px, en `data-fauve-accent` ; tous deux jusqu'à la coupe. À plat comme l'original, sauf un bord serré à peine visible (deux ombres brunes à 40 % de 1 à 2 px) : au premier rendu local, le crème disparaissait sur un verre filmé sur fond blanc (les blancs de l'original sont chauds, ses verres sur un comptoir en bois). Ses mots : `titre` (24 signes) et `ligne` (facultative, 26).
- **La fin** : trois images noires, la musique coupée net ; sa carte de fin (en option) tapée comme le titre sur le noir, plus vite (le moteur donne 1,6 s à une carte), sa ligne dessous à sa 16e image, une seconde à l'écran.
- **Rien de dessiné sur ses plans** : ni détourage, ni objet suivi, ni lecture, ni bruitage ; sa finition « Lumière du matin » (contraste −0,04, chaleur 0,04, noirs levés 0,04), sans grain ni coins sombres.
- **Ce qui manque** : sa voix off (une voix envoie un modèle à la chaîne : chantier B) ; le pont de la musique (sa grosse caisse effacée de 44 à 52,9 s) n'est pas refait, la suite de sa journée étant rare ; la petite ligne reste 1,2 s, et le contrôle des scènes en demande 1,7 pour la lire (une remarque, à son moment de l'original).

**Rendus en local** (5 novembre, `scripts/skill-render.mts`, des vidéos libres de Mixkit pour un café : un verre de glaçons où l'on verse le lait, un bol de fruits garni, un café glacé, le bol vu d'en haut, un panneau retourné de « closed » à « open », le comptoir, une cliente, la salle, un latte art ; en vertical) : 12 plans (15,9 s) puis 16 plans avec une carte de fin (24,1 s), le contrôle des scènes sans refus. Moment par moment, la structure est celle de l'original (le titre tapé et son curseur, sa ligne à l'image 28, les éclairs dans l'ordre du Reel, le rituel, la vue de dessus, le lieu qui ouvre, la fin) ; la différence vient des vidéos : son rituel est un seul cadre fixe de face à hauteur de poitrine, ces vidéos libres viennent de tournages différents. Le crème du titre disparaissait sur le verre filmé sur fond blanc : d'où son bord serré. Une remarque reste : sa petite ligne tient 1,2 s, le contrôle en demande 1,7.

## L'effet dans la banque (« Bande-annonce tapée »)
`pieces/routine.ts`, version 1 : la bande-annonce posée en ouverture de n'importe quel Reel, sur 3 à 10 de ses plans, 1,5 à 3,5 s. Un éclair toutes les quatre ou cinq images (les coupes de l'original, répétées), chacun le plan suivant sous lui à un autre de ses moments (le premier à son propre moment), son titre tapé avec son curseur, sa ligne d'un coup aux 28/62 de sa durée ; le montage reprend à sa dernière image. Un effet ne voit que les plans posés sous lui : ses éclairs sont ces plans-là, jamais ceux qui suivent. Proposé dès trois de ses fichiers (n'importe lesquels).

## Ce qu'il faut filmer
1. **Son rituel** : le téléphone posé, en vertical, de face, à hauteur de poitrine devant son comptoir ou sa table (son haut au fond, ses mains au milieu, le plan de travail en bas), l'exposition bloquée ; une préparation geste par geste, d'une traite ou en plusieurs vidéos : elle pose ce qu'elle va remplir, verse, ajoute, coupe, mélange, puis présente le résultat des deux mains vers l'objectif et le tient une seconde.
2. **Ce qu'elle a préparé vu d'en haut**, posé sur une table, un comptoir ou un tissu.
3. **Son lieu** : son enseigne ou sa devanture de face, deux ou trois coins (son comptoir, ses étagères, sa vitrine), elle avec quelqu'un de l'équipe ou une cliente, elle qui entre dans la salle (filmée de dos), elle au travail (téléphone posé, des gestes qui durent).
4. **Pour un Reel plus long** : la suite de sa journée (une pause, une sortie, une terrasse, le chemin du retour).

Et son titre en deux à quatre mots, et ce qui fait sa journée en deux ou trois mots.
