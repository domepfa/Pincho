/* js/fb-builder.js — Board-Tab: "Eigenen Ablauf bauen" – Hang, Griffblock/Lifting Pin, Pause, Campus (Builder + Picker) */
/* ---------- "Eigenen Ablauf bauen": ein Satz nach dem anderen ----------
   Ein einziges, kompaktes Add-Panel statt über die Seite verteilter
   Abschnitte — Board (klein) + Namens-Liste als zweiter Auswahlweg direkt
   darunter, dann Sätze/Zeiten, dann der Hinzufügen-Button. Nach dem
   Hinzufügen bleibt man auf derselben Stelle stehen (kein Re-Render der
   ganzen Seite) und kann direkt den nächsten Satz konfigurieren. */
/* Handwahl für Hang-Sätze an Einarm-Griffen (z. B. BM2000 Grosse Kante):
   gleiche Muster wie beim Lifting Pin — fix, abwechselnd oder erst alle
   Sätze mit der einen, dann mit der anderen Hand. */
function fbHangHandHtml() {
  if (fb.gripMode !== 'same' || !fb.selectedGrip || gripArmNote(fb.board, fb.selectedGrip) !== 'einarmig') return '';
  const h = fb.newHangHand;
  const first = h.handMode === 'fixed' ? '' : ' zuerst';
  return `
    <div class="field">
      <label>Hand (Griff ist einarmig)</label>
      <div class="chip-row" id="fb-hang-handmode-row">
        <button type="button" class="chip ${h.handMode === 'fixed' ? 'active' : ''}" data-hand-mode="fixed">Immer gleiche</button>
        <button type="button" class="chip ${h.handMode === 'alternate' ? 'active' : ''}" data-hand-mode="alternate">Abwechselnd</button>
        <button type="button" class="chip ${h.handMode === 'block' ? 'active' : ''}" data-hand-mode="block">Erst eine, dann andere</button>
      </div>
    </div>
    <div class="chip-row" id="fb-hang-starthand-row">
      <button type="button" class="chip ${h.startHand === 'left' ? 'active' : ''}" data-start-hand="left" data-hand-color="l">Links${first}</button>
      <button type="button" class="chip ${h.startHand === 'right' ? 'active' : ''}" data-start-hand="right" data-hand-color="r">Rechts${first}</button>
    </div>
  `;
}
function wireFbHangHand() {
  const holder = document.getElementById('fb-hang-hand');
  if (!holder) return;
  holder.querySelectorAll('[data-hand-mode]').forEach((btn) => {
    btn.onclick = () => { fb.newHangHand.handMode = btn.dataset.handMode; holder.innerHTML = fbHangHandHtml(); wireFbHangHand(); };
  });
  holder.querySelectorAll('[data-start-hand]').forEach((btn) => {
    btn.onclick = () => { fb.newHangHand.startHand = btn.dataset.startHand; holder.innerHTML = fbHangHandHtml(); wireFbHangHand(); };
  });
}

