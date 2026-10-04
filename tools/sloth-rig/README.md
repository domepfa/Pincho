# Faultier-Gliederpuppe

Die Figur in der App (`beta/js/sloth-rig.js`) wird aus Einzelteilen zusammengesetzt
und per Winkel gestellt, statt für jede Übung ein eigenes Bild zu brauchen.

## Teile erzeugen

```
pip install pillow numpy scipy
python3 tools/sloth-rig/build.py          # schreibt assets/sloth/rig/*.png + SLOTH_PARTS in beta/js/sloth-rig-data.js
python3 tools/sloth-rig/build.py --list   # Teil-Nummern der Vorlagen anzeigen
```

- `sheets/front.jpg`: Vorderansicht (neutrales Gesicht)
- `sheets/back.jpg`: Rückansicht mit Greifhänden und Ellbogen-Kugeln
- `sheets/side.jpg` + `sheets/side_extra.jpg`: Seitenansicht (Blick nach rechts),
  Fäuste und Füsse im Zusatzblatt. Hintere Arme/Beine = abgedunkelte Kopie (`*_far.png`)
- `sheets/arms_extra.jpg`: flache Hand (Seite); die hängenden Arme darin werden nicht verwendet
- `sheets/poses_extra.jpg`: ganze Posen (Russian Twist, 90/90, Frog Stretch, Aussenrotation) -> `pose_*.png`, per Überblendung (`SLOTH_SWAPS`)
- `sheets/equipment/`: Geräte, Maschinen, Kleinteile -> `eq_*.png` (Requisiten, per `props` in einer Pose)

Die Vorlagen müssen weissen Hintergrund haben und die Teile durch weisse
Lücken getrennt sein. Die Farben werden beim Erzeugen in Schwarzweiss
umgerechnet (`CURVE` in `build.py`).

## Posen

In `beta/js/sloth-rig.js`: Gelenkpunkte (`SLOTH_JOINTS`, in Vorlagen-Pixeln),
Posen (`SLOTH_POSES`, zwei Endstellungen als Weltwinkel) und `slothFigure(name)`,
das ein fertiges SVG liefert. Die Bewegung läuft als CSS-Animation.

## Ältere Dateien

`seg.py`, `parts.py`, `rig.html`, `render.mjs`, `poses.py`, `checker.py` und
die PNGs in diesem Ordner stammen vom ersten Prototyp (alte Vorlage).
