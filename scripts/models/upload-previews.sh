#!/usr/bin/env bash
# The previews of « Regarde nos idées » back in Storage, never public again (docs/modeles.md, « Nos modèles restent
# internes »): each model's loop and poster, taken from git history (apps/web/public/modeles/, removed on 6 November in
# e7e6e37d), uploaded to the bucket media under house/previews/<key>.mp4|jpg through /api/admin/house-previews.
#
# Usage, from the repository, CRON_SECRET in the environment (never written here nor echoed):
#   CRON_SECRET=… scripts/models/upload-previews.sh            # every preview in history
#   CRON_SECRET=… scripts/models/upload-previews.sh rallume aplat
# APP_URL defaults to https://edith-ai.app; PREVIEWS_COMMIT to the commit before their removal.
# A newer preview (a model rendered again) is uploaded the same way: PREVIEWS_DIR=<folder of <key>.mp4 and <key>.jpg>.
set -euo pipefail

: "${CRON_SECRET:?CRON_SECRET manquant (variable d environnement)}"
APP_URL="${APP_URL:-https://edith-ai.app}"
COMMIT="${PREVIEWS_COMMIT:-e7e6e37d~1}"
SRC="apps/web/public/modeles"
cd "$(git rev-parse --show-toplevel)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [ "$#" -gt 0 ]; then
  keys=("$@")
elif [ -n "${PREVIEWS_DIR:-}" ]; then
  mapfile -t keys < <(find "$PREVIEWS_DIR" -maxdepth 1 -name '*.mp4' -exec basename {} .mp4 \; | sort)
else
  mapfile -t keys < <(git ls-tree --name-only "$COMMIT" "$SRC/" | sed -n 's#.*/\(.*\)\.mp4$#\1#p' | sort)
fi

upload() { # key ext type
  local key="$1" ext="$2" type="$3" file="$work/$1.$2" answer url
  if [ -n "${PREVIEWS_DIR:-}" ]; then
    cp "$PREVIEWS_DIR/$key.$ext" "$file" 2>/dev/null || { echo "  $key.$ext : absent de $PREVIEWS_DIR"; return 1; }
  else
    git show "$COMMIT:$SRC/$key.$ext" > "$file" 2>/dev/null || { echo "  $key.$ext : absent de l'historique"; return 1; }
  fi
  answer="$(curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/admin/house-previews?key=$key&ext=$ext")"
  url="$(printf '%s' "$answer" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const j=JSON.parse(s);if(!j.upload){console.error(s);process.exit(1)}process.stdout.write(j.upload)})')"
  curl -fsS -X PUT -H "Content-Type: $type" -H "x-upsert: true" --data-binary "@$file" "$url" > /dev/null
  echo "  $key.$ext : ok ($(wc -c < "$file") octets)"
}

failed=0
for key in "${keys[@]}"; do
  echo "$key"
  upload "$key" mp4 video/mp4 || failed=$((failed + 1))
  upload "$key" jpg image/jpeg || failed=$((failed + 1))
done

echo
echo "Aperçus gardés, et les modèles sans aperçu (jamais proposés tant qu'il manque) :"
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/admin/house-previews?list=1"
echo
[ "$failed" -eq 0 ] || { echo "$failed fichier(s) non envoyé(s)"; exit 1; }
