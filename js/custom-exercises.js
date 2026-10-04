/* js/custom-exercises.js — Eigene Übungen (in EXERCISE_LIBRARY eingehängt) und Übungswünsche */
/* ================================================================
   EIGENE ÜBUNGEN + ÜBUNGSWÜNSCHE
   Eigene Übungen liegen privat unter customExercises/{memberId}/{id} und
   werden beim Laden in EXERCISE_LIBRARY eingehängt — so funktionieren sie
   überall wie normale Übungen (Pläne, Board, Fortschritt, Körperkarte,
   Erholung). "Entfernen" blendet nur aus, damit alte Einträge ihren Namen
   behalten. Wünsche gehen nach exerciseRequests (lesen kann nur der Admin).
   ================================================================= */
const CUSTOM_GROUPS = {
  brust: { label: 'Brust', muscles: ['chest'] },
  ruecken: { label: 'Rücken', muscles: ['lats', 'traps'] },
  rumpf: { label: 'Rumpf', muscles: ['abs', 'obliques'] },
  arme: { label: 'Arme', muscles: ['biceps', 'triceps'] },
  beine: { label: 'Beine', muscles: ['quads', 'glutes'] },
};
let customExercises = {}; // {id: {name, group, unit, note, hidden}}

function customToLibraryEntry(id, c) {
  const g = CUSTOM_GROUPS[c.group] || CUSTOM_GROUPS.rumpf;
  return {
    id, name: c.name, custom: true, hidden: !!c.hidden, category: c.group, isHold: c.unit === 'time',
    howTo: `Eigene Übung${c.note ? ` · ${c.note}` : ''}`,
    muscles: { primary: g.muscles.slice(0, 1), secondary: g.muscles.slice(1) },
  };
}
function mergeCustomExercises() {
  for (let i = EXERCISE_LIBRARY.length - 1; i >= 0; i--) if (EXERCISE_LIBRARY[i].custom) EXERCISE_LIBRARY.splice(i, 1);
  Object.entries(customExercises).forEach(([id, c]) => EXERCISE_LIBRARY.push(customToLibraryEntry(id, c)));
}
async function loadCustomExercises() {
  const raw = await fbGet(`customExercises/${state.member.id}`);
  if (raw === undefined) return false;
  customExercises = raw || {};
  mergeCustomExercises();
  return true;
}
/* Namen fremder eigener Übungen (aus Challenges der Crew), damit dort
   nicht die interne ID steht. */
function rememberForeignExerciseNames(names) {
  Object.entries(names || {}).forEach(([id, n]) => { if (!EXERCISE_LIBRARY.some((e) => e.id === id)) FOREIGN_EX_NAMES[id] = n; });
}
function customNamesFor(exerciseIds) {
  const out = {};
  exerciseIds.forEach((id) => { if (customExercises[id]) out[id] = customExercises[id].name; });
  return out;
}

