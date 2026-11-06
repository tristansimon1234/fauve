# « La pièce qui se rallume » (`rallume`) : fiche d'un modèle sans original

> Fiche d'un modèle écrit comme un dessin, sans Reel d'origine : une idée de Tristan. Ce qu'il fait, temps par temps, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (un café, un bar, une fleuriste, une boutique, un restaurant ; la méthode : `docs/modeles.md`, « La chaîne des modèles »). « Temps » compte les temps de sa musique depuis son premier temps ; les secondes sont à son tempo, pour 10 plans.

**L'original** : aucun. L'idée : son lieu dans le noir, puis ce qu'il a plusieurs fois (ses lampes, ses bouteilles, ses tasses, ses plantes, ses pièces) se rallume un par un, chacun à sa propre lumière, puis toute la pièce d'un coup ; puis la vie de son lieu. Rien n'est mesuré ni recopié : ce qui suit est un dessin, vérifié en local sur les vidéos d'un bar (`scripts/skill-render.mts`, plus bas).
**Sa musique** : à composer, un groove chaud de fin de soirée, **96 BPM** (un temps toutes les 0,625 s, une mesure de quatre temps = 2,5 s). Consigne proposée : « warm late-night soul groove, Rhodes chords, soft kick on every beat » (un coup grave sur chaque temps, pour que `beatGrid` trouve sa grille). Sa forme (`music` du déroulé, `docs/son.md`, « Forme de la musique d'un modèle ») : **étouffée** comme derrière un mur tant que la pièce est dans le noir, **ouverte d'un coup** sur le temps où tout se rallume, étouffée de nouveau quand tout s'éteint à la fin, coupée avec l'image : sa fin sonne comme son début, le Reel reboucle sans couture.
**Ses bruitages** (`sounds` du déroulé) : un petit clic d'interrupteur sur chaque lumière (« light switch click », huit, le premier un peu plus fort), un clic plus lourd quand toute la pièce se rallume (+3 dB) et quand tout s'éteint (+1 dB) (« heavy light switch clunk »).

## Déroulé

| Temps | De – à (s) | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 4 | 0 – 2,5 | Son lieu en plan large, de l'intérieur, dans le noir | **La pièce dans le noir** (1) ; **ses objets se rallument un par un** aux temps 0 · 1 · 1,5 · 2 · 2,5 · 2,75 · 3 · 3,25, de plus en plus vite, chacun avec son clic (2) ; musique étouffée |
| 4 | 2,5 | La même pièce | **Toute la pièce d'un coup**, sur le premier temps de la deuxième mesure, clic lourd, la musique s'ouvre (3) ; **son nom s'allume comme une enseigne** (4) |
| 4 – 8 | 2,5 – 5 | La pièce allumée, son nom au-dessus | — |
| 8 – 18 | 5 – 11,25 | La vie de son lieu : huit plans de 1, 1 et 2 temps | Coupes franches sur le temps (6) |
| 18 – 20 | 11,25 – 12,5 | Son lieu en plan large une dernière fois, allumé | — |
| 20 – 21 | 12,5 – 13,13 | La même pièce, éteinte, son nom encore allumé | **Tout s'éteint d'un coup**, clic lourd, la musique étouffée de nouveau ; le Reel reboucle sur son début (5) |

Moins ou plus de fichiers : de 6 à 14 plans (10 à 16,9 s), la vie de son lieu plus ou moins longue (1, 1, 2 temps, toujours dans cet ordre) ; pour une durée qu'elle demande, jusqu'à 24 plans (29,4 s à son tempo), les plans ajoutés tenus deux temps (`long`). Avec une carte de fin (en option) : la pièce reste éteinte trois temps (1,875 s) au lieu d'un, la carte allumée dedans.

## Effets (ce qu'on veut savoir refaire)

Aucun zoom ni poussée : des coupes franches (la règle du monteur ; aucun original ne demande d'exception). Les photos restent fixes, les vidéos jouent.

### 1. La pièce dans le noir
- **Ce qui se passe** : son plan large d'abord, à un cinquième de sa lumière et un peu plus froid (`brightness(0.24)`, `saturate(0.7)`, puis un bleu gris en `multiply`) : on devine la pièce et ses lampes éteintes, comme une salle le soir, la lumière de la rue seulement.
- **Sur quoi** : n'importe quel plan large de son lieu vu de l'intérieur, une vidéo posée ou qui bouge lentement, ou une photo ; le mieux le soir, ses lumières allumées (elles se rallumeront avec leur propre éclat).
- **Outil** : code du modèle (`Footage` filtré, un aplat en `multiply`).

### 2. Ses objets qui se rallument un par un, chacun à sa lumière
- **Ce qui se passe** : ce que son lieu a plusieurs fois se rallume une pièce après l'autre, aux temps 0, 1, 1,5, 2, 2,5, 2,75, 3 et 3,25 (de plus en plus vite, une attente avant le temps 4), et ce qui est allumé le reste. Chaque pièce garde sa propre image, un peu plus vive et plus chaude (`brightness(1.18) saturate(1.1)`), et un éclat fait de ses propres hautes lumières (sa découpe une seconde fois, très contrastée, `contrast(2.6)`, puis floutée, 12 px sur l'image 16:9, posée en `screen`) : ce qui brille (une ampoule, son verre) rayonne, ce qui ne brille pas (le culot de laiton d'une suspension, l'étiquette d'une bouteille) reste tel quel ; une flaque de lumière chaude s'en échappe sur la pièce et s'allume comme une ampoule (à moitié, trop fort, un peu moins, puis elle-même, sur trois images). Ses lumières d'abord, puis ce qui est aligné, ce qui est posé, ses plantes ; chaque sorte de gauche à droite et de haut en bas.
  - Beaucoup de pièces (huit ou plus, 48 au plus) : une ou plusieurs sur chaque temps, dans cet ordre.
  - Peu (de une à sept) : une par temps, puis la lumière de la pièce elle-même revient d'un cran sur chaque temps qui reste, avec un scintillement d'une image (des néons qui démarrent).
  - Aucune : la pièce revient cran par cran, huit fois, puis d'un coup.
- **Sur quoi** : ce qui se voit plusieurs fois dans son plan large, jusqu'à quatre sortes, nommées par le remplisseur d'après la lecture de sa vidéo (objets du modèle sur son premier plan, « every … » devant chaque sorte répétée) : `lampes`, ses lumières (« every pendant lamp », « every lamp », « every candle », « string lights », « neon sign ») ; `rangees`, ce qui est aligné (« every bottle », « every jar », ses livres) ; `tables`, ce qui est posé sur ses tables ou son comptoir (« every cup », « every wine glass ») ; `plantes`, ses plantes, ses fleurs ou ce qu'elle vend en série (« every plant », « every bouquet », ses vêtements sur un portant). Ce qui est hors de l'image (une lampe coupée par le cadre horizontal) ne compte pas.
- **Outil** : existant. Les morceaux d'un objet suivi (`SubjectParts`, `docs/detourage.md`, « Les morceaux d'un objet » : « every lamp » suit chacune, 12 au plus ; un objet d'un seul tenant est une seule pièce) et sa découpe (`Subject object=…`) posée à sa lumière dans la boîte de ses pièces allumées (un `clip-path: path()` fait de leurs rectangles, un par sorte) ; les flaques en `radial-gradient` posées en `screen` (code du modèle). Les pièces et leurs temps sont choisis sur la dernière image dans le noir, puis placés là où elles sont à chaque image (la caméra peut bouger). La lumière de chaque pièce est la sienne, filmée : le modèle ne la repeint pas (comme « Lieu tapé » v4 : un néon déjà allumé, poussé plus fort, brûlait en taches blanches).
- **Ce qui manque** : le nombre de pièces trouvées n'est connu qu'au rendu (le suivi sur la carte, après le plan) : les huit clics tombent sur huit temps fixes, et le code remplit les temps sans pièce par la lumière de la pièce qui revient. Un suivi fait avant le plan donnerait un clic par pièce, et la couleur de chacune (la moyenne de sa boîte) donnerait à sa flaque sa propre teinte (aujourd'hui un blanc chaud pour toutes).
- **Limite** : quatre objets par Reel et 20 s de vidéo suivie au plus (`OBJECT_MAX`, `OBJECT_MAX_SECONDS`) : son premier plan dure 5 s à 96 BPM, ses quatre sortes y tiennent tout juste (4 × 5 s) ; à un tempo plus lent, la quatrième tombe (le modèle fait sans).

### 3. Toute la pièce d'un coup, sur le temps
- **Ce qui se passe** : au temps 4 (2,5 s), toute l'image revient à sa lumière comme un disjoncteur qu'on remonte : deux images plus vives (×1,3 puis ×1,12, et un voile chaud en `screen` de 20 puis 8 %), les flaques de ses objets qui s'effacent en dix images, la lumière de la pièce prenant le relais ; un clic lourd ; la musique s'ouvre d'un coup. Ses objets ne sont plus découpés à ce moment : posés à leur lumière sur la pièce déjà allumée, leurs bords se voyaient (banc local, plus bas).
- **Sur quoi** : le même plan.
- **Outil** : code du modèle ; la forme de sa musique (`filters` `muffled` de 0 au temps 4, ouverte en 20 ms).

### 4. Son nom qui s'allume comme une enseigne
- **Ce qui se passe** : avec la pièce, son nom s'allume dans sa police de titres, en blanc chaud avec un halo d'ampoule sur trois rayons (ou dans sa couleur, réglage `couleur`), comme un néon qui prend : éteint, allumé, presque éteint, allumé, à moitié, allumé (une image chacun). Une petite ligne en capitales espacées (« bar à vins », « dès 18 h ») s'allume de même trois images après.
  - En horizontal : son nom au-dessus de l'image, sur le noir (comme l'enseigne au-dessus d'une vitrine), sa ligne dessous ; allumés jusqu'à la fin, même quand tout s'éteint.
  - En plein écran : dans la partie calme de son plan large (son plafond, un mur ; `ClearBox`, en haut de préférence, sinon à 15 % de la hauteur), jusqu'à la coupe ; puis de nouveau à la même place dans la pièce éteinte, à la fin.
- **Sur quoi** : son nom tel qu'on le lit sur sa devanture (22 caractères au plus, plus il est court plus il est grand) ; ses mots à elle pour la ligne (deux à quatre, une étiquette `data-fauve-accent`).
- **Outil** : code du modèle, `ClearBox` (existant) ; la paire « éditorial » (Instrument Serif sur Inter Tight en capitales espacées) quand le modèle est le sien, sa charte quand Edith le choisit.

### 5. Tout s'éteint d'un coup, et le Reel reboucle
- **Ce qui se passe** : son dernier plan large, allumé deux temps, puis tout s'éteint d'un coup sur le temps (clic lourd), à la lumière de l'ouverture ; son nom reste allumé dans le noir, la musique étouffée de nouveau, coupée avec l'image : la dernière image ressemble à la première, le Reel reboucle sans couture. Avec une carte de fin (une offre, une date ; en option) : elle s'allume dans le noir comme son nom (son titre dans sa police de titres, sa ligne dessous), son nom éteint.
- **Sur quoi** : son plan large une dernière fois (le premier à un autre moment, ou un autre plan large de la salle).
- **Outil** : code du modèle ; la forme de sa musique (`filters` `muffled` de nouveau, `end` à la fin du Reel).

### 6. La vie de son lieu
- **Ce qui se passe** : des plans de 1, 1 et 2 temps, coupés franc sur le temps, à leur lumière : quelqu'un qu'on sert, un détail de près (un verre qu'on remplit, des mains), des gens ensemble, un geste de son métier, quelqu'un qui arrive, un détail sous ses lumières, quelqu'un qui goûte, son lieu plein.
- **Outil** : les coupes du modèle (existant).

### 7. Étalonnage
Chaud et doré, les noirs profonds, un léger halo sur les hautes lumières (ses lampes) ; ni grain ni coins sombres (le noir au-dessus et au-dessous de l'image horizontale n'en porte pas : retirés de sa finition, `MontageSkill.finish`). Le modèle dessine lui-même son noir et ses lumières : sa lumière de lecture est naturelle (`grade`), comme les skills qui dessinent la leur.

## Format
**Depuis le 6 novembre** (Tristan, sur sept bancs : « vertical please », « tout vertical please ») : `vertical` par défaut, plein écran, ses fichiers horizontaux recadrés sur leur sujet ; `horizontal` (sa bande) seulement à sa demande, ou quand elle veut ses vidéos entières (le `frame` letterbox de son contrat) ; `auto` (comme ses vidéos, ci-dessous) seulement si elle le demande. `docs/modeles.md`, « Réglages d'un modèle ».

Réglage « format », comme « Lieu tapé » (`setting("format", "auto")`, lu sur `shots[i].aspect`) :
- `auto` : horizontal quand la plupart de ses vidéos le sont, sinon vertical ;
- `horizontal` : 16:9 sur du noir (1080 × 608 au milieu du cadre), son nom allumé au-dessus de l'image, sa ligne dessous ;
- `vertical` : plein écran, son nom dans la partie calme de son plan large.

Les places et les tailles sont des parts de l'image : elles valent dans les deux formats.

## Ce que le banc local a montré (5 novembre)
Rendu en local (`scripts/skill-render.mts`, aucun appel facturé, sans musique ni bruitages : le mixage est celui de l'atelier) sur une séance libre de Pexels, un bar d'hôtel le soir sous ses suspensions (Pavel Danilyuk, vidéos 7426762, 7426386, 7426764, 7426667, 7426419, 7426748, 7426833, 7426832, 7426747 et 7426378, 2,37:1 en 1920 × 810), « L'Heure Bleue », « bar à cocktails », 10 plans, 13,1 s, en horizontal. Le plafond et ses suspensions dans le noir, la caméra qui descend vers le bar ; 11 lampes trouvées sur une image (« every pendant lamp », 0,70), qui s'allument de gauche à droite, chacune avec sa flaque ; toute la salle d'un coup sur le temps 4, le client au comptoir qui apparaît en bas ; son nom en Instrument Serif blanc chaud au-dessus de l'image ; la vie du bar ; tout s'éteint à 12,5 s, son nom reste allumé. Le contrôle des scènes passe sans remarque, en horizontal comme en plein écran.
- Le suivi des lampes : le suivi de la carte prend la majeure partie d'une heure sur ces CPU partagés ; à sa place, les lampes trouvées sur une image (`track_objects.py`, `OBJECTS_CPU=1`) suivies par le mouvement de la caméra (son décalage d'image en image) et gardées à ce qui brille dans chaque image. Une lampe plus proche bouge un peu plus vite dans un panoramique : le décalage seul laissait un bord de bois sombre allumé autour de certaines.
- Corrigé pendant le banc : un liseré serré et vif autour de chaque pièce (un `drop-shadow`) dessinait le bord d'un autocollant, et un halo large autour de sa forme allumait aussi le culot de laiton des suspensions : l'éclat vient maintenant de ses seules hautes lumières ; ses objets reposés à leur lumière sur la pièce déjà allumée, sur le temps 4, montraient leurs bords (retirés : la lumière de la pièce prend le relais, leurs flaques s'effacent).
- À voir au banc : le noir (un cinquième de la lumière) sur une salle de jour, et des tasses ou des bouteilles au lieu de lampes (leur halo est plus petit que celui d'une lampe) ; la carte de fin, jamais rendue ici.

**Bancs du 5 novembre** (« Le Salon », un bar d'hôtel, 15 vidéos Pexels ; faits par la chaîne d'Edith) : le premier est sorti sans ses lampes une à une, Modal n'ayant eu aucune carte libre en 90 s (son plan B a rallumé toute la pièce d'un coup ; corrigé : une A100 demandée aussi, une lecture ratée faute de carte redemandée deux minutes plus tard) ; le second les allume une à une, mais la carte a lu les suspensions en boîtes (12 morceaux, aucun contour) : les petites s'allumaient en rectangles nets, une grande à moitié. **Version 2** : chaque morceau allumé se voit par un ovale doux un peu plus grand que sa boîte (seuls les pixels de son détourage s'allument, donc la pièce ne s'éclaire pas autour), et deux morceaux qui se touchent s'allument ensemble.

**v4 du 6 novembre** (Tristan : « les scènes de fin avec le nom du commerce sont souvent trop courtes » ; banc « La Cave d'Hortense » : son nom allumé 0,6 s dans le noir à la fin) : le noir de la fin tenu quatre temps au lieu d'un, son nom entier 2,3 s une fois son tube allumé (le moteur, `heldEnding`, d'après la fin que déclare son minutage) ; en 16:9, rien d'ajouté (son nom est allumé au-dessus de l'image depuis que la pièce se rallume). Banc local (Claude à la main) : 13,13 s → 15 s.

## Ce qu'il faut filmer
Son lieu de l'intérieur en plan large, le soir de préférence, ses lumières allumées (des suspensions, des lampes, des bougies, une guirlande) et ce qu'il a plusieurs fois (ses bouteilles, ses tasses, ses plantes), la caméra posée ou qui bouge lentement, 5 s au moins ; puis 6 à 12 moments de la vie de son lieu (quelqu'un qu'on sert, des mains, des gens ensemble, un geste) ; et son plan large une dernière fois (ou le même, plus loin dans la vidéo).
