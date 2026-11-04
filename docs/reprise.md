# Reprise — où on en est (4 novembre 2026)

À lire en premier dans une nouvelle conversation, avant CLAUDE.md. Une conversation = un chantier.

## Fait (3 et 4 novembre, en ligne sur edith-ai.app)

1. **Recopie fidèle par défaut, sa DA sur demande.** Un Reel qu'elle recopie garde la police, les couleurs, les textes, la longueur, le rythme et la fin du modèle ; sa charte ne l'habille que si sa demande le dit (« avec mes couleurs », `OWN_LOOK_WORDS`, `posts.copy_charter`). Un modèle choisi par Edith (sa DA par défaut, `posts.edith_pick`) est habillé de sa charte et tenu à un plancher (des mots à l'écran, 15 s au plus sans voix, `dressedFloorNote`).
2. **Les 31 modèles d'Edith voient leur original.** Chaque Reel de référence est gardé (`house/originals/<clé>.mp4`, jamais montré) avec ses planches de dix images (`house/sheets/<clé>/`, `houseSheets`, `/api/admin/house-sheets`) ; la vidéo des « ingénieurs IA » n'est plus gardée.
3. **Un seul réalisateur pour un Reel qui suit un modèle** (`lib/agent/director.ts`, `packages/agent/src/director.ts`) : il voit l'original et ses fichiers en planches, écrit le plan et le code de la composition en une réponse, puis regarde son Reel à côté de l'original au même instant dans sa propre étape (`look`) et corrige tout ou garde. Repli sur le monteur et le motion designer s'il échoue. Le format de sa réponse est plat (une composition imbriquée faisait refuser la grammaire par l'API) ; `step=grammar` du banc le vérifie pour quelques jetons.
4. **Plus de marque dans le nom d'un modèle** : « Montage façon Nike » s'appelle « Montage sport noir et blanc » (sa clé reste `nike` ; `HOUSE_VERSION` 4 réécrit les modèles en base).

## Banc du réalisateur (3 novembre, soir)

Mêmes rushes, modèle choisi par Edith, comparé à la chaîne monteur + motion designer (qui voit déjà l'original) :

| | Chaîne (référence) | Réalisateur unique |
|---|---|---|
| Café (« Titre qui se décode ») | 0,59 €, 12,8 s, ouverture pleine | 0,76 €, 15,7 s, fidèle à la mise en page du modèle (bande cinéma sur noir), mais beaucoup de noir et une 1re image faible |
| Procope (« Une journée chez toi ») | 0,82 €, 13,7 s, grand « AU PROCOPE » derrière les passants | 0,77 €, 11,7 s, titre minuscule et vertical, accroche absente |

Verdict : pas encore meilleur. Il ne tourne plus que sur le banc et le studio de l'équipe (`directorTrial` dans `lib/agent/editor.ts`) ; les commerces gardent la chaîne. Défaut trouvé et corrigé en route : le code réécrit par son regard était remplacé par l'ancien quand la description de la composition ne changeait pas.

Pistes : il écrit plan et code en un appel, en effort medium, avec un très long prompt (consigne du monteur + kit), et ses compositions font 3 000 à 4 000 caractères ; essayer l'effort high, ou garder deux agents et donner au monteur les planches (rushes et original) et au regard du motion designer l'original au même instant (le gain de fidélité vient de là). Pour comparer à la chaîne, garder ses compositions avant `reset=1` (la remise à zéro du banc les efface).

## Prochains chantiers (dans l'ordre)

1. **Alléger CLAUDE.md** (une conversation courte, conseillée en premier : toutes les suivantes en profitent) : 413 000 caractères, environ 115 000 jetons chargés au début de chaque conversation (c'est ce qui la remplit si vite). Garder 15 000 à 20 000 jetons : le produit, la stack, les conventions, les règles de travail, l'index des sujets ; déplacer le détail de chaque fonction dans `docs/<sujet>.md`, lu seulement quand on y touche. Déplacer les paragraphes par script, sans les réécrire, pour ne rien perdre.
2. **Une librairie de « skills de montage »** (plan validé avec Tristan le 4 novembre, détail ci-dessous).
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

Plus tard : des skills qui se combinent (l'ouverture d'un modèle, la fin d'un autre), et un juge Sonnet avant livraison.

## Règles de travail avec Tristan

- Dire la correction avant de la faire ; en français, court.
- Expliquer d'abord ce qu'on veut faire et où on en est, avec ce qu'il connaît (Edits, CapCut), avant de proposer : il veut comprendre, pas une liste de fonctions.
- Aucun appel d'API facturé hors d'un banc d'essai annoncé (quelques centimes à 1 € par essai, le coût dit après).
- Toujours dire qui a fait un Reel : la chaîne d'Edith ou Claude à la main. Ne pas toucher la landing sans qu'il le demande.
- Jamais de secret affiché ni demandé : les appels d'admin passent par la base (`net.http_post` avec les secrets du Vault, réponse lue dans `net._http_response`).
- À l'écran : « tu », jamais « la gérante » ; Edith n'est pas genré (« il », « l'assistant IA »).
