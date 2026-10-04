/* js/plan.js — Tab Agenda: Wochenplan */
/* ================================================================
   PLAN
   ================================================================= */
async function renderPlan() {
  renderShell(`<div class="sec-head"><h2 class="sec-title">Wochenplan</h2><div class="sec-rule"></div></div>
    <div class="list" id="plan-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>`);

  let plan = await fbGet(`plans/${state.member.id}`);
  if (plan === undefined) {
    // Anfrage fehlgeschlagen (z. B. kein Netz) — Default nur lokal anzeigen,
    // NICHT zurückschreiben, sonst würde ein evtl. schon angepasster Plan
    // beim nächsten erfolgreichen Laden überschrieben.
    plan = DEFAULT_WEEK_PLAN;
  } else if (plan === null) {
    // Wirklich noch kein Plan für dieses Mitglied vorhanden — einmalig anlegen.
    plan = DEFAULT_WEEK_PLAN;
    await fbPut(`plans/${state.member.id}`, plan);
  }
  state.weekPlan = plan;

  const jsToday = new Date().getDay(); // 0=So
  const todayIdx = jsToday === 0 ? 6 : jsToday - 1; // Mo=0 ... So=6

  const list = document.getElementById('plan-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  // Tage mit passendem Tab bekommen einen Start-Knopf (Gym -> Gym-Tab, Finger -> Fingerboard)
  const PLAN_ROUTE = { gym: 'log', finger: 'fingerboard' };
  const startBtn = (d, i) => (PLAN_ROUTE[d.tag]
    ? `<button type="button" class="day-go" data-go="${PLAN_ROUTE[d.tag]}" aria-label="${esc(d.title || TAG_LABEL[d.tag])} starten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg></button>`
    : '<span class="day-go-gap"></span>');
  list.innerHTML = plan.map((d, i) => `
    <div class="day-row ${i === todayIdx ? 'today' : ''}">
      <span class="d">${d.day}${i === todayIdx ? '<span class="tag-pill">HEUTE</span>' : ''}</span>
      <input type="text" value="${esc(d.title)}" data-idx="${i}" data-field="title" placeholder="Titel">
      <select data-idx="${i}" data-field="tag">
        ${Object.keys(TAG_LABEL).map((t) => `<option value="${t}" ${d.tag === t ? 'selected' : ''}>${TAG_LABEL[t]}</option>`).join('')}
      </select>
      ${startBtn(d, i)}
    </div>
  `).join('');
  list.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { location.hash = '#' + b.dataset.go; }; });

  list.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('change', async () => {
      const idx = Number(el.dataset.idx);
      state.weekPlan[idx][el.dataset.field] = el.value;
      await fbPut(`plans/${state.member.id}`, state.weekPlan);
      toast('Gespeichert.', 'ok');
      if (el.dataset.field === 'tag') renderPlan(); // Start-Knopf passt zum neuen Typ
    });
  });
}
