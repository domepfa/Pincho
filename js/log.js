/* js/log.js — Tab Gym: Übungs-Einstellungen/Favoriten/Einheit/Pause, geteilte Vorlagen, Verlauf/Trend, renderLog, renderLogHistory */
/* ================================================================
   LOG
   ================================================================= */
const LOG_TYPE_LABEL = { klettern: 'Klettern', gym: 'Gym', fingerboard: 'Fingerboard', mobility: 'Mobility', yoga: 'Yoga', jogging: 'Jogging', velo: 'Velo', pilates: 'Pilates', warmup: 'Warm-up', flow: 'Flow', sonstiges: 'Sonstiges' };
/* logBuilder ist jetzt der PLAN-EDITOR (Ziel-Sätze/Wdh./Gewicht, kein
   Ergebnis) — siehe sessionPlans weiter unten fürs Speichern/Laden/
   Ausführen. */
let logBuilder = { exercises: loadDraft('log_exercises') || [] };
let logMode = 'planned'; // 'planned' | 'freestyle' | 'execute' | 'wall' | 'flow' — 'execute' nur über "Plan starten" erreichbar
let logPickerExerciseId = EXERCISE_LIBRARY[0].id;
/* Freestyle: kein fester Plan — Übung wählen, Satz für Satz mit Gewicht/Wdh
   erfassen (auch mehrfach dieselbe Übung, z. B. Aufwärm- vs. Arbeitssätze),
   erst beim Speichern wird daraus ein Log-Eintrag. exercises: Liste von
   {exerciseId, sets: [{weight, reps}, ...]} in der Reihenfolge, in der die
   Übungen zum ersten Mal gewählt wurden. */
let freestyleBuilder = loadDraft('freestyle') || { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id, sessionStartedAt: null };

/* Eigene, in Firebase gespeicherte Trainingspläne (Name + Ziel-Übungen) —
   dasselbe Vorlagen-Muster wie fb.templates beim Fingerboard: bleiben nach
   dem Ausführen erhalten, damit man denselben Plan immer wieder starten
   kann, statt ihn jedes Mal neu zusammenzustellen. */
let sessionPlans = [];
async function loadSessionPlans() {
  const raw = await fbGet(`sessionPlans/${state.member.id}`);
  sessionPlans = raw ? Object.entries(raw).map(([key, p]) => ({ ...p, id: key })) : [];
}

/* Freitext-Notiz pro Übung, z. B. Maschineneinstellungen (Sitzhöhe, ROM,
   Polsterposition) — an Geräten muss man sich das sonst jedes Mal neu
   merken/erraten. Pro Mitglied und Übung, nicht pro Session. */
let exerciseSettings = {};
async function loadExerciseSettings() {
  const raw = await fbGet(`exerciseSettings/${state.member.id}`);
  exerciseSettings = raw || {};
}

/* Favoriten: per Sternchen in der Info-Ansicht markierbar, damit man
   häufig gebrauchte Übungen (an mehreren Trainingsorten, unterschiedliche
   Geräte) im Auswahlraster schnell wiederfindet, statt sie jedes Mal neu
   unter "Alle anzeigen" zu suchen. Pro Mitglied, nicht pro Übungsliste. */
let exerciseFavorites = {};
async function loadExerciseFavorites() {
  const raw = await fbGet(`exerciseFavorites/${state.member.id}`);
  exerciseFavorites = raw || {};
}
function isExerciseFavorite(id) {
  return !!exerciseFavorites[id];
}
function toggleExerciseFavorite(id) {
  if (exerciseFavorites[id]) {
    delete exerciseFavorites[id];
    fbDelete(`exerciseFavorites/${state.member.id}/${id}`);
  } else {
    exerciseFavorites[id] = true;
    fbPut(`exerciseFavorites/${state.member.id}/${id}`, true);
  }
}

