/* js/help.js — Hilfe-Seite ("So funktioniert Pincho") */
/* ================================================================
   HILFE — "So funktioniert Pincho" (#hilfe, unter KONTO verlinkt).
   Ein aufklappbarer Abschnitt pro Tab, kurz und praxisnah.
   ================================================================= */
const HELP_SECTIONS = [
  ['Board', 'Fingerboard, Lifting Pin, Campus', `
    <p><b>Schnelltraining:</b> Gespeicherte Abläufe als Karten — <i>Eigene</i> und die von der <i>Crew</i> geteilten. Antippen lädt den Ablauf.</p>
    <p><b>Ablauf bauen:</b> Sätze nacheinander hinzufügen:</p>
    <ul>
      <li><b>Board</b> — Griff am Beastmaker-Bild antippen (beide Hände oder links/rechts einzeln), Hängezeit, Wiederholungen, Pausen.</li>
      <li><b>Lifting Pin</b> — <i>Halten</i> (Sekunden) oder <i>Wiederholungen</i> mit Gewicht.</li>
      <li><b>Fixübung</b> — z. B. Kniebeuge oder Klimmzug mit Zeit pro Satz.</li>
      <li><b>Campus</b> — Sprossen direkt im Bild antippen. Bewegungsart: <i>Gleichzeitig</i>, <i>Nachziehen</i>, <i>Übergreifen</i> (am Ende einhändig oder nachziehen) oder <i>Hand für Hand</i>: erster Tipp = Start mit beiden Händen, danach linke/rechte Hälfte einer Sprosse = linke/rechte Hand.</li>
      <li><b>Pause</b> — zusätzliche Erholung zwischen Blöcken.</li>
    </ul>
    <p><b>Ablauf starten:</b> Vollbild mit Timer. Unten ⏮ ⏸ ⏭ (oder wischen) — ein Schritt vor/zurück, Pause bleibt Pause. ☰ oben links zeigt das Restprogramm.</p>
    <p><b>Check-in:</b> In der Pause nach einem Satz Wiederholungen/Gewicht eintragen („Geschafft“) — daraus entsteht der Fortschritt unter <i>Board</i>.</p>
    <p><b>Nach dem Ablauf:</b> Speichern, als Vorlage sichern oder der Crew als Challenge schicken.</p>`],
  ['Gym', 'Krafttraining, Ausdauer, Flow', `
    <ul>
      <li><b>Plan</b> — Übungen mit Sätzen/Wdh./Gewicht zusammenstellen, als Plan speichern und mit „Plan starten“ Satz für Satz abarbeiten.</li>
      <li><b>Freestyle</b> — einfach loslegen: Übung wählen (Körperkarte oder Suche), Sätze eintragen.</li>
      <li><b>Ausdauer</b> — Klettern, Jogging, Velo usw. frei mit Stoppuhr oder als geplanter Block-Ablauf (Wand/Pause).</li>
      <li><b>Flow</b> — Yoga-/Pilates-Posen mit Haltezeit als Ablauf.</li>
    </ul>
    <p><b>Übung fehlt?</b> Unten in der Übungsauswahl: <b>+ Eigene Übung</b> (Name, Muskelgruppe, Wdh. oder Sekunden — nur für dich, funktioniert auch im Board und im Fortschritt) oder <b>Übung wünschen</b> — der Wunsch geht an ${PRIVACY_OPERATOR}.</p>
    <p>Im <b>Verlauf</b> siehst du deine Einheiten; von dort kannst du eine Einheit als Challenge teilen. Das kleine <b>i</b> bei einer Übung zeigt Ausführung, Muskeln und Animation.</p>`],
  ['Agenda', 'Wochenplan', `
    <p>Dein Wochenplan: pro Tag ein Titel und eine Kategorie. Änderungen werden sofort gespeichert; der heutige Tag ist markiert.</p>`],
  ['Fortschritt', 'Kurven, Übersicht, Erholung', `
    <ul>
      <li><b>Kacheln</b> — Einheiten der letzten 30 Tage, Wochen in Folge, bewegtes Gewicht diese Woche.</li>
      <li><b>Übungen</b> — Umschalter <i>Gym | Board</i>, Zeitraum 4W/3M/1J/Alle. Die Kurve zeigt pro Einheit den besten Satz (Gewicht, sonst Wdh./Sekunden). Darunter alle Übungen mit letztem Wert und Veränderung — antippen zeigt deren Kurve.</li>
      <li><b>Board · Hängezeit</b> — Summe der Hängezeit je Board-Einheit.</li>
      <li><b>Letzte 8 Wochen</b> — an welchen Tagen du trainiert hast.</li>
      <li><b>Erholung</b> — grobe Richtwerte, wie lange Finger, Zug, Druck, Beine und Rumpf seit der letzten Belastung Ruhe hatten.</li>
      <li><b>Zyklus</b> (falls unter KONTO eingeschaltet) — Periodenbeginn eintragen; Phasen erscheinen hinter den Kurven, dazu Tipps, Quellen und „Deine Leistung nach Phase“.</li>
    </ul>`],
  ['Challenges', 'Mit der Crew', `
    <p>Ein fertiges Training (Board-Ablauf oder Gym-Einheit aus dem Verlauf) kannst du der <b>aktiven Crew</b> als Challenge schicken — mit Zeitfenster (24 h bis 1 Woche).</p>
    <p><b>Annehmen</b> lädt die Challenge in deinen Ablauf bzw. Plan, <b>Mitgemacht</b> hakt sie ab. Kein Wettkampf, keine Rangliste — nur „hast du's auch gemacht?“. Neue Challenges zeigt ein Punkt in der Navigation.</p>`],
  ['Konto', 'Crews, Zyklus, Daten', `
    <ul>
      <li><b>Crews</b> — Mit einem Einladungscode beitreten; man kann in mehreren Crews sein. Challenges und geteilte Vorlagen gelten für die <i>aktive</i> Crew. Wer eine Crew gegründet hat, sieht den Code, kann ihn per „Einladen“ verschicken, erneuern und Leute entfernen.</li>
      <li><b>Zyklus</b> — freiwillig ein- und ausschalten (beim Ausschalten wird alles gelöscht).</li>
      <li><b>Daten</b> — Datenschutz-Info, alle eigenen Daten herunterladen, Konto löschen.</li>
    </ul>
    <p><b>Offline:</b> Die App startet auch ohne Netz, z. B. im Gym. Was du offline speicherst, wird hochgeladen, sobald wieder Netz da ist.</p>
    <p><b>Wer sieht was?</b> Deine Trainings, dein Fortschritt und dein Zyklus sind nur für dich. Die Crew sieht deinen Namen, Challenges und was du mit ihr teilst.</p>`],
];

function renderHelp() {
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">So funktioniert Pincho</h2><div class="sec-rule"></div></div>
    <p class="pg-muted" style="margin:0 0 14px;">Unten die fünf Tabs, oben rechts KONTO. Tippe auf einen Abschnitt.</p>
    <div class="help">
      ${HELP_SECTIONS.map(([title, sub, body], i) => `
        <details class="help-item" ${i === 0 ? 'open' : ''}>
          <summary><span class="help-title">${title}</span><span class="help-sub">${sub}</span></summary>
          <div class="help-body">${body}</div>
        </details>`).join('')}
    </div>
    <a class="btn ghost small" href="#konto" style="margin-top:14px;">Zurück zu KONTO</a>
  `);
}
