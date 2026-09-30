import { playSfx, setVolumes } from './Audio.js';
import { saves, SLOT_COUNT, chapterSnaps, settingsStore } from './State.js';
import { esc, TEAM_LABELS } from './UI.js';

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (t) => { const d = new Date(t); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Modal panels: save/load, settings, notebook, chapter select, in-game menu */
export class Menu {
  constructor({ story, ui, settings }) {
    this.story = story;
    this.ui = ui;
    this.settings = settings;
    this.el = $('#panel');
    this.el.querySelector('.close').onclick = () => this.close();
    this.el.onclick = (e) => { if (e.target === this.el) this.close(); };
    this.onClose = null;
  }

  open(title, html, bind) {
    this.el.querySelector('h2').textContent = title;
    const body = this.el.querySelector('.body');
    body.innerHTML = html;
    body.scrollTop = 0;
    this.el.classList.add('on');
    this.ui.paused = true;
    bind?.(body);
  }

  close() {
    if (!this.el.classList.contains('on')) return;
    this.el.classList.remove('on');
    this.ui.paused = false;
    playSfx('pop');
    const cb = this.onClose; this.onClose = null; cb?.();
  }

  /** small in-panel confirm dialog */
  confirm(text) {
    return new Promise((res) => {
      const box = document.createElement('div');
      box.className = 'confirm';
      box.innerHTML = `<p>${esc(text)}</p><div><button data-v="0">취소</button><button data-v="1" class="primary">확인</button></div>`;
      this.el.querySelector('.sheet').appendChild(box);
      box.querySelectorAll('button').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); box.remove(); playSfx('pop'); res(b.dataset.v === '1'); }));
    });
  }

  toast(text) {
    const t = document.createElement('div');
    t.className = 'panel-toast'; t.textContent = text;
    this.el.querySelector('.sheet').appendChild(t);
    setTimeout(() => t.remove(), 1600);
  }

  // ---------- save / load ----------
  /** mode: 'save' | 'load'. makeSave(): data for a slot. onLoad(data) */
  saveLoad(mode, { makeSave, onLoad } = {}) {
    const slots = ['auto', ...Array.from({ length: SLOT_COUNT }, (_, i) => i + 1)];
    const row = (s) => {
      const d = saves.read(s);
      const disabled = (mode === 'save' && s === 'auto') || (mode === 'load' && !d);
      return `<button class="slot" data-slot="${s}" ${disabled ? 'disabled' : ''}>
        <div class="thumb">${d?.meta?.thumb ? `<img src="${d.meta.thumb}" alt="">` : '<span>NO DATA</span>'}</div>
        <div class="info"><b>${s === 'auto' ? '자동 저장' : `슬롯 ${s}`}</b>
          <span>${d ? esc(d.meta.label) : '— 비어 있음 —'}</span>
          <small>${d ? `D-${d.meta.day} · ${fmtTime(d.meta.savedAt)}` : ''}</small></div></button>`;
    };
    const render = () => this.open(mode === 'save' ? '세이브' : '로드',
      `<p class="note">${mode === 'save' ? '현재 씬의 시작 지점이 저장됩니다.' : '불러올 데이터를 선택하세요.'}</p>${slots.map(row).join('')}`,
      (body) => body.querySelectorAll('.slot').forEach((b) => (b.onclick = async () => {
        const s = b.dataset.slot === 'auto' ? 'auto' : +b.dataset.slot;
        const d = saves.read(s);
        if (mode === 'save') {
          if (d && !(await this.confirm(`슬롯 ${s}에 덮어쓸까요?`))) return;
          saves.write(s, makeSave()) ? (playSfx('heart'), render(), this.toast('저장했습니다')) : this.toast('저장 공간이 부족합니다');
        } else if (d && (await this.confirm('이 데이터를 불러올까요? 진행 중인 내용은 사라집니다.'))) {
          this.el.classList.remove('on'); this.ui.paused = false; onLoad(d);
        }
      })));
    render();
  }

  // ---------- settings ----------
  settingsPanel({ onGyro, gyroOn } = {}) {
    const s = this.settings;
    const range = (key, label, min, max, step, left, right) =>
      `<label class="set"><span>${label}</span><div class="rng"><small>${left}</small><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${key === 'textSpeed' ? 65 - s.textSpeed : s[key]}"><small>${right}</small></div></label>`;
    const tog = (key, label, on) => `<label class="set tog"><span>${label}</span><input type="checkbox" data-t="${key}" ${on ? 'checked' : ''}></label>`;
    this.open('설정', [
      range('textSpeed', '텍스트 속도', 5, 60, 1, '느림', '빠름'),
      range('autoWait', 'AUTO 대기 시간', 0.4, 2.5, 0.1, '짧게', '길게'),
      range('bgm', 'BGM 볼륨', 0, 1, 0.05, '0', '최대'),
      range('sfx', '효과음 볼륨', 0, 1, 0.05, '0', '최대'),
      tog('toasts', '호감도 변화 알림', s.toasts),
      tog('showNumbers', '수첩에 수치 표시', s.showNumbers),
      tog('gyro', '자이로(폰 움직여 둘러보기)', gyroOn),
      '<p class="note">자이로는 LOOK · GAZE · SEARCH 장면에서만 동작해요.</p>',
    ].join(''), (body) => {
      body.querySelectorAll('input[type=range]').forEach((i) => (i.oninput = () => {
        const k = i.dataset.k;
        s[k] = k === 'textSpeed' ? 65 - +i.value : +i.value;
        setVolumes({ bgm: s.bgm, sfx: s.sfx });
        settingsStore.save(s);
      }));
      body.querySelectorAll('input[type=checkbox]').forEach((i) => (i.onchange = () => {
        if (i.dataset.t === 'gyro') { onGyro?.(i.checked, (ok) => { if (!ok) i.checked = false; }); return; }
        s[i.dataset.t] = i.checked; settingsStore.save(s);
      }));
    });
  }

  // ---------- producer notebook ----------
  notebook(state) {
    const c = this.story.characters, st = state.stats, showNum = this.settings.showNumbers;
    const hearts = (v) => { const n = Math.min(5, Math.ceil(v / 3)); return '♥'.repeat(n) + '♡'.repeat(5 - n) + (showNum ? ` <small>${v}</small>` : ''); };
    const members = ['seoha', 'chaei', 'eunsol', 'lilith'].map((id) => {
      if (!state.profiles[id]) return '<div class="card locked"><b>???</b><p>아직 만나지 않았다.</p></div>';
      const d = c[id], col = state.vars[`color_${id}`];
      return `<div class="card" style="--c:${d.color}"><div class="head"><b>${esc(d.name)}</b><span>${esc(d.stage ? `예명 · ${d.stage}` : '')}</span></div>
        <div class="hearts">${hearts(st.love[id] ?? 0)}</div><p>${esc(d.profile || '')}</p>${col ? `<small>멤버 컬러 · ${esc(col)}</small>` : ''}</div>`;
    }).join('');
    const bar = (label, v, max = 100, cls = '') => `<div class="row"><span>${label}</span><div class="bar ${cls}"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></div><b>${v}</b></div>`;
    const f = state.flags;
    const concept = f.concept_classic ? '왕도 청초계' : f.concept_cool ? '쿨 & 다크계' : f.concept_denpa ? '전파 & 서브컬처계' : '(미정)';
    const team = `<div class="teaminfo"><b>${esc(state.vars.team || '(팀 이름 미정)')}</b><span>컨셉 · ${concept}</span></div>`
      + Object.entries(TEAM_LABELS).map(([k, l]) => (k === 'fans' ? `<div class="row"><span>${l}</span><div class="fans">${st.team.fans}명</div></div>` : bar(l, st.team[k] ?? 0))).join('')
      + bar('프로듀서 평가', st.pro, 30, 'pro') + bar('선 넘음 위험도', st.line, 20, 'line');
    const goals = (this.story.goals || []).map((g) => `<li class="${f[g.flag] ? 'done' : ''}">${esc(g.text)}</li>`).join('');
    const contract = `<div class="dday">D-${state.day}<small>${esc(state.date || '')}</small></div><p class="note">100일 계약 — 단독 공연을 매진시키지 못하면 해산.</p><ul class="goals">${goals}</ul>`;
    const tabs = { members, team, contract };
    this.open('프로듀서 수첩', `<div class="tabs"><button data-tab="members" class="on">멤버</button><button data-tab="team">팀</button><button data-tab="contract">계약</button></div><div class="tabbody">${members}</div>`, (body) => {
      body.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
        body.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
        body.querySelector('.tabbody').innerHTML = tabs[b.dataset.tab];
        playSfx('pop');
      }));
    });
  }

  // ---------- chapter select ----------
  chapterSelect(onPick) {
    const snaps = chapterSnaps.all();
    this.open('챕터 선택', '<p class="note">도달한 챕터는 그 시점의 호감도·플래그로 시작해요. 미도달 챕터는 기본값으로 체험할 수 있어요.</p>'
      + this.story.chapters.map((ch, i) => `<button class="chap" data-i="${i}"><b>${esc(ch.title)}</b><span>${esc(ch.sub)}</span><small>${snaps[ch.id] ? '✓ 도달' : '미도달 · 기본값으로 시작'}</small></button>`).join(''),
      (body) => body.querySelectorAll('.chap').forEach((b) => (b.onclick = () => {
        const ch = this.story.chapters[+b.dataset.i];
        this.el.classList.remove('on'); this.ui.paused = false;
        onPick(ch, snaps[ch.id]);
      })));
  }

  // ---------- in-game menu ----------
  gameMenu(h) {
    const items = [['save', '💾', '세이브'], ['load', '📂', '로드'], ['notebook', '📒', '프로듀서 수첩'], ['settings', '⚙️', '설정'], ['title', '🏠', '타이틀로'], ['close', '▶', '계속하기']];
    this.open('메뉴', `<div class="grid">${items.map(([a, i, l]) => `<button data-a="${a}">${i}<span>${l}</span></button>`).join('')}</div>`,
      (body) => body.querySelectorAll('button').forEach((b) => (b.onclick = async () => {
        playSfx('pop');
        const a = b.dataset.a;
        if (a === 'close') return this.close();
        if (a === 'title') {
          if (await this.confirm('타이틀로 돌아갈까요? 저장하지 않은 진행은 사라져요.')) { this.el.classList.remove('on'); this.ui.paused = false; h.title(); }
          return;
        }
        h[a]();
      })));
  }
}
