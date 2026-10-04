/* js/progress.js — Tab Fortschritt: Kurven, Wochen-Auswertung, Rekorde, Hinweise, Erholung, renderProgress */
/* ================================================================
   FORTSCHRITT (Beta)
   Eigene Kurve im Mittelpunkt: pro Übung der beste Satz je Training,
   dazu Wochenübersicht (Gym / Board / Anderes), ein paar Kennzahlen und
   eine grobe Erholungs-Anzeige pro Körperbereich. Kein Vergleich mit
   anderen — nur der eigene Verlauf.
   ================================================================= */
const PROGRESS_COLORS = { gym: '#2f95cf', board: '#c4851c', other: '#9b7be6' }; // validiert (dark, #10151b)
const PROGRESS_RANGES = [['4w', '4W', 28], ['3m', '3M', 91], ['1y', '1J', 365], ['all', 'Alle', 100000]];
let progressRange = '3m';
let progressExerciseId = null;
let progressSource = (() => { try { return localStorage.getItem(STORAGE_PREFIX + 'pg_source') || 'gym'; } catch (e) { return 'gym'; } })(); // 'gym' | 'board'
let progressFbSessions = [];

function dayKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function mondayOf(d) { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; }
function entryTime(e) { return e.createdAt || new Date(e.date + 'T12:00').getTime(); }

/* Bester Satz einer Übung in einem Training: mit Gewicht = schwerstes
   Gewicht (bei Gleichstand mehr Wdh.), ohne Gewicht = meiste Wdh./Sekunden. */
/* Bester Satz: Sätze mit Gewicht und Wiederholungen werden über das
   geschätzte Maximalgewicht (1RM nach Epley: kg × (1 + Wdh./30)) verglichen —
   so sind 8 × 60 kg und 5 × 70 kg vergleichbar. Halte-Sätze (Sekunden) und
   Sätze ohne Gewicht wie bisher über Gewicht bzw. Wdh./Sekunden. */
function bestSetOf(exerciseId, sets) {
  let best = null;
  sets.forEach((st) => {
    const w = st.weight !== '' && st.weight != null ? Number(st.weight) : 0;
    const r = Number(st.reps) || 0;
    const suffix = setUnitSuffix(exerciseId, st);
    const e1 = w > 0 && r > 0 && suffix !== 's' ? Math.round(w * (1 + Math.min(r, 12) / 30)) : 0;
    const score = e1 ? e1 * 1000 + r : w > 0 ? w * 1000 + r : r;
    if (!best || score > best.score) best = { w, r, e1, score, suffix };
  });
  if (!best) return null;
  const label = best.w > 0 ? `${best.w} kg × ${best.r}${best.suffix}${best.e1 && best.r > 1 ? ` (≈ ${best.e1} kg 1RM)` : ''}` : `${best.r}${best.suffix || ' Wdh.'}`;
  return { ...best, value: best.e1 || (best.w > 0 ? best.w : best.r), label };
}

/* Übungen im Board-Ablauf (Fixübungen wie Kniebeugen, Lifting-Pin mit
   Wiederholungen): pro Einheit die im Check-in erfassten Wdh./Gewichte als
   "Sätze" — so lässt sich derselbe bestSetOf-Vergleich wie im Gym nutzen. */
const PG_BLOCK_ID = '__liftingpin';
/* Hangs zählen als eigene "Übung" je Griff (id grip:<board>:<griff>), Wert =
   Hängezeit bzw. Zusatzgewicht der Einheit. Übungen ohne Eingabe im Check-in
   zählen mit den geplanten Wdh., sobald der Satz erreicht wurde (bzw. bei
   ganz abgeschlossenen Einheiten auch ohne gespeichertes Ergebnis). */
