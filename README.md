# Pincho

Krafttraining-App fürs Klettern: Wochenplan, eigenes Logbuch mit
Übungsdatenbank und Trainingsplan-Vorlagen (Sätze/Wdh/Gewicht), ein
grafisches Fingerboard-Tool (Beastmaker 1000/2000, Griffe zum Antippen mit
mm-Angabe) mit frei zusammenstellbarem Ablauf aus Hang- und Übungs-Sätzen,
und Motivations-Challenges für eine kleine Crew (bis ~5 Personen). Kein
Wettkampf, keine Rangliste — nur "hast du's auch gemacht?".

Reines HTML/CSS/JS ohne Framework und ohne Build-Schritt (gleiches Prinzip
wie bei Firnspur/Fixseil), Speicherung über Firebase Realtime Database.

## Setup

### 1. Firebase-Projekt anlegen

1. [Firebase Console](https://console.firebase.google.com/) → "Projekt hinzufügen" → eigenes Projekt (z. B. `pincho-crew`).
2. Im Projekt: **Build → Realtime Database → Datenbank erstellen**. Region z. B. `europe-west1`.
3. Unter **Regeln** einen Login verlangen (siehe "Sicherheit" unten):
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```
4. Die Datenbank-URL oben in der Konsole kopieren (Format
   `https://<projekt>-default-rtdb.<region>.firebasedatabase.app`) und in
   [`firebase.js`](./firebase.js) bei `FIREBASE_URL` eintragen.
5. Unter **Projekteinstellungen → Allgemein → Meine Apps** eine Web-App
   registrieren (Symbol `</>`, beliebiger Spitzname reicht). Den `apiKey` aus
   dem angezeigten Code-Schnipsel in `firebase.js` bei `FIREBASE_API_KEY`
   eintragen.
6. Unter **Authentication → Sign-in method** die Methode **„E-Mail/Passwort"**
   aktivieren. Ohne diesen Schritt lehnt Firebase jeden Login ab.

### 2. Hosting

Da das Repo öffentlich ist (siehe "Sicherheit" unten), funktioniert **GitHub
Pages kostenlos**: Repo-Einstellungen → **Pages** → Branch `main`, Ordner
`/ (root)`. Danach ist die App unter `https://domepfa.github.io/Pincho/`
erreichbar. Läuft genauso gut lokal per Doppelklick auf `index.html` oder mit
einem simplen `python3 -m http.server`.

### 3. Erste Anmeldung

- **Team-Code**: Beim allerersten Öffnen gibt es noch keinen gemeinsamen
  Firebase-Auth-Account — wer als Erste/r einen Code eingibt, richtet ihn
  damit automatisch ein (technisch: ein `signUp` auf einen einzigen,
  gemeinsamen Auth-Account für die ganze Crew). Alle weiteren müssen
  denselben Code verwenden. Login gilt einmal pro Gerät (Token in
  `localStorage`), kein wiederholtes Eintippen nötig.
- **Name wählen**: Nach dem Team-Code einmalig den eigenen Namen antippen
  (oder über "+ Neu" anlegen) — das ist rein lokal pro Gerät gemerkt und hat
  nichts mit dem Auth-Account zu tun (dient nur der Zuordnung "von wem ist
  diese Session/Challenge").
- Board-Zuordnung (Beastmaker 1000 vs. 2000) wird beim ersten Umschalten im
  Fingerboard-Tab automatisch im eigenen Profil gespeichert.

## Sicherheit

Gleiches Modell wie bei Firnspur/Fixseil: **ein einziger, gemeinsamer**
Firebase-Auth-Account fürs Team (die Mailadresse dafür ist nur ein
technischer Platzhalter, siehe `AUTH_EMAIL` in `firebase.js`, keine echte
Adresse). Das "Passwort" dieses Accounts ist euer Team-Code. Die
Datenbank-Regeln verlangen `auth != null` — ohne gültigen Code kommt niemand
an die Daten, auch nicht bei öffentlichem Repo (der `apiKey` in `firebase.js`
ist bei Firebase kein Geheimnis, siehe
[Google-Doku](https://firebase.google.com/docs/projects/api-keys) — die
Sicherheit kommt von den Regeln, nicht vom Verstecken des Keys). Wer welche
Person ist (Name), ist davon unabhängig und rein lokal gespeichert — keine
echten Einzel-Accounts nötig.

## Offene Punkte / bewusst nicht in v1

- **App-Icons**: Aktuell ein einfaches SVG (`icon.svg`). Für optimale
  iOS/Android-Installierbarkeit später durch echte PNG-Icons (192×192,
  512×512) ersetzen.
- **Wearables (COROS etc.)**: bewusst nicht angebunden — siehe Chat-Verlauf,
  Aufwand/Nutzen für dieses Projekt aktuell nicht sinnvoll.
- **Fingerboard-Ablauf**: Zwischen den Sätzen wird bewusst nicht automatisch
  weitergezählt — nach jedem Satz erscheint "Los" für den nächsten, damit
  Zeit zum Ablesen/Chalken bleibt. "Abbrechen" verwirft den laufenden Satz,
  kein Pause/Resume innerhalb eines Hang-Satzes.

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
