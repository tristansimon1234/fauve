#!/bin/bash
# Merge one new model's branch into main: its files by git, its catalogue entries transplanted whole, the test counters
# set, the bank regenerated, the checks run; committed only if every agent test passes. Usage: merge-model.sh <branch> "<title>"
set -u
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here/../.."
log="${TMPDIR:-/tmp}"
b="$1"; title="$2"
git pull -q --no-rebase --no-edit origin main >/dev/null 2>&1
git merge --no-commit --no-ff "$b" >"$log/merge.log" 2>&1
for f in packages/agent/src/house-models.ts packages/agent/src/house-effects.ts packages/agent/src/house-measures.ts packages/agent/src/font-pairs.ts packages/agent/src/skill-library.ts; do git show HEAD:$f > $f; done
python3 "$here"/transplant.py . "$b" || { echo "TRANSPLANT FAILED"; exit 1; }
python3 "$here"/fix-catalogue.py . >/dev/null
python3 "$here"/regen-library.py . >/dev/null
n=$(python3 -c "
import re;t=open('packages/agent/src/font-pairs.ts',encoding='utf-8').read();a=t.index('export const FONT_PAIRS');z=t.index('\n];',a);print(len(re.findall(r'^    key: \"',t[a:z],re.M)))")
sed -i -E "s/  assert.equal\(FONT_PAIRS.length, [0-9]+\);/  assert.equal(FONT_PAIRS.length, $n);/" packages/agent/src/features.test.ts
if grep -q "<<<<<<<" packages/agent/src/features.test.ts; then echo "CONFLICT LEFT in features.test.ts"; exit 1; fi
if git diff --name-only --diff-filter=U | grep -q .; then git add -A packages/agent/src docs/fiches apps/web/public/modeles 2>/dev/null; fi
npx tsc -p packages/agent --noEmit 2>&1 | head -3
npm test --workspace packages/agent > "$log/agent-tests.log" 2>&1
grep "^# pass\|^# fail" "$log/agent-tests.log" | tr '\n' ' '; echo
if ! grep -q "^# fail 0" "$log/agent-tests.log"; then grep -B2 -A12 "^not ok" "$log/agent-tests.log" | head -24; echo "NOT COMMITTED"; exit 1; fi
git add -A packages/agent/src docs/fiches apps/web/public/modeles 2>/dev/null
git commit -q -m "Merge branch '$b': $title

Its catalogue entries transplanted whole.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RzkKqmcfqKELxs3ym22fHA" && echo "committed: $title"
