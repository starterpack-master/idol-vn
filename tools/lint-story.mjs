/** Static checks for story scripts: node tools/lint-story.mjs */
import { prologue } from '../src/story/prologue.js';
import { chapter1 } from '../src/story/chapter1.js';
import { characters } from '../src/story/characters.js';

const scenes = { ...prologue, ...chapter1 };
const BGS = ['classroom_day', 'classroom_sunset', 'rooftop_day', 'rooftop_sunset', 'bedroom_night', 'karaoke', 'hongdae_night', 'livehouse', 'practice_room', 'black'];
const FACES = ['normal', 'smile', 'laugh', 'smug', 'tease', 'surprised', 'shy', 'angry', 'sad'];
const BGMS = [null, 'title', 'daily', 'night', 'tension', 'live', 'rival', 'heart'];
const SFX = ['bell', 'blip', 'pop', 'heart', 'buzz', 'whoosh', 'sting', 'door', 'warn', 'cheer', 'shutter', 'light'];
const errors = [];
let lines = 0, chars = 0;

function walk(list, where) {
  for (const c of list) {
    const at = `${where} → ${c.t}`;
    if (c.t === 'say') {
      lines++; chars += (c.text.match(/[가-힣]/g) || []).length;
      if (c.who && c.who !== '@me' && c.who !== '???' && !characters[c.who]) errors.push(`${at}: unknown speaker ${c.who}`);
      if (c.face && !FACES.includes(c.face)) errors.push(`${at}: bad face ${c.face}`);
    }
    if (c.t === 'msg') chars += (c.text.match(/[가-힣]/g) || []).length;
    if (c.t === 'show' || c.t === 'hide' || c.t === 'face' || c.t === 'move') if (!characters[c.id]) errors.push(`${at}: unknown char ${c.id}`);
    if (c.t === 'show' && c.costume && !characters[c.id]?.costumes?.[c.costume]) errors.push(`${at}: ${c.id} has no costume ${c.costume}`);
    if (c.t === 'face' && !FACES.includes(c.face)) errors.push(`${at}: bad face ${c.face}`);
    if (c.t === 'bg' && !BGS.includes(c.key)) errors.push(`${at}: unknown bg ${c.key}`);
    if (c.t === 'bgm' && !BGMS.includes(c.name)) errors.push(`${at}: unknown bgm ${c.name}`);
    if (c.t === 'sfx' && !SFX.includes(c.name)) errors.push(`${at}: unknown sfx ${c.name}`);
    if (c.t === 'goto' && !scenes[c.scene]) errors.push(`${at}: missing scene ${c.scene}`);
    if (c.t === 'choice') c.options.forEach((o, i) => walk(o.run || [], `${where}/choice${i}`));
    if (c.t === 'if') { walk(c.then, `${where}/then`); walk(c.else || [], `${where}/else`); }
    if (c.t === 'look') c.hotspots.forEach((h) => walk(h.run || [], `${where}/look:${h.id}`));
    if (c.t === 'gaze') { c.options.forEach((o) => walk(o.run || [], `${where}/gaze:${o.target}`)); walk(c.onTimeout || [], `${where}/gaze-timeout`); }
    if (c.t === 'search') { walk(c.found || [], `${where}/found`); walk(c.miss || [], `${where}/miss`); }
    if (c.t === 'schedule') Object.entries(c.events || {}).forEach(([k, arr]) => arr.forEach((s, i) => walk(s, `${where}/sched:${k}#${i}`)));
  }
}
for (const [id, list] of Object.entries(scenes)) walk(list, id);
console.log(`scenes: ${Object.keys(scenes).length}, say lines: ${lines}, Hangul chars (say+msg): ${chars}`);
console.log(errors.length ? errors.join('\n') : 'no errors');
process.exit(errors.length ? 1 : 0);
