/* js/challenges.js — Tab Challenges: Badge für neue Challenges, teilen, Crew-Umschalter, renderChallenges */
/* ================================================================
   BENACHRICHTIGUNGSPUNKT (Challenges)
   Echtes Push (auch bei geschlossener App) bräuchte einen eigenen Server,
   der bei einer neuen Challenge aktiv etwas an alle Geräte schickt — das
   hat diese App (rein statisch, direkt gegen Firebase) nicht. Was ohne
   Server geht: sobald die App geöffnet wird, im Hintergrund nachsehen, ob
   es neue Challenges von anderen gibt, und dafür sowohl einen Punkt im
   Tab-Menü als auch — wo vom Betriebssystem unterstützt (Badging API,
   z. B. installierte PWA auf Android/Desktop) — einen Zähler direkt auf
   dem App-Icon setzen. Kein Echtzeit-Push bei gesperrtem Handy, aber
   sichtbar, sobald man die App das nächste Mal öffnet. */
let challengeUnseenCount = 0;

function getChallengesSeenAt() {
  return Number(localStorage.getItem(STORAGE_PREFIX + 'challenges_seen_at') || 0);
}
/* Zählt neue Challenges über alle eigenen Crews (nicht nur die aktive). */
async function refreshChallengeUnseen() {
  let n = 0;
  await Promise.all(Object.keys(state.crews).map(async (id) => {
    const raw = await fbGet(`crewData/${id}/challenges`);
    if (raw) n += countUnseenChallenges(raw);
  }));
  if (state.member) setChallengeUnseenCount(n);
}
function countUnseenChallenges(challengesObj) {
  const seenAt = getChallengesSeenAt();
  const now = Date.now();
  return Object.values(challengesObj || {})
    .filter((c) => c.createdBy !== state.member.id && c.createdAt > seenAt && now < c.expiresAt)
    .length;
}
function setChallengeUnseenCount(n) {
  challengeUnseenCount = n;
  const dot = document.getElementById('nav-challenge-dot');
  if (dot) dot.hidden = n === 0;
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
    else if (n === 0 && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch (e) { /* Badging API evtl. nicht unterstützt */ }
}
function markChallengesSeenNow() {
  try { localStorage.setItem(STORAGE_PREFIX + 'challenges_seen_at', String(Date.now())); } catch (e) { /* ignorieren */ }
  setChallengeUnseenCount(0);
}

/* ================================================================
   CHALLENGES
   Keine eigene "Challenge bauen"-Maske mehr mit Griff/Protokoll/Übungen —
   eine Challenge ist ein bereits gemachtes (Fingerboard-Ablauf, s.
   finishAblauf) oder geplantes/Freestyle-Training (Log-Verlauf, s.
   renderLog), das man mit einem Tap für die Crew freigibt. Absichtlich
   kein Punkte-, Zeit- oder Gewichtsvergleich zwischen den Mitgliedern —
   es zählt nur "mitgemacht oder nicht", die Challenge soll Anreiz zum
   Training sein, kein Wettkampf um besser/schlechter.
   ================================================================= */
const HOUR_MS = 60 * 60 * 1000;
const CHALLENGE_WINDOW_H = 72; // Vorbelegung beim Teilen, frei wählbar (s. CHALLENGE_DURATIONS)
/* Schichtarbeiter schaffen ein Training nicht immer innerhalb von 72h —
   deshalb frei wählbar statt fest, mit 1 Woche als Obergrenze (mehr würde
   "Challenge" als kurzfristigen Anreiz zu sehr verwässern). */
const CHALLENGE_DURATIONS = [
  { hours: 24, label: '24H' },
  { hours: 72, label: '72H' },
  { hours: 168, label: '1 WOCHE' },
];

function challengeDurationChipsHtml(prefix, selectedHours) {
  return `<div class="chip-row chal-duration-row" id="${prefix}-duration">
    ${CHALLENGE_DURATIONS.map((d) => `<button type="button" class="chip ${d.hours === selectedHours ? 'active' : ''}" data-hours="${d.hours}">${d.label}</button>`).join('')}
  </div>`;
}
function wireChallengeDurationChips(prefix) {
  const holder = document.getElementById(`${prefix}-duration`);
  if (!holder) return;
  holder.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => holder.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === btn));
  });
}
function selectedChallengeHours(prefix) {
  const holder = document.getElementById(`${prefix}-duration`);
  const active = holder && holder.querySelector('.chip.active');
  return active ? Number(active.dataset.hours) : CHALLENGE_WINDOW_H;
}

