/* js/privacy.js — Datenschutz-Seite, eigene Daten herunterladen, Konto löschen */
/* ================================================================
   DATENSCHUTZ + EIGENE DATEN
   Datenschutz-Info (auch ohne Anmeldung erreichbar, #datenschutz),
   "Meine Daten herunterladen" und "Konto löschen". Die Kontakt-Adresse
   steht nicht im (öffentlichen) Code, sondern in config/contact — lesbar
   nur für angemeldete Personen, setzen kann sie nur der Admin.
   ================================================================= */
const PRIVACY_OPERATOR = 'Dome';
const PRIVACY_UPDATED = '27.09.2026';
const PRIVATE_COLLECTIONS = ['logs', 'plans', 'sessionPlans', 'exerciseSettings', 'exerciseFavorites', 'exerciseUnitPrefs',
  'fingerboardSessions', 'fingerboardTemplates', 'flowTemplates', 'wallTemplates', 'hiddenTemplates', 'cycle', 'customExercises'];

async function renderPrivacy() {
  const loggedIn = !!(state.member && hasStoredAuth());
  let contact = '';
  if (loggedIn) {
    const cfg = await fbGetNow('config/contact');
    if (cfg.ok && typeof cfg.value === 'string') contact = cfg.value;
  }
  const contactHtml = contact
    ? `${PRIVACY_OPERATOR}, <a href="mailto:${esc(contact)}">${esc(contact)}</a>`
    : loggedIn ? `${PRIVACY_OPERATOR} (die Person, die dich eingeladen hat)` : `${PRIVACY_OPERATOR} — die Person, die dich eingeladen hat. Die E-Mail-Adresse siehst du nach der Anmeldung hier.`;
  const body = `
    <div class="privacy">
      <p class="pg-muted">Stand ${PRIVACY_UPDATED}</p>
      <h3>Wer</h3>
      <p>Pincho ist ein privates, nicht-kommerzielles Hobby-Projekt. Verantwortlich: ${contactHtml}.</p>
      <h3>Welche Daten</h3>
      <ul>
        <li><b>Konto:</b> E-Mail-Adresse und Passwort. Das Passwort verwaltet Google (Firebase); niemand — auch nicht ${PRIVACY_OPERATOR} — kann es lesen.</li>
        <li><b>Profil:</b> dein Name in der App und deine Board-Wahl.</li>
        <li><b>Training:</b> Logs (Übungen, Sätze, Gewichte, Dauer, Notizen), Pläne, Fingerboard-Einheiten, Vorlagen und Einstellungen.</li>
        <li><b>Crews:</b> in welchen Crews du bist, deine Challenges, dein "Mitgemacht" und Vorlagen, die du mit der Crew teilst.</li>
        <li><b>Eigene Übungen und Übungswünsche:</b> deine eigenen Übungen sind privat. Einen Übungswunsch (Name, Muskelgruppe, Hinweis, dein Name) sieht nur ${PRIVACY_OPERATOR}.</li>
        <li><b>Zyklus (freiwillig):</b> nur die Daten deines Periodenbeginns. Das sind Gesundheitsdaten — sie werden nur mit deiner ausdrücklichen Einwilligung gespeichert, die du jederzeit widerrufen kannst (Tab Fortschritt → Zyklus → Ausschalten &amp; löschen).</li>
      </ul>
      <h3>Wer sieht was</h3>
      <ul>
        <li><b>Nur du:</b> deine Trainings, Pläne, Fortschritt, Einstellungen und Zyklusdaten.</li>
        <li><b>Deine Crew:</b> dein Name, Challenges und wer mitgemacht hat, geteilte Vorlagen.</li>
        <li><b>${PRIVACY_OPERATOR} als Betreiber</b> hat über die Firebase-Konsole technisch Zugriff auf die Datenbank, nutzt das aber nur für Support oder Löschungen auf deinen Wunsch.</li>
      </ul>
      <h3>Wo und bei wem</h3>
      <ul>
        <li><b>Datenbank und Login:</b> Google Firebase im Auftrag von ${PRIVACY_OPERATOR}; die Datenbank liegt in Belgien (EU). Der Login-Dienst von Google kann Daten auch ausserhalb der EU/Schweiz verarbeiten.</li>
        <li><b>App-Dateien:</b> GitHub Pages (GitHub, USA) und Schriften von Google Fonts — beim Laden sehen diese Dienste wie jede Website deine IP-Adresse.</li>
        <li><b>Auf deinem Gerät:</b> eine Offline-Kopie deiner Daten, die beim Abmelden gelöscht wird.</li>
      </ul>
      <h3>Wofür</h3>
      <p>Nur damit die App funktioniert. Keine Werbung, kein Tracking, kein Verkauf, keine Weitergabe an Dritte.</p>
      <h3>Wie lange</h3>
      <p>Bis du sie löschst. "Konto löschen" entfernt dein Konto und alle deine Daten sofort.</p>
      <h3>Deine Rechte</h3>
      <p>Du kannst jederzeit Auskunft verlangen (unter KONTO → "Meine Daten herunterladen"), Daten berichtigen oder löschen (KONTO → "Konto löschen") und eine Einwilligung widerrufen. Bei Fragen melde dich bei ${PRIVACY_OPERATOR}. Beschwerden kannst du beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) einreichen.</p>
    </div>`;
  if (loggedIn) {
    renderShell(`<div class="sec-head"><h2 class="sec-title">Datenschutz</h2><div class="sec-rule"></div></div>${body}
      <a class="btn ghost small" href="#konto">Zurück zu KONTO</a>`);
    return;
  }
  APP_ROOT.innerHTML = `<div class="privacy-shell"><h2 class="sec-title">Datenschutz</h2>${body}
    <a class="btn ghost small" href="#">Zurück</a></div>`;
}

