import { Assets } from './Assets.js';
import { playSfx, playBgm } from './Audio.js';
import { addStat, evalCond, saves, chapterSnaps, clone } from './State.js';
import { TEAM_LABELS } from './UI.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ABORT = Symbol('abort');

// ---------- Korean particles: {given:아} -> 도현아 / 민수야 ----------
const jong = (w) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; };
const PAIRS = { 은: ['은', '는'], 는: ['은', '는'], 이: ['이', '가'], 가: ['이', '가'], 을: ['을', '를'], 를: ['을', '를'], 아: ['아', '야'], 야: ['아', '야'], 과: ['과', '와'], 와: ['과', '와'], 이랑: ['이랑', '랑'], 랑: ['이랑', '랑'], 이야: ['이야', '야'], 이나: ['이나', '나'], 이에요: ['이에요', '예요'] };
export function josa(word, p) {
  const j = jong(word);
  if (p === '으로' || p === '로') return j && j !== 8 ? '으로' : '로';
  const pair = PAIRS[p];
  return pair ? (j ? pair[0] : pair[1]) : p;
}

export class Runner {
  constructor({ pano, ui, story, state, assets }) {
    this.pano = pano;
    this.ui = ui;
    this.story = story;
    this.state = state;
    this.assets = assets || new Assets(story);
    this.faces = new Map();
    this.costumes = new Map();
    this.aborted = false;
    this.snapshot = null;     // state at the start of the current scene (what gets saved)
    this.pendingAuto = false; // autosave once the new scene has rendered its first line
  }

  abort() { this.aborted = true; }

  /** resolves 'end' when the story finishes, 'abort' when the session is torn down */
  async play(sceneId) {
    let next = sceneId;
    try {
      while (next) {
        const list = this.story.scenes[next];
        if (!list) throw new Error(`Unknown scene: ${next}`);
        this.state.scene = next;
        this.state.visited[next] = true;
        this.snapshot = clone(this.state);
        this.pendingAuto = true;
        const ch = this.story.chapters?.find((c) => c.start === next);
        if (ch) chapterSnaps.write(ch.id, this.snapshot);
        next = await this.runList(list);
      }
      return 'end';
    } catch (e) {
      if (e === ABORT) return 'abort';
      throw e;
    }
  }

  label(scene) { return this.story.titles?.[scene] || scene; }

  makeSave() {
    const s = this.snapshot || clone(this.state);
    return { state: s, meta: { label: this.label(s.scene), day: s.day, date: s.date, savedAt: Date.now(), thumb: this.pano.snapshot() } };
  }

  async runList(list) {
    for (const c of list) {
      if (this.aborted) throw ABORT;
      const r = await this.exec(c);
      if (this.aborted) throw ABORT;
      if (r !== undefined) return r;
    }
    return undefined;
  }

  vars() {
    const n = this.state.name;
    return { ...this.state.vars, team: this.state.vars.team || '(가칭) 프로젝트 B1', name: n, given: n.length === 3 ? n.slice(1) : n };
  }

  fmt(text) {
    const v = this.vars();
    return String(text).replace(/\{(\w+)(?::([가-힣]+))?\}/g, (m, k, p) => {
      const val = v[k];
      if (val == null || val === '') return m;
      return p ? val + josa(String(val), p) : String(val);
    });
  }

  who(id) {
    if (!id) return { name: '', color: '' };
    if (id === '@me') return { name: this.state.name, color: '#5b6b8c' };
    const c = this.story.characters[id];
    return c ? { name: c.name, color: c.color } : { name: id, color: '#666' };
  }

  get skipping() { return this.ui.mode === 'skip'; }

