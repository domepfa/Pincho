# Pincho — Ablauf per KI erzeugen (JSON-Format)

Diese Anleitung ist dafür gedacht, sie komplett an eine KI (ChatGPT, Claude
usw.) zu schicken, zusammen mit einer Beschreibung des gewünschten
Trainings in eigenen Worten (z. B. "5 Sätze Jug 7 Sekunden, dann 3 Sätze
Campus Leiste 27 von Sprosse 1 auf 9 und wieder zurück auf 4"). Die KI soll
daraus ein JSON-Array erzeugen, das man danach in Pincho unter
**Board → Ablauf aus JSON importieren** einfügt.

---

## Prompt für die KI (bitte unverändert mitschicken)

Du erzeugst ein JSON-Array für die App "Pincho". Jedes Element im Array ist
ein Trainingssatz ("Block"). Halte dich EXAKT an die Feldnamen, Typen und
erlaubten Werte weiter unten — erfinde keine zusätzlichen Felder und keine
IDs, die nicht in den Referenzlisten stehen. Gib am Ende NUR das reine
JSON-Array zurück, ohne Erklärtext drumherum, ohne Markdown-Codeblock.

### Grundstruktur

```json
[
  { "type": "hang", ... },
  { "type": "pause", "seconds": 60 },
  { "type": "exercise", ... },
  { "type": "campus", ... }
]
```

`type` ist immer eines von: `"hang"`, `"exercise"`, `"campus"`, `"pause"`.

---

### Block-Typ `hang` (Fingerboard-Hang)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `board` | String | ja | `"bm1000"` oder `"bm2000"` (siehe Griff-Tabellen unten) |
| `grip` | String | ja, ausser bei asymmetrisch | Griff-ID, muss zum `board` passen |
| `gripLeft` / `gripRight` | String | nur bei asymmetrischem Griff (unterschiedliche Griffe pro Hand) | ersetzen `grip`, IMMER beide zusammen angeben |
| `reps` | Zahl > 0 | ja | Anzahl Sätze/Hänge in diesem Block |
| `hangSec` | Zahl > 0 | ja | Hängedauer pro Satz in Sekunden |
| `restSec` | Zahl >= 0 | ja | Pause zwischen den Sätzen in Sekunden |
| `blockRestSec` | Zahl >= 0 | optional | Pause NACH diesem ganzen Block, bevor der nächste beginnt |

Beispiel (symmetrisch):
```json
{ "type": "hang", "board": "bm1000", "grip": "edge_large", "reps": 6, "hangSec": 7, "restSec": 60, "blockRestSec": 90 }
```

Beispiel (asymmetrisch, pro Hand ein anderer Griff):
```json
{ "type": "hang", "board": "bm2000", "gripLeft": "edge_large", "gripRight": "edge_small", "reps": 5, "hangSec": 10, "restSec": 90 }
```

---

### Block-Typ `campus` (Campusboard)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `rungType` | String | ja | Sprossen-Typ, siehe Tabelle unten |
| `moveMode` | String | ja | `"direct"` (ein Sprung) oder `"pattern"` (mehrere Schritte/Route) |
| `reps` | Zahl > 0 | ja | wie oft diese GANZE Bewegung (der Sprung bzw. die ganze Route) hintereinander wiederholt wird |
| `workSec` | Zahl > 0 | ja | Zeit pro Wiederholung in Sekunden |
| `restSec` | Zahl >= 0 | optional (Default 0) | Pause zwischen den Wiederholungen |
| `blockRestSec` | Zahl >= 0 | optional | Pause NACH diesem ganzen Block |
| `armMode` | String | optional (Default `"both"`) | `"both"` (beidarmig/gleichzeitig), `"match"` (Nachziehen), `"skip"` (Übergreifen) |
| `startHand` | String | optional (Default `"left"`), nur relevant wenn `armMode` != `"both"` | `"left"` oder `"right"` — welche Hand zuerst |

Bei `moveMode: "direct"` zusätzlich:

| Feld | Typ | Beschreibung |
|---|---|---|
| `fromRung` | Zahl > 0 | Start-Sprosse |
| `toRung` | Zahl > 0 | Ziel-Sprosse (grösser = rauf, kleiner = runter) |

Bei `moveMode: "pattern"` zusätzlich:

| Feld | Typ | Beschreibung |
|---|---|---|
| `startRung` | Zahl > 0 | Start-Sprosse |
| `pattern` | Array von Zahlen != 0 | Abfolge einzelner Schritte ab `startRung`. Positiv = rauf, negativ = runter. Die Zahl ist die Sprossen-Distanz pro Schritt. |

**Wichtig zu `pattern`:** Das ist eine flache Liste einzelner Schritte, KEINE
Kurzschreibweise für "rauf/runter/Schrittweite". Ein Satz "Sprosse 1 → 9 →
zurück auf 4" (also 8 Schritte rauf, dann 5 Schritte runter, je 1 Sprosse
pro Schritt) sieht so aus:

