/* js/shell.js — Rahmen: Navigation (+ eigene Anordnung), renderShell, Start-Button (FAB), Trainings-Leiste, Router render() */
/* ================================================================
   SHELL + ROUTER
   ================================================================= */
/* icon = Pfad-Daten eines 24er-Strich-Icons (stroke, kein fill). */
const NAV_ITEMS = [
  { route: 'fingerboard', label: 'Board', icon: 'M3 8a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2z M7 10h.01 M12 10h.01 M17 10h.01' },
  { route: 'log', label: 'Gym', icon: 'M6 8v8 M3 10v4 M18 8v8 M21 10v4 M6 12h12' },
  { route: 'plan', label: 'Agenda', icon: 'M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z M3 10h18 M8 3v4 M16 3v4' },
  { route: 'progress', label: 'Fortschritt', icon: 'M4 19h16 M5 15l4-5 4 3 6-8' },
  { route: 'challenges', label: 'Challenges', icon: 'M5 21V4 M5 4h11l-2 4 2 4H5' },
];
/* Eigene Anordnung der unteren Navigation (Konto → Navigation): Reihenfolge
   und ausgeblendete Tabs. Gespeichert im Profil (members/{id}/nav), dazu
   lokal gespiegelt, damit der Start-Tab schon vor dem Laden stimmt. */