  // ---------- commands ----------
  async exec(c) {
    const { pano, ui } = this;
    switch (c.t) {
      case 'say': {
        if (this.pendingAuto) { this.pendingAuto = false; saves.write('auto', this.makeSave()); }
        if (c.face && c.who && this.story.characters[c.who]) await this.setFace(c.who, c.face);
        const w = this.who(c.who);
        await ui.say({ name: w.name, color: w.color, text: this.fmt(c.text), think: c.think });
        return;
      }
      case 'lock': pano.interactive = false; ui.hint(''); return;
      case 'unlock': pano.interactive = true; return;
      case 'turn': ui.hideDialog(); if (c.ms > 300) playSfx('whoosh'); await pano.turnTo(c.yaw, c.pitch, this.skipping ? Math.min(c.ms, 200) : c.ms); return;
      case 'zoom': await pano.zoom(c.mul, this.skipping ? 100 : c.ms); return;
      case 'shake': pano.shake(c.power, c.ms); return;
      case 'bg':
        pano.setTexture(await this.assets.background(c.key));
        pano.clearActors(); pano.clearMarkers(); this.faces.clear(); this.costumes.clear();
        return;
      case 'show': return this.show(c);
      case 'move': await pano.moveActor(c.id, c, this.skipping ? 100 : c.ms ?? 500); return;
      case 'hide':
        if (c.fade !== false && !this.skipping) await pano.fadeActor(c.id, 0, 300);
        pano.removeActor(c.id); this.faces.delete(c.id); return;
      case 'face': await this.setFace(c.id, c.face); return;
      case 'fade': ui.hideDialog(); await ui.fade(c.dir, c.ms); return;
      case 'flash': await ui.flash(c.color, this.skipping ? 100 : c.ms); return;
      case 'wait': ui.hideDialog(); await sleep(this.skipping ? 0 : c.ms); return;
      case 'sfx': playSfx(c.name); return;
      case 'bgm': playBgm(c.name); return;
      case 'fx':
        if (c.name === 'stage') ui.setStageFx(true);
        else if (c.name === 'sparkle') pano.setFx('sparkle', { yaw: c.yaw ?? pano.yaw, glow: this.assets.glow() });
        else { ui.setStageFx(false); pano.setFx(null); }
        return;
      case 'day': this.state.day = c.n; this.state.date = c.date; ui.setDay(c.n, c.date); return;
      case 'profile':
        if (!this.state.profiles[c.id]) { this.state.profiles[c.id] = true; ui.toast(`📒 수첩 갱신 · ${this.story.characters[c.id]?.name ?? c.id}`, 'pro'); }
        return;
      case 'chapter': ui.hideDialog(); await ui.chapter(this.fmt(c.title), this.fmt(c.sub)); return;
      case 'caption': await ui.caption(this.fmt(c.text)); return;
      case 'phone':
        if (c.on === false) ui.hidePhone(); else ui.showPhone({ mode: c.mode, title: this.fmt(c.title || '') });
        return;
      case 'msg': ui.hideDialog(); ui.addMsg(c.from, this.fmt(c.text)); await ui.waitTap(); return;
      case 'choice': {
        const opts = c.options.filter((o) => !o.if || evalCond(this.state, o.if));
        const i = await ui.choice(opts.map((o) => ({ text: this.fmt(o.text) })), c.prompt && this.fmt(c.prompt));
        return this.runList(opts[i].run || []);
      }
      case 'look': return this.look(c);
      case 'gaze': return this.gaze(c);
      case 'search': return this.search(c);
      case 'schedule': return this.schedule(c);
      case 'askName': ui.hideDialog(); this.state.name = await ui.askName(this.state.name); return;
      case 'askText': ui.hideDialog(); this.state.vars[c.key] = await ui.askText({ prompt: this.fmt(c.prompt), def: c.def }); return;
      case 'setvar': this.state.vars[c.key] = c.value; return;
      case 'goto': return c.scene;
      case 'stat': return this.stat(c.key, c.n);
      case 'flag': this.state.flags[c.k] = c.v; return;
      case 'if': return this.runList(evalCond(this.state, c.cond) ? c.then : c.else);
      case 'end': ui.hideDialog(); await ui.chapter('— END —', this.fmt(c.text || '')); return null;
      default: console.warn('unknown command', c);
    }
  }

  async show(c) {
    const def = this.story.characters[c.id];
    const f = c.face || 'normal';
    const costume = c.costume ?? this.costumes.get(c.id) ?? '';
    const tex = await this.assets.character(c.id, f, costume);
    const fade = c.fade !== false && !this.skipping;
    this.pano.addActor(c.id, tex, {
      yaw: c.yaw ?? 0, pitch: c.pitch ?? -8, dist: c.dist ?? 3,
      height: c.height ?? def?.height ?? 2.3, opacity: fade ? 0 : 1,
    });
    this.faces.set(c.id, f);
    this.costumes.set(c.id, costume);
    if (fade) await this.pano.fadeActor(c.id, 1, 350);
  }

  async setFace(id, f) {
    if (!this.pano.actors.has(id) || this.faces.get(id) === f) return;
    this.pano.setActorTexture(id, await this.assets.character(id, f, this.costumes.get(id) || ''));
    this.faces.set(id, f);
  }

