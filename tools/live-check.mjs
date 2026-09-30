/**
 * Smoke-checks a deployed URL on a phone viewport: title renders, game starts, first lines + TURN play without errors.
 * Usage: node tools/live-check.mjs https://<user>.github.io/idol-vn/ [outDir]
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2];
const out = process.argv[3] || 'shots';
if (!url) { console.error('usage: node tools/live-check.mjs <url> [outDir]'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [], failed = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

const res = await page.goto(url, { waitUntil: 'networkidle' });
console.log('document:', res.status(), res.url());
await page.waitForTimeout(2500);
const title = await page.evaluate(() => ({
  h2: document.querySelector('#title h2')?.textContent,
  font: document.fonts.check('900 40px "Pretendard Variable"', '지하'),
  webgl: !!document.querySelector('#stage canvas'),
}));
console.log('title:', JSON.stringify(title));
await page.screenshot({ path: `${out}/live_01_title.png` });

await page.click('#title');
await page.click('#btnNew');
await page.waitForSelector('#textInput.on', { timeout: 20000 });
await page.click('#textInput button');
let lines = 0, turned = false;
for (let i = 0; i < 60 && !turned; i++) {
  await page.waitForSelector('#tapcatch.on', { timeout: 20000 });
  const t = await page.evaluate(() => document.querySelector('#dialog .text').textContent);
  if (t.includes('아마네? 이름')) { turned = true; await page.waitForTimeout(400); break; }
  if (i === 2) await page.screenshot({ path: `${out}/live_02_fancam.png` });
  await page.click('#tapcatch', { position: { x: 195, y: 330 } });
  lines++;
  await page.waitForTimeout(120);
}
await page.screenshot({ path: `${out}/live_03_turn.png` });
const st = await page.evaluate(() => ({ scene: window.__runner?.state?.scene, yaw: Math.round(window.__pano.yaw), dday: document.querySelector('#dday').textContent }));
console.log('play:', JSON.stringify({ ...st, lines, turned }));
console.log('failed requests:', failed.length ? failed : 'none');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length || failed.length || !turned ? 1 : 0);
