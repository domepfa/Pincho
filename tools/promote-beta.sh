#!/usr/bin/env bash
# Übernimmt den Stand aus beta/ in die Haupt-App (Repo-Wurzel).
# Der Code ist in beiden Ordnern identisch — was sich unterscheidet
# (Speicher-Keys, Pfad zu assets/), regelt config.js zur Laufzeit. Darum
# wird hier nur kopiert. Einzige Ausnahme ist index.html: Titel, Icons und
# Pfad des Hintergrundbilds werden zurückgestellt.
# manifest.json und sw.js der Haupt-App werden NICHT überschrieben (eigener
# Name, eigener Cache) — nur die Cache-Version in sw.js wird hochgezählt,
# damit die Handys die neue Version laden.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in config.js app.js sloth-rig.js data.js firebase.js styles.css; do
  cp "beta/$f" "$f"
done
sed -e 's#\.\./assets/#./assets/#g' \
    -e 's#<title>Pincho Beta</title>#<title>Pincho – Krafttraining fürs Klettern</title>#' \
    -e 's#icon-beta-#icon-#g' \
    beta/index.html > index.html
v=$(grep -o "pincho-shell-v[0-9]*" sw.js | head -1 | grep -o "[0-9]*$")
sed -i "s/pincho-shell-v$v/pincho-shell-v$((v + 1))/" sw.js
echo "Beta übernommen, Cache pincho-shell-v$((v + 1))"
echo "Neue Dateien? Dann in sw.js (SHELL_ASSETS) der Haupt-App nachtragen."