  stat(key, n) {
    if (!n) return;
    addStat(this.state, key, n);
    const { ui } = this;
    if (key.startsWith('love.')) {
      const name = this.story.characters[key.slice(5)]?.name ?? key;
      if (n > 0) { ui.toast(`♡ ${name}`, 'love'); if (ui.settings.toasts) playSfx('heart'); } else ui.toast(`… ${name}`, 'down');
    } else if (key.startsWith('team.')) {
      const label = TEAM_LABELS[key.slice(5)] ?? key;
      ui.toast(`♪ ${label} ${n > 0 ? '+' : ''}${n}`, n > 0 ? 'team' : 'down');
    } else if (key === 'pro') ui.toast(n > 0 ? '★ 프로듀서 평가 상승' : '☆ 프로듀서 평가 하락', 'pro');
    else if (key === 'line') { ui.toast(n > 0 ? '⚠ 선을 넘을 뻔했다' : '✓ 선을 지켰다', 'line'); if (n > 0) playSfx('warn'); }
  }

  spotYaw(h) { return h.actor ? this.pano.actors.get(h.id)?.yaw ?? 0 : h.yaw; }

  // ---------- LOOK: free exploration ----------
  async look(c) {
    const { pano, ui } = this;
    ui.stopSkip();
    const visited = new Set();
    const markerTex = this.assets.marker();
    const exists = (h) => (!h.actor || pano.actors.has(h.id)) && (!h.if || evalCond(this.state, h.if));
    const alive = (h) => exists(h) && !(h.once !== false && visited.has(h.id));
    const required = c.require || [];
    const ready = () => required.every((id) => visited.has(id));

    while (true) {
      ui.hideDialog();
      pano.clearMarkers();
      c.hotspots.forEach((h) => { if (!h.actor && alive(h)) pano.addMarker(h.id, markerTex, h.yaw, h.pitch, { hidden: h.hidden, dist: h.dist ?? 6 }); });
      pano.interactive = true;
      ui.hint(this.fmt(c.hint || '드래그해서 둘러보기 · 대상을 탭'));
      pano.onFrame = () => ui.setCompass(c.hotspots.filter((h) => !h.hidden && exists(h)).map((h) => ({
        relYaw: pano.relYaw(this.spotYaw(h)), label: h.label || '•', done: visited.has(h.id),
      })));
      const avail = new Set(c.hotspots.filter(alive).map((h) => h.id));
      const tapped = new Promise((res) => (pano.onTap = (id) => id && avail.has(id) && res(id)));
      const doneP = ready() && c.done !== false ? ui.showLookDone(this.fmt(c.done || '다음으로')).then(() => '__done') : new Promise(() => {});
      const pick = await Promise.race([tapped, doneP]);
      if (this.aborted) throw ABORT;

      pano.onTap = null; pano.onFrame = null; pano.interactive = false;
      ui.hideLookDone(); ui.hint(''); ui.setCompass(null); pano.clearMarkers();
      if (pick === '__done') return;

      visited.add(pick);
      const h = c.hotspots.find((x) => x.id === pick);
      playSfx('pop');
      if (h.flag) this.state.flags[h.flag] = true;
      const r = await this.runList(h.run || []);
      if (r !== undefined) return r;
      if (c.autoEnd && ready()) return;
      if (c.done === false && !c.hotspots.some(alive)) return;
    }
  }

  // ---------- GAZE: choose by looking (actors, or markers with yaw/pitch) ----------
  async gaze(c) {
    const { pano, ui } = this;
    ui.stopSkip(); ui.hideDialog();
    const byId = new Map(c.options.map((o) => [o.target, o]));
    const markerTex = this.assets.marker();
    c.options.forEach((o) => { if (!pano.actors.has(o.target)) pano.addMarker(o.target, markerTex, o.yaw ?? 0, o.pitch ?? 0, { dist: 5 }); });
    const yawOf = (o) => pano.actors.get(o.target)?.yaw ?? o.yaw ?? 0;
    ui.hint(this.fmt(c.prompt || '누구를 볼까? (화면 중앙에 맞추고 잠시 바라보기)'));
    pano.interactive = true;
    pano.gazeTargets = new Set(byId.keys());
    let acc = 0, cur = null, elapsed = 0;

    const pick = await new Promise((res) => {
      pano.onTap = (id) => id && byId.has(id) && res(id);
      pano.onFrame = (dt) => {
        if (ui.paused) return;
        elapsed += dt;
        ui.setCompass(c.options.map((o) => ({ relYaw: pano.relYaw(yawOf(o)), label: o.label || '?' })));
        const hit = pano.gazeHit;
        if (hit !== cur) { cur = hit; acc = 0; }
        acc = hit ? acc + dt : 0;
        const need = (hit && byId.get(hit)?.dwell) || c.dwell || 1200;
        ui.setReticle(true, hit ? acc / need : 0);
        if (hit && acc >= need) res(hit);
        if (c.timeout && elapsed > c.timeout) res('__timeout');
      };
    });
    if (this.aborted) throw ABORT;
    pano.onTap = null; pano.onFrame = null; pano.gazeTargets = null; pano.interactive = false;
    ui.setReticle(false); ui.hint(''); ui.setCompass(null); pano.clearMarkers();
    if (pick === '__timeout') return this.runList(c.onTimeout || []);
    playSfx('pop');
    const opt = byId.get(pick);
    await pano.turnTo(yawOf(opt), pano.actors.has(pick) ? pano.pitch : opt.pitch ?? pano.pitch, 400);
    return this.runList(opt.run || []);
  }

