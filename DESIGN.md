# Design-Leitfaden (Pincho als Vorlage)

Kurzfassung dessen, was bei Pincho funktioniert hat, damit andere Apps
(z. B. Firnspur) ohne langes Erklären ähnlich überarbeitet werden können.
**Teil A gilt allgemein, Teil B ist nur Pinchos eigener Look.** Er dient als
Beispiel und soll für eine App mit anderem Charakter bewusst neu gewählt
werden.

---

## A. Übertragbar: Prinzipien und Arbeitsweise

### Zusammenarbeit
- **Erst besprechen, dann bauen.** Kurze Rückfragen, kurze Antworten
  (Tokens sparen). Keine langen Optionslisten, lieber eine Empfehlung.
- **Schritt für Schritt**, jeder Schritt ein eigener PR mit Squash-Merge.
  So kann jederzeit etwas Dringenderes vorgezogen werden.
- **Zuerst in einer Beta** (`/beta/`, eigener Offline-Speicher und Cache),
  dann mit einem Skript in die Haupt-App übernehmen
  (siehe `tools/promote-beta.sh`).
- **Vor jedem Merge testen** (Playwright, Handy-Größe 390×844, Screenshot
  anschauen). Bei größeren Designfragen erst einen klickbaren Entwurf zeigen.

### Bedienung im Einsatz (Training, draussen, Handschuhe …)
- **Ein großer Hauptknopf an fester Stelle** (unten, über der Navigation)
  statt kleiner Knöpfe, die man suchen muss. Er zeigt immer den nächsten
  sinnvollen Schritt.
- **Große Zahlen** für Zeiten und Werte, Beschriftung klein darüber.
- **Werte vom letzten Mal vorausfüllen und markieren.** Tippen ersetzt sie
  direkt, Enter springt ins nächste Feld.
- **Zuletzt Genutztes zuoberst** in Auswahllisten, dazu eine Suche.
- **Tippen statt Tippen-und-Suchen:** direkt auf Bild oder Grafik auswählen
  (Körperkarte, Griffe, Sprossen), Listen nur als Alternative.
- **Farbe hat eine Bedeutung und bleibt überall gleich** (z. B. links blau,
  rechts orange; Pause orange). Nie Farbe allein: immer mit Text oder Form.
- **Vor der Aktion zeigen, was kommt** (Vorschau oder Animation in der
  Pause), während der Aktion ruhig bleiben.
- **Kein Knopf ohne Funktion:** Was gerade nicht geht, wird ausgeblendet
  statt ausgegraut.
- **Alles passt ohne Scrollen** auf Vollbild-Ansichten.
- **Löschen immer mit Rückfrage**, Ausblenden ist umkehrbar.

### Technik, die sich bewährt hat
- **Offline-first:** lokale Kopie plus Warteschlange, Netz mit Zeitlimit,
  Start ohne Login-Abfrage, wenn schon einmal angemeldet.
- **Sensible Daten** (Gesundheit o. Ä.) nie im Klartext in einer gemeinsam
  lesbaren Datenbank.
- **Emoji-Zeichen als Symbole vermeiden** (Android zeichnet sie als bunte
  Kacheln), stattdessen SVG-Icons.
- **App-Icon:** Maskable-Variante mit Hintergrund und Rand, damit Android
  beim runden Zuschneiden nichts abschneidet.
- **Diagramme:** eine Serie pro Diagramm, keine zweite y-Achse, Farben mit
  dem dataviz-Validator prüfen.

---

## B. Nur Pincho: der konkrete Look (als Beispiel)

**Charakter:** Kraft, Fokus, Gym am Abend. Dunkel, sportlich, kontrastreich,
mit Augenzwinkern (Faultier = Fingerkraft).

| Element | Pincho |
|---|---|
| Hintergrund / Flächen | `#07090c` / `#10151b` / `#161d25` |
| Linien | `#2f3a47`, dezent `#1f2731` |
| Text | `#f4f6f8`, gedämpft `#b3bdc8`, leise `#9aa6b4` |
| Akzent | Blau `#4fc3ff` (Text darauf `#04141f`) |
| Zweitfarbe | Orange `#ff6b47` (Pause, rechte Hand) |
| Diagramm-Kategorien | `#2f95cf`, `#c4851c`, `#9b7be6` (validiert) |
| Schrift | Barlow (Text), Barlow Condensed 700 (Zahlen, Titel) |
| Radien | Karten 16–20 px, Knöpfe 14 px, Chips/Pillen rund |
| Hauptknopf | kräftig blau gefüllt, dunkle Schrift |
| Nebenknopf | dunkle Fläche, weisse Schrift, sichtbarer Rand, nie grau auf grau |
| Chips | Pillen, aktiv = weiss gefüllt mit dunkler Schrift |
| Navigation | unten, Symbol + Text, aktiver Tab als Pille |
| Maskottchen | Faultier (Hintergrund-Strichzeichnung, Figur im Ablauf) |

Die Werte stehen in `beta/styles.css` (Abschnitt „BETA — neuer Look“)
als Überschreib-Schicht über dem alten Stil. Diese Aufteilung hat den Umbau
Schritt für Schritt möglich gemacht.

---

## Für eine andere App (z. B. Firnspur): so starten

1. Neue Sitzung mit beiden Repos: der Ziel-App und Pincho als Vorlage.
2. Auftrag: „Nach `Pincho/DESIGN.md` Teil A überarbeiten, Teil B nur als
   Beispiel, eigener Charakter.“
3. In 2–3 Sätzen beschreiben:
   - Wofür wird die App genutzt, und in welcher Situation (draussen, mit
     Handschuhen, bei Kälte …)?
   - Was nervt heute?
   - Was muss bleiben?
4. Stimmung und Symbol der App nennen (z. B. Berg, Schnee, Gletscher,
   Tageslicht statt Gym-Nacht?).
5. Screenshots der wichtigsten Bildschirme mitschicken.
6. Zuerst einen klickbaren Design-Entwurf zeigen lassen, dann Beta, dann
   Schritt für Schritt.
