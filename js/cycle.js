/* js/cycle.js — Fortschritt: Zyklus (freiwillig) – Phasen, Vergleich, Wissen, Konto-Karte */
/* ---------- Zyklus (freiwillig, nur für die Person selbst) ----------
   Gespeichert privat unter cycle/{memberId}: {consentAt, starts:{'YYYY-MM-DD':true}}.
   Eingetragen wird nur der erste Tag jeder Periode; Phasen und die nächste
   Periode sind eine einfache Schätzung daraus (Eisprung ~14 Tage vor der
   nächsten Periode), kein medizinischer Rat. */
const CYCLE_PERIOD_DAYS = 5;
const CYCLE_DEFAULT_LEN = 28;
const CYCLE_PHASES = {
  mens: { label: 'Menstruation', color: '#e5484d' },
  foll: { label: 'Follikelphase', color: '#3fb68b' },
  ovu: { label: 'Eisprung', color: '#e6b422' },
  lut: { label: 'Lutealphase', color: '#9b7be6' },
};
const DAY_MS = 86400000;
let cycleData = null; // null = aus/noch nicht geladen

function dayStart(key) { return new Date(key + 'T00:00').getTime(); }
function cycleStarts() {
  return Object.keys((cycleData && cycleData.starts) || {}).sort();
}
/* Ø Zykluslänge aus den letzten (max. 6) plausiblen Abständen. */
function cycleAvgLen() {
  const s = cycleStarts();
  const lens = [];
  for (let i = 1; i < s.length; i++) {
    const d = Math.round((dayStart(s[i]) - dayStart(s[i - 1])) / DAY_MS);
    if (d >= 20 && d <= 45) lens.push(d);
  }
  const recent = lens.slice(-6);
  return recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : CYCLE_DEFAULT_LEN;
}
/* Phase an Zyklustag `day` (1-basiert) bei Länge `len`. */
function cyclePhaseOf(day, len) {
  if (day <= CYCLE_PERIOD_DAYS) return 'mens';
  const ovu = len - 14;
  if (day >= ovu - 1 && day <= ovu + 1) return 'ovu';
  return day < ovu ? 'foll' : 'lut';
}
/* Phasen-Abschnitte [{from, to, phase}] (ms) über alle eingetragenen
   Zyklen; der letzte läuft mit der Ø-Länge bis zur geschätzten nächsten Periode. */
function cycleSegments() {
  const s = cycleStarts();
  const avg = cycleAvgLen();
  const segs = [];
  s.forEach((key, i) => {
    const start = dayStart(key);
    const next = s[i + 1] ? dayStart(s[i + 1]) : start + avg * DAY_MS;
    const len = Math.max(1, Math.round((next - start) / DAY_MS));
    for (let d = 1; d <= len; d++) {
      const phase = cyclePhaseOf(d, len);
      const from = start + (d - 1) * DAY_MS;
      const last = segs[segs.length - 1];
      if (last && last.phase === phase && last.to === from) last.to = from + DAY_MS;
      else segs.push({ from, to: from + DAY_MS, phase });
    }
  });
  return segs;
}
/* Heute: Zyklustag, Phase, nächste Periode (Schätzung). */
function cycleToday() {
  const s = cycleStarts();
  if (!s.length) return null;
  const today = dayStart(dayKey(new Date()));
  const last = dayStart(s[s.length - 1]);
  if (today < last) return null;
  const avg = cycleAvgLen();
  const day = Math.round((today - last) / DAY_MS) + 1;
  const next = last + avg * DAY_MS;
  return { day, phase: day > avg ? null : cyclePhaseOf(day, avg), next, inDays: Math.round((next - today) / DAY_MS), avg };
}