/* Alles, was zu dieser Person gespeichert ist, als JSON-Datei. */
async function exportMyData() {
  const me = state.member.id;
  const out = { exportiertAm: new Date().toISOString(), konto: { email: authEmail(), uid: authUid() } };
  const get = async (path) => { const r = await fbGetNow(path); if (!r.ok) throw new Error(path); return r.value; };
  try {
    out.profil = await get(`members/${me}`);
    for (const c of PRIVATE_COLLECTIONS) out[c] = await get(`${c}/${me}`);
    out.crews = {};
    for (const [id, crew] of Object.entries(state.crews)) {
      const data = await get(`crewData/${id}`) || {};
      const mine = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v.createdBy === me));
      out.crews[id] = {
        name: crew.name,
        meineChallenges: mine(data.challenges),
        meineTeilnahmen: Object.fromEntries(Object.entries(data.challenges || {}).filter(([, v]) => v.participants && v.participants[me]).map(([k, v]) => [k, v.participants[me]])),
        geteilteVorlagen: mine(data.sharedTemplates),
      };
    }
  } catch (e) {
    toast('Keine Verbindung — bitte später nochmal.', 'err');
    return;
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pincho-daten-${dayKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* Konto löschen: zuerst Crew-Inhalte (solange man noch Mitglied ist),
   dann private Daten + Profil in einem Schritt, zuletzt das Login-Konto.
   Wer eine Crew mit anderen Mitgliedern gegründet hat, muss sie zuerst leeren. */
async function deleteMyAccount(password) {
  const me = state.member.id;
  const blocked = Object.entries(state.crews).filter(([, c]) => c.owner === me && Object.keys(c.members || {}).some((m) => m !== me));
  if (blocked.length) {
    return `Du hast ${blocked.map(([, c]) => `"${c.name}"`).join(', ')} gegründet und dort sind noch andere. Entferne sie zuerst (oder lass sie austreten).`;
  }
  const re = await signInEmail(authEmail(), password);
  if (!re.ok) return authErrorText(re.code);

  for (const [id, crew] of Object.entries(state.crews)) {
    if (crew.owner === me) {
      const sec = await fbGetNow(`crewSecrets/${id}`);
      const updates = { [`crewData/${id}`]: null, [`crewSecrets/${id}`]: null };
      if (sec.ok && sec.value && sec.value.inviteCode) updates[`invites/${sec.value.inviteCode}`] = null;
      if (!(await fbUpdateNow('', updates)).ok) return 'Crew-Daten konnten nicht gelöscht werden.';
      if (!(await fbUpdateNow('', { [`crews/${id}`]: null })).ok) return 'Crew konnte nicht gelöscht werden.';
      continue;
    }
    const data = await fbGetNow(`crewData/${id}`);
    if (!data.ok) return 'Keine Verbindung — bitte später nochmal.';
    const updates = {};
    Object.entries((data.value || {}).challenges || {}).forEach(([cid, c]) => {
      if (c.createdBy === me) updates[`crewData/${id}/challenges/${cid}`] = null;
      else if (c.participants && c.participants[me]) updates[`crewData/${id}/challenges/${cid}/participants/${me}`] = null;
    });
    Object.entries((data.value || {}).sharedTemplates || {}).forEach(([tid, t]) => {
      if (t.createdBy === me) updates[`crewData/${id}/sharedTemplates/${tid}`] = null;
    });
    if (Object.keys(updates).length && !(await fbUpdateNow('', updates)).ok) return 'Crew-Inhalte konnten nicht gelöscht werden.';
    if (!(await fbUpdateNow('', { [`crews/${id}/members/${me}`]: null })).ok) return 'Austreten aus der Crew hat nicht geklappt.';
  }

  const updates = { [`names/${nameKey(state.member.name)}`]: null, [`members/${me}`]: null, [`users/${authUid()}`]: null };
  PRIVATE_COLLECTIONS.forEach((c) => { updates[`${c}/${me}`] = null; });
  const r = await fbUpdateNow('', updates);
  if (!r.ok) return 'Deine Daten konnten nicht gelöscht werden.';
  const del = await deleteAuthAccount();
  if (!del.ok) return 'Daten gelöscht, aber das Login-Konto nicht — bitte nochmal versuchen.';
  return null;
}

function wirePrivacyCard(isAdmin) {
  document.getElementById('konto-export').onclick = exportMyData;
  document.getElementById('konto-delete').onclick = () => {
    const box = document.getElementById('konto-delete-box');
    box.hidden = !box.hidden;
  };
  document.getElementById('konto-delete-go').onclick = async () => {
    const pw = document.getElementById('konto-delete-pw').value;
    const hint = document.getElementById('konto-delete-hint');
    if (!pw) { hint.textContent = 'Bitte Passwort eingeben.'; return; }
    if (!confirm('Konto und alle deine Daten endgültig löschen? Das lässt sich nicht rückgängig machen.')) return;
    hint.textContent = 'Wird gelöscht…';
    const err = await deleteMyAccount(pw);
    if (err) { hint.textContent = err; return; }
    logout(true);
    toast('Konto und alle Daten gelöscht.', 'ok');
  };
  if (!isAdmin) return;
  document.getElementById('konto-contact-save').onclick = async () => {
    const v = document.getElementById('konto-contact').value.trim();
    const r = await fbUpdateNow('config', { contact: v || null });
    toast(r.ok ? 'Kontakt gespeichert.' : 'Hat nicht geklappt.', r.ok ? 'ok' : 'err');
  };
}

function privacyCardHtml(isAdmin, contact) {
  return `
    <div class="sec-head"><h2 class="sec-title">Daten</h2><div class="sec-rule"></div></div>
    <div class="card konto-data">
      <a class="link-btn inline" href="#datenschutz">Datenschutz-Info lesen</a>
      <button class="btn ghost small" id="konto-export">Meine Daten herunterladen</button>
      <button class="btn ghost small" id="konto-delete">Konto löschen…</button>
      <div id="konto-delete-box" hidden>
        <p class="card-sub">Löscht dein Konto, dein Profil, alle Trainings, Zyklusdaten, deine Challenges und geteilten Vorlagen. Zur Sicherheit nochmals dein Passwort:</p>
        <div class="field-row">
          <div class="field"><input type="password" id="konto-delete-pw" autocomplete="current-password" placeholder="Passwort"></div>
          <button class="btn danger small" id="konto-delete-go">Endgültig löschen</button>
        </div>
        <p class="card-sub" id="konto-delete-hint"></p>
      </div>
      ${isAdmin ? `
        <p class="card-title" style="margin-top:14px;">Admin: Kontakt in der Datenschutz-Info</p>
        <div class="field-row">
          <div class="field"><input type="email" id="konto-contact" value="${esc(contact || '')}" placeholder="E-Mail (nur für Angemeldete sichtbar)"></div>
          <button class="btn small" id="konto-contact-save">Speichern</button>
        </div>` : ''}
    </div>`;
}
