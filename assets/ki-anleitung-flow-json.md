# Pincho — Flow (Yoga/Pilates) per KI erzeugen (JSON-Format)

Diese Anleitung ist dafür gedacht, sie komplett an eine KI (ChatGPT, Claude
usw.) zu schicken, zusammen mit einer Beschreibung des gewünschten Flows in
eigenen Worten (z. B. "10 Minuten Morgen-Yoga zum Aufwachen, ruhig, mit
Fokus auf Rücken und Hüfte"). Die KI soll daraus ein JSON-Array erzeugen,
das man danach in Pincho unter **Gym → Flow → Flow aus JSON importieren**
einfügt.

---

## Prompt für die KI (bitte unverändert mitschicken)

Du erzeugst ein JSON-Array für die App "Pincho". Jedes Element im Array ist
eine Pose. Halte dich EXAKT an die Feldnamen und die Liste der `poseId`
weiter unten — erfinde keine zusätzlichen Felder und keine `poseId`, die
nicht in der Referenzliste steht. Gib am Ende NUR das reine JSON-Array
zurück, ohne Erklärtext drumherum, ohne Markdown-Codeblock.

### Grundstruktur

```json
[
  { "poseId": "mountain_pose", "holdSec": 20, "restSec": 5 },
  { "poseId": "downward_dog", "holdSec": 30, "restSec": 5 }
]
```

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `poseId` | String | ja | ID aus der Posen-Liste unten |
| `holdSec` | Zahl > 0 | ja | Haltedauer der Pose in Sekunden |
| `restSec` | Zahl >= 0 | optional (Default 5) | Wechselzeit danach, bevor die nächste Pose beginnt |

Ein Flow ist einfach eine geordnete Liste — die Posen laufen automatisch
nacheinander durch, jede mit eigenem Sekundentimer, ohne dass man
zwischendurch etwas antippen muss.

---

## Referenz: Posen-IDs (`poseId`)

**Yoga:** `mountain_pose` (Berghaltung), `downward_dog` (Herabschauender
Hund), `childs_pose` (Kindshaltung), `cat_cow_flow` (Katze-Kuh),
`cobra_pose` (Kobra), `warrior_1` (Krieger I), `warrior_2` (Krieger II),
`triangle_pose` (Dreieck), `extended_side_angle` (Ausgestreckter
Seitwinkel), `chair_pose` (Stuhl), `tree_pose` (Baum), `eagle_pose`
(Adler), `low_lunge` (Tiefer Ausfallschritt), `pigeon_pose` (Taube),
`bridge_pose` (Brücke), `camel_pose` (Kamel), `seated_forward_fold_flow`
(Sitzende Vorbeuge), `reclining_twist` (Liegende Drehung), `happy_baby`
(Glückliches Baby), `corpse_pose` (Totenhaltung/Savasana)

**Pilates:** `pilates_hundred` (The Hundred), `roll_up` (Roll-Up),
`leg_circles_pilates` (Beinkreisen), `spine_stretch_pilates`
(Wirbelsäulen-Dehnung sitzend), `saw_pilates` (Die Säge), `swan_pilates`
(Schwan), `plank_pilates` (Pilates Plank), `side_plank_pilates`
(Seitstütz), `shoulder_bridge_pilates` (Schulterbrücke), `teaser_prep`
(Teaser-Vorbereitung)

---

## Komplettes Beispiel

Ruhiger 5-Minuten-Cooldown-Flow:

```json
[
  { "poseId": "childs_pose", "holdSec": 40, "restSec": 5 },
  { "poseId": "cat_cow_flow", "holdSec": 30, "restSec": 5 },
  { "poseId": "downward_dog", "holdSec": 30, "restSec": 5 },
  { "poseId": "low_lunge", "holdSec": 30, "restSec": 5 },
  { "poseId": "seated_forward_fold_flow", "holdSec": 40, "restSec": 5 },
  { "poseId": "reclining_twist", "holdSec": 30, "restSec": 5 },
  { "poseId": "corpse_pose", "holdSec": 60, "restSec": 0 }
]
```

Dieses JSON-Array direkt (ohne weitere Erklärungen) in Pincho unter
**Gym → Flow → Flow aus JSON importieren** einfügen und auf "Importieren"
tippen.
