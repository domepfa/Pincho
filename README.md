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
3. Unter **Regeln** den Inhalt von [`database.rules.json`](./database.rules.json)
   einfügen und darin **`ADMIN_EMAIL`** (kommt mehrfach vor, alle ersetzen)
   durch die eigene E-Mail ersetzen — die echte Adresse steht so nur in der
   Konsole, nicht im öffentlichen Repo. Siehe "Sicherheit" unten.
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

### 3. Erste Anmeldung (eigene Konten)

- **Admin zuerst**: Mit der Admin-E-Mail registrieren (Code-Feld
  leer lassen), den Bestätigungslink in der Mail antippen, dann „Neu
  prüfen". Danach erscheint **„Bestehende Crew übernehmen"**: eigenes Profil
  antippen — die App legt die erste Crew mit Einladungscode an, nimmt alle
  bisherigen Profile als „noch nicht dabei" auf und kopiert Challenges und
  geteilte Vorlagen in die Crew.
- **Einladen**: Unter **KONTO** (oben rechts) → „Einladen" schickt einen
  Link mit Code (z. B. per WhatsApp). Wer schon ein Profil hatte, wählt beim
  Registrieren „Das bin ich: …" und bekommt alle bisherigen Trainings; neue
  Leute wählen einen Namen (jeder Name nur einmal).
- **Crews**: Man kann in mehreren Crews sein; Challenges und geteilte
  Vorlagen gelten für die aktive Crew. Wer eine Crew gegründet hat, sieht den
  Code, kann ihn erneuern (alter wird ungültig) und Leute entfernen.
- **Crew gründen** darf vorerst nur der Admin. Für alle freischalten: in der
  Firebase-Konsole unter **Daten** `config/crewCreationOpen` = `true` setzen.
- Board-Zuordnung (Beastmaker 1000 vs. 2000) wird beim ersten Umschalten im
  Fingerboard-Tab automatisch im eigenen Profil gespeichert.

## Sicherheit

Jede Person hat ein **eigenes Konto** (E-Mail + Passwort, Firebase Auth).
Die Regeln in [`database.rules.json`](./database.rules.json) sorgen dafür, dass

- private Daten (Logs, Pläne, Vorlagen, Einstellungen unter `…/{memberId}`)
  nur die Person selbst lesen/schreiben kann (`members/{id}/uid` = eigenes
  Konto; `users/{uid}/memberId` zeigt aufs eigene Profil),
- Crew-Daten (`crewData/{crewId}`: Challenges, geteilte Vorlagen) nur
  Mitglieder der Crew sehen,
- ein Profil nur mit gültigem **Einladungscode** entsteht — ein Fremder kann
  höchstens ein leeres Login-Konto anlegen, aber nichts lesen oder schreiben,
- den Code (`crewSecrets`) nur sieht, wer die Crew gegründet hat.

