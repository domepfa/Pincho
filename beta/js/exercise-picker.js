/* js/exercise-picker.js — Übungsauswahl mit Körperkarte, Übungsinfo-Sheet, Übung würfeln, Zielmuskel-Karte (bodyMapSvg) */
/* Übungsraster als Körperbild statt langer, nach Trainingskategorie
   sortierter Liste: erst eine grobe Körperregion antippen (am Bild oder als
   Chip), dann erst erscheinen die Übungen dafür — kürzer als die alte Liste
   mit 6 Trainingskategorien. Ordnet jede Übung anhand ihres primären
   Zielmuskels (siehe MUSCLE_ZONES_SVG) automatisch einer von 5 Ober-
   gruppen zu, keine separate Pflege pro Übung nötig. Mobilität/Stretch-
   Übungen (category: 'mobility') bekommen stattdessen IMMER die eigene
   "Stretch"-Gruppe, unabhängig vom Zielmuskel — sonst würden sie mit
   Kraftübungen derselben Körperregion vermischt (z. B. Katze-Kuh unter
   "Rücken" neben Rudern), was Kraft und Dehnen visuell nicht trennt. */
const EX_SUPERGROUP_LABEL = { arm: 'Arm', brust: 'Brust', ruecken: 'Rücken', rumpf: 'Rumpf', huefte_beine: 'Beine', stretch: 'Stretch', agility: 'Agilität' };
const MUSCLE_SUPERGROUP = {
  shoulders: 'arm', biceps: 'arm', forearms_front: 'arm', triceps: 'arm', forearms_back: 'arm',
  chest: 'brust',
  neck_traps: 'ruecken', traps: 'ruecken', rear_delts: 'ruecken', lats: 'ruecken', lower_back: 'ruecken',
  abs: 'rumpf', obliques: 'rumpf',
  quads: 'huefte_beine', shins: 'huefte_beine', glutes: 'huefte_beine', hamstrings: 'huefte_beine', calves: 'huefte_beine',
};
function exerciseSupergroup(ex) {
  if (ex.category === 'mobility') return 'stretch';
  if (ex.category === 'agility') return 'agility';
  return MUSCLE_SUPERGROUP[ex.muscles.primary[0]] || 'rumpf';
}

/* Dieselbe anatomische Körperkarte wie bei der Zielmuskel-Anzeige
   (bodyMapSvg), hier aber pro Muskel antippbar. Der gewählte Muskel
   leuchtet voll, die übrigen Muskeln derselben Körperregion schwächer. */
function clickableBodyMapSvg(activeSupergroup, activeMuscle) {
  const zoneEl = (id, shape) => {
    const sg = MUSCLE_SUPERGROUP[id];
    const cls = id === activeMuscle ? 'active' : sg === activeSupergroup ? 'in-group' : '';
    return `<g class="body-zone ${cls}" data-supergroup="${sg}" data-muscle="${id}">${shape}</g>`;
  };
  const zones = Object.entries(MUSCLE_ZONES_SVG).map(([id, shape]) => zoneEl(id, shape)).join('');
  return `
    <div class="ex-body-wrap">
      <svg viewBox="${BODY_VIEWBOX}" class="muscle-map ex-body-map" role="group" aria-label="Muskel antippen">
        ${BODY_BASE_SVG}
        ${zones}
        ${BODY_DECO_SVG}
      </svg>
      <div class="ex-body-labels"><span>VORNE</span><span>HINTEN</span></div>
    </div>
  `;
}

/* Die letzten 10 TATSÄCHLICH geloggten Übungen dieser Körperregion (aus
   state.logs, das ist schon neueste zuerst sortiert), ohne Duplikate —
   Grundlage für die kompakte Vorauswahl unter dem Körperbild. */
