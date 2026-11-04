# Reprise — où on en est (4 novembre 2026)

À lire en premier dans une nouvelle conversation (CLAUDE.md y renvoie). Une conversation = un chantier ; ce fichier se met à jour à la fin de chacun.

## Fait (3 et 4 novembre, en ligne sur edith-ai.app)

1. **Recopie fidèle par défaut, sa DA sur demande.** Un Reel qu'elle recopie garde la police, les couleurs, les textes, la longueur, le rythme et la fin du modèle ; sa charte ne l'habille que si sa demande le dit (« avec mes couleurs », `OWN_LOOK_WORDS`, `posts.copy_charter`). Un modèle choisi par Edith (sa DA par défaut, `posts.edith_pick`) est habillé de sa charte et tenu à un plancher (des mots à l'écran, 15 s au plus sans voix, `dressedFloorNote`).
2. **Les 31 modèles d'Edith voient leur original.** Chaque Reel de référence est gardé (`house/originals/<clé>.mp4`, jamais montré) avec ses planches de dix images (`house/sheets/<clé>/`, `houseSheets`, `/api/admin/house-sheets`) ; la vidéo des « ingénieurs IA » n'est plus gardée.
3. **Un seul réalisateur pour un Reel qui suit un modèle** (`lib/agent/director.ts`, `packages/agent/src/director.ts`) : il voit l'original et ses fichiers en planches, écrit le plan et le code de la composition en une réponse, puis regarde son Reel à côté de l'original au même instant dans sa propre étape (`look`) et corrige tout ou garde. Repli sur le monteur et le motion designer s'il échoue. Le format de sa réponse est plat (une composition imbriquée faisait refuser la grammaire par l'API) ; `step=grammar` du banc le vérifie pour quelques jetons.
4. **Plus de marque dans le nom d'un modèle** : « Montage façon Nike » s'appelle « Montage sport noir et blanc » (sa clé reste `nike` ; `HOUSE_VERSION` 4 réécrit les modèles en base).
5. **CLAUDE.md allégé** (4 novembre) : 37 700 caractères au lieu de 424 000 (environ 10 000 jetons au lieu de 115 000). Il garde le produit, la stack, les conventions, les règles de travail avec Tristan, des règles transverses et l'index des sujets ; le détail de chaque fonction est dans 31 fichiers `docs/<sujet>.md`, déplacé mot pour mot par script (aucune ligne perdue ni doublée).

## Skills de montage : où on en est (4 novembre, après-midi)

Fait et en ligne (le détail : `docs/modeles.md`, « Skills de montage ») : le moteur (`packages/agent/src/skills.ts`, la librairie `@fauve/agent/skills`, le remplissage par un appel court dans `lib/agent/skill-design.ts`, le contrôle des scènes sans réécriture, la relance du remplissage quand le contrôle refuse), la question « tu en as d'autres ? » quand elle a moins de fichiers que le skill n'en prend (outil `montage` et écran « Créer » ; Edith, quand c'est lui qui choisit, ne prend qu'un skill que ses fichiers remplissent), `Footage at`, l'outil de rendu local `scripts/skill-render.mts`, et le premier skill, « Titre qui se décode » (`skills/decode.ts`, version 2).

Banc en prod, cas café (rushes libres), modèle « Titre qui se décode » choisi par elle :

| | Chaîne (le réalisateur, le contrôle ayant refusé le skill v1) | Skill v2 |
|---|---|---|
| Coût | 0,93 € | 0,11 € (remplissage 1,4 c, contrat 0,7 c, légende 0,3 c, musique 4,7 c, rendu 3,9 c) |
| Montage | plusieurs minutes, deux appels du réalisateur et une reprise du motion designer | environ 20 s |
| Reel | 2 versions | 15,7 s, 14 plans, le modèle de bout en bout (bandes, repli, titre qui se décode, bande, plein écran) |

En cours : les 9 autres skills des 10 premiers (Mots aux quatre coins, Mosaïque qui change, Pile de photos, Photo dump, Écran partagé titré, Cadre dans le cadre, Titre gaufré, Montage sport noir et blanc, Une journée chez toi), chacun écrit sur son original et rendu en local, puis inscrit dans `skill-library.ts` et passé au banc (`/api/admin/lab?case=…&model=<clé>&reset=1&idea=…`, une demande simple pour ne pas partir à l'atelier d'effets).