```json
{
  "type": "campus", "rungType": "leiste_27", "moveMode": "pattern",
  "startRung": 1, "pattern": [1,1,1,1,1,1,1,1,-1,-1,-1,-1,-1],
  "reps": 4, "workSec": 3, "restSec": 15, "blockRestSec": 90
}
```

Eine Skip-Leiter "1-3-5-7-9" (immer 2 Sprossen pro Schritt) sieht so aus:

```json
{
  "type": "campus", "rungType": "rundleiste_gross", "moveMode": "pattern",
  "startRung": 1, "pattern": [2,2,2,2],
  "reps": 4, "workSec": 3, "restSec": 15
}
```

Ein einfacher direkter Sprung 1 → 4:

```json
{ "type": "campus", "rungType": "leiste_27", "moveMode": "direct", "fromRung": 1, "toRung": 4, "reps": 4, "workSec": 3, "restSec": 15 }
```

---

### Block-Typ `exercise` (Zusatzübung, z. B. in der Fingerboard-Pause)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `exerciseId` | String | ja | ID aus der Übungsliste unten |
| `reps` | Zahl > 0 | ja | Wiederholungen pro Satz |
| `workSec` | Zahl > 0 | optional (Default 40) | Zeit pro Satz |
| `restSec` | Zahl >= 0 | optional (Default 0) | Pause zwischen den Sätzen |

```json
{ "type": "exercise", "exerciseId": "face_pull", "reps": 15, "workSec": 40, "restSec": 30 }
```

---

### Block-Typ `pause`

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `seconds` | Zahl > 0 | ja | reine Pause, z. B. zwischen zwei ganz unterschiedlichen Übungsblöcken |

```json
{ "type": "pause", "seconds": 120 }
```

---

## Referenz: Boards und Griffe

### `board: "bm1000"` (Beastmaker 1000) — gültige `grip`-IDs
`jug`, `edge_large`, `edge_medium`, `edge_small`, `edge_xsmall`, `edge3`,
`pocket3`, `pocket3_deep`, `pocket2`, `pocket2_deep`, `sloper_easy`,
`sloper_medium`

### `board: "bm2000"` (Beastmaker 2000) — gültige `grip`-IDs
`edge_large`, `edge_medium`, `edge_small`, `edge_xsmall`, `pocket3`,
`pocket3_small`, `pocket2`, `pocket2_small`, `pocket2_offset`, `mono`,
`mono_small`, `sloper_easy`, `sloper_medium`, `sloper_hard`

(`gripLeft`/`gripRight` müssen aus derselben Liste des jeweiligen `board`
stammen wie `grip`.)

## Referenz: Campus-Sprossentypen (`rungType`)

`rundleiste_gross`, `kugel_gross`, `kugel_klein`, `leiste_35`, `leiste_27`,
`leiste_19`, `leiste_gross`

## Referenz: Übungs-IDs (`exerciseId`)

**Zug:** `pullup` (Klimmzug), `pullup_weighted` (Klimmzug mit
Zusatzgewicht), `lat_pulldown` (Latzug), `lat_pulldown_single` (Latzug
einarmig), `row_cable` (Rudern Kabel), `row_barbell` (Rudern Langhantel),
`pullup_close_grip` (Klimmzug enger Griff), `t_bar_row` (T-Bar Rudern),
`lat_pulldown_wide` (Latzug weiter Griff), `straight_arm_pulldown` (Latzug
gestreckte Arme)

**Antagonisten:** `face_pull` (Face Pulls), `ext_rotation`
(Aussenrotation Kabel), `wrist_ext` (Reverse Wrist Curls), `y_t_w`
(Y-T-W-Raises), `scapula_pull` (Scapula Pulls), `band_pull_apart`
(Band Pull-Apart), `reverse_butterfly` (Reverse Butterfly)

