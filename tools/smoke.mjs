/**
 * Headless full play-through (title → prologue → chapter 1 → end) on a phone viewport.
 * Serves dist/ itself, answers every prompt (LOOK/GAZE/SEARCH/choices/schedule), opens menus, saves, and screenshots.
 * Usage: npm run build && node tools/smoke.mjs [outDir]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('dist');
const out = path.resolve(process.argv[2] || 'shots');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
await page.addInitScript(() => { if (!localStorage.getItem('b1-idol-settings')) localStorage.setItem('b1-idol-settings', JSON.stringify({ textSpeed: 5 })); });

const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${name}.png` }); taken.push(name); };
const taken = [];
await page.goto(url);
await page.waitForTimeout(2500);
await shot('00_title_tap');
await page.click('#title');
await page.waitForTimeout(500);
await shot('00_title_menu');
await page.click('#btnNew');

// dialogue/message fragment -> screenshot name
const shots = {
  '열한 번째': '01_fancam', '아마네? 이름': '02_turn_seoha', '이쪽? 3층': '03_stalker_window', '프로듀싱 해주라': '04_proposal',
  '백은솔?': '05_eunsol_door', '숙제 해왔어?': '06_c1_morning', '센터는 누구야?': '07_center', '참지 못하고 돌아봤다': '09_eunsol_sing',
  '초대했습니다': '10_groupchat', '노란 탬버린 준비': '11_karaoke', '먼저 눈 피하는': '12_chaei_close', '토요일 저녁의 홍대': '13_hongdae',
  '가장 가까이 있는 곳': '14_stairs', '밤이 왔어': '15_live', '운영이지?': '17_lilith', '곡 있어?': '18_gom', '괜찮은 척하는 얼굴': '19_seoha_night',
  '파이팅!': '22_team_hands', '"찾았다."': '23_found',
};
const looks = {
  '점심시간. 교실': ['chaei', 'eunsol', 'stalker', 'myphone', 'board'], '뒤에서 소리': ['eunsol'], '책상 서랍': ['eunsol', 'note'],
  '한 명씩 피드백': ['seoha', 'chaei', 'eunsol'], '공연 전에 거리': ['eunsol', 'busking', 'poster', 'underpass'],
  '공연 중!': ['lilith', 'seoha', 'chaei', 'eunsol', 'penlight'],
};
const gazePlan = ['sky', 'chaei'];
const lookShots = { '점심시간. 교실': '03a_look_classroom', '공연 전에 거리': '13a_look_hongdae', '공연 중!': '15a_look_live' };
let choiceN = 0, gazeN = 0, menuDone = false, searchShot = false;
const done = new Set();

const t0 = Date.now();
while (Date.now() - t0 < 600000) {
  const s = await page.evaluate(() => {
    const on = (q) => document.querySelector(q).classList.contains('on');
    return {
      input: on('#textInput'), choices: on('#choices'), lookDone: on('#lookDone'), hint: on('#hint') ? document.querySelector('#hint').textContent : '',
      tap: on('#tapcatch'), reticle: on('#reticle'), timer: on('#timer'), sched: on('#schedule'), result: on('#result'), title: on('#title'),
      ready: document.querySelector('#dialog').classList.contains('ready'),
      text: document.querySelector('#dialog .text').textContent + ' ' + [...document.querySelectorAll('.bubble')].map((b) => b.textContent).join(' '),
      gaze: window.__pano.gazeTargets ? [...window.__pano.gazeTargets] : null,
    };
  });
  if (s.title && Date.now() - t0 > 8000) break;
  for (const [frag, name] of Object.entries(shots)) {
    if (!done.has(name) && s.text.includes(frag)) { done.add(name); await shot(name); }
  }
  if (s.input) { await page.fill('#textInput input', s.text.includes('팀 이름') ? '소다맛 테스트' : '강도현'); await page.click('#textInput button'); continue; }
  if (s.sched) {
    await shot('20_schedule_empty');
    for (const [w, o] of [[0, 'vocal'], [1, 'care'], [2, 'sns']]) await page.click(`#schedule .opt[data-w="${w}"][data-o="${o}"]`);
    await page.click('#schedule .mem[data-w="1"][data-m="eunsol"]');
    await shot('20_schedule_filled');
    await page.click('#schedule .go'); continue;
  }
  if (s.result) { await shot('21_result'); await page.click('#result .go'); continue; }
  if (s.choices) {
    const btns = await page.$$('#choices button');
    await btns[choiceN++ % btns.length].click(); continue;
  }
  if (s.timer) {
    if (!searchShot) { searchShot = true; await page.evaluate(() => (window.__pano.yaw = 120)); await shot('16_search'); }
    await page.evaluate(() => window.__pano.onTap?.('stalker')); await page.waitForTimeout(200); continue;
  }
  if (s.gaze && !s.tap) {
    if (gazeN === 0) await shot('07a_gaze');
    const target = gazePlan[gazeN++] ?? s.gaze[0];
    await page.evaluate((t) => window.__pano.onTap?.(t), target); await page.waitForTimeout(200); continue;
  }
  if (s.hint && !s.tap) {
    const key = Object.keys(looks).find((k) => s.hint.includes(k));
    if (key && lookShots[key]) { await page.evaluate(() => (window.__pano.yaw += 25)); await shot(lookShots[key]); delete lookShots[key]; }
    const id = key && looks[key].shift();
    if (id) { await page.evaluate((i) => window.__pano.onTap?.(i), id); await page.waitForTimeout(250); continue; }
    if (s.lookDone) { await page.click('#lookDone'); continue; }
  }
  if (!menuDone && s.text.includes('합정역 코인노래방') && s.ready) {
    menuDone = true;
    await page.click('#btnMenu'); await shot('30_menu');
    await page.click('#panel [data-a="notebook"]'); await shot('31_notebook_members');
    await page.click('#panel .tabs [data-tab="team"]'); await shot('32_notebook_team');
    await page.click('#panel .tabs [data-tab="contract"]'); await shot('33_notebook_contract');
    await page.click('#panel .close');
    await page.click('#btnMenu'); await page.click('#panel [data-a="save"]');
    await page.click('#panel .slot[data-slot="1"]'); await shot('34_saved');
    await page.click('#panel .close'); continue;
  }
  if (s.tap) { await page.click('#tapcatch', { position: { x: 195, y: 330 } }); await page.waitForTimeout(30); continue; }
  await page.waitForTimeout(120);
}
await shot('40_back_to_title');
const final = await page.evaluate(() => JSON.parse(localStorage.getItem('b1-idol-save-auto'))?.state);
console.log('elapsed(s):', Math.round((Date.now() - t0) / 1000), '| last autosave scene:', final?.scene);
console.log('stats:', JSON.stringify(final?.stats), '\nvars:', JSON.stringify(final?.vars), '\nflags:', Object.keys(final?.flags || {}).join(','));

// load test from title
await page.click('#btnLoad'); await shot('41_load_panel');
await page.click('#panel .slot[data-slot="1"]'); await page.click('#panel .confirm .primary');
await page.waitForTimeout(3000);
const loaded = await page.evaluate(() => window.__runner?.state?.scene);
console.log('loaded slot 1 -> scene:', loaded);
await shot('42_after_load');
await page.click('#btnMenu'); await page.click('#panel [data-a="title"]'); await page.click('#panel .confirm .primary');
await page.waitForTimeout(1500);
await page.click('#btnChapters'); await shot('43_chapters');
console.log('screens:', taken.length, '| errors:', errors.length ? errors : 'none');
await browser.close();
server.close();