async function pushChallenge(fields, hours) {
  const crew = activeCrew();
  if (!crew) { toast('Du bist in keiner Crew — unter KONTO beitreten.', 'err'); return null; }
  const now = Date.now();
  const windowH = hours || CHALLENGE_WINDOW_H;
  const participants = {};
  for (const id of Object.keys(crew.members || {})) {
    participants[id] = id === state.member.id ? { status: 'done', completedAt: now } : { status: 'pending' };
  }
  const challenge = {
    createdBy: state.member.id,
    createdByName: state.member.name,
    createdAt: now,
    expiresAt: now + windowH * HOUR_MS,
    participants,
    ...fields,
  };
  const id = await fbPush(`crewData/${state.crewId}/challenges`, challenge);
  if (id) toast(`Challenge raus an ${crew.name} (${windowH}h Zeit)!`, 'ok');
  else toast('Konnte Challenge nicht senden.', 'err');
  return id;
}

function shareFingerboardAsChallenge(board, blocks, hours) {
  const names = customNamesFor(blocks.filter((b) => b.exerciseId).map((b) => b.exerciseId));
  return pushChallenge({ kind: 'fingerboard', board, blocks, ...(Object.keys(names).length ? { customNames: names } : {}) }, hours);
}

function shareLogEntryAsChallenge(entry, hours) {
  const names = customNamesFor((entry.exercises || []).map((x) => x.exerciseId));
  return pushChallenge({
    ...(Object.keys(names).length ? { customNames: names } : {}),
    kind: 'session',
    sessionType: entry.type,
    exercises: entry.exercises,
    ...(entry.durationMin ? { durationMin: entry.durationMin } : {}),
    note: entry.note || '',
  }, hours);
}

/* Umschalter, wenn man in mehreren Crews ist — Challenges und geteilte
   Vorlagen gelten immer für die aktive Crew. */
function crewSwitchHtml() {
  const ids = Object.keys(state.crews);
  if (ids.length < 2) return '';
  return `<div class="chip-row" id="crew-switch">${ids.map((id) => `<button type="button" class="chip ${id === state.crewId ? 'active' : ''}" data-crew="${esc(id)}">${esc(state.crews[id].name)}</button>`).join('')}</div>`;
}
function wireCrewSwitch(onChange) {
  document.querySelectorAll('#crew-switch .chip').forEach((b) => {
    b.onclick = () => { setActiveCrew(b.dataset.crew); onChange(); };
  });
}