**Rumpf:** `pallof` (Pallof Press), `crunches` (Crunches),
`hanging_leg_raise` (Hanging Leg Raise), `front_lever_prog`
(Front-Lever-Progression), `toes_to_bar` (Toes-to-Bar), `plank`
(Unterarmstütz/Plank), `side_plank` (Seitstütz), `russian_twist`
(Russian Twist), `hollow_hold` (Hollow Body Hold), `superman` (Superman),
`bird_dog` (Bird Dog), `swimmer` (Schwimmer), `back_extension`
(Backextension), `ab_wheel_rollout` (Ab-Roller), `cable_woodchop`
(Cable Woodchop), `dead_bug` (Dead Bug), `mountain_climbers`
(Mountain Climbers), `sit_up` (Sit-up)

**Push (Brust/Schulter/Trizeps):** `push_up` (Liegestütz), `bench_press`
(Bankdrücken), `incline_bench_press` (Schrägbankdrücken), `ohp`
(Overhead Press), `dips` (Dips), `butterfly` (Butterfly),
`triceps_extension` (Trizepsstrecker), `decline_bench_press`
(Negativ-Bankdrücken), `dumbbell_bench_press` (Kurzhantel-Bankdrücken),
`dumbbell_flyes` (Kurzhantel-Fliegende), `cable_crossover`
(Kabelzug Crossover), `dumbbell_pullover` (Kurzhantel-Pullover)

**Beine/Hüfte:** `squat` (Kniebeuge), `deadlift` (Kreuzheben), `rdl`
(Romanian Deadlift), `zercher_squat_rotation` (Zerchersquat in Rotation),
`split_squat` (Bulgarian Split Squat), `leg_extension` (Beinstrecker),
`leg_curl_lying` (Beinbieger im Liegen), `hip_abduction_cable`
(Abduktion am Kabel), `calf_raise` (Wadenheben), `calf_raise_machine`
(Wadenheben Maschine), `calf_raise_seated` (Wadenheben sitzend),
`tibialis_raise` (Tibialis Raise), `wall_sit` (Wall Sit), `glute_bridge`
(Glute Bridge), `deadlift_sumo` (Kreuzheben Sumo), `hip_thrust`
(Hüftstoss/Hip Thrust), `leg_press` (Beinpresse), `lunge_dumbbell`
(Ausfallschritte Kurzhantel), `goblet_squat` (Goblet Squat), `sumo_squat`
(Sumo-Kniebeuge), `step_up` (Step-ups), `nordic_hamstring_curl`
(Nordic Hamstring Curl)

**Mobilität:** `cat_cow` (Katze-Kuh), `worlds_greatest_stretch`
(World's Greatest Stretch), `hip_9090` (Hüftwechsel 90/90),
`thoracic_rotation` (BWS-Rotation/Thread the Needle),
`shoulder_circles_band` (Schulterkreisen mit Band), `wrist_mobility`
(Handgelenk-Mobilisation), `leg_swings` (Beinschwingen), `ankle_rocks`
(Sprunggelenk-Mobilisation), `neck_mobility` (Nacken-Mobilisation),
`doorway_pec_stretch` (Türrahmen-Dehnung Brust)

**Arm:** `bicep_curl_dumbbell` (Bizeps-Curl Kurzhantel),
`bicep_curl_barbell` (Bizeps-Curl Langhantel), `hammer_curl`
(Hammer-Curl), `cable_curl` (Bizeps-Curl Kabel), `close_grip_bench_press`
(Enges Bankdrücken), `skull_crusher` (French Press/Skullcrusher),
`lateral_raise` (Seitheben), `front_raise` (Frontheben), `wrist_curl`
(Handgelenk-Curl)

---

## Komplettes Beispiel

Aufwärmen, dann 5 Hang-Sätze, Pause, dann 3 Campus-Sätze mit Route
1 → 9 → 4:

```json
[
  { "type": "hang", "board": "bm1000", "grip": "jug", "reps": 3, "hangSec": 10, "restSec": 30, "blockRestSec": 60 },
  { "type": "hang", "board": "bm1000", "grip": "edge_medium", "reps": 5, "hangSec": 7, "restSec": 60, "blockRestSec": 90 },
  { "type": "pause", "seconds": 120 },
  {
    "type": "campus", "rungType": "leiste_27", "moveMode": "pattern",
    "startRung": 1, "pattern": [1,1,1,1,1,1,1,1,-1,-1,-1,-1,-1],
    "reps": 3, "workSec": 4, "restSec": 20, "blockRestSec": 90,
    "armMode": "both"
  }
]
```

Dieses JSON-Array direkt (ohne weitere Erklärungen) in Pincho unter
**Board → Ablauf aus JSON importieren** einfügen und auf "Importieren"
tippen.