  // ---------- SEARCH: timed find ----------
  async search(c) {
    const { pano, ui } = this;
    ui.stopSkip(); ui.hideDialog();
    ui.hint(this.fmt(c.prompt || '찾아라!'));
    pano.interactive = true;
    pano.gazeTargets = new Set([c.target]);
    let t = 0, acc = 0;
    const found = await new Promise((res) => {
      pano.onTap = (id) => id === c.target && res(true);
      pano.onFrame = (dt) => {
        if (ui.paused) return;
        t += dt;
        ui.setTimer(Math.max(0, 1 - t / c.time));
        acc = pano.gazeHit ? acc + dt : 0;
        ui.setReticle(true, acc / 500);
        if (acc >= 500) res(true);
        if (t >= c.time) res(false);
      };
    });
    if (this.aborted) throw ABORT;
    pano.onTap = null; pano.onFrame = null; pano.gazeTargets = null; pano.interactive = false;
    ui.setTimer(null); ui.setReticle(false); ui.hint('');
    const a = pano.actors.get(c.target);
    if (found && a) await pano.turnTo(a.yaw, a.pitch, 300);
    return this.runList(found ? c.found || [] : c.miss || []);
  }

  // ---------- PRODUCE: weekly schedule mini-game ----------
  /**
   * c.options: [{ id, label, icon, desc, effects: {'team.vocal': 10, ...}, pick: 'member', love, line }]
   * c.events:  { [optionId | `${optionId}_${member}`]: [script for 1st time, 2nd time, ...] }
   * Low team mood (< 30) halves all training gains.
   */
  async schedule(c) {
    const { ui } = this;
    ui.hideDialog();
    const names = Object.fromEntries(c.members.map((m) => [m, this.story.characters[m].name]));
    const plan = await ui.schedule(c, { names, team: this.state.stats.team });
    if (this.aborted) throw ABORT;
    const before = clone(this.state.stats.team);
    const counts = (this.state.counts ??= {});

    for (let w = 0; w < plan.length; w++) {
      const p = plan[w], o = c.options.find((x) => x.id === p.opt);
      ui.hideDialog();
      await ui.banner(c.weeks[w], `${o.icon || ''} ${o.label}${p.member ? ` · ${names[p.member]}` : ''}`);
      if (this.aborted) throw ABORT;
      const tired = (this.state.stats.team.mood ?? 60) < 30;
      let penalized = false;
      for (const [k, n0] of Object.entries(o.effects || {})) {
        const halve = tired && n0 > 0 && !k.endsWith('mood');
        penalized ||= halve;
        this.stat(k, halve ? Math.max(1, Math.round(n0 / 2)) : n0);
      }
      if (penalized) ui.toast('😵 다들 지쳐서 연습 효율이 절반으로…', 'line');
      if (p.member) { if (o.love) this.stat(`love.${p.member}`, o.love); if (o.line) this.stat('line', o.line); }
      const key = p.member ? `${o.id}_${p.member}` : o.id;
      const i = (counts[key] = (counts[key] ?? 0) + 1) - 1;
      const scripts = c.events?.[key];
      if (scripts?.length) {
        const r = await this.runList(scripts[Math.min(i, scripts.length - 1)]);
        if (r !== undefined) return r;
      }
    }
    ui.hideDialog();
    await ui.teamResult(before, this.state.stats.team, c.resultTitle || '연습 결과');
    if (this.aborted) throw ABORT;
  }
}
