/* Browser-Test für die Beta (oder die Haupt-App) mit nachgebildetem Firebase —
   keine echten Zugangsdaten, kein Netz nötig.

   Prüft: Start ohne JS-Fehler, Login über das Formular, alle Tabs, die
   Übungsfiguren (Anzahl + SHA-256 der Daten und aller gerenderten Figuren,
   Info-Sheet, 💪-Ersatz), ob alle <script>-Dateien im Offline-Cache liegen
   und den Offline-Start (inkl. Fingerboard-Tab).
   Datenschutz: #datenschutz angemeldet und abgemeldet (Abschnitte, Stand,
   Kontakt-Link), Hilfe-Abschnitte, die Daten-Karte unter KONTO (Knöpfe und
   ihre Handler), "Meine Daten herunterladen" (Datei-Inhalt, nur Lesezugriffe)
   und "Konto löschen" bis zur Sicherheitsabfrage, die abgebrochen wird.
   Echte Firebase-Daten werden nie berührt: jede Anfrage ausserhalb von
   localhost wird nachgebildet oder abgebrochen (out.externalUnmocked).

   Ausführen (aus dem Repo-Wurzelordner, braucht Node + Playwright):
     node tools/test-beta.mjs                      # Beta, eigener Mini-Server
     APP=main node tools/test-beta.mjs             # Haupt-App
     BASE=http://localhost:8000/beta/ node tools/test-beta.mjs   # fremder Server
   Ausgabe: JSON mit allen Ergebnissen, Exit-Code 1 bei einem Fehler. Die
   Prüfsummen vor und nach einer Änderung vergleichen = Figuren unverändert.
   Die zwei "[offline] … ERR_FAILED"-Meldungen sind die absichtlich
   blockierten Netzanfragen im Offline-Teil, "[erwartet 401]" ist die
   abgelehnte Admin-Probe — beide zählen nicht als Fehler. */
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import('playwright').catch(() => import('/opt/node-tools/node_modules/playwright/index.mjs'));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = process.env.APP === 'main';

// Ohne BASE: kleiner statischer Server über dem Repo-Ordner.
let server = null;
let BASE = process.env.BASE;
if (!BASE) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/markdown', '.svg': 'image/svg+xml' };
  server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, r));
  BASE = `http://localhost:${server.address().port}/${MAIN ? '' : 'beta/'}`;
}
const PREFIX = process.env.PREFIX || (MAIN || !/\/beta\/?$/.test(BASE) ? 'pincho-shell-' : 'pincho-beta-');
const out = { base: BASE, errors: [], pageErrors: [], steps: {} };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = `${b64({ alg: 'none' })}.${b64({ email_verified: true, user_id: 'uid1', email: 't@example.com' })}.x`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
// Firebase-Nachbildung. Schutz für echte Daten: JEDE Anfrage, die nicht an
// den lokalen Server geht, wird abgefangen — entweder von der Nachbildung
// beantwortet oder abgebrochen (landet dann in out.externalUnmocked).
// Alle Firebase-/Login-Anfragen werden in `log` mitgeschrieben.
const CONTACT = 'kontakt@example.com';
const requestLog = [];
out.externalUnmocked = [];
let offline = false;
async function mockFirebase(context, log, isOffline = () => offline) {
  await context.route('**', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return route.continue();
    out.externalUnmocked.push(route.request().method() + ' ' + route.request().url());
    return route.abort();
  });
  await context.route(/googleapis\.com|firebasedatabase\.app|fonts\.g/, async (route) => {
    if (isOffline()) return route.abort();
    const u = route.request().url(), m = route.request().method();
    if (/fonts\.g/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    const url = new URL(u);
    log.push({ m, path: url.hostname.includes('firebasedatabase') ? url.pathname : url.pathname.replace('/v1/', ''), body: route.request().postData() });
    if (/signInWithPassword/.test(u)) return route.fulfill({ json: { idToken, refreshToken: 'r', expiresIn: '3600', localId: 'uid1', email: 't@example.com' } });
    if (/securetoken/.test(u)) return route.fulfill({ json: { id_token: idToken, refresh_token: 'r', expires_in: '3600', user_id: 'uid1' } });
    if (/accounts:lookup/.test(u)) return route.fulfill({ json: { users: [{ emailVerified: true }] } });
    if (m !== 'GET') return route.fulfill({ json: m === 'POST' ? { name: 'k' + Date.now() } : {} });
    if (/\/users\/uid1\.json/.test(u)) return route.fulfill({ json: { memberId: 'm1' } });
    // Wie die echten Regeln für normale Nutzer: alle Profile lesen nur als Admin.
    if (/\/members\.json/.test(u)) return route.fulfill({ status: 401, json: { error: 'Permission denied' } });
    if (/\/members\/m1\.json/.test(u)) return route.fulfill({ json: { name: 'Test', uid: 'uid1' } });
    if (/\/config\/contact\.json/.test(u)) return route.fulfill({ json: CONTACT });
    return route.fulfill({ json: null });
  });
}
// Schreibende Firebase-Anfragen (alles ausser GET und den Login-Aufrufen).
const writesIn = (log) => log.filter((r) => r.m !== 'GET' && !/accounts:(signInWithPassword|lookup)|token/.test(r.path));
const ctx = await browser.newContext({ serviceWorkers: 'allow' });
await mockFirebase(ctx, requestLog);
const page = await ctx.newPage();
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  // Der 401 auf /members.json ist gewollt (Admin-Probe als normaler Nutzer, siehe mockFirebase).
  const expected = /\/members\.json/.test(msg.location().url || '') && msg.text().includes('401');
  out.errors.push((offline ? '[offline] ' : expected ? '[erwartet 401] ' : '') + msg.text());
});
page.on('pageerror', (e) => out.pageErrors.push((offline ? '[offline] ' : '') + e.message));

