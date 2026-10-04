#!/usr/bin/env node
/* Smoke-Test: startet Haupt-App und Beta in Chromium (Handy-Grösse 390x844)
   gegen eine nachgebaute Firebase (keine echten Daten, kein Netz nötig),
   öffnet jeden Tab, lässt einen Board-Ablauf ein paar Sekunden laufen und
   meldet jeden JavaScript-Fehler. Gedacht als Sicherheitsnetz vor jedem
   Merge, vor allem nach Umbauten (Dateien aufteilen, verschieben …).

   Aufruf aus dem Repo-Stamm:   node tools/smoke-test.mjs
   Voraussetzung: Playwright (npm i -g playwright && npx playwright install chromium)
   Optional: --shots   legt Screenshots je Tab unter /tmp/pincho-smoke/ ab */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots') ? '/tmp/pincho-smoke' : null;

// Playwright lokal oder global (npm i -g) finden
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (e) {
  const { execSync } = await import('node:child_process');
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = createRequire(path.join(globalRoot, 'noop.js'))('playwright'));
}

/* ---------- Statischer Server für das Repo ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.md': 'text/markdown' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---------- Nachgebaute Firebase ---------- */
const now = Date.now(), day = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const FIXTURES = {
  'users/u1': { memberId: 'm1' },
  'members/m1': { name: 'Test', crews: { c1: true } },
  'crews/c1': { name: 'Testcrew', owner: 'm1', members: { m1: true } },
  'logs/m1': {
    l1: { date: iso(now - 3 * day), type: 'gym', exercises: [{ exerciseId: 'face_pull', sets: [{ reps: 10, weight: 20 }, { reps: 8, weight: 22 }] }], note: '', rpe: 'mittel', createdAt: now - 3 * day },
    l2: { date: iso(now - day), type: 'gym', exercises: [{ exerciseId: 'face_pull', sets: [{ reps: 10, weight: 22 }] }], note: '', rpe: null, createdAt: now - day },
  },
  'fingerboardSessions/m1': {
    s1: { date: iso(now - 2 * day), board: 'bm1000', weight: 0, templateId: 'pp_beginner',
      blocks: [{ type: 'hang', board: 'bm1000', grip: 'edge_large', reps: 3, hangSec: 7, restSec: 3, blockRestSec: 60 }],
      results: [{ done: 3 }], createdAt: now - 2 * day },
  },
};
const DATA_PATH = /\.firebasedatabase\.app\/(.*?)\.json/;
async function fakeFirebase(route) {
  const req = route.request();
  const m = DATA_PATH.exec(req.url());
  if (!m) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  if (req.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: '-test' + Math.random().toString(36).slice(2) }) });
  if (req.method() !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: req.postData() || 'null' });
  const value = FIXTURES[decodeURIComponent(m[1])];
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value === undefined ? null : value) });
}

/* ---------- Ablauf ---------- */
const ROUTES = ['plan', 'log', 'fingerboard', 'challenges', 'progress', 'konto', 'hilfe', 'datenschutz'];
const browser = await chromium.launch();
let failures = 0;

for (const [label, urlPath, prefix] of [['Haupt-App', '/', 'pincho_'], ['Beta', '/beta/', 'pinchobeta_']]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.route(/googleapis\.com|firebasedatabase\.app|gstatic\.com/, (route) =>
    (route.request().url().includes('fonts.') ? route.abort() : fakeFirebase(route)));
  await context.addInitScript(([p]) => {
    if (sessionStorage.getItem('smoke-init')) return;
    sessionStorage.setItem('smoke-init', '1');
    localStorage.clear();
    localStorage.setItem(p + 'uauth', JSON.stringify({ idToken: 'test', refreshToken: 'test', expiresAt: Date.now() + 3600e3, uid: 'u1', email: 'test@example.com' }));
    localStorage.setItem(p + 'profile', JSON.stringify({ id: 'm1', name: 'Test', uid: 'u1' }));
    localStorage.setItem(p + 'active_crew', 'c1');
  }, [prefix]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(msg.text())) errors.push(`console: ${msg.text()}`); });
  page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) errors.push(`fehlt: ${r.url().slice(BASE.length)}`); });
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().slice(BASE.length)}`); });

  await page.goto(BASE + urlPath + '#plan');
  await page.waitForTimeout(800);
  const step = async (name, fn) => {
    const before = errors.length;
    try { await fn(); } catch (e) { errors.push(`${name}: ${e.message.split('\n')[0]}`); }
    const ok = errors.length === before;
    if (!ok) failures++;
    console.log(`${ok ? '  ok ' : ' FEHL'}  ${label} · ${name}${ok ? '' : '\n        ' + errors.slice(before).join('\n        ')}`);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${label}-${name}.png` }); }
  };

  for (const r of ROUTES) {
    await step(r, async () => {
      await page.evaluate((h) => { location.hash = h; }, r);
      await page.waitForTimeout(600);
      const len = await page.evaluate(() => document.getElementById('app').innerHTML.length);
      if (len < 200) throw new Error(`#app fast leer (${len} Zeichen)`);
    });
  }
  // Log-Untermodi (Freestyle, Ausdauer, Flow, Plan) durchklicken
  await step('log-modi', async () => {
    await page.evaluate(() => { location.hash = 'log'; });
    await page.waitForTimeout(500);
    for (const mode of ['freestyle', 'wall', 'flow', 'planned']) {
      await page.evaluate((m) => { logMode = m; render(); }, mode);
      await page.waitForTimeout(300);
    }
  });
  // Board-Ablauf: Programm starten, ein paar Sekunden laufen lassen, abbrechen
  await step('board-ablauf', async () => {
    await page.evaluate(() => { location.hash = 'fingerboard'; });
    await page.waitForTimeout(500);
    await page.evaluate(() => fbStartTemplate('pp_beginner'));
    await page.waitForTimeout(2500);
    if (!(await page.$('#fb-overlay'))) throw new Error('Ablauf-Vollbild fehlt');
    await page.evaluate(() => cancelAblauf());
  });
  // Faultier-Puppe: jede Pose einmal bauen
  await step('faultier-posen', async () => {
    const bad = await page.evaluate(() => Object.keys(SLOTH_POSES).filter((n) => { try { return !slothFigure(n).startsWith('<svg'); } catch (e) { return true; } }));
    if (bad.length) throw new Error('Posen fehlerhaft: ' + bad.join(', '));
  });
  await context.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} Schritt(e) mit Fehlern` : '\nAlles ok');
process.exit(failures ? 1 : 0);