/* Wdh./Zeit-Wahl pro Übung — standardmässig entscheidet die feste
   isHold-Eigenschaft aus der Übungsbibliothek (Plank, Wall Sit, ...), aber
   jede Übung soll umschaltbar sein (z. B. Schulterkreisen zeitbasiert
   loggen). Einmal umgeschaltet bleibt das dauerhaft gemerkt (pro Mitglied
   und Übung), bis man es wieder ändert — bereits geloggte Sätze tragen ihr
   Zeit/Wdh.-Merkmal aber direkt am Satz selbst (siehe set.unit), damit ein
   späteres Umschalten der Übungs-Voreinstellung alte Sätze NIE rückwirkend
   umdeutet. */
let exerciseUnitPrefs = {};
/* Empfohlene Pause pro Übung (Sekunden), Standard 2 min; im Konto gespeichert, auf allen Geräten gleich */
const REST_DEFAULT_SEC = 120;
let exerciseRestPrefs = {};
async function loadExerciseRestPrefs() {
  const raw = await fbGet(`exerciseRestPrefs/${state.member.id}`);
  exerciseRestPrefs = raw || {};
}
function exerciseRestSec(id) { return Number(exerciseRestPrefs[id]) || REST_DEFAULT_SEC; }
function setExerciseRestSec(id, sec) {
  exerciseRestPrefs[id] = sec;
  fbPut(`exerciseRestPrefs/${state.member.id}/${id}`, sec);
}
async function loadExerciseUnitPrefs() {
  const raw = await fbGet(`exerciseUnitPrefs/${state.member.id}`);
  exerciseUnitPrefs = raw || {};
}
function exerciseUnit(id) {
  return exerciseUnitPrefs[id] || (exerciseIsHold(id) ? 'time' : 'reps');
}
function setExerciseUnit(id, unit) {
  exerciseUnitPrefs[id] = unit;
  fbPut(`exerciseUnitPrefs/${state.member.id}/${id}`, unit);
}
/* Anzeige-Einheit EINES bereits geloggten Satzes: der Satz selbst entscheidet
   (set.unit), falls vorhanden — nur bei älteren, vor diesem Feature
   geloggten Sätzen (kein set.unit gespeichert) fällt es auf die feste
   isHold-Eigenschaft zurück, damit die Anzeige für die identisch bleibt. */
function setUnitSuffix(exerciseId, set) {
  const unit = (set && set.unit) || (exerciseIsHold(exerciseId) ? 'time' : 'reps');
  return unit === 'time' ? 's' : '';
}

/* Geteilte Vorlagen — EINE flache, member-übergreifende Liste (statt eigener
   Collection pro Feature), sichtbar für die ganze Crew, nicht nur den, der
   sie gespeichert hat (anders als fingerboardTemplates/sessionPlans/
   wallTemplates, die pro Mitglied liegen). `kind` unterscheidet Fingerboard-
   Abläufe, Geplant-Pläne und Ausdauer-Blockabläufe innerhalb derselben
   Liste. */
let sharedTemplates = [];
async function loadSharedTemplates() {
  const raw = state.crewId ? await fbGet(`crewData/${state.crewId}/sharedTemplates`) : null;
  sharedTemplates = raw ? Object.entries(raw).map(([key, t]) => ({ ...t, id: key })) : [];
}
async function shareTemplate(kind, name, data) {
  if (!state.crewId) { toast('Du bist in keiner Crew — unter KONTO beitreten.', 'err'); return false; }
  const key = await fbPush(`crewData/${state.crewId}/sharedTemplates`, {
    kind, name, ...data,
    createdBy: state.member.id,
    createdByName: state.member.name,
    createdAt: Date.now(),
  });
  return !!key;
}
function sharedTemplatesOfKind(kind) {
  return sharedTemplates.filter((t) => t.kind === kind);
}

/* Laufende Ausführung eines Plans: gleiche Form wie freestyleBuilder
   (exercises: [{exerciseId, sets:[...]}], activeIndex), zusätzlich die
   Ziel-Werte aus dem Plan pro Übung fürs "Ziel: ..."-Label. Wird nur über
   "Plan starten" gesetzt; null, solange keine Ausführung läuft. */
