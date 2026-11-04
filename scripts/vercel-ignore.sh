#!/usr/bin/env bash
# Vercel's ignoreCommand (apps/web/vercel.json): exit 0 skips the build, any other code builds (Tristan: « ba oui »,
# each build is paid in CPU minutes). Skipped when nothing the app uses changed since the last good deployment
# (VERCEL_GIT_PREVIOUS_SHA): Markdown, docs/, the local skill render tool, the fiche measures, and the drafts of montage skills
# (packages/agent/src/skills/<key>.ts that skill-library.ts imports neither before nor after). Anything else builds,
# and so does a base the clone does not have.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
git cat-file -e "${base}^{commit}" 2>/dev/null || exit 1
changed=$(git diff --name-only "$base" HEAD) || exit 1
library=packages/agent/src/skill-library.ts
in_library() { git show "$1:$library" 2>/dev/null | grep -qF "\"./skills/$2.ts\""; }
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    *.md | docs/*) ;;
    scripts/skill-render.mts | scripts/fiche/*) ;;
    packages/agent/src/skills/*/*) exit 1 ;;
    packages/agent/src/skills/*.ts)
      key=$(basename "$file" .ts)
      if in_library HEAD "$key" || in_library "$base" "$key"; then exit 1; fi
      ;;
    *) exit 1 ;;
  esac
done <<< "$changed"
exit 0
