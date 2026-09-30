/** Verifies SKIP stops at choices, AUTO advances unattended, chapter select starts Chapter 1 directly. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), f = path.join(root, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForTimeout(2000);
await page.click('#title'); await page.click('#btnNew');
await page.waitForSelector('#textInput.on', { timeout: 15000 }); await page.click('#textInput button');
await page.waitForSelector('#tapcatch.on', { timeout: 15000 });

await page.click('#btnSkip');
await page.waitForSelector('#choices.on', { timeout: 30000 });
const skip = await page.evaluate(() => ({ lines: window.__ui.log.length, mode: window.__ui.mode }));
console.log('SKIP -> reached first choice after', skip.lines, 'lines; mode reset to', skip.mode);

await page.click('#choices button');
await page.click('#btnAuto');
const before = await page.evaluate(() => window.__ui.log.length);
await page.waitForTimeout(12000);
const after = await page.evaluate(() => window.__ui.log.length);
console.log('AUTO -> advanced', after - before, 'lines in 12s without taps');
await page.click('#btnAuto');

await page.click('#btnMenu'); await page.click('#panel [data-a="title"]'); await page.click('#panel .confirm .primary');
await page.waitForTimeout(1500);
await page.click('#btnChapters'); await page.click('#panel .chap:nth-of-type(2)');
await page.waitForFunction(() => window.__runner?.state?.scene === 'c1_0', null, { timeout: 15000 });
await page.waitForSelector('#dialog.on', { timeout: 15000 });
const ch = await page.evaluate(() => ({ scene: window.__runner.state.scene, day: document.querySelector('#dday').textContent, text: document.querySelector('#dialog .text').textContent }));
console.log('Chapter select ->', ch.scene, '|', ch.day, '|', ch.text.slice(0, 30));
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); server.close();
