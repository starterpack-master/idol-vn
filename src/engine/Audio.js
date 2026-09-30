/**
 * WebAudio: synthesized SFX + a tiny step-sequencer for placeholder BGM.
 * Real audio files can override any track via story.assets.bgm[name].
 */
let ctx = null, sfxGain = null, musicGain = null, noiseBuf = null;
const vol = { bgm: 0.5, sfx: 0.7 };
let fileMap = {};
let current = null;        // { name, gain, timer } | { name, audio }
let pending = null;        // track requested before audio unlocked

export function setBgmFiles(map) { fileMap = map || {}; }

export function setVolumes({ bgm, sfx } = {}) {
  if (bgm != null) vol.bgm = bgm;
  if (sfx != null) vol.sfx = sfx;
  if (ctx) { musicGain.gain.value = vol.bgm * 0.55; sfxGain.gain.value = vol.sfx; }
  if (current?.audio) current.audio.volume = vol.bgm;
}

export function unlockAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = ctx.createGain(); musicGain = ctx.createGain();
    sfxGain.connect(ctx.destination); musicGain.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setVolumes();
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (pending !== null) { const p = pending; pending = null; playBgm(p); }
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function tone(freq, start, dur, { type = 'sine', vol: v = 0.15, slide = 0, attack = 0.015, dest } = {}) {
  const t = Math.max(ctx.currentTime, start);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest || sfxGain);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(start, dur, { hp = 1000, v = 0.2, dest } = {}) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(v, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(dest || sfxGain);
  src.start(start); src.stop(start + dur + 0.02);
}

function kick(t, dest) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.25);
}

const T = 't', S = 's', Q = 'q'; // wave shorthands
const WAVE = { t: 'triangle', s: 'sine', q: 'square', w: 'sawtooth' };

/**
 * Track format: 16 steps per bar. chords: 4-note midi arrays per bar.
 * bass/arp/drum patterns are 16-char strings. arp digits index the chord.
 * lead: optional per-bar arrays of 8 eighth-notes (midi, 0 = rest).
 */
const TRACKS = {
  title: { bpm: 92, chords: [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [53, 57, 60, 65]],
    bass: 'x.......x.....x.', arp: '0.2.1.3.2.1.0.3.', arpWave: T, arpOct: 12, pad: S,
    drums: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' } },
  daily: { bpm: 116, chords: [[53, 57, 60, 65], [48, 52, 55, 60], [50, 53, 57, 62], [46, 50, 53, 58]],
    bass: 'x...x.x.x...x.x.', arp: '0.1.2.1.0.1.2.3.', arpWave: Q, arpOct: 12, arpVol: 0.025,
    drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    lead: [[77, 0, 76, 74, 72, 0, 69, 0], [72, 0, 74, 0, 76, 0, 0, 0], [74, 0, 72, 69, 65, 0, 69, 0], [70, 0, 69, 0, 67, 0, 0, 0]] },
  night: { bpm: 70, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]],
    bass: 'x.......x.......', arp: '0...2...1...3...', arpWave: S, arpOct: 24, arpVol: 0.05, pad: S },
  tension: { bpm: 64, chords: [[50, 53, 57, 62], [50, 53, 57, 62], [46, 50, 53, 58], [45, 49, 52, 57]],
    arp: '0..............1', arpWave: T, arpOct: 0, pad: 'w', padVol: 0.018,
    drums: { h: 'x...x...x...x...' } },
  live: { bpm: 150, chords: [[53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 59, 64], [57, 60, 64, 69]],
    bass: 'x.x.x.x.x.x.x.x.', arp: '0123012301230123', arpWave: 'w', arpOct: 12, arpVol: 0.018,
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    lead: [[72, 0, 72, 74, 76, 0, 77, 76], [74, 0, 71, 0, 67, 0, 0, 0], [71, 0, 72, 74, 76, 0, 79, 0], [76, 0, 74, 0, 72, 0, 0, 0]] },
  rival: { bpm: 128, chords: [[50, 53, 57, 62], [46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 57]],
    bass: 'x..x..x.x..x..x.', bassWave: 'w', arp: '0.3.1.3.2.3.1.3.', arpWave: Q, arpOct: 12, arpVol: 0.022,
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' } },
  heart: { bpm: 76, chords: [[53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 59, 64], [57, 60, 64, 69]],
    bass: 'x.......x.......', arp: '0.1.2.3.2.1.0.1.', arpWave: T, arpOct: 12, arpVol: 0.04, pad: S,
    lead: [[0, 0, 72, 74, 76, 0, 74, 72], [74, 0, 0, 0, 71, 72, 74, 0], [76, 0, 79, 0, 76, 74, 72, 0], [72, 0, 0, 0, 0, 0, 0, 0]] },
};

