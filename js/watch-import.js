/* js/watch-import.js — Uhr-Daten (FIT-Datei, z. B. aus der Coros-App) an ein gespeichertes Training hängen.
   Weg 1: im Verlauf "⌚ Uhr-Datei" → Datei wählen. Weg 2: in der Coros-App "Teilen" → Pincho; der Service-Worker
   legt die Datei unter WATCH_SHARE_KEY im Cache ab (siehe sw.js, share_target in manifest.json), checkSharedWatchFile()
   holt sie nach dem Start ab. Gespeichert wird nur eine Zusammenfassung unter logs/{member}/{id}/watch:
   { device, start, durSec, kcal, hrAvg, hrMax, hrMin, load, hrStep, hr: [Puls je hrStep Sekunden] } */

const WATCH_SHARE_CACHE = 'pincho-share';
const WATCH_SHARE_KEY = 'shared-watch.fit';
const FIT_EPOCH_MS = 631065600000; // FIT zählt Sekunden ab 31.12.1989
const WATCH_HR_STEP = 10;
// Ruhe-/Maximalpuls fürs Schätzen der Belastung und für die Zonen: im Konto einstellbar (members/{id}/hr), sonst 60/190
const WATCH_HR_DEFAULT = { rest: 60, max: 190 };
function hrSettings() {
  const h = (state.memberDoc && state.memberDoc.hr) || {};
  return { rest: Number(h.rest) || WATCH_HR_DEFAULT.rest, max: Number(h.max) || WATCH_HR_DEFAULT.max, custom: !!(h.rest || h.max) };
}

/* Minimaler FIT-Leser: nur die Nachrichten, die wir brauchen (0 Datei, 18 Session, 20 Messpunkte). */
function parseFit(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  if (buf.length < 14 || String.fromCharCode(buf[8], buf[9], buf[10], buf[11]) !== '.FIT') throw new Error('Keine FIT-Datei');
  const SIZE = { 0: 1, 1: 1, 2: 1, 7: 1, 10: 1, 13: 1, 0x83: 2, 0x84: 2, 0x8B: 2, 0x85: 4, 0x86: 4, 0x8C: 4, 0x88: 4 };
  const read = (bt, o, le) => {
    switch (bt) {
      case 1: return dv.getInt8(o);
      case 0x83: return dv.getInt16(o, le);
      case 0x84: case 0x8B: return dv.getUint16(o, le);
      case 0x85: return dv.getInt32(o, le);
      case 0x86: case 0x8C: return dv.getUint32(o, le);
      case 0x88: return dv.getFloat32(o, le);
      default: return dv.getUint8(o);
    }
  };
  const end = Math.min(buf.length, buf[0] + dv.getUint32(4, true));
  const defs = {};
  const out = { device: '', session: null, records: [] };
  let p = buf[0], lastTs = 0;
  while (p < end) {
    const h = buf[p++];
    let def, ts = null;
    if (h & 0x80) { // Kopf mit verkürztem Zeitstempel
      def = defs[(h >> 5) & 3];
      const off = h & 0x1f;
      ts = (lastTs & ~0x1f) + off + (off < (lastTs & 0x1f) ? 0x20 : 0);
    } else if (h & 0x40) { // Definition
      const le = buf[p + 1] === 0;
      const d = { g: dv.getUint16(p + 2, le), le, fields: [], dev: 0 };
      const n = buf[p + 4]; p += 5;
      for (let i = 0; i < n; i++, p += 3) d.fields.push([buf[p], buf[p + 1], buf[p + 2]]);
      if (h & 0x20) { const nd = buf[p++]; for (let i = 0; i < nd; i++, p += 3) d.dev += buf[p + 1]; }
      defs[h & 0xf] = d;
      continue;
    } else def = defs[h & 0xf];
    if (!def) throw new Error('Kaputte FIT-Datei');
    const f = {};
    for (const [num, size, bt] of def.fields) {
      if (bt === 7) f[num] = new TextDecoder().decode(buf.subarray(p, p + size)).replace(/\0[\s\S]*$/, '');
      else if (size === (SIZE[bt] || 1)) f[num] = read(bt, p, def.le);
      p += size;
    }
    p += def.dev;
    if (f[253] != null) lastTs = f[253]; else if (ts != null) { lastTs = ts; f[253] = ts; }
    if (def.g === 0 && f[8]) out.device = f[8];
    else if (def.g === 18) out.session = f;
    else if (def.g === 20 && f[3] && f[3] < 255) out.records.push([f[253], f[3]]);
  }
  return out;
}