const NAV_PREF_KEY = STORAGE_PREFIX + 'nav';
function navPrefs() {
  const fromDoc = state.memberDoc && state.memberDoc.nav;
  if (fromDoc) return fromDoc;
  try { return JSON.parse(localStorage.getItem(NAV_PREF_KEY) || 'null') || {}; } catch (e) { return {}; }
}
/* Alle Tabs in gewählter Reihenfolge (neue Tabs, die es in der Liste noch nicht gibt, hinten dran) */
function navOrdered() {
  const order = Array.isArray(navPrefs().order) ? navPrefs().order : [];
  const known = order.map((r) => NAV_ITEMS.find((n) => n.route === r)).filter(Boolean);
  return known.concat(NAV_ITEMS.filter((n) => !order.includes(n.route)));
}
function navVisible() {
  const hidden = Array.isArray(navPrefs().hidden) ? navPrefs().hidden : [];
  const list = navOrdered().filter((n) => !hidden.includes(n.route));
  return list.length ? list : NAV_ITEMS.slice(0, 1);
}
/* Start-Tab = erster sichtbarer Tab */
function defaultRoute() { return navVisible()[0].route; }
function saveNavPrefs(prefs) {
  state.memberDoc = { ...(state.memberDoc || {}), nav: prefs };
  try { localStorage.setItem(NAV_PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignorieren */ }
  fbPatch(`members/${state.member.id}`, { nav: prefs });
}

function navIconSvg(d) {
  return `<svg class="nav-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Beta läuft unter /beta/ — dort das BETA-Schild zeigen, sonst nicht.
function renderShell(contentHtml) {
  const memberName = state.member ? esc(state.member.name) : '';
  APP_ROOT.innerHTML = `
    <div class="topbar">
      <div class="brand">
        <span class="mark">PIN<em>CHO</em>${IS_BETA ? ' <span class="beta-badge">BETA</span>' : ''}</span>
        <p class="app-tagline mono" id="app-tagline">${appTaglineTyped ? esc(appTagline()) : ''}</p>
      </div>
      <a class="who" href="#konto" title="Konto &amp; Crews">
        <span class="name mono">${memberName}</span>
        <span class="logout ${state.route === 'konto' ? 'active' : ''}">KONTO<span class="nav-dot konto-dot" id="konto-dot" ${openWishCount ? '' : 'hidden'}></span></span>
      </a>
    </div>
    <div class="shell">${contentHtml}</div>
    <nav class="bottomnav">
      ${navVisible().map((n) => `<a href="#${n.route}" class="${state.route === n.route ? 'active' : ''}"><span class="nav-pill">${navIconSvg(n.icon)}</span><span class="nav-label">${n.label}</span>${n.route === 'challenges' ? `<span class="nav-dot" id="nav-challenge-dot" ${challengeUnseenCount ? '' : 'hidden'}></span>` : ''}</a>`).join('')}
      <span class="nav-indicator" id="nav-indicator"></span>
    </nav>
  `;
  positionNavIndicator();
  if (!appTaglineTyped) {
    appTaglineTyped = true;
    typeTagline(document.getElementById('app-tagline'));
  }
}

/* Schiebt die kleine Leuchtleiste unter dem aktiven Tab an die richtige
   Stelle — per JS statt reinem CSS, weil die Tab-Breiten durch die
   Textlänge variieren (flex:1 macht sie zwar gleich breit, aber nur zur
   Laufzeit messbar). Ein zweiter Aufruf nach Resize hält es bei
   Bildschirmdrehung synchron. */
function positionNavIndicator() {
  const nav = document.querySelector('.bottomnav');
  const active = nav && nav.querySelector('a.active');
  const indicator = document.getElementById('nav-indicator');
  if (!nav || !indicator) return;
  if (!active) { indicator.style.width = '0'; return; } // z. B. Konto-Seite, nicht in der Navigation
  indicator.style.left = active.offsetLeft + 'px';
  indicator.style.width = active.offsetWidth + 'px';
}
window.addEventListener('resize', positionNavIndicator);

/* Fliegender "Starten"-Button — bleibt beim Scrollen sichtbar, damit ein
   fertig gebauter Plan (Gym) oder Ablauf (Fingerboard) auch ohne
   Runterscrollen zum echten Start-Button gestartet werden kann. Reine
   Sichtbarkeits-/Positions-Hülle: klickt beim Antippen immer nur den
   schon vorhandenen, echten Start-Button an (z. B. #plan-start,
   #fb-start-ablauf) — der eigentliche Start-Vorgang bleibt dadurch exakt
   derselbe wie vorher. */
function ensureFabStart() {
  let el = document.getElementById('fab-start');
  if (!el) {
    el = document.createElement('button');
    el.id = 'fab-start';
    el.type = 'button';
    el.className = 'hidden';
    document.body.appendChild(el);
  }
  return el;
}
function hideFabStart() {
  const el = document.getElementById('fab-start');
  if (el) el.classList.add('hidden');
}
function showFabStart(label, targetId) {
  const el = ensureFabStart();
  const target = document.getElementById(targetId);
  // Ohne startbaren Inhalt (z. B. leerer Ablauf) gar nicht erst zeigen —
  // ein ausgegrauter, schwebender Knopf wirkte nur kaputt.
  if (!target || target.disabled) { hideFabStart(); return; }
  el.textContent = label;
  el.disabled = target.disabled;
  el.classList.remove('hidden');
  el.onclick = () => {
    const t = document.getElementById(targetId);
    if (t && !t.disabled) t.click();
  };
}

/* Grosse Trainings-Leiste unten (ersetzt während einer laufenden Freestyle-
   Session/Plan-Ausführung den fliegenden Start-Button): zeigt Satz- bzw.
   Pausenzeit gross und EINEN breiten Knopf für den nächsten Schritt
   (Start → Satz beenden → Nächster Satz) — immer an derselben Stelle
   unter dem Daumen, statt die kleine Box in der Liste suchen zu müssen.
   Nur die Eingabe von Gewicht/Wdh. bleibt in der Karte der Übung (unten
   würde die Tastatur sie verdecken). Inhalt baut renderFsPanel(). */
/* Workout-Uhr: gesamte Trainingszeit seit Start der Session (sessionStartedAt),
   klein oben in der Leiste. Ein einziges Intervall aktualisiert sie, solange
   sie im DOM steht — rechnet wie die Satz-Uhren aus der echten Uhrzeit. */
function fmtSessionClock(startedAt) {
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
setInterval(() => {
  const el = document.getElementById('fs-session-clock');
  const b = el && activeSetBuilder();
  if (b && b.sessionStartedAt) el.textContent = `⏱ ${fmtSessionClock(b.sessionStartedAt)}`;
}, 1000);
function ensureFsDock() {
  let el = document.getElementById('fs-dock');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fs-dock';
    el.className = 'hidden';
    document.body.appendChild(el);
  }
  return el;
}
function hideFsDock() {
  hideFsRestScreen();
  const el = document.getElementById('fs-dock');
  if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
  document.body.classList.remove('has-fs-dock');
}

function render() {
  if (state.route === 'datenschutz') { renderPrivacy(); return; }
  if (!state.member) { boot(); return; }
  hideFabStart(); // jede Route entscheidet selbst, ob/wofür sie ihn zeigt
  hideFsDock();
  document.getElementById('fb-dice-sheet')?.remove(); // Würfel-Fenster gehört zum Board-Tab
  switch (state.route) {
    case 'log': renderLog(); break;
    case 'fingerboard': renderFingerboard(); break;
    case 'challenges': renderChallenges(); break;
    case 'progress': renderProgress(); break;
    case 'konto': renderKonto(); break;
    case 'hilfe': renderHelp(); break;
    case 'plan':
    default: renderPlan(); break;
  }
}
