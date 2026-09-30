# B1 — 지하 1층의 아이돌 (Three.js 360° 미연시) · v0.2

프롤로그 + 제1장 「결성」까지 플레이할 수 있는 모바일 웹 게임 프로토타입.

```bash
npm install
npm run dev            # 개발 서버 → 폰에서 같은 와이파이로 http://<PC IP>:5173 접속
npm run build          # dist/ 정적 빌드 (Capacitor 등으로 앱 패키징 가능)
npm run lint           # 스크립트 정적 검사 (없는 씬/캐릭터/표정/배경 참조)
npm run smoke          # 헤드리스 전체 자동 플레이 + 스크린샷(shots/)  ※ playwright 필요
npm run export-script  # 스크립트 → docs/02·03 시나리오 문서 자동 생성
```

## 조작
- **탭**: 대사 넘기기 · **드래그 / 📱자이로**: 360° 둘러보기 (LOOK·GAZE·SEARCH 장면)
- 상단 바: 📱 자이로 · AUTO · SKIP(선택지에서 자동 정지) · LOG · ≡ 메뉴(세이브/로드/프로듀서 수첩/설정/타이틀)
- PC 테스트: Space / Enter로 대사 넘기기

## 구조
```
docs/01_기획서.md           세계관·캐릭터·100일 타임라인·엔딩·이벤트·분량·구현 현황
docs/02·03_시나리오_*.md    (자동 생성) 읽기용 대본
src/engine/                 Panorama(360°) · Runner(스크립트) · UI · Menu · DSL · State(세이브) · Audio(BGM 신스) · placeholders
src/story/prologue.js       프롤로그 스크립트
src/story/chapter1.js       제1장 스크립트 (+ 연습 스케줄 이벤트)
src/story/characters.js     캐릭터 · 프로필 · 의상 · 실제 스탠딩 이미지 경로
src/story/assets.js         실제 360° 파노라마 · BGM 파일 경로
tools/                      lint / smoke / modes-test / export-script
```

## 실제 에셋 넣기
- **파노라마**: 2:1 equirectangular JPG(모바일 권장 4096×2048)를 `public/pano/`에 넣고 `assets.js`에 경로 지정. **이미지 정중앙 = yaw 0**(처음 보는 방향), 좌우 끝 = 뒤(180°). 스크립트의 yaw 값이 이 기준이라, 캐릭터·핫스팟 위치는 배경에 맞춰 조정.
- **스탠딩**: 투명 PNG(2:3 권장)를 `public/chars/`에 넣고 `characters.js`의 `images: { normal: 'chars/seoha_normal.png', smile: ... }` (의상별은 `costumeImages.casual`).
- **BGM**: 루프 mp3/ogg를 `public/bgm/`에 넣고 `assets.js`의 `bgm`에 지정. 비워두면 신스 BGM 사용.

## 스크립트 DSL 요약
| 명령 | 의미 |
|---|---|
| `lock()` / `turn(yaw, pitch, ms)` | 화면 고정 / 강제 회전 |
| `look({ hotspots, require, done })` | 자유 탐색. `hidden:true` = 뒤돌아봐야 보이는 MISS 요소 |
| `gaze({ options:[{ target, dwell, yaw?, pitch? }] })` | 쳐다보는 대상으로 선택 (인물 또는 허공 마커) |
| `search({ target, time, found, miss })` | 제한시간 안에 찾기 |
| `show/move/hide/face` | 캐릭터 배치(yaw/pitch/dist)·표정·의상(`costume`) |
| `choice` · `when` · `love/pro/line/stat` · `flag` · `setvar` · `goto` | 분기·수치·변수 |
| `schedule({ weeks, options, events })` | 프로듀스 연습 계획 미니게임 |
| `day(n, date)` · `bgm(name)` · `fx('stage'\|'sparkle')` · `phone()` · `msg()` | D-day · 음악 · 연출 · 폰 화면 |
| `{name}` `{given}` `{team}` `{given:아}` `{name:은}` | 이름/변수 + 조사 자동 처리 (도현아 / 민수야) |