/* Farbige Bänder hinter einem Diagramm (x = Zeit → Pixel). */
function cycleBandsSvg(x, t0, t1, top, bottom) {
  if (!cycleData || !cycleStarts().length) return '';
  const lo = t0 === t1 ? t0 - DAY_MS : t0, hi = t0 === t1 ? t1 + DAY_MS : t1;
  return cycleSegments().filter((g) => g.to > lo && g.from < hi).map((g) => {
    const a = x(Math.max(g.from, lo)), b = x(Math.min(g.to, hi));
    return `<rect class="pg-cycle-band" x="${a.toFixed(1)}" y="${top}" width="${Math.max(1, b - a).toFixed(1)}" height="${bottom - top}" fill="${CYCLE_PHASES[g.phase].color}"><title>${CYCLE_PHASES[g.phase].label}</title></rect>`;
  }).join('');
}
function cycleLegendHtml() {
  if (!cycleData || !cycleStarts().length) return '';
  return `<div class="pg-legend pg-cycle-legend">${Object.values(CYCLE_PHASES).map((p) => `<span><i style="background:${p.color}"></i>${p.label}</span>`).join('')}</div>`;
}

function fmtDayLong(ms) {
  const d = new Date(ms);
  return `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
}

/* Wissen pro Phase — bewusst vorsichtig formuliert: Die Studienlage zu
   Leistung und Zyklus ist dünn und uneinheitlich (Quellen in CYCLE_SOURCES). */
const CYCLE_INFO = {
  mens: {
    tip: 'Nach Befinden trainieren — im Schnitt ist die Leistung höchstens minimal tiefer, Beschwerden sind aber sehr individuell.',
    body: 'Östrogen und Progesteron sind tief.',
    science: 'Eine grosse Meta-Analyse fand in der frühen Follikelphase (während der Periode) höchstens eine sehr kleine Leistungsminderung — mit grossen Unterschieden zwischen Personen [1].',
    practice: 'Einheiten nach Krämpfen/Müdigkeit anpassen statt nach Kalender. Starke Blutungen sind bei Sportlerinnen häufig (rund ein Drittel) und erhöhen das Risiko für Eisenmangel [4] — bei anhaltender Müdigkeit Eisenwerte ärztlich prüfen lassen.',
  },
  foll: {
    tip: 'Normal nach Plan trainieren — ein fester Kraftvorteil in dieser Phase ist nicht belegt.',
    body: 'Östrogen steigt bis kurz vor dem Eisprung an.',
    science: 'Ein Überblick über alle Meta-Analysen fand keinen verlässlichen Einfluss der Zyklusphase auf Maximalkraft oder Muskelaufbau; die Studien sind meist klein und von geringer Qualität [2].',
    practice: 'Fühlst du dich stark, ist das ein guter Moment für harte Einheiten — dein Gefühl ist hier aussagekräftiger als die Phase.',
  },
  ovu: {
    tip: 'Nichts Besonderes nötig — die Leistung ändert sich um den Eisprung nicht verlässlich.',
    body: 'Östrogen erreicht seinen Höhepunkt, kurz darauf folgt der Eisprung.',
    science: 'Eine Übersicht nur über methodisch hochwertige Studien findet meist keine Phasen-Unterschiede bei Kraft, Schnellkraft und Ausdauer [3].',
    practice: 'Normal trainieren. Wann genau der Eisprung ist, schätzt die App nur grob.',
  },
  lut: {
    tip: 'Körpertemperatur ist leicht erhöht — bei Wärme mehr trinken und Pausen einplanen.',
    body: 'Progesteron ist hoch; die Körpertemperatur liegt etwa 0,3–0,7 °C höher.',
    science: 'Eine Meta-Analyse zeigt eine höhere Körperkerntemperatur in der Lutealphase, vor und nach Belastung in der Wärme [5]. Auf Kraft und Leistung gibt es keinen verlässlichen Effekt [2][3].',
    practice: 'In warmen Hallen/Sommer auf Trinken und Pausen achten. Vor der Periode (PMS) kann das Befinden schwanken — Einheiten flexibel halten.',
  },
};
const CYCLE_SOURCES = [
  ['McNulty et al. (2020), Sports Medicine — Meta-Analyse Leistung & Zyklusphase', 'https://doi.org/10.1007/s40279-020-01319-3'],
  ['Colenso-Semple et al. (2023), Frontiers in Sports and Active Living — Kraft & Muskelaufbau', 'https://doi.org/10.3389/fspor.2023.1054542'],
  ['Systematische Übersicht hochwertiger Studien (2025), Journal of Applied Physiology', 'https://journals.physiology.org/doi/full/10.1152/japplphysiol.00223.2025'],
  ['Bruinvels et al. (2016), PLOS One — starke Blutungen bei Sportlerinnen', 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0149881'],
  ['Giersch et al. (2020), J Sci Med Sport — Zyklus & Temperatur bei Belastung in der Wärme', 'https://doi.org/10.1016/j.jsams.2020.05.014'],
];

function cycleLearnHtml(current) {
  const order = ['mens', 'foll', 'ovu', 'lut'];
  return `<details class="pg-cycle-more pg-cycle-learn">
    <summary>Mehr erfahren: Training &amp; Zyklus</summary>
    <p class="pg-muted" style="margin:0 0 10px;">Kurz gesagt: Die Forschung findet im Schnitt kaum Leistungsunterschiede zwischen den Phasen, aber grosse Unterschiede zwischen Personen. Empfohlen wird deshalb, <b>auf die eigenen Daten und das eigene Befinden</b> zu achten statt nach festen Phasen-Regeln zu trainieren [1][2].</p>
    ${order.map((k) => `
      <div class="pg-cycle-phase ${k === current ? 'current' : ''}">
        <p class="pg-cycle-phase-title"><i style="background:${CYCLE_PHASES[k].color}"></i>${CYCLE_PHASES[k].label}${k === current ? ' · jetzt' : ''}</p>
        <p><b>Körper:</b> ${CYCLE_INFO[k].body}</p>
        <p><b>Studien:</b> ${CYCLE_INFO[k].science}</p>
        <p><b>Praxis:</b> ${CYCLE_INFO[k].practice}</p>
      </div>`).join('')}
    <p class="pg-cycle-phase-title">Quellen</p>
    <ol class="pg-cycle-sources">${CYCLE_SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ol>
  </details>`;
}

/* Persönlicher Vergleich: jede Einheit relativ zum eigenen Niveau in den
   ±4 Wochen darum (gleiche Übung bzw. Hängezeit) — so verfälscht der
   normale Trainingsfortschritt den Vergleich nicht. Dann Mittel pro Phase. */
const CYCLE_MIN_PER_PHASE = 3;
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function relativeScores() {
  const series = {}; // key -> [{t, v}]
  const add = (key, t, v) => { if (v > 0) (series[key] = series[key] || []).push({ t, v }); };
  state.logs.forEach((e) => (e.exercises || []).forEach((ex) => {
    if (!Array.isArray(ex.sets) || !ex.sets.length || ['warmup_general', 'cooldown_general'].includes(ex.exerciseId)) return;
    const best = bestSetOf(ex.exerciseId, ex.sets);
    if (best) add('ex:' + ex.exerciseId, entryTime(e), best.value);
  }));
  progressFbSessions.forEach((sn) => {
    add('fb', entryTime(sn), fbSessionHangSeconds(sn));
    Object.entries(boardExerciseSets(sn)).forEach(([id, sets]) => {
      const best = bestSetOf(id === PG_BLOCK_ID ? 'x' : id, sets);
      if (best) add('bx:' + id, entryTime(sn), best.value);
    });
  });
  const perSession = {}; // Tag -> [ratios]
  Object.values(series).forEach((pts) => pts.forEach((p) => {
    const near = pts.filter((q) => q !== p && Math.abs(q.t - p.t) <= 28 * DAY_MS).map((q) => q.v);
    if (near.length < 2) return;
    const k = dayKey(new Date(p.t));
    (perSession[k] = perSession[k] || []).push(p.v / median(near));
  }));
  return Object.entries(perSession).map(([k, r]) => ({ t: dayStart(k) + DAY_MS / 2, ratio: r.reduce((a, b) => a + b, 0) / r.length }));
}
function cyclePhaseAt(t) {
  const g = cycleSegments().find((s) => t >= s.from && t < s.to);
  return g ? g.phase : null;
}
function cycleCompareHtml() {
  const today = Date.now();
  const byPhase = { mens: [], foll: [], ovu: [], lut: [] };
  relativeScores().forEach((s) => {
    if (s.t > today) return;
    const ph = cyclePhaseAt(s.t);
    if (ph) byPhase[ph].push(s.ratio);
  });
  const total = Object.values(byPhase).reduce((a, b) => a + b.length, 0);
  const rows = Object.entries(byPhase).map(([k, r]) => {
    const enough = r.length >= CYCLE_MIN_PER_PHASE;
    const pct = enough ? Math.round((r.reduce((a, b) => a + b, 0) / r.length - 1) * 100) : null;
    const w = enough ? Math.min(50, Math.abs(pct) * 5) : 0; // 10 % = volle Halbbreite
    return `<div class="pg-cmp-row">
      <span class="pg-cmp-label"><i style="background:${CYCLE_PHASES[k].color}"></i>${CYCLE_PHASES[k].label}</span>
      <span class="pg-cmp-bar">${enough ? `<span style="${pct >= 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:${CYCLE_PHASES[k].color}"></span>` : ''}</span>
      <span class="pg-cmp-val">${enough ? `${pct > 0 ? '+' : ''}${pct} %` : `${r.length}/${CYCLE_MIN_PER_PHASE}`}</span>
    </div>`;
  }).join('');
  return `<div class="pg-cmp">
    <p class="pg-cycle-phase-title">Deine Leistung nach Phase</p>
    ${rows}
    <p class="pg-muted" style="margin:6px 0 0;">Jede Einheit im Vergleich zu deinem Niveau in den Wochen davor/danach (${total} Einheiten). Ab ${CYCLE_MIN_PER_PHASE} Einheiten pro Phase erscheint ein Wert; bei wenigen Einheiten kann ein Unterschied auch Zufall sein.</p>
  </div>`;
}

function cycleCardHtml() {
  if (!cycleData) return ''; // aus: im Fortschritt gar nicht sichtbar (Ein-/Ausschalten unter KONTO)
  const t = cycleToday();
  const starts = cycleStarts();
  const todayKey = dayKey(new Date());
  let now = '<p class="pg-muted" style="margin:0 0 12px;">Trag den ersten Tag deiner letzten Periode ein.</p>';
  if (t) {
    const nextTxt = t.inDays > 0 ? `in ${t.inDays} ${t.inDays === 1 ? 'Tag' : 'Tagen'}` : t.inDays === 0 ? 'heute' : `seit ${-t.inDays} ${t.inDays === -1 ? 'Tag' : 'Tagen'} erwartet`;
    now = `<div class="pg-hero"><span class="pg-hero-num" style="color:${t.phase ? CYCLE_PHASES[t.phase].color : 'var(--ink)'}">Tag ${t.day}</span><span class="pg-hero-sub">${t.phase ? CYCLE_PHASES[t.phase].label : 'Periode überfällig?'}</span></div>
      <p class="pg-muted" style="margin:0 0 12px;">Nächste Periode ca. <b>${fmtDayLong(t.next)}</b> (${nextTxt}) · Ø ${t.avg} Tage</p>
      ${t.phase ? `<p class="pg-cycle-tip" style="border-color:${CYCLE_PHASES[t.phase].color}">${CYCLE_INFO[t.phase].tip}</p>` : ''}`;
  }
  return `<div class="pg-card" id="pg-cycle">
    <div class="pg-card-head"><h3>Zyklus</h3><span class="pg-muted">nur für dich</span></div>
    ${now}
    ${starts.includes(todayKey) ? '' : '<button class="btn small" id="cycle-today">Periode hat heute begonnen</button>'}
    ${starts.length ? cycleCompareHtml() : ''}
    ${cycleLearnHtml(t && t.phase)}
    <details class="pg-cycle-more pg-cycle-entries">
      <summary>Einträge &amp; Einstellungen</summary>
      <div class="field-row pg-cycle-add">
        <div class="field"><label>Periodenbeginn nachtragen</label><input type="date" id="cycle-date" max="${todayKey}" value="${todayKey}"></div>
        <button class="btn ghost small" id="cycle-add">Eintragen</button>
      </div>
      <div class="chip-row">${starts.slice().reverse().map((k) => `<span class="chip small">${esc(fmtShortDate(k))} <button type="button" class="chip-x" data-cycle-del="${esc(k)}" aria-label="${esc(fmtShortDate(k))} löschen">×</button></span>`).join('') || '<span class="pg-muted">Noch keine Einträge.</span>'}</div>
      <p class="pg-muted" style="margin:10px 0 0;">Ausschalten &amp; alle Zyklusdaten löschen: unter KONTO.</p>
    </details>
    <p class="pg-muted" style="margin:10px 0 0;">Schätzung aus deinen Einträgen — kein medizinischer Rat und keine Verhütungsmethode.</p>
  </div>`;
}

async function cycleEnable() {
  if (!confirm('Zyklusdaten sind Gesundheitsdaten. Sie werden in deinem privaten Bereich gespeichert, den nur du sehen kannst (nicht die Crew). Du kannst sie jederzeit löschen. Einverstanden?')) return false;
  cycleData = { consentAt: Date.now() };
  await fbPut(`cycle/${state.member.id}`, cycleData);
  return true;
}
async function cycleDisable() {
  if (!confirm('Zyklus-Tracking ausschalten und alle Zyklusdaten endgültig löschen?')) return false;
  cycleData = null;
  await fbDelete(`cycle/${state.member.id}`);
  toast('Zyklusdaten gelöscht.', 'ok');
  return true;
}
function cycleKontoCardHtml() {
  return `
    <div class="sec-head"><h2 class="sec-title">Zyklus</h2><div class="sec-rule"></div></div>
    <div class="card konto-data">
      <p class="card-sub" style="margin:0;">${cycleData
        ? 'Eingeschaltet. Karte und Phasen findest du im Tab Fortschritt.'
        : 'Freiwillig: zeigt deine Zyklusphasen hinter den Leistungskurven, schätzt die nächste Periode und vergleicht deine Leistung je Phase. Nur für dich sichtbar — nie für die Crew. Jederzeit löschbar.'}</p>
      ${cycleData
        ? '<button class="btn ghost small" id="konto-cycle-off">Ausschalten &amp; alle Zyklusdaten löschen</button>'
        : '<button class="btn ghost small" id="konto-cycle-on">Zyklus-Tracking einschalten</button>'}
    </div>`;
}
function wireCycleKonto() {
  const on = document.getElementById('konto-cycle-on');
  if (on) on.onclick = async () => { if (await cycleEnable()) { toast('Eingeschaltet — trag im Tab Fortschritt deinen Periodenbeginn ein.', 'ok'); renderKonto(); } };
  const off = document.getElementById('konto-cycle-off');
  if (off) off.onclick = async () => { if (await cycleDisable()) renderKonto(); };
}

function wireCycleCard() {
  const base = `cycle/${state.member.id}`;
  const addStart = async (key) => {
    if (!key || key > dayKey(new Date())) { toast('Bitte ein Datum bis heute wählen.', 'err'); return; }
    cycleData = { ...cycleData, starts: { ...(cycleData.starts || {}), [key]: true } };
    await fbPut(`${base}/starts/${key}`, true);
    drawProgress();
  };
  const today = document.getElementById('cycle-today');
  if (today) today.onclick = () => addStart(dayKey(new Date()));
  const add = document.getElementById('cycle-add');
  if (add) add.onclick = () => addStart(document.getElementById('cycle-date').value);
  document.querySelectorAll('[data-cycle-del]').forEach((b) => {
    b.onclick = async () => {
      const key = b.dataset.cycleDel;
      const starts = { ...(cycleData.starts || {}) };
      delete starts[key];
      cycleData = { ...cycleData, starts };
      await fbDelete(`${base}/starts/${key}`);
      drawProgress();
      const more = document.querySelector('.pg-cycle-entries');
      if (more) more.open = true;
    };
  });
}