// 1. Start + Login
await page.goto(BASE);
await page.waitForSelector('#auth-email', { timeout: 10000 });
out.steps.loginScreen = true;
await page.fill('#auth-email', 't@example.com');
await page.fill('#auth-password', 'geheim1');
await page.click('#auth-submit');
await page.waitForSelector('nav, .nav, .bottom-nav', { timeout: 10000 });
out.steps.loggedIn = await page.evaluate(() => !!(state.member && state.member.id === 'm1'));

// 2. Navigation über alle Tabs
const routes = ['plan', 'log', 'fingerboard', 'challenges', 'progress', 'konto', 'hilfe', 'plan'];
out.steps.routes = {};
for (const r of routes) {
  await page.evaluate((r) => { location.hash = r; }, r);
  await page.waitForTimeout(600);
  out.steps.routes[r] = await page.evaluate(() => document.getElementById('app').innerHTML.length > 200);
}

// 3. Übungsfiguren: Daten + Ausgabe für jede Übung
const figs = await page.evaluate(() => {
  const keys = Object.keys(EXERCISE_FIGURES);
  const ids = [...new Set([...keys, ...EXERCISE_LIBRARY.map((e) => e.id), ...Object.keys(SLOTH_EXERCISE_POSES)])].sort();
  const rendered = ids.map((id) => id + '\u0000' + exerciseFigureSvg(id)).join('\u0001');
  showExerciseInfoSheet(keys[0]);
  const sheetFigure = !!document.querySelector('.info-sheet-figure svg');
  closeExerciseInfoSheet();
  return { count: keys.length, dataJson: JSON.stringify(EXERCISE_FIGURES), rendered, ids: ids.length, sheetFigure,
    emojiFallback: exerciseFigureSvg('__gibtsnicht__').includes('💪') };
});
out.steps.figures = { count: figs.count, renderedIds: figs.ids, infoSheetFigure: figs.sheetFigure, emojiFallback: figs.emojiFallback,
  dataSha256: crypto.createHash('sha256').update(figs.dataJson).digest('hex'),
  renderedSha256: crypto.createHash('sha256').update(figs.rendered).digest('hex') };

// 3b. Datenschutz, Hilfe und die Daten-Karte unter KONTO (angemeldet).
//     Nichts wird wirklich gelöscht: der Lösch-Dialog wird abgebrochen.
const pv = out.steps.privacy = {};
// Fehlt ein Element, soll der Punkt als false gemeldet werden statt den Test abzubrechen.
const click = (sel) => page.click(sel, { timeout: 3000 }).then(() => true, () => false);
await page.evaluate(() => { location.hash = 'datenschutz'; });
await page.waitForFunction(() => document.querySelector('#app .privacy'), null, { timeout: 5000 }).catch(() => {});
Object.assign(pv, await page.evaluate((contact) => {
  const root = document.querySelector('#app .privacy');
  const heads = root ? [...root.querySelectorAll('h3')].map((h) => h.textContent) : [];
  const mail = root && root.querySelector('a[href^="mailto:"]');
  return {
    loggedInPage: !!root && !document.querySelector('.privacy-shell'),
    headings: heads.join('|') === 'Wer|Welche Daten|Wer sieht was|Wo und bei wem|Wofür|Wie lange|Deine Rechte',
    updatedShown: !!root && root.querySelector('.pg-muted').textContent === `Stand ${PRIVACY_UPDATED}`,
    contactLink: !!mail && mail.getAttribute('href') === `mailto:${contact}` && mail.textContent === contact,
    backToKonto: !!document.querySelector('#app a[href="#konto"]'),
  };
}, CONTACT));
pv.contactFetched = requestLog.some((r) => r.m === 'GET' && r.path === '/config/contact.json');