let planExecution = null;

/* Der für den aktuellen logMode "aktive" Satz-Builder — Freestyle und
   Plan-Ausführung sehen UI-seitig identisch aus (Übung wählen/aktivieren,
   Satz für Satz erfassen), deshalb teilen sie sich dieselben Render-
   Funktion (renderFsPanel) statt doppelten Code. */
function activeSetBuilder() {
  return logMode === 'execute' ? planExecution : freestyleBuilder;
}

/* Letzter bekannter Wert für eine Übung — über die komplette Session-
   Historie (state.logs, neueste zuerst), egal ob geplant oder freestyle
   geloggt. Zeigt "wo man beim letzten Mal stand", damit man beim
   Freestyle-Training nicht raten muss. */
function lastValueForExercise(exerciseId) {
  for (const entry of state.logs) {
    if (!entry.exercises) continue;
    for (const ex of entry.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      if (Array.isArray(ex.sets)) {
        if (ex.sets.length) {
          const last = ex.sets[ex.sets.length - 1];
          return { weight: last.weight, reps: last.reps, note: last.note || '' };
        }
      } else if (ex.reps !== '' && ex.reps != null) {
        return { weight: ex.weight, reps: ex.reps };
      }
    }
  }
  return null;
}

/* Kurzdatum für die Verlaufs-Tabelle (TT.MM.) statt des vollen Datums —
   dort steht es als Spaltenkopf, da reicht Tag/Monat zur Unterscheidung. */
function fmtShortDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
}

/* Die letzten `limit` Sessions, in denen diese Übung mit echten Einzel-
   sätzen (Array, nicht der alte feste Zielwert) vorkam — neueste zuerst,
   da state.logs schon so sortiert ist. Grundlage für die Vergleichs-
   tabelle: "was habe ich bei Satz 1/2/3 in den letzten Trainings gemacht". */
function historyForExercise(exerciseId, limit) {
  const sessions = [];
  for (const entry of state.logs) {
    if (!entry.exercises || sessions.length >= limit) break;
    const ex = entry.exercises.find((e) => e.exerciseId === exerciseId && Array.isArray(e.sets) && e.sets.length);
    if (ex) sessions.push({ date: entry.date, sets: ex.sets });
  }
  return sessions;
}

/* "Volumen" eines Satzes (Gewicht × Wdh./Zeit) statt nur der reinen
   Wiederholungszahl — sonst sähe mehr Gewicht bei bewusst weniger
   Wiederholungen (ein schwererer, nicht schwächerer Satz!) fälschlich nach
   einer Verschlechterung aus. Kein Gewicht hinterlegt (Bodyweight-Übungen
   wie Klimmzug/Liegestütz) heisst Faktor 1 — dann zählt wieder einfach die
   Wiederholungszahl selbst, es gibt ja nichts zum Multiplizieren. */
function setVolume(s) {
  const weight = (s.weight !== '' && s.weight != null) ? Number(s.weight) : 1;
  const reps = Number(s.reps);
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  return weight * reps;
}

/* Trend-Pfeil pro Übung: vergleicht Satz für Satz (gleicher Index) mit der
   Vorgänger-Session dieser Übung, summiert die Volumen-Differenzen —
   Grundlage ist dieselbe Wdh./Zeit-Logik wie beim einzelnen Satz-Delta
   (siehe setUnitSuffix), nur pro Übung statt pro Satz aggregiert. `null`,
   wenn es nichts Vergleichbares gibt (erstes Mal, oder nur Einheitswechsel). */
