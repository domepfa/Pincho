import { chromium } from 'playwright';
import path from 'path';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 880, height: 876 } });
await page.goto('file://' + '/tmp/claude-0/-home-user-Pincho/e14bc4d1-737c-5d52-a0df-def8879e508d/scratchpad/rig/rig.html');
await page.waitForTimeout(500);
for (const name of (process.env.ONLY ? [process.env.ONLY] : ['flex', 'wave', 'cheer', 'squat'])) {
  for (let i = 0; i < 24; i++) {
    await page.evaluate(([n, t]) => setPose(n, t), [name, i / 24]);
    await page.screenshot({ path: `/tmp/claude-0/-home-user-Pincho/e14bc4d1-737c-5d52-a0df-def8879e508d/scratchpad/rig/frames/${name}-${String(i).padStart(2, '0')}.png` });
  }
}
await browser.close();
