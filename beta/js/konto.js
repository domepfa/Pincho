/* js/konto.js — Tab Konto: Einladungslink, Faultier-Animationsstufe, Navigation anordnen, renderKonto, Crews */
/* ================================================================
   KONTO + CREWS
   Eigenes Konto, Crews (aktiv setzen, beitreten, verlassen) und — für
   wer eine Crew gegründet hat — Einladungscode teilen/erneuern und
   Mitglieder entfernen. Crew gründen darf vorerst nur der Admin (bis
   config/crewCreationOpen in Firebase auf true steht).
   ================================================================= */
function inviteLink(code) {
  return `${location.origin}${location.pathname}?code=${encodeURIComponent(code)}`;
}

/* Faultier-Animationen: An / Ruhig (ohne Gesichter, Schwanzschwingen, Bahnlinie, Überblenden) / Aus (steht still).
   Gilt pro Gerät; die Klasse am <html> steuert das Stylesheet (siehe anim-calm / anim-off). */
const ANIM_KEY = STORAGE_PREFIX + 'anim';
const ANIM_LEVELS = [['on', 'An', 'Alles, auch Gesichter und Nachschwingen'], ['calm', 'Ruhig', 'Bewegung ja, ohne Gesichter und Effekte'], ['off', 'Aus', 'Faultier steht still, spart Akku']];
function animLevel() { try { return localStorage.getItem(ANIM_KEY) || 'on'; } catch (e) { return 'on'; } }
function applyAnimLevel() {
  const lvl = animLevel();
  document.documentElement.classList.toggle('anim-calm', lvl === 'calm');
  document.documentElement.classList.toggle('anim-off', lvl === 'off');
}
applyAnimLevel();
function renderKontoAnim() {
  const holder = document.getElementById('konto-anim');
  if (!holder) return;
  const lvl = animLevel();
  holder.innerHTML = `
    <div class="card">
      <p class="card-title">Anzeige & Ton</p>
      <p class="card-sub" style="margin-bottom:10px;">Faultier-Animationen: ${esc(ANIM_LEVELS.find((l) => l[0] === lvl)[2])}.</p>
      <div class="chip-row">
        ${ANIM_LEVELS.map(([k, label]) => `<button type="button" class="chip ${k === lvl ? 'active' : ''}" data-anim-level="${k}">${label}</button>`).join('')}
      </div>
      <p class="card-sub" style="margin:14px 0 10px;">Ton-Ausgleich (Bluetooth): ${(() => { const m = audioMeasuredLatencyMs(); return audioCompPref() === 'auto' ? (m != null ? `gemessen ${m} ms` : 'wird beim nächsten Ablauf gemessen') : 'fest eingestellt'; })()}</p>
      <div class="chip-row">
        ${[['auto', 'Automatisch'], ['0', 'Aus'], ['150', '150 ms'], ['300', '300 ms']].map(([k, label]) => `<button type="button" class="chip ${audioCompPref() === k ? 'active' : ''}" data-audio-comp="${k}">${label}</button>`).join('')}
      </div>
      <p class="card-sub" style="margin:14px 0 10px;">Figur</p>
      <div class="chip-row">
        ${[['', 'Neue Figur'], ['classic', 'Klassisch']].map(([k, label]) => `<button type="button" class="chip ${(slothV2On() ? '' : 'classic') === k ? 'active' : ''}" data-sloth-fig="${k}">${label}</button>`).join('')}
      </div>
    </div>`;
  holder.querySelectorAll('[data-audio-comp]').forEach((b) => {
    b.onclick = () => {
      try { if (b.dataset.audioComp === 'auto') localStorage.removeItem(AUDIO_COMP_KEY); else localStorage.setItem(AUDIO_COMP_KEY, b.dataset.audioComp); } catch (e) { /* ignorieren */ }
      renderKontoAnim();
    };
  });
  holder.querySelectorAll('[data-sloth-fig]').forEach((b) => {
    b.onclick = () => {
      try { if (b.dataset.slothFig) localStorage.setItem(SLOTH_FIG_KEY, b.dataset.slothFig); else localStorage.removeItem(SLOTH_FIG_KEY); } catch (e) { /* ignorieren */ }
      renderKontoAnim();
    };
  });
  holder.querySelectorAll('[data-anim-level]').forEach((b) => {
    b.onclick = () => {
      try { localStorage.setItem(ANIM_KEY, b.dataset.animLevel); } catch (e) { /* ignorieren */ }
      applyAnimLevel();
      renderKontoAnim();
    };
  });
}

