/* Browser-Test für die Beta (oder die Haupt-App) mit nachgebildetem Firebase —
   keine echten Zugangsdaten, kein Netz nötig.

   Prüft: Start ohne JS-Fehler, Login über das Formular, alle Tabs, die
   Übungsfiguren (Anzahl + SHA-256 der Daten und aller gerenderten Figuren,
   Info-Sheet, 💪-Ersatz), ob alle <script>-Dateien im Offline-Cache liegen
   und den Offline-Start (inkl. Fingerboard-Tab).

   Ausführen (aus dem Repo-Wurzelordner, braucht Node + Playwright):
     node tools/test-beta.mjs                      # Beta, eigener Mini-Server
     APP=main node tools/test-beta.mjs             # Haupt-App
     BASE=http://localhost:8000/beta/ node tools/test-beta.mjs   # fremder Server
   Ausgabe: JSON mit allen Ergebnissen, Exit-Code 1 bei einem Fehler. Die
   Prüfsummen vor und nach einer Änderung vergleichen = Figuren unverändert.
   Die zwei "[offline] … ERR_FAILED"-Meldungen sind die absichtlich
   blockierten Netzanfragen im Offline-Teil und zählen nicht als Fehler. */
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
const ctx = await browser.newContext({ serviceWorkers: 'allow' });
let offline = false;
await ctx.route(/googleapis\.com|firebasedatabase\.app|fonts\.g/, async (route) => {
  if (offline) return route.abort();
  const u = route.request().url(), m = route.request().method();
  if (/fonts\.g/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  if (/signInWithPassword/.test(u)) return route.fulfill({ json: { idToken, refreshToken: 'r', expiresIn: '3600', localId: 'uid1', email: 't@example.com' } });
  if (/securetoken/.test(u)) return route.fulfill({ json: { id_token: idToken, refresh_token: 'r', expires_in: '3600', user_id: 'uid1' } });
  if (/accounts:lookup/.test(u)) return route.fulfill({ json: { users: [{ emailVerified: true }] } });
  if (m !== 'GET') return route.fulfill({ json: m === 'POST' ? { name: 'k' + Date.now() } : {} });
  if (/\/users\/uid1\.json/.test(u)) return route.fulfill({ json: { memberId: 'm1' } });
  if (/\/members\/m1\.json/.test(u)) return route.fulfill({ json: { name: 'Test', uid: 'uid1' } });
  return route.fulfill({ json: null });
});
const page = await ctx.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') out.errors.push((offline ? '[offline] ' : '') + msg.text()); });
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

await browser.close();
if (server) server.close();

// Auswertung: jede Prüfung muss true sein, keine Seitenfehler, Konsolenfehler nur im Offline-Teil.
const failed = [];
const walk = (o, k) => { for (const [n, v] of Object.entries(o)) { if (v === false) failed.push(k + n); else if (v && typeof v === 'object') walk(v, k + n + '.'); } };
walk(out.steps, '');
if (out.pageErrors.length) failed.push('pageErrors');
if (out.errors.some((e) => !e.startsWith('[offline]'))) failed.push('consoleErrors');
out.result = failed.length ? { ok: false, failed } : { ok: true };
console.log(JSON.stringify(out, null, 2));
process.exit(failed.length ? 1 : 0);