async function renderChallenges() {
  const crew = activeCrew();
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Challenges</h2><div class="sec-rule"></div></div>
    ${crewSwitchHtml()}
    ${crew ? `<p class="login-hint" style="margin:0 0 16px;text-align:left;">Ein Training fertig gemacht? Im Fingerboard (nach "Ablauf geschafft") oder im Log-Verlauf kannst du es <b>${esc(crew.name)}</b> als Challenge vorschlagen — Zeitfenster beim Teilen wählbar (24h bis 1 Woche).</p>` : ''}
    <div class="list" id="challenge-list"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
  `);
  wireCrewSwitch(() => { loadSharedTemplates(); renderChallenges(); });
  if (!crew) {
    document.getElementById('challenge-list').innerHTML = `<div class="pg-card empty-invite">
      ${slothFigure('flex', 'empty-invite-sloth')}
      <h3>Trainiert zusammen</h3>
      <p class="pg-muted">Challenges laufen in einer Crew. Mit einem Einladungscode trittst du bei und siehst, was die anderen vorlegen.</p>
      <div class="empty-invite-actions"><a class="btn" href="#konto">Crew beitreten</a></div>
    </div>`;
    return;
  }
  const base = `crewData/${state.crewId}/challenges`;

  const raw = await fbGet(base);
  state.challenges = raw || {};
  Object.values(state.challenges).forEach((c) => rememberForeignExerciseNames(c.customNames));
  markChallengesSeenNow();
  const now = Date.now();

  // Abgelaufene, unbestätigte Teilnahmen als "expired" markieren (lazy).
  for (const [id, c] of Object.entries(state.challenges)) {
    if (now > c.expiresAt && c.participants) {
      for (const [pid, p] of Object.entries(c.participants)) {
        if (p.status === 'pending') {
          fbPatch(`${base}/${id}/participants/${pid}`, { status: 'expired' });
          p.status = 'expired';
        }
      }
    }
  }

  const entries = Object.entries(state.challenges).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  const list = document.getElementById('challenge-list');
  if (!list) return; // Nutzer hat inzwischen weiternavigiert
  list.innerHTML = entries.length ? entries.map(([id, c]) => renderChallengeCard(id, c, now)).join('') : '<div class="list-empty">Noch keine Challenges — teile ein fertiges Training, um die erste zu starten.</div>';

  list.querySelectorAll('[data-toggle-done]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.toggleDone;
      const c = state.challenges[id];
      const myStatus = c && c.participants && c.participants[state.member.id] && c.participants[state.member.id].status;
      if (myStatus === 'done') {
        await fbPatch(`${base}/${id}/participants/${state.member.id}`, { status: 'pending', completedAt: null });
        toast('Zurückgesetzt.', 'ok');
      } else {
        await fbPatch(`${base}/${id}/participants/${state.member.id}`, { status: 'done', completedAt: Date.now() });
        toast('Mitgemacht — stark!', 'ok');
      }
      renderChallenges();
    };
  });
  // "Annehmen" kopiert die Challenge in den eigenen Ablauf-Baukasten (Board
  // bzw. Plan), statt sie nur als erledigt zu markieren — so kann man sie
  // auch wirklich NACHMACHEN, nicht nur bestätigen, dass man sie schon kennt.
  list.querySelectorAll('[data-accept]').forEach((btn) => {
    btn.onclick = () => {
      const c = state.challenges[btn.dataset.accept];
      if (!c) return;
      if (c.kind === 'fingerboard') {
        if (fb.blocks.length && !confirm('Aktuellen Fingerboard-Ablauf durch diese Challenge ersetzen?')) return;
        fb.board = fb.board || currentMemberBoard();
        fb.blocks = fbBlocksWithCurrentBoard(c.blocks || []);
        renderFbBlocksList();
        location.hash = '#fingerboard';
        toast('Challenge in den Ablauf geladen — leg los!', 'ok');
      } else if (c.kind === 'session') {
        if (logBuilder.exercises.length && !confirm('Aktuellen Plan durch diese Challenge ersetzen?')) return;
        logBuilder.exercises = (c.exercises || []).map((g) => {
          const first = (g.sets || [])[0] || {};
          return { exerciseId: g.exerciseId, sets: (g.sets || []).length || 3, reps: first.reps ?? '', weight: first.weight ?? '' };
        });
        saveDraft('log_exercises', logBuilder.exercises);
        logMode = 'planned';
        location.hash = '#log';
        toast('Challenge als Plan geladen — leg los!', 'ok');
      }
    };
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Diese Challenge wirklich löschen?')) return;
      await fbDelete(`${base}/${btn.dataset.delete}`);
      toast('Challenge gelöscht.', 'ok');
      renderChallenges();
    };
  });
}

function renderChallengeCard(id, c, now) {
  const expired = now > c.expiresAt;
  const hoursLeft = Math.max(0, Math.ceil((c.expiresAt - now) / HOUR_MS));
  const my = c.participants && c.participants[state.member.id];
  const myDone = my && my.status === 'done';
  const isMine = c.createdBy === state.member.id;

  let title, detail;
  if (c.kind === 'fingerboard') {
    title = `Fingerboard · ${esc(BOARDS[c.board].label)}`;
    detail = (c.blocks || []).map((b) => {
      if (b.type === 'hang') return `<div class="ex core">Hang @ ${esc(hangGripLabel({ ...b, board: b.board || c.board }))} · ${b.hangSec}s × ${esc(String(b.reps))} · ${b.restSec}s Pause</div>`;
      if (b.type === 'block' && b.mode === 'reps') return `<div class="ex core">Lifting Pin @ ${esc(blockGripLabel(b))} · ${b.workSec || 40}s × ${esc(String(b.reps))}</div>`;
      if (b.type === 'block') return `<div class="ex core">Lifting Pin @ ${esc(blockGripLabel(b))} · ${b.hangSec}s × ${esc(String(b.reps))} · ${b.restSec}s Pause</div>`;
      if (b.type === 'pause') return `<div class="ex core">⏸ Pause · ${b.seconds}s</div>`;
      return `<div class="ex core">${esc(exerciseName(b.exerciseId))} · ${b.workSec || 40}s × ${esc(String(b.reps))}</div>`;
    }).join('');
  } else {
    title = LOG_TYPE_LABEL[c.sessionType] || esc(c.sessionType || 'Training');
    detail = c.durationMin
      ? `<div class="ex core">${sessionTypeIconLabel(c.sessionType)} · ${c.durationMin} Min.</div>`
      : (c.exercises || []).map((ex) => `<div class="ex core">${esc(exerciseName(ex.exerciseId))} · ${esc(fbExerciseSetsText(ex))}</div>`).join('');
  }

  return `
    <div class="challenge-card ${expired ? 'expired' : ''}">
      <span class="stamp ${myDone ? 'done' : ''}">${expired ? 'VORBEI' : hoursLeft + 'H'}</span>
      <p class="chal-from">Von <b>${esc(c.createdByName)}</b> · ${title}</p>
      <div class="exlist">${detail || '<div class="ex">Keine Details.</div>'}</div>
      ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
      <div class="crew">
        ${Object.entries(c.participants || {}).map(([pid, p]) => `<span class="p ${p.status}">${esc((state.members[pid] || {}).name || '?')}</span>`).join('')}
      </div>
      <div class="chal-actions">
        ${(!expired && (c.kind === 'fingerboard' || (c.kind === 'session' && (c.exercises || []).length))) ? `<button class="btn small" data-accept="${id}">ANNEHMEN</button>` : ''}
        ${(!expired && my) ? `<button class="btn ghost small" data-toggle-done="${id}">${myDone ? '✓ MITGEMACHT' : 'MITGEMACHT'}</button>` : ''}
        ${isMine ? `<button class="btn ghost small" data-delete="${id}">LÖSCHEN</button>` : ''}
      </div>
    </div>
  `;
}