function renderKontoNav() {
  const holder = document.getElementById('konto-nav');
  if (!holder) return;
  const list = navOrdered();
  const hidden = Array.isArray(navPrefs().hidden) ? navPrefs().hidden : [];
  const visibleCount = list.filter((n) => !hidden.includes(n.route)).length;
  holder.innerHTML = `
    <div class="card">
      <p class="card-title">Navigation unten</p>
      <p class="card-sub" style="margin-bottom:10px;">Reihenfolge ändern und Tabs ausblenden. Der oberste sichtbare Tab öffnet sich beim Start.</p>
      <div class="nav-pref-list">
        ${list.map((n, i) => {
          const off = hidden.includes(n.route);
          return `
          <div class="nav-pref-row${off ? ' off' : ''}">
            <span class="nav-pref-icon">${navIconSvg(n.icon)}</span>
            <span class="nav-pref-label">${esc(n.label)}</span>
            <button type="button" class="nav-pref-btn" data-nav-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(n.label)} nach oben">↑</button>
            <button type="button" class="nav-pref-btn" data-nav-down="${i}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="${esc(n.label)} nach unten">↓</button>
            <button type="button" class="chip small ${off ? '' : 'active'}" data-nav-toggle="${n.route}" ${!off && visibleCount <= 1 ? 'disabled' : ''}>${off ? 'Aus' : 'An'}</button>
          </div>`;
        }).join('')}
      </div>
      ${navPrefs().order || navPrefs().hidden ? '<button type="button" class="btn ghost small" id="konto-nav-reset" style="margin-top:10px;">Standard wiederherstellen</button>' : ''}
    </div>
  `;
  const apply = (order, hid) => { saveNavPrefs({ order, hidden: hid }); render(); };
  const routes = list.map((n) => n.route);
  holder.querySelectorAll('[data-nav-up]').forEach((b) => { b.onclick = () => {
    const i = Number(b.dataset.navUp); [routes[i - 1], routes[i]] = [routes[i], routes[i - 1]]; apply(routes, hidden);
  }; });
  holder.querySelectorAll('[data-nav-down]').forEach((b) => { b.onclick = () => {
    const i = Number(b.dataset.navDown); [routes[i + 1], routes[i]] = [routes[i], routes[i + 1]]; apply(routes, hidden);
  }; });
  holder.querySelectorAll('[data-nav-toggle]').forEach((b) => { b.onclick = () => {
    const r = b.dataset.navToggle;
    apply(routes, hidden.includes(r) ? hidden.filter((x) => x !== r) : hidden.concat(r));
  }; });
  const reset = document.getElementById('konto-nav-reset');
  if (reset) reset.onclick = () => {
    state.memberDoc = { ...(state.memberDoc || {}), nav: null };
    try { localStorage.removeItem(NAV_PREF_KEY); } catch (e) { /* ignorieren */ }
    fbPatch(`members/${state.member.id}`, { nav: null });
    render();
  };
}

