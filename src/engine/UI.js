import { playSfx } from './Audio.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** focusing inputs can scroll the fixed game container; snap it back */
const resetScroll = () => { const a = $('#app'); a.scrollTop = 0; a.scrollLeft = 0; window.scrollTo(0, 0); };
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const TEAM_LABELS = { vocal: '보컬', dance: '댄스', charm: '매력', fans: '팬', mood: '팀 분위기' };

/** In-game HUD & overlays. Menus live in Menu.js. */
export class UI {
  constructor(settings) {
    this.settings = settings;
    this.dialog = $('#dialog');
    this.nameEl = $('#dialog .name');
    this.textEl = $('#dialog .text');
    this.tapcatch = $('#tapcatch');
    this.choicesEl = $('#choices');
    this.hintEl = $('#hint');
    this.compass = $('#compass');
    this.reticle = $('#reticle');
    this.timerEl = $('#timer');
    this.fader = $('#fader');
    this.toasts = $('#toasts');
    this.phoneEl = $('#phone');
    this.lookDone = $('#lookDone');
    this.mode = 'normal'; // 'normal' | 'auto' | 'skip'
    this.paused = false;  // true while a menu panel is open
    this.log = [];

    $('#btnLog').onclick = () => this.toggleLog();
    $('#logPanel').onclick = () => this.toggleLog(false);
    $('#btnAuto').onclick = () => this.setMode(this.mode === 'auto' ? 'normal' : 'auto');
    $('#btnSkip').onclick = () => this.setMode(this.mode === 'skip' ? 'normal' : 'skip');
    window.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && this.tapcatch.classList.contains('on') && !this.paused) { e.preventDefault(); this.tapcatch.click(); }
    });
  }

  setMode(m) {
    this.mode = m;
    $('#btnAuto').classList.toggle('active', m === 'auto');
    $('#btnSkip').classList.toggle('active', m === 'skip');
    this._onMode?.();
  }
  stopSkip() { if (this.mode === 'skip') this.setMode('normal'); }

  /** advance automatically in auto/skip mode (respecting pause) */
  _schedule(done, autoMs) {
    clearTimeout(this._autoT);
    if (this.mode === 'normal') return;
    const tick = () => (this.paused ? (this._autoT = setTimeout(tick, 300)) : done());
    this._autoT = setTimeout(tick, this.mode === 'skip' ? 60 : autoMs * this.settings.autoWait);
  }

  // ---------- dialog ----------
  /** resolves after the player taps past the fully shown line */
  say({ name, text, think, color }) {
    this.dialog.classList.add('on');
    this.dialog.classList.toggle('think', !!think);
    this.nameEl.textContent = name || '';
    this.nameEl.style.display = name ? '' : 'none';
    this.nameEl.style.background = color || '';
    this.log.push({ name, text, think });
    const shown = think ? `(${text})` : text;

    return new Promise((resolve) => {
      let i = 0, done = false;
      this.textEl.textContent = '';
      this.dialog.classList.remove('ready');
      const advance = () => {
        clearInterval(this._typeT); clearTimeout(this._autoT);
        this._onMode = null; this.tapcatch.onclick = null; this.tapcatch.classList.remove('on');
        resolve();
      };
      const finish = () => {
        done = true; clearInterval(this._typeT);
        this.textEl.textContent = shown; this.dialog.classList.add('ready');
        this._schedule(advance, 1100 + shown.length * 55);
      };
      this._onMode = () => (done ? this._schedule(advance, 1100 + shown.length * 55) : this.mode === 'skip' && finish());
      if (this.mode === 'skip') finish();
      else {
        this._typeT = setInterval(() => {
          if (this.paused) return;
          i++;
          this.textEl.textContent = shown.slice(0, i);
          if (i % 3 === 0) playSfx('blip');
          if (i >= shown.length) finish();
        }, this.settings.textSpeed);
      }
      this.tapcatch.classList.add('on');
      this.tapcatch.onclick = () => (done ? advance() : finish());
    });
  }

  hideDialog() { this.dialog.classList.remove('on'); }

  /** wait for a tap anywhere (between chat bubbles); auto/skip advance by themselves */
  waitTap() {
    return new Promise((res) => {
      const done = () => {
        clearTimeout(this._autoT); this._onMode = null;
        this.tapcatch.onclick = null; this.tapcatch.classList.remove('on'); res();
      };
      this._onMode = () => this._schedule(done, 1500);
      this._schedule(done, 1500);
      this.tapcatch.classList.add('on');
      this.tapcatch.onclick = done;
    });
  }

  choice(options, prompt) {
    this.stopSkip();
    this.choicesEl.innerHTML = '';
    if (prompt) { const p = document.createElement('div'); p.className = 'prompt'; p.textContent = prompt; this.choicesEl.appendChild(p); }
    this.choicesEl.classList.add('on');
    return new Promise((resolve) => {
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.textContent = o.text;
        b.style.animationDelay = `${i * 80}ms`;
        b.onclick = () => { playSfx('pop'); this.choicesEl.classList.remove('on'); this.log.push({ name: '▶ 선택', text: o.text }); resolve(i); };
        this.choicesEl.appendChild(b);
      });
    });
  }

  // ---------- hud ----------
  hint(text) { this.hintEl.textContent = text || ''; this.hintEl.classList.toggle('on', !!text); }

  showLookDone(label) {
    this.lookDone.textContent = label;
    this.lookDone.classList.add('on');
    return new Promise((res) => (this.lookDone.onclick = () => { this.lookDone.classList.remove('on'); playSfx('pop'); res(); }));
  }
  hideLookDone() { this.lookDone.classList.remove('on'); this.lookDone.onclick = null; }

  /** markers: [{relYaw, label, done}] */
  setCompass(markers) {
    if (!markers) { this.compass.classList.remove('on'); this._compassHtml = ''; return; }
    this.compass.classList.add('on');
    const html = markers.map((m) => `<span class="mk ${m.done ? 'done' : ''}" style="left:${50 + (m.relYaw / 180) * 50}%">${esc(m.label)}</span>`).join('');
    if (html !== this._compassHtml) { this.compass.querySelector('.marks').innerHTML = html; this._compassHtml = html; }
  }

  setReticle(on, progress = 0) { this.reticle.classList.toggle('on', on); this.reticle.style.setProperty('--p', progress); }

  setTimer(frac) {
    if (frac == null) { this.timerEl.classList.remove('on'); return; }
    this.timerEl.classList.add('on');
    this.timerEl.firstElementChild.style.width = `${frac * 100}%`;
  }

  setDay(day, date) {
    const el = $('#dday');
    if (day == null) { el.classList.remove('on'); return; }
    el.innerHTML = `<b>D-${day}</b>${date ? `<span>${esc(date)}</span>` : ''}`;
    el.classList.add('on');
  }

  setStageFx(on) { $('#fxStage').classList.toggle('on', !!on); }

  toast(text, kind = 'love') {
    if (kind === 'love' || kind === 'down') { if (!this.settings.toasts) return; }
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  async fade(dir, ms = 600) {
    if (this.mode === 'skip') ms = Math.min(ms, 150);
    this.fader.style.transition = `opacity ${ms}ms`;
    this.fader.style.opacity = dir === 'out' ? 1 : 0;
    await sleep(ms);
  }

  async flash(color, ms) {
    this.fader.style.transition = 'none';
    this.fader.style.background = color;
    this.fader.style.opacity = 0.9;
    await sleep(30);
    this.fader.style.transition = `opacity ${ms}ms`;
    this.fader.style.opacity = 0;
    await sleep(ms);
    this.fader.style.background = '#000';
  }

  async chapter(title, sub) {
    const c = $('#chapterCard');
    c.querySelector('h1').textContent = title;
    c.querySelector('p').textContent = sub;
    c.classList.add('on');
    await sleep(this.mode === 'skip' ? 700 : 2600);
    c.classList.remove('on');
    await sleep(600);
  }

  /** place/time card; stays up briefly without blocking the script */
  caption(text) {
    const c = $('#caption');
    c.textContent = text;
    c.classList.add('on');
    clearTimeout(this._capT);
    this._capT = setTimeout(() => c.classList.remove('on'), 3200);
    return sleep(this.mode === 'skip' ? 0 : 450);
  }

  // ---------- phone overlay ----------
  showPhone({ mode = 'fancam', title = '' }) {
    this.phoneEl.className = `on ${mode}`;
    this.phoneEl.querySelector('.chat-head').textContent = title;
    this.phoneEl.querySelector('.chat-body').innerHTML = '';
  }
  hidePhone() { this.phoneEl.className = ''; }
  addMsg(from, text) {
    const body = this.phoneEl.querySelector('.chat-body');
    const b = document.createElement('div');
    b.className = `bubble ${from}`;
    const m = from === 'them' && text.match(/^\[(.+?)\]\s*(.*)$/); // "[이름] 내용" -> sender label
    if (m) b.innerHTML = `<i>${esc(m[1])}</i>${esc(m[2])}`; else b.textContent = text;
    body.appendChild(b);
    body.scrollTop = body.scrollHeight;
    playSfx(from === 'me' ? 'pop' : 'buzz');
    this.log.push({ name: { me: '나 (메시지)', them: '메시지', sys: '알림' }[from], text });
  }

  // ---------- text input ----------
  askText({ prompt, def = '', max = 12 }) {
    this.stopSkip();
    const box = $('#textInput');
    const input = box.querySelector('input');
    box.querySelector('p').textContent = prompt;
    input.value = def; input.maxLength = max;
    box.classList.add('on');
    setTimeout(() => input.focus({ preventScroll: true }), 50);
    return new Promise((res) => {
      const ok = () => {
        const v = input.value.trim() || def;
        input.blur();
        box.classList.remove('on'); playSfx('pop');
        resetScroll(); setTimeout(resetScroll, 300); // mobile keyboards pan the viewport
        box.querySelector('button').onclick = null; input.onkeydown = null;
        res(v.slice(0, max));
      };
      box.querySelector('button').onclick = ok;
      input.onkeydown = (e) => e.key === 'Enter' && ok();
    });
  }
  askName(def) { return this.askText({ prompt: '당신의 이름은? (주인공 이름)', def, max: 8 }); }

  /** centered banner (week results etc.) */
  async banner(title, sub = '', ms = 1400) {
    const el = $('#banner');
    el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    el.classList.add('on');
    await sleep(this.mode === 'skip' ? 400 : ms);
    el.classList.remove('on');
    await sleep(250);
  }

  // ---------- produce: schedule planner ----------
  _opt(def, id) { return def.options.find((o) => o.id === id); }
  _fxText(o) {
    const parts = Object.entries(o.effects || {}).map(([k, n]) => `${TEAM_LABELS[k.split('.').pop()] ?? k} ${n > 0 ? '+' : ''}${n}`);
    if (o.love) parts.push(`호감도 +${o.love}`);
    return parts.join(' · ');
  }

  /** resolves with [{opt, member}] per week */
  schedule(def, { names, team }) {
    this.stopSkip();
    const el = $('#schedule');
    const plan = def.weeks.map(() => ({ opt: null, member: null }));
    return new Promise((res) => {
      const render = () => {
        const st = el.querySelector('.sheet')?.scrollTop || 0;
        const complete = plan.every((p) => p.opt && (!this._opt(def, p.opt).pick || p.member));
        el.innerHTML = `<div class="sheet"><h2>${esc(def.title)}</h2><p class="tip">${esc(def.tip || '')}</p>
          <div class="teambar">${Object.entries(TEAM_LABELS).map(([k, l]) => `<span>${l}<b>${team[k] ?? 0}</b></span>`).join('')}</div>
          ${def.weeks.map((w, wi) => {
            const o = plan[wi].opt && this._opt(def, plan[wi].opt);
            return `<div class="week"><div class="wk">${esc(w)}</div>
              <div class="opts">${def.options.map((x) => `<button class="opt ${plan[wi].opt === x.id ? 'sel' : ''}" data-w="${wi}" data-o="${x.id}"><em>${x.icon || ''}</em>${esc(x.label)}</button>`).join('')}</div>
              ${o ? `<div class="desc">${esc(o.desc || '')}<br><b>${esc(this._fxText(o))}</b></div>` : ''}
              ${o?.pick ? `<div class="members">${def.members.map((m) => `<button class="mem ${plan[wi].member === m ? 'sel' : ''}" data-w="${wi}" data-m="${m}">${esc(names[m])}</button>`).join('')}</div>` : ''}
            </div>`;
          }).join('')}
          <button class="go" ${complete ? '' : 'disabled'}>이 계획으로 진행</button></div>`;
        el.querySelector('.sheet').scrollTop = st;
        el.querySelectorAll('.opt').forEach((b) => (b.onclick = () => {
          playSfx('pop'); const p = plan[+b.dataset.w]; p.opt = b.dataset.o;
          if (!this._opt(def, p.opt).pick) p.member = null; render();
        }));
        el.querySelectorAll('.mem').forEach((b) => (b.onclick = () => { playSfx('pop'); plan[+b.dataset.w].member = b.dataset.m; render(); }));
        el.querySelector('.go').onclick = () => { if (!complete) return; playSfx('heart'); el.classList.remove('on'); res(plan); };
      };
      render();
      el.classList.add('on');
    });
  }

  teamResult(before, after, title = '연습 결과') {
    const el = $('#result');
    const rows = Object.entries(TEAM_LABELS).map(([k, l]) => {
      const b = before[k] ?? 0, a = after[k] ?? 0, d = a - b, max = k === 'fans' ? Math.max(20, a) : 100;
      return `<div class="row"><span>${l}</span><div class="bar"><i style="width:${(Math.min(a, b) / max) * 100}%"></i><i class="${d < 0 ? 'loss' : 'gain'}" style="left:${(Math.min(a, b) / max) * 100}%;width:${(Math.abs(d) / max) * 100}%"></i></div><b class="${d < 0 ? 'neg' : ''}">${a}${d ? ` (${d > 0 ? '+' : ''}${d})` : ''}</b></div>`;
    }).join('');
    el.innerHTML = `<div class="sheet"><h2>${esc(title)}</h2>${rows}<button class="go">확인</button></div>`;
    el.classList.add('on');
    return new Promise((res) => (el.querySelector('.go').onclick = () => { playSfx('pop'); el.classList.remove('on'); res(); }));
  }

  // ---------- misc ----------
  toggleLog(force) {
    const p = $('#logPanel');
    const on = force ?? !p.classList.contains('on');
    p.classList.toggle('on', on);
    this.paused = on;
    if (on) {
      p.innerHTML = '<h3>백로그 · 탭해서 닫기</h3>' + this.log.slice(-150).map((l) =>
        `<div class="l ${l.think ? 'think' : ''}"><b>${esc(l.name ?? '')}</b>${esc(l.text)}</div>`).join('');
      p.scrollTop = p.scrollHeight;
    }
  }

  /** clear every overlay/timer (title <-> game, loading a save) */
  resetAll() {
    clearInterval(this._typeT); clearTimeout(this._autoT); clearTimeout(this._capT);
    this._onMode = null; this.setMode('normal'); this.paused = false;
    this.tapcatch.onclick = null; this.tapcatch.classList.remove('on');
    this.hideDialog(); this.choicesEl.classList.remove('on'); this.hideLookDone();
    this.hint(''); this.setCompass(null); this.setReticle(false); this.setTimer(null);
    this.hidePhone(); this.setStageFx(false); this.setDay(null);
    ['#caption', '#chapterCard', '#textInput', '#schedule', '#result', '#banner', '#logPanel'].forEach((s) => $(s).classList.remove('on'));
    this.toasts.innerHTML = '';
    this.log = [];
    this.fader.style.background = '#000';
  }
}
