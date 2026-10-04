#!/usr/bin/env bash
# Übernimmt den Stand aus beta/ in die Haupt-App (Repo-Wurzel).
# Der Code (js/, styles.css) ist in beiden Ordnern identisch — was sich
# unterscheidet (Speicher-Keys, Pfad zu assets/), regelt js/config.js zur
# Laufzeit. Darum wird hier nur kopiert. Einzige Ausnahme ist index.html:
# Titel, Icons und Pfade werden zurückgestellt.
# manifest.json und sw.js der Haupt-App werden NICHT überschrieben (eigener
# Name, eigener Cache) — die Dateiliste in sw.js wird aus index.html
# übernommen und die Cache-Version hochgezählt, damit die Handys die neue
# Version laden.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf js
cp -r beta/js js
cp beta/styles.css styles.css
sed -e 's#\.\./assets/#./assets/#g' \
    -e 's#<title>Pincho Beta</title>#<title>Pincho – Krafttraining fürs Klettern</title>#' \
    -e 's#icon-beta-#icon-#g' \
    beta/index.html > index.html
# Skriptliste für den Offline-Speicher: dieselbe Reihenfolge wie in index.html
list=$(grep -o 'src="\./js/[a-z0-9-]*\.js"' index.html | sed -e 's#src="#'"'"'#' -e 's#"$#'"'"'#' | paste -sd, - | sed 's/,/, /g')
sed -i "s#^  '\./js/.*#  $list,#" sw.js
v=$(grep -o "pincho-shell-v[0-9]*" sw.js | head -1 | grep -o "[0-9]*$")
sed -i "s/pincho-shell-v$v/pincho-shell-v$((v + 1))/" sw.js
echo "Beta übernommen, Cache pincho-shell-v$((v + 1))"