const PG_GRIP_PREFIX = 'grip:';
function boardExerciseSets(sn) {
  const out = {};
  (sn.blocks || []).forEach((b, i) => {
    const r = (sn.results || [])[i];
    const reached = !!r || !sn.partial;
    if (!reached) return;
    if (b.type === 'hang' && b.grip) {
      const done = r && Array.isArray(r.doneReps) ? r.doneReps.filter(Boolean).length : Number(b.reps) || 0;
      if (!done) return;
      const id = `${PG_GRIP_PREFIX}${b.board || sn.board}:${b.grip}`;
      (out[id] = out[id] || []).push({ reps: Number(b.hangSec) || 0, weight: Number(sn.weight) || '', unit: 'time' });
      return;
    }
    let id = null;
    if (b.type === 'exercise' && !['warmup_general', 'cooldown_general'].includes(b.exerciseId)) id = b.exerciseId;
    else if (b.type === 'block' && b.mode === 'reps') id = PG_BLOCK_ID;
    if (!id) return;
    const entered = r && r.reps !== '' && r.reps != null;
    // Halte-Übung ohne Eingabe: geplante Dauer statt "1 Wdh."
    if (!entered && id !== PG_BLOCK_ID && exerciseIsHold(id)) { (out[id] = out[id] || []).push({ reps: b.workSec, weight: '', unit: 'time' }); return; }
    const reps = entered ? r.reps : b.reps;
    if (reps === '' || reps == null) return;
    (out[id] = out[id] || []).push({ reps, weight: r ? r.weight : '' });
  });
  return out;
}
function progressExerciseName(id) {
  if (id.startsWith(PG_GRIP_PREFIX)) {
    const [board, grip] = id.slice(PG_GRIP_PREFIX.length).split(':');
    return `Hang ${gripLabel(board, grip)}${board === 'bm1000' ? ' (BM 1000)' : ''}`;
  }
  return id === PG_BLOCK_ID ? 'Lifting Pin (Wiederholungen)' : exerciseName(id);
}
/* Alle Übungen der gewählten Quelle (Gym-Logs bzw. Board-Einheiten). */
function progressSessionsBySource(source) {
  if (source === 'board') {
    return progressFbSessions.map((sn) => ({ t: entryTime(sn), date: sn.date, byEx: boardExerciseSets(sn) }));
  }
  return state.logs.map((e) => {
    const byEx = {};
    (e.exercises || []).forEach((x) => {
      if (Array.isArray(x.sets) && x.sets.length && !['warmup_general', 'cooldown_general'].includes(x.exerciseId)) byEx[x.exerciseId] = x.sets;
    });
    return { t: entryTime(e), date: e.date, byEx };
  });
}
function progressExerciseIds(source) {
  const ids = [];
  progressSessionsBySource(source).sort((a, b) => b.t - a.t).forEach((s) => Object.keys(s.byEx).forEach((id) => { if (!ids.includes(id)) ids.push(id); }));
  return ids; // zuletzt trainierte zuerst
}
function progressSeries(exerciseId, days, source = progressSource) {
  const since = Date.now() - days * 86400000;
  const pts = [];
  progressSessionsBySource(source).forEach((s) => {
    if (s.t < since || !s.byEx[exerciseId]) return;
    const best = bestSetOf(exerciseId === PG_BLOCK_ID ? 'x' : exerciseId, s.byEx[exerciseId]);
    if (best) pts.push({ t: s.t, date: s.date, ...best });
  });
  return pts.sort((a, b) => a.t - b.t);
}
/* Übersicht: jede Übung mit letztem Bestwert und Veränderung im Zeitraum. */
function progressOverviewHtml(exIds, days) {
  return `<div class="pg-ex-list">${exIds.map((id) => {
    const pts = progressSeries(id, days);
    const last = pts[pts.length - 1];
    let change = '<span class="pg-muted">—</span>';
    // Nur Gleiches vergleichen: mit Gewicht (kg) gegen mit Gewicht, sonst Wdh./Sekunden
    const first = pts.find((p) => (p.w > 0) === (last.w > 0));
    if (pts.length >= 2 && first && first !== last && first.value) {
      const pct = Math.round(((last.value - first.value) / first.value) * 100);
      change = `<span class="${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}">${pct > 0 ? '+' : ''}${pct} %</span>`;
    }
    return `<button type="button" class="pg-ex-row ${id === progressExerciseId ? 'active' : ''}" data-pg-ex="${esc(id)}">
      <span class="pg-ex-name">${esc(progressExerciseName(id))}</span>
      <span class="pg-ex-last">${last ? esc(last.label) : '<span class="pg-muted">nicht im Zeitraum</span>'}</span>
      <span class="pg-ex-chg">${change}</span>
    </button>`;
  }).join('')}</div>`;
}

/* Einfaches Linien-Diagramm (eine Serie, keine Legende nötig — der Titel
   benennt sie). Punkte antippbar: Wert erscheint in der Zeile darunter. */
