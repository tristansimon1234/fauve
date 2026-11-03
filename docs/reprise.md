# Reprise — où on en est (3 novembre 2026, soir)

À lire en premier dans une nouvelle conversation, avant CLAUDE.md. Une conversation = un chantier.

## Fait aujourd'hui (en ligne sur edith-ai.app)

1. **Recopie fidèle par défaut, sa DA sur demande.** Un Reel qu'elle recopie garde la police, les couleurs, les textes, la longueur, le rythme et la fin du modèle ; sa charte ne l'habille que si sa demande le dit (« avec mes couleurs », `OWN_LOOK_WORDS`, `posts.copy_charter`). Un modèle choisi par Edith (sa DA par défaut, `posts.edith_pick`) est habillé de sa charte et tenu à un plancher (des mots à l'écran, 15 s au plus sans voix, `dressedFloorNote`).
2. **Les 31 modèles d'Edith voient leur original.** Chaque Reel de référence est gardé (`house/originals/<clé>.mp4`, jamais montré) avec ses planches de dix images (`house/sheets/<clé>/`, `houseSheets`, `/api/admin/house-sheets`) ; la vidéo des « ingénieurs IA » n'est plus gardée.
3. **Un seul réalisateur pour un Reel qui suit un modèle** (`lib/agent/director.ts`, `packages/agent/src/director.ts`) : il voit l'original et ses fichiers en planches, écrit le plan et le code de la composition en une réponse, puis regarde son Reel à côté de l'original au même instant dans sa propre étape (`look`) et corrige tout ou garde. Repli sur le monteur et le motion designer s'il échoue. Le format de sa réponse est plat (une composition imbriquée faisait refuser la grammaire par l'API) ; `step=grammar` du banc le vérifie pour quelques jetons.

## Banc du réalisateur (3 novembre, soir)

Mêmes rushes, modèle choisi par Edith, comparé à la chaîne monteur + motion designer (qui voit déjà l'original) :

| | Chaîne (référence) | Réalisateur unique |
|---|---|---|
| Café (« Titre qui se décode ») | 0,59 €, 12,8 s, ouverture pleine | 0,76 €, 15,7 s, fidèle à la mise en page du modèle (bande cinéma sur noir), mais beaucoup de noir et une 1re image faible |
| Procope (« Une journée chez toi ») | 0,82 €, 13,7 s, grand « AU PROCOPE » derrière les passants | 0,77 €, 11,7 s, titre minuscule et vertical, accroche absente |

Verdict : pas encore meilleur. Il ne tourne plus que sur le banc et le studio de l'équipe (`directorTrial` dans `lib/agent/editor.ts`) ; les commerces gardent la chaîne. Défaut trouvé et corrigé en route : le code réécrit par son regard était remplacé par l'ancien quand la description de la composition ne changeait pas.

Pistes : il écrit plan et code en un appel, en effort medium, avec un très long prompt (consigne du monteur + kit), et ses compositions font 3 000 à 4 000 caractères ; essayer l'effort high, ou garder deux agents et donner au monteur les planches (rushes et original) et au regard du motion designer l'original au même instant (le gain de fidélité vient de là). Pour comparer à la chaîne, garder ses compositions avant `reset=1` (la remise à zéro du banc les efface).

## Prochains chantiers proposés (dans l'ordre)

1. **Alléger CLAUDE.md** : 413 000 caractères, environ 115 000 jetons chargés au début de chaque conversation (c'est ce qui la remplit si vite). Garder 15 000 à 20 000 jetons : le produit, la stack, les conventions, les règles de travail, l'index des sujets ; déplacer le détail de chaque fonction dans `docs/<sujet>.md`, lu seulement quand on y touche.
2. **Modèles prêts à jouer** : les 31 modèles ont déjà leur composition de référence codée et testée (`house-examples.ts`, avec le kit de briques), mais l'IA la réécrit à chaque Reel. En faire des modèles paramétrés (ses plans, ses mots, sa charte en entrée) que le moteur joue tels quels ; l'IA ne choisit que les plans, l'ordre, les mots, et n'écrit du code que si la demande sort du modèle. Plancher de qualité garanti, moins cher, plus rapide. Juge Sonnet avant livraison.
3. **Ajouter des modèles au fil de l'eau** : un outil d'admin « nouveau modèle depuis un lien » (original et planches, lecture, composition de référence écrite sur des plans du banc, aperçu à valider par Tristan avant d'entrer dans le catalogue).
4. **Recopie fidèle des 9 Reels de la landing** par la chaîne, avant/après.

## Règles de travail avec Tristan

- Dire la correction avant de la faire ; en français, court.
- Aucun appel d'API facturé hors d'un banc d'essai annoncé (quelques centimes à 1 € par essai, le coût dit après).
- Toujours dire qui a fait un Reel : la chaîne d'Edith ou Claude à la main. Ne pas toucher la landing sans qu'il le demande.
- Jamais de secret affiché ni demandé : les appels d'admin passent par la base (`net.http_post` avec les secrets du Vault, réponse lue dans `net._http_response`).
- À l'écran : « tu », jamais « la gérante » ; Edith n'est pas genré (« il », « l'assistant IA »).
