/**
 * Exports story scripts to a readable scenario document (docs/02_시나리오_프롤로그.md).
 * The game data is the single source of truth — edit src/story/*.js, then run: npm run export-script
 */
import fs from 'node:fs';
import { prologue, titles0 } from '../src/story/prologue.js';
import { chapter1, titles1 } from '../src/story/chapter1.js';
import { characters } from '../src/story/characters.js';

const nameOf = (id) => (id === '@me' ? '나' : characters[id]?.name ?? id);
let out = [];

function emit(list, d = 0) {
  const p = '  '.repeat(d);
  for (const c of list) {
    switch (c.t) {
      case 'say': {
        const f = c.face ? ` *(${c.face})*` : '';
        if (c.think) out.push(`${p}- *(${c.text})*`);
        else if (!c.who) out.push(`${p}- ${c.text}`);
        else out.push(`${p}- **${nameOf(c.who)}**${f}: ${c.text}`);
        break;
      }
      case 'chapter': out.push(`\n# ${c.title} — ${c.sub}\n`); break;
      case 'caption': out.push(`${p}> 📍 ${c.text}\n`); break;
      case 'bg': out.push(`${p}- \`[배경: ${c.key}]\``); break;
      case 'turn': out.push(`${p}- \`[TURN → yaw ${c.yaw}°, pitch ${c.pitch}°]\``); break;
      case 'lock': out.push(`${p}- \`[LOCK]\``); break;
      case 'show': out.push(`${p}- \`[등장: ${nameOf(c.id)} @ yaw ${c.yaw ?? 0}° / 거리 ${c.dist ?? 3}]\``); break;
      case 'hide': out.push(`${p}- \`[퇴장: ${nameOf(c.id)}]\``); break;
      case 'phone': out.push(`${p}- \`[폰 ${c.on === false ? '닫기' : `열기: ${c.mode}${c.title ? ` · ${c.title}` : ''}`}]\``); break;
      case 'msg': out.push(`${p}- 📱 ${{ me: '나', them: '상대', sys: '알림' }[c.from]}: ${c.text}`); break;
      case 'stat': out.push(`${p}- \`[${c.key} ${c.n > 0 ? '+' : ''}${c.n}]\``); break;
      case 'flag': out.push(`${p}- \`[플래그: ${c.k}]\``); break;
      case 'goto': out.push(`${p}- → **${c.scene}**`); break;
      case 'choice':
        out.push(`${p}- **【선택지】**`);
        c.options.forEach((o) => { out.push(`${p}  - ▶ ${o.text}`); emit(o.run || [], d + 2); });
        break;
      case 'if':
        out.push(`${p}- **【조건: ${c.cond}】**`); emit(c.then, d + 1);
        if (c.else?.length) { out.push(`${p}- **【그 외】**`); emit(c.else, d + 1); }
        break;
      case 'look':
        out.push(`${p}- **【LOOK 자유탐색】** ${c.hint || ''}`);
        c.hotspots.forEach((h) => { out.push(`${p}  - 🔍 ${h.label || h.id}${h.hidden ? ' *(숨김·MISS)*' : ''}`); emit(h.run || [], d + 2); });
        break;
      case 'gaze':
        out.push(`${p}- **【GAZE 시선선택】** ${c.prompt || ''}`);
        c.options.forEach((o) => { out.push(`${p}  - 👀 ${o.label || o.target}`); emit(o.run || [], d + 2); });
        break;
      case 'search':
        out.push(`${p}- **【SEARCH ${c.time / 1000}초】** ${c.prompt || ''}`);
        out.push(`${p}  - 발견`); emit(c.found || [], d + 2);
        out.push(`${p}  - 실패`); emit(c.miss || [], d + 2);
        break;
      case 'day': out.push(`${p}- \`[D-${c.n} · ${c.date}]\``); break;
      case 'setvar': out.push(`${p}- \`[${c.key} = ${c.value}]\``); break;
      case 'askText': out.push(`${p}- \`[입력: ${c.prompt}]\``); break;
      case 'profile': out.push(`${p}- \`[수첩: ${nameOf(c.id)}]\``); break;
      case 'schedule':
        out.push(`${p}- **【PRODUCE 연습 계획】** ${c.weeks.join(' / ')}`);
        c.options.forEach((o) => out.push(`${p}  - ${o.icon} ${o.label}: ${o.desc}`));
        Object.entries(c.events || {}).forEach(([k, arr]) => arr.forEach((s, i) => { out.push(`${p}  - 이벤트 \`${k}\` #${i + 1}`); emit(s, d + 2); }));
        break;
      case 'end': out.push(`\n**— END — ${c.text || ''}**`); break;
      default: break; // fade/wait/sfx/bgm/zoom etc. are omitted from the readable script
    }
  }
}

const docs = [
  ['docs/02_시나리오_프롤로그.md', 'src/story/prologue.js', prologue, titles0],
  ['docs/03_시나리오_1장.md', 'src/story/chapter1.js', chapter1, titles1],
];
for (const [file, src, scenes, titles] of docs) {
  out = [`<!-- 자동 생성 파일: ${src} 수정 후 \`npm run export-script\` -->`];
  for (const [id, list] of Object.entries(scenes)) {
    out.push(`\n## ${titles[id] || id} \`(${id})\`\n`);
    emit(list);
  }
  fs.writeFileSync(file, out.join('\n') + '\n');
  console.log('wrote', file);
}
