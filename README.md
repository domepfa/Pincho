# Pincho

Krafttraining-App fürs Klettern: Wochenplan, eigenes Logbuch, ein
Fingerboard-Timer-Tool (Beastmaker 1000/2000) und Motivations-Challenges für
eine kleine Crew (bis ~5 Personen). Kein Wettkampf, keine Rangliste — nur
"hast du's auch gemacht?".

Reines HTML/CSS/JS ohne Framework und ohne Build-Schritt (gleiches Prinzip
wie bei Firnspur/Fixseil), Speicherung über Firebase Realtime Database.

## Setup

### 1. Firebase-Projekt anlegen

1. [Firebase Console](https://console.firebase.google.com/) → "Projekt hinzufügen" → eigenes Projekt (z. B. `pincho-crew`).
2. Im Projekt: **Build → Realtime Database → Datenbank erstellen**. Region z. B. `europe-west1`.
3. Unter **Regeln** vorerst offen setzen (nur für Freundeskreis mit eigenem
   Team-Code gedacht, kein sensibler Datenschutzfall — aber bewusste
   Entscheidung, siehe "Sicherheit" unten):
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Die Datenbank-URL oben in der Konsole kopieren (Format
   `https://<projekt>-default-rtdb.<region>.firebasedatabase.app`).
5. In [`firebase.js`](./firebase.js) die Konstante `FIREBASE_URL` durch diese
   URL ersetzen.

### 2. Hosting (z. B. GitHub Pages)

Repo-Einstellungen → **Pages** → Branch `main`, Ordner `/ (root)`. Danach ist
die App unter `https://domepfa.github.io/Pincho/` erreichbar. Läuft genauso
gut lokal per Doppelklick auf `index.html` oder mit einem simplen
`python3 -m http.server`.

### 3. Erste Anmeldung

- Beim allerersten Öffnen ist die Mitgliederliste leer → über **"+ Neu"**
  auf dem Login-Screen alle Crew-Mitglieder einmal anlegen.
- Der **Code** ist ein einziger, geteilter Team-Code (kein Passwort pro
  Person). Wer ihn zuerst einträgt, legt ihn fest — danach müssen alle den
  gleichen Code verwenden. Login gilt einmal pro Gerät (in `localStorage`
  gespeichert), kein wiederholtes Eintippen nötig.
- Board-Zuordnung (Beastmaker 1000 vs. 2000) wird beim ersten Umschalten im
  Fingerboard-Tab automatisch im eigenen Profil gespeichert.

## Sicherheit — bewusste Abwägung

Die offenen Firebase-Regeln bedeuten: Wer die Datenbank-URL kennt, kommt an
die Rohdaten (nicht nur über die App). Für eine private App mit 5 bekannten
Personen ist das ein akzeptabler Kompromiss gegen den Aufwand einer echten
Firebase-Authentifizierung. Falls das später zu wenig ist: Firebase Auth
(z. B. anonyme Anmeldung) plus Regeln, die auf die eingeloggte UID prüfen,
wäre der nächste Ausbauschritt.

## Offene Punkte / bewusst nicht in v1

- **Griff-mm-Werte**: Die Griffkategorien in [`data.js`](./data.js)
  (`BOARDS.bm1000` / `BOARDS.bm2000`) sind als Kategorien modelliert, nicht
  mit exakten mm-Angaben — die `note`-Felder sind Platzhalter. Da ihr beide
  Boards physisch habt: einmal ablesen und eintragen, dann stimmen auch die
  Beschriftungen im Fingerboard-Tool.
- **App-Icons**: Aktuell ein einfaches SVG (`icon.svg`). Für optimale
  iOS/Android-Installierbarkeit später durch echte PNG-Icons (192×192,
  512×512) ersetzen.
- **Wearables (COROS etc.)**: bewusst nicht angebunden — siehe Chat-Verlauf,
  Aufwand/Nutzen für dieses Projekt aktuell nicht sinnvoll.
- **Timer**: Start/Stop, kein Pause/Resume — Stop verwirft den aktuellen
  Durchgang. Reicht für den Anwendungsfall, kann bei Bedarf ergänzt werden.

## Projektstruktur

```
index.html      App-Shell, lädt Fonts + Scripts
styles.css      Gesamtes Styling (ein dunkles Theme: Granit/Chalk/Flechte/Alpenglühen)
data.js         Statische Konfiguration: Boards, Protokolle, Übungen, Standard-Wochenplan
firebase.js     Dünne REST-Anbindung an Firebase Realtime Database
app.js          Login, Routing, Views (Plan/Log/Fingerboard/Challenges), Timer-Logik
manifest.json   PWA-Manifest
sw.js           Service Worker (Netzwerk-zuerst, Offline-Fallback fürs App-Shell)
icon.svg        App-Icon (Platzhalter)
```
