# « Photo dump » (`photo-dump`) : fiche de l'original

> Fiche d'un original : ce qu'on y voit, mesuré image par image, et les effets qu'on veut savoir refaire sur les vidéos de n'importe quel commerce (la méthode : `docs/modeles.md`, « La chaîne des modèles »). Les temps sont en secondes de l'original ; « temps » compte les temps de sa musique depuis son premier temps.

**L'original** : `house/originals/photo-dump.mp4`, 11,30 s (339 images), 720 × 1280, 30 i/s, **vertical 9:16** plein cadre, avec son. Le modèle prend tout le Reel (pas de passage dans `HOUSE_PASSAGES`).
**Sa musique** : un beat hip-hop / R&B avec une voix presque tout du long (rappée d'après Gemini ; le spectre montre des syllabes ; genre à confirmer à l'écoute). **104,5 BPM** : un temps toutes les 0,574 s, le premier à 0,07 s. Assez sûr : la boucle revient toutes les 2,30 s (une mesure de 4 temps), et 16 de ses 20 temps tombent sur un coup net, à 25 ms près (la plupart à 10). Gemini disait 86, le catalogue 115, le skill v1 85 : faux. Le groove est syncopé en 3-3-2 (des coups toutes les 0,43 s, soit trois doubles-croches ; d'où les faux 139,5 et 83,5 de la mesure, 3 et 5 doubles-croches). Basse grave et tenue. Volume constant : −14,1 LUFS, 0,7 LU d'écart, ±1 dB d'une seconde à l'autre, ni montée ni pause. La musique part à plein dès la première image et s'arrête net sur la dernière, au temps 19,6, au milieu d'une mesure.
**Mesuré avec** : `scripts/fiche/measure.py` (coupes, tempo), la boîte de chaque image mesurée à chaque image en pleine résolution, le mouvement dans chaque image, les couleurs lues au pixel, la musique (sa partie percussive séparée, sa boucle par l'autocorrélation du spectre, son volume par seconde), des planches à 30 i/s de tout le Reel, et la lecture de Gemini (`house/breakdowns/photo-dump.json`).

## Déroulé

Tout du long : un fond gris uni #EFEFEF et, au centre, une seule image à la fois, à sa forme, à 80 % de la largeur (effet 1). 32 images de 9 à 14 images chacune, en coupes sèches (effet 2).

| De – à (s) | Temps | Ce qu'on voit | Effets |
|---|---|---|---|
| 0 – 2,30 | −0,1 – 3,9 | Six images, six formes : 1 un selfie dans un ascenseur avec un chien (photo 3:4, images 0–9) ; 2 un livre sur un drap (photo 5:6, 10–19) ; 3 une femme sur un ponton (**vidéo 9:16**, 20–32) ; 4 un maillot sur une serviette (photo 4:3, 33–43) ; 5 un selfie au lit (photo 3:4, 44–54) ; 6 une barque au couchant (**vidéo 16:9**, 55–68) | L'ouverture en six formes (effet 5), deux vidéos (effet 3) |
| 2,30 – 4,07 | 3,9 – 7,0 | Cinq photos 3:4 : 7 le chien dans l'ascenseur (69–78) ; 8 un couchant sur des maisons blanches (79–89) ; 9 des tirages encadrés sur un mur brun (90–100) ; 10 un selfie en cabine d'essayage (101–110) ; 11 une lampe smiley dans le noir (111–121) | Le chien et l'ascenseur reviennent (effet 5) |
| 4,07 – 4,37 | 7,0 – 7,5 | 12 un caniche sur des genoux : photo 3:4 **plus petite** (58,8 % de la largeur), 9 images | Une image plus petite (effet 4) |
| 4,37 – 5,47 | 7,5 – 9,4 | 13 la mer de nuit (photo 4:3, 131–140) ; 14 des écouteurs sur un jean (photo 4:3, 141–151) ; 15 une falaise et deux paddles (**vidéo 9:16**, 152–163) | Une vidéo (effet 3) |
| 5,47 – 6,87 | 9,4 – 11,8 | Quatre photos 3:4 : 16 deux amis devant une vitrine (164–173) ; 17 un miroir de boutique (174–184) ; 18 un selfie en t-shirt (185–195) ; 19 un voilier (196–205) | — |
| 6,87 – 7,30 | 11,8 – 12,6 | 20 une femme qui descend des rochers (**vidéo 16:9**, 206–218, 13 images) | Une vidéo (effet 3) |
| 7,30 – 10,93 | 12,6 – 18,9 | Onze photos 3:4, surtout des gens : 21 le selfie de l'ascenseur revient (219–227) ; 22 deux femmes dans un escalier (228–236) ; 23 assise de nuit devant une vitrine (237–246) ; 24 le chien, pattes sur des genoux (247–255) ; 25 une bande de photomaton (256–265) ; 26 la proue d'un bateau face au soleil (266–276) ; 27 une rue, un vélo chargé de plantes (277–285) ; 28 au comptoir d'un bar rouge (286–296) ; 29 un selfie au miroir en sweat (297–307) ; 30 deux amies qui envoient un baiser (308–318) ; 31 un selfie dans un grand miroir blanc (319–327) | Le fil revient (21, 24 : effet 5) |
| 10,93 – 11,30 | 18,9 – 19,6 | 32 des objets posés sur une table (sac, appareil photo, baskets), photo 3:4, 11 images comme les autres ; la musique s'arrête net | La boucle (effet 6) |

## Effets (ce qu'on veut savoir refaire)

### 1. Une image à la fois, au centre, à sa forme, toutes à la même largeur
- **Mesuré** : le fond est un gris uni #EFEFEF (239, 239, 239), sans grain (aucun écart d'un pixel à l'autre). Chaque image est centrée (à 0,1 % près) et large de 80,0 % de l'image (576 px sur 720, de 10 % à 90 %). Sa hauteur suit sa forme : 3:4 → 60 % de la hauteur, 9:16 → 80 %, 5:6 → 54 %, 4:3 → 34 %, 16:9 → 25 %. Angles droits, ni bord, ni ombre, ni inclinaison. Elle arrive d'un coup et ne bouge pas d'un pixel pendant ses 9 à 14 images ; la précédente a disparu (pas de pile). Sur 32 : 24 photos 3:4 (dont la petite), 3 photos 4:3, 1 photo 5:6 (recadrée à la main), 2 vidéos 9:16, 2 vidéos 16:9. Quand une image en largeur ou la petite arrive, il reste plus de fond : l'écran s'éclaircit d'un coup (jusqu'à 219 de luminosité, contre 178 en moyenne). C'est le seul « clignotement » du Reel : la mesure n'en trouve aucun autre, ni flash.
- **Sur quoi** : n'importe laquelle de ses photos et vidéos, entière, à sa forme. C'est le principe : une photo en hauteur fait une grande carte, une vidéo horizontale une bande.
- **Outil** : existant, le code du skill (v1 le fait : `Footage` dans une boîte centrée de 80 % de la largeur, haute de la largeur ÷ `shots[i].aspect`). Le `Stack layout="dump"` du kit, lui, règle chaque image sur son plus grand côté (`size`) : la composition de référence (`AA-photo-dump`) donne une 3:4 à 65 % de la largeur et une 16:9 à 86 %. Manque : une largeur commune dans `Stack` (`fit="width"`), pour que le motion designer fasse comme l'original.
- **Si rien ne s'y prête** : toujours possible. Réglage possible : le fond à sa couleur claire (`brand.palette.light`).

### 2. Une image toutes les 0,35 s, en coupes sèches
- **Mesuré** : 31 coupes, une image tous les 9 à 14 images (11 images 13 fois, 10 images 9 fois, 9 images 6 fois ; 10,6 en moyenne, soit 0,353 s). Un peu plus vite à la fin : 10,9 images en moyenne sur les 16 premières, 10,3 sur les 16 dernières. Les coupes **ne suivent pas la musique** : 29 % tombent à moins de 35 ms d'un coup, autant que des coupes tirées au hasard (30 %), et aucun décalage du son n'y change grand-chose. Ni fondu, ni flash, ni zoom, ni glissé : une image remplace l'autre d'une image à la suivante. Aucun bruitage sur les coupes (aucun coup du son ne les suit).
- **Outil** : existant, la `timeline` du skill (`beatSpans`), calée sur la musique du modèle. À 104,5 BPM comme l'original : trois images par demi-mesure, sur sa cellule 3-3-2 (0,43 · 0,43 · 0,29 s, 0,38 s en moyenne) : le débit de l'original, cette fois sur le temps. Ou une image par demi-temps à 85 BPM (0,353 s, comme v1), sur une musique plus lente que l'original.
- Aucun zoom en transition ni poussée lente à retirer : l'original n'en a pas.

### 3. Quatre vidéos, des passages de 0,4 s
- **Mesuré** : 4 images sur 32 bougent, et ce sont les seules aux formes de vidéo : 3 (9:16, 0,43 s), 6 (16:9, 0,47 s), 15 (9:16, 0,40 s), 20 (16:9, 0,43 s). À vitesse normale (rien ne paraît ralenti), comme des Live Photos. Les 28 photos sont parfaitement fixes : aucun mouvement mesuré dans l'image.
- **Sur quoi** : un court moment qui bouge dans ses vidéos : un geste (verser, couper, coiffer), de l'eau, une flamme, des gens qui passent.
- **Outil** : existant, `Footage` (une vidéo joue pendant sa case), son passage choisi par le remplissage (`skillPassages`, les `moments` de sa lecture).
- **Si rien ne s'y prête** : que des photos (l'original en a 28 sur 32).

### 4. Une image plus petite, une fois
- **Mesuré** : l'image 12 (4,07 – 4,37 s, 9 images, vers le tiers du Reel) : une photo 3:4 à 58,8 % de la largeur (73,5 % des autres), centrée. La seule.
- **Sur quoi** : un détail calme : un objet, une main, un produit (dans l'original, un chien sur des genoux).
- **Outil** : existant, le code du skill (v1 en met trois, `cur % 11 === 6` ; une suffit, vers le tiers).

### 5. L'ouverture en six formes, et un fil qui revient
- **Mesuré** : les six premières images (0 – 2,30 s) ont chacune une forme et un genre différents. Formes : photo 3:4, photo 5:6, vidéo 9:16, photo 4:3, photo 3:4, vidéo 16:9. Genres : une personne avec son chien, un objet, un paysage avec quelqu'un, un objet, un visage, une vue. Ensuite, 22 images sur 26 sont en 3:4. Dans les 15 premières, jamais deux fois le même genre de suite (une personne, un objet, un lieu, un animal) ; la fin a plus de gens (trois ou quatre selfies de suite). Un fil revient : l'ascenseur aux images 1, 7 et 21 (0 ; 2,3 ; 7,3 s), le même chien aux images 1, 7, 21 et 24.
- **Sur quoi** : ses fichiers dans le bon ordre. Pour ouvrir, des formes et des sujets qui changent. Pour le fil, la même personne, le même coin ou le même objet (sa vitrine, son comptoir, son chien) au début, au tiers et aux deux tiers.
- **Outil** : existant, le remplissage du skill (le `want` de chaque case). Manque : la forme de chaque fichier dans ce qu'il voit. `SkillFile` ne dit que photo ou vidéo, sa durée et sa lecture ; il faut y ajouter son `aspect` (de `media_assets.width` et `height`), sans quoi il ne peut pas ouvrir sur des formes variées.
- **Si rien ne s'y prête** : toutes de la même forme (que des photos en hauteur) : le rythme reste, l'ouverture perd sa variété.

### 6. Pas de fin : le Reel boucle
- **Mesuré** : la dernière image (10,93 – 11,30 s, 11 images) dure comme les autres. La musique est coupée net (de −15 dB au silence en 20 ms), au milieu d'une mesure, et Instagram reprend au début. Aucune carte, aucun logo, aucun texte nulle part : en dehors des images, le fond reste à 239 sur chaque image du Reel.
- **Outil** : existant, la `timeline` du skill (la dernière case comme les autres ; la carte de fin, `end`, seulement quand elle a une annonce). Manque : une musique coupée net sur la dernière image, sans le fondu de 0,8 s du mixage (`muxAudioInSandbox`), pour un modèle qui boucle.

### 7. Étalonnage : aucun
Aucun filtre commun : chaque photo garde ses couleurs (des chaudes, des froides, des nuits). Les noirs descendent à 0–5 sur 22 images sur 32, les blancs montent à 230–250 sur la moitié, aucun coin n'est assombri (coins ÷ centre : 1,02 en médiane), aucun grain sur le fond. Outil : existant, `MontageSkill.finish`, pour retirer de la finition du modèle (« Argentique clair ») son grain et ses noirs levés, qui griseraient le fond.

## Format
L'original est vertical 9:16 plein cadre (720 × 1280) : le fond gris fait le cadre, et chaque image y garde sa forme, à la même largeur. Le Reel reste vertical quoi qu'elle envoie. Réglage « format » : `à sa forme` (défaut, l'original : chaque photo et vidéo entière ; une vidéo horizontale fait une bande d'un quart de la hauteur), `en hauteur` (toutes recadrées en 3:4 sur leur sujet, la forme de 24 images sur 32 : pour quand la plupart de ses fichiers sont horizontaux et feraient sinon de petites bandes ; `Footage` recadre déjà sur le sujet). Les photos ont leur forme réelle (leur lecture) ; les vidéos sont mises en 9:16, 1:1 ou 16:9 d'après leur orientation (`clipAspect`), donc une vidéo 4:3 serait recadrée.

## Ce que Gemini a vu, et ce qu'il a raté
Vu : les 32 images et leurs coupes (à une image près), le fond gris, ni texte ni transition, ce que montre chaque image. Raté : les **formes** (pour lui, toutes en 3:4 dans une fenêtre fixe : 8 sur 32 ne le sont pas, et c'est la largeur qui est fixe), l'**image plus petite** (12), **ce qui bouge** (12 « vidéos » pour lui, 4 en vrai : 8 de ses vidéos sont des photos), le **tempo** (86 au lieu de 104,5) et la **synchro** (pour lui, les coupes tombent sur les temps et les demi-temps : non). Il a aussi vu une « partie 2 plus intense » après 6 s que le volume ne montre pas (plat à 1 dB près), un fond #F3F3F3 au lieu de #EFEFEF, et pas la boucle de la fin.

## Ce que le modèle v1 ratait
Le catalogue (`house-models.ts`) : 115 BPM et une « dreamy bedroom pop » (l'original : 104,5 BPM, un beat hip-hop / R&B avec une voix) ; une image toutes les 0,5 s (en vrai 0,35 s) ; « à une taille qui change » (la largeur ne change jamais, sauf une fois) ; la dernière tenue une seconde (en vrai 0,37 s, puis la boucle) ; une finition « Argentique clair » (noirs levés, grain) que l'original n'a pas. Le skill (version 1) : le bon débit et la bonne largeur, mais à 85 BPM, trois petites images au lieu d'une, la dernière tenue un temps, une carte de fin, un titre dans une pastille blanche (pas dans l'original : c'est la règle du produit quand Edith choisit le modèle). La composition de référence (`AA-photo-dump`) : `Stack` réglé sur le plus grand côté, une image toutes les 20 images (deux fois trop lent). Les mesures (`house-measures.ts`) : 21 des 31 coupes, pas de tempo.

## Ce qu'il faut filmer
Beaucoup d'images : l'original en montre 32 en 11 s. Surtout des photos en hauteur (la forme d'une photo de téléphone), quelques photos en largeur, et 2 à 4 petites vidéos où quelque chose bouge (2 ou 3 s suffisent : on en garde 0,4 s). De tout, jamais deux fois la même chose de suite : l'équipe et les clients, des détails (mains, produits, outils), le lieu (la devanture, la salle), le quartier, un animal ou un objet drôle, quelques images du soir. Une image qui revient (la même personne ou le même coin, au début, au milieu, vers la fin). Pour ouvrir, la plus belle, qu'on comprend d'un coup d'œil.