function progressLineChart(id, pts, unitLabel) {
  if (!pts.length) return '<div class="list-empty">Noch keine Daten in diesem Zeitraum.</div>';
  const W = 340, H = 160, padL = 34, padR = 12, padT = 14, padB = 22;
  const vals = pts.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo; lo -= span * 0.1; hi += span * 0.1;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t) => (t1 === t0 ? (padL + W - padR) / 2 : padL + ((t - t0) / (t1 - t0)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const maxVal = Math.max(...vals);
  const prIdx = vals.lastIndexOf(maxVal);
  const fmt = (v) => (Math.round(v * 10) / 10).toString();
  const minVal = Math.min(...vals);
  const ticks = maxVal === minVal ? [maxVal] : [maxVal, (maxVal + minVal) / 2, minVal];
  const grid = ticks.map((v) =>
    `<line class="pg-grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="pg-axis" x="${padL - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('');
  const line = pts.map((p) => `${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `
    <circle class="pg-hit" cx="${x(p.t).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="16" data-chart="${id}" data-i="${i}"><title>${esc(fmtShortDate(p.date))}: ${esc(p.label)}</title></circle>
    <circle class="pg-dot ${i === prIdx ? 'pr' : ''}" cx="${x(p.t).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${i === prIdx ? 6 : 4}"/>`).join('');
  const dateLabels = [pts[0], pts[pts.length - 1]].filter((p, i, arr) => i === 0 || p !== arr[0])
    .map((p, i) => `<text class="pg-axis" x="${x(p.t).toFixed(1)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : 'end'}">${esc(fmtShortDate(p.date))}</text>`).join('');
  return `
    <svg class="pg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unitLabel)}: ${pts.map((p) => fmtShortDate(p.date) + ' ' + p.label).join(', ')}">
      ${cycleBandsSvg(x, t0, t1, padT, H - padB)}
      ${grid}
      <polyline class="pg-line" points="${line}"/>
      ${dots}${dateLabels}
    </svg>
    <div class="pg-readout" id="${id}-readout">Punkt antippen für Details · Rekord: <b>${esc(pts[prIdx].label)}</b> (${esc(fmtShortDate(pts[prIdx].date))})</div>`;
}

function progressWeekGridHtml() {
  const byDay = {};
  const mark = (key, kind) => {
    const order = { board: 3, gym: 2, other: 1 };
    if (!byDay[key] || order[kind] > order[byDay[key]]) byDay[key] = kind;
  };
  state.logs.forEach((e) => mark(dayKey(new Date(entryTime(e))), e.type === 'gym' || (e.exercises || []).length ? 'gym' : 'other'));
  progressFbSessions.forEach((sn) => mark(dayKey(new Date(entryTime(sn))), 'board'));
  const thisMonday = mondayOf(new Date());
  const cols = [];
  for (let w = 7; w >= 0; w--) {
    const mon = new Date(thisMonday); mon.setDate(mon.getDate() - w * 7);
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(mon); day.setDate(day.getDate() + d);
      const kind = byDay[dayKey(day)];
      const future = day > new Date();
      cells.push(`<span class="pg-cell ${kind || ''} ${future ? 'future' : ''}" title="${pad2(day.getDate())}.${pad2(day.getMonth() + 1)}.${kind ? ' · ' + ({ gym: 'Gym', board: 'Board', other: 'Anderes' })[kind] : ''}"></span>`);
    }
    cols.push(`<div class="pg-week">${cells.join('')}<span class="pg-week-label">${pad2(mon.getDate())}.${pad2(mon.getMonth() + 1)}.</span></div>`);
  }
  return `<div class="pg-weeks">${cols.join('')}</div>
    <div class="pg-legend"><span><i class="gym"></i>Gym</span><span><i class="board"></i>Board</span><span><i class="other"></i>Anderes</span></div>`;
}

function progressStats() {
  const times = [...state.logs.map(entryTime), ...progressFbSessions.map(entryTime)];
  const last30 = times.filter((t) => t > Date.now() - 30 * 86400000).length;
  const weeksWith = new Set(times.map((t) => mondayOf(new Date(t)).getTime()));
  let streak = 0;
  const cur = mondayOf(new Date());
  if (!weeksWith.has(cur.getTime())) cur.setDate(cur.getDate() - 7);
  while (weeksWith.has(cur.getTime())) { streak++; cur.setDate(cur.getDate() - 7); }
  const weekStart = mondayOf(new Date()).getTime();
  let kg = 0;
  state.logs.filter((e) => entryTime(e) >= weekStart).forEach((e) => (e.exercises || []).forEach((ex) => (ex.sets || []).forEach((st) => {
    const w = Number(st.weight); const r = Number(st.reps);
    if (w > 0 && r > 0 && setUnitSuffix(ex.exerciseId, st) !== 's') kg += w * r;
  })));
  return { last30, streak, kg };
}

/* ---------- Wochen-Auswertung (Trainer-Sicht) ----------
   Harte Sätze: jeder Arbeitssatz im Gym (ohne Warm-up/Cooldown/Stretch)
   zählt 1 für jeden Hauptmuskel; Board: jede geschaffte Hang-/Campus-
   Wiederholung zählt 1 für die Finger (Campus auch Zug), Fixübungen 1 je
   Satz. Gruppen zählen einen Satz nur einmal, auch wenn er mehrere ihrer
   Muskeln trifft. Zielbereich 10–20 harte Sätze pro Gruppe und Woche. */
const PG_GROUPS = [
  { id: 'finger', label: 'Finger', muscles: ['forearms_front', 'forearms_back'] },
  { id: 'zug', label: 'Zug / Rücken', muscles: ['lats', 'traps', 'biceps'] },
  { id: 'druck', label: 'Druck / Brust', muscles: ['chest', 'triceps'] },
  { id: 'schultern', label: 'Schultern', muscles: ['shoulders', 'rear_delts', 'neck_traps'] },
  { id: 'beine', label: 'Beine', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'shins'] },
  { id: 'rumpf', label: 'Rumpf', muscles: ['abs', 'obliques', 'lower_back'] },
];
const PG_TARGET = [10, 20];
let progressWeekOffset = 0; // 0 = diese Woche, 1 = letzte …
let progressVolMetric = 'sets';
function pgIsHardExercise(id) {
  if (id === 'warmup_general' || id === 'cooldown_general') return false;
  const ex = EXERCISE_LIBRARY.find((e) => e.id === id);
  return !!(ex && ex.muscles && ex.muscles.primary.length && exerciseSupergroup(ex) !== 'stretch');
}
function pgWeekStats(offset) {
  const mon = mondayOf(new Date()); mon.setDate(mon.getDate() - offset * 7);
  const from = mon.getTime(), to = from + 7 * 86400000;
  const out = { from, sets: 0, min: 0, kg: 0, zones: {}, groups: {} };
  PG_GROUPS.forEach((g) => { out.groups[g.id] = 0; });
  const addSet = (primary, n = 1) => {
    out.sets += n;
    primary.forEach((m) => { out.zones[m] = (out.zones[m] || 0) + n; });
    PG_GROUPS.forEach((g) => { if (primary.some((m) => g.muscles.includes(m))) out.groups[g.id] += n; });
  };
  state.logs.forEach((e) => {
    const t = entryTime(e);
    if (t < from || t >= to) return;
    out.min += e.totalSessionSec ? e.totalSessionSec / 60 : Number(e.durationMin) || 0;
    (e.exercises || []).forEach((ex) => {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      sets.forEach((st) => {
        const w = Number(st.weight), r = Number(st.reps);
        if (w > 0 && r > 0 && setUnitSuffix(ex.exerciseId, st) !== 's') out.kg += w * r;
      });
      if (pgIsHardExercise(ex.exerciseId) && sets.length) addSet(exerciseMuscles(ex.exerciseId).primary, sets.length);
    });
  });
  progressFbSessions.forEach((sn) => {
    const t = entryTime(sn);
    if (t < from || t >= to) return;
    (sn.blocks || []).forEach((b, i) => {
      const r = (sn.results || [])[i];
      if (!r && sn.partial) return;
      out.min += fbBlockSeconds(b) / 60;
      const done = r && Array.isArray(r.doneReps) ? r.doneReps.filter(Boolean).length : Number(b.reps) || 0;
      if (b.type === 'hang' || (b.type === 'block' && b.mode !== 'reps')) addSet(['forearms_front'], done);
      else if (b.type === 'block') addSet(['forearms_front'], 1);
      else if (b.type === 'campus') addSet(['forearms_front', 'lats'], done);
      else if (b.type === 'exercise' && pgIsHardExercise(b.exerciseId)) addSet(exerciseMuscles(b.exerciseId).primary, 1);
    });
  });
  out.min = Math.round(out.min);
  return out;
}
const pgFmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}:${pad2(m % 60)} h` : `${m} min`);
const pgFmtKg = (k) => (k >= 1000 ? `${(k / 1000).toFixed(1).replace('.', ',')} t` : `${Math.round(k)} kg`);
function pgDeltaHtml(cur, prev) {
  if (!prev) return '';
  const p = Math.round(((cur - prev) / prev) * 100);
  return `<span class="pg-delta ${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? '▲ +' : p < 0 ? '▼ ' : ''}${p} %</span>`;
}
function pgWeekHtml(w, prev, streak) {
  const end = new Date(w.from + 6 * 86400000), start = new Date(w.from);
  const title = progressWeekOffset === 0 ? 'Diese Woche' : progressWeekOffset === 1 ? 'Letzte Woche' : `vor ${progressWeekOffset} Wochen`;
  return `
    <div class="pg-weeknav">
      <button type="button" class="pg-weeknav-btn" data-wk="1" aria-label="Vorherige Woche">‹</button>
      <div class="pg-weeknav-label"><b>${title}</b><span>${pad2(start.getDate())}.${pad2(start.getMonth() + 1)}. – ${pad2(end.getDate())}.${pad2(end.getMonth() + 1)}.${streak ? ` · ${streak} ${streak === 1 ? 'Woche' : 'Wochen'} in Folge` : ''}</span></div>
      <button type="button" class="pg-weeknav-btn" data-wk="-1" aria-label="Nächste Woche" ${progressWeekOffset === 0 ? 'style="visibility:hidden"' : ''}>›</button>
    </div>
    <div class="pg-tiles">
      <div class="pg-tile"><b>${pgFmtMin(w.min)}</b><span>Trainingszeit</span>${pgDeltaHtml(w.min, prev.min)}</div>
      <div class="pg-tile"><b class="accent">${w.sets}</b><span>harte Sätze</span>${pgDeltaHtml(w.sets, prev.sets)}</div>
      <div class="pg-tile"><b>${pgFmtKg(w.kg)}</b><span>bewegt</span>${pgDeltaHtml(w.kg, prev.kg)}</div>
    </div>`;
}
function pgGroupsHtml(w) {
  const max = 24, pct = (v) => `${(Math.min(v, max) / max) * 100}%`;
  return `
    <div class="pg-card">
      <div class="pg-card-head"><h3>Harte Sätze pro Muskelgruppe</h3><span class="pg-muted">Ziel ${PG_TARGET[0]}–${PG_TARGET[1]}</span></div>
      ${PG_GROUPS.map((g) => {
        const v = w.groups[g.id];
        const flag = v < PG_TARGET[0] ? 'unter Ziel' : v > PG_TARGET[1] ? 'viel' : '';
        return `<div class="pg-mg-row"><div><div class="pg-mg-name">${g.label}</div>${flag ? `<div class="pg-mg-flag">${flag}</div>` : ''}</div>
          <div class="pg-mg-track"><div class="pg-mg-band" style="left:${pct(PG_TARGET[0])};width:${pct(PG_TARGET[1] - PG_TARGET[0])}"></div><div class="pg-mg-bar" style="width:${pct(v)}"></div></div>
          <div class="pg-mg-num">${v}</div></div>`;
      }).join('')}
      <div class="pg-mg-scale"><div></div><div>${[0, 10, 20].map((t) => `<span style="left:${pct(t)}">${t}</span>`).join('')}</div><div></div></div>
      <p class="pg-muted" style="margin:8px 0 0;">Gym und Board zusammen. Board: jede geschaffte Hang-Wiederholung zählt als Satz für die Finger.</p>
    </div>`;
}
const PG_HEAT_STEPS = [
  { min: 0, label: '0', color: '#2a3140' }, { min: 1, label: '1–4', color: '#1f4a66' },
  { min: 5, label: '5–9', color: '#2a75a3' }, { min: 10, label: '10–14', color: '#3aa3dc' }, { min: 15, label: '15+', color: '#8fdcff' },
];
let pgHeatSel = null;
function pgHeatHtml(w) {
  const step = (v) => [...PG_HEAT_STEPS].reverse().find((h) => v >= h.min);
  const zones = Object.entries(MUSCLE_ZONES_SVG).map(([id, shape]) => `<g class="pg-heat-zone ${id === pgHeatSel ? 'sel' : ''}" data-heat="${id}" fill="${step(w.zones[id] || 0).color}">${shape}</g>`).join('');
  const sel = pgHeatSel ? w.zones[pgHeatSel] || 0 : null;
  return `
    <div class="pg-card">
      <div class="pg-card-head"><h3>Muskel-Heatmap</h3><span class="pg-muted">harte Sätze · antippen</span></div>
      <div class="pg-heat-wrap">
        <svg viewBox="${BODY_VIEWBOX}" class="muscle-map pg-heat-map" role="group" aria-label="Muskel-Heatmap">${BODY_BASE_SVG}${zones}${BODY_DECO_SVG}</svg>
        <div class="ex-body-labels"><span>VORNE</span><span>HINTEN</span></div>
      </div>
      <div class="pg-heat-legend">${PG_HEAT_STEPS.map((h) => `<div><i style="background:${h.color}"></i>${h.label}</div>`).join('')}</div>
      <p class="pg-readout">${pgHeatSel ? `<b>${esc(MUSCLE_ZONE_LABEL[pgHeatSel])}</b>: ${sel} harte ${sel === 1 ? 'Satz' : 'Sätze'}` : 'Muskel antippen für die Zahl.'}</p>
    </div>`;
}
function pgVolumeHtml(weeks) {
  const M = { sets: { k: 'sets', f: (v) => `${v} Sätze` }, time: { k: 'min', f: pgFmtMin }, kg: { k: 'kg', f: pgFmtKg } }[progressVolMetric];
  const vals = weeks.map((w) => w[M.k]);
  const max = Math.max(1, ...vals) * 1.1;
  const W = 340, H = 140, padB = 20, slot = W / vals.length, bw = slot - 8;
  const y = (v) => (H - padB) - (v / max) * (H - padB - 6);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="pg-vol" role="img" aria-label="Wochenvolumen">`;
  vals.forEach((v, i) => {
    const x = i * slot + 4, top = y(v), cur = i === vals.length - 1 - progressWeekOffset;
    if (v > 0) svg += `<path d="M${x},${H - padB} V${Math.min(top + 4, H - padB)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - padB} Z" fill="var(--accent)" opacity="${cur ? 1 : 0.5}"/>`;
    const d = new Date(weeks[i].from);
    svg += `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" class="pg-vol-axis">${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.</text>`;
    svg += `<rect class="pg-vol-hit" x="${x - 4}" y="0" width="${slot}" height="${H}" data-vol="${i}" fill="transparent"/>`;
  });
  svg += `<line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="var(--line-soft)"/></svg>`;
  return `
    <div class="pg-card">
      <div class="pg-card-head"><h3>Wochenvolumen</h3>
        <div class="chip-row pg-ranges">${[['sets', 'Sätze'], ['time', 'Zeit'], ['kg', 'kg']].map(([k, l]) => `<button type="button" class="chip small ${k === progressVolMetric ? 'active' : ''}" data-vol-metric="${k}">${l}</button>`).join('')}</div>
      </div>
      ${svg}
      <p class="pg-readout" id="pg-vol-readout">Balken antippen für die Woche.</p>
    </div>`;
}
/* Rekorde: Übungen, deren letzter Bestwert in den letzten 30 Tagen alle früheren schlägt */
function pgRecordsHtml() {
  const since = Date.now() - 30 * 86400000;
  const recs = [];
  ['gym', 'board'].forEach((src) => progressExerciseIds(src).forEach((id) => {
    const pts = progressSeries(id, 100000, src);
    if (pts.length < 2) return;
    const best = pts.reduce((a, b) => (b.score > a.score ? b : a));
    const earlier = pts.filter((p) => p.t < best.t);
    if (best.t >= since && earlier.length && best.score > Math.max(...earlier.map((p) => p.score))) recs.push({ id, best });
  }));
  recs.sort((a, b) => b.best.t - a.best.t);
  if (!recs.length) return '';
  return `
    <div class="pg-card">
      <div class="pg-card-head"><h3>Rekorde</h3><span class="pg-muted">letzte 30 Tage</span></div>
      ${recs.slice(0, 5).map((r) => `<div class="pg-record"><span>🏆 ${esc(progressExerciseName(r.id))}<small>${esc(fmtDateShort(new Date(r.best.t)))}</small></span><b>${esc(r.best.label)}</b></div>`).join('')}
    </div>`;
}
/* Hinweise wie von einem Trainer: Gruppen unter Ziel, lange nicht trainiert, Volumensprung */
function pgHintsHtml(w, prev) {
  const hints = [];
  if (progressWeekOffset === 0) {
    const lastBy = {};
    for (let o = 0; o < 6; o++) {
      const ws = pgWeekStats(o);
      PG_GROUPS.forEach((g) => { if (lastBy[g.id] == null && ws.groups[g.id]) lastBy[g.id] = o; });
    }
    PG_GROUPS.forEach((g) => {
      if (lastBy[g.id] == null) return; // nie trainiert: kein Hinweis (z. B. reine Kletterer ohne Beine)
      if (lastBy[g.id] >= 2) hints.push(['⏸', `<b>${g.label}</b> seit ${lastBy[g.id]} Wochen nicht trainiert.`]);
      else if (w.groups[g.id] && w.groups[g.id] < PG_TARGET[0] / 2 && new Date().getDay() !== 1) hints.push(['⚠', `<b>${g.label}</b> erst ${w.groups[g.id]} harte Sätze diese Woche.`]);
    });
  }
  if (prev.sets >= 10 && progressWeekOffset > 0) {
    const p = Math.round(((w.sets - prev.sets) / prev.sets) * 100);
    if (p > 25) hints.push(['↗', `Volumen <b>+${p} %</b> zur Vorwoche – mehr als 10–20 % pro Woche erhöht das Verletzungsrisiko.`]);
    else if (p < -40) hints.push(['💤', `Volumen ${p} % zur Vorwoche – passt als Entlastungswoche nach harten Wochen.`]);
  }
  if (!hints.length) return '';
  return `
    <div class="pg-card">
      <div class="pg-card-head"><h3>Hinweise</h3></div>
      ${hints.map(([ico, t]) => `<div class="pg-hint"><span class="pg-hint-ico">${ico}</span><span>${t}</span></div>`).join('')}
    </div>`;
}