function recentExerciseIdsForSupergroup(sg, limit) {
  const seen = new Set();
  const ids = [];
  for (const entry of state.logs) {
    if (!entry.exercises) continue;
    for (const ex of entry.exercises) {
      if (seen.has(ex.exerciseId)) continue;
      const libEx = EXERCISE_LIBRARY.find((e) => e.id === ex.exerciseId);
      if (!libEx || exerciseSupergroup(libEx) !== sg) continue;
      seen.add(ex.exerciseId);
      ids.push(ex.exerciseId);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

/* Strichzeichnungen für Würfeln/Duell (statt Emoji), Farbe über currentColor */
const ICON_DIE = '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/></svg>';
const ICON_DICE2 = '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="11" height="11" rx="3"/><path d="M10 7V5.5a3 3 0 0 1 3-3h5.5a3 3 0 0 1 3 3V11a3 3 0 0 1-3 3H13.5"/><circle cx="6" cy="10.5" r=".9" fill="currentColor" stroke="none"/><circle cx="10" cy="14.5" r=".9" fill="currentColor" stroke="none"/><circle cx="17.5" cy="6.5" r=".9" fill="currentColor" stroke="none"/></svg>';

/* Welche Übungen zeigt die Auswahl gerade? Suche schlägt alles (über alle
   Regionen hinweg), sonst der angetippte Muskel (Hauptmuskel zuerst, dann
   Übungen, die ihn nur mittrainieren), sonst die Körperregion mit
   Kurzliste (Favoriten + zuletzt geloggte) und "Alle anzeigen". */
/* Die zuletzt geloggten Übungen über alle Regionen (neueste zuerst). */
function recentExerciseIds(limit) {
  const ids = [];
  for (const entry of state.logs) {
    for (const ex of entry.exercises || []) {
      if (!ids.includes(ex.exerciseId)) ids.push(ex.exerciseId);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

function exercisePickerSelection(list, sg, muscle, query, useRecents, showAll) {
  // Zuletzt gemachte Übungen (max. 5) stehen in jeder Auswahl zuoberst,
  // in Reihenfolge der letzten Nutzung — danach alphabetisch.
  const recent = useRecents ? recentExerciseIds(5) : [];
  const rank = (e) => { const i = recent.indexOf(e.id); return i === -1 ? 99 : i; };
  const byName = (a, b) => (rank(a) - rank(b)) || a.name.localeCompare(b.name, 'de');
  const q = (query || '').trim().toLowerCase();
  if (q) return { visible: list.filter((e) => e.name.toLowerCase().includes(q)).sort(byName), total: 0 };
  if (muscle) {
    const prim = list.filter((e) => e.muscles && e.muscles.primary.includes(muscle));
    const sec = list.filter((e) => e.muscles && !e.muscles.primary.includes(muscle) && e.muscles.secondary.includes(muscle));
    // Zuletzt gemachte zuerst, dann Hauptmuskel vor Nebenmuskel.
    const isPrim = (e) => (prim.includes(e) ? 0 : 1);
    return { visible: [...prim, ...sec].sort((a, b) => (rank(a) - rank(b)) || (isPrim(a) - isPrim(b)) || a.name.localeCompare(b.name, 'de')), total: 0 };
  }
  if (!sg) {
    // Noch nichts gewählt: direkt die zuletzt gemachten Übungen anbieten.
    return { visible: recent.map((id) => list.find((e) => e.id === id)).filter(Boolean), total: 0, recentOnly: true };
  }
  const groupList = list.filter((e) => exerciseSupergroup(e) === sg);
  let visible = groupList;
  if (useRecents && !showAll) {
    const recentIds = recentExerciseIdsForSupergroup(sg, 10);
    // Favoriten IMMER mit in die Kurzliste, auch ohne kürzlich geloggten
    // Satz — sonst müsste man sie trotz Sternchen jedes Mal unter "Alle
    // anzeigen" neu suchen.
    const favIds = groupList.filter((e) => isExerciseFavorite(e.id)).map((e) => e.id);
    const shortlistIds = Array.from(new Set([...favIds, ...recentIds]));
    if (shortlistIds.length) visible = groupList.filter((e) => shortlistIds.includes(e.id));
  }
  return { visible: visible.slice().sort(byName), total: visible.length < groupList.length ? groupList.length : 0 };
}

function exerciseCardHtml(e, selectedId) {
  const last = lastValueForExercise(e.id);
  const lastText = last && last.reps !== '' && last.reps != null
    ? `${last.weight !== '' && last.weight != null ? esc(String(last.weight)) + ' kg × ' : ''}${esc(String(last.reps))}`
    : '';
  const tags = (e.muscles ? e.muscles.primary : []).map((m) => `<span class="ex-card-tag">${esc(MUSCLE_ZONE_LABEL[m] || m)}</span>`).join('');
  const active = e.id === selectedId ? 'active' : '';
  const isRecent = recentExerciseIds(5).includes(e.id);
  return `
    <div class="ex-card ${active} ${isRecent ? 'recent' : ''}">
      <button type="button" class="ex-pick-btn ex-card-main ${active}" data-exercise="${e.id}">
        <span class="ex-card-text">
          <span class="ex-card-name">${isExerciseFavorite(e.id) ? '<span class="ex-card-star">★</span> ' : ''}${esc(e.name)}${e.custom ? ' <span class="ex-card-own">eigene</span>' : ''}</span>
          ${tags ? `<span class="ex-card-tags">${tags}</span>` : ''}
        </span>
        ${lastText ? `<span class="ex-card-last"><strong>${lastText}</strong><small>zuletzt</small></span>` : ''}
      </button>
      <button type="button" class="ex-pick-info" data-info-exercise="${e.id}" title="Info zur Übung" aria-label="Info zu ${esc(e.name)}">i</button>
    </div>
  `;
}

function exercisePickerListHtml(list, selectedId, sg, muscle, query, useRecents, showAll) {
  const { visible, total, recentOnly } = exercisePickerSelection(list, sg, muscle, query, useRecents, showAll);
  const hasFilter = sg || muscle || (query || '').trim();
  if (!hasFilter && !visible.length) return '<p class="login-hint ex-pick-hint">Muskel antippen, Bereich wählen oder oben suchen.</p>';
  if (recentOnly) {
    return `
      <div class="ex-recent-label">Zuletzt gemacht</div>
      <div class="ex-card-list">${visible.map((e) => exerciseCardHtml(e, selectedId)).join('')}</div>
      <p class="login-hint ex-pick-hint">Oder Muskel antippen, Bereich wählen bzw. suchen.</p>
    `;
  }
  if (!visible.length) return '<p class="login-hint ex-pick-hint">Keine Übung gefunden.</p>';
  return `
    <div class="ex-card-list">${visible.map((e) => exerciseCardHtml(e, selectedId)).join('')}</div>
    ${total ? `<button type="button" class="btn ghost small" id="ex-show-all" style="width:100%;margin-top:8px;">Alle anzeigen (${total})</button>` : ''}
  `;
}

/* Körperkarte einklappbar: wer schon Übungen geloggt hat, sieht zuerst "Zuletzt gemacht" und die Suche,
   die Karte bleibt einen Tipp entfernt. Die Wahl merkt sich das Gerät. */
let exBodyMapOpen = (() => { try { const v = localStorage.getItem(STORAGE_PREFIX + 'bodymap'); return v == null ? null : v === '1'; } catch (e) { return null; } })();
function exBodyMapIsOpen(useRecents) {
  return exBodyMapOpen ?? !(useRecents && recentExerciseIds(1).length);
}
function exercisePickerBodyHtml(list, selectedId, sg, muscle, query, useRecents, showAll, dice = false) {
  list = list.filter((e) => !e.hidden);
  const muscleLabel = muscle ? (MUSCLE_ZONE_LABEL[muscle] || muscle) : '';
  const mapOpen = exBodyMapIsOpen(useRecents) || !!muscle;
  return `
    <label class="ex-search">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" class="ex-search-input" placeholder="Übung suchen …" aria-label="Übung suchen" value="${esc(query || '')}">
    </label>
    ${dice ? `<div class="ex-dice-row"><button type="button" class="btn ghost small ex-dice-btn" id="ex-dice-btn" title="Zufällige Übung aus dem gewählten Bereich">${ICON_DIE} Übung würfeln</button></div><div id="ex-dice-result"></div>` : ''}
    <button type="button" class="ex-body-toggle" id="ex-body-toggle" aria-expanded="${mapOpen}">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M8 10l4 2 4-2M10 21l2-6 2 6"/></svg>
      ${mapOpen ? 'Körperkarte ausblenden' : 'Nach Muskel wählen'}
    </button>
    ${mapOpen ? clickableBodyMapSvg(sg, muscle) : ''}
    ${muscle ? `<div class="ex-muscle-row"><span class="ex-muscle-pill">${esc(muscleLabel)}</span><button type="button" class="ex-muscle-clear" id="ex-muscle-clear">ganzer Bereich</button></div>` : ''}
    <div class="chip-row ex-supergroup-row">
      ${Object.entries(EX_SUPERGROUP_LABEL).filter(([key]) => list.some((e) => exerciseSupergroup(e) === key)).map(([key, label]) => `
        <button type="button" class="chip ${key === sg && !muscle ? 'active' : ''}" data-supergroup-btn="${key}">${esc(label)}</button>
      `).join('')}
    </div>
    <div class="ex-pick-list">${exercisePickerListHtml(list, selectedId, sg, muscle, query, useRecents, showAll)}</div>
    <div class="ex-custom-row">
      <button type="button" class="btn ghost small" data-custom-ex="custom">+ Eigene Übung</button>
      <button type="button" class="btn ghost small" data-custom-ex="wish">Übung wünschen</button>
    </div>
  `;
}
function ensureExerciseInfoSheet() {
  let el = document.getElementById('exercise-info-sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'exercise-info-sheet';
    el.className = 'info-sheet-backdrop hidden';
    document.body.appendChild(el);
    el.onclick = (e) => { if (e.target === el) closeExerciseInfoSheet(); };
    wireSheetSwipeDown(el, closeExerciseInfoSheet);
  }
  return el;
}
/* Das Sheet legt beim Öffnen einen eigenen History-Eintrag an, damit die
   Zurück-Taste/-Geste des Handys es schliesst statt die App zu verlassen.
   Schliessen per ✕/Hintergrund/Wischen räumt diesen Eintrag wieder ab. */
function openExerciseInfoSheet(el) {
  el.classList.remove('hidden');
  const card = el.querySelector('.info-sheet-card');
  if (card) { card.style.transform = ''; card.style.transition = ''; }
  if (!(history.state && history.state.infoSheet)) history.pushState({ infoSheet: true }, '');
}
function closeExerciseInfoSheet() {
  const el = document.getElementById('exercise-info-sheet');
  if (el) el.classList.add('hidden');
  if (history.state && history.state.infoSheet) history.back();
}
window.addEventListener('popstate', () => {
  const el = document.getElementById('exercise-info-sheet');
  if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
});
/* Runterwischen schliesst das Sheet — nur wenn die Karte ganz oben steht,
   sonst gehört die Geste dem Scrollen im Inhalt. */
function wireSheetSwipeDown(backdrop, onClose) {
  let startY = null;
  let dy = 0;
  let card = null;
  backdrop.addEventListener('touchstart', (e) => {
    card = backdrop.querySelector('.info-sheet-card');
    if (!card || card.scrollTop > 0 || e.touches.length !== 1) { startY = null; return; }
    startY = e.touches[0].clientY;
    dy = 0;
  }, { passive: true });
  backdrop.addEventListener('touchmove', (e) => {
    if (startY === null || !card) return;
    dy = e.touches[0].clientY - startY;
    if (dy > 0) {
      // Die Einblend-Animation (riseIn, fill both) würde sonst das inline
      // transform überschreiben.
      card.style.animation = 'none';
      card.style.transition = 'none';
      card.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  backdrop.addEventListener('touchend', () => {
    if (startY === null || !card) return;
    startY = null;
    card.style.transition = 'transform .18s ease';
    if (dy > 90) {
      card.style.transform = 'translateY(100%)';
      setTimeout(() => { card.style.transition = ''; onClose(); }, 160);
    } else {
      card.style.transform = '';
    }
  });
}

function showExerciseInfoSheet(exerciseId, onChange) {
  const el = ensureExerciseInfoSheet();
  const muscles = exerciseMuscles(exerciseId);
  const muscleText = muscleLabelsText(muscles.primary, muscles.secondary);
  const howTo = exerciseHowTo(exerciseId);
  const isFav = isExerciseFavorite(exerciseId);
  // Dasselbe animierte Strichmännchen wie im Ablauf-Vollbild (siehe
  // exerciseFigureSvg) — bisher zeigte die Info nur den Text und die
  // Zielmuskeln, nicht die Bewegung selbst. Nur bei Übungen mit einer
  // echten Animation zeigen (EXERCISE_FIGURES), sonst bliebe nur der
  // generische 💪-Platzhalter übrig, der hier nichts beiträgt.
  const hasFigure = !!EXERCISE_FIGURES[exerciseId];
  el.innerHTML = `
    <div class="info-sheet-card">
      <button type="button" class="info-sheet-close" id="info-sheet-close">✕</button>
      <div class="info-sheet-title">${esc(exerciseName(exerciseId))}</div>
      <button type="button" class="btn ghost small" id="info-sheet-fav" style="margin-bottom:10px;">${isFav ? '★ Favorit' : '☆ Zu Favoriten hinzufügen'}</button>
      ${hasFigure ? `<div class="info-sheet-figure">${exerciseFigureSvg(exerciseId)}</div>` : ''}
      ${howTo ? `<div class="ex-howto">${esc(howTo)}</div>` : ''}
      ${muscleText ? `<div class="fb-muscle-block">${bodyMapSvg(muscles.primary, muscles.secondary)}<div class="fb-muscle-label mono">${esc(muscleText)}</div></div>` : ''}
      ${customExercises[exerciseId] ? '<button type="button" class="btn ghost small" id="info-sheet-hide" style="margin-top:10px;">Aus der Auswahl entfernen</button>' : ''}
    </div>
  `;
  openExerciseInfoSheet(el);
  const hideBtn = document.getElementById('info-sheet-hide');
  if (hideBtn) hideBtn.onclick = async () => { if (await hideCustomExercise(exerciseId)) { closeExerciseInfoSheet(); if (onChange) onChange(); } };
  document.getElementById('info-sheet-close').onclick = () => closeExerciseInfoSheet();
  document.getElementById('info-sheet-fav').onclick = () => {
    toggleExerciseFavorite(exerciseId);
    showExerciseInfoSheet(exerciseId, onChange);
    if (onChange) onChange();
  };
}

/* Rendert das Übungsraster IN den Container UND verdrahtet es — anders als
   früher (getrennte HTML-Erzeugung + Verdrahtung) muss diese Funktion beim
   Wechsel der Körperregion sich selbst neu aufrufen können, da sich dabei
   die sichtbare Übungsliste komplett ändert. */
/* Übung würfeln (nur Freestyle): zufällig aus dem gewählten Muskel bzw.
   Bereich, sonst aus allem ausser Stretch; heute schon gemachte Übungen
   (excludeIds) und der letzte Wurf fallen raus. Nur ein Vorschlag —
   erst "Übernehmen" wählt die Übung aus. */
function rollExercise(list, sg, muscle, excludeIds, lastId) {
  let pool = list.filter((e) => !e.hidden);
  if (muscle) pool = pool.filter((e) => e.muscles && e.muscles.primary.includes(muscle));
  else if (sg) pool = pool.filter((e) => exerciseSupergroup(e) === sg);
  else pool = pool.filter((e) => exerciseSupergroup(e) !== 'stretch');
  const fresh = pool.filter((e) => !excludeIds.includes(e.id));
  if (fresh.length) pool = fresh;
  if (pool.length > 1) pool = pool.filter((e) => e.id !== lastId);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
}

function wireExercisePickerGrid(containerId, list, initialSelectedId, onSelect, scrollTargetId, useRecents = true, opts = {}) {
  const holder = document.getElementById(containerId);
  if (!holder) return;
  let selectedId = initialSelectedId;
  // Bewusst immer geschlossen starten — man soll erst bewusst einen Muskel
  // oder Bereich antippen (initialSelectedId ist oft nur ein Default).
  let sg = '';
  let muscle = '';
  let query = '';
  let showAll = false;

  // Nur die Liste neu zeichnen (z. B. beim Tippen in der Suche) — sonst
  // würde das Suchfeld bei jedem Buchstaben neu erzeugt und die Tastatur
  // ginge zu.
  const wireList = () => {
    const listHolder = holder.querySelector('.ex-pick-list');
    const showAllBtn = listHolder.querySelector('#ex-show-all');
    if (showAllBtn) showAllBtn.onclick = () => { showAll = true; renderList(); };
    listHolder.querySelectorAll('.ex-pick-btn').forEach((btn) => {
      btn.onclick = () => {
        selectedId = btn.dataset.exercise;
        listHolder.querySelectorAll('.ex-card').forEach((c) => c.classList.toggle('active', c.contains(btn)));
        listHolder.querySelectorAll('.ex-pick-btn').forEach((b) => b.classList.toggle('active', b === btn));
        onSelect(selectedId);
        // Hinzufügen direkt an der angetippten Übung statt zum Knopf unten zu springen und wieder hochzuscrollen
        if (scrollTargetId) {
          listHolder.querySelectorAll('.ex-quick-add').forEach((b) => b.remove());
          const card = btn.closest('.ex-card');
          const add = document.createElement('button');
          add.type = 'button';
          add.className = 'ex-quick-add';
          add.textContent = '＋ Hinzufügen';
          add.onclick = () => {
            const target = document.getElementById(scrollTargetId);
            if (!target) return;
            target.click();
            add.textContent = '✓ Hinzugefügt';
            add.classList.add('done');
            toast(`${exerciseName(selectedId)} hinzugefügt`, 'ok');
            setTimeout(() => add.remove(), 1400);
          };
          card.appendChild(add);
        }
      };
    });
    // Info-Button NEBEN der Übung, nicht Teil ihres Auswahl-Buttons — so
    // kann man Ausführung/Zielmuskeln nachschauen, ohne sie auszuwählen.
    listHolder.querySelectorAll('.ex-pick-info').forEach((btn) => {
      btn.onclick = () => showExerciseInfoSheet(btn.dataset.infoExercise, renderList);
    });
  };
  const renderList = () => {
    holder.querySelector('.ex-pick-list').innerHTML = exercisePickerListHtml(list.filter((e) => !e.hidden), selectedId, sg, muscle, query, useRecents, showAll);
    wireList();
  };
  const render = () => {
    holder.innerHTML = exercisePickerBodyHtml(list, selectedId, sg, muscle, query, useRecents, showAll, !!opts.dice);
    const diceBtn = holder.querySelector('#ex-dice-btn');
    if (diceBtn) {
      let lastRoll = null;
      const roll = () => {
        const id = rollExercise(list, sg, muscle, opts.excludeIds ? opts.excludeIds() : [], lastRoll);
        const out = holder.querySelector('#ex-dice-result');
        if (!id) { out.innerHTML = '<p class="login-hint">Hier gibt es nichts zu würfeln.</p>'; return; }
        lastRoll = id;
        const ex = list.find((e) => e.id === id);
        const where = muscle ? (MUSCLE_ZONE_LABEL[muscle] || muscle) : EX_SUPERGROUP_LABEL[exerciseSupergroup(ex)] || '';
        out.innerHTML = `
          <div class="ex-dice-card">
            <span class="ex-dice-label">Vorschlag${where ? ' · ' + esc(where) : ''}</span>
            <b class="ex-dice-name">${esc(ex.name)}</b>
            <div class="ex-dice-actions">
              <button type="button" class="btn small" id="ex-dice-take">Übernehmen</button>
              <button type="button" class="btn ghost small" id="ex-dice-again">Nochmal würfeln</button>
            </div>
          </div>`;
        out.querySelector('#ex-dice-take').onclick = () => { selectedId = id; out.innerHTML = ''; onSelect(id); };
        out.querySelector('#ex-dice-again').onclick = roll;
      };
      diceBtn.onclick = roll;
    }
    holder.querySelectorAll('.body-zone').forEach((el) => {
      el.onclick = () => {
        const m = el.dataset.muscle;
        muscle = muscle === m ? '' : m;
        sg = el.dataset.supergroup;
        query = '';
        showAll = false;
        render();
      };
    });
    holder.querySelectorAll('[data-supergroup-btn]').forEach((el) => {
      el.onclick = () => { sg = el.dataset.supergroupBtn; muscle = ''; query = ''; showAll = false; render(); };
    });
    const mapToggle = holder.querySelector('#ex-body-toggle');
    if (mapToggle) mapToggle.onclick = () => {
      exBodyMapOpen = !exBodyMapIsOpen(useRecents);
      if (!exBodyMapOpen) muscle = '';
      try { localStorage.setItem(STORAGE_PREFIX + 'bodymap', exBodyMapOpen ? '1' : '0'); } catch (e) { /* ignorieren */ }
      render();
    };
    const clearBtn = holder.querySelector('#ex-muscle-clear');
    if (clearBtn) clearBtn.onclick = () => { muscle = ''; showAll = false; render(); };
    const search = holder.querySelector('.ex-search-input');
    // Beim Suchen Körperkarte und Gruppen wegklappen, damit die Treffer
    // direkt unter dem Feld stehen und nicht hinter der Tastatur liegen.
    const setSearching = (on) => holder.classList.toggle('ex-searching', on);
    setSearching(!!query);
    search.onfocus = () => {
      setSearching(true);
      // Steht schon etwas drin: markieren, damit Tippen es direkt ersetzt
      if (search.value) search.select();
      setTimeout(() => {
        // Feld knapp unter die feste Kopfzeile holen (scrollIntoView landete dahinter)
        const bar = document.querySelector('.topbar');
        const top = search.getBoundingClientRect().top - (bar ? bar.getBoundingClientRect().bottom : 0) - 12;
        window.scrollBy({ top, behavior: 'smooth' });
      }, 250);
    };
    search.onblur = () => { if (!search.value.trim()) setSearching(false); };
    search.oninput = () => { query = search.value; renderList(); };
    holder.querySelectorAll('[data-custom-ex]').forEach((b) => {
      b.onclick = () => showCustomExerciseSheet(b.dataset.customEx, (newId) => {
        if (!newId) return;
        // Neue eigene Übung gleich auswählen und ihre Gruppe zeigen
        selectedId = newId;
        const ex = EXERCISE_LIBRARY.find((e) => e.id === newId);
        sg = ex ? exerciseSupergroup(ex) : sg;
        muscle = ''; query = ''; showAll = true;
        render();
        onSelect(newId);
      });
    });
    wireList();
  };
  render();
}
/* ---------- Zielmuskeln-Übersicht ----------
   Ein einziges, wiederverwendbares Körper-Umriss-SVG (vorne links, hinten
   rechts) mit fest definierten Zonen — pro Übung wird nur die Klasse
   (primary/secondary/inaktiv) der jeweiligen Zone umgeschaltet, das
   Bild selbst bleibt immer dasselbe. Positionen sind bewusst schematisch
   (Rechtecke/Ellipsen wie bei den Strichmännchen), keine anatomische
   Illustration. */
/* Anatomische Zonen (Beta): Vorderansicht links, Rückansicht rechts
   (um 125 nach rechts verschoben). Jede Zone ist ein Pfad, links und
   rechts gespiegelt; die Form orientiert sich grob am echten Muskel statt
   an Rechtecken. BODY_BASE_SVG ist der dunkle Körperumriss darunter,
   BODY_DECO_SVG feine Linien darüber (nicht antippbar). */
const BACK = (d) => `<path transform="translate(125 0)" d="${d}"/>`;
const FRONT = (d) => `<path d="${d}"/>`;
const MUSCLE_ZONES_SVG = {
  neck_traps: FRONT('M55 38 Q48 43 41 46 Q46 49 52 47 Q56 44 56 40 Z M65 38 Q72 43 79 46 Q74 49 68 47 Q64 44 64 40 Z'),
  shoulders: FRONT('M38 47 Q28 49 26 62 Q31 66 36 62 Q40 56 40 50 Z M82 47 Q92 49 94 62 Q89 66 84 62 Q80 56 80 50 Z'),
  chest: FRONT('M59 50 Q48 48 41 52 Q38 62 42 70 Q52 74 59 70 Z M61 50 Q72 48 79 52 Q82 62 78 70 Q68 74 61 70 Z'),
  biceps: FRONT('M34 66 Q27 70 26 82 Q27 90 31 92 Q35 84 36 72 Z M86 66 Q93 70 94 82 Q93 90 89 92 Q85 84 84 72 Z'),
  forearms_front: FRONT('M29 96 Q23 106 21 122 Q23 126 26 124 Q30 110 33 98 Z M91 96 Q97 106 99 122 Q97 126 94 124 Q90 110 87 98 Z'),
  abs: FRONT('M53 74 L67 74 Q68 96 66 116 Q60 120 54 116 Q52 96 53 74 Z'),
  obliques: FRONT('M42 74 Q41 90 44 110 Q48 114 51 112 Q50 92 51 76 Z M78 74 Q79 90 76 110 Q72 114 69 112 Q70 92 69 76 Z'),
  quads: FRONT('M44 124 Q38 148 42 174 Q47 180 53 177 Q58 152 58 128 Q52 122 44 124 Z M76 124 Q82 148 78 174 Q73 180 67 177 Q62 152 62 128 Q68 122 76 124 Z'),
  shins: FRONT('M43 190 Q40 210 43 232 Q46 236 49 234 Q52 212 51 192 Z M77 190 Q80 210 77 232 Q74 236 71 234 Q68 212 69 192 Z'),
  traps: BACK('M60 36 Q52 42 44 48 Q52 58 60 66 Z M60 36 Q68 42 76 48 Q68 58 60 66 Z'),
  rear_delts: BACK('M38 47 Q28 49 26 62 Q31 66 36 62 Q40 56 40 50 Z M82 47 Q92 49 94 62 Q89 66 84 62 Q80 56 80 50 Z'),
  lats: BACK('M58 66 Q48 58 42 58 Q40 74 45 96 Q52 102 58 98 Z M62 66 Q72 58 78 58 Q80 74 75 96 Q68 102 62 98 Z'),
  triceps: BACK('M34 66 Q27 70 26 82 Q27 90 31 92 Q35 84 36 72 Z M86 66 Q93 70 94 82 Q93 90 89 92 Q85 84 84 72 Z'),
  forearms_back: BACK('M29 96 Q23 106 21 122 Q23 126 26 124 Q30 110 33 98 Z M91 96 Q97 106 99 122 Q97 126 94 124 Q90 110 87 98 Z'),
  lower_back: BACK('M54 100 L66 100 L66 116 Q60 119 54 116 Z'),
  glutes: BACK('M59 118 Q47 116 42 126 Q43 140 58 140 Z M61 118 Q73 116 78 126 Q77 140 62 140 Z'),
  hamstrings: BACK('M44 144 Q39 162 42 178 Q48 182 54 178 Q57 160 57 144 Z M76 144 Q81 162 78 178 Q72 182 66 178 Q63 160 63 144 Z'),
  calves: BACK('M43 188 Q38 204 43 222 Q47 226 51 222 Q55 204 51 188 Z M77 188 Q82 204 77 222 Q73 226 69 222 Q65 204 69 188 Z'),
};
const BODY_FIGURE_BASE = `
  <ellipse cx="60" cy="20" rx="10" ry="12"/>
  <path d="M55 30 L65 30 L66 40 L54 40 Z"/>
  <path d="M40 44 Q60 38 80 44 Q84 60 80 76 L78 120 Q60 128 42 120 L40 76 Q36 60 40 44 Z"/>
  <path d="M38 48 Q26 50 24 66 L20 96 Q16 116 17 130 Q20 140 25 136 Q28 120 32 100 L37 70 Z M82 48 Q94 50 96 66 L100 96 Q104 116 103 130 Q100 140 95 136 Q92 120 88 100 L83 70 Z"/>
  <path d="M42 120 Q36 150 40 184 Q38 210 42 240 L50 244 Q54 214 53 186 Q58 152 59 124 Z M78 120 Q84 150 80 184 Q82 210 78 240 L70 244 Q66 214 67 186 Q62 152 61 124 Z"/>`;
const BODY_BASE_SVG = `<g class="body-base">${BODY_FIGURE_BASE}<g transform="translate(125 0)">${BODY_FIGURE_BASE}</g></g>`;
const BODY_DECO_SVG = '<path class="body-deco" d="M53 86 L67 86 M53 98 L67 98 M60 74 L60 116"/>';
const BODY_VIEWBOX = '0 0 245 250';

const MUSCLE_ZONE_LABEL = {
  neck_traps: 'Nacken', shoulders: 'Schultern', chest: 'Brust', biceps: 'Bizeps',
  forearms_front: 'Unterarm (Beuger)', abs: 'Bauch', obliques: 'Seitl. Bauch',
  quads: 'Quadrizeps', shins: 'Schienbein', traps: 'Trapezius', rear_delts: 'Hintere Schulter',
  lats: 'Latissimus', triceps: 'Trizeps', forearms_back: 'Unterarm (Strecker)',
  lower_back: 'Unterer Rücken', glutes: 'Gesäss', hamstrings: 'Hintere Oberschenkel', calves: 'Waden',
};

function bodyMapSvg(primary, secondary) {
  const zoneEl = (id, shape) => {
    const cls = primary.includes(id) ? 'muscle-zone primary' : secondary.includes(id) ? 'muscle-zone secondary' : 'muscle-zone';
    return `<g class="${cls}">${shape}</g>`;
  };
  const zones = Object.entries(MUSCLE_ZONES_SVG).map(([id, shape]) => zoneEl(id, shape)).join('');
  return `
    <svg viewBox="${BODY_VIEWBOX}" class="muscle-map">
      ${BODY_BASE_SVG}
      ${zones}
      ${BODY_DECO_SVG}
    </svg>
  `;
}

function muscleLabelsText(primary, secondary) {
  const p = primary.map((id) => MUSCLE_ZONE_LABEL[id] || id);
  const s = secondary.map((id) => MUSCLE_ZONE_LABEL[id] || id);
  if (!p.length && !s.length) return '';
  return s.length ? `${p.join(', ')} (+ ${s.join(', ')})` : p.join(', ');
}

/* "Info"-Aufklapper bei Freestyle/Plan-Ausführung: zeigt, was bei dieser
   Übung wirklich zuverlässig bekannt ist (Zielmuskeln, gleicher Körper-
   Umriss wie beim Fingerboard-Checkin) — bewusst keine selbst erfundenen
   Ausführungshinweise, die im Zweifel falsch/gefährlich wären. */
function fsExerciseInfoHtml(exerciseId) {
  const muscles = exerciseMuscles(exerciseId);
  const text = muscleLabelsText(muscles.primary, muscles.secondary);
  const howTo = exerciseHowTo(exerciseId);
  return `
    <div class="fb-muscle-block">
      ${howTo ? `<div class="ex-howto">${esc(howTo)}</div>` : ''}
      ${text ? bodyMapSvg(muscles.primary, muscles.secondary) : ''}
      ${text ? `<div class="fb-muscle-label mono">${esc(text)}</div>` : ''}
    </div>
  `;
}