await page.evaluate(() => { location.hash = 'hilfe'; });
await page.waitForSelector('#app details.help-item', { timeout: 5000 }).catch(() => {});
Object.assign(pv, await page.evaluate(() => {
  const items = [...document.querySelectorAll('#app details.help-item')];
  return {
    helpSections: items.length === HELP_SECTIONS.length && items.length > 0,
    helpTitles: items.every((d, i) => d.querySelector('.help-title').textContent === HELP_SECTIONS[i][0]),
    helpFirstOpen: items.length > 0 && items[0].open && items.slice(1).every((d) => !d.open),
    helpUsesOperator: HELP_SECTIONS.some(([, , body]) => body.includes(PRIVACY_OPERATOR)) && document.querySelector('#app .help').innerHTML.includes(PRIVACY_OPERATOR),
  };
}));

await page.evaluate(() => { location.hash = 'konto'; });
await page.waitForSelector('#konto-export', { timeout: 8000 }).catch(() => {});
Object.assign(pv, await page.evaluate(() => {
  const $ = (id) => document.getElementById(id);
  const box = $('konto-delete-box');
  // Admin-Variante der Karte separat erzeugen (nicht im DOM)
  const tmp = document.createElement('div');
  tmp.innerHTML = privacyCardHtml(true, 'a"b@example.com');
  const adminInput = tmp.querySelector('#konto-contact');
  return {
    cardRendered: !!document.querySelector('#konto-data .konto-data a[href="#datenschutz"]'),
    exportButton: !!$('konto-export') && $('konto-export').onclick === exportMyData,
    deleteButton: !!$('konto-delete') && typeof $('konto-delete').onclick === 'function',
    deleteGoButton: !!$('konto-delete-go') && typeof $('konto-delete-go').onclick === 'function',
    deleteBoxHidden: !!box && box.hidden === true,
    deletePwField: !!$('konto-delete-pw') && $('konto-delete-pw').type === 'password',
    noAdminFieldsForUser: !$('konto-contact') && !$('konto-contact-save'),
    adminCardVariant: !!adminInput && adminInput.value === 'a"b@example.com' && !!tmp.querySelector('#konto-contact-save'),
  };
}));

// "Meine Daten herunterladen": Download abfangen und Inhalt prüfen.
await page.evaluate(() => {
  window.__dl = null;
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { window.__dl = fetch(this.href).then((r) => r.text()).then((text) => ({ name: this.download, text })); return; }
    return orig.call(this);
  };
});
const before = requestLog.length;
await click('#konto-export');
await page.waitForFunction(() => window.__dl, null, { timeout: 8000 }).catch(() => {});
const dl = await page.evaluate(async () => window.__dl && await window.__dl);
const exportReqs = requestLog.slice(before);
let dump = null; try { dump = JSON.parse(dl.text); } catch (e) { /* bleibt null */ }
pv.exportDownload = !!dl && !!dl.name && /^pincho-daten-\d{4}-\d{2}-\d{2}\.json$/.test(dl.name);
pv.exportContent = !!dump && !!dump.konto && dump.konto.uid === 'uid1' && dump.profil && dump.profil.name === 'Test'
  && (await page.evaluate(() => PRIVATE_COLLECTIONS)).every((c) => c in dump);
pv.exportReadsOnly = exportReqs.length > 0 && exportReqs.every((r) => r.m === 'GET');

