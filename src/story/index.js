import { characters } from './characters.js';
import { assets } from './assets.js';
import { prologue, titles0 } from './prologue.js';
import { chapter1, titles1 } from './chapter1.js';

// Add future chapters here: import { chapter2, titles2 } from './chapter2.js'; then add to scenes/titles/chapters.
export const story = {
  title: 'B1 — 지하 1층의 아이돌',
  start: 'prologue_0',
  characters,
  assets,
  scenes: { ...prologue, ...chapter1 },
  titles: { ...titles0, ...titles1 },
  chapters: [
    { id: 'prologue', title: '프롤로그', sub: '지하 1층으로 가는 계단', start: 'prologue_0' },
    { id: 'ch1', title: '제1장', sub: '결성 — 셋이면, 그룹이다', start: 'c1_0' },
    { id: 'ch2', title: '제2장', sub: '첫 무대 (준비 중)', start: null },
  ].filter((c) => c.start),
  // 프로듀서 수첩 > 계약 탭의 목표 리스트
  goals: [
    { text: '프로듀서 계약 (100일 · 연애 금지)', flag: 'contract' },
    { text: '멤버 세 명 모으기', flag: 'joined_eunsol' },
    { text: '팀 이름 정하기', flag: 'team_named' },
    { text: '첫 무대 확보 (10/17 UNDERPASS B1)', flag: 'booked_first_stage' },
    { text: '첫 무대 티켓 쿼터 10장 판매', flag: 'sold_quota' },
    { text: '「언더그라운드 서밋」 오디션', flag: 'summit_audition' },
    { text: '단독 공연 매진', flag: 'oneman_soldout' },
  ],
};
