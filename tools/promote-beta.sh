#!/usr/bin/env bash
# Übernimmt den Stand aus beta/ in die Haupt-App (Repo-Wurzel).
# Kopiert app.js, data.js, firebase.js, styles.css und index.html und
# stellt dabei zurück, was nur für die Beta anders ist:
#   - Pfade ../assets/  -> ./assets/
#   - Speicher-Keys pinchobeta_ -> pincho_ (Offline-Kopie, Warteschlange,
#     Entwürfe der Haupt-App bleiben so erhalten)
#   - Titel / Theme / Beta-Icon in index.html
# manifest.json und sw.js der Haupt-App werden NICHT überschrieben (eigener
# Name, eigener Cache) — nur die Cache-Version in sw.js wird hochgezählt,
# damit die Handys die neue Version laden.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in app.js data.js firebase.js styles.css index.html; do
  sed -e 's#\.\./assets/#./assets/#g' \
      -e 's/pinchobeta_/pincho_/g' \
      "beta/$f" > "$f"
done
sed -i \
  -e 's#<title>Pincho Beta</title>#<title>Pincho – Krafttraining fürs Klettern</title>#' \
  -e 's#icon-beta-#icon-#g' \
  index.html
v=$(grep -o "pincho-shell-v[0-9]*" sw.js | head -1 | grep -o "[0-9]*$")
sed -i "s/pincho-shell-v$v/pincho-shell-v$((v + 1))/" sw.js
echo "Beta übernommen, Cache pincho-shell-v$((v + 1))"
