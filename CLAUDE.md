# Pincho – Hinweise für Claude

Krafttrainings-PWA fürs Klettern (Board, Gym, Fortschritt, Crews/Challenges). Vanilla JS, kein
Framework, **kein Build-Schritt**, läuft auf GitHub Pages, Daten in Firebase (REST, `js/firebase.js`).

## Arbeitsweise
- Erst kurz nachfragen, dann bauen; kurze Antworten (siehe `DESIGN.md`, Teil A).
- **Neues zuerst in `beta/`** (`beta/js/`, `beta/css/`, `beta/index.html`), danach
  `tools/promote-beta.sh` übernimmt es in die Wurzel. Code in `js/`/`css/` ist in beiden Ordnern
  **identisch**; Unterschiede (Speicher-Präfix, Asset-Pfad) regelt `js/config.js` zur Laufzeit.
  Nie Pfade oder `localStorage`-Keys hart codieren: `ASSET_BASE + '…'`, `STORAGE_PREFIX + '…'`.
- Vor jedem Merge: `node tools/smoke-test.mjs` (Playwright, Haupt-App + Beta, alle Tabs).

## Skripte und Ladereihenfolge
Klassische `<script>`-Dateien mit **einem gemeinsamen globalen Namensraum** (keine Imports).
Reihenfolge steht in `index.html` und zählt: Top-Level-Code darf nur Dinge aus *früheren* Dateien
benutzen; `js/main.js` (ruft `boot()`) kommt zuletzt. Neue Datei → in `beta/index.html` und in
`SHELL_ASSETS` von `beta/sw.js` eintragen (Cache-Version hochzählen); promote übernimmt die Liste.

## Wo steht was (js/)
| Datei | Inhalt |
|---|---|
| `config.js` | `IS_BETA`, `STORAGE_PREFIX`, `ASSET_BASE` |
| `data.js` | Boards/Griffe, Campus-Geometrie, `EXERCISE_LIBRARY`, Yoga/Pilates-Posen, Programme, Wochenplan |
| `firebase.js` | Auth, Netz mit Zeitlimit, Offline-Kopie + Schreib-Warteschlange, `fbGet/Put/Patch/Push/Delete` |
| `sloth-rig.js` | Faultier-Puppe: Gelenke, `SLOTH_POSES`, Löser, CSS-Keyframes, Mesh/WebGL, `slothFigure()` |
| `sloth-rig-data.js` | **generiert** (tools/sloth-rig), nicht von Hand ändern |
| `core.js` | `esc`, Formate, `saveDraft/loadDraft`, `toast`, globaler `state`, `boot()`, Crews laden |
| `exercise-picker.js` | Übungsauswahl mit Körperkarte, Info-Sheet, Übung würfeln, Muskelkarte `bodyMapSvg` |
| `login.js` | Login, Registrierung, Einladungscode, Onboarding, Abmelden |
| `shell.js` | Navigation, `renderShell`, Start-Knopf, Trainings-Leiste, **Router `render()`** |
| `plan.js` | Tab Agenda (Wochenplan) |
| `log.js` | Tab Gym: Übungs-Prefs, geteilte Vorlagen, Verlauf/Trend, `renderLog` |
| `ausdauer.js` / `flow.js` | Gym-Modi Ausdauer (Stoppuhr, Wand-Blöcke) und Flow (Yoga/Pilates), je eigener Timer |
| `gym.js` | Plan-Editor, Freestyle/Plan-Ausführung (Phasenmaschine), Supersätze, Pausen-Bildschirm |
| `fingerboard.js` | Board-Tab: Zustand **`fb`**, Schnelltraining, Board-Bild/Griffe, Vorlagen, Phasenliste |
| `fb-builder.js` | „Eigenen Ablauf bauen“: Hang, Griffblock/Lifting Pin, Pause, Campus |
| `fb-dice.js` | Würfeln am Board, Würfelduell (`openDuel`, in sich geschlossen) |
| `fb-blocks.js` | Satz-Beschreibungen, Campus-Leiter/Routen-Grafik, Regel-Chips, Ablaufliste |
| `audio.js` | Töne, Bluetooth-Ausgleich, Vibration, Wake Lock (für alle Timer) |
| `fb-runner.js` | Laufender Board-Ablauf: Vollbild, Transport, Bühne, Check-in, Timer-Engine, `finishAblauf` |
| `exercise-figures.js` | `EXERCISE_FIGURES` (134 KB reine SVG-Daten), Übung → Faultier-Pose |
| `progress.js` / `cycle.js` | Tab Fortschritt / Zyklus |
| `challenges.js` | Tab Challenges, Badge für neue Challenges, teilen |
| `konto.js` | Tab Konto, Crews, Animationsstufe, Navigation anordnen |
| `privacy.js` / `help.js` / `custom-exercises.js` | Datenschutz + Export/Löschen / Hilfe-Texte / eigene Übungen + Wünsche |

Große Dateien nicht ganz lesen, gezielt suchen: `exercise-figures.js`, `sloth-rig-data.js`, `data.js`.

## CSS (css/)
Positional aufgeteilt, Reihenfolge = Kaskade. `01–03` alter Look, ab `04` neuer Look, der ältere
Regeln überschreibt: Eine Komponente steht oft in zwei Dateien (z. B. Board in `02`/`03` **und**
`05`/`08`). Eigenen Präfix suchen (`.fb`, `.fbx`, `.pg`, `.fs`, `#duel`, `.sloth`) und alle Treffer prüfen.

## Fallstricke
- Zeitkritisch, nur mit Smoke-Test ändern: `fb-runner.js` (Ton-Vorlauf, Pause/Weiter, Check-in) und
  die Freestyle-Phasenmaschine in `gym.js`.
- Zur Laufzeit verändert: `EXERCISE_LIBRARY` (eigene Übungen), `SLOTH_POSES` (`fbHangPose`).
- Firebase-Pfade müssen zu `database.rules.json` passen.