function renderFbAddPanel() {
  const holder = document.getElementById('fb-add-panel');
  if (!holder) return;

  if (fb.addType === 'hang') {
    holder.innerHTML = `
      <div class="chip-row" id="fb-board-toggle">
        <button class="chip ${fb.board === 'bm1000' ? 'active' : ''}" data-board="bm1000">BM 1000</button>
        <button class="chip ${fb.board === 'bm2000' ? 'active' : ''}" data-board="bm2000">BM 2000</button>
      </div>
      <div class="chip-row" id="fb-gripmode-toggle">
        <button class="chip ${fb.gripMode === 'same' ? 'active' : ''}" data-grip-mode="same">Beide Hände gleich</button>
        <button class="chip ${fb.gripMode === 'different' ? 'active' : ''}" data-grip-mode="different">Unterschiedlich</button>
      </div>
      ${fb.gripMode === 'different' ? `
        <div class="chip-row" id="fb-hand-toggle">
          <button class="chip ${fb.pickingHand === 'left' ? 'active' : ''}" data-hand="left" data-hand-color="l">Links${fb.selectedGripLeft ? ': ' + esc(gripLabel(fb.board, fb.selectedGripLeft)) : ' wählen'}</button>
          <button class="chip ${fb.pickingHand === 'right' ? 'active' : ''}" data-hand="right" data-hand-color="r">Rechts${fb.selectedGripRight ? ': ' + esc(gripLabel(fb.board, fb.selectedGripRight)) : ' wählen'}</button>
        </div>
      ` : ''}
      <div class="board-visual" id="fb-board-visual">${renderBoardImage()}</div>
      <p class="mono" id="fb-calib-readout" style="text-align:center;font-size:11px;color:var(--ink-faint);margin:6px 0;min-height:14px;"></p>
      <p class="login-hint" id="fb-selected-hint" style="margin:0 0 8px;">${fbSelectedGripHint()}</p>
      <div class="field">
        <label>${fb.gripMode === 'different' ? `Oder aus der Liste wählen (für ${fb.pickingHand === 'left' ? 'links' : 'rechts'})` : 'Oder aus der Liste wählen'}</label>
        <select id="fb-grip-select">
          <option value="">— Griff wählen —</option>
          ${BOARDS[fb.board].grips.map((g) => `<option value="${g.id}" ${(fb.gripMode === 'different' ? (fb.pickingHand === 'left' ? fb.selectedGripLeft : fb.selectedGripRight) : fb.selectedGrip) === g.id ? 'selected' : ''}>${esc(g.label)}${g.note ? ' · ' + esc(g.note) : ''}${gripArmNote(fb.board, g.id) ? ' · ' + gripArmNote(fb.board, g.id) : ''}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Sätze</label><input type="number" id="fb-new-reps" value="${fb.newHang.reps}" min="1"></div>
        <div class="field"><label>Hang (s)</label><input type="number" id="fb-new-hangsec" value="${fb.newHang.hangSec}" min="1"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Pause zw. Sätzen (s)</label><input type="number" id="fb-new-restsec" value="${fb.newHang.restSec}" min="0"></div>
        <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-new-blockrestsec" value="${fb.newHang.blockRestSec}" min="0"></div>
      </div>
      <div id="fb-hang-hand">${fbHangHandHtml()}</div>
      <button type="button" class="btn" id="fb-add-hang" style="width:100%;">+ Hang-Satz hinzufügen</button>
    `;
    wireFbHangHand();
    wireCalibration();
    document.getElementById('fb-board-toggle').querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.board = btn.dataset.board;
        fb.selectedGrip = null;
        fb.selectedGripLeft = null;
        fb.selectedGripRight = null;
        state.memberDoc = { ...(state.memberDoc || {}), board: fb.board };
        fbPatch(`members/${state.member.id}`, { board: fb.board });
        renderFbAddPanel();
      };
    });
    document.getElementById('fb-gripmode-toggle').querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.gripMode = btn.dataset.gripMode;
        fb.pickingHand = 'left';
        renderFbAddPanel();
      };
    });
    const handToggle = document.getElementById('fb-hand-toggle');
    if (handToggle) {
      handToggle.querySelectorAll('.chip').forEach((btn) => {
        btn.onclick = () => {
          fb.pickingHand = btn.dataset.hand;
          handToggle.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
          const select = document.getElementById('fb-grip-select');
          if (select) select.value = (fb.pickingHand === 'left' ? fb.selectedGripLeft : fb.selectedGripRight) || '';
          const label = document.querySelector('#fb-add-panel .field label');
          if (label) label.textContent = `Oder aus der Liste wählen (für ${fb.pickingHand === 'left' ? 'links' : 'rechts'})`;
        };
      });
    }
    document.getElementById('fb-board-visual').querySelectorAll('.board-hotspot').forEach((el) => {
      el.onclick = () => selectFbGrip(el.dataset.grip, el.dataset.side);
    });
    document.getElementById('fb-grip-select').onchange = (e) => selectFbGrip(e.target.value || null);
    document.getElementById('fb-new-reps').oninput = (e) => { fb.newHang.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-new-hangsec').oninput = (e) => { fb.newHang.hangSec = Number(e.target.value) || 1; };
    document.getElementById('fb-new-restsec').oninput = (e) => { fb.newHang.restSec = Number(e.target.value) || 0; };
    document.getElementById('fb-new-blockrestsec').oninput = (e) => { fb.newHang.blockRestSec = Number(e.target.value) || 0; };
    ['fb-new-reps', 'fb-new-hangsec', 'fb-new-restsec', 'fb-new-blockrestsec'].forEach(selectOnFocus);
    document.getElementById('fb-add-hang').onclick = () => {
      if (fb.gripMode === 'different') {
        if (!fb.selectedGripLeft || !fb.selectedGripRight) { toast('Zuerst Griff für links UND rechts wählen.', 'err'); return; }
        fb.blocks.push({ type: 'hang', board: fb.board, gripLeft: fb.selectedGripLeft, gripRight: fb.selectedGripRight, ...fb.newHang });
      } else {
        if (!fb.selectedGrip) { toast('Zuerst einen Griff wählen.', 'err'); return; }
        const oneArm = gripArmNote(fb.board, fb.selectedGrip) === 'einarmig';
        fb.blocks.push({ type: 'hang', board: fb.board, grip: fb.selectedGrip, ...fb.newHang, ...(oneArm ? fb.newHangHand : {}) });
      }
      renderFbBlocksList();
    };
  } else if (fb.addType === 'block') {
    renderBlockAddPanel(holder);
  } else if (fb.addType === 'exercise') {
    holder.innerHTML = `
      <div class="chip-row" id="fb-pseudo-exercise-row" style="margin-bottom:10px;">
        <button type="button" class="chip ${fb.newExercise.exerciseId === 'warmup_general' ? 'active' : ''}" data-pseudo-exercise="warmup_general">🔥 Warm-up</button>
        <button type="button" class="chip ${fb.newExercise.exerciseId === 'cooldown_general' ? 'active' : ''}" data-pseudo-exercise="cooldown_general">🧘 Cooldown</button>
      </div>
      <div class="field">
        <label>Übung</label>
        <div id="fb-exercise-grid"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Ziel-Wdh.</label><input type="number" id="fb-new-exreps" value="${fb.newExercise.reps}" min="1"></div>
        <div class="field"><label>Dauer (s)</label><input type="number" id="fb-new-exwork" value="${fb.newExercise.workSec}" min="5"></div>
        <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-new-exrest" value="${fb.newExercise.restSec}" min="0"></div>
      </div>
      <button type="button" class="btn" id="fb-add-exercise" style="width:100%;">+ Übung hinzufügen</button>
    `;
    holder.querySelectorAll('[data-pseudo-exercise]').forEach((btn) => {
      btn.onclick = () => { fb.newExercise.exerciseId = btn.dataset.pseudoExercise; renderFbAddPanel(); };
    });
    wireExercisePickerGrid('fb-exercise-grid', EXERCISE_LIBRARY, fb.newExercise.exerciseId, (id) => { fb.newExercise.exerciseId = id; }, 'fb-add-exercise', false);
    document.getElementById('fb-new-exreps').oninput = (e) => { fb.newExercise.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-new-exwork').oninput = (e) => { fb.newExercise.workSec = Number(e.target.value) || 5; };
    document.getElementById('fb-new-exrest').oninput = (e) => { fb.newExercise.restSec = Number(e.target.value) || 0; };
    ['fb-new-exreps', 'fb-new-exwork', 'fb-new-exrest'].forEach(selectOnFocus);
    document.getElementById('fb-add-exercise').onclick = () => {
      fb.blocks.push({ type: 'exercise', ...fb.newExercise });
      renderFbBlocksList();
    };
  } else if (fb.addType === 'campus') {
    renderCampusAddPanel(holder);
  } else {
    renderPauseAddPanel(holder);
  }
}

/* Griffblock/Lifting Pin: ein Trainingsblock mit mehreren Leisten (oder
   ein Lifting Pin), der über die Querseite auch als Pinch nutzbar ist.
   Kein Foto/Hotspots wie beim Fingerboard — Griff/Leiste ist deshalb
   freier Text (z. B. "Leiste 1" oder "Pinch"), dazu Fingerzahl (1-4, gilt
   für Leisten UND Pinch) und Gewicht. Anders als beim Hang-Satz ist das
   Gewicht hier das TATSÄCHLICHE geladene Gesamtgewicht (z. B. eine
   angesteckte Scheibe), kein "Zusatzgewicht" oben auf das Körpergewicht.
   Immer einarmig (nur eine Hand gleichzeitig), deshalb kein Links/Rechts-
   Umschalter wie beim Hang-Satz. Wahlweise als Halten (Sekundentimer wie
   ein Hang-Satz) ODER als Wiederholungen (heben/ablassen zählen, wie eine
   Fixübung) — ein Lifting Pin wird nicht nur statisch gehalten, sondern
   auch für Wiederholungen genutzt. */
const LEISTE_WIDTHS_MM = [5, 10, 15, 20, 25, 30];
/* Baut den freien Griff-Anzeigetext aus der strukturierten Auswahl statt
   ihn frei eintippen zu lassen — Pinch braucht keine Breite (über die
   Querseite), eine Leiste schon (feste Auswahl in 5mm-Schritten). */
function blockGripFromSelection(b) {
  return b.gripType === 'pinch' ? 'Pinch' : `Leiste ${b.leisteWidth}mm`;
}
function renderBlockAddPanel(holder) {
  const isReps = fb.newBlock.mode === 'reps';
  const isLeiste = fb.newBlock.gripType === 'leiste';
  holder.innerHTML = `
    <div class="field">
      <label>Griff</label>
      <div class="chip-row" id="fb-block-griptype-row">
        <button type="button" class="chip ${isLeiste ? 'active' : ''}" data-grip-type="leiste">Leiste</button>
        <button type="button" class="chip ${!isLeiste ? 'active' : ''}" data-grip-type="pinch">Pinch</button>
      </div>
    </div>
    <div id="fb-block-leiste-width-field" ${isLeiste ? '' : 'hidden'}>
      <div class="field">
        <label>Leisten-Breite</label>
        <div class="chip-row" id="fb-block-leistewidth-row">
          ${LEISTE_WIDTHS_MM.map((mm) => `<button type="button" class="chip ${fb.newBlock.leisteWidth === mm ? 'active' : ''}" data-leiste-width="${mm}">${mm}mm</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="field">
      <label>Finger</label>
      <div class="chip-row" id="fb-block-fingers-row">
        ${[1, 2, 3, 4].map((n) => `<button type="button" class="chip ${fb.newBlock.fingers === n ? 'active' : ''}" data-fingers="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>Gewicht (kg)</label><div class="kg-field"><input type="number" inputmode="decimal" id="fb-block-weight" value="${fb.newBlock.weight}" step="0.5"><span class="mono">kg</span></div></div>
    <div class="chip-row" id="fb-block-mode-row">
      <button type="button" class="chip ${!isReps ? 'active' : ''}" data-mode="hold">Halten</button>
      <button type="button" class="chip ${isReps ? 'active' : ''}" data-mode="reps">Wiederholungen</button>
    </div>
    <div id="fb-block-mode-fields"></div>
    ${!isReps ? `
    <div class="field">
      <label>Hand (einarmig)</label>
      <div class="chip-row" id="fb-block-handmode-row">
        <button type="button" class="chip ${fb.newBlock.handMode === 'fixed' ? 'active' : ''}" data-hand-mode="fixed">Fixiert</button>
        <button type="button" class="chip ${fb.newBlock.handMode === 'alternate' ? 'active' : ''}" data-hand-mode="alternate">Abwechselnd</button>
        <button type="button" class="chip ${fb.newBlock.handMode === 'block' ? 'active' : ''}" data-hand-mode="block">Block</button>
      </div>
    </div>
    <div class="chip-row" id="fb-block-starthand-row">
      <button type="button" class="chip ${fb.newBlock.startHand === 'left' ? 'active' : ''}" data-start-hand="left"><span class="emoji">🫲</span>${fb.newBlock.handMode === 'fixed' ? 'Links' : 'Links zuerst'}</button>
      <button type="button" class="chip ${fb.newBlock.startHand === 'right' ? 'active' : ''}" data-start-hand="right"><span class="emoji">🫱</span>${fb.newBlock.handMode === 'fixed' ? 'Rechts' : 'Rechts zuerst'}</button>
    </div>
    ` : ''}
    <button type="button" class="btn" id="fb-add-block" style="width:100%;">+ Lifting-Pin-Satz hinzufügen</button>
  `;
  document.getElementById('fb-block-griptype-row').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      fb.newBlock.gripType = btn.dataset.gripType;
      renderBlockAddPanel(holder);
    };
  });
  const leisteWidthRow = document.getElementById('fb-block-leistewidth-row');
  if (leisteWidthRow) {
    leisteWidthRow.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.newBlock.leisteWidth = Number(btn.dataset.leisteWidth);
        leisteWidthRow.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
      };
    });
  }
  document.getElementById('fb-block-fingers-row').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      fb.newBlock.fingers = Number(btn.dataset.fingers);
      document.getElementById('fb-block-fingers-row').querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
    };
  });
  document.getElementById('fb-block-weight').oninput = (e) => { fb.newBlock.weight = e.target.value === '' ? 0 : Number(e.target.value); };
  selectOnFocus('fb-block-weight');
  document.getElementById('fb-block-mode-row').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      fb.newBlock.mode = btn.dataset.mode;
      renderBlockAddPanel(holder);
    };
  });
  const handModeRow = document.getElementById('fb-block-handmode-row');
  if (handModeRow) {
    handModeRow.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.newBlock.handMode = btn.dataset.handMode;
        renderBlockAddPanel(holder);
      };
    });
  }
  const startHandRow = document.getElementById('fb-block-starthand-row');
  if (startHandRow) {
    startHandRow.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => {
        fb.newBlock.startHand = btn.dataset.startHand;
        startHandRow.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
      };
    });
  }
  renderBlockModeFields();
  document.getElementById('fb-add-block').onclick = () => {
    const b = { type: 'block', grip: blockGripFromSelection(fb.newBlock), fingers: fb.newBlock.fingers, weight: fb.newBlock.weight, mode: fb.newBlock.mode };
    if (fb.newBlock.mode === 'reps') {
      Object.assign(b, { reps: fb.newBlock.reps, workSec: fb.newBlock.workSec, restSec: fb.newBlock.restSec });
    } else {
      Object.assign(b, { reps: fb.newBlock.reps, hangSec: fb.newBlock.hangSec, restSec: fb.newBlock.restSec, blockRestSec: fb.newBlock.blockRestSec, handMode: fb.newBlock.handMode, startHand: fb.newBlock.startHand });
    }
    fb.blocks.push(b);
    renderFbBlocksList();
  };
}
/* Die zweite Zeile Felder je nach Halten/Wiederholungen — separat, damit
   der Moduswechsel nicht das ganze Panel (inkl. Griff/Finger/Gewicht)
   neu aufbauen und den Tipp-Fokus verlieren muss. */
function renderBlockModeFields() {
  const holder = document.getElementById('fb-block-mode-fields');
  if (!holder) return;
  if (fb.newBlock.mode === 'reps') {
    holder.innerHTML = `
      <div class="field-row">
        <div class="field"><label>Ziel-Wdh.</label><input type="number" id="fb-block-reps" value="${fb.newBlock.reps}" min="1"></div>
        <div class="field"><label>Dauer (s)</label><input type="number" id="fb-block-worksec" value="${fb.newBlock.workSec}" min="5"></div>
      </div>
      <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-block-restsec" value="${fb.newBlock.restSec}" min="0"></div>
    `;
    document.getElementById('fb-block-reps').oninput = (e) => { fb.newBlock.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-block-worksec').oninput = (e) => { fb.newBlock.workSec = Number(e.target.value) || 5; };
    document.getElementById('fb-block-restsec').oninput = (e) => { fb.newBlock.restSec = Number(e.target.value) || 0; };
    ['fb-block-reps', 'fb-block-worksec', 'fb-block-restsec'].forEach(selectOnFocus);
  } else {
    holder.innerHTML = `
      <div class="field-row">
        <div class="field"><label>Sätze</label><input type="number" id="fb-block-reps" value="${fb.newBlock.reps}" min="1"></div>
        <div class="field"><label>Halten (s)</label><input type="number" id="fb-block-hangsec" value="${fb.newBlock.hangSec}" min="1"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Pause zw. Sätzen (s)</label><input type="number" id="fb-block-restsec" value="${fb.newBlock.restSec}" min="0"></div>
        <div class="field"><label>Pause danach (s)</label><input type="number" id="fb-block-blockrestsec" value="${fb.newBlock.blockRestSec}" min="0"></div>
      </div>
    `;
    document.getElementById('fb-block-reps').oninput = (e) => { fb.newBlock.reps = Number(e.target.value) || 1; };
    document.getElementById('fb-block-hangsec').oninput = (e) => { fb.newBlock.hangSec = Number(e.target.value) || 1; };
    document.getElementById('fb-block-restsec').oninput = (e) => { fb.newBlock.restSec = Number(e.target.value) || 0; };
    document.getElementById('fb-block-blockrestsec').oninput = (e) => { fb.newBlock.blockRestSec = Number(e.target.value) || 0; };
    ['fb-block-reps', 'fb-block-hangsec', 'fb-block-restsec', 'fb-block-blockrestsec'].forEach(selectOnFocus);
  }
}

/* Reine Pause zum freien Einfügen in den Ablauf — z. B. zwischen zwei
   Board-Sätzen, ohne dass sie an einen bestimmten Satz-Typ gekoppelt ist. */
function renderPauseAddPanel(holder) {
  holder.innerHTML = `
    <div class="field"><label>Pause (s)</label><input type="number" id="fb-new-pause-seconds" value="${fb.newPause.seconds}" min="1"></div>
    <button type="button" class="btn" id="fb-add-pause" style="width:100%;">+ Pause hinzufügen</button>
  `;
  document.getElementById('fb-new-pause-seconds').oninput = (e) => { fb.newPause.seconds = Number(e.target.value) || 1; };
  selectOnFocus('fb-new-pause-seconds');
  document.getElementById('fb-add-pause').onclick = () => {
    fb.blocks.push({ type: 'pause', seconds: fb.newPause.seconds });
    renderFbBlocksList();
  };
}

/* Rechnet Von/Zu/Schrittweite in die konkreten Zwischenstopps um (z. B.
   Von 1, Zu 9, Schrittweite 2 -> 1,3,5,7,9) — reine Vorschau-Anzeige im
   Baukasten; die tatsächliche Umwandlung in ein 'direct'- oder
   'pattern'-Muster-Objekt passiert erst beim Hinzufügen (siehe
   fb-add-campus-Handler), damit sich an den bestehenden zwei
   Bewegungs-Datentypen nichts ändert. */
function campusStepPreview(fromRung, toRung, stepSize) {
  const distance = toRung - fromRung;
  if (distance === 0) return { error: '"Von" und "Zu" dürfen nicht gleich sein.' };
  const dist = Math.abs(distance);
  const steps = dist / stepSize;
  if (!Number.isInteger(steps)) return { error: `Schrittweite muss ${dist} ohne Rest teilen.` };
  const dir = distance > 0 ? 1 : -1;
  const stops = [fromRung];
  for (let i = 0; i < steps; i++) stops.push(stops[stops.length - 1] + dir * stepSize);
  return { stops, steps };
}

/* Hin- plus optionaler Rückweg zu EINER Vorschau + fertigem Pattern
   kombiniert — der Rückweg nutzt seine eigene Schrittweite (rauf in
   2er-Schritten, aber einzeln zurück soll möglich sein). Liefert immer
   ein `pattern`-Array, auch ohne Rückweg (dann nur der Hinweg), damit
   der fb-add-campus-Handler nicht zwischen beiden Fällen unterscheiden
   muss. */
function campusRoundTripPreview(c) {
  const out = campusStepPreview(c.fromRung, c.toRung, c.stepSize);
  if (out.error) return out;
  const dirOut = c.toRung > c.fromRung ? 1 : -1;
  const pattern = Array(out.steps).fill(dirOut * c.stepSize);
  if (!c.returnEnabled) return { stops: out.stops, pattern };
  const back = campusStepPreview(c.toRung, c.returnTo, c.returnStepSize);
  if (back.error) return { error: `Rückweg: ${back.error}` };
  const dirBack = c.returnTo > c.toRung ? 1 : -1;
  pattern.push(...Array(back.steps).fill(dirBack * c.returnStepSize));
  return { stops: [...out.stops, ...back.stops.slice(1)], pattern };
}

/* Beta: Sprossen direkt am Campus-Bild antippen. Die Route wird in den
   bestehenden Feldern gespeichert (2 Stationen = "Von → Zu", mehr =
   Muster mit startRung + pattern), die Zahlen-Stepper darunter bleiben
   als Alternative. */
function campusBuilderStops(c) {
  if (c.routeFresh) return [];
  if (c.moveMode === 'pattern') return campusStopsOf(c);
  const pv = campusRoundTripPreview(c);
  return pv.error ? [c.fromRung, c.toRung] : pv.stops;
}
function campusSetStops(c, stops) {
  c.routeFresh = false;
  c.returnEnabled = false;
  if (stops.length === 2) {
    c.moveMode = 'direct';
    c.fromRung = stops[0]; c.toRung = stops[1];
    c.stepSize = Math.max(1, Math.abs(stops[1] - stops[0]));
  } else {
    c.moveMode = 'pattern';
    c.startRung = stops[0];
    c.pattern = stops.slice(1).map((r, i) => r - stops[i]);
  }
}
function campusPickerSvg(c) {
  const stops = campusBuilderStops(c);
  const typeL = c.rungType;
  const typeR = c.rungSides === 'different' ? (c.rungTypeRight || c.rungType) : c.rungType;
  const stopSet = new Set(stops);
  let shapes = '';
  Object.keys(CAMPUS_GEOMETRY).forEach((t) => {
    const inUse = t === typeL || t === typeR;
    for (let r = 1; r <= 10; r++) {
      const cls = `cr ${inUse ? 'cr-col' : ''} ${inUse && stopSet.has(r) ? 'cr-stop' : ''} ${CAMPUS_GEOMETRY[t].virtual && CAMPUS_GEOMETRY[t].virtual.includes(r) ? 'cr-virtual' : ''}`;
      shapes += campusRungShapes(t, r, cls, `data-type="${t}" data-rung="${r}"`);
    }
  });
  const numbers = {};
  stops.forEach((r, i) => { (numbers[r] = numbers[r] || []).push(i + 1); });
  const [, xR] = campusTypeXRange(typeR);
  const labels = Object.entries(numbers).map(([r, nums]) => {
    const y = campusRungPoint(typeR, Number(r), 'r').y;
    return `<text class="cr-num" x="${Math.min(xR + 8, CAMPUS_IMG_W - 60)}" y="${y + 10}">${nums.join('·')}</text>`;
  }).join('');
  if (c.armMode === 'free') return campusFreePickerSvg(c, shapes, stops, typeL, typeR);
  const path = stops.length > 1 ? `<polyline class="cr-path" points="${stops.map((r) => { const pt = campusRungPoint(typeL, r, 'l'); return `${pt.x},${pt.y}`; }).join(' ')}"/>` : '';
  return `<svg class="campus-pick" viewBox="0 0 ${CAMPUS_IMG_W} ${CAMPUS_IMG_H}" role="group" aria-label="Campusboard: Sprossen antippen">
    <image href="${CAMPUS_BOARD_IMAGE}" x="0" y="0" width="${CAMPUS_IMG_W}" height="${CAMPUS_IMG_H}"/>
    ${shapes}${path}${labels}
  </svg>`;
}
/* "Hand für Hand": Start (S, beide Hände) und jeder Zug als nummerierter
   Punkt auf der Seite der Hand; dezente L/R-Markierung über der Spalte. */
function campusFreePickerSvg(c, shapes, stops, typeL, typeR) {
  const marks = [];
  if (stops.length) {
    ['l', 'r'].forEach((h) => {
      const p = campusRungPoint(h === 'l' ? typeL : typeR, stops[0], h);
      marks.push(`<circle class="cr-move-start ${h}" cx="${p.x}" cy="${p.y}" r="18"/>`); // Start: leerer Ring, beide Hände
    });
  }
  (c.hands || []).forEach((h, i) => {
    const p = campusRungPoint(h === 'l' ? typeL : typeR, stops[i + 1], h);
    marks.push(`<circle class="cr-move ${h}" cx="${p.x}" cy="${p.y}" r="20"/><text class="cr-move-num" x="${p.x}" y="${p.y + 9}">${i + 1}</text>`);
  });
  const guide = [['l', typeL], ['r', typeR]].map(([h, t]) => {

    const p = campusRungPoint(t, 1, h);
    return `<text class="cr-side ${h}" x="${p.x}" y="${CAMPUS_IMG_H + 62}">${h === 'l' ? 'L' : 'R'}</text>`;
  }).join('');
  return `<svg class="campus-pick" viewBox="0 0 ${CAMPUS_IMG_W} ${CAMPUS_IMG_H + 100}" role="group" aria-label="Campusboard: linke oder rechte Hälfte einer Sprosse antippen">
    <image href="${CAMPUS_BOARD_IMAGE}" x="0" y="0" width="${CAMPUS_IMG_W}" height="${CAMPUS_IMG_H}"/>
    ${shapes}${guide}${marks.join('')}
  </svg>`;
}
/* Welche Hand ein Tipp meint: bei unterschiedlichen Spalten die Spalte,
   sonst die Hälfte der Sprosse (Kugeln haben ohnehin eine Seite). */
function campusTapHand(c, el, type, clientX) {
  if (c.rungSides === 'different' && (c.rungTypeRight || c.rungType) !== c.rungType) return type === c.rungType ? 'l' : 'r';
  if (el.dataset.side) return el.dataset.side;
  const r = el.getBoundingClientRect();
  return clientX < r.left + r.width / 2 ? 'l' : 'r';
}
function campusFreeTap(c, el, type, rung, clientX) {
  const stops = campusBuilderStops(c);
  const typeR = c.rungTypeRight || c.rungType;
  if (type !== c.rungType && type !== typeR) {
    if (c.rungSides === 'different') { if (c.pickHand === 'r') c.rungTypeRight = type; else c.rungType = type; }
    else { c.rungType = type; c.routeFresh = true; c.pattern = []; c.hands = []; }
    renderFbAddPanel();
    return;
  }
  if (!stops.length) {
    c.routeFresh = false; c.moveMode = 'pattern'; c.startRung = rung; c.pattern = []; c.hands = [];
    renderFbAddPanel();
    return;
  }
  const hand = campusTapHand(c, el, type, clientX);
  // Wo ist diese Hand gerade? Gleiche Sprosse nochmals = kein Zug.
  let at = stops[0];
  (c.hands || []).forEach((h, i) => { if (h === hand) at = stops[i + 1]; });
  if (at === rung) { toast(`${hand === 'l' ? 'Linke' : 'Rechte'} Hand ist schon an Sprosse ${rung}.`); return; }
  c.pattern = [...c.pattern, rung - stops[stops.length - 1]];
  c.hands = [...(c.hands || []), hand];
  renderFbAddPanel();
}

function wireCampusPicker(c) {
  document.querySelectorAll('.campus-pick .cr[data-rung]').forEach((el) => {
    el.onclick = (e) => {
      if (c.armMode === 'free') { campusFreeTap(c, el, el.dataset.type, Number(el.dataset.rung), e.clientX); return; }
      const type = el.dataset.type;
      const rung = Number(el.dataset.rung);
      const stops = campusBuilderStops(c);
      const typeR = c.rungTypeRight || c.rungType;
      if (c.rungSides === 'different') {
        if (type !== c.rungType && type !== typeR) {
          // Neue Spalte für die gerade gewählte Hand
          if (c.pickHand === 'r') c.rungTypeRight = type;
          else { c.rungType = type; c.pickHand = 'r'; }
          if (!stops.length) { c.routeFresh = false; c.moveMode = 'pattern'; c.startRung = rung; c.pattern = []; }
          renderFbAddPanel();
          return;
        }
      } else if (type !== c.rungType) {
        // Andere Spalte: Typ wechseln und neue Route an dieser Sprosse starten
        c.rungType = type;
        c.routeFresh = false; c.moveMode = 'pattern'; c.startRung = rung; c.pattern = []; c.returnEnabled = false;
        renderFbAddPanel();
        return;
      }
      if (!stops.length) {
        c.routeFresh = false; c.moveMode = 'pattern'; c.startRung = rung; c.pattern = []; c.returnEnabled = false;
      } else if (stops[stops.length - 1] !== rung) {
        campusSetStops(c, [...stops, rung]);
      }
      renderFbAddPanel();
    };
  });
  const sides = document.getElementById('campus-sides-toggle');
  if (sides) sides.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      c.rungSides = btn.dataset.sides;
      if (c.rungSides === 'different') { c.rungTypeRight = c.rungTypeRight || c.rungType; c.pickHand = 'l'; }
      renderFbAddPanel();
    };
  });
  const pick = document.getElementById('campus-pickhand-toggle');
  if (pick) pick.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.pickHand = btn.dataset.pick; renderFbAddPanel(); };
  });
  const undo = document.getElementById('campus-route-undo');
  if (undo) undo.onclick = () => {
    if (c.armMode === 'free') {
      if (c.hands.length) { c.hands = c.hands.slice(0, -1); c.pattern = c.pattern.slice(0, -1); } else c.routeFresh = true;
      renderFbAddPanel();
      return;
    }
    const stops = campusBuilderStops(c).slice(0, -1);
    if (stops.length >= 2) campusSetStops(c, stops);
    else if (stops.length === 1) { c.moveMode = 'pattern'; c.startRung = stops[0]; c.pattern = []; }
    else c.routeFresh = true;
    renderFbAddPanel();
  };
  document.getElementById('campus-route-new').onclick = () => { c.routeFresh = true; c.pattern = []; c.hands = []; renderFbAddPanel(); };
}

/* Campus-Board: keine Foto-Hotspots wie beim Hangboard (Sprossen sind
   durchnummeriert, immer in einer Spalte) — stattdessen Sprossen-TYP per
   Chip + die Bewegung rein über Zahlen/Stepper, entweder als direkter
   Sprung ("Von → Zu", optional mit Zwischenstopps über die Schrittweite)
   oder als sich wiederholendes Muster ("+2/-1 usw."). */
function renderCampusAddPanel(holder) {
  const c = fb.newCampus;
  holder.innerHTML = `
    <div class="field">
      <label>Sprossen-Typ</label>
      <div class="chip-row" id="campus-rung-toggle" style="margin-bottom:6px;">
        ${CAMPUS_RUNG_TYPES.map((t) => `<button type="button" class="chip ${c.rungType === t.id ? 'active' : ''}" data-rung="${t.id}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="chip-row" id="campus-sides-toggle" style="margin:8px 0 8px;">
        <button type="button" class="chip ${c.rungSides !== 'different' ? 'active' : ''}" data-sides="same">Beide Hände gleich</button>
        <button type="button" class="chip ${c.rungSides === 'different' ? 'active' : ''}" data-sides="different">Unterschiedlich</button>
      </div>
      ${c.rungSides === 'different' ? `
        <div class="chip-row" id="campus-pickhand-toggle" style="margin-bottom:8px;">
          <button type="button" class="chip ${c.pickHand !== 'r' ? 'active' : ''}" data-hand-color="l" data-pick="l">Links: ${esc(campusRungLabel(c.rungType))}</button>
          <button type="button" class="chip ${c.pickHand === 'r' ? 'active' : ''}" data-hand-color="r" data-pick="r">Rechts: ${esc(campusRungLabel(c.rungTypeRight || c.rungType))}</button>
        </div>` : ''}
      <div class="campus-pick-wrap">${campusPickerSvg(c)}</div>
      <div class="campus-pick-bar">
        <span class="campus-pick-route">${(() => {
          const st = campusBuilderStops(c);
          if (c.armMode === 'free') {
            if (!st.length) return '1. Tipp = Start (beide Hände), dann links/rechts auf die Sprosse tippen';
            return c.hands.length ? `S${st[0]} · ${campusFreeMovesText({ ...c, moveMode: 'pattern' })}` : `Start ${st[0]} (beide) · jetzt linke oder rechte Hälfte antippen`;
          }
          return st.length ? st.join(' → ') : 'Sprossen der Reihe nach antippen: 1. Tipp = Start';
        })()}</span>
        <button type="button" class="btn ghost small" id="campus-route-undo" ${campusBuilderStops(c).length ? '' : 'disabled'}>Zurück</button>
        <button type="button" class="btn ghost small" id="campus-route-new">Neu</button>
      </div>
    </div>

    ${c.armMode === 'free' ? '' : `<div class="field">
      <label>Bewegung</label>
      <div class="chip-row" id="campus-mode-toggle" style="margin-bottom:10px;">
        <button type="button" class="chip ${c.moveMode === 'direct' ? 'active' : ''}" data-mode="direct">Von → Zu</button>
        <button type="button" class="chip ${c.moveMode === 'pattern' ? 'active' : ''}" data-mode="pattern">Muster</button>
      </div>
      ${c.moveMode === 'direct' ? `
        <div class="stepper-row">
          <div style="flex:1;">
            <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Von Sprosse</div>
            <div class="stepper-row">
              <button type="button" class="stepper-btn" data-step="fromRung" data-dir="-1">−</button>
              <div class="stepper-num">${c.fromRung}</div>
              <button type="button" class="stepper-btn" data-step="fromRung" data-dir="1">+</button>
            </div>
          </div>
          <div class="arrow">→</div>
          <div style="flex:1;">
            <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Zu Sprosse</div>
            <div class="stepper-row">
              <button type="button" class="stepper-btn" data-step="toRung" data-dir="-1">−</button>
              <div class="stepper-num">${c.toRung}</div>
              <button type="button" class="stepper-btn" data-step="toRung" data-dir="1">+</button>
            </div>
          </div>
        </div>
        <div class="fb-checkin-label" style="text-align:left;margin:14px 0 6px;">Schrittweite</div>
        <div class="stepper-row">
          <button type="button" class="stepper-btn" data-step="stepSize" data-dir="-1">−</button>
          <div class="stepper-num">${c.stepSize}</div>
          <button type="button" class="stepper-btn" data-step="stepSize" data-dir="1">+</button>
        </div>
        <div class="campus-step-hint">Schrittweite = Distanz: ein einziger Sprung, wie ein normaler Von→Zu-Satz. Kleiner: mehrere Zwischenstopps (z. B. Sprossen überspringen).</div>
        <div class="chip-row" id="campus-return-toggle" style="margin:10px 0 ${c.returnEnabled ? '10px' : '0'};">
          <button type="button" class="chip ${c.returnEnabled ? 'active' : ''}" data-toggle-return="1">↩ Und wieder zurück</button>
        </div>
        ${c.returnEnabled ? `
          <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Zurück zu Sprosse</div>
          <div class="stepper-row">
            <button type="button" class="stepper-btn" data-step="returnTo" data-dir="-1">−</button>
            <div class="stepper-num">${c.returnTo}</div>
            <button type="button" class="stepper-btn" data-step="returnTo" data-dir="1">+</button>
          </div>
          <div class="fb-checkin-label" style="text-align:left;margin:14px 0 6px;">Rückweg-Schrittweite</div>
          <div class="stepper-row">
            <button type="button" class="stepper-btn" data-step="returnStepSize" data-dir="-1">−</button>
            <div class="stepper-num">${c.returnStepSize}</div>
            <button type="button" class="stepper-btn" data-step="returnStepSize" data-dir="1">+</button>
          </div>
        ` : ''}
        ${(() => {
          const preview = campusRoundTripPreview(c);
          return preview.error
            ? `<div class="campus-step-preview error">${esc(preview.error)}</div>`
            : `<div class="campus-step-preview"><span class="label">Ergibt</span><span class="route">${preview.stops.join(' → ')}</span></div>`;
        })()}
      ` : `
        <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Start-Sprosse</div>
        <div class="stepper-row" style="margin-bottom:14px;">
          <button type="button" class="stepper-btn" data-step="startRung" data-dir="-1">−</button>
          <div class="stepper-num">${c.startRung}</div>
          <button type="button" class="stepper-btn" data-step="startRung" data-dir="1">+</button>
        </div>
        <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Muster antippen (wiederholt sich automatisch)</div>
        <div class="chip-row" style="margin-bottom:0;">
          <button type="button" class="pattern-btn up" data-add-pat="1">+1</button>
          <button type="button" class="pattern-btn up" data-add-pat="2">+2</button>
          <button type="button" class="pattern-btn up" data-add-pat="3">+3</button>
          <button type="button" class="pattern-btn down" data-add-pat="-1">−1</button>
          <button type="button" class="pattern-btn down" data-add-pat="-2">−2</button>
        </div>
        <div class="pattern-strip">
          ${c.pattern.length
            ? c.pattern.map((p) => `<span class="pattern-pill ${p < 0 ? 'down' : ''}">${Math.abs(p)} ${p > 0 ? '↑' : '↓'}</span>`).join('')
            : '<span class="mono" style="color:var(--ink-faint);font-size:12px;">noch kein Muster</span>'}
          ${c.pattern.length ? '<span class="pattern-clear" id="campus-pattern-clear">Zurücksetzen ×</span>' : ''}
        </div>
      `}
    </div>`}

    <div class="field">
      <label>Bewegungsart</label>
      <div class="chip-row" id="campus-armmode-toggle" style="margin-bottom:${c.armMode === 'both' ? '0' : '10px'};">
        <button type="button" class="chip ${c.armMode === 'both' ? 'active' : ''}" data-arm="both"><span class="emoji">🙌</span>${campusArmModeLabel('both')}</button>
        <button type="button" class="chip ${c.armMode === 'match' ? 'active' : ''}" data-arm="match"><span class="emoji">🔄</span>${campusArmModeLabel('match')}</button>
        <button type="button" class="chip ${c.armMode === 'skip' ? 'active' : ''}" data-arm="skip"><span class="emoji">🔃</span>${campusArmModeLabel('skip')}</button>
        <button type="button" class="chip ${c.armMode === 'free' ? 'active' : ''}" data-arm="free"><span class="emoji">✋</span>${campusArmModeLabel('free')}</button>
      </div>
      ${c.armMode === 'free' ? '<div class="campus-step-hint">Im Bild oben: erster Tipp = Start mit beiden Händen, danach die <b>linke oder rechte Hälfte</b> einer Sprosse antippen — das ist die Hand, die greift.</div>' : ''}
      ${c.armMode === 'skip' ? `
        <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Am Ende</div>
        <div class="chip-row" id="campus-skipend-toggle" style="margin-bottom:10px;">
          <button type="button" class="chip ${c.skipEnd !== 'match' ? 'active' : ''}" data-skipend="one">Einhändig halten</button>
          <button type="button" class="chip ${c.skipEnd === 'match' ? 'active' : ''}" data-skipend="match">Nachziehen (beide am Ziel)</button>
        </div>` : ''}
      ${c.armMode !== 'both' && c.armMode !== 'free' ? `
        <div class="fb-checkin-label" style="text-align:left;margin-bottom:6px;">Starthand</div>
        <div class="chip-row" id="campus-starthand-toggle" style="margin-bottom:0;">
          <button type="button" class="chip ${c.startHand === 'left' ? 'active' : ''}" data-hand="left"><span class="emoji">🫲</span>Links zuerst</button>
          <button type="button" class="chip ${c.startHand === 'right' ? 'active' : ''}" data-hand="right"><span class="emoji">🫱</span>Rechts zuerst</button>
        </div>
      ` : ''}
    </div>

    <div class="field-row">
      <div class="field"><label>${c.moveMode === 'pattern' ? 'Wdh. des Musters' : 'Sätze'}</label><input type="number" id="campus-reps" value="${c.reps}" min="1"></div>
      <div class="field"><label>Ausführung (s)</label><input type="number" id="campus-worksec" value="${c.workSec}" min="1"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Pause zw. Sätzen (s)</label><input type="number" id="campus-restsec" value="${c.restSec}" min="0"></div>
      <div class="field"><label>Pause danach (s)</label><input type="number" id="campus-blockrestsec" value="${c.blockRestSec}" min="0"></div>
    </div>
    <button type="button" class="btn" id="fb-add-campus" style="width:100%;">+ Campus-Satz hinzufügen</button>
  `;

  document.getElementById('campus-rung-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.rungType = btn.dataset.rung; renderFbAddPanel(); };
  });
  wireCampusPicker(c);
  const modeToggle = document.getElementById('campus-mode-toggle');
  if (modeToggle) modeToggle.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.moveMode = btn.dataset.mode; renderFbAddPanel(); };
  });
  document.getElementById('campus-armmode-toggle').querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      const next = btn.dataset.arm;
      if (next === c.armMode) return;
      const stops = campusBuilderStops(c);
      if (next === 'free') {
        // Route neu Hand für Hand aufbauen — nur den Start übernehmen.
        c.moveMode = 'pattern'; c.pattern = []; c.hands = [];
        if (stops.length) { c.startRung = stops[0]; c.routeFresh = false; } else c.routeFresh = true;
      } else if (c.armMode === 'free') {
        c.hands = []; c.pattern = []; c.routeFresh = !stops.length;
      }
      c.armMode = next;
      renderFbAddPanel();
    };
  });
  const skipEnd = document.getElementById('campus-skipend-toggle');
  if (skipEnd) skipEnd.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => { c.skipEnd = btn.dataset.skipend; renderFbAddPanel(); };
  });
  const startHandToggle = document.getElementById('campus-starthand-toggle');
  if (startHandToggle) {
    startHandToggle.querySelectorAll('.chip').forEach((btn) => {
      btn.onclick = () => { c.startHand = btn.dataset.hand; renderFbAddPanel(); };
    });
  }
  const returnToggle = document.getElementById('campus-return-toggle');
  if (returnToggle) {
    returnToggle.querySelector('.chip').onclick = () => {
      c.returnEnabled = !c.returnEnabled;
      // Beim Einschalten sinnvolle Defaults setzen: zurück zum Start,
      // gleiche Schrittweite wie der Hinweg (deckt den häufigsten Fall —
      // ganz zurück — ab, ohne dass man erst alles selbst eintippen muss).
      if (c.returnEnabled) { c.returnTo = c.fromRung; c.returnStepSize = c.stepSize; }
      renderFbAddPanel();
    };
  }
  holder.querySelectorAll('[data-step]').forEach((btn) => {
    btn.onclick = () => {
      const field = btn.dataset.step;
      c[field] = Math.max(1, c[field] + Number(btn.dataset.dir));
      // Von/Zu geändert -> Schrittweite auf die neue volle Distanz
      // zurücksetzen (= ein einziger Sprung, wie bisher), sonst bliebe
      // nach einer Bereichsänderung eine Schrittweite stehen, die nicht
      // mehr zur neuen Distanz passt. Wird nur die Schrittweite selbst
      // angetippt, bleibt sie unangetastet. Rückweg-Schrittweite genauso,
      // sobald sich Zu oder das Rückweg-Ziel ändert.
      if (field === 'fromRung' || field === 'toRung') c.stepSize = Math.max(1, Math.abs(c.toRung - c.fromRung));
      if ((field === 'toRung' || field === 'returnTo') && c.returnEnabled) {
        c.returnStepSize = Math.max(1, Math.abs(c.returnTo - c.toRung));
      }
      renderFbAddPanel();
    };
  });
  holder.querySelectorAll('[data-add-pat]').forEach((btn) => {
    btn.onclick = () => { c.pattern.push(Number(btn.dataset.addPat)); renderFbAddPanel(); };
  });
  const clearBtn = document.getElementById('campus-pattern-clear');
  if (clearBtn) clearBtn.onclick = () => { c.pattern = []; renderFbAddPanel(); };
  document.getElementById('campus-reps').oninput = (e) => { c.reps = Number(e.target.value) || 1; };
  document.getElementById('campus-worksec').oninput = (e) => { c.workSec = Number(e.target.value) || 1; };
  document.getElementById('campus-restsec').oninput = (e) => { c.restSec = Number(e.target.value) || 0; };
  document.getElementById('campus-blockrestsec').oninput = (e) => { c.blockRestSec = Number(e.target.value) || 0; };
  document.getElementById('fb-add-campus').onclick = () => {
    if (c.armMode === 'free' && (c.routeFresh || !(c.hands || []).length)) { toast('Zuerst Start und mindestens einen Zug im Bild antippen.', 'err'); return; }
    if (c.routeFresh || (c.moveMode === 'pattern' && !c.pattern.length)) { toast('Zuerst mindestens zwei Sprossen antippen (oder ein Muster wählen).', 'err'); return; }
    const pushCampus = (blk) => {
      const out = { ...blk };
      delete out.rungSides; delete out.pickHand; delete out.routeFresh;
      if (out.armMode === 'free') out.hands = (c.hands || []).slice(); else delete out.hands;
      if (out.armMode !== 'skip') delete out.skipEnd;
      if (c.rungSides !== 'different' || !out.rungTypeRight || out.rungTypeRight === out.rungType) delete out.rungTypeRight;
      fb.blocks.push(out);
    };
    if (c.moveMode === 'direct') {
      const preview = campusRoundTripPreview(c);
      if (preview.error) { toast(preview.error, 'err'); return; }
      if (preview.pattern.length > 1) {
        // Schrittweite < volle Distanz und/oder ein Rückweg dazu -> mit
        // Zwischenstopps: intern als 'pattern'-Satz gespeichert (kein
        // neuer Datentyp nötig, exakt dieselbe Struktur wie ein von Hand
        // gebautes Muster).
        pushCampus({ type: 'campus', ...c, moveMode: 'pattern', startRung: c.fromRung, pattern: preview.pattern });
        renderFbBlocksList();
        return;
      }
    }
    pushCampus({ type: 'campus', ...c, pattern: c.pattern.slice() });
    renderFbBlocksList();
  };
}