// Belastung nach Banister (TRIMP); mit echtem Ruhe-/Maximalpuls nahe an der Coros-Belastung
function watchTrimp(hrSeries, stepSec) {
  const { rest, max } = hrSettings();
  return Math.round(hrSeries.reduce((s, h) => {
    const x = Math.max(0, (h - rest) / (max - rest));
    return s + (stepSec / 60) * x * 0.64 * Math.exp(1.92 * x);
  }, 0));
}

function summarizeFit(fit) {
  const s = fit.session || {};
  const recs = fit.records;
  if (!recs.length && !s[2]) throw new Error('Keine Aktivitätsdaten in der Datei');
  const t0 = s[2] != null ? s[2] : recs[0][0];
  const durSec = s[7] != null && s[7] !== 0xffffffff ? Math.round(s[7] / 1000) : (recs.length ? recs[recs.length - 1][0] - t0 : 0);
  // Puls auf ein festes Raster (alle WATCH_HR_STEP s) verdichten: Mittel je Fenster, Lücken mit dem letzten Wert
  const n = Math.max(1, Math.ceil(durSec / WATCH_HR_STEP));
  const sum = new Array(n).fill(0), cnt = new Array(n).fill(0);
  recs.forEach(([t, h]) => { const i = Math.floor((t - t0) / WATCH_HR_STEP); if (i >= 0 && i < n) { sum[i] += h; cnt[i]++; } });
  let last = recs.length ? recs[0][1] : 0;
  const hr = sum.map((v, i) => (last = cnt[i] ? Math.round(v / cnt[i]) : last));
  const all = recs.map((r) => r[1]);
  const valid = (v) => v != null && v !== 0xff && v !== 0xffff;
  return {
    device: fit.device || 'Uhr',
    start: FIT_EPOCH_MS + t0 * 1000,
    durSec,
    kcal: valid(s[11]) ? s[11] : null,
    hrAvg: valid(s[16]) ? s[16] : (all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null),
    hrMax: valid(s[17]) ? s[17] : (all.length ? Math.max(...all) : null),
    hrMin: all.length ? Math.min(...all) : null,
    load: recs.length ? watchTrimp(all, 1) : null,
    hrStep: WATCH_HR_STEP,
    hr: recs.length ? hr : [],
  };
}

/* Zeitfenster eines Trainings: Ende = Speichern, Anfang = Ende minus Trainingszeit */
function logTimeWindow(e) {
  const endT = e.createdAt || 0;
  return [endT - (e.totalSessionSec || e.totalWorkSec || 3600) * 1000, endT];
}
function watchMatchScore(w, e) {
  const [a, b] = logTimeWindow(e);
  return Math.min(b, w.start + w.durSec * 1000) - Math.max(a, w.start);
}