/* Formular als Sheet: mode 'custom' (eigene Übung anlegen) oder 'wish'. */
function showCustomExerciseSheet(mode, onDone) {
  const el = ensureExerciseInfoSheet();
  const isWish = mode === 'wish';
  let group = 'brust';
  let unit = 'reps';
  el.innerHTML = `
    <div class="info-sheet-card custom-ex-sheet">
      <button type="button" class="info-sheet-close" id="info-sheet-close">✕</button>
      <div class="info-sheet-title">${isWish ? 'Übung wünschen' : 'Eigene Übung'}</div>
      <p class="card-sub" style="margin:0 0 12px;">${isWish ? `Fehlt eine Übung? ${esc(PRIVACY_OPERATOR)} bekommt deinen Wunsch und kann sie für alle einbauen.` : 'Nur für dich sichtbar. Funktioniert wie jede andere Übung — auch im Fortschritt.'}</p>
      <div class="field"><label>Name</label><input type="text" id="cx-name" maxlength="40" placeholder="z. B. Butterfly"></div>
      <div class="field"><label>Muskelgruppe</label>
        <div class="chip-row" id="cx-group">${Object.entries(CUSTOM_GROUPS).map(([k, g]) => `<button type="button" class="chip ${k === group ? 'active' : ''}" data-group="${k}">${g.label}</button>`).join('')}</div>
      </div>
      ${isWish ? '' : `<div class="field"><label>Zählt in</label>
        <div class="chip-row" id="cx-unit"><button type="button" class="chip active" data-unit="reps">Wiederholungen</button><button type="button" class="chip" data-unit="time">Sekunden</button></div>
      </div>`}
      <div class="field"><label>Gerät / Hinweis (optional)</label><input type="text" id="cx-note" maxlength="80" placeholder="z. B. Maschine, Kabelzug, Freihantel"></div>
      ${isWish ? '' : `<label class="cx-check"><input type="checkbox" id="cx-wish"> Auch als Wunsch an ${esc(PRIVACY_OPERATOR)} schicken</label>`}
      <button class="btn" id="cx-save" style="width:100%;">${isWish ? 'Wunsch senden' : 'Übung anlegen'}</button>
    </div>`;
  openExerciseInfoSheet(el);
  document.getElementById('info-sheet-close').onclick = () => closeExerciseInfoSheet();
  const pick = (holderId, attr, set) => {
    const h = document.getElementById(holderId);
    if (!h) return;
    h.querySelectorAll('.chip').forEach((b) => {
      b.onclick = () => { set(b.dataset[attr]); h.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === b)); };
    });
  };
  pick('cx-group', 'group', (v) => { group = v; });
  pick('cx-unit', 'unit', (v) => { unit = v; });
  document.getElementById('cx-save').onclick = async () => {
    const name = document.getElementById('cx-name').value.trim();
    const note = document.getElementById('cx-note').value.trim();
    if (!name) { toast('Bitte einen Namen eingeben.', 'err'); return; }
    const sendWish = isWish || document.getElementById('cx-wish').checked;
    let newId = null;
    if (!isWish) {
      newId = 'custom_' + generatePushId();
      customExercises[newId] = { name, group, unit, ...(note ? { note } : {}), createdAt: Date.now() };
      mergeCustomExercises();
      await fbPut(`customExercises/${state.member.id}/${newId}`, customExercises[newId]);
    }
    if (sendWish) {
      const r = await fbUpdateNow(`exerciseRequests/${generatePushId()}`, {
        name, group, ...(note ? { note } : {}), fromId: state.member.id, fromName: state.member.name, at: Date.now(),
      });
      if (!r.ok) toast('Wunsch konnte nicht gesendet werden (offline?).', 'err');
      else if (isWish) toast(`Danke! Wunsch an ${PRIVACY_OPERATOR} gesendet.`, 'ok');
    }
    if (!isWish) toast(`"${name}" angelegt${sendWish ? ' und gewünscht' : ''}.`, 'ok');
    closeExerciseInfoSheet();
    if (onDone) onDone(newId);
  };
}

async function hideCustomExercise(id) {
  if (!customExercises[id] || !confirm(`"${customExercises[id].name}" aus der Auswahl entfernen? Bisherige Einträge bleiben erhalten.`)) return false;
  customExercises[id] = { ...customExercises[id], hidden: true };
  mergeCustomExercises();
  await fbPut(`customExercises/${state.member.id}/${id}/hidden`, true);
  return true;
}

/* Admin: offene Wünsche unter KONTO + Punkt am KONTO-Knopf. */
let openWishCount = 0;
async function refreshWishDot() {
  const r = await fbGetNow('exerciseRequests');
  if (!r.ok) return null; // kein Admin (oder offline)
  const list = Object.entries(r.value || {});
  openWishCount = list.filter(([, w]) => !w.done).length;
  const dot = document.getElementById('konto-dot');
  if (dot) dot.hidden = !openWishCount;
  return list;
}
function wishesCardHtml(list) {
  const sorted = list.sort((a, b) => (a[1].done ? 1 : 0) - (b[1].done ? 1 : 0) || (b[1].at || 0) - (a[1].at || 0));
  return `
    <div class="sec-head"><h2 class="sec-title">Übungswünsche</h2><div class="sec-rule"></div></div>
    <div class="card">
      ${sorted.length ? sorted.map(([id, w]) => `
        <div class="wish-row ${w.done ? 'done' : ''}">
          <div><b>${esc(w.name)}</b> <span class="card-sub">· ${esc((CUSTOM_GROUPS[w.group] || {}).label || w.group || '')}${w.note ? ` · ${esc(w.note)}` : ''}</span><br>
          <span class="card-sub">von ${esc(w.fromName || '?')} · ${w.at ? fmtShortDate(dayKey(new Date(w.at))) : ''}</span></div>
          <button class="btn ghost small" data-wish-done="${esc(id)}">${w.done ? 'Wieder offen' : 'Erledigt'}</button>
        </div>`).join('') : '<p class="card-sub" style="margin:0;">Noch keine Wünsche.</p>'}
    </div>`;
}