const RECOVERY_AREAS = [
  { id: 'finger', label: 'Finger', readyH: 72 },
  { id: 'zug', label: 'Zug', readyH: 48, muscles: ['lats', 'traps', 'rear_delts', 'biceps', 'forearms_front', 'forearms_back', 'neck_traps'] },
  { id: 'druck', label: 'Druck', readyH: 48, muscles: ['chest', 'shoulders', 'triceps'] },
  { id: 'beine', label: 'Beine', readyH: 48, muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'shins'] },
  { id: 'rumpf', label: 'Rumpf', readyH: 36, muscles: ['abs', 'obliques', 'lower_back'] },
];
/* Erholungszeit hängt an der Anstrengung: RPE im Log (locker 60 %, mittel 85 %, hart 100–115 %),
   beim Board am Programm (Aufwärmen/Einsteiger kürzer) */
function recoveryFactorForRpe(rpe) {
  const r = Number(rpe);
  if (!r) return 1;
  return r <= 5 ? 0.6 : r <= 7 ? 0.85 : r >= 10 ? 1.15 : 1;
}
const RECOVERY_FB_FACTOR = { pp_warmup: 0.4, pp_beginner: 0.8 };
function progressRecoveryHtml() {
  const lastT = {}, factor = {};
  // die jüngste Belastung zählt, mit ihrem eigenen Faktor
  const touch = (id, t, f = 1) => { if (!lastT[id] || t > lastT[id]) { lastT[id] = t; factor[id] = f; } };
  progressFbSessions.forEach((sn) => touch('finger', entryTime(sn), sn.partial ? 0.7 : RECOVERY_FB_FACTOR[sn.templateId] || 1));
  state.logs.forEach((e) => {
    const f = recoveryFactorForRpe(e.rpe);
    if (e.type === 'klettern') touch('finger', entryTime(e), f);
    (e.exercises || []).forEach((ex) => {
      const m = exerciseMuscles(ex.exerciseId);
      RECOVERY_AREAS.forEach((a) => { if (a.muscles && m.primary.some((x) => a.muscles.includes(x))) touch(a.id, entryTime(e), f); });
    });
  });
  return RECOVERY_AREAS.map((a0) => {
    const a = { ...a0, readyH: Math.round(a0.readyH * (factor[a0.id] || 1)) };
    const t = lastT[a.id];
    const h = t ? (Date.now() - t) / 3600000 : null;
    const ratio = h == null ? 1 : Math.min(1, h / a.readyH);
    const ready = h == null || h >= a.readyH;
    const ago = h == null ? 'noch nie' : h < 24 ? 'heute' : `vor ${Math.floor(h / 24)} ${Math.floor(h / 24) === 1 ? 'Tag' : 'Tagen'}`;
    return `<div class="pg-rec">
      <div class="pg-rec-head"><span>${a.label}</span><span class="${ready ? 'ok' : 'wait'}">${ago} · ${ready ? 'bereit' : 'noch schonen'}</span></div>
      <div class="pg-rec-bar"><span class="${ready ? 'ok' : 'wait'}" style="width:${Math.round(ratio * 100)}%"></span></div>
    </div>`;
  }).join('');
}