// "Konto löschen": Aufklappen, leeres Passwort, Sicherheitsabfrage abbrechen.
const writesBefore = writesIn(requestLog).length;
const reqBefore = requestLog.length;
await click('#konto-delete');
pv.deleteBoxOpens = await page.evaluate(() => document.getElementById('konto-delete-box')?.hidden === false);
await click('#konto-delete-go');
pv.deleteNeedsPassword = await page.evaluate(() => document.getElementById('konto-delete-hint')?.textContent === 'Bitte Passwort eingeben.');
await page.fill('#konto-delete-pw', 'geheim1', { timeout: 3000 }).catch(() => {});
let dialogText = null;
page.once('dialog', (d) => { dialogText = d.message(); d.dismiss(); });
await click('#konto-delete-go');
await page.waitForTimeout(500);
pv.deleteAsksConfirm = !!dialogText && dialogText.startsWith('Konto und alle deine Daten endgültig löschen?');
pv.deleteCancelNoRequests = requestLog.length === reqBefore && writesIn(requestLog).length === writesBefore;
pv.stillLoggedIn = await page.evaluate(() => !!state.member && hasStoredAuth());
await click('#konto-delete');
pv.deleteBoxCloses = await page.evaluate(() => document.getElementById('konto-delete-box')?.hidden === true);

// 4. Fingerboard-Tab: sind Figuren im DOM sichtbar? (Ablauf starten braucht Bedienung, hier: Tab rendert)
await page.evaluate(() => { location.hash = 'fingerboard'; });
await page.waitForTimeout(800);
out.steps.fingerboardRendered = await page.evaluate(() => document.getElementById('app').innerText.length > 50);

// 5. Offline-Start: SW abwarten, Cache-Inhalt prüfen, offline neu laden
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(2500);
const scripts = await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.src));
const cached = await page.evaluate(async (prefix) => { const out = []; for (const k of await caches.keys()) { if (!k.startsWith(prefix)) continue; const c = await caches.open(k); out.push(k, ...(await c.keys()).map((r) => r.url)); } return out; }, PREFIX);
out.steps.cacheName = cached.find((x) => !x.startsWith('http'));
out.steps.scriptsInCache = Object.fromEntries(scripts.map((s) => [s.replace(/.*\//, ''), cached.includes(s)]));
offline = true;
await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(4000);
out.steps.offlineStart = await page.evaluate(() => typeof EXERCISE_FIGURES === 'object' && !!state.member && document.getElementById('app').innerHTML.length > 200);
await page.evaluate(() => { location.hash = 'fingerboard'; });
await page.waitForTimeout(800);
out.steps.offlineFingerboard = await page.evaluate(() => document.getElementById('app').innerText.length > 50);

// 6. Datenschutz ohne Anmeldung (frischer Browser-Kontext ohne Login).
const pv2 = out.steps.privacyLoggedOut = {};
const ctx2 = await browser.newContext();
const log2 = [];
await mockFirebase(ctx2, log2, () => false);
const p2 = await ctx2.newPage();
const errs2 = [];
p2.on('pageerror', (e) => errs2.push(e.message));
p2.on('console', (msg) => { if (msg.type() === 'error') errs2.push(msg.text()); });
await p2.goto(BASE + '#datenschutz');
await p2.waitForSelector('.privacy-shell .privacy', { timeout: 8000 }).catch(() => {});
Object.assign(pv2, await p2.evaluate(() => {
  const shell = document.querySelector('.privacy-shell');
  return {
    opens: !!shell && !!shell.querySelector('.privacy'),
    headings: !!shell && shell.querySelectorAll('h3').length === 7,
    noContactLink: !!shell && !shell.querySelector('a[href^="mailto:"]') && shell.textContent.includes(`${PRIVACY_OPERATOR} — die Person, die dich eingeladen hat.`),
    backLink: !!shell && !!shell.querySelector('a[href="#"]'),
    noNav: !document.querySelector('nav'),
  };
}));
pv2.noErrors = errs2.length === 0;
pv2.noFirebaseRequests = log2.length === 0;
if (errs2.length) out.pageErrors.push(...errs2.map((e) => '[datenschutz] ' + e));
await ctx2.close();

out.steps.noRealFirebaseWrites = out.externalUnmocked.length === 0;
out.firebaseWrites = writesIn(requestLog).map((r) => r.m + ' ' + r.path);

await browser.close();
if (server) server.close();

// Auswertung: jede Prüfung muss true sein, keine Seitenfehler, Konsolenfehler nur im Offline-Teil.
const failed = [];
const walk = (o, k) => { for (const [n, v] of Object.entries(o)) { if (v === false) failed.push(k + n); else if (v && typeof v === 'object') walk(v, k + n + '.'); } };
walk(out.steps, '');
if (out.pageErrors.length) failed.push('pageErrors');
if (out.errors.some((e) => !e.startsWith('[offline]') && !e.startsWith('[erwartet 401]'))) failed.push('consoleErrors');
out.result = failed.length ? { ok: false, failed } : { ok: true };
console.log(JSON.stringify(out, null, 2));
process.exit(failed.length ? 1 : 0);
