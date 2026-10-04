/* js/login.js — Login, Registrierung, Einladungscode, Onboarding, Migration, Abmelden */
/* ================================================================
   LOGIN — eigenes Konto pro Person (E-Mail + Passwort). Neu dabei nur
   mit Einladungscode einer Crew; die drei bisherigen Profile (Team-Login-
   Zeit) werden beim ersten Anmelden per "Das bin ich" übernommen.
   ================================================================= */
const AUTH_ERRORS = {
  INVALID_LOGIN_CREDENTIALS: 'E-Mail oder Passwort stimmt nicht.',
  INVALID_PASSWORD: 'E-Mail oder Passwort stimmt nicht.',
  EMAIL_NOT_FOUND: 'E-Mail oder Passwort stimmt nicht.',
  EMAIL_EXISTS: 'Zu dieser E-Mail gibt es schon ein Konto — bitte anmelden.',
  INVALID_EMAIL: 'Das ist keine gültige E-Mail-Adresse.',
  MISSING_PASSWORD: 'Bitte Passwort eingeben.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Zu viele Versuche — bitte später nochmal.',
  USER_DISABLED: 'Dieses Konto ist gesperrt.',
  NETWORK_ERROR: 'Keine Verbindung — bitte später nochmal versuchen.',
};
function authErrorText(code) {
  if (String(code).startsWith('WEAK_PASSWORD')) return 'Passwort zu kurz — mindestens 6 Zeichen.';
  return AUTH_ERRORS[code] || `Hat nicht geklappt (${code}).`;
}

function loginShell(inner) {
  APP_ROOT.innerHTML = `
    <div class="login-shell">
      <img class="login-logo" src="${ASSET_BASE}icon-512-any.png" alt="Pincho">
      ${inner}
    </div>
  `;
}

function renderLoginMessage(text, withRetry) {
  loginShell(`
    <p class="login-tag">${esc(text)}</p>
    ${withRetry ? '<button class="btn" id="login-retry">NOCHMAL</button><button type="button" class="link-btn" id="login-signout">Abmelden</button>' : ''}
  `);
  if (withRetry) {
    document.getElementById('login-retry').onclick = boot;
    document.getElementById('login-signout').onclick = () => logout(true);
  }
}

function renderAuthScreen(mode) {
  const isSignup = mode === 'signup';
  loginShell(`
    <p class="login-tag">${APP_TAGLINE}</p>
    <div class="chip-row auth-tabs">
      <button type="button" class="chip ${isSignup ? '' : 'active'}" data-mode="login">Anmelden</button>
      <button type="button" class="chip ${isSignup ? 'active' : ''}" data-mode="signup">Neu registrieren</button>
    </div>
    <div class="field"><label>E-Mail</label><input type="email" id="auth-email" autocomplete="email" autocapitalize="off"></div>
    <div class="field"><label>Passwort</label><input type="password" id="auth-password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="${isSignup ? 'mindestens 6 Zeichen' : ''}"></div>
    ${isSignup ? `<div class="field"><label>Einladungscode</label><input type="text" id="auth-code" autocapitalize="characters" autocomplete="off" placeholder="z. B. K7P2QX" value="${esc(inviteCodeFromUrl())}"></div>` : ''}
    <button class="btn" id="auth-submit">${isSignup ? 'KONTO ERSTELLEN' : 'REIN AN DIE WAND'}</button>
    <p class="login-hint" id="auth-hint">${isSignup ? 'Den Code bekommst du von der Person, die dich einlädt. Deine Trainings sieht nur du; die Crew sieht nur, was du mit ihr teilst.' : ''}</p>
    ${isSignup ? '<p class="login-hint">Mit der Registrierung akzeptierst du die <a href="#datenschutz">Datenschutz-Info</a>.</p>' : '<button type="button" class="link-btn" id="auth-forgot">Passwort vergessen?</button>'}
    <a class="link-btn" href="#datenschutz">Datenschutz</a>
  `);
  document.querySelectorAll('.auth-tabs .chip').forEach((b) => { b.onclick = () => renderAuthScreen(b.dataset.mode); });
  const submit = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const codeEl = document.getElementById('auth-code');
    const code = codeEl ? normalizeInviteCode(codeEl.value) : '';
    const hint = document.getElementById('auth-hint');
    const fail = (t) => { hint.textContent = t; hint.style.color = 'var(--danger)'; };
    if (!email) { fail('Bitte E-Mail eingeben.'); return; }
    const btn = document.getElementById('auth-submit');
    btn.disabled = true;
    const r = isSignup ? await signUpEmail(email, password) : await signInEmail(email, password);
    btn.disabled = false;
    if (!r.ok) { fail(authErrorText(r.code)); return; }
    if (isSignup) { if (code) submitInviteCode(code); else renderOnboarding(); return; }
    boot();
  };
  document.getElementById('auth-submit').onclick = submit;
  APP_ROOT.querySelectorAll('input').forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
  const forgot = document.getElementById('auth-forgot');
  if (forgot) forgot.onclick = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const hint = document.getElementById('auth-hint');
    if (!email) { hint.textContent = 'Zuerst oben die E-Mail eingeben.'; hint.style.color = 'var(--danger)'; return; }
    const r = await sendPasswordReset(email);
    hint.style.color = '';
    hint.textContent = r.ok || r.code === 'EMAIL_NOT_FOUND'
      ? 'Falls es zu dieser E-Mail ein Konto gibt, ist ein Link zum Zurücksetzen unterwegs.'
      : authErrorText(r.code);
  };
}