/* Auswahl, an welches Training die Uhr-Daten kommen. preselectId: aus dem Verlauf heraus schon bekannt. */
async function attachWatchFile(file, preselectId) {
  let w;
  try { w = summarizeFit(parseFit(await file.arrayBuffer())); } catch (err) { toast('Datei nicht lesbar: ' + err.message, 'err'); return; }
  const raw = await fbGet(`logs/${state.member.id}`);
  const entries = Object.entries(raw || {}).sort((x, y) => (y[1].createdAt || 0) - (x[1].createdAt || 0));
  if (!entries.length) { toast('Noch kein gespeichertes Training.', 'err'); return; }
  const ranked = entries.map(([id, e]) => ({ id, e, score: watchMatchScore(w, e) }));
  const best = ranked.filter((r) => r.score > 0).sort((x, y) => y.score - x.score)[0];
  // passt die Uhrzeit zu einem Training, gewinnt das – sonst das Training, bei dem man den Knopf gedrückt hat
  const choice = (best && best.id) || preselectId || entries[0][0];
  // zeitlich nächste Trainings zuerst (score: Überlappung, negativ = Abstand)
  const options = [...ranked].sort((x, y) => y.score - x.score).slice(0, 12);
  if (!options.some((r) => r.id === choice)) options.unshift(ranked.find((r) => r.id === choice));
  const d = new Date(w.start);
  const el = document.createElement('div');
  el.className = 'info-sheet-backdrop';
  el.id = 'watch-sheet';
  el.innerHTML = `
    <div class="info-sheet-card watch-sheet">
      <div class="fs-finish-head"><h3>⌚ Uhr-Daten</h3><button type="button" class="info-sheet-close" id="watch-close" aria-label="Schliessen">✕</button></div>
      <div class="watch-meta mono">${esc(w.device)} · ${d.toLocaleDateString('de-CH')} ${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</div>
      ${watchSummaryHtml(w)}
      ${watchChartHtml(w, null)}
      <label class="watch-label" for="watch-target">Zu diesem Training</label>
      <select id="watch-target">${options.map((r) => `<option value="${r.id}" ${r.id === choice ? 'selected' : ''}>${esc(fmtDayKey(r.e.date))} · ${esc(watchLogLabel(r.e))}${r.score > 0 ? ' ✓ passt zur Uhrzeit' : ''}</option>`).join('')}</select>
      ${!best ? '<div class="watch-warn">Kein Training passt zur Uhrzeit der Datei – bitte prüfen.</div>' : ''}
      <button type="button" class="btn" id="watch-save" style="width:100%;margin-top:12px;">Hinzufügen</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  wireSheetSwipeDown(el, close);
  document.getElementById('watch-close').onclick = close;
  document.getElementById('watch-save').onclick = async () => {
    const id = document.getElementById('watch-target').value;
    const ok = await fbPatch(`logs/${state.member.id}/${id}`, { watch: w });
    if (!ok) { toast('Konnte nicht speichern.', 'err'); return; }
    close();
    toast('Uhr-Daten hinzugefügt.', 'ok');
    if (state.route === 'log') renderLogHistory();
  };
}
function watchLogLabel(e) {
  const ex = (e.exercises || []).filter((x) => x.exerciseId !== 'warmup_general' && x.exerciseId !== 'cooldown_general');
  if (ex.length) return ex.slice(0, 2).map((x) => exerciseName(x.exerciseId)).join(', ') + (ex.length > 2 ? ` +${ex.length - 2}` : '');
  return (e.type || 'Training').toUpperCase();
}

function watchSummaryHtml(w) {
  const cell = (v, l) => (v != null ? `<div><b>${v}</b><span>${l}</span></div>` : '');
  return `<div class="watch-sum mono">
    ${cell(watchLoad(w), 'Belastung ≈')}${cell(w.hrAvg, 'Ø Puls')}${cell(w.hrMax, 'Max')}${cell(w.kcal, 'kcal')}${cell(fmtMinSec(w.durSec), 'Uhr-Dauer')}
  </div>`;
}

/* Pulskurve als SVG, optional mit Strichen für die Sätze (nur bei Sätzen mit Uhrzeit "at") */
function watchChartHtml(w, exercises) {
  if (!w.hr || w.hr.length < 2) return '';
  const W = 320, H = 90, lo = Math.min(...w.hr) - 5, hi = Math.max(...w.hr) + 5;
  const x = (i) => (i / (w.hr.length - 1)) * W;
  const y = (h) => H - ((h - lo) / (hi - lo)) * H;
  const pts = w.hr.map((h, i) => `${x(i).toFixed(1)},${y(h).toFixed(1)}`).join(' ');
  let marks = '';
  (exercises || []).forEach((ex) => (ex.sets || []).forEach((s) => {
    if (!s.at) return;
    const t = (s.at - w.start) / 1000, t0 = t - (s.elapsedSec || 0);
    if (t < 0 || t0 > w.durSec) return;
    const sx = (Math.max(0, t0) / w.durSec) * W, ex2 = (Math.min(w.durSec, t) / w.durSec) * W;
    marks += `<rect class="watch-set" x="${sx.toFixed(1)}" y="0" width="${Math.max(2, ex2 - sx).toFixed(1)}" height="${H}"/>`;
  }));
  return `<svg class="watch-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Pulskurve">${marks}<polyline points="${pts}"/></svg>
    ${marks ? '<div class="watch-axis mono">Pulskurve · blaue Balken = Sätze</div>' : '<div class="watch-axis mono">Pulskurve</div>'}`;
}

/* Puls je Satz (Mittel über die Satzdauer) für die Verlaufskarte */
function watchSetHr(w, set) {
  if (!w || !w.hr || !set.at) return null;
  const t = (set.at - w.start) / 1000, t0 = t - (set.elapsedSec || 0);
  const i0 = Math.max(0, Math.floor(t0 / w.hrStep)), i1 = Math.min(w.hr.length - 1, Math.ceil(t / w.hrStep));
  if (i1 < i0 || i0 >= w.hr.length) return null;
  return Math.max(...w.hr.slice(i0, i1 + 1));
}

function watchExerciseHrText(w, ex) {
  const hrs = (ex.sets || []).map((st) => watchSetHr(w, st)).filter((v) => v != null);
  return hrs.length ? ` · ♥ ${Math.max(...hrs)}` : '';
}

/* ---------- Auswertung ---------- */
// Belastung immer mit den aktuellen Puls-Einstellungen aus der gespeicherten Kurve (gespeichertes load nur als Ersatz)
function watchLoad(w) {
  return w.hr && w.hr.length ? watchTrimp(w.hr, w.hrStep) : w.load;
}
const HR_ZONES = [
  { name: 'Z1', label: 'Erholung', from: 0, color: '#5b7a99' },
  { name: 'Z2', label: 'Grundlage', from: 0.6, color: '#4fb6ee' },
  { name: 'Z3', label: 'Aerob', from: 0.7, color: '#4caf6e' },
  { name: 'Z4', label: 'Schwelle', from: 0.8, color: '#f0a35a' },
  { name: 'Z5', label: 'Maximal', from: 0.9, color: '#ff5a4a' },
];
function hrZoneIndex(h, max) {
  const r = h / max;
  for (let z = HR_ZONES.length - 1; z >= 0; z--) if (r >= HR_ZONES[z].from) return z;
  return 0;
}
// Sekunden je Zone
function watchZoneSeconds(w) {
  const { max } = hrSettings();
  const out = HR_ZONES.map(() => 0);
  (w.hr || []).forEach((h) => { out[hrZoneIndex(h, max)] += w.hrStep; });
  return out;
}
/* Sätze mit Uhrzeit auf der Kurve: Ø/Max-Puls im Satz und Erholung = Spitze am Satzende minus Puls 60 s später
   (nur wenn in der Minute kein neuer Satz beginnt) */
function watchSetStats(w, exercises) {
  if (!w || !w.hr || !w.hr.length) return [];
  const sets = [];
  (exercises || []).forEach((ex) => (ex.sets || []).forEach((st, si) => {
    if (!st.at) return;
    const t1 = (st.at - w.start) / 1000, t0 = t1 - (st.elapsedSec || 0);
    if (t1 < 0 || t0 > w.durSec) return;
    sets.push({ exerciseId: ex.exerciseId, si, t0: Math.max(0, t0), t1 });
  }));
  sets.sort((a, b) => a.t0 - b.t0);
  const at = (t) => w.hr[Math.max(0, Math.min(w.hr.length - 1, Math.round(t / w.hrStep)))];
  return sets.map((st, i) => {
    const win = [];
    for (let t = st.t0; t <= st.t1 + w.hrStep / 2; t += w.hrStep) win.push(at(t));
    const peak = Math.max(at(st.t1), at(st.t1 + 10), ...win);
    const next = sets[i + 1];
    const rec = (!next || next.t0 >= st.t1 + 60) && st.t1 + 60 <= w.durSec ? peak - at(st.t1 + 60) : null;
    return { ...st, hrAvg: Math.round(win.reduce((a, b) => a + b, 0) / win.length), hrMax: Math.max(...win, at(st.t1 + 10)), rec };
  });
}
// pro Übung zusammengefasst, in Trainings-Reihenfolge
function watchExerciseStats(w, exercises) {
  const by = [];
  watchSetStats(w, exercises).forEach((st) => {
    let row = by.find((r) => r.exerciseId === st.exerciseId);
    if (!row) by.push(row = { exerciseId: st.exerciseId, sets: [] });
    row.sets.push(st);
  });
  return by.map((r) => {
    const recs = r.sets.map((x) => x.rec).filter((v) => v != null);
    return { exerciseId: r.exerciseId, n: r.sets.length, hrAvg: Math.round(r.sets.reduce((a, x) => a + x.hrAvg, 0) / r.sets.length),
      hrMax: Math.max(...r.sets.map((x) => x.hrMax)), rec: recs.length ? Math.round(recs.reduce((a, b) => a + b, 0) / recs.length) : null };
  });
}
// Pulsabfall als Zahl mit Vorzeichen (−12 = um 12 gefallen; + = noch gestiegen)
function fmtRec(v) { return v == null ? '–' : v >= 0 ? '−' + v : '+' + -v; }
function watchZoneBarHtml(w) {
  const z = watchZoneSeconds(w), total = z.reduce((a, b) => a + b, 0) || 1;
  return `<div class="watch-zones">${z.map((sec, i) => sec ? `<span style="flex:${sec};background:${HR_ZONES[i].color}" title="${HR_ZONES[i].name}"></span>` : '').join('')}</div>
    <div class="watch-zone-legend mono">${z.map((sec, i) => sec ? `<span><i style="background:${HR_ZONES[i].color}"></i>${HR_ZONES[i].name} ${Math.round(sec / 60)}′</span>` : '').join('')}</div>`;
}

/* ---------- Detailansicht: grosse Kurve mit Zonen, Zeitachse, Fingerfahren, Tabelle je Übung ---------- */
function openWatchDetail(entry) {
  const w = entry.watch;
  if (!w || !w.hr || w.hr.length < 2) return;
  const { max } = hrSettings();
  const W = 640, H = 220, lo = Math.max(40, Math.min(...w.hr) - 8), hi = Math.max(...w.hr) + 8;
  const x = (t) => (t / w.durSec) * W;
  const y = (h) => H - ((Math.min(hi, Math.max(lo, h)) - lo) / (hi - lo)) * H;
  const bands = HR_ZONES.map((z, i) => {
    const top = i < HR_ZONES.length - 1 ? HR_ZONES[i + 1].from * max : hi;
    const bot = z.from * max;
    if (top <= lo || bot >= hi) return '';
    return `<rect x="0" y="${y(top).toFixed(1)}" width="${W}" height="${(y(bot) - y(top)).toFixed(1)}" fill="${z.color}" opacity=".10"/>`;
  }).join('');
  const sets = watchSetStats(w, entry.exercises);
  let lastEx = null;
  const setRects = sets.map((st) => {
    const label = st.exerciseId !== lastEx ? `<text x="${(x(st.t0) + 2).toFixed(1)}" y="12" class="watch-set-label">${esc(exerciseName(st.exerciseId).slice(0, 14))}</text>` : '';
    lastEx = st.exerciseId;
    return `<rect class="watch-set" x="${x(st.t0).toFixed(1)}" y="0" width="${Math.max(3, x(st.t1) - x(st.t0)).toFixed(1)}" height="${H}"/>${label}`;
  }).join('');
  const ticks = [];
  for (let m = 10; m * 60 < w.durSec; m += 10) ticks.push(`<line x1="${x(m * 60).toFixed(1)}" x2="${x(m * 60).toFixed(1)}" y1="${H}" y2="${H - 6}" class="watch-tick"/><text x="${x(m * 60).toFixed(1)}" y="${H + 14}" class="watch-tick-label">${m}′</text>`);
  const pts = w.hr.map((h, i) => `${x(i * w.hrStep).toFixed(1)},${y(h).toFixed(1)}`).join(' ');
  const rows = watchExerciseStats(w, entry.exercises);
  const d = new Date(w.start);
  const el = document.createElement('div');
  el.className = 'info-sheet-backdrop';
  el.id = 'watch-detail';
  el.innerHTML = `
    <div class="info-sheet-card watch-detail">
      <div class="fs-finish-head"><h3>Puls · ${esc(fmtDayKey(entry.date))}</h3><button type="button" class="info-sheet-close" id="watch-detail-close" aria-label="Schliessen">✕</button></div>
      <div class="watch-meta mono">${esc(w.device)} · Start ${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} · Maximalpuls ${max}${hrSettings().custom ? '' : ' (Standard)'}</div>
      ${watchSummaryHtml(w)}
      <div class="watch-scrub mono" id="watch-scrub">Mit dem Finger über die Kurve fahren</div>
      <svg class="watch-big" id="watch-big" viewBox="0 -2 ${W} ${H + 20}" preserveAspectRatio="none">
        ${bands}${setRects}<polyline points="${pts}"/>${ticks.join('')}
        <line id="watch-cursor" x1="0" x2="0" y1="0" y2="${H}" class="watch-cursor" visibility="hidden"/>
      </svg>
      ${watchZoneBarHtml(w)}
      ${rows.length ? `<table class="watch-table"><thead><tr><th>Übung</th><th>Sätze</th><th>Ø</th><th>Max</th><th>Erholung</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(exerciseName(r.exerciseId))}</td><td class="mono">${r.n}</td><td class="mono">${r.hrAvg}</td><td class="mono">${r.hrMax}</td><td class="mono">${fmtRec(r.rec)}</td></tr>`).join('')}
      </tbody></table><p class="watch-note">Erholung: wie stark der Puls 60 s nach dem Satz gefallen ist. Mehr = besser erholt.</p>`
        : '<p class="watch-note">Puls je Übung gibt es für Trainings, bei denen Pincho die Uhrzeit der Sätze kennt (ab Ende Oktober 2026).</p>'}
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  document.getElementById('watch-detail-close').onclick = close;
  const svg = document.getElementById('watch-big'), cur = document.getElementById('watch-cursor'), out = document.getElementById('watch-scrub');
  const scrub = (e) => {
    const r = svg.getBoundingClientRect();
    const t = Math.max(0, Math.min(w.durSec, ((e.clientX - r.left) / r.width) * w.durSec));
    const h = w.hr[Math.min(w.hr.length - 1, Math.round(t / w.hrStep))];
    const st = sets.find((s2) => t >= s2.t0 - 5 && t <= s2.t1 + 5);
    const clock = new Date(w.start + t * 1000).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    cur.setAttribute('x1', x(t)); cur.setAttribute('x2', x(t)); cur.setAttribute('visibility', 'visible');
    out.textContent = `${clock} · ${h} bpm · ${HR_ZONES[hrZoneIndex(h, max)].name}${st ? ` · ${exerciseName(st.exerciseId)} Satz ${st.si + 1}` : ''}`;
  };
  svg.addEventListener('pointerdown', scrub);
  svg.addEventListener('pointermove', scrub);
}

/* ---------- Tab Fortschritt: Belastung und Zonen je Woche, Erholungs-Trend ---------- */
function pgPulseHtml(weeks) {
  const withWatch = (state.logs || []).filter((e) => e.watch && e.watch.hr && e.watch.hr.length);
  if (!withWatch.length) return '';
  const wk = weeks.map((w) => {
    const es = withWatch.filter((e) => e.watch.start >= w.from && e.watch.start < w.from + 7 * 86400000);
    const zones = HR_ZONES.map(() => 0);
    es.forEach((e) => watchZoneSeconds(e.watch).forEach((sec, i) => { zones[i] += sec / 60; }));
    return { from: w.from, load: es.reduce((a, e) => a + (watchLoad(e.watch) || 0), 0), zones, n: es.length };
  });
  const maxMin = Math.max(1, ...wk.map((w) => w.zones.reduce((a, b) => a + b, 0))) * 1.15;
  const W = 340, H = 150, padB = 20, slot = W / wk.length, bw = slot - 10;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="pg-vol" role="img" aria-label="Pulszonen und Belastung je Woche">`;
  wk.forEach((w, i) => {
    const x = i * slot + 5;
    let base = H - padB;
    w.zones.forEach((m, z) => {
      if (!m) return;
      const h = (m / maxMin) * (H - padB - 18);
      base -= h;
      svg += `<rect x="${x}" y="${base.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" fill="${HR_ZONES[z].color}"/>`;
    });
    if (w.load) svg += `<text x="${x + bw / 2}" y="${(base - 4).toFixed(1)}" text-anchor="middle" class="pg-pulse-load">${w.load}</text>`;
    const d = new Date(w.from);
    svg += `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" class="pg-vol-axis">${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.</text>`;
  });
  svg += `<line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="var(--line-soft)"/></svg>`;
  // letzte 7 Tage gegen den Wochenschnitt der 28 Tage davor (gleitend, damit ein Montag nicht "zu wenig" meldet)
  const now = Date.now(), DAY = 86400000;
  const sumLoad = (a, b) => withWatch.filter((e) => e.watch.start >= a && e.watch.start < b).reduce((t, e) => t + (watchLoad(e.watch) || 0), 0);
  const cur = sumLoad(now - 7 * DAY, now), avg4 = Math.round(sumLoad(now - 35 * DAY, now - 7 * DAY) / 4);
  const ratio = avg4 ? cur / avg4 : null;
  const loadHint = ratio == null ? '' : ratio > 1.5 ? ' – deutlich mehr als sonst, auf Erholung achten' : ratio < 0.7 ? ' – weniger als sonst' : ' – im üblichen Rahmen';
  // Erholungs-Trend: Ø Pulsabfall je Training (nur Trainings mit Satz-Uhrzeiten)
  const recs = withWatch.slice().sort((a, b) => a.watch.start - b.watch.start).map((e) => {
    const r = watchSetStats(e.watch, e.exercises).map((x) => x.rec).filter((v) => v != null);
    return r.length ? { date: e.date, rec: r.reduce((a, b) => a + b, 0) / r.length } : null;
  }).filter(Boolean).slice(-10);
  let recHtml = '<p class="pg-muted">Erholungs-Trend: kommt, sobald Trainings mit Satz-Uhrzeit Uhr-Daten haben.</p>';
  if (recs.length) {
    const hiR = Math.max(...recs.map((r) => r.rec)) + 3, loR = Math.max(0, Math.min(...recs.map((r) => r.rec)) - 3);
    const RW = 340, RH = 60, rx = (i) => recs.length === 1 ? RW / 2 : 8 + (i / (recs.length - 1)) * (RW - 16), ry = (v) => RH - 6 - ((v - loR) / (hiR - loR || 1)) * (RH - 12);
    const last3 = recs.slice(-3), before = recs.slice(0, -3);
    const avg = (a) => Math.round(a.reduce((s, r) => s + r.rec, 0) / a.length);
    recHtml = `<svg viewBox="0 0 ${RW} ${RH}" class="pg-vol" role="img" aria-label="Erholung je Training">
        <polyline points="${recs.map((r, i) => `${rx(i).toFixed(1)},${ry(r.rec).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>
        ${recs.map((r, i) => `<circle cx="${rx(i).toFixed(1)}" cy="${ry(r.rec).toFixed(1)}" r="3.5" fill="var(--accent)"/>`).join('')}
      </svg>
      <p class="pg-readout">Erholung (Pulsabfall 60 s nach dem Satz): zuletzt Ø ${fmtRec(avg(last3))} bpm${before.length ? `, davor Ø ${fmtRec(avg(before))} bpm` : ''}. Mehr = fitter.</p>`;
  }
  return `
    <div class="pg-card">
      <div class="pg-card-head"><h3>Puls &amp; Belastung</h3></div>
      ${svg}
      <div class="watch-zone-legend mono">${HR_ZONES.map((z) => `<span><i style="background:${z.color}"></i>${z.name} ${z.label}</span>`).join('')}</div>
      <p class="pg-readout">Letzte 7 Tage Belastung ${cur}${avg4 ? ` · Ø je Woche davor ${avg4}${loadHint}` : ''}. Zahl über dem Balken = Belastung, Höhe = Minuten in den Zonen.</p>
      <h4 class="pg-sub">Erholung</h4>
      ${recHtml}
    </div>`;
}

/* Nach dem Start: über "Teilen" geschickte Datei abholen (einmalig) */
async function checkSharedWatchFile() {
  if (!('caches' in window) || !state.member) return;
  try {
    const cache = await caches.open(WATCH_SHARE_CACHE);
    const key = new URL(WATCH_SHARE_KEY, location.href).href;
    const res = await cache.match(key);
    if (!res) return;
    await cache.delete(key);
    await attachWatchFile(await res.blob());
  } catch (e) { /* kein Cache-Zugriff – egal */ }
}
