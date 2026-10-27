/* js/watch-import.js — Uhr-Daten (FIT-Datei, z. B. aus der Coros-App) an ein gespeichertes Training hängen.
   Weg 1: im Verlauf "⌚ Uhr-Datei" → Datei wählen. Weg 2: in der Coros-App "Teilen" → Pincho; der Service-Worker
   legt die Datei unter WATCH_SHARE_KEY im Cache ab (siehe sw.js, share_target in manifest.json), checkSharedWatchFile()
   holt sie nach dem Start ab. Gespeichert wird nur eine Zusammenfassung unter logs/{member}/{id}/watch:
   { device, start, durSec, kcal, hrAvg, hrMax, hrMin, load, hrStep, hr: [Puls je hrStep Sekunden] } */

const WATCH_SHARE_CACHE = 'pincho-share';
const WATCH_SHARE_KEY = 'shared-watch.fit';
const FIT_EPOCH_MS = 631065600000; // FIT zählt Sekunden ab 31.12.1989
const WATCH_HR_STEP = 10;
// Belastung nach Banister (TRIMP) mit Ruhepuls 60 / Maximalpuls 190 – trifft die Coros-Belastung gut (27 ↔ 29)
const WATCH_HR_REST = 60, WATCH_HR_MAX = 190;

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

function watchTrimp(hrSeries, stepSec) {
  return Math.round(hrSeries.reduce((s, h) => {
    const x = Math.max(0, (h - WATCH_HR_REST) / (WATCH_HR_MAX - WATCH_HR_REST));
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
    ${cell(w.load, 'Belastung ≈')}${cell(w.hrAvg, 'Ø Puls')}${cell(w.hrMax, 'Max')}${cell(w.kcal, 'kcal')}${cell(fmtMinSec(w.durSec), 'Uhr-Dauer')}
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
