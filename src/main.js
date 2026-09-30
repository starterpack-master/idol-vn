import './style.css';
import { Panorama } from './engine/Panorama.js';
import { UI } from './engine/UI.js';
import { Menu } from './engine/Menu.js';
import { Runner } from './engine/Runner.js';
import { Assets } from './engine/Assets.js';
import { unlockAudio, playBgm, playSfx, setVolumes, setBgmFiles } from './engine/Audio.js';
import { newState, normalize, saves, settingsStore, clone } from './engine/State.js';
import { story } from './story/index.js';

const $ = (s) => document.querySelector(s);
const settings = settingsStore.load();
const pano = new Panorama($('#stage'));
const ui = new UI(settings);
const menu = new Menu({ story, ui, settings });
const assets = new Assets(story);
setBgmFiles(story.assets.bgm);
setVolumes({ bgm: settings.bgm, sfx: settings.sfx });
window.__pano = pano; window.__ui = ui; // debug handles (tools/smoke.mjs)

let runner = null;
let gyroOn = false;
let titleSpin = false;

// ---------------- title ----------------
async function showTitle() {
  if (runner) { runner.abort(); runner = null; }
  window.__runner = null;
  ui.resetAll(); pano.reset();
  $('#topbar').classList.remove('on');
  pano.setTexture(await assets.background('rooftop_sunset'));
  for (const [id, yaw] of [['seoha', 0], ['chaei', 120], ['eunsol', 240]]) {
    pano.addActor(id, await assets.character(id, 'smile', ''), { yaw, pitch: -6, dist: 3.4, height: story.characters[id].height });
  }
  await pano.turnTo(0, 0, 0);
  titleSpin = true;
  pano.onFrame = (dt) => { if (titleSpin) pano.yaw += dt * 0.006; };
  $('#title').classList.add('on');
  $('#btnContinue').disabled = !saves.read('auto');
  $('#btnLoad').disabled = !saves.hasAny();
  playBgm('title');
  await ui.fade('in', 500);
}

$('#title').addEventListener('click', () => {
  const t = $('#title');
  if (t.classList.contains('ready')) return;
  unlockAudio();
  t.classList.add('ready');
  playBgm('title');
  playSfx('pop');
});

// ---------------- sessions ----------------
async function startSession(state, scene) {
  unlockAudio();
  if (runner) runner.abort();
  titleSpin = false;
  pano.onFrame = null;
  await ui.fade('out', 300);
  $('#title').classList.remove('on');
  ui.resetAll(); pano.reset();
  $('#topbar').classList.add('on');
  const r = new Runner({ pano, ui, story, state: normalize(clone(state)), assets });
  runner = r; window.__runner = r;
  if (state.scene) ui.setDay(state.day, state.date); // loaded mid-story
  const res = await r.play(scene);
  if (res === 'end' && runner === r) { await ui.fade('out', 600); showTitle(); }
}

const loadData = (d) => startSession(d.state, d.state.scene);

function chapterDefault(ch) {
  const s = newState();
  if (ch.id !== 'prologue') s.flags.contract = true;
  return s;
}

async function toggleGyro(on, cb) {
  if (on) {
    gyroOn = await pano.enableGyro();
    if (!gyroOn) ui.toast('이 기기에서는 자이로를 쓸 수 없어요', 'line');
  } else { pano.disableGyro(); gyroOn = false; }
  cb?.(gyroOn === on);
  $('#btnGyro').classList.toggle('active', gyroOn);
}

const openSettings = () => menu.settingsPanel({ onGyro: toggleGyro, gyroOn });
const handlers = {
  save: () => menu.saveLoad('save', { makeSave: () => runner.makeSave() }),
  load: () => menu.saveLoad('load', { onLoad: loadData }),
  notebook: () => menu.notebook(runner.state),
  settings: openSettings,
  title: async () => { await ui.fade('out', 300); showTitle(); },
};

$('#btnNew').onclick = () => startSession(newState(), story.start);
$('#btnContinue').onclick = () => { const d = saves.read('auto'); if (d) loadData(d); };
$('#btnLoad').onclick = () => menu.saveLoad('load', { onLoad: loadData });
$('#btnChapters').onclick = () => menu.chapterSelect((ch, snap) => startSession(snap || chapterDefault(ch), ch.start));
$('#btnSettings').onclick = openSettings;
$('#btnMenu').onclick = () => { if (runner) { playSfx('pop'); menu.gameMenu(handlers); } };
$('#btnGyro').onclick = () => toggleGyro(!gyroOn);

showTitle();
