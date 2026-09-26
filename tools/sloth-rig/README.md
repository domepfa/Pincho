# Faultier-Gliederpuppe (Prototyp, nicht in der App)

Aus einer Einzelteil-Vorlage (Vorderansicht, Teile durch weisse Linien getrennt)
ausgeschnitten und an Ellbogen, Hüfte und Knie drehbar zusammengesetzt.

- `seg.py` / `parts.py` — Vorlage in Teile zerlegen (Pfad zur Vorlage im Skript anpassen)
- `*.png`, `bboxes.json` — die ausgeschnittenen Teile + Position im Original (1024 px)
- `rig.html` — SVG-Puppe mit `setPose(name, t)`: `flex`, `wave`, `cheer`, `squat`
- `render.mjs` — rendert Einzelbilder per Playwright (Pfade im Skript anpassen)
- `poses.py` / `checker.py` — Freistellen der ganzen Posen (weisser bzw. eingemalter Karo-Hintergrund)

Offen: Seitenansicht-Vorlage, Oberarme als eigene Teile (Schultergelenk).