function fbSessionHangSeconds(sn) {
  let sec = 0;
  (sn.blocks || []).forEach((b, i) => {
    if (b.type !== 'hang') return;
    const r = (sn.results || [])[i];
    const done = r && Array.isArray(r.doneReps) ? r.doneReps.filter(Boolean).length : Number(b.reps) || 0;
    sec += done * (Number(b.hangSec) || 0);
  });
  return sec;
}

async function renderProgress() {
  renderShell(`<div class="sec-head"><h2 class="sec-title">Fortschritt</h2><div class="sec-rule"></div></div><div id="pg-root"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>`);
  const [rawLogs, rawFb, rawCycle] = await Promise.all([fbGet(`logs/${state.member.id}`), fbGet(`fingerboardSessions/${state.member.id}`), fbGet(`cycle/${state.member.id}`)]);
  cycleData = rawCycle && rawCycle.consentAt ? rawCycle : null;
  state.logs = Object.values(rawLogs || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  progressFbSessions = Object.values(rawFb || {}).sort((a, b) => entryTime(a) - entryTime(b));
  fbSessionsCache = progressFbSessions.slice().reverse();
  drawProgress();
}

function drawProgress() {
  const root = document.getElementById('pg-root');
  if (!root) return;
  const days = PROGRESS_RANGES.find((r) => r[0] === progressRange)[2];
  // Nur Übungen, die im gewählten Zeitraum wirklich gemacht wurden (keine "nicht im Zeitraum"-Zeilen)
  const exIds = progressExerciseIds(progressSource).filter((id) => progressSeries(id, days).length);
  if (!progressExerciseId || !exIds.includes(progressExerciseId)) progressExerciseId = exIds[0] || null;
  const pts = progressExerciseId ? progressSeries(progressExerciseId, days) : [];
  let headline = '';
  const lastPt = pts[pts.length - 1];
  const firstPt = lastPt && pts.find((p) => (p.w > 0) === (lastPt.w > 0)); // nur Gleiches vergleichen (kg mit kg)
  if (pts.length >= 2 && firstPt && firstPt !== lastPt) {
    const first = firstPt.value, last = lastPt.value;
    const pct = first ? Math.round(((last - first) / first) * 100) : 0;
    headline = `<div class="pg-hero"><span class="pg-hero-num ${pct >= 0 ? 'up' : 'down'}">${pct > 0 ? '+' : ''}${pct} %</span><span class="pg-hero-sub">${esc(firstPt.label)} → ${esc(lastPt.label)}</span></div>`;
  }
  const isNewPr = pts.length >= 2 && pts[pts.length - 1].value > Math.max(...pts.slice(0, -1).map((p) => p.value));
  const stats = progressStats();
  const fbRecent = progressFbSessions.filter((sn) => entryTime(sn) > Date.now() - days * 86400000);
  const fbPts = fbRecent.map((sn) => { const v = fbSessionHangSeconds(sn); return { t: entryTime(sn), date: sn.date, value: v, label: `${v} s Hängezeit` }; }).filter((p) => p.value > 0);

  // Noch gar nichts trainiert: Einladung statt Nullen, leerem Raster und fünf vollen Erholungsbalken
  if (!state.logs.length && !progressFbSessions.length) {
    root.innerHTML = `
      <div class="pg-card empty-invite">
        ${slothFigure('wave', 'empty-invite-sloth')}
        <h3>Hier wächst dein Fortschritt</h3>
        <p class="pg-muted">Nach dem ersten Training siehst du hier Rekorde, deine Wochen und wie gut Finger, Zug, Druck, Beine und Rumpf erholt sind.</p>
        <div class="empty-invite-actions">
          <a class="btn" href="#fingerboard">Board-Training</a>
          <a class="btn ghost" href="#log">Gym-Training</a>
        </div>
      </div>
      ${cycleCardHtml()}`;
    wireCycleCard();
    return;
  }

  const weeks = []; for (let o = 7; o >= 0; o--) weeks.push(pgWeekStats(o));
  if (progressWeekOffset > 7) progressWeekOffset = 7;
  const wkCur = weeks[7 - progressWeekOffset];
  const wkPrev = progressWeekOffset < 7 ? weeks[6 - progressWeekOffset] : pgWeekStats(progressWeekOffset + 1);
  root.innerHTML = `
    ${pgWeekHtml(wkCur, wkPrev, stats.streak)}
    ${pgGroupsHtml(wkCur)}
    ${pgHeatHtml(wkCur)}
    ${pgHintsHtml(wkCur, wkPrev)}
    ${pgVolumeHtml(weeks)}
    ${pgRecordsHtml()}

    <div class="pg-card">
      <div class="pg-card-head">
        <h3>Übungen</h3>
        <div class="chip-row pg-ranges">${PROGRESS_RANGES.map(([k, l]) => `<button type="button" class="chip small ${k === progressRange ? 'active' : ''}" data-range="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="chip-row pg-source">
        <button type="button" class="chip ${progressSource === 'gym' ? 'active' : ''}" data-pg-source="gym">Gym</button>
        <button type="button" class="chip ${progressSource === 'board' ? 'active' : ''}" data-pg-source="board">Board</button>
      </div>
      ${exIds.length ? `<p class="pg-ex-current">${esc(progressExerciseName(progressExerciseId))}</p>` : ''}
      ${isNewPr ? `<div class="pg-pr-wrap">${slothFigure('flex', 'pg-pr-sloth')}<div class="pg-pr">Neuer Rekord: <b>${esc(pts[pts.length - 1].label)}</b></div></div>` : ''}
      ${headline}
      ${exIds.length ? progressLineChart('pg-ex', pts, pts.some((p) => p.e1) ? 'Geschätztes Maximalgewicht (1RM) je Training' : 'Bester Satz je Training') : `<div class="list-empty">${progressExerciseIds(progressSource).length ? 'In diesem Zeitraum nichts trainiert — längeren Zeitraum wählen.' : progressSource === 'board' ? 'Noch keine Board-Einheit gespeichert.' : 'Noch keine Gym-Sätze geloggt.'}</div>`}
      ${exIds.length && pts.length ? cycleLegendHtml() : ''}
      ${exIds.length ? progressOverviewHtml(exIds, days) : ''}
    </div>

    ${(() => {
      const best = fbMaxHangBest();
      return `<div class="pg-card pg-maxhang">
        <div class="pg-card-head"><h3>Max Hang</h3><span class="pg-muted">10 s · mittlere Kante</span></div>
        ${best ? `<div class="pg-hero"><span class="pg-hero-num up">${fmtKg(best.weight)}</span><span class="pg-hero-sub">bester Test · ${esc(fmtDayKey(best.date))}</span></div>
          <p class="pg-muted" style="margin:6px 0 0;">Neuer Test alle 4–6 Wochen. Max Hangs schlägt danach das passende Gewicht vor.</p>`
        : '<p class="pg-muted" style="margin:0;">Noch kein Test. Mach den „Max-Hang-Test“ unter Board → Programme: danach schlägt die App dein Trainingsgewicht vor.</p>'}
      </div>`;
    })()}

    <div class="pg-card">
      <div class="pg-card-head"><h3>Board · Hängezeit je Einheit</h3></div>
      ${progressLineChart('pg-fb', fbPts, 'Hängezeit je Einheit')}
      ${fbPts.length ? cycleLegendHtml() : ''}
    </div>

    ${cycleCardHtml()}

    <div class="pg-card">
      <div class="pg-card-head"><h3>Letzte 8 Wochen</h3><span class="pg-muted">Mo – So</span></div>
      ${progressWeekGridHtml()}
    </div>

    <div class="pg-card">
      <div class="pg-card-head"><h3>Erholung</h3><span class="pg-muted">seit letzter Belastung</span></div>
      ${progressRecoveryHtml()}
      <p class="pg-muted" style="margin:8px 0 0;">Grobe Richtwerte (Finger 72 h, Rumpf 36 h, sonst 48 h), nach lockeren Einheiten (RPE bis 5) kürzer, nach sehr harten länger. Kein medizinischer Rat.</p>
    </div>
  `;
  root.querySelectorAll('[data-range]').forEach((b) => { b.onclick = () => { progressRange = b.dataset.range; drawProgress(); }; });
  root.querySelectorAll('[data-wk]').forEach((b) => { b.onclick = () => { progressWeekOffset = Math.max(0, Math.min(7, progressWeekOffset + Number(b.dataset.wk))); drawProgress(); }; });
  root.querySelectorAll('[data-vol-metric]').forEach((b) => { b.onclick = () => { progressVolMetric = b.dataset.volMetric; drawProgress(); }; });
  root.querySelectorAll('[data-vol]').forEach((r) => {
    r.onclick = () => {
      const i = Number(r.dataset.vol), w = weeks[i], d = new Date(w.from);
      document.getElementById('pg-vol-readout').innerHTML = `<b>Woche ab ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.</b> · ${w.sets} Sätze · ${pgFmtMin(w.min)} · ${pgFmtKg(w.kg)}`;
    };
  });
  root.querySelectorAll('[data-heat]').forEach((z) => {
    z.onclick = () => {
      const y = window.scrollY;
      pgHeatSel = z.dataset.heat;
      drawProgress();
      window.scrollTo(0, y);
    };
  });
  wireCycleCard();
  root.querySelectorAll('[data-pg-source]').forEach((b) => {
    b.onclick = () => {
      progressSource = b.dataset.pgSource;
      try { localStorage.setItem(STORAGE_PREFIX + 'pg_source', progressSource); } catch (e) { /* ignorieren */ }
      progressExerciseId = null;
      drawProgress();
    };
  });
  root.querySelectorAll('[data-pg-ex]').forEach((b) => { b.onclick = () => { progressExerciseId = b.dataset.pgEx; drawProgress(); }; });
  const series = { 'pg-ex': pts, 'pg-fb': fbPts };
  root.querySelectorAll('.pg-hit').forEach((c) => {
    c.onclick = () => {
      const p = series[c.dataset.chart][Number(c.dataset.i)];
      const out = document.getElementById(`${c.dataset.chart}-readout`);
      if (out && p) out.innerHTML = `<b>${esc(fmtShortDate(p.date))}</b> · ${esc(p.label)}`;
    };
  });
}