function startSequencer(name) {
  const tr = TRACKS[name];
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
  gain.connect(musicGain);
  const stepDur = 60 / tr.bpm / 4;
  let step = 0, next = ctx.currentTime + 0.1;

  const playStep = (t) => {
    const bar = Math.floor(step / 16) % tr.chords.length, s = step % 16;
    const ch = tr.chords[bar];
    if (tr.pad && s === 0) ch.forEach((m) => tone(mtof(m), t, stepDur * 16, { type: WAVE[tr.pad], vol: tr.padVol ?? 0.03, attack: 0.4, dest: gain }));
    if (tr.bass?.[s] === 'x') tone(mtof(ch[0] - 24), t, stepDur * 1.8, { type: WAVE[tr.bassWave || T], vol: 0.12, dest: gain });
    const a = tr.arp?.[s];
    if (a && a !== '.') tone(mtof(ch[+a % ch.length] + (tr.arpOct ?? 12)), t, stepDur * 1.6, { type: WAVE[tr.arpWave || T], vol: tr.arpVol ?? 0.04, dest: gain });
    const d = tr.drums || {};
    if (d.k?.[s] === 'x') kick(t, gain);
    if (d.s?.[s] === 'x') { noise(t, 0.14, { hp: 1500, v: 0.18, dest: gain }); tone(190, t, 0.08, { vol: 0.06, dest: gain }); }
    if (d.h?.[s] === 'x') noise(t, 0.04, { hp: 7000, v: 0.06, dest: gain });
    if (tr.lead && s % 2 === 0) {
      const m = tr.lead[bar % tr.lead.length][s / 2];
      if (m) tone(mtof(m), t, stepDur * 1.9, { type: 'square', vol: 0.03, dest: gain });
    }
  };

  const timer = setInterval(() => {
    while (next < ctx.currentTime + 0.15) { playStep(next); next += stepDur; step++; }
  }, 25);
  return { name, gain, timer };
}

function stopCurrent() {
  if (!current) return;
  const c = current; current = null;
  if (c.audio) { c.audio.pause(); return; }
  c.gain.gain.cancelScheduledValues(ctx.currentTime);
  c.gain.gain.setValueAtTime(Math.max(0.0001, c.gain.gain.value), ctx.currentTime);
  c.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
  setTimeout(() => { clearInterval(c.timer); c.gain.disconnect(); }, 800);
}

/** name = track id, or null to stop */
export function playBgm(name) {
  if (!ctx) { pending = name; return; }
  if (current?.name === name) return;
  stopCurrent();
  if (!name) return;
  const url = fileMap[name];
  if (url) {
    const audio = new Audio(import.meta.env.BASE_URL + url);
    audio.loop = true; audio.volume = vol.bgm; audio.play().catch(() => {});
    current = { name, audio };
  } else if (TRACKS[name]) current = startSequencer(name);
}
export const currentBgm = () => current?.name ?? null;

const SFX = {
  bell: () => [659, 523, 587, 392, 392, 587, 659, 523].forEach((f, i) => tone(f, ctx.currentTime + i * 0.42, 0.9, { vol: 0.1, type: 'triangle' })),
  blip: () => tone(1200, ctx.currentTime, 0.03, { vol: 0.025, type: 'square' }),
  pop: () => tone(520, ctx.currentTime, 0.12, { slide: 2, vol: 0.12 }),
  heart: () => { tone(880, ctx.currentTime, 0.15, { vol: 0.08 }); tone(1320, ctx.currentTime + 0.1, 0.25, { vol: 0.08 }); },
  buzz: () => { for (let i = 0; i < 3; i++) tone(90, ctx.currentTime + i * 0.18, 0.12, { type: 'sawtooth', vol: 0.06 }); },
  whoosh: () => noise(ctx.currentTime, 0.45, { hp: 600, v: 0.08 }),
  sting: () => { tone(220, ctx.currentTime, 1.4, { type: 'sawtooth', vol: 0.05 }); tone(233, ctx.currentTime, 1.4, { type: 'sawtooth', vol: 0.05 }); },
  door: () => tone(140, ctx.currentTime, 0.25, { type: 'square', vol: 0.05, slide: 0.6 }),
  warn: () => { tone(440, ctx.currentTime, 0.12, { type: 'square', vol: 0.05 }); tone(330, ctx.currentTime + 0.12, 0.2, { type: 'square', vol: 0.05 }); },
  cheer: () => { noise(ctx.currentTime, 1.6, { hp: 900, v: 0.12 }); for (let i = 0; i < 6; i++) tone(700 + Math.random() * 600, ctx.currentTime + Math.random() * 0.8, 0.3, { vol: 0.02, type: 'triangle' }); },
  shutter: () => { noise(ctx.currentTime, 0.05, { hp: 3000, v: 0.2 }); noise(ctx.currentTime + 0.08, 0.05, { hp: 3000, v: 0.15 }); },
  light: () => tone(90, ctx.currentTime, 0.3, { type: 'square', vol: 0.06 }),
};

export function playSfx(name) {
  if (!ctx || !SFX[name]) return;
  SFX[name]();
}