Leçons du banc : tester chaque skill avec ses textes les plus longs et une carte de fin (le remplissage écrit des mots longs) ; une boîte de texte centrée tient entre x 140 et 940 dès qu'elle passe sous le milieu (les boutons des applis) ; jamais de `transform` dans l'`innerStyle` de `FitText` (il remplace sa réduction).

Question de Tristan (4 novembre), à reprendre : le contrôle des scènes est-il trop strict, faut-il un contrôleur à part ? Pour les skills, il est gardé (un centime, il a trouvé deux vrais défauts) mais un refus relance d'abord le remplissage au lieu de toute la chaîne. Pour la chaîne habituelle, chaque remarque du contrôle (contraste, temps de lecture, taille) déclenche une reprise payante du motion designer (7 à 15 c) : à mesurer (combien, et si ça améliore) avant de décider. Et un Reel qu'elle envoie ne devient pas un skill tout seul : noté comme candidat, écrit à la main quand une forme revient ou qu'un Reel est remarquable, validé par Tristan sur des images libres (chantier 3).

## Banc du réalisateur (3 novembre, soir)

Mêmes rushes, modèle choisi par Edith, comparé à la chaîne monteur + motion designer (qui voit déjà l'original) :

| | Chaîne (référence) | Réalisateur unique |
|---|---|---|
| Café (« Titre qui se décode ») | 0,59 €, 12,8 s, ouverture pleine | 0,76 €, 15,7 s, fidèle à la mise en page du modèle (bande cinéma sur noir), mais beaucoup de noir et une 1re image faible |
| Procope (« Une journée chez toi ») | 0,82 €, 13,7 s, grand « AU PROCOPE » derrière les passants | 0,77 €, 11,7 s, titre minuscule et vertical, accroche absente |

Verdict : pas encore meilleur. Il ne tourne plus que sur le banc et le studio de l'équipe (`directorTrial` dans `lib/agent/editor.ts`) ; les commerces gardent la chaîne. Défaut trouvé et corrigé en route : le code réécrit par son regard était remplacé par l'ancien quand la description de la composition ne changeait pas.

Pistes : il écrit plan et code en un appel, en effort medium, avec un très long prompt (consigne du monteur + kit), et ses compositions font 3 000 à 4 000 caractères ; essayer l'effort high, ou garder deux agents et donner au monteur les planches (rushes et original) et au regard du motion designer l'original au même instant (le gain de fidélité vient de là). Pour comparer à la chaîne, garder ses compositions avant `reset=1` (la remise à zéro du banc les efface).

## Prochains chantiers (dans l'ordre)

1. ~~Alléger CLAUDE.md~~ : fait le 4 novembre (voir « Fait »).
2. **Une librairie de « skills de montage »** (plan validé avec Tristan le 4 novembre, détail ci-dessous) : en cours, le moteur et le premier skill en ligne (voir « Skills de montage : où on en est »).
3. **Ajouter des skills au fil de l'eau** : un outil d'admin « nouveau skill depuis un lien » (original et planches, lecture, skill écrit sur des plans du banc, aperçu à valider par Tristan avant d'entrer dans la librairie).
4. **Recopie fidèle des 9 Reels de la landing** par la chaîne, avant/après.

## La librairie de skills de montage

Tristan : « edith pourrait choisir d'adapter ces modèles comme une librairie de "skills de montage" » ; « sur Edits d'Insta tu as des modèles où le texte est préposé et les photos et vidéos n'ont qu'à être changées ».

**Ce qu'il veut** : des modèles comme ceux d'Edits ou de CapCut. Un modèle est un Reel entier codé une fois pour toutes : ses cases de plans calées sur la musique, ses textes déjà posés (place, taille, style, moment), ses effets, sa fin. S'en servir, c'est changer ses vidéos, ses photos et ses mots ; le moteur joue le reste tel quel. Edith choisit dans la librairie le skill qui va avec la demande et ne touche au code que si la demande sort du modèle.

**Où on en est** : loin de ça. Le code de chaque modèle (`HOUSE_EXAMPLES` dans `packages/agent/src/house-examples.ts`, écrit avec le kit de briques) ne couvre que son moment signature (4 à 5 s, 430 à 1 650 caractères), ne lit jamais les textes du Reel (`reelTexts`), et 13 modèles sur 31 supposent un nombre de plans fixe. Le motion designer réécrit donc tout le Reel à chaque fois : plus cher (la composition pèse environ la moitié d'un Reel de 0,6 à 0,8 €), plus lent, parfois moins bien que le modèle (le titre minuscule du Procope au banc).

**Le plan** :
1. Chaque modèle devient un skill complet, sur tout le Reel : des cases de plans (combien au minimum et au maximum, ce que chacune attend : un visage, un plan large, le produit ; sa durée sur le temps), des cases de texte (accroche, lignes, fin, chacune avec sa longueur maximale, sa place et son style), sa charte ou celle du modèle en entrée, et ce qui se passe quand elle donne plus ou moins de plans que le skill n'en prend. Écrit par Claude à la main sur les vidéos originales (`house/originals/<clé>.mp4`), pas sur les planches (dix petites images par planche, trop grossières pour caler un modèle) : découpées en images aussi serrées qu'il faut là où ça compte (le moment signature, chaque coupe, chaque texte), coupes, tempo et durées mesurés par ffmpeg, tailles et places des textes mesurées sur les pixels, comme les codes actuels des modèles ; puis testé et rendu en local (contrôle des scènes `apps/render/smoke.mjs`, rendu Remotion), sans appel facturé. Aucune route ne donne encore les liens des originaux : ajouter `?links=1` à `/api/admin/house-sheets` (liens signés d'une heure, réponse lue dans `net._http_response`) pour les télécharger ici. Les planches restent ce que voient les agents d'Edith pendant un montage, et servent à choisir les 10 premiers avec Tristan.
2. Pour un Reel sur un modèle, Edith (le monteur) ne fait que remplir : quel plan dans quelle case, avec ses temps, et ses mots dans les cases de texte. Le moteur joue le skill tel quel, sans motion designer : `SceneRequest.draft` (`apps/web/src/lib/agent/motion-designer.ts`) passe déjà une composition toute faite au contrôle des scènes sans appeler de modèle. Le résultat du modèle à coup sûr, plus vite, environ moitié prix (à vérifier sur le banc).
3. Si sa demande sort du skill (plus de plans qu'il n'en prend, un élément en plus, une autre fin), le motion designer reçoit le code du skill et ne change que ce qu'il faut. Sa consigne (partie `example` de `packages/agent/src/motion-scene.ts`, qui dit encore « Start from it… make it hers… Never paste it unchanged ») doit dire : garde le code du skill tel quel là où il va, ne change que les plans et leur nombre, ses mots, sa charte, la longueur et les coupes, et ce que sa demande ajoute ; ne retire, ne réduis et n'assagis jamais son moment signature. Pas encore appliqué.
4. Commencer par les 10 meilleurs modèles (à choisir avec Tristan sur leurs planches), lui montrer les rendus, puis les 21 autres.

Plus tard : des skills qui se combinent (l'ouverture d'un modèle, la fin d'un autre), et un juge Sonnet avant livraison. Un skill se montre rendu sur des images libres de droits, jamais sur l'original (les images de vrais comptes) : la librairie pourra être montrée dans « Créer ».

**Le risque** : que les Reels se ressemblent (l'effet « modèle CapCut »). La landing promet d'ailleurs « pas de modèle tout fait » (`NOT` et la FAQ de `app/page.tsx`) : à revoir avec Tristan quand les skills sortent, jamais sans lui. Garde-fous : chaque skill habillé de sa charte, de ses images et de ses mots ; jamais le même deux fois de suite pour un commerce (déjà vrai pour les modèles choisis par Edith) ; un skill choisi d'après ce qu'elle a filmé (un skill qui attend un visage n'est jamais choisi sans visage dans ses vidéos) ; adapté par le motion designer quand la demande sort du cadre.

**Comment savoir si c'est la bonne direction** : après les 10 premiers, mêmes rushes par skill et par la chaîne actuelle, comparés sur le coût, le temps et la seule vraie question (Tristan le posterait-il ?), puis un ou deux vrais commerces. Si les skills ne battent pas la chaîne, on s'arrête là.

## Règles de travail avec Tristan

Dans CLAUDE.md (« Règles de travail avec Tristan »), lu au début de chaque conversation.
