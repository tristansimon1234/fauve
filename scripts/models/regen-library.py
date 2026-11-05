# Rewrites packages/agent/src/piece-library.ts from the pieces in packages/agent/src/pieces/*.ts (their exported EffectPiece),
# in the catalogue's order (house-models.ts), keeping the file's comments: used to resolve the merges of the agents' branches.
import os, re, sys
root = sys.argv[1]
src = os.path.join(root, "packages/agent/src")
pieces = {}
for name in sorted(os.listdir(os.path.join(src, "pieces"))):
    if not name.endswith(".ts") or name.endswith(".test.ts"):
        continue
    key = name[:-3]
    text = open(os.path.join(src, "pieces", name)).read()
    m = re.search(r"export const (\w+): EffectPiece", text)
    if not m:
        print("no EffectPiece export in", name); continue
    pieces[key] = m.group(1)
catalogue = re.findall(r'^\s+key: "([a-z0-9-]+)",', open(os.path.join(src, "house-models.ts")).read(), re.M)
order = ["cadre"] + [k for k in catalogue if k != "cadre" and k in pieces] + [k for k in pieces if k not in catalogue and k != "cadre"]
imports = "\n".join(f'import {{ {pieces[k]} }} from "./pieces/{k}.ts";' for k in order if k in pieces)
entries = ", ".join(pieces[k] if pieces[k] == k else f'"{k}": {pieces[k]}' if "-" in k else f"{k}: {pieces[k]}" for k in order if k in pieces)
body = f'''import type {{ EffectPiece }} from "./pieces.ts";
{imports}

// The bank of ready-to-play effects (pieces.ts: the form of an effect, its filler, how its layer is built), by the key of
// the model each one comes from. Server side only (@fauve/agent/pieces), like the montage skills: their code stays out of
// the pages. An effect joins it once written from its model's skill and fiche, checked by the tests and rendered locally
// (scripts/skill-render.mts --piece); a new model of Edith's brings its own (docs/reprise.md, « Passage de relais »).

/** The bank, in the catalogue's order (house-models.ts); the editor is offered them by what her files carry (pieces.ts, piecesOffered). */
export const EFFECT_PIECES: Record<string, EffectPiece> = {{ {entries} }};

/** The piece of the bank a model's key names, if it has one. */
export const pieceFor = (key: string | null | undefined): EffectPiece | undefined => (key ? EFFECT_PIECES[key] : undefined);
'''
open(os.path.join(src, "piece-library.ts"), "w").write(body)
print("bank:", ", ".join(k for k in order if k in pieces))
