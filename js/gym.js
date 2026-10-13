/* js/gym.js — Gym-Tab: Plan-Editor, Freestyle/Plan-Ausführung (Phasenmaschine, Timer), Supersätze, Pausen-Bildschirm, Maschinen-Notiz */
/* Kompakte Satz-Anzeige fürs Verlauf: geplante Einträge (fester Wert für
   alle Sätze) und Freestyle-Einträge (jeder Satz einzeln erfasst) sehen
   unterschiedlich aus, laufen aber in derselben Liste zusammen. */
function fbExerciseSetsText(ex) {
  if (Array.isArray(ex.sets)) {
    return ex.sets.map((s) => {
      const suffix = setUnitSuffix(ex.exerciseId, s);
      const note = s.note ? ` (${s.note})` : '';
      return (s.weight !== '' && s.weight != null ? `${s.weight}kg×${s.reps}${suffix}` : `${s.reps}${suffix}`) + note;
    }).join(', ');
  }
  const suffix = exerciseIsHold(ex.exerciseId) ? 's' : '';
  return `${ex.sets}×${ex.reps}${suffix}${ex.weight ? ' @ ' + ex.weight + 'kg' : ''}`;
}

function renderLogBuilderPanel() {
  const holder = document.getElementById('log-builder-panel');
  if (!holder) return;
  // Wechsel zwischen den Unter-Modi (Plan/Freestyle/...) läuft nicht über
  // render() — ohne das blieb der "▶ STARTEN"-Button vom Plan-Tab z. B. im
  // Freestyle stehen. Der jeweilige Modus zeigt ihn/die Leiste selbst wieder.
  hideFabStart();
  hideFsDock();

  if (fsRecap) {
    holder.innerHTML = `
      <div class="fs-recap">
        <div class="fs-recap-title">Session gespeichert</div>
        ${fsRecap.map((r) => `<div class="fs-recap-row"><span>${esc(r.name)}</span><span class="fs-trend ${r.cls}">${r.symbol}</span></div>`).join('')}
        <button type="button" class="btn" id="fs-recap-close" style="width:100%;margin-top:12px;">Weiter</button>
      </div>
    `;
    document.getElementById('fs-recap-close').onclick = () => { fsRecap = null; renderLog(); };
    return;
  }

  if (logMode === 'wall') {
    renderWallBuilder(holder);
  } else if (logMode === 'flow') {
    renderFlowBuilderPanel(holder);
  } else if (logMode === 'freestyle') {
    // Warm-up ist keine eigene Kategorie mehr, sondern eine zeitbasierte
    // Pseudo-Übung innerhalb von Freestyle (siehe exerciseIsHold in data.js)
    // — landet dadurch automatisch in derselben Session/demselben
    // Verlaufseintrag wie die Übungen danach, statt in einem eigenen.
    const hasWarmup = freestyleBuilder.exercises.some((g) => g.exerciseId === 'warmup_general');
    const hasCooldown = freestyleBuilder.exercises.some((g) => g.exerciseId === 'cooldown_general');
    holder.innerHTML = `
      <div class="field-row" style="margin-bottom:12px;">
        ${hasWarmup ? '' : `<button type="button" class="btn ghost small" id="fs-add-warmup" style="flex:1;">🔥 Warm-up hinzufügen</button>`}
        ${hasCooldown ? '' : `<button type="button" class="btn ghost small" id="fs-add-cooldown" style="flex:1;">🧘 Cooldown hinzufügen</button>`}
      </div>
      <div class="field">
        <label>Übung</label>
        <div id="fs-exercise-grid"></div>
      </div>
      <div id="fs-panel"></div>
      <div id="fs-discard-holder"></div>
    `;
    const addPseudoExercise = (exerciseId) => {
      if (!freestyleBuilder.exercises.length) freestyleBuilder.sessionStartedAt = Date.now();
      freestyleBuilder.exercises.push({ exerciseId, sets: [] });
      freestyleBuilder.activeIndex = freestyleBuilder.exercises.length - 1;
      fsPhase = 'idle';
      stopFsRestTimer();
      stopFsWorkTimer();
      renderLogBuilderPanel();
    };
    const addWarmupBtn = document.getElementById('fs-add-warmup');
    if (addWarmupBtn) addWarmupBtn.onclick = () => addPseudoExercise('warmup_general');
    const addCooldownBtn = document.getElementById('fs-add-cooldown');
    if (addCooldownBtn) addCooldownBtn.onclick = () => addPseudoExercise('cooldown_general');
    wireExercisePickerGrid('fs-exercise-grid', EXERCISE_LIBRARY, freestyleBuilder.pickerExerciseId, (id) => {
      freestyleBuilder.pickerExerciseId = id;
      // Nur angetippt, aber noch kein Satz gemacht: beim Wechsel zu einer anderen Übung wieder entfernen,
      // statt als leere Übung unten stehen zu bleiben
      const keep = (g) => g.exerciseId === id || (g.sets && g.sets.length) || (g.note && g.note.trim());
      if (freestyleBuilder.exercises.some((g) => !keep(g))) {
        const activeId = freestyleBuilder.exercises[freestyleBuilder.activeIndex]?.exerciseId;
        freestyleBuilder.exercises = freestyleBuilder.exercises.filter(keep);
        freestyleBuilder.activeIndex = freestyleBuilder.exercises.findIndex((g) => g.exerciseId === activeId);
      }
      if (!freestyleBuilder.exercises.length) freestyleBuilder.sessionStartedAt = Date.now();
      let idx = freestyleBuilder.exercises.findIndex((g) => g.exerciseId === id);
      if (idx === -1) {
        freestyleBuilder.exercises.push({ exerciseId: id, sets: [] });
        idx = freestyleBuilder.exercises.length - 1;
      }
      if (idx === freestyleBuilder.activeIndex) { renderFsPanel(); }
      else activateFsGroup(freestyleBuilder, idx);
      // Zur aktiven Übung scrollen statt zu einer festen Stelle — das
      // Eingabefeld steht jetzt direkt bei ihr, nicht mehr fest oben.
      document.getElementById(`fs-group-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, null, true, { dice: true, excludeIds: () => freestyleBuilder.exercises.filter((g) => g.sets && g.sets.length).map((g) => g.exerciseId) });
    renderFsPanel();
  } else if (logMode === 'execute') {
    holder.innerHTML = `
      <div class="sec-head" style="margin-top:0;"><h2 class="sec-title" style="font-size:16px;">${esc(planExecution.planName)}</h2><div class="sec-rule"></div></div>
      <div id="fs-panel"></div>
      <button type="button" class="btn ghost accent-outline small" id="plan-execute-cancel" style="width:100%;margin-top:8px;">Ausführung abbrechen</button>
    `;
    hideFabStart(); // Ausführung läuft schon, kein Start-Button mehr nötig
    renderFsPanel();
    document.getElementById('plan-execute-cancel').onclick = () => {
      if (!confirm('Ausführung abbrechen? Noch nicht gespeicherte Sätze gehen verloren.')) return;
      stopAllFsTimers();
      planExecution = null;
      logMode = 'planned';
      renderLog();
    };
  } else {
    const customOptions = sessionPlans.length ? `<optgroup label="Eigene Pläne">
      ${sessionPlans.map((p) => `<option value="plan:${p.id}">${esc(p.name)}</option>`).join('')}
    </optgroup>` : '';
    const sharedPlans = sharedTemplatesOfKind('plan');
    const sharedOptions = sharedPlans.length ? `<optgroup label="Geteilte Pläne">
      ${sharedPlans.map((p) => `<option value="sharedplan:${p.id}">${esc(p.name)} (${esc(p.createdByName)})</option>`).join('')}
    </optgroup>` : '';
    holder.innerHTML = `
      <div class="field">
        <label>Plan laden</label>
        <div class="field-row">
          <select id="log-template" style="flex:2;">
            <option value="">— eigener Ablauf —</option>
            ${ROUTINE_TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
            ${customOptions}
            ${sharedOptions}
          </select>
          <button type="button" class="btn small ghost" id="plan-delete" style="flex:0 0 auto;" title="Eigenen Plan endgültig löschen" hidden>🗑 Löschen</button>
        </div>
      </div>

      <div class="field">
        <label>Übung hinzufügen</label>
        <div id="log-exercise-grid"></div>
        <button type="button" class="btn" id="log-exercise-add" style="width:100%;margin-top:8px;">+ Hinzufügen</button>
      </div>

      <div id="log-exercise-rows"></div>

      <div class="chip-row" style="margin-top:14px;">
        <button type="button" class="chip" id="plan-save">Als Plan speichern</button>
      </div>
      <button type="button" class="btn" id="plan-start" ${logBuilder.exercises.length ? '' : 'disabled'} style="width:100%;">PLAN STARTEN</button>
    `;
    renderLogExerciseRows();
    showFabStart('▶ STARTEN', 'plan-start');
    wireExercisePickerGrid('log-exercise-grid', EXERCISE_LIBRARY, logPickerExerciseId, (id) => { logPickerExerciseId = id; }, 'log-exercise-add');
    document.getElementById('log-template').onchange = (e) => {
      const val = e.target.value;
      let exercises = null;
      if (val.startsWith('plan:')) {
        const p = sessionPlans.find((pl) => pl.id === val.slice(5));
        if (p) exercises = p.exercises.map((ex) => ({ ...ex }));
      } else if (val.startsWith('sharedplan:')) {
        const p = sharedTemplatesOfKind('plan').find((pl) => pl.id === val.slice(11));
        if (p) exercises = p.exercises.map((ex) => ({ ...ex }));
      } else {
        const t = ROUTINE_TEMPLATES.find((r) => r.id === val);
        if (t) exercises = t.exercises.map((ex) => ({ ...ex, weight: '' }));
      }
      logBuilder.exercises = exercises || [];
      renderLogExerciseRows();
      const startBtn = document.getElementById('plan-start');
      if (startBtn) startBtn.disabled = !logBuilder.exercises.length;
      showFabStart('▶ STARTEN', 'plan-start');
      // Löschen-Button nur zeigen, wenn wirklich ein EIGENER Plan geladen ist
      // (nicht bei einer Fertig-Vorlage oder einem geteilten Plan der Crew,
      // die man ohnehin nicht löschen kann) — sonst sieht der Button wie ein
      // harmloser "Ablauf leeren"-Button aus, löscht aber die gespeicherte
      // Vorlage unwiderruflich, nicht nur die aktuell angezeigten Übungen.
      const deleteBtn = document.getElementById('plan-delete');
      if (deleteBtn) deleteBtn.hidden = !val.startsWith('plan:');
    };
    document.getElementById('log-exercise-add').onclick = () => {
      logBuilder.exercises.push({ exerciseId: logPickerExerciseId, sets: 3, reps: '', weight: '' });
      renderLogExerciseRows();
      const startBtn = document.getElementById('plan-start');
      if (startBtn) startBtn.disabled = !logBuilder.exercises.length;
      showFabStart('▶ STARTEN', 'plan-start');
    };
    document.getElementById('plan-save').onclick = async () => {
      if (!logBuilder.exercises.length) { toast('Erst Übungen zusammenstellen.', 'err'); return; }
      const name = prompt('Name für diesen Plan:');
      if (!name) return;
      const key = await fbPush(`sessionPlans/${state.member.id}`, { name, exercises: logBuilder.exercises, createdAt: Date.now() });
      if (!key) { toast('Speichern fehlgeschlagen.', 'err'); return; }
      await loadSessionPlans();
      if (confirm('Plan auch mit der Crew teilen?')) {
        const shared = await shareTemplate('plan', name, { exercises: logBuilder.exercises });
        if (shared) await loadSharedTemplates();
      }
      renderLogBuilderPanel();
      document.getElementById('log-template').value = `plan:${key}`;
      // .value direkt setzen löst kein change-Event aus — Löschen-Button
      // hier explizit einblenden (siehe onchange-Handler oben).
      const deleteBtnAfterSave = document.getElementById('plan-delete');
      if (deleteBtnAfterSave) deleteBtnAfterSave.hidden = false;
      toast('Plan gespeichert.', 'ok');
    };
    document.getElementById('plan-delete').onclick = async () => {
      const val = document.getElementById('log-template').value;
      const p = val.startsWith('plan:') && sessionPlans.find((pl) => pl.id === val.slice(5));
      if (!p) { toast('Nur eigene Pläne lassen sich löschen.', 'err'); return; }
      if (!confirm(`Gespeicherten Plan "${p.name}" unwiderruflich löschen? Das entfernt die Vorlage dauerhaft, nicht nur die aktuell angezeigten Übungen.`)) return;
      await fbDelete(`sessionPlans/${state.member.id}/${p.id}`);
      await loadSessionPlans();
      logBuilder.exercises = [];
      renderLogBuilderPanel();
      toast('Plan gelöscht.', 'ok');
    };
    document.getElementById('plan-start').onclick = () => {
      if (!logBuilder.exercises.length) return;
      const currentVal = document.getElementById('log-template').value;
      const loadedPlan = currentVal.startsWith('plan:')
        ? sessionPlans.find((pl) => pl.id === currentVal.slice(5))
        : currentVal.startsWith('sharedplan:')
          ? sharedTemplatesOfKind('plan').find((pl) => pl.id === currentVal.slice(11))
          : null;
      planExecution = {
        planName: loadedPlan ? loadedPlan.name : 'Eigener Plan',
        activeIndex: 0,
        sessionStartedAt: Date.now(),
        exercises: logBuilder.exercises.map((ex) => ({
          exerciseId: ex.exerciseId, sets: [],
          targetSets: ex.sets, targetReps: ex.reps, targetWeight: ex.weight,
          ...(ex.superset ? { superset: ex.superset } : {}),
        })),
      };
      logMode = 'execute';
      fsPhase = 'idle';
      stopFsRestTimer();
      stopFsWorkTimer();
      renderLog();
    };
  }
}

/* Übungsliste (Freestyle ODER Plan-Ausführung, siehe activeSetBuilder) mit
   dem Eingabefeld DIREKT bei der gerade aktiven Übung eingebettet, statt
   fest oben zu stehen — tippt man eine andere (bereits erfasste) Übung an,
   wandert das Eingabefeld mit an ihre Stelle, statt dass man zwischen der
   angetippten Übung weiter unten und dem Feld ganz oben hin- und
   herscrollen muss. Zeigt bei der aktiven Übung die Vergleichstabelle der
   letzten 3 Sessions plus (bei Plan-Ausführung) das geplante Ziel als
   Vorschlag in den Feldern an. */
/* Satz-Ablauf als kleine Phasenmaschine, für JEDE Übung gleich (nicht nur
   Isoholds — auch ein normaler Reps-Satz hat eine Dauer, die man
   nebenbei sehen kann; bei Halte-Übungen IST die gestoppte Zeit direkt
   der Wdh.-Wert, nicht extra einzutippen):
   'idle' → Übung ist gewählt, Uhr steht noch — erst "Start" antippen
            startet die Arbeits-Stoppuhr (Zeit zum Einrichten an der
            Übung, bevor die Zeit mitläuft).
   'working' → Arbeits-Stoppuhr läuft, "Satz beenden" stoppt sie
   'entering' → Gewicht/Wdh. eintragen (gestoppte Dauer wird angezeigt und
                bei Halte-Übungen direkt als Wdh.-Wert vorausgefüllt),
                "Satz speichern"
   'resting' → Pausenstoppuhr läuft (30s-Piepton), "Nächster Satz" startet
               direkt wieder die Arbeits-Stoppuhr (kein erneuter Start-
               Knopf nötig, man bleibt ja an derselben Übung).
   Eine einzige, modul-globale Phase/Uhr reicht, da jeweils nur eine
   Übung gleichzeitig aktiv ist. */
let fsPhase = 'idle';
// startedAt: Zeitstempel statt reinem Hochzählen — bei ausgeschaltetem
// Display drosselt/stoppt das Handy setInterval, die Sekunden werden daher
// bei jedem Tick aus der echten Uhr berechnet (sonst stand z. B. der
// Cooldown-Timer still, solange der Bildschirm aus war).
let fsWorkTimer = { seconds: 0, intervalId: null, startedAt: 0 };
let fsRestTimer = { seconds: 0, intervalId: null, startedAt: 0 };
let fsCapturedElapsed = 0;
// Satz, zu dem die Notiz im Pausen-Screen gehört (zuletzt gespeicherter Satz)
let fsNoteTarget = null;

function updateFsWorkTimerUI() {
  const el = document.getElementById('fs-work-timer');
  if (el) el.textContent = fmtMinSec(fsWorkTimer.seconds);
}
function startFsWorkTimer() {
  requestWakeLock(); // Bildschirm soll während einer laufenden Session nicht ausgehen (dieselbe Sperre wie im Fingerboard-Ablauf)
  clearInterval(fsWorkTimer.intervalId);
  fsWorkTimer.seconds = 0;
  fsWorkTimer.startedAt = Date.now();
  updateFsWorkTimerUI();
  fsWorkTimer.intervalId = setInterval(() => {
    fsWorkTimer.seconds = Math.floor((Date.now() - fsWorkTimer.startedAt) / 1000);
    updateFsWorkTimerUI();
  }, 1000);
}
function stopFsWorkTimer() {
  clearInterval(fsWorkTimer.intervalId);
  fsWorkTimer.intervalId = null;
}

function updateFsRestTimerUI() {
  const el = document.getElementById('fs-rest-timer');
  if (el) el.textContent = `PAUSE ${fmtMinSec(fsRestTimer.seconds)}`;
  const big = document.getElementById('fs-rest-big');
  if (big) {
    const target = fsRestTargetSec();
    const ready = fsRestTimer.seconds >= target;
    big.textContent = fmtMinSec(fsRestTimer.seconds);
    const ring = document.getElementById('fs-rest-ring');
    if (ring) ring.style.strokeDashoffset = String(FS_RING_LEN * (1 - Math.min(1, fsRestTimer.seconds / target)));
    document.getElementById('fs-rest-screen')?.classList.toggle('ready', ready);
    const st = document.getElementById('fs-rest-state');
    if (st) st.textContent = ready ? 'Bereit' : `noch ${fmtMinSec(target - fsRestTimer.seconds)}`;
  }
  // Einmal kurz vibrieren, sobald die empfohlene Pause um ist
  if (fsRestTimer.seconds === fsRestTargetSec()) fbBuzz([120, 80, 120]);
}
const FS_RING_LEN = 2 * Math.PI * 88;
/* Zielpause der laufenden Pause: längste eingestellte Pause der Übung bzw. der Supersatz-Gruppe */
function fsRestTargetSec() {
  const builder = activeSetBuilder();
  if (!builder || !builder.exercises.length || builder.activeIndex < 0) return REST_DEFAULT_SEC;
  return Math.max(...supersetMembers(builder.exercises, builder.activeIndex).map((j) => exerciseRestSec(builder.exercises[j].exerciseId)));
}
function startFsRestTimer() {
  requestWakeLock();
  clearInterval(fsRestTimer.intervalId);
  fsRestTimer.seconds = 0;
  fsRestTimer.startedAt = Date.now();
  updateFsRestTimerUI();
  fsRestTimer.intervalId = setInterval(() => {
    const prev = fsRestTimer.seconds;
    fsRestTimer.seconds = Math.floor((Date.now() - fsRestTimer.startedAt) / 1000);
    if (fsRestTimer.seconds === prev) return;
    updateFsRestTimerUI();
    // Gong je 30s: 0:30 → 1×, 1:00 → 2×, 1:30 → 3×, ab 2:00 → 4× (Obergrenze).
    // Nur wenn die 30er-Marke in diesem Tick überschritten wurde und nicht
    // nach langem Display-aus nachträglich (dann würde es verspätet gongen).
    const mark = Math.floor(fsRestTimer.seconds / 30);
    if (mark > Math.floor(prev / 30) && fsRestTimer.seconds - prev <= 2) gongStrikes(Math.min(4, mark));
  }, 1000);
}
// Ohne explizites Stoppen lief die Pausenuhr bisher im Hintergrund einfach
// weiter (auch nach dem Speichern/Verlassen der Session) — piepste also
// munter weiter, obwohl gar keine Pause mehr lief.
function stopFsRestTimer() {
  clearInterval(fsRestTimer.intervalId);
  fsRestTimer.intervalId = null;
}
function stopAllFsTimers() {
  stopFsWorkTimer();
  stopFsRestTimer();
  releaseWakeLock();
}

/* Plan-Ausführung in abgeänderter Reihenfolge: eine Übung gilt als
   "erledigt", sobald sie ihr Satz-Ziel erreicht hat (ohne Ziel schon ab
   einem Satz) — unabhängig davon, ob sie in der ursprünglichen Plan-
   Reihenfolge dran war. So kann man z. B. bei besetztem Gerät zur
   nächsten NOCH OFFENEN Übung springen (data-activate erlaubt das Antippen
   jeder Übung schon länger) und eine übersprungene später nachholen —
   nur der Fortschritt (erledigt/offen) zählt, nicht die Position. */
/* ---------- Supersätze ----------
   Übungen mit gleichem superset-Schlüssel gehören zusammen und werden im Wechsel gemacht
   (A → B → A → B …); die Pause kommt erst nach einer ganzen Runde. */
function supersetKey() { return 'ss' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function supersetMembers(list, i) {
  const k = list[i] && list[i].superset;
  if (!k) return [i];
  return list.map((g, j) => (g.superset === k ? j : -1)).filter((j) => j >= 0);
}
/* Zwei Nachbarn verbinden bzw. lösen (a < b). Hängt a schon an einer Gruppe, kommt b dazu. */
function supersetLink(list, a, b) {
  const k = list[a].superset || list[b].superset || supersetKey();
  const old = list[b].superset;
  list.forEach((g) => { if (old && g.superset === old) g.superset = k; });
  list[a].superset = k; list[b].superset = k;
}
function supersetUnlink(list, a, b) {
  // Gruppe zwischen a und b trennen: alles ab b bekommt einen neuen Schlüssel, Einzelne verlieren ihn
  const k = list[a].superset;
  const members = list.map((g, j) => (g.superset === k ? j : -1)).filter((j) => j >= 0);
  const after = members.filter((j) => j >= b), before = members.filter((j) => j < b);
  const k2 = supersetKey();
  after.forEach((j) => { list[j].superset = after.length > 1 ? k2 : undefined; });
  before.forEach((j) => { if (before.length < 2) list[j].superset = undefined; });
  list.forEach((g) => { if (g.superset === undefined) delete g.superset; });
}
/* Gruppen mit nur noch einer Übung auflösen */
function supersetCleanup(list) {
  const count = {};
  list.forEach((g) => { if (g.superset) count[g.superset] = (count[g.superset] || 0) + 1; });
  list.forEach((g) => { if (g.superset && count[g.superset] < 2) delete g.superset; });
}
function supersetLabel(list, i, short = false) {
  const m = supersetMembers(list, i);
  return m.length > 1 ? `${short ? '' : 'Supersatz '}${String.fromCharCode(65 + m.indexOf(i))}` : '';
}

/* Nach der Pause: erste noch offene Übung der aktuellen Supersatz-Gruppe (Freestyle: die erste).
   Nur wenn die Runde gerade mit einem Satz abgeschlossen wurde, nicht nach einem eigenen Wechsel. */
let fsRoundDone = false;
function fsRoundStart(builder) {
  if (!fsRoundDone) return null;
  const mem = supersetMembers(builder.exercises, builder.activeIndex);
  if (mem.length < 2) return null;
  const open = mem.filter((j) => !(logMode === 'execute' && fsExerciseDone(builder.exercises[j])));
  return open.length ? open[0] : null;
}
function fsExerciseDone(g) {
  return g.targetSets != null ? g.sets.length >= g.targetSets : g.sets.length > 0;
}
/* Sucht ab fromIndex vorwärts (mit Umlauf ans Ende der Liste) die nächste
   noch offene Übung — nicht einfach fromIndex+1, sonst würde "Nächste
   Übung" nach einem Sprung ausser der Reihe eine bereits erledigte Übung
   nochmal vorschlagen, statt eine wirklich noch offene. null, wenn schon
   alles erledigt ist. */
function findNextUnfinishedExerciseIndex(builder, fromIndex) {
  const n = builder.exercises.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (!fsExerciseDone(builder.exercises[idx])) return idx;
  }
  return null;
}

/* Eine neue oder bereits vorhandene Übung wird aktiv: normalerweise erstmal
   nur die Phase auf 'idle' setzen (Stoppuhr steht still) — die Uhr läuft
   nicht automatisch los, sondern erst nachdem man bewusst "Start" antippt.
   Läuft aber gerade die Pause zwischen zwei Sätzen, soll die über einen
   Übungswechsel hinweg WEITERLAUFEN (die Erholung pausiert ja nicht, nur
   weil man sich eine andere Übung anschaut) — erst ein bewusstes "Start"
   für die neue Übung beendet sie dann wirklich. */
function activateFsGroup(builder, idx) {
  builder.activeIndex = idx;
  fsRoundDone = false; // selbst gewechselt: nicht automatisch zurückspringen
  fsNoteEditing = false;
  if (fsPhase !== 'resting') {
    fsPhase = 'idle';
    stopFsWorkTimer();
  }
  renderFsPanel();
}

/* Sichtbar sobald mindestens eine Übung im Freestyle-Aufbau steckt — ohne
   das gäbe es keinen offensichtlichen Weg, eine begonnene Freestyle-Session
   wieder zu verwerfen (anders als die Plan-Ausführung, die schon einen
   "Ausführung abbrechen"-Knopf hat). Eigene Funktion statt Teil des
   statischen renderLogBuilderPanel()-Templates, weil sie bei jeder
   Änderung an freestyleBuilder.exercises (Übung hinzufügen/entfernen) neu
   auswerten muss, nicht nur beim einmaligen Öffnen des Freestyle-Tabs. */
function renderFsDiscardButton() {
  const holder = document.getElementById('fs-discard-holder');
  if (!holder) return;
  if (logMode !== 'freestyle' || !freestyleBuilder.exercises.length) { holder.innerHTML = ''; return; }
  holder.innerHTML = `<button type="button" class="btn ghost small" id="fs-discard" style="width:100%;margin-top:10px;">🗑 Freestyle verwerfen</button>`;
  document.getElementById('fs-discard').onclick = () => {
    if (!confirm('Freestyle-Session verwerfen? Alle noch nicht gespeicherten Sätze gehen verloren.')) return;
    stopAllFsTimers();
    freestyleBuilder = { exercises: [], activeIndex: -1, pickerExerciseId: EXERCISE_LIBRARY[0].id, sessionStartedAt: null };
    saveDraft('freestyle', freestyleBuilder);
    renderLog();
  };
}

/* ---------- Pausen-Bildschirm (Gym) ----------
   Während der Pause gross: Pausenzeit mit Ring bis zur empfohlenen Pause, was als Nächstes kommt
   (Übung, Satz, Vorschlag) und ein grosser Knopf. Wegwischen/Zurück blendet ihn aus, die Uhr läuft
   klein in der Leiste weiter (antippen holt ihn zurück). Der grosse Knopf klickt den echten Knopf in
   der Leiste, damit der Ablauf (nächster Satz, Runde, nächste Übung) nur an einer Stelle steckt. */
let fsRestHidden = false;
function fsSetSuggestion(g) {
  const last = g.sets.length ? g.sets[g.sets.length - 1] : lastValueForExercise(g.exerciseId);
  if (!last || last.reps === '' || last.reps == null) return '';
  const w = last.weight !== '' && last.weight != null ? `${String(last.weight).replace('.', ',')} kg × ` : '';
  const unit = (last.unit || 'reps') === 'time' ? ' s' : '';
  const note = last.note ? ` · „${last.note}“` : '';
  return `${g.sets.length ? 'eben' : 'letztes Mal'} ${w}${last.reps}${unit}${note}`;
}
/* Die letzten 3 Trainings dieser Übung im Pausen-Bildschirm, je Zeile alle Sätze. */
function fsRestHistoryHtml(exerciseId) {
  const sessions = historyForExercise(exerciseId, 3);
  if (!sessions.length) return '';
  const setTxt = (s) => {
    const w = s.weight !== '' && s.weight != null ? `${String(s.weight).replace('.', ',')} kg × ` : '';
    return `${w}${s.reps}${setUnitSuffix(exerciseId, s) ? ' s' : ''}`;
  };
  return `<ul class="fs-rest-hist">${sessions.map((sess) =>
    `<li><span class="mono">${esc(fmtShortDate(sess.date))}</span>${esc(sess.sets.map(setTxt).join(' · '))}</li>`).join('')}</ul>`;
}
function hideFsRestScreen() {
  const el = document.getElementById('fs-rest-screen');
  if (el) el.remove();
  if (history.state && history.state.fsRest) history.back();
}
window.addEventListener('popstate', () => {
  if (document.getElementById('fs-rest-screen')) { fsRestHidden = true; document.getElementById('fs-rest-screen').remove(); }
});
function renderFsRestScreen(builder) {
  const dock = document.getElementById('fs-dock');
  const primary = dock && (dock.querySelector('#fs-next-exercise') || dock.querySelector('#fs-next-set'));
  if (fsPhase !== 'resting' || fsRestHidden || !primary) {
    const el = document.getElementById('fs-rest-screen');
    if (el) { el.remove(); if (history.state && history.state.fsRest) history.back(); }
    return;
  }
  // Was kommt als Nächstes: nächste Übung des Plans, neue Supersatz-Runde oder weiter dieselbe
  const nextIdx = primary.id === 'fs-next-exercise' ? Number(primary.dataset.nextIdx) : (fsRoundStart(builder) ?? builder.activeIndex);
  const group = supersetMembers(builder.exercises, nextIdx);
  const lines = group.map((j) => {
    const g = builder.exercises[j];
    const hist = fsRestHistoryHtml(g.exerciseId);
    // "letztes Mal" steht schon in der Verlaufsliste darunter
    const sug = g.sets.length || !hist ? fsSetSuggestion(g) : '';
    const letter = group.length > 1 ? `<span class="ss-badge">${String.fromCharCode(65 + group.indexOf(j))}</span>` : '';
    return `<div class="fs-rest-next-row">${letter}<b>${esc(exerciseName(g.exerciseId))}</b><span class="fs-rest-next-sub">Satz ${g.sets.length + 1}${sug ? ' · ' + esc(sug) : ''}</span>${hist}</div>`;
  }).join('');
  // Nach dem letzten Satz einer Übung (Plan): klar machen, dass die Werte zur NÄCHSTEN Übung gehören
  const isNextExercise = primary.id === 'fs-next-exercise';
  const target = fsRestTargetSec();
  const extra = dock.querySelector('#fs-next-set') && primary.id === 'fs-next-exercise';
  const noteSet = fsNoteTarget && builder.exercises[fsNoteTarget.gi] ? builder.exercises[fsNoteTarget.gi].sets[fsNoteTarget.si] : null;
  let el = document.getElementById('fs-rest-screen');
  const isNew = !el;
  if (!el) {
    el = document.createElement('div');
    el.id = 'fs-rest-screen';
    el.className = 'info-sheet-backdrop';
    document.body.appendChild(el);
    wireSheetSwipeDown(el, () => { fsRestHidden = true; hideFsRestScreen(); });
    history.pushState({ fsRest: true }, '');
  }
  el.innerHTML = `
    <div class="info-sheet-card fs-rest-card">
      <div class="fs-rest-grip" aria-hidden="true"></div>
      <div class="fs-rest-dial">
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="fs-rest-track" cx="100" cy="100" r="88"/><circle id="fs-rest-ring" class="fs-rest-ring" cx="100" cy="100" r="88" stroke-dasharray="${FS_RING_LEN.toFixed(1)}" stroke-dashoffset="${FS_RING_LEN.toFixed(1)}"/></svg>
        <div class="fs-rest-center">
          <span class="fs-rest-label">Pause</span>
          <span class="fs-rest-big mono" id="fs-rest-big">${fmtMinSec(fsRestTimer.seconds)}</span>
          <span class="fs-rest-state" id="fs-rest-state"></span>
        </div>
      </div>
      <div class="fs-rest-target">
        <button type="button" class="fs-rest-adj" data-rest-adj="-15" aria-label="Pause 15 Sekunden kürzer">−15 s</button>
        <span>Ziel ${fmtMinSec(target)}</span>
        <button type="button" class="fs-rest-adj" data-rest-adj="15" aria-label="Pause 15 Sekunden länger">+15 s</button>
      </div>
      ${noteSet ? `<label class="fs-rest-label fs-rest-note-label" for="fs-rest-note">Notiz zu ${esc(exerciseName(builder.exercises[fsNoteTarget.gi].exerciseId))} · Satz ${fsNoteTarget.si + 1}</label>` : ''}
      ${noteSet ? `<input type="text" class="fs-rest-note" id="fs-rest-note" enterkeyhint="done" maxlength="80" placeholder="Notiz zum Satz, z. B. Untergriff, Sitz 4" value="${esc(noteSet.note || '')}">` : ''}
      <div class="fs-rest-next">
        <span class="fs-rest-label">${isNextExercise ? 'Nächste Übung' : group.length > 1 ? `Runde ${builder.exercises[group[0]].sets.length + 1}` : 'Als Nächstes'}</span>
        ${lines}
      </div>
      <button type="button" class="btn fs-rest-go" id="fs-rest-go">${primary.innerHTML}</button>
      <div class="fs-rest-actions">
        ${extra ? '<button type="button" class="btn ghost small" id="fs-rest-extra">+ Extra-Satz</button>' : ''}
        <button type="button" class="btn ghost small" id="fs-rest-switch">Übung wechseln</button>
      </div>
    </div>`;
  if (isNew) el.querySelector('.fs-rest-card').style.animation = '';
  document.getElementById('fs-rest-go').onclick = () => { fsRestHidden = false; primary.click(); };
  const noteInput = document.getElementById('fs-rest-note');
  if (noteInput) {
    noteInput.oninput = () => {
      noteSet.note = noteInput.value.trim();
      if (!noteSet.note) delete noteSet.note;
      if (logMode === 'freestyle') saveDraft('freestyle', builder);
    };
    noteInput.onkeydown = (e) => { if (e.key === 'Enter') noteInput.blur(); };
  }
  const ex = document.getElementById('fs-rest-extra');
  if (ex) ex.onclick = () => dock.querySelector('#fs-next-set')?.click();
  document.getElementById('fs-rest-switch').onclick = () => {
    fsRestHidden = true;
    const goToPicker = () => {
      document.getElementById('fs-dock-add')?.click();
      if (logMode === 'execute') document.getElementById('fs-panel')?.scrollIntoView({ behavior: 'smooth' });
    };
    // hideFsRestScreen geht im Verlauf zurück, und der Browser stellt dabei die alte
    // Scrollposition wieder her: erst danach hochscrollen, sonst wird es überschrieben.
    if (history.state && history.state.fsRest) {
      window.addEventListener('popstate', () => setTimeout(goToPicker, 0), { once: true });
      hideFsRestScreen();
    } else {
      hideFsRestScreen();
      goToPicker();
    }
  };
  el.querySelectorAll('[data-rest-adj]').forEach((b) => {
    b.onclick = () => {
      const sec = Math.min(600, Math.max(30, fsRestTargetSec() + Number(b.dataset.restAdj)));
      supersetMembers(builder.exercises, builder.activeIndex).forEach((j) => setExerciseRestSec(builder.exercises[j].exerciseId, sec));
      renderFsRestScreen(builder);
    };
  });
  updateFsRestTimerUI();
}

function renderFsPanel() {
  const holder = document.getElementById('fs-panel');
  if (!holder) return;
  const builder = activeSetBuilder();
  if (logMode === 'freestyle') saveDraft('freestyle', builder);
  renderFsDiscardButton();

  if (!builder.exercises.length) {
    hideFsDock();
    holder.innerHTML = '<p class="login-hint">Übung wählen und "+ Übung" antippen, um Sätze zu erfassen.</p>';
    return;
  }

  // Satz-Steuerung (Start / Satz beenden / Nächster Satz) sitzt in der
  // grossen Leiste unten (#fs-dock, siehe ensureFsDock) — nur die Eingabe
  // von Gewicht/Wdh. ('entering') steht in der Karte der aktiven Übung.
  // Kleine Phasenmaschine je Übung (siehe activateFsGroup/fsPhase):
  // 'idle' → 'working' (Arbeits-Stoppuhr) → 'entering' (Gewicht/Wdh.
  // eintragen) → 'resting' (Pausenstoppuhr) → zurück zu 'working'.
  const dockHtml = (g) => {
    const head = `
      <div class="fs-dock-head mono">
        <span class="fs-dock-name">▸ ${esc(exerciseName(g.exerciseId))}</span>
        ${builder.sessionStartedAt ? `<span class="fs-session-clock" id="fs-session-clock" title="Trainingszeit gesamt">⏱ ${fmtSessionClock(builder.sessionStartedAt)}</span>` : ''}
        ${logMode === 'freestyle' ? `<button type="button" class="btn ghost small" id="fs-dock-add">+ Übung</button>` : ''}
      </div>`;
    if (fsPhase === 'idle') {
      const sug = fsSetSuggestion(g);
      return `${head}
        <div class="fs-dock-hint">Satz ${g.sets.length + 1}${sug ? ' · ' + esc(sug) : ''}</div>
        <button type="button" class="btn fs-dock-btn" id="fs-start-set">▶ Satz starten</button>`;
    }
    if (fsPhase === 'working') {
      return `${head}
        <div class="fs-work-timer mono" id="fs-work-timer">${fmtMinSec(fsWorkTimer.seconds)}</div>
        <button type="button" class="btn fs-dock-btn" id="fs-end-set">■ Satz beenden</button>`;
    }
    // 'resting' — während der Pause zur Übung gewechselt (siehe
    // activateFsGroup): für die noch satzlose neue Übung ist es der ERSTE
    // Satz, nicht der "nächste" einer schon begonnenen.
    const isExecute = logMode === 'execute';
    const reachedTarget = isExecute && g.targetSets != null && g.sets.length >= g.targetSets;
    // Nächste NOCH OFFENE Übung, nicht einfach die nächste im Array —
    // sonst würde ein Sprung ausser der Reihe (z. B. Gerät besetzt, erst
    // eine andere gemacht) hier eine bereits erledigte Übung nochmal
    // vorschlagen statt eine wirklich offene.
    const nextUnfinishedIdx = isExecute ? findNextUnfinishedExerciseIndex(builder, builder.activeIndex) : null;
    const restHtml = `<div class="fs-rest-timer mono" id="fs-rest-timer">PAUSE ${fmtMinSec(fsRestTimer.seconds)}</div>`;
    const roundStart = fsRoundStart(builder);
    if (roundStart != null) {
      return `${head}${restHtml}
      <button type="button" class="btn fs-dock-btn" id="fs-next-set" aria-label="Nächste Supersatz-Runde, beginnt mit ${esc(exerciseName(builder.exercises[roundStart].exerciseId))}">▶ Runde ${builder.exercises[roundStart].sets.length + 1}</button>`;
    }
    if (reachedTarget && nextUnfinishedIdx != null) {
      // Plan-Ziel für diese Übung erreicht — automatisch die nächste offene
      // Übung vorschlagen. Ein Extra-Satz bleibt trotzdem manuell möglich;
      // das ändert nur DIESE Ausführung, nicht den gespeicherten Plan.
      return `${head}${restHtml}
        <div class="fs-dock-row">
          <button type="button" class="btn ghost fs-dock-btn fs-dock-secondary" id="fs-next-set">+ Extra</button>
          <button type="button" class="btn fs-dock-btn" id="fs-next-exercise" data-next-idx="${nextUnfinishedIdx}">▶ ${esc(exerciseName(builder.exercises[nextUnfinishedIdx].exerciseId))}</button>
        </div>`;
    }
    const label = g.sets.length ? (reachedTarget ? '+ Extra-Satz' : '▶ Nächster Satz') : '▶ Satz starten';
    return `${head}${restHtml}
      <button type="button" class="btn fs-dock-btn" id="fs-next-set">${label}</button>`;
  };

  const enteringHtml = (g) => {
    const unit = exerciseUnit(g.exerciseId);
    const isHold = unit === 'time';
    // 'entering': Vorschlag fürs Gewicht-Feld zuerst der zuletzt in DIESER
    // Session geloggte Satz (damit ein zweiter, dritter... Satz nicht
    // wieder den alten Session-übergreifenden Wert zeigt), erst wenn noch
    // keiner erfasst wurde die Historie als Ausgangspunkt. Wdh. kommt nur
    // vom Vorsatz DIESER Session (gleiche Einheit) — beim ersten Satz
    // bleibt sie leer. Vorausgefüllt wird sie beim Fokussieren markiert,
    // eine neue Zahl ersetzt sie also direkt.
    const last = g.sets.length ? g.sets[g.sets.length - 1] : lastValueForExercise(g.exerciseId);
    const prevSessionSet = g.sets.length ? g.sets[g.sets.length - 1] : null;
    const prevReps = prevSessionSet && (prevSessionSet.unit || 'reps') === 'reps' ? String(prevSessionSet.reps ?? '') : '';
    // Bei Isohold-Übungen IST die gestoppte Dauer die Angabe — die wird
    // direkt übernommen statt sie erst manuell als "Wiederholung" abtippen
    // oder per Extra-Knopf umdeuten zu müssen. Sekunden sind eine Zeit,
    // keine Wiederholung.
    return `
      <div class="fs-captured-duration mono">Dauer: ${fmtMinSec(fsCapturedElapsed)}</div>
      <div class="chip-row" id="fs-unit-toggle" style="margin-bottom:8px;">
        <button type="button" class="chip ${!isHold ? 'active' : ''}" data-unit="reps">Wdh.</button>
        <button type="button" class="chip ${isHold ? 'active' : ''}" data-unit="time">Zeit</button>
      </div>
      <div class="field-row">
        <div class="field"><label>Gewicht (kg)</label><input type="number" inputmode="decimal" enterkeyhint="next" id="fs-weight" data-entry-key="${builder.activeIndex}:${g.sets.length}" value="${last && last.weight != null ? esc(String(last.weight)) : ''}" step="0.5"></div>
        <div class="field"><label>${isHold ? 'Dauer (s)' : 'Wdh.'}</label><input type="text" inputmode="numeric" enterkeyhint="done" id="fs-reps" data-entry-key="${builder.activeIndex}:${g.sets.length}:${unit}" value="${isHold ? fsCapturedElapsed : esc(prevReps)}"></div>
      </div>
      <button type="button" class="btn small" id="fs-add-set" style="width:100%;">Satz speichern</button>
    `;
  };

  // Plan-Ausführung zeigt die Übungen in fester Plan-Reihenfolge,
  // Freestyle die neueste ganz oben (Übungen kommen nach und nach dazu).
  const isExecute = logMode === 'execute';
  const activeGroup = builder.exercises[builder.activeIndex];
  const orderedExercises = builder.exercises.map((g, gi) => ({ g, gi }));
  if (!isExecute) orderedExercises.reverse();
  // Freestyle: begonnene Übungen als Reiter oben, ein Tipp wechselt (für Supersätze ohne Suchen)
  const tabsHtml = !isExecute && builder.exercises.length > 1 ? `
    <div class="fs-tabs">${builder.exercises.map((g, gi) => `<button type="button" class="chip ${gi === builder.activeIndex ? 'active' : ''} ${g.superset ? 'ss' : ''}" data-activate="${gi}">${g.superset ? `<span class="ss-dot"></span>` : ''}${esc(exerciseName(g.exerciseId))}</button>`).join('')}</div>` : '';
  const fsLinkHtml = (gi) => {
    if (isExecute || gi < 1) return '';
    const prev = builder.exercises[gi - 1], cur = builder.exercises[gi];
    const linked = cur.superset && cur.superset === prev.superset;
    return `<button type="button" class="ss-link ${linked ? 'linked' : ''}" data-fs-ss="${gi}">${linked ? 'Supersatz lösen' : `＋ Mit ${esc(exerciseName(prev.exerciseId))} als Supersatz verbinden`}</button>`;
  };
  // Schon eingetippte Werte (Gewicht/Wdh.) über das Neu-Zeichnen retten —
  // z. B. ✎ Maschineneinstellungen zeichnet die Karte neu, und die Felder
  // kämen sonst wieder mit dem Vorschlag vom letzten Mal zurück.
  const prevWeightEl = document.getElementById('fs-weight');
  const prevRepsEl = document.getElementById('fs-reps');
  const typedEntry = prevWeightEl && prevRepsEl
    ? { key: prevWeightEl.dataset.entryKey, unitKey: prevRepsEl.dataset.entryKey, weight: prevWeightEl.value, reps: prevRepsEl.value }
    : null;
  holder.innerHTML = `${tabsHtml}
    ${orderedExercises.map(({ g, gi }) => {
      const isActive = gi === builder.activeIndex;
      const isDone = isExecute && fsExerciseDone(g);
      const targetText = g.targetReps != null
        ? `Ziel: ${g.targetSets}×${g.targetReps}${g.targetWeight ? ' @ ' + g.targetWeight + 'kg' : ''}`
        : '';
      return `
    <div class="fs-group ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}" id="fs-group-${gi}">
      <div class="fs-group-head">
        <span data-activate="${gi}" style="cursor:pointer;">${isDone ? '<span class="fs-done-check">✓</span> ' : ''}${g.superset ? `<span class="ss-badge">${supersetLabel(builder.exercises, gi)}</span>` : ''}${esc(exerciseName(g.exerciseId))}</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="ex-row-remove" data-info="${gi}" title="Info zur Übung">ℹ</button>
          ${logMode === 'freestyle' ? `<button type="button" class="ex-row-remove" data-remove-group="${gi}" title="Übung entfernen">×</button>` : ''}
        </div>
      </div>
      ${isActive ? fsLinkHtml(gi) : ''}
      ${isActive && fsPhase === 'entering' ? `<div class="fs-inline-input" id="fs-entry-box">${enteringHtml(g)}</div>` : ''}
      ${g.infoOpen ? fsExerciseInfoHtml(g.exerciseId) : ''}
      ${isActive ? fsMachineNoteHtml(g.exerciseId) : ''}
      ${isActive && targetText ? `<div class="fs-target-value mono">${esc(targetText)}</div>` : ''}
      ${isActive ? exerciseHistoryTableHtml(g.exerciseId) : ''}
      ${(() => {
        // Vergleich mit demselben Satz (gleicher Index) der letzten Session
        // mit dieser Übung — zeigt sofort, ob man sich gegenüber letztem
        // Mal gesteigert hat, statt das erst in der Verlaufstabelle
        // nachrechnen zu müssen. Nur bei gleicher Einheit (Wdh. vs. Zeit)
        // vergleichbar — sonst stünden Sekunden gegen Wiederholungen. Basis
        // ist das Volumen (Gewicht × Wdh./Zeit), nicht die reine
        // Wiederholungszahl — sonst hätte mehr Gewicht bei bewusst weniger
        // Wiederholungen (ein schwererer, kein schwächerer Satz) fälschlich
        // als Verschlechterung gegolten.
        const prevSession = historyForExercise(g.exerciseId, 1)[0];
        return g.sets.length ? g.sets.map((s, si) => ({ s, si })).reverse().map(({ s, si }) => {
          const setIsHold = setUnitSuffix(g.exerciseId, s) === 's';
          const prevSet = prevSession && prevSession.sets[si];
          let deltaHtml = '';
          if (prevSet && setUnitSuffix(g.exerciseId, prevSet) === (setIsHold ? 's' : '')) {
            const curVol = setVolume(s);
            const prevVol = setVolume(prevSet);
            if (curVol != null && prevVol != null && prevVol > 0) {
              const pct = Math.round(((curVol - prevVol) / prevVol) * 100);
              if (pct !== 0) {
                deltaHtml = `<span class="fs-set-delta ${pct > 0 ? 'fs-delta-up' : 'fs-delta-down'}">${pct > 0 ? '+' : ''}${pct}%</span>`;
              }
            }
          }
          return `
        <div class="fs-set-row mono">
          <span>Satz ${si + 1}</span>
          ${deltaHtml}
          <input type="number" inputmode="decimal" step="0.5" class="ex-row-input" data-edit="${gi}:${si}:weight" value="${s.weight !== '' && s.weight != null ? esc(String(s.weight)) : ''}" placeholder="kg" title="Gewicht">
          <input type="text" inputmode="numeric" class="ex-row-input" data-edit="${gi}:${si}:reps" value="${esc(String(s.reps))}" placeholder="${setIsHold ? 's' : 'Wdh'}" title="${setIsHold ? 'Dauer (s)' : 'Wiederholungen'}">
          <button type="button" class="ex-row-remove" data-remove-set="${gi}:${si}" title="Satz entfernen">×</button>
        </div>
        ${s.note ? `<div class="fs-set-note">${esc(s.note)}</div>` : ''}
      `;
        }).join('') : '<div class="fs-set-row mono" style="color:var(--ink-faint);">noch keine Sätze</div>';
      })()}
    </div>
  `;
    }).join('')}`;
  if (activeGroup && fsPhase !== 'entering') {
    const dock = ensureFsDock();
    dock.innerHTML = dockHtml(activeGroup);
    dock.classList.toggle('resting', fsPhase === 'resting');
    dock.classList.remove('hidden');
    document.body.classList.add('has-fs-dock');
  } else {
    hideFsDock();
  }
  updateFsWorkTimerUI();
  updateFsRestTimerUI();

  const dockAdd = document.getElementById('fs-dock-add');
  if (dockAdd) {
    dockAdd.onclick = () => {
      // Hoch zur Übungsauswahl — Topbar-Höhe abziehen, sonst läge der obere
      // Teil (Körperbild + Regionen-Chips) unter der fixen Topbar.
      const grid = document.getElementById('fs-exercise-grid');
      if (!grid) return;
      const topbarH = document.querySelector('.topbar')?.getBoundingClientRect().height || 0;
      const targetTop = grid.getBoundingClientRect().top + window.scrollY - topbarH - 8;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    };
  }
  const startSetBtn = document.getElementById('fs-start-set');
  if (startSetBtn) {
    startSetBtn.onclick = () => {
      fsPhase = 'working';
      startFsWorkTimer();
      renderFsPanel();
    };
  }
  const endSetBtn = document.getElementById('fs-end-set');
  if (endSetBtn) {
    endSetBtn.onclick = () => {
      stopFsWorkTimer();
      fsCapturedElapsed = fsWorkTimer.seconds;
      fsPhase = 'entering';
      renderFsPanel();
      // Direkt in die Zahleneingabe springen, Ziffern-Tastatur gleich
      // offen — sonst müsste man nach "Satz beenden" erst nochmal aufs
      // Gewicht-Feld tippen, obwohl man da eh sofort hinwill. Funktioniert
      // nur zuverlässig, weil das noch im selben Klick-Handler (also
      // innerhalb der Nutzer-Geste) passiert.
      document.getElementById('fs-weight')?.focus();
      // Die Eingabe steht in der Karte der Übung, nicht unten in der
      // Leiste — dorthin scrollen, sobald die Tastatur aufgegangen ist
      // (vorher stimmt die sichtbare Höhe noch nicht), damit das Feld
      // oben im Bild steht und nicht von der Tastatur verdeckt wird.
      setTimeout(() => {
        const box = document.getElementById('fs-entry-box');
        if (!box) return;
        const topbarH = document.querySelector('.topbar')?.getBoundingClientRect().height || 0;
        box.style.scrollMarginTop = `${topbarH + 8}px`;
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    };
  }
  const nextSetBtn = document.getElementById('fs-next-set');
  if (nextSetBtn) {
    nextSetBtn.onclick = () => {
      stopFsRestTimer();
      const start = fsRoundStart(builder);
      if (start != null) builder.activeIndex = start;
      fsRoundDone = false;
      fsPhase = 'working';
      startFsWorkTimer();
      renderFsPanel();
    };
  }
  const nextExerciseBtn = document.getElementById('fs-next-exercise');
  if (nextExerciseBtn) {
    // Anders als ein blosser Übungswechsel (z. B. über den Picker mitten in
    // der Pause, siehe activateFsGroup): "Nächste Übung" im Plan ist eine
    // bewusste "ich bin bereit"-Entscheidung, kein zufälliges Hinschauen —
    // deshalb hier direkt die Arbeits-Stoppuhr für die neue Übung starten,
    // ohne nochmal "Start" verlangen zu müssen.
    nextExerciseBtn.onclick = () => {
      builder.activeIndex = Number(nextExerciseBtn.dataset.nextIdx);
      fsNoteEditing = false;
      stopFsRestTimer();
      fsPhase = 'working';
      startFsWorkTimer();
      renderFsPanel();
    };
  }

  // Pausenuhr in der Leiste antippen holt den Pausen-Bildschirm zurück
  const restPill = document.getElementById('fs-rest-timer');
  if (restPill) restPill.onclick = () => { fsRestHidden = false; renderFsRestScreen(builder); };
  renderFsRestScreen(builder);

  holder.querySelectorAll('[data-activate]').forEach((el) => {
    el.onclick = () => {
      const idx = Number(el.dataset.activate);
      if (idx === builder.activeIndex) return;
      activateFsGroup(builder, idx);
    };
  });
  holder.querySelectorAll('[data-fs-ss]').forEach((btn) => {
    btn.onclick = () => {
      const gi = Number(btn.dataset.fsSs), L = builder.exercises;
      if (L[gi].superset && L[gi].superset === L[gi - 1].superset) supersetUnlink(L, gi - 1, gi); else supersetLink(L, gi - 1, gi);
      renderFsPanel();
    };
  });
  holder.querySelectorAll('[data-info]').forEach((btn) => {
    btn.onclick = () => {
      const g = builder.exercises[Number(btn.dataset.info)];
      g.infoOpen = !g.infoOpen;
      renderFsPanel();
    };
  });
  holder.querySelectorAll('[data-remove-group]').forEach((btn) => {
    btn.onclick = () => {
      const gi = Number(btn.dataset.removeGroup);
      builder.exercises.splice(gi, 1);
      supersetCleanup(builder.exercises);
      if (builder.activeIndex >= builder.exercises.length) builder.activeIndex = builder.exercises.length - 1;
      renderFsPanel();
    };
  });
  holder.querySelectorAll('[data-remove-set]').forEach((btn) => {
    btn.onclick = () => {
      const [gi, si] = btn.dataset.removeSet.split(':').map(Number);
      builder.exercises[gi].sets.splice(si, 1);
      renderFsPanel();
    };
  });
  holder.querySelectorAll('[data-edit]').forEach((inp) => {
    inp.oninput = () => {
      const [gi, si, f] = inp.dataset.edit.split(':');
      const set = builder.exercises[Number(gi)].sets[Number(si)];
      set[f] = f === 'weight' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value;
      if (logMode === 'freestyle') saveDraft('freestyle', builder);
    };
  });
  holder.querySelectorAll('[data-machine-note]').forEach((ta) => {
    ta.onchange = () => {
      const id = ta.dataset.machineNote;
      exerciseSettings[id] = ta.value;
      fbPut(`exerciseSettings/${state.member.id}/${id}`, ta.value);
    };
    // Zurück zur kompakten Textanzeige, sobald man das Feld verlässt —
    // ändert nichts an "change" oben, das feuert unabhängig davon vorher.
    ta.onblur = () => { fsNoteEditing = false; renderFsPanel(); };
  });
  const noteEditBtn = document.getElementById('fs-machine-note-edit');
  if (noteEditBtn) {
    noteEditBtn.onclick = () => { fsNoteEditing = true; renderFsPanel(); };
  }
  const noteInput = document.getElementById('fs-machine-note-input');
  if (noteInput) {
    noteInput.focus();
    noteInput.setSelectionRange(noteInput.value.length, noteInput.value.length);
  }
  holder.querySelectorAll('#fs-unit-toggle .chip').forEach((btn) => {
    btn.onclick = () => {
      setExerciseUnit(activeGroup.exerciseId, btn.dataset.unit);
      renderFsPanel();
    };
  });
  const weightEl = document.getElementById('fs-weight');
  const repsEl = document.getElementById('fs-reps');
  if (weightEl) {
    if (typedEntry && typedEntry.key === weightEl.dataset.entryKey) {
      weightEl.value = typedEntry.weight;
      // Wdh. nur bei gleicher Einheit übernehmen (Umschalten auf Zeit setzt die gestoppte Dauer ein)
      if (typedEntry.unitKey === repsEl.dataset.entryKey) repsEl.value = typedEntry.reps;
    }
    // Beim Fokussieren den Wert markieren statt zu löschen — Tippen
    // ersetzt eine markierte Auswahl automatisch, aber man sieht den
    // vorgeschlagenen Wert noch kurz, bevor man drüberschreibt. Wichtig
    // seit "Satz beenden" das Feld selbst fokussiert (siehe fs-end-set):
    // ein Leeren beim Fokus hätte den hilfreichen Vorschlag sofort wieder
    // gelöscht, bevor man ihn überhaupt sieht.
    weightEl.onfocus = (e) => { e.target.select(); };
    repsEl.onfocus = (e) => { e.target.select(); };
    const submitSet = () => {
      const reps = repsEl.value.trim();
      if (!reps) { toast('Wiederholungen eingeben.', 'err'); return; }
      const weightRaw = weightEl.value;
      // Feld VOR dem Neu-Rendern aktiv verlassen (Tastatur zu) — sonst
      // entscheidet auf Android manchmal die virtuelle Tastatur selbst,
      // wohin der Fokus springt, sobald das fokussierte Element beim
      // Re-Render verschwindet (z. B. zurück auf einen älteren Satz). Das
      // Neu-Rendern (das den Fokus zerstört) erst einen Tick später, damit
      // der Blur zuverlässig zuerst durchläuft, bevor Android reagiert.
      weightEl.blur();
      repsEl.blur();
      setTimeout(() => {
        const unit = exerciseUnit(builder.exercises[builder.activeIndex].exerciseId);
        builder.exercises[builder.activeIndex].sets.push({ weight: weightRaw === '' ? '' : Number(weightRaw), reps, elapsedSec: fsCapturedElapsed, unit });
        fsNoteTarget = { gi: builder.activeIndex, si: builder.exercises[builder.activeIndex].sets.length - 1 };
        // Supersatz: ohne Pause weiter zur nächsten Übung der Runde; Pause erst nach der letzten
        const mem = supersetMembers(builder.exercises, builder.activeIndex);
        const nextInRound = mem.find((j) => j > builder.activeIndex && !(logMode === 'execute' && fsExerciseDone(builder.exercises[j])));
        if (mem.length > 1 && nextInRound != null) {
          builder.activeIndex = nextInRound;
          fsPhase = 'idle';
          fsRoundDone = false;
          toast(`Supersatz: weiter mit ${exerciseName(builder.exercises[nextInRound].exerciseId)}`);
          renderFsPanel();
          return;
        }
        fsRoundDone = mem.length > 1; // Runde komplett: nach der Pause wieder bei der ersten Übung
        fsRestHidden = false;
        fsPhase = 'resting';
        startFsRestTimer();
        renderFsPanel();
      }, 0);
    };
    // Enter im Gewicht-Feld springt nur weiter zu Wdh. (wie Tab) — Enter im
    // Wdh.-Feld loggt den Satz direkt und schliesst die Tastatur, ohne dass
    // man extra den Button antippen muss.
    weightEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); repsEl.focus(); } };
    repsEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitSet(); } };
    document.getElementById('fs-add-set').onclick = submitSet;
  }
}

function renderLogExerciseRows() {
  saveDraft('log_exercises', logBuilder.exercises);
  const holder = document.getElementById('log-exercise-rows');
  if (!holder) return;
  const L = logBuilder.exercises;
  const linkHtml = (i) => {
    if (i >= L.length - 1) return '';
    const linked = L[i].superset && L[i].superset === L[i + 1].superset;
    return `<button type="button" class="ss-link ${linked ? 'linked' : ''}" data-ss-link="${i}">${linked ? 'Supersatz lösen' : '＋ Als Supersatz verbinden'}</button>`;
  };
  holder.innerHTML = L.length ? L.map((ex, i) => `
    <div class="ex-row ${ex.superset ? 'in-superset' : ''}" id="log-exercise-row-${i}">
      <span class="ex-row-name">${ex.superset ? `<span class="ss-badge" title="Supersatz">${supersetLabel(L, i, true)}</span>` : ''}${esc(exerciseName(ex.exerciseId))}</span>
      <input type="number" data-i="${i}" data-f="sets" value="${ex.sets}" placeholder="Sätze" class="ex-row-input" title="Sätze">
      <button type="button" class="ex-row-step" data-step="${i}" title="Zusätzlicher Satz">+</button>
      <input type="text" inputmode="numeric" data-i="${i}" data-f="reps" value="${esc(String(ex.reps))}" placeholder="Wdh" class="ex-row-input" title="Wiederholungen">
      <input type="number" data-i="${i}" data-f="weight" value="${ex.weight}" placeholder="kg" step="0.5" class="ex-row-input" title="Gewicht">
      <button type="button" class="ex-row-remove" data-remove="${i}">×</button>
    </div>
    ${linkHtml(i)}
  `).join('') : '<div class="list-empty" style="margin-bottom:14px;">Noch keine Übungen — Vorlage laden oder unten hinzufügen.</div>';
  holder.querySelectorAll('[data-ss-link]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.ssLink);
      if (L[i].superset && L[i].superset === L[i + 1].superset) supersetUnlink(L, i, i + 1); else supersetLink(L, i, i + 1);
      renderLogExerciseRows();
    };
  });

  holder.querySelectorAll('input').forEach((inp) => {
    inp.oninput = () => {
      const i = Number(inp.dataset.i);
      const f = inp.dataset.f;
      logBuilder.exercises[i][f] = f === 'reps' ? inp.value : (Number(inp.value) || 0);
      saveDraft('log_exercises', logBuilder.exercises);
    };
  });
  holder.querySelectorAll('[data-step]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.step);
      logBuilder.exercises[i].sets = (Number(logBuilder.exercises[i].sets) || 0) + 1;
      renderLogExerciseRows();
    };
  });
  holder.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => {
      logBuilder.exercises.splice(Number(btn.dataset.remove), 1);
      supersetCleanup(logBuilder.exercises);
      renderLogExerciseRows();
      const startBtn = document.getElementById('plan-start');
      if (startBtn) startBtn.disabled = !logBuilder.exercises.length;
      showFabStart('▶ STARTEN', 'plan-start');
    };
  });
}

/* Maschineneinstellungen (Sitzhöhe, ROM, Pin-Position...) braucht man JEDES
   Mal an derselben Maschine wieder — anders als Ausführung/Zielmuskeln (die
   man höchstens einmal nachschaut) gehört das direkt sichtbar zur aktiven
   Übung, nicht hinter dem ℹ-Umschalter versteckt. Wert kommt automatisch
   vom letzten Mal, da er dauerhaft pro Übung in exerciseSettings liegt.
   Standardmässig nur als kompakter Text angezeigt (nicht als leeres,
   mehrzeiliges Eingabefeld, das viel Platz frisst, auch wenn nichts oder
   nur ein kurzer Satz drinsteht) — erst der ✎-Button schaltet auf ein
   echtes, fokussiertes Textfeld um; nur EINE Übung ist je aktiv, daher
   reicht ein einzelnes modul-globales Flag statt einem pro Übung. */
let fsNoteEditing = false;

/* Kurze Trend-Übersicht direkt nach "Fertig & Speichern" — {name, symbol,
   cls} pro geloggter Übung dieser Session, bevor der Screen wieder in den
   normalen (leeren) Zustand zurückspringt. null = keine Übersicht aktiv. */
let fsRecap = null;
function fsMachineNoteHtml(exerciseId) {
  const note = exerciseSettings[exerciseId] || '';
  if (!fsNoteEditing) {
    return `
      <div class="fs-machine-note-view">
        <span class="fs-machine-note-text">${note ? esc(note) : 'Keine Maschineneinstellungen notiert.'}</span>
        <button type="button" class="ex-row-remove" id="fs-machine-note-edit" title="Maschineneinstellungen bearbeiten">✎</button>
      </div>
    `;
  }
  return `
    <div class="field fs-machine-note">
      <label>Maschineneinstellungen (optional)</label>
      <textarea data-machine-note="${exerciseId}" id="fs-machine-note-input" placeholder="z. B. Sitz Stufe 4, ROM oben eingeschränkt…">${esc(note)}</textarea>
    </div>
  `;
}