async function renderKonto() {
  renderShell(`
    <div class="sec-head"><h2 class="sec-title">Konto</h2><div class="sec-rule"></div></div>
    <div class="card">
      <p class="card-title">Angemeldet</p>
      <p class="card-value">${esc(state.member.name)}</p>
      <p class="card-sub">${esc(authEmail() || '')}</p>
      <button class="btn ghost small konto-logout" id="konto-logout">Abmelden</button>
    </div>
    <a class="card konto-help" href="#hilfe"><span class="konto-help-icon">?</span><span><b>So funktioniert Pincho</b><br><span class="card-sub">Kurze Erklärung zu allen Tabs</span></span></a>
    <div class="sec-head"><h2 class="sec-title">Crews</h2><div class="sec-rule"></div></div>
    <div id="konto-crews"><span class="mono" style="color:var(--ink-faint);font-size:12px;">lädt…</span></div>
    <div class="card">
      <p class="card-title">Crew beitreten</p>
      <div class="field-row">
        <div class="field"><input type="text" id="konto-join-code" autocapitalize="characters" autocomplete="off" placeholder="Einladungscode"></div>
        <button class="btn small" id="konto-join">Beitreten</button>
      </div>
    </div>
    <div id="konto-nav"></div>
    <div id="konto-anim"></div>
    <div id="konto-create"></div>
    <div id="konto-wishes"></div>
    <div id="konto-cycle"></div>
    <div id="konto-data"></div>
  `);
  document.getElementById('konto-logout').onclick = () => logout();
  renderKontoNav();
  renderKontoAnim();
  document.getElementById('konto-join').onclick = () => joinCrewWithCode(normalizeInviteCode(document.getElementById('konto-join-code').value));

  await loadCrews(); // frisch: neue Mitglieder sollen ohne Neustart erscheinen
  const holder = document.getElementById('konto-crews');
  if (!holder) return; // weiternavigiert
  const ids = Object.keys(state.crews);
  const me = state.member.id;
  const secrets = {};
  await Promise.all(ids.filter((id) => state.crews[id].owner === me).map(async (id) => {
    const r = await fbGetNow(`crewSecrets/${id}`);
    if (r.ok && r.value) secrets[id] = r.value.inviteCode;
  }));
  if (!document.getElementById('konto-crews')) return; // weiternavigiert
  holder.innerHTML = ids.length ? ids.map((id) => {
    const c = state.crews[id];
    const isOwner = c.owner === me;
    const members = Object.entries(c.members || {});
    return `
      <div class="card crew-card">
        <div class="crew-head">
          <p class="card-value">${esc(c.name)}</p>
          ${id === state.crewId ? '<span class="tag-pill">AKTIV</span>' : `<button class="btn ghost small" data-activate="${esc(id)}">Aktiv setzen</button>`}
        </div>
        <div class="chip-row crew-members">
          ${members.map(([mid, m]) => `<span class="chip small ${m.legacy ? 'legacy' : ''}">${esc(m.name)}${mid === c.owner ? ' ★' : ''}${m.legacy ? ' · noch nicht dabei' : ''}${isOwner && mid !== me ? ` <button type="button" class="chip-x" data-remove="${esc(id)}|${esc(mid)}" aria-label="${esc(m.name)} entfernen">×</button>` : ''}</span>`).join('')}
        </div>
        ${isOwner ? `
          <p class="card-title">Einladungscode</p>
          <p class="invite-code mono">${esc(secrets[id] || '—')}</p>
          <div class="chal-actions">
            ${secrets[id] ? `<button class="btn small" data-share="${esc(id)}">Einladen</button>` : ''}
            <button class="btn ghost small" data-regen="${esc(id)}">Neuer Code</button>
          </div>
          <p class="card-sub">"Neuer Code" macht den alten ungültig — wer schon drin ist, bleibt drin.</p>
        ` : `<div class="chal-actions"><button class="btn ghost small" data-leave="${esc(id)}">Crew verlassen</button></div>`}
      </div>
    `;
  }).join('') : '<div class="list-empty">Noch in keiner Crew — unten mit einem Einladungscode beitreten.</div>';

  holder.querySelectorAll('[data-activate]').forEach((b) => {
    b.onclick = () => { setActiveCrew(b.dataset.activate); loadSharedTemplates(); renderKonto(); };
  });
  holder.querySelectorAll('[data-share]').forEach((b) => {
    b.onclick = () => shareInvite(state.crews[b.dataset.share].name, secrets[b.dataset.share]);
  });
  holder.querySelectorAll('[data-regen]').forEach((b) => {
    b.onclick = () => regenerateInvite(b.dataset.regen, secrets[b.dataset.regen]);
  });
  holder.querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = async () => {
      const [crewId, mid] = b.dataset.remove.split('|');
      const name = state.crews[crewId].members[mid].name;
      if (!confirm(`${name} aus "${state.crews[crewId].name}" entfernen?`)) return;
      const r = await fbUpdateNow('', { [`crews/${crewId}/members/${mid}`]: null });
      toast(r.ok ? `${name} entfernt.` : 'Hat nicht geklappt.', r.ok ? 'ok' : 'err');
      await loadCrews();
      renderKonto();
    };
  });
  holder.querySelectorAll('[data-leave]').forEach((b) => {
    b.onclick = async () => {
      const crewId = b.dataset.leave;
      if (!confirm(`"${state.crews[crewId].name}" verlassen? Zurück geht's nur mit einem neuen Einladungscode.`)) return;
      const r = await fbUpdateNow('', { [`crews/${crewId}/members/${me}`]: null, [`members/${me}/crews/${crewId}`]: null });
      if (!r.ok) { toast('Hat nicht geklappt.', 'err'); return; }
      toast('Crew verlassen.', 'ok');
      await loadCrews();
      loadSharedTemplates();
      renderKonto();
    };
  });

  // Crew gründen: Admin (Phase 1) oder sobald für alle freigeschaltet.
  const [cfg, admin] = await Promise.all([fbGetNow('config'), probeAdmin()]);
  const open = cfg.ok && cfg.value && cfg.value.crewCreationOpen === true;
  const rawCycle = await fbGet(`cycle/${state.member.id}`);
  if (rawCycle !== undefined) cycleData = rawCycle && rawCycle.consentAt ? rawCycle : null;
  const cycleHolder = document.getElementById('konto-cycle');
  if (cycleHolder && rawCycle !== undefined) { cycleHolder.innerHTML = cycleKontoCardHtml(); wireCycleKonto(); }
  if (admin !== null) {
    const wishes = await refreshWishDot();
    const wh = document.getElementById('konto-wishes');
    if (wh && wishes) {
      wh.innerHTML = wishesCardHtml(wishes);
      wh.querySelectorAll('[data-wish-done]').forEach((b) => {
        b.onclick = async () => {
          const w = wishes.find(([id]) => id === b.dataset.wishDone);
          const r = await fbUpdateNow(`exerciseRequests/${b.dataset.wishDone}`, { done: !(w && w[1].done) });
          if (!r.ok) { toast('Hat nicht geklappt.', 'err'); return; }
          renderKonto();
        };
      });
    }
  }
  const dataHolder = document.getElementById('konto-data');
  if (dataHolder) {
    dataHolder.innerHTML = privacyCardHtml(admin !== null, cfg.ok && cfg.value && typeof cfg.value.contact === 'string' ? cfg.value.contact : '');
    wirePrivacyCard(admin !== null);
  }
  const createHolder = document.getElementById('konto-create');
  if (!createHolder || !(open || admin !== null)) return;
  createHolder.innerHTML = `
    <div class="card">
      <p class="card-title">Neue Crew gründen</p>
      <div class="field-row">
        <div class="field"><input type="text" id="konto-create-name" maxlength="40" placeholder="Name der Crew"></div>
        <button class="btn small" id="konto-create-btn">Gründen</button>
      </div>
    </div>
  `;
  document.getElementById('konto-create-btn').onclick = () => createCrew(document.getElementById('konto-create-name').value.trim());
}