/* Einladungslink …/?code=K7P2QX: Code vorausfüllen. */
function inviteCodeFromUrl() {
  try { return normalizeInviteCode(new URLSearchParams(location.search).get('code')); } catch (e) { return ''; }
}

/* ---------- Einstieg: Einladungscode → "Das bin ich" oder neues Profil ---------- */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O, 1/I
function normalizeInviteCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function randomInviteCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
}
async function uniqueInviteCode() {
  for (let i = 0; i < 5; i++) {
    const code = randomInviteCode();
    const r = await fbGetNow(`invites/${code}`);
    if (r.ok && r.value === null) return code;
  }
  return null;
}
/* Schlüssel für die Namensliste (names/…): jeder Name nur einmal,
   Gross/Klein egal. Firebase-Schlüssel dürfen . # $ [ ] / nicht enthalten. */
function nameKey(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.#$[\]/]/g, '_');
}

/* Admin = die in den Datenbank-Regeln eingetragene E-Mail (bestätigt).
   Die App fragt einfach, ob sie die alte Mitgliederliste lesen darf. */
async function probeAdmin() {
  const r = await fbGetNow('members');
  return r.ok ? r.value || {} : null;
}

async function renderOnboarding(errorText) {
  const verified = authClaims().email_verified === true;
  loginShell(`
    <p class="login-tag">Willkommen! Gib den Einladungscode deiner Crew ein.</p>
    <div class="field"><label>Einladungscode</label><input type="text" id="onb-code" autocapitalize="characters" autocomplete="off" placeholder="z. B. K7P2QX" value="${esc(inviteCodeFromUrl())}"></div>
    <button class="btn" id="onb-submit">WEITER</button>
    <p class="login-hint" id="onb-hint" ${errorText ? 'style="color:var(--danger)"' : ''}>${esc(errorText || `Angemeldet als ${authEmail() || ''}`)}</p>
    <div id="onb-admin"></div>
    ${verified ? '' : '<p class="login-hint">E-Mail noch nicht bestätigt — Link im Postfach antippen. <button type="button" class="link-btn inline" id="onb-verify">Nochmal senden</button> · <button type="button" class="link-btn inline" id="onb-recheck">Neu prüfen</button></p>'}
    <button type="button" class="link-btn" id="onb-signout">Abmelden</button>
  `);
  const submit = () => submitInviteCode(normalizeInviteCode(document.getElementById('onb-code').value));
  document.getElementById('onb-submit').onclick = submit;
  document.getElementById('onb-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  document.getElementById('onb-signout').onclick = () => logout(true);
  const recheck = document.getElementById('onb-recheck');
  if (recheck) recheck.onclick = () => renderOnboarding();
  const verifyBtn = document.getElementById('onb-verify');
  if (verifyBtn) verifyBtn.onclick = async () => {
    const r = await sendVerifyEmail();
    toast(r.ok ? 'Bestätigungs-Mail gesendet.' : 'Konnte keine Mail senden.', r.ok ? 'ok' : 'err');
  };

  // Admin-Einstieg: bestehende Crew aus der Team-Login-Zeit übernehmen.
  // Das Token frisch holen, damit eine eben bestätigte E-Mail zählt.
  authState.expiresAt = 0;
  await ensureValidAuthToken();
  const legacy = await probeAdmin();
  const holder = document.getElementById('onb-admin');
  if (!holder || legacy === null) return;
  const mig = await fbGetNow('migration');
  const done = mig.ok && mig.value && mig.value.crewId;
  const unclaimed = Object.entries(legacy).filter(([, m]) => !m.uid);
  holder.innerHTML = `
    <div class="card onb-admin-card">
      <p class="card-title">Admin</p>
      ${!done && unclaimed.length ? '<button class="btn ghost small" id="onb-migrate">Bestehende Crew übernehmen</button>' : ''}
      <button class="btn ghost small" id="onb-admin-new">Ohne Code starten</button>
    </div>
  `;
  const migBtn = document.getElementById('onb-migrate');
  if (migBtn) migBtn.onclick = () => renderMigration(legacy);
  document.getElementById('onb-admin-new').onclick = () => renderNewProfile(null);
}

/* Code prüfen: users/{uid}/joinCode setzen (erst dann darf man die Crew
   sehen), Einladung lesen, dann "Das bin ich"-Liste bzw. neues Profil. */
async function submitInviteCode(code) {
  if (!code) { renderOnboarding('Bitte Einladungscode eingeben.'); return; }
  renderLoginMessage('Code wird geprüft…');
  const set = await fbUpdateNow(`users/${authUid()}`, { joinCode: code });
  const inv = set.ok ? await fbGetNow(`invites/${code}`) : { ok: false };
  if (!set.ok || !inv.ok) { renderOnboarding('Keine Verbindung — bitte nochmal versuchen.'); return; }
  if (!inv.value || !inv.value.crewId) { renderOnboarding('Diesen Code gibt es nicht (mehr).'); return; }
  const crew = await fbGetNow(`crews/${inv.value.crewId}`);
  if (!crew.ok || !crew.value) { renderOnboarding('Crew konnte nicht geladen werden.'); return; }
  renderJoinChoice(code, inv.value.crewId, crew.value);
}

function renderJoinChoice(code, crewId, crew) {
  const legacy = Object.entries(crew.members || {}).filter(([, m]) => m.legacy);
  if (!legacy.length) { renderNewProfile({ code, crewId, crew }); return; }
  loginShell(`
    <p class="login-tag">Crew <b>${esc(crew.name)}</b>. Hast du schon vorher mit Pincho trainiert?</p>
    <div class="chip-row" id="join-legacy">
      ${legacy.map(([mid, m]) => `<button type="button" class="chip" data-mid="${esc(mid)}">Das bin ich: ${esc(m.name)}</button>`).join('')}
    </div>
    <button class="btn ghost" id="join-new">Ich bin neu</button>
    <p class="login-hint">"Das bin ich" übernimmt das bisherige Profil mit allen Trainings.</p>
  `);
  document.querySelectorAll('#join-legacy .chip').forEach((b) => {
    b.onclick = async () => {
      const mid = b.dataset.mid;
      const name = crew.members[mid].name;
      if (!confirm(`Profil "${name}" mit deinem Konto verbinden?`)) return;
      const r = await fbUpdateNow('', {
        [`members/${mid}/uid`]: authUid(),
        [`members/${mid}/crews/${crewId}`]: true,
        [`users/${authUid()}/memberId`]: mid,
        [`crews/${crewId}/members/${mid}`]: { name, joinedAt: Date.now() },
      });
      if (!r.ok) { toast('Hat nicht geklappt — ist das Profil schon vergeben?', 'err'); return; }
      fbUpdateNow(`users/${authUid()}`, { joinCode: null });
      enterWithProfile(mid, name, crewId);
    };
  });
  document.getElementById('join-new').onclick = () => renderNewProfile({ code, crewId, crew });
}

/* Neues Profil (join = {code, crewId, crew}; null = Admin ohne Code). */
function renderNewProfile(join) {
  loginShell(`
    <p class="login-tag">${join ? `Crew <b>${esc(join.crew.name)}</b> — ` : ''}Wie sollen dich die anderen sehen?</p>
    <div class="field"><label>Name</label><input type="text" id="new-name" maxlength="30" autocomplete="nickname"></div>
    <button class="btn" id="new-submit">LOS GEHT'S</button>
    <p class="login-hint" id="new-hint">Jeder Name gibt es nur einmal.</p>
    <button type="button" class="link-btn" id="new-back">Zurück</button>
  `);
  document.getElementById('new-back').onclick = () => renderOnboarding();
  const submit = async () => {
    const name = document.getElementById('new-name').value.trim();
    const hint = document.getElementById('new-hint');
    const fail = (t) => { hint.textContent = t; hint.style.color = 'var(--danger)'; };
    if (!name) { fail('Bitte einen Namen eingeben.'); return; }
    const taken = await fbGetNow(`names/${nameKey(name)}`);
    if (!taken.ok) { fail('Keine Verbindung — bitte nochmal versuchen.'); return; }
    if (taken.value) { fail(`"${name}" gibt es schon — bitte einen anderen Namen.`); return; }
    const mid = generatePushId();
    const updates = {
      [`members/${mid}`]: { name, board: 'bm2000', uid: authUid(), createdAt: Date.now(), ...(join ? { crews: { [join.crewId]: true } } : {}) },
      [`users/${authUid()}/memberId`]: mid,
      [`names/${nameKey(name)}`]: mid,
    };
    if (join) updates[`crews/${join.crewId}/members/${mid}`] = { name, joinedAt: Date.now(), code: join.code };
    const r = await fbUpdateNow('', updates);
    if (!r.ok) { fail('Hat nicht geklappt — ist der Code noch gültig?'); return; }
    fbUpdateNow(`users/${authUid()}`, { joinCode: null });
    enterWithProfile(mid, name, join && join.crewId);
  };
  document.getElementById('new-submit').onclick = submit;
  document.getElementById('new-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

/* Admin, einmalig: die Crew aus der Team-Login-Zeit wird zur ersten Crew.
   Alle bisherigen Profile kommen als "noch nicht übernommen" hinein,
   Challenges und geteilte Vorlagen werden in die Crew kopiert. */
function renderMigration(legacy) {
  const unclaimed = Object.entries(legacy).filter(([, m]) => !m.uid);
  loginShell(`
    <p class="login-tag">Bestehende Crew übernehmen. Welches Profil bist du?</p>
    <div class="field"><label>Name der Crew</label><input type="text" id="mig-name" value="Pincho Crew" maxlength="40"></div>
    <div class="chip-row" id="mig-pick">
      ${unclaimed.map(([mid, m]) => `<button type="button" class="chip" data-mid="${esc(mid)}">${esc(m.name)}</button>`).join('')}
    </div>
    <p class="login-hint" id="mig-hint">Die anderen übernehmen ihr Profil später selbst mit dem Einladungscode.</p>
    <button type="button" class="link-btn" id="mig-back">Zurück</button>
  `);
  document.getElementById('mig-back').onclick = () => renderOnboarding();
  document.querySelectorAll('#mig-pick .chip').forEach((b) => {
    b.onclick = async () => {
      const me = b.dataset.mid;
      const crewName = document.getElementById('mig-name').value.trim() || 'Pincho Crew';
      const hint = document.getElementById('mig-hint');
      if (!confirm(`Du bist "${legacy[me].name}" — Crew "${crewName}" anlegen?`)) return;
      hint.textContent = 'Wird übernommen…';
      const code = await uniqueInviteCode();
      if (!code) { hint.textContent = 'Keine Verbindung — bitte nochmal versuchen.'; return; }
      const crewId = generatePushId();
      const now = Date.now();
      const crewMembers = {};
      const updates = {};
      unclaimed.forEach(([mid, m]) => {
        crewMembers[mid] = mid === me ? { name: m.name, joinedAt: now } : { name: m.name, legacy: true };
        const key = `names/${nameKey(m.name)}`;
        if (!(key in updates)) updates[key] = mid; // doppelte Namen: nur der erste bekommt den Eintrag
      });
      Object.assign(updates, {
        [`members/${me}/uid`]: authUid(),
        [`members/${me}/crews/${crewId}`]: true,
        [`users/${authUid()}/memberId`]: me,
        [`crews/${crewId}`]: { name: crewName, owner: me, createdAt: now, members: crewMembers },
        [`crewSecrets/${crewId}`]: { inviteCode: code },
        [`invites/${code}`]: { crewId, crewName },
        migration: { crewId, at: now },
      });
      const r = await fbUpdateNow('', updates);
      if (!r.ok) { hint.textContent = 'Hat nicht geklappt (Admin-E-Mail bestätigt?).'; return; }
      const [ch, st] = await Promise.all([fbGetNow('challenges'), fbGetNow('sharedTemplates')]);
      const copy = {};
      if (ch.ok && ch.value) copy.challenges = ch.value;
      if (st.ok && st.value) copy.sharedTemplates = st.value;
      if (Object.keys(copy).length && !(await fbUpdateNow(`crewData/${crewId}`, copy)).ok) {
        toast('Challenges/Vorlagen konnten nicht kopiert werden.', 'err');
      }
      toast(`Crew angelegt — Einladungscode ${code}`, 'ok');
      enterWithProfile(me, legacy[me].name, crewId);
    };
  });
}

/* Abmelden: Konto, lokale Kopie und Warteschlange dieses Geräts vergessen. */
function logout(skipConfirm) {
  const pending = pendingWriteCount();
  if (!skipConfirm) {
    const msg = pending
      ? `${pending} Änderung(en) sind noch nicht hochgeladen und gehen beim Abmelden verloren. Trotzdem abmelden?`
      : 'Abmelden?';
    if (!confirm(msg)) return;
  }
  clearLocalData();
  clearAuth();
  try { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(ACTIVE_CREW_KEY); } catch (e) { /* ignorieren */ }
  state.member = null;
  state.memberDoc = null;
  state.crews = {};
  state.members = {};
  state.crewId = null;
  setChallengeUnseenCount(0);
  renderAuthScreen('login');
}