Der `apiKey` in `firebase.js` ist bei Firebase kein Geheimnis (siehe
[Google-Doku](https://firebase.google.com/docs/projects/api-keys)) — die
Sicherheit kommt von den Regeln.

Der frühere gemeinsame Team-Login (`crew@pincho.app`) hat seit der
Übernahme der eigenen Konten in die Haupt-App keinen Zugriff mehr.

## Offline

Die App startet auch ohne bzw. mit sehr schlechtem Netz (z. B. im Gym):

- **Service Worker** (`sw.js`): Code/Seiten kommen aus dem Netz, wenn es
  innert 2,5 s antwortet, sonst sofort aus der gespeicherten Kopie. Die
  Netz-Antwort aktualisiert die Kopie im Hintergrund (neue Version beim
  nächsten Öffnen). Bilder und Google Fonts: Cache zuerst.
- **Daten** (`firebase.js`): Jeder gelesene Pfad wird in `localStorage`
  gespiegelt (`pincho_c:<pfad>`). Schreibzugriffe landen zuerst lokal und in
  einer Warteschlange (`pincho_queue`), die automatisch hochgeladen wird,
  sobald wieder Netz da ist. Push-IDs werden lokal erzeugt (Firebase-Format).
- **Login**: Ein einmal angemeldetes Gerät startet offline direkt, das
  Token wird im Hintergrund erneuert.

## Beta (`/beta/`)

Unter `https://domepfa.github.io/Pincho/beta/` läuft parallel eine Beta
(installierbar als eigene App „Pincho Beta"). Neues landet zuerst dort und
wird erst nach dem Testen in die Haupt-App übernommen.

- Eigene Kopie der Dateien in `beta/` (Bilder/Anleitungen aus `../assets/`).
- Gleiche Firebase-Daten und gleiche Konten wie die Haupt-App (Anmeldung
  gilt aber pro App), eigener Offline-Speicher (`pinchobeta_…`-Keys, Cache `pincho-beta-…`) — beide
  Service Worker löschen nur ihre eigenen alten Caches.
- Neuer Look als Überschreib-Schicht am Ende von `beta/styles.css`.
- **Übernehmen in die Haupt-App:** `tools/promote-beta.sh` kopiert
  `app.js`, `data.js`, `firebase.js`, `styles.css` und `index.html` aus
  `beta/` in die Wurzel, stellt Pfade (`../assets/` → `./assets/`),
  Speicher-Keys (`pinchobeta_` → `pincho_`), Titel und Icons zurück und
  zählt die Cache-Version der Haupt-App hoch. `manifest.json`/`sw.js` der
  Haupt-App bleiben eigenständig. Das BETA-Schild erscheint automatisch nur
  unter `/beta/`.

## Offene Punkte / bewusst nicht in v1

- **Zyklus-Tracking** (Tab Fortschritt): freiwillig (Schalter mit
  Zustimmung), privat unter `cycle/{memberId}`. Nur Periodenbeginn wird
  eingetragen; Phasen/nächste Periode sind eine Schätzung (Ø-Länge,
  Eisprung ~14 Tage vorher). Phasen als Bänder hinter den Kurven, Tipp pro
  Phase, „Mehr erfahren" mit Quellen und „Deine Leistung nach Phase"
  (jede Einheit relativ zum eigenen Niveau ±4 Wochen).
- **Muskelfaultier** (`assets/sloth/`, freigestellte PNGs, 640 px hoch):
  hängend (Hang-Satz), sitzend mit Flasche (Pausen), winkend („Ablauf
  geschafft!"), Klimmzug unten/oben im Wechsel (Klimmzug-Übungen, Stange an
  derselben Höhe ausgerichtet), flexend (neuer Rekord im Fortschritt).
- **Nächste Schritte (Stand 26.09.2026)**: Einheitlicher Figuren-Stil —
  Strichmännchen, animierte Faultier-Gliederpuppe (Prototyp in
  `tools/sloth-rig/`) und Faultier-Posen nicht wild mischen. Für die
  Gliederpuppe fehlen eine Seitenansicht-Vorlage und separate Oberarme.
- **Hilfe** (`#hilfe`, unter KONTO → „So funktioniert Pincho"): ein
  aufklappbarer Abschnitt pro Tab (`HELP_SECTIONS` in `app.js`) — bei neuen
  Funktionen dort mitpflegen.
- **Datenschutz** (`#datenschutz`, auch ohne Anmeldung): Betreiber „Dome";
  die Kontakt-Adresse steht nicht im Code, sondern in `config/contact`
  (nur für Angemeldete lesbar, setzt der Admin unter KONTO). Unter KONTO
  zudem „Meine Daten herunterladen" (JSON) und „Konto löschen" (mit
  Passwort; wer eine Crew mit anderen gegründet hat, muss sie zuerst leeren).
- **App-Icons**: Logo `assets/icon-512-any.png` (Original, auch im Login).
  Daraus erzeugt: `icon-512-transparent.png`/`icon-192-any.png` (ohne weissen
  Hintergrund) und `icon-512-maskable.png` (dunkler Hintergrund, Logo im
  sicheren Bereich, damit Android beim runden Zuschneiden nichts abschneidet);
  Beta-Varianten `icon-beta-*` mit BETA-Schild.
- **Wearables (COROS etc.)**: bewusst nicht angebunden — siehe Chat-Verlauf,
  Aufwand/Nutzen für dieses Projekt aktuell nicht sinnvoll.
- **Fingerboard-Ablauf**: Zwischen den Sätzen wird bewusst nicht automatisch
  weitergezählt — nach jedem Satz erscheint "Los" für den nächsten, damit
  Zeit zum Ablesen/Chalken bleibt. "Abbrechen" verwirft den laufenden Satz,
  kein Pause/Resume innerhalb eines Hang-Satzes.
- **Fingerboard-Vorlagen**: Keine fest eingebauten Vorlagen mehr. Eigene,
  per "Als Vorlage speichern" gesicherte Abläufe landen pro Mitglied unter
  `fingerboardTemplates/{memberId}`, geteilte als Kopie in `sharedTemplates`.
  Im Schnelltraining getrennt als Tabs **Eigene** (löschbar, inkl. geteilter
  Kopie) und **Crew** (Filter nach Ersteller, pro Person ausblendbar über
  `hiddenTemplates/{memberId}`). Ablauf-Zeit inkl. Übungspausen wird über
  `restSec` bei Exercise-Sätzen mitgerechnet (siehe `fbEstimateSeconds` in
  `app.js`).
- **Ablauf-Vollbild**: Sobald ein Ablauf startet, übernimmt `#fb-overlay`
  (an `document.body` gehängt, nicht Teil von `#app`) den ganzen Bildschirm
  — inkl. Best-effort `requestFullscreen()` (fällt auf iOS o. Ä. einfach auf
  das CSS-Vollbild zurück). Fortschritt wird als Kletterer dargestellt, der
  an einer Wand hochsteigt (`fbOverallProgress()`, zeitbasiert, nicht nur
  Block-Index), plus eine "Danach: …"-Ankündigung, was als Nächstes kommt.
  Übungen zeigen wo vorhanden ein animiertes Strichmännchen
  (`EXERCISE_FIGURES`) — zwei Posen überblenden in Dauerschlaufe bei
  dynamischen Bewegungen, ein sanftes Pulsieren bei Halteübungen (Plank
  etc.); ohne hinterlegte Animation fällt es auf ein 💪-Emoji zurück. Neue
  Übungen bekommen eine Animation, indem man `EXERCISE_FIGURES[exerciseId]`
  in `app.js` ergänzt (Farbcode: gedämpft = fix, hell = bewegt, Lime = der
  Arbeitspunkt).

## Projektstruktur

```
index.html      App-Shell, lädt Fonts + Scripts
styles.css      Gesamtes Styling (ein dunkles Theme: Granit/Chalk/Flechte/Alpenglühen)
data.js         Statische Konfiguration: Boards, Protokolle, Übungen, Standard-Wochenplan
firebase.js     Dünne REST-Anbindung an Firebase Realtime Database + Auth
database.rules.json  Datenbank-Regeln (in die Firebase-Konsole kopieren)
app.js          Login, Routing, Views (Plan/Log/Fingerboard/Challenges), Timer-Logik
manifest.json   PWA-Manifest
sw.js           Service Worker (Netzwerk-zuerst, Offline-Fallback fürs App-Shell)
icon.svg        App-Icon (Platzhalter)
```