function exerciseTrend(exerciseId, sets, priorSets) {
  if (!Array.isArray(sets) || !Array.isArray(priorSets) || !priorSets.length) return null;
  let sum = 0;
  let compared = 0;
  sets.forEach((s, i) => {
    const prev = priorSets[i];
    if (!prev) return;
    if (setUnitSuffix(exerciseId, prev) !== setUnitSuffix(exerciseId, s)) return;
    const curVol = setVolume(s);
    const prevVol = setVolume(prev);
    if (curVol != null && prevVol != null) { sum += curVol - prevVol; compared++; }
  });
  if (!compared) return null;
  if (sum > 0) return { symbol: '↑', cls: 'fs-trend-up' };
  if (sum < 0) return { symbol: '↓', cls: 'fs-trend-down' };
  return { symbol: '→', cls: 'fs-trend-flat' };
}

/* Vergleichstabelle über die letzten 3 Sessions: Zeilen = Satz 1/2/3...,
   Spalten = Datum je Session (neuste links) — zeigt die Tendenz auf einen
   Blick, nicht nur einen einzelnen "letzten Wert". */
function exerciseHistoryTableHtml(exerciseId) {
  const sessions = historyForExercise(exerciseId, 3);
  if (!sessions.length) return '';
  const maxSets = Math.max(...sessions.map((s) => s.sets.length));
  let rows = '';
  for (let i = 0; i < maxSets; i++) {
    rows += `<tr><td class="hist-row-label mono">Satz ${i + 1}</td>${sessions.map((s) => {
      const set = s.sets[i];
      if (!set) return '<td class="mono">–</td>';
      const w = set.weight !== '' && set.weight != null ? esc(String(set.weight)) + 'kg × ' : '';
      return `<td class="mono">${w}${esc(String(set.reps))}${setUnitSuffix(exerciseId, set)}</td>`;
    }).join('')}</tr>`;
  }
  return `
    <div class="hist-table-label mono">Letzte Trainings im Vergleich</div>
    <table class="hist-table">
      <thead><tr><th></th>${sessions.map((s) => `<th class="mono">${esc(fmtShortDate(s.date))}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function renderLog() {
  // "Geplant" ist jetzt reine Plan-Verwaltung (bauen/speichern/laden), keine
  // direkte Session — Datum/Typ/Notiz/RPE/Speichern gehören erst zu einer
  // tatsächlichen Session (Freestyle, Plan-Ausführung, Ausdauer).
  const hideSessionFields = logMode === 'wall' || logMode === 'planned' || logMode === 'flow';
  // Freestyle/Plan-Ausführung sind als Gym-Session gedacht — die Typ-Auswahl
  // (Klettern/Fingerboard/Jogging/...) ergibt dort keinen Sinn, ist immer
  // "Gym". Datum bleibt trotzdem sichtbar, nur Typ fällt weg.
  const hideTypeField = logMode === 'freestyle' || logMode === 'execute';
  // Freestyle läuft live mit — Start-/Endzeit trackt die App ohnehin schon
  // (sessionStartedAt/totalSessionSec) — eine manuelle Datumsauswahl bringt
  // dort nur unnötiges Rätselraten/Fehlerpotenzial, wird beim Speichern
  // einfach automatisch auf heute gesetzt (siehe log-save unten).
  const hideDateField = logMode === 'freestyle';
  // Direkt nach dem Speichern zeigt die Karte NUR die Trend-Übersicht (siehe
  // fsRecap) — Datum/Typ/Chips/Notiz/RPE wären in diesem Moment nur
  // ablenkende Reste einer bereits abgeschlossenen Session.
  const showingRecap = !!fsRecap;
  await Promise.all([loadSessionPlans(), loadExerciseSettings(), loadExerciseUnitPrefs(), loadExerciseRestPrefs(), loadExerciseFavorites(), loadSharedTemplates(), loadWallTemplates(), loadFlowTemplates()]);
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Neue Session</h2><div class="sec-rule"></div></div>
    <div class="card">
      ${hideSessionFields || showingRecap || hideDateField ? '' : hideTypeField ? `
      <div class="field"><label>Datum</label><input type="date" id="log-date" value="${todayKey()}"></div>
      ` : `
      <div class="field-row">
        <div class="field"><label>Datum</label><input type="date" id="log-date" value="${todayKey()}"></div>
        <div class="field"><label>Typ</label>
          <select id="log-type">
            ${Object.entries(LOG_TYPE_LABEL).map(([v, label]) => `<option value="${v}" ${v === 'gym' ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>`}

      ${logMode === 'execute' || showingRecap ? '' : `
      <div class="chip-row log-mode-row">
        <button type="button" class="chip ${logMode === 'planned' ? 'active' : ''}" data-log-mode="planned">Plan</button>
        <button type="button" class="chip ${logMode === 'freestyle' ? 'active' : ''}" data-log-mode="freestyle">Freestyle</button>
        <button type="button" class="chip ${logMode === 'wall' ? 'active' : ''}" data-log-mode="wall">Ausdauer</button>
        <button type="button" class="chip ${logMode === 'flow' ? 'active' : ''}" data-log-mode="flow">Flow</button>
      </div>`}

      <div id="log-builder-panel"></div>

      ${hideSessionFields || showingRecap ? '' : `
      <div class="field"><label>Notiz (optional)</label><textarea id="log-note" placeholder="Befinden, Bedingungen, Sonstiges…"></textarea></div>
      <div class="field"><label>RPE (1–10, optional)</label><input type="number" id="log-rpe" min="1" max="10"></div>
      <button class="btn" id="log-save">FERTIG &amp; SPEICHERN</button>`}
    </div>

    <div class="sec-head"><h2 class="sec-title">Verlauf</h2><div class="sec-rule"></div></div>
    <div class="list" id="log-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);

  renderLogBuilderPanel();

  document.querySelectorAll('[data-log-mode]').forEach((btn) => {
    btn.onclick = () => {
      // fsPhase bewusst mit zurücksetzen, nicht nur die Stoppuhr stoppen —
      // sonst dachte der Screen beim nächsten Öffnen von Freestyle noch
      // "läuft gerade" (fsPhase blieb 'working'), obwohl kein Intervall mehr
      // lief, und startete die Arbeits-Stoppuhr der zuletzt aktiven Übung
      // von selbst neu, ohne dass "Start" gedrückt wurde.
      if (logMode === 'freestyle' || logMode === 'execute') { stopAllFsTimers(); fsPhase = 'idle'; }
      logMode = btn.dataset.logMode;
      renderLog();
    };
  });

  if (hideSessionFields || showingRecap) { renderLogHistory(); return; }

  document.getElementById('log-save').onclick = async () => {
    const builder = logMode === 'execute' ? planExecution : freestyleBuilder;
    const rawExercises = builder.exercises.filter((g) => g.sets.length);
    if (!rawExercises.length) { toast('Noch keine Sätze erfasst.', 'err'); return; }
    // Gesamtdauer/Arbeitszeit werden auf dem Eintrag selbst gespeichert
    // (nicht nur kurz als Toast gezeigt), damit sie später auch auf der
    // Verlaufskarte sichtbar bleiben.
    const totalWorkSec = rawExercises.reduce((sum, g) => sum + g.sets.reduce((s, set) => s + (set.elapsedSec || 0), 0), 0);
    const totalSessionSec = builder.sessionStartedAt ? Math.round((Date.now() - builder.sessionStartedAt) / 1000) : totalWorkSec;
    const dateInput = document.getElementById('log-date');
    const entry = {
      date: (dateInput && dateInput.value) || todayKey(),
      type: hideTypeField ? 'gym' : document.getElementById('log-type').value,
      exercises: rawExercises.map((g) => {
        const stillLinked = g.superset && rawExercises.filter((x) => x.superset === g.superset).length > 1;
        return { exerciseId: g.exerciseId, sets: g.sets, ...(stillLinked ? { superset: g.superset } : {}) };
      }),
      note: document.getElementById('log-note').value.trim(),
      rpe: document.getElementById('log-rpe').value || null,
      totalWorkSec,
      totalSessionSec,
      createdAt: Date.now(),
    };
    const id = await fbPush(`logs/${state.member.id}`, entry);
    if (id) {
      stopAllFsTimers();
      toast('Session gespeichert.', 'ok');
      // Trend JE Übung (↑/↓/→) gegenüber der letzten Session damit — Basis
      // ist state.logs VOR diesem Speichern (wird erst gleich neu geladen).
      fsRecap = rawExercises
        .filter((g) => g.exerciseId !== 'warmup_general' && g.exerciseId !== 'cooldown_general')
        .map((g) => {
          const prevSession = historyForExercise(g.exerciseId, 1)[0];
          const trend = prevSession ? exerciseTrend(g.exerciseId, g.sets, prevSession.sets) : null;
          return { name: exerciseName(g.exerciseId), symbol: trend ? trend.symbol : '–', cls: trend ? trend.cls : 'fs-trend-none' };
        });
      if (logMode === 'execute') {
        // Der Plan selbst bleibt erhalten (wie eine Fingerboard-Vorlage) —
        // nur die gerade laufende Ausführung wird zurückgesetzt.
        planExecution = null;
        logMode = 'planned';
      } else {
        freestyleBuilder = { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id, sessionStartedAt: null };
        saveDraft('freestyle', freestyleBuilder);
      }
      renderLog();
    } else toast('Konnte nicht speichern.', 'err');
  };

  await renderLogHistory();
  // Vergleichstabelle/"Letztes Mal" erst jetzt (nach)rendern, wenn state.logs
  // aus renderLogHistory() frisch geladen ist — sonst wäre sie beim ersten
  // Aufbau des Panels noch leer/veraltet.
  if (logMode === 'freestyle' || logMode === 'execute') renderFsPanel();
}

/* Verlauf-Liste — eigene Funktion, weil sie sowohl vom normalen
   Geplant/Freestyle-Zweig als auch vom "An die Wand"-Zweig (der die
   übrigen Formularfelder gar nicht erst anzeigt) gebraucht wird. */
async function renderLogHistory() {
  const raw = await fbGet(`logs/${state.member.id}`);
  const entries = Object.entries(raw || {}).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  state.logs = entries.map(([, e]) => e);
  const list = document.getElementById('log-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  // Trend-Vergleich braucht die NÄCHSTÄLTERE Session mit derselben Übung —
  // also relativ zur eigenen Position in der (neueste-zuerst) Liste, nicht
  // immer die global letzte (sonst würde eine ältere Karte gegen eine noch
  // neuere verglichen, was rückwärts wäre).
  const priorSetsForExercise = (exerciseId, fromIdx) => {
    for (let i = fromIdx + 1; i < entries.length; i++) {
      const ex = entries[i][1].exercises && entries[i][1].exercises.find((e) => e.exerciseId === exerciseId && Array.isArray(e.sets) && e.sets.length);
      if (ex) return ex.sets;
    }
    return null;
  };
  list.innerHTML = entries.length ? entries.map(([id, e], idx) => `
    <div class="log-item">
      <div class="top"><span>${esc(fmtDayKey(e.date))}</span><span class="type">${esc((e.type || '').toUpperCase())}</span></div>
      ${e.durationMin ? `<div class="ex-log-list"><div class="ex-log-row"><span>${sessionTypeIconLabel(e.type)}</span><span class="mono">${e.durationMin} Min.</span></div></div>` : ''}
      ${e.totalSessionSec ? `<div class="ex-log-list"><div class="ex-log-row"><span>⏱ Zeit</span><span class="mono">${fmtMinSec(e.totalSessionSec)} gesamt · ${fmtMinSec(e.totalWorkSec || 0)} Arbeit</span></div></div>` : ''}
      ${(e.exercises && e.exercises.length) ? `<div class="ex-log-list">${e.exercises.map((ex) => {
        const priorSets = Array.isArray(ex.sets) ? priorSetsForExercise(ex.exerciseId, idx) : null;
        const trend = priorSets ? exerciseTrend(ex.exerciseId, ex.sets, priorSets) : null;
        return `<div class="ex-log-row"><span>${ex.superset ? `<span class="ss-badge">${supersetLabel(e.exercises, e.exercises.indexOf(ex))}</span>` : ''}${esc(exerciseName(ex.exerciseId))}${trend ? ` <span class="fs-trend ${trend.cls}">${trend.symbol}</span>` : ''}</span><span class="mono">${esc(fbExerciseSetsText(ex))}</span></div>`;
      }).join('')}</div>` : ''}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
      ${(e.exercises && e.exercises.length) ? `<button type="button" class="btn ghost small" data-save-plan="${id}" style="width:100%;margin-top:6px;">Als Plan speichern</button>` : ''}
      ${challengeDurationChipsHtml(`log-share-${id}`, CHALLENGE_WINDOW_H)}
      <div class="field-row" style="margin-top:6px;">
        <button type="button" class="btn ghost small" data-share-log="${id}">Als Challenge teilen</button>
        <button type="button" class="btn ghost small" data-delete-log="${id}">Löschen</button>
      </div>
    </div>
  `).join('') : '<div class="list-empty">Noch keine Einträge.</div>';

  entries.forEach(([id]) => wireChallengeDurationChips(`log-share-${id}`));
  list.querySelectorAll('[data-save-plan]').forEach((btn) => {
    btn.onclick = async () => {
      const found = entries.find(([id2]) => id2 === btn.dataset.savePlan);
      if (!found) return;
      const entry = found[1];
      // Warm-up/Cooldown sind Aufwärm-/Ausklang-Pseudoübungen, kein
      // trainingswirksamer Satz — gehören nicht in eine wiederverwendbare
      // Plan-Vorlage.
      const exercises = entry.exercises
        .filter((ex) => Array.isArray(ex.sets) && ex.sets.length && ex.exerciseId !== 'warmup_general' && ex.exerciseId !== 'cooldown_general')
        .map((ex) => {
          // Ein Plan kennt pro Übung nur EINEN Zielwert (Sätze × Wdh. @ Gewicht),
          // ein geloggter Satz aber oft unterschiedliche Werte je Satz (z. B.
          // absteigende Pyramide) — der letzte Satz ist meist der, auf den man
          // hingearbeitet hat, und dient hier als sinnvoller Startwert.
          const last = ex.sets[ex.sets.length - 1];
          return {
            exerciseId: ex.exerciseId,
            ...(ex.superset ? { superset: ex.superset } : {}),
            sets: ex.sets.length,
            reps: String(last.reps),
            weight: last.weight !== '' && last.weight != null ? last.weight : '',
          };
        });
      if (!exercises.length) { toast('Keine Übungen zum Speichern gefunden.', 'err'); return; }
      const name = prompt('Name für diesen Plan:', fmtDayKey(entry.date));
      if (!name) return;
      const key = await fbPush(`sessionPlans/${state.member.id}`, { name, exercises, createdAt: Date.now() });
      if (!key) { toast('Speichern fehlgeschlagen.', 'err'); return; }
      await loadSessionPlans();
      if (confirm('Plan auch mit der Crew teilen?')) {
        const shared = await shareTemplate('plan', name, { exercises });
        if (shared) await loadSharedTemplates();
      }
      toast('Plan gespeichert.', 'ok');
    };
  });
  list.querySelectorAll('[data-share-log]').forEach((btn) => {
    btn.onclick = async () => {
      const found = entries.find(([id2]) => id2 === btn.dataset.shareLog);
      if (!found) return;
      btn.disabled = true;
      await shareLogEntryAsChallenge(found[1], selectedChallengeHours(`log-share-${btn.dataset.shareLog}`));
      btn.disabled = false;
    };
  });
  list.querySelectorAll('[data-delete-log]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Diesen Eintrag wirklich löschen?')) return;
      await fbDelete(`logs/${state.member.id}/${btn.dataset.deleteLog}`);
      toast('Eintrag gelöscht.', 'ok');
      renderLogHistory();
    };
  });
}