async function shareInvite(crewName, code) {
  const text = `Komm in meine Pincho-Crew "${crewName}"! Einladungscode: ${code}`;
  const url = inviteLink(code);
  try {
    if (navigator.share) { await navigator.share({ title: 'Pincho', text, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Einladung kopiert — z. B. in WhatsApp einfügen.', 'ok');
  } catch (e) {
    prompt('Einladung kopieren:', `${text} ${url}`);
  }
}

async function regenerateInvite(crewId, oldCode) {
  if (!confirm('Neuen Code erzeugen? Der alte funktioniert dann nicht mehr.')) return;
  const code = await uniqueInviteCode();
  if (!code) { toast('Keine Verbindung.', 'err'); return; }
  const updates = {
    [`invites/${code}`]: { crewId, crewName: state.crews[crewId].name },
    [`crewSecrets/${crewId}/inviteCode`]: code,
  };
  if (oldCode) updates[`invites/${oldCode}`] = null;
  const r = await fbUpdateNow('', updates);
  toast(r.ok ? `Neuer Code: ${code}` : 'Hat nicht geklappt.', r.ok ? 'ok' : 'err');
  renderKonto();
}

async function joinCrewWithCode(code) {
  if (!code) { toast('Bitte Einladungscode eingeben.', 'err'); return; }
  const inv = await fbGetNow(`invites/${code}`);
  if (!inv.ok) { toast('Keine Verbindung.', 'err'); return; }
  if (!inv.value || !inv.value.crewId) { toast('Diesen Code gibt es nicht (mehr).', 'err'); return; }
  const crewId = inv.value.crewId;
  if (state.crews[crewId]) { toast(`Du bist schon in "${state.crews[crewId].name}".`); return; }
  const me = state.member.id;
  const r = await fbUpdateNow('', {
    [`crews/${crewId}/members/${me}`]: { name: state.member.name, joinedAt: Date.now(), code },
    [`members/${me}/crews/${crewId}`]: true,
  });
  if (!r.ok) { toast('Beitreten hat nicht geklappt.', 'err'); return; }
  await loadCrews();
  setActiveCrew(crewId);
  loadSharedTemplates();
  toast(`Willkommen in "${inv.value.crewName || 'der Crew'}"!`, 'ok');
  renderKonto();
}

async function createCrew(name) {
  if (!name) { toast('Bitte einen Namen für die Crew eingeben.', 'err'); return; }
  const code = await uniqueInviteCode();
  if (!code) { toast('Keine Verbindung.', 'err'); return; }
  const crewId = generatePushId();
  const me = state.member.id;
  const now = Date.now();
  const r = await fbUpdateNow('', {
    [`crews/${crewId}`]: { name, owner: me, createdAt: now, members: { [me]: { name: state.member.name, joinedAt: now } } },
    [`crewSecrets/${crewId}`]: { inviteCode: code },
    [`invites/${code}`]: { crewId, crewName: name },
    [`members/${me}/crews/${crewId}`]: true,
  });
  if (!r.ok) { toast('Crew gründen hat nicht geklappt.', 'err'); return; }
  await loadCrews();
  setActiveCrew(crewId);
  loadSharedTemplates();
  toast(`Crew "${name}" gegründet — Code ${code}`, 'ok');
  renderKonto();
}
