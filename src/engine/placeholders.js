/**
 * Procedural placeholder art so the game is playable before real assets exist.
 * - Equirectangular 360° backgrounds (projected 3D boxes, so perspective reads correctly)
 * - Anime-style standing sprites with expressions and costumes
 * Replace with real images via src/story/assets.js and characters.js `images`.
 */
const W = 4096, H = 2048;
const R2D = 180 / Math.PI;
const PXR = W / (2 * Math.PI); // pixels per radian
const FONT = '"Pretendard Variable", "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';

const proj = ([x, y, z]) => {
  const yaw = Math.atan2(x, -z) * R2D;
  const pitch = Math.atan2(y, Math.hypot(x, z)) * R2D;
  return [W * (0.5 + yaw / 360), H * (0.5 - pitch / 180)];
};

/** 3D polygon (camera at origin) onto the equirect canvas, seam-safe */
function poly3(ctx, pts, fill, stroke, lw = 4) {
  const dense = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for (let s = 0; s < 24; s++) {
      const t = s / 24;
      dense.push(proj([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
    }
  }
  for (let i = 1; i < dense.length; i++) {
    while (dense[i][0] - dense[i - 1][0] > W / 2) dense[i][0] -= W;
    while (dense[i][0] - dense[i - 1][0] < -W / 2) dense[i][0] += W;
  }
  for (const off of [-W, 0, W]) {
    ctx.beginPath();
    dense.forEach(([x, y], i) => (i ? ctx.lineTo(x + off, y) : ctx.moveTo(x + off, y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
}

/** point on a wall of a square room (half-size a). u = right when facing the wall, v = height relative to eye */
const wallPt = (wall, a, u, v) => ({ front: [u, v, -a], right: [a, v, u], back: [-u, v, a], left: [-a, v, -u] })[wall];
const wallQuad = (ctx, wall, a, u1, u2, v1, v2, fill, stroke) =>
  poly3(ctx, [wallPt(wall, a, u1, v1), wallPt(wall, a, u2, v1), wallPt(wall, a, u2, v2), wallPt(wall, a, u1, v2)], fill, stroke);
const boxTop = (ctx, x1, x2, z1, z2, y, fill, stroke) => poly3(ctx, [[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]], fill, stroke);
/** vertical quad at constant x (side facades) */
const sideQuad = (ctx, x, z1, z2, y1, y2, fill, stroke) => poly3(ctx, [[x, y1, z1], [x, y1, z2], [x, y2, z2], [x, y2, z1]], fill, stroke);

function room(ctx, { a, ceil, floor, cCol, wCol, fCol, trim }) {
  for (let x = 0; x < W; x += 2) {
    const yaw = (x / W - 0.5) * 2 * Math.PI;
    const d = a / Math.max(Math.abs(Math.cos(yaw)), Math.abs(Math.sin(yaw)));
    const yc = H * (0.5 - Math.atan(ceil / d) * R2D / 180);
    const yf = H * (0.5 + Math.atan(floor / d) * R2D / 180);
    ctx.fillStyle = cCol; ctx.fillRect(x, 0, 2, yc);
    ctx.fillStyle = wCol; ctx.fillRect(x, yc, 2, yf - yc);
    ctx.fillStyle = fCol; ctx.fillRect(x, yf, 2, H - yf);
    if (trim) { ctx.fillStyle = trim; ctx.fillRect(x, yf - 10, 2, 10); }
  }
}

function canvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tint(ctx, color, alpha) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function rng(seed) { return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280); }

function dot3(ctx, p, rM, fill, glow) {
  const [x, y] = proj(p), d = Math.hypot(...p), r = Math.max(1.5, (rM / d) * PXR);
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = r * 3; }
  ctx.fillStyle = fill;
  for (const off of [-W, 0, W]) { ctx.beginPath(); ctx.arc(x + off, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0;
}

function text3(ctx, p, text, sizeM, color, { glow, weight = 900 } = {}) {
  const [x, y] = proj(p), d = Math.hypot(...p), px = Math.max(8, (sizeM / d) * PXR);
  ctx.font = `${weight} ${px}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = px * 0.5; }
  ctx.fillStyle = color;
  for (const off of [-W, 0, W]) ctx.fillText(text, x + off, y);
  ctx.shadowBlur = 0;
}

/** crowd silhouette standing at (x, z); eye = camera eye height above floor */
function person3(ctx, x, z, { eye = 1.6, height = 1.65, color = '#0c0b10', pen } = {}) {
  const d = Math.hypot(x, z), nx = x / d, nz = z / d, px = -nz * 0.21, pz = nx * 0.21;
  const top = height - eye, sh = top - 0.32;
  poly3(ctx, [[x - px, -eye, z - pz], [x + px, -eye, z + pz], [x + px, sh, z + pz], [x - px, sh, z - pz]], color);
  poly3(ctx, [[x - px * 1.1, sh - 0.05, z - pz * 1.1], [x + px * 1.1, sh - 0.05, z + pz * 1.1], [x + px * 0.6, sh + 0.08, z + pz * 0.6], [x - px * 0.6, sh + 0.08, z - pz * 0.6]], color);
  dot3(ctx, [x, top - 0.12, z], 0.11, color);
  if (pen) {
    const [x1, y1] = proj([x + px * 0.8, sh + 0.2, z + pz * 0.8]), [x2, y2] = proj([x + px * 1.1, sh + 0.55, z + pz * 1.1]);
    ctx.strokeStyle = pen; ctx.lineWidth = Math.max(2, (0.035 / d) * PXR); ctx.lineCap = 'round';
    ctx.shadowColor = pen; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// ---------------- backgrounds ----------------
function classroom(ctx, sunset) {
  const a = 4, ceil = 1.8, floor = 1.2;
  room(ctx, { a, ceil, floor, cCol: '#e9e6dc', wCol: '#efe6d2', fCol: '#b88a5a', trim: '#7d5a3a' });
  for (let z = -3; z <= 3; z += 2) for (const x of [-1.5, 1.5]) boxTop(ctx, x - 0.12, x + 0.12, z - 0.6, z + 0.6, ceil - 0.01, '#fffef5');
  wallQuad(ctx, 'front', a, -2.6, 2.6, -0.4, 1.2, '#2f4a3a', '#8a6a44');
  wallQuad(ctx, 'front', a, 2.8, 3.6, -1.2, 0.9, '#a57a4f', '#6b4a2a');
  wallQuad(ctx, 'front', a, -0.4, 0.4, 1.35, 1.6, '#ffffff', '#555');
  text3(ctx, [-1.6, 0.9, -a + 0.01], '9월 · 주번: 한서하', 0.16, '#e8f0e8', { weight: 700 });
  boxTop(ctx, -1, 1, -3.4, -2.8, -0.35, '#8a5f3a', '#5b3d22');
  for (let u = -3.2; u < 3; u += 1.6) {
    wallQuad(ctx, 'right', a, u, u + 1.4, -0.4, 1.3, sunset ? '#ffb070' : '#9fd3ff', '#d9d9d9');
    wallQuad(ctx, 'right', a, u, u + 1.4, 0.35, 0.42, '#d9d9d9');
  }
  wallQuad(ctx, 'left', a, -3.6, -2.8, -1.2, 0.9, '#a57a4f', '#6b4a2a');
  for (let u = -2.4; u < 3; u += 1.3) wallQuad(ctx, 'left', a, u, u + 1.1, 0.2, 0.9, '#cfe3e8', '#bbb');
  for (let u = -3.6; u < 3.6; u += 0.6) wallQuad(ctx, 'back', a, u, u + 0.58, -1.2, -0.1, '#9aa6b2', '#6c7680');
  wallQuad(ctx, 'back', a, -2.2, 2.2, 0.1, 1.2, '#b08d5b', '#6b4a2a');
  for (let i = 0; i < 7; i++) wallQuad(ctx, 'back', a, -2 + i * 0.6, -1.6 + i * 0.6, 0.3 + (i % 2) * 0.2, 0.8 + (i % 2) * 0.2, ['#fff', '#ffe08a', '#bde0fe', '#ffc8dd'][i % 4]);
  for (let r = -3; r <= 3; r += 1.4) for (let c = -3; c <= 3; c += 1.5) {
    if (Math.abs(r) < 0.1 && Math.abs(c) < 0.1) continue;
    boxTop(ctx, c - 0.35, c + 0.35, r - 0.25, r + 0.25, -0.45, '#d9a86c', '#8a6238');
  }
  boxTop(ctx, -0.35, 0.35, -0.75, -0.25, -0.45, '#e0b074', '#8a6238');
  if (sunset) tint(ctx, '#ff7a3d', 0.22);
}

function rooftop(ctx, day) {
  const g = ctx.createLinearGradient(0, 0, 0, H / 2);
  if (day) { g.addColorStop(0, '#2f7fe0'); g.addColorStop(0.7, '#8fc8ff'); g.addColorStop(1, '#dff0ff'); }
  else { g.addColorStop(0, '#2b2a5c'); g.addColorStop(0.55, '#e0679b'); g.addColorStop(1, '#ffb36b'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = day ? '#a3a3aa' : '#8c8c94'; ctx.fillRect(0, H / 2, W, H / 2);
  ctx.fillStyle = day ? '#fffbe0' : '#ffe2a0';
  ctx.beginPath(); ctx.arc(W * (0.5 + 35 / 360), day ? H * 0.2 : H * 0.47, day ? 55 : 70, 0, Math.PI * 2); ctx.fill();
  if (day) for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(255,255,255,.85)'; const cx = (i * 530) % W, cy = 260 + (i % 3) * 110; ctx.beginPath(); ctx.ellipse(cx, cy, 180, 38, 0, 0, Math.PI * 2); ctx.ellipse(cx + 90, cy - 25, 110, 40, 0, 0, Math.PI * 2); ctx.fill(); }
  const rnd = rng(7);
  for (let x = 0; x < W; x += 40 + rnd() * 60) {
    const h = 30 + rnd() * 140, w = 40 + rnd() * 90;
    ctx.fillStyle = day ? '#8a93a8' : '#3a2e4d'; ctx.fillRect(x, H / 2 - h, w, h + 2);
    ctx.fillStyle = day ? '#c8d3e6' : '#ffd98a';
    for (let wy = H / 2 - h + 10; wy < H / 2 - 8; wy += 18) for (let wx = x + 6; wx < x + w - 8; wx += 16) if (rnd() > 0.6) ctx.fillRect(wx, wy, 6, 8);
  }
  for (let i = -8; i <= 8; i++) {
    poly3(ctx, [[i, -1.5, -8], [i + 0.02, -1.5, -8], [i + 0.02, -1.5, 8], [i, -1.5, 8]], '#7b7b83');
    poly3(ctx, [[-8, -1.5, i], [8, -1.5, i], [8, -1.5, i + 0.02], [-8, -1.5, i + 0.02]], '#7b7b83');
  }
  const a = 6;
  for (const wall of ['front', 'right', 'left']) {
    wallQuad(ctx, wall, a, -a, a, -0.3, -0.25, '#3d4a5a');
    for (let u = -a; u <= a; u += 0.25) wallQuad(ctx, wall, a, u, u + 0.03, -1.5, -0.25, '#4d5a6a');
  }
  poly3(ctx, [[-2.5, -1.5, 3], [2.5, -1.5, 3], [2.5, 1.4, 3], [-2.5, 1.4, 3]], '#c9c3b8', '#8b857a');
  poly3(ctx, [[-0.6, -1.5, 2.99], [0.6, -1.5, 2.99], [0.6, 0.7, 2.99], [-0.6, 0.7, 2.99]], '#5d6b78', '#333');
  poly3(ctx, [[-0.6, -1.5, 2.98], [-0.15, -1.5, 2.98], [-0.15, 0.7, 2.98], [-0.6, 0.7, 2.98]], '#1b1e24');
  poly3(ctx, [[-0.9, 1.0, 2.98], [0.9, 1.0, 2.98], [0.9, 1.2, 2.98], [-0.9, 1.2, 2.98]], '#3fbf6f');
  if (!day) tint(ctx, '#ff6a8a', 0.08);
}

function bedroom(ctx) {
  const a = 2, ceil = 1.2, floor = 1.3;
  room(ctx, { a, ceil, floor, cCol: '#1c1f35', wCol: '#262b4a', fCol: '#3a2f2a', trim: '#1a1512' });
  poly3(ctx, [[-1.2, -0.45, -1.99], [1.2, -0.45, -1.99], [1.2, -0.45, -1.3], [-1.2, -0.45, -1.3]], '#4a3a30');
  wallQuad(ctx, 'front', a, -0.8, 0.8, -0.3, 0.6, '#6fd6ff', '#111');
  wallQuad(ctx, 'front', a, -0.7, -0.1, -0.2, 0.5, '#ff8ac4');
  wallQuad(ctx, 'front', a, 0.0, 0.7, -0.2, 0.5, '#ffe38a');
  ['#ff9ec7', '#ffd166', '#9be7ff', '#c3a6ff'].forEach((c, i) => wallQuad(ctx, 'right', a, -1.6 + i * 0.85, -0.9 + i * 0.85, 0.2, 1.05, c, '#fff'));
  poly3(ctx, [[0.6, -0.85, -1.2], [1.99, -0.85, -1.2], [1.99, -0.85, 1.9], [0.6, -0.85, 1.9]], '#5b6fb5', '#2b3560');
  wallQuad(ctx, 'left', a, -0.9, 0.9, -0.2, 0.9, '#0b1030', '#888');
  for (let i = 0; i < 40; i++) {
    const u = -0.85 + ((i * 37) % 100) / 100 * 1.7, v = -0.15 + ((i * 53) % 100) / 100 * 0.5;
    wallQuad(ctx, 'left', a, u, u + 0.04, v, v + 0.05, '#ffd98a');
  }
  wallQuad(ctx, 'back', a, -0.5, 0.4, -1.3, 0.8, '#6b5040', '#2a1e16');
  for (let i = 0; i < 6; i++) wallQuad(ctx, 'back', a, 0.8 + i * 0.18, 0.93 + i * 0.18, 0.1, 0.35, ['#ff9ec7', '#9be7ff', '#ffd166'][i % 3]);
  const g = ctx.createRadialGradient(W / 2, H * 0.5, 50, W / 2, H * 0.5, 900);
  g.addColorStop(0, 'rgba(120,200,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function karaoke(ctx) {
  const a = 1.8, ceil = 1.1, floor = 0.85;
  room(ctx, { a, ceil, floor, cCol: '#120a22', wCol: '#1f1336', fCol: '#2a1d3a' });
  for (const wall of ['front', 'right', 'back', 'left']) {
    wallQuad(ctx, wall, a, -a, a, ceil - 0.1, ceil - 0.06, '#ff4fd8');
    wallQuad(ctx, wall, a, -a, a, -0.12, -0.09, '#35e0ff');
  }
  // TV + lyrics
  wallQuad(ctx, 'front', a, -0.95, 0.95, -0.12, 0.85, '#1b3cff', '#000');
  wallQuad(ctx, 'front', a, -0.9, 0.9, -0.07, 0.8, '#3a63ff');
  text3(ctx, [0, 0.62, -a + 0.01], '♪ 두근두근 첫사랑 시그널', 0.1, '#ffffff');
  text3(ctx, [0, 0.38, -a + 0.01], '눈이 마주친 그 순간부터', 0.085, '#9ff6ff', { weight: 700 });
  text3(ctx, [0, 0.2, -a + 0.01], '내 심장은 너의 것', 0.085, '#ffffff', { weight: 700 });
  text3(ctx, [0.62, 0.02, -a + 0.01], '92점', 0.08, '#ffe14d');
  for (const s of [-1, 1]) {
    wallQuad(ctx, 'front', a, s > 0 ? 1.1 : -1.5, s > 0 ? 1.5 : -1.1, -0.6, 0.55, '#0c0c0c', '#333');
    dot3(ctx, [s * 1.3, 0.25, -a + 0.02], 0.12, '#262626');
    dot3(ctx, [s * 1.3, -0.25, -a + 0.02], 0.15, '#262626');
  }
  // U-shaped sofa
  const seat = -floor + 0.42, back = -floor + 0.95;
  boxTop(ctx, -a, -1.2, -1.3, a, seat, '#8a1f3d', '#4a0f20');
  wallQuad(ctx, 'left', a, -a, 1.3, seat, back, '#6e1830');
  boxTop(ctx, -a, a, 1.2, a, seat, '#8a1f3d', '#4a0f20');
  wallQuad(ctx, 'back', a, -a, a, seat, back, '#6e1830');
  boxTop(ctx, 1.2, a, -1.3, a, seat, '#8a1f3d', '#4a0f20');
  wallQuad(ctx, 'right', a, -1.3, a, seat, back, '#6e1830');
  // table with mics & tambourine
  boxTop(ctx, -0.7, 0.7, -0.9, 0.35, -floor + 0.45, '#2d2d36', '#111');
  dot3(ctx, [-0.25, -floor + 0.47, -0.4], 0.05, '#cfcfd8');
  dot3(ctx, [0.05, -floor + 0.47, -0.3], 0.05, '#cfcfd8');
  dot3(ctx, [0.35, -floor + 0.47, -0.5], 0.1, '#ffd21f');
  dot3(ctx, [0.35, -floor + 0.47, -0.5], 0.06, '#2d2d36');
  // door with window (left wall, near front)
  wallQuad(ctx, 'left', a, 1.35, 1.78, -floor, 0.75, '#3a2a4a', '#140c20');
  wallQuad(ctx, 'left', a, 1.45, 1.68, 0.2, 0.55, '#7fa7c9');
  text3(ctx, [-a + 0.01, 0.9, -1.55], '7', 0.12, '#ff9be9', { glow: '#ff4fd8' });
  // mirror-ball spots
  const rnd = rng(3), cols = ['#ff7ad9', '#6ff2ff', '#fff07a', '#b28bff'];
  for (let i = 0; i < 160; i++) {
    const yaw = rnd() * Math.PI * 2, y = -0.2 + rnd() * 1.25, r = 1.75;
    dot3(ctx, [Math.sin(yaw) * r, y, -Math.cos(yaw) * r], 0.015, cols[i % 4], cols[i % 4]);
  }
}

function hongdae(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H / 2);
  g.addColorStop(0, '#05071a'); g.addColorStop(0.75, '#1d1640'); g.addColorStop(1, '#4a2458');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = '#1c1b22'; ctx.fillRect(0, H / 2, W, H / 2);
  const eye = 1.6, X = 4.5, rnd = rng(11);
  const signs = ['코인노래방', '타코야키', 'PC방', '라이브클럽', '포토부스', '카페', '굿즈샵', 'HOF', '편의점', '떡볶이', 'LIVE', '인생네컷'];
  const neon = ['#ff4fa3', '#39e6ff', '#ffe14d', '#a86bff', '#4dff9b', '#ff8a3d'];
  // far ends of the street
  for (const z of [-90, 90]) poly3(ctx, [[-X, -eye, z], [X, -eye, z], [X, 5, z], [-X, 5, z]], '#2b1d3a');
  // crosswalk & road lines
  for (let z = -60; z < 60; z += 3) { poly3(ctx, [[-0.08, -eye, z], [0.08, -eye, z], [0.08, -eye, z + 1.4], [-0.08, -eye, z + 1.4]], '#6d6a58'); }
  for (const x of [-2.6, 2.6]) poly3(ctx, [[x, -eye, -90], [x + 0.06, -eye, -90], [x + 0.06, -eye, 90], [x, -eye, 90]], '#4a4952');
  // facades
  for (const side of [-1, 1]) {
    for (let z = -90; z < 90; z += 5) {
      const x = side * X, near = Math.abs(z + 2.5) < 30;
      sideQuad(ctx, x, z, z + 5, -eye, 14, ['#241f33', '#2c2638', '#1f2230', '#30243a'][Math.floor(rnd() * 4)]);
      sideQuad(ctx, x, z + 0.3, z + 4.7, -eye + 0.05, 1.3, ['#3a2f22', '#27354a', '#40263a', '#2f3b2f'][Math.floor(rnd() * 4)]);
      sideQuad(ctx, x, z + 0.6, z + 4.4, -eye + 0.4, 1.1, 'rgba(255,220,160,.35)');
      for (let fl = 3; fl < 13; fl += 2.2) if (rnd() > 0.35) sideQuad(ctx, x, z + 1, z + 2.2, fl, fl + 1, rnd() > 0.5 ? '#ffd98a' : '#3a3550');
      if (near) {
        const col = neon[Math.floor(rnd() * neon.length)];
        sideQuad(ctx, x - side * 0.02, z + 0.8, z + 4.2, 1.6, 2.5, '#0d0b14', col);
        text3(ctx, [x - side * 0.05, 2.05, z + 2.5], signs[Math.floor(rnd() * signs.length)], 0.55, col, { glow: col });
      }
    }
  }
  // UNDERPASS B1 entrance (right side, around yaw 66)
  sideQuad(ctx, X - 0.02, -3, -1.2, -eye, 0.5, '#07060a', '#ff4fa3');
  for (let i = 0; i < 6; i++) sideQuad(ctx, X - 0.03, -2.9, -1.3, -eye + 0.1 + i * 0.3, -eye + 0.14 + i * 0.3, '#221a2a');
  dot3(ctx, [X - 0.04, 0.35, -2.1], 0.06, '#ff3355', '#ff3355');
  sideQuad(ctx, X - 0.04, -3.4, -2.6, 0.7, 3.4, '#140a1e', '#a86bff');
  text3(ctx, [X - 0.08, 2.8, -3.0], 'B1', 0.55, '#ff5ca8', { glow: '#ff5ca8' });
  text3(ctx, [X - 0.08, 2.1, -3.0], 'UNDER', 0.2, '#ffffff');
  text3(ctx, [X - 0.08, 1.8, -3.0], 'PASS', 0.2, '#ffffff');
  text3(ctx, [X - 0.08, 1.2, -3.0], '↓', 0.5, '#ff5ca8', { glow: '#ff5ca8' });
  // poster wall (left side, around yaw -114)
  for (let i = 0; i < 26; i++) {
    const z = 0.6 + (i % 9) * 0.3, y = -0.6 + Math.floor(i / 9) * 0.55;
    sideQuad(ctx, -X + 0.03, z, z + 0.26, y, y + 0.42, ['#ffffff', '#ffd1e8', '#1a0f2a', '#bfe6ff', '#fff0a8'][i % 5]);
  }
  sideQuad(ctx, -X + 0.04, 1.5, 2.1, -0.05, 0.8, '#12081e', '#a86bff');
  text3(ctx, [-X + 0.08, 0.5, 1.8], 'NOCTURNE//', 0.12, '#d9b8ff', { glow: '#a86bff' });
  // busking crowd (front-left)
  for (let i = 0; i < 18; i++) person3(ctx, -2.8 + rnd() * 2.6, -13 + rnd() * 2.5, { height: 1.55 + rnd() * 0.25, color: '#0e0d14' });
  person3(ctx, -1.3, -10.2, { height: 1.75, color: '#2a2233' });
  // street lamps
  for (let z = -60; z < 60; z += 12) for (const s of [-1, 1]) {
    sideQuad(ctx, s * 3.2, z, z + 0.08, -eye, 3.2, '#2a2a30');
    dot3(ctx, [s * 3.2, 3.3, z], 0.18, '#fff1c2', '#ffd27a');
  }
}

function livehouse(ctx) {
  const a = 5, ceil = 2.2, floor = 1.6, sy = -floor + 0.8, edge = -2.2;
  room(ctx, { a, ceil, floor, cCol: '#07070b', wCol: '#121018', fCol: '#1b1a20' });
  // truss & ceiling lights
  for (const x of [-3, -1, 1, 3]) poly3(ctx, [[x, ceil - 0.25, -a], [x + 0.06, ceil - 0.25, -a], [x + 0.06, ceil - 0.25, a], [x, ceil - 0.25, a]], '#3b3b44');
  poly3(ctx, [[-a, ceil - 0.3, -2.4], [a, ceil - 0.3, -2.4], [a, ceil - 0.3, -2.3], [-a, ceil - 0.3, -2.3]], '#4b4b55');
  ['#ff3d9a', '#8a5cff', '#3de0ff', '#ffffff', '#8a5cff', '#ff3d9a'].forEach((c, i) => dot3(ctx, [-3.5 + i * 1.4, ceil - 0.38, -2.35], 0.12, c, c));
  // back curtain + LED screen
  wallQuad(ctx, 'front', a, -a, a, sy, ceil, '#0a0a0f');
  for (let u = -a; u < a; u += 0.35) wallQuad(ctx, 'front', a, u, u + 0.12, sy, ceil, '#101018');
  wallQuad(ctx, 'front', a, -2.4, 2.4, 0.1, 1.9, '#240d38', '#6a3a9a');
  text3(ctx, [0, 1.25, -a + 0.01], 'NOCTURNE//', 0.62, '#efdcff', { glow: '#b06cff' });
  text3(ctx, [0, 0.55, -a + 0.01], 'UNDERPASS B1 · 합동공연 「달밤의 집회」', 0.2, '#ffb3e6', { weight: 700 });
  for (const s of [-1, 1]) {
    wallQuad(ctx, 'front', a, s > 0 ? 3.0 : -3.8, s > 0 ? 3.8 : -3.0, sy, 0.9, '#141414', '#2a2a2a');
    dot3(ctx, [s * 3.4, 0.4, -a + 0.02], 0.22, '#222'); dot3(ctx, [s * 3.4, -0.3, -a + 0.02], 0.26, '#222');
  }
  // stage
  poly3(ctx, [[-a, sy, edge], [a, sy, edge], [a, sy, -a], [-a, sy, -a]], '#2a2230');
  poly3(ctx, [[-a, -floor, edge], [a, -floor, edge], [a, sy, edge], [-a, sy, edge]], '#0d0c10');
  for (const x of [-2, 0, 2]) dot3(ctx, [x, sy + 0.02, edge - 0.1], 0.08, '#ff5ca8', '#ff5ca8');
  const haze = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, 700);
  haze.addColorStop(0, 'rgba(176,108,255,.35)'); haze.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = haze; ctx.fillRect(0, 0, W, H);
  // back: bar + merch table
  boxTop(ctx, -4.4, -0.8, 3.8, 4.5, -0.5, '#3a2a20', '#1c140e');
  wallQuad(ctx, 'back', a, 1.2, 4.2, 0.1, 1.0, '#1d1712');
  for (let i = 0; i < 14; i++) dot3(ctx, [1.4 + i * 0.2, 0.35 + (i % 2) * 0.3, a - 0.02], 0.05, ['#7fe0a0', '#ffcf6b', '#c0e8ff'][i % 3]);
  text3(ctx, [-2.6, 1.35, a - 0.01], 'BAR', 0.4, '#ffcf6b', { glow: '#ff9f1a' });
  boxTop(ctx, 0.6, 3.6, 3.9, 4.6, -0.8, '#3a3a44', '#1a1a22');
  wallQuad(ctx, 'back', a, -3.4, -0.8, 0.0, 1.0, '#140c1f', '#a86bff');
  text3(ctx, [2.1, 0.75, a - 0.01], '물판 · 특전회', 0.3, '#ffffff');
  text3(ctx, [2.1, 0.3, a - 0.01], '체키 1장 5,000원', 0.18, '#ffb3e6', { weight: 700 });
  // left: entrance & exit sign
  wallQuad(ctx, 'left', a, -1.2, -0.2, -floor, 0.6, '#1f1c26', '#3a3644');
  wallQuad(ctx, 'left', a, -1.1, -0.3, 0.8, 1.05, '#1f8a4c');
  text3(ctx, [-a + 0.01, 0.93, 0.7], 'EXIT', 0.16, '#d6ffe6');
  // right: flyers
  for (let i = 0; i < 24; i++) wallQuad(ctx, 'right', a, -3 + (i % 8) * 0.55, -2.55 + (i % 8) * 0.55, -0.3 + Math.floor(i / 8) * 0.6, 0.2 + Math.floor(i / 8) * 0.6, ['#fff', '#ffd1e8', '#1a0f2a', '#bfe6ff'][i % 4]);
  // crowd with penlights
  const rnd = rng(21), pens = ['#b06cff', '#b06cff', '#ff3d6e', '#ffffff', '#b06cff', '#3de0ff'];
  for (let z = -2.0; z <= -0.7; z += 0.42) for (let x = -4.4; x <= 4.4; x += 0.55) {
    if (Math.abs(x) < 0.55 && z > -1.0) continue;
    person3(ctx, x + (rnd() - 0.5) * 0.25, z + (rnd() - 0.5) * 0.15, { height: 1.55 + rnd() * 0.25, color: '#0b0a0f', pen: rnd() > 0.35 ? pens[Math.floor(rnd() * pens.length)] : null });
  }
  for (let i = 0; i < 26; i++) {
    const ang = Math.PI * (0.35 + rnd() * 1.3), r = 1.6 + rnd() * 2.6;
    person3(ctx, Math.sin(ang) * r, -Math.cos(ang) * r, { height: 1.55 + rnd() * 0.25, color: '#0d0c12' });
  }
}

function practice(ctx) {
  const a = 3.2, ceil = 1.5, floor = 1.6;
  room(ctx, { a, ceil, floor, cCol: '#dcdce2', wCol: '#ecebe4', fCol: '#b98a5c', trim: '#6b6b70' });
  for (let x = -a; x < a; x += 0.25) poly3(ctx, [[x, -floor, -a], [x + 0.01, -floor, -a], [x + 0.01, -floor, a], [x, -floor, a]], '#a47a50');
  for (const x of [-1.6, 0, 1.6]) boxTop(ctx, x - 0.1, x + 0.1, -2.5, 2.5, ceil - 0.01, '#ffffff');
  // mirror wall
  wallQuad(ctx, 'front', a, -a, a, -floor + 0.12, ceil - 0.1, '#c9d6e3', '#8e9aa6');
  for (let i = 0; i < 5; i++) wallQuad(ctx, 'front', a, -2.6 + i * 1.3, -2.2 + i * 1.3, -floor + 0.2, ceil - 0.2, 'rgba(255,255,255,.22)');
  wallQuad(ctx, 'front', a, -a, a, -0.62, -0.56, '#8a6a44');
  // back: door, speaker, bags
  wallQuad(ctx, 'back', a, -0.4, 0.5, -floor, 0.6, '#6b6f7a', '#3b3f48');
  wallQuad(ctx, 'back', a, 1.4, 2.0, -floor, -0.7, '#1a1a1e', '#333');
  dot3(ctx, [-1.7, -1.15, a - 0.02], 0.12, '#333');
  boxTop(ctx, -2.8, -1.6, 2.6, 3.1, -floor + 0.3, '#ff8ab8');
  boxTop(ctx, -1.4, -0.9, 2.7, 3.1, -floor + 0.25, '#6c8cff');
  // left: posters
  text3(ctx, [-a + 0.01, 0.9, 0], '망원 댄스 스튜디오 B1', 0.22, '#3a3a44', { weight: 800 });
  wallQuad(ctx, 'left', a, -1.2, -0.4, -0.3, 0.6, '#ffd1e8', '#fff');
  wallQuad(ctx, 'left', a, 0.4, 1.2, -0.3, 0.6, '#bfe6ff', '#fff');
  text3(ctx, [-a + 0.01, 0.15, 0.8], '연습 끝나면 음료수병 회수!', 0.1, '#444', { weight: 700 });
  // right: whiteboard
  wallQuad(ctx, 'right', a, -1.2, 1.2, -0.4, 0.8, '#fafafa', '#999');
  text3(ctx, [a - 0.01, 0.55, -0.4], 'D-34', 0.22, '#e0435e');
  text3(ctx, [a - 0.01, 0.2, 0.3], '첫 무대 10/17', 0.12, '#2b2d42', { weight: 700 });
}

const BG = {
  classroom_day: (c) => classroom(c, false),
  classroom_sunset: (c) => classroom(c, true),
  rooftop_sunset: (c) => rooftop(c, false),
  rooftop_day: (c) => rooftop(c, true),
  bedroom_night: bedroom,
  karaoke,
  hongdae_night: hongdae,
  livehouse,
  practice_room: practice,
  black: (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); },
};

/** every glyph drawn on placeholder backgrounds, so the web font can be preloaded */
export const BG_TEXT = '9월주번한서하두근첫사랑시그널눈이마주친그순간부터내심장은너의것점코인노래방타코야키PC카페굿즈샵편의점떡볶이인생네컷포토부스라이브클럽합동공연달밤집회물판특전회체키장원망댄스튜디오연습끝나면음료수병회수무대';

export function makeBackgroundCanvas(key) {
  const c = canvas();
  const ctx = c.getContext('2d');
  (BG[key] || BG.black)(ctx);
  return c;
}

// ---------------- characters ----------------
const CW = 512, CH = 768;

function ell(ctx, x, y, rx, ry, fill, stroke, lw = 4) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function drawEyes(ctx, look, face, eye, skin) {
  const L = 200, R = 312, Y = 352;
  for (const [x, side] of [[L, -1], [R, 1]]) {
    if (face === 'smile' || face === 'laugh') {
      ctx.strokeStyle = '#3a2328'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, Y + 12, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      continue;
    }
    const big = face === 'surprised' ? 1.12 : 1;
    ell(ctx, x, Y, 32 * big, 38 * big, '#fff');
    const ix = x + look * 8;
    ell(ctx, ix, Y + 4, 24, 31, eye);
    ell(ctx, ix, Y + 10, 13, face === 'surprised' ? 10 : 17, '#1b1020');
    ell(ctx, ix - 8, Y - 8, 7, 9, '#fff');
    ell(ctx, ix + 8, Y + 18, 4, 4, 'rgba(255,255,255,.8)');
    ctx.strokeStyle = '#2a1a1e'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(x, Y + 2, 36 * big, 40 * big, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    if (face === 'smug' || face === 'tease') {
      ctx.fillStyle = skin;
      ctx.fillRect(x - 40, Y - 44, 80, 34);
      ctx.beginPath(); ctx.moveTo(x - 38, Y - 10); ctx.lineTo(x + 38, Y - 10 + side * 3); ctx.stroke();
    }
    if (face === 'sad') ell(ctx, x + side * 20, Y + 44, 6, 10, 'rgba(160,210,255,.9)');
  }
}

function drawBrows(ctx, face, hair) {
  ctx.strokeStyle = hair; ctx.lineWidth = 8; ctx.lineCap = 'round';
  const tilt = { angry: 14, sad: -12, surprised: 0, smug: 6, tease: 6 }[face] ?? 2;
  const lift = face === 'surprised' ? -14 : 0;
  ctx.beginPath(); ctx.moveTo(172, 298 + lift - tilt); ctx.lineTo(226, 300 + lift + tilt); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(286, 300 + lift + tilt); ctx.lineTo(340, 298 + lift - tilt - (face === 'smug' ? 10 : 0)); ctx.stroke();
}

function drawMouth(ctx, face, x = 256, y = 432) {
  ctx.strokeStyle = '#8a3a44'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  switch (face) {
    case 'smile': case 'laugh':
      ctx.fillStyle = '#b8434f'; ctx.moveTo(x - 24, y - 4); ctx.quadraticCurveTo(x, y + (face === 'laugh' ? 34 : 26), x + 24, y - 4); ctx.closePath(); ctx.fill(); break;
    case 'surprised': ell(ctx, x, y + 4, 11, 14, '#b8434f'); return;
    case 'smug': case 'tease': ctx.moveTo(x - 20, y + 2); ctx.quadraticCurveTo(x + 4, y + 10, x + 22, y - 8); break;
    case 'angry': case 'sad': ctx.moveTo(x - 16, y + 8); ctx.quadraticCurveTo(x, y - 4, x + 16, y + 8); break;
    case 'shy': ctx.moveTo(x - 16, y); for (let i = 0; i < 4; i++) ctx.lineTo(x - 12 + i * 9, y + (i % 2 ? -4 : 4)); break;
    default: ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x, y + 8, x + 14, y);
  }
  ctx.stroke();
}

function drawStalker(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#15151c'); g.addColorStop(1, '#2a2a35');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(90, CH); ctx.quadraticCurveTo(100, 520, 256, 500); ctx.quadraticCurveTo(412, 520, 422, CH); ctx.fill();
  ell(ctx, 256, 340, 110, 130, '#1b1b22');
  ctx.fillStyle = '#0c0c10'; ctx.fillRect(140, 230, 232, 60); ctx.fillRect(120, 280, 290, 18);
  ctx.fillStyle = '#2d2d36'; ctx.fillRect(170, 370, 172, 80);
  ell(ctx, 215, 330, 10, 6, '#d9d9e6'); ell(ctx, 297, 330, 10, 6, '#d9d9e6');
  ctx.fillStyle = '#4a4a55'; ctx.fillRect(330, 470, 60, 100);
  ell(ctx, 360, 490, 8, 8, '#9ff');
}

/** 곰사장: big bearded man in a beanie */
function drawMan(ctx, p, face) {
  const skin = '#efc6a5';
  ctx.fillStyle = p.outfit;
  ctx.beginPath(); ctx.moveTo(20, CH); ctx.quadraticCurveTo(30, 520, 256, 505); ctx.quadraticCurveTo(482, 520, 492, CH); ctx.fill();
  ctx.fillStyle = skin; ctx.fillRect(196, 430, 120, 100);
  ctx.fillStyle = '#e8e8e8'; ctx.font = `900 34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('UNDERPASS', 256, 660);
  ell(ctx, 256, 325, 142, 152, skin);
  ell(ctx, 116, 345, 16, 28, '#e6b896'); ell(ctx, 396, 345, 16, 28, '#e6b896');
  // beard
  ctx.fillStyle = p.hairDark;
  ctx.beginPath(); ctx.moveTo(118, 350); ctx.quadraticCurveTo(130, 500, 256, 505); ctx.quadraticCurveTo(382, 500, 394, 350);
  ctx.quadraticCurveTo(330, 400, 256, 395); ctx.quadraticCurveTo(182, 400, 118, 350); ctx.fill();
  // eyes & brows
  ctx.strokeStyle = '#2a1a14'; ctx.lineCap = 'round';
  if (face === 'smile' || face === 'laugh') { ctx.lineWidth = 7; for (const x of [205, 307]) { ctx.beginPath(); ctx.arc(x, 345, 16, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); } }
  else { ell(ctx, 205, 340, 12, face === 'surprised' ? 13 : 8, '#2a1a14'); ell(ctx, 307, 340, 12, face === 'surprised' ? 13 : 8, '#2a1a14'); }
  ctx.lineWidth = 13;
  const tilt = face === 'angry' ? 12 : 0;
  ctx.beginPath(); ctx.moveTo(172, 305 - tilt); ctx.lineTo(236, 310 + tilt); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(276, 310 + tilt); ctx.lineTo(340, 305 - tilt); ctx.stroke();
  ell(ctx, 256, 385, 14, 10, '#e0ab8a');
  drawMouth(ctx, face === 'normal' ? 'angry' : face, 256, 432);
  // beanie
  ctx.fillStyle = p.hair;
  ctx.beginPath(); ctx.ellipse(256, 235, 150, 105, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = p.ribbon; ctx.fillRect(104, 222, 304, 52);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 4;
  for (let x = 116; x < 404; x += 18) { ctx.beginPath(); ctx.moveTo(x, 226); ctx.lineTo(x, 270); ctx.stroke(); }
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

/** collar / chest details per costume */
function drawNeckline(ctx, p) {
  const neck = p.neck || (p.uniform ? 'uniform' : 'choker');
  if (neck === 'uniform') {
    ctx.fillStyle = '#fbfbff';
    ctx.beginPath(); ctx.moveTo(196, 538); ctx.lineTo(256, 640); ctx.lineTo(316, 538); ctx.lineTo(286, 532); ctx.lineTo(256, 580); ctx.lineTo(226, 532); ctx.fill();
    ctx.fillStyle = p.ribbon;
    ctx.beginPath(); ctx.moveTo(256, 590); ctx.lineTo(210, 565); ctx.lineTo(214, 615); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(256, 590); ctx.lineTo(302, 565); ctx.lineTo(298, 615); ctx.closePath(); ctx.fill();
    ell(ctx, 256, 590, 12, 12, p.ribbon);
  } else if (neck === 'hoodie') {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(256, 545, 120, 42, 0, 0, Math.PI * 2); ctx.fill();
    ell(ctx, 256, 540, 64, 22, '#ffe3d3');
    ctx.strokeStyle = p.ribbon; ctx.lineWidth = 6;
    for (const x of [232, 280]) { ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x + (x < 256 ? -6 : 6), 650); ctx.stroke(); ell(ctx, x + (x < 256 ? -6 : 6), 655, 6, 8, p.ribbon); }
  } else if (neck === 'tee') {
    ell(ctx, 256, 536, 58, 26, '#ffe3d3');
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(256, 538, 62, 30, 0, 0, Math.PI); ctx.stroke();
    ctx.fillStyle = p.ribbon; star(ctx, 256, 660, 38);
  } else if (neck === 'stage') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(160 + i * 24, 548, 16, 0, Math.PI); ctx.fill(); }
    ctx.fillStyle = p.ribbon;
    ctx.beginPath(); ctx.moveTo(256, 586); ctx.lineTo(196, 556); ctx.lineTo(200, 622); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(256, 586); ctx.lineTo(316, 556); ctx.lineTo(312, 622); ctx.closePath(); ctx.fill();
    ell(ctx, 256, 586, 16, 16, p.ribbon);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(110 + ((i * 97) % 300), 640 + ((i * 53) % 110), 4, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.fillStyle = p.ribbon; ctx.fillRect(222, 486, 68, 14);
    ell(ctx, 256, 506, 9, 9, '#ff2d55');
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(120 + i * 70, CH); ctx.lineTo(180 + i * 38, 560); ctx.stroke(); }
  }
}

function drawBackHair(ctx, p) {
  ctx.fillStyle = p.hairDark;
  if (p.style === 'long' || p.style === 'longBangs') {
    ctx.beginPath(); ctx.moveTo(120, 280); ctx.quadraticCurveTo(80, 560, 110, 690); ctx.lineTo(402, 690); ctx.quadraticCurveTo(432, 560, 392, 280); ctx.fill();
  } else if (p.style === 'twin') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(256 + s * 120, 240);
      ctx.quadraticCurveTo(256 + s * 250, 420, 256 + s * 190, 700);
      ctx.quadraticCurveTo(256 + s * 150, 520, 256 + s * 100, 320); ctx.fill();
    }
  } else if (p.style === 'side') {
    ctx.beginPath(); ctx.moveTo(130, 260); ctx.quadraticCurveTo(110, 420, 140, 520); ctx.lineTo(372, 520); ctx.quadraticCurveTo(402, 420, 382, 260); ctx.fill();
    ctx.beginPath(); ctx.moveTo(360, 230); ctx.quadraticCurveTo(470, 330, 420, 600); ctx.quadraticCurveTo(400, 420, 350, 300); ctx.fill();
  } else if (p.style === 'bob') {
    ctx.beginPath(); ctx.moveTo(118, 270); ctx.quadraticCurveTo(100, 420, 150, 470); ctx.lineTo(362, 470); ctx.quadraticCurveTo(412, 420, 394, 270); ctx.fill();
  }
}

/** def: character definition from story/characters.js; costume: key of def.costumes */
export function makeCharacterCanvas(def, face = 'normal', costume) {
  const c = canvas(CW, CH);
  const ctx = c.getContext('2d');
  const p = { ...def.art, ...((costume && def.costumes?.[costume]) || {}) };
  if (p.style === 'stalker') { drawStalker(ctx); return c; }
  if (p.style === 'man') { drawMan(ctx, p, face); return c; }
  const skin = '#ffe3d3', hair = p.hair, dark = p.hairDark;

  drawBackHair(ctx, p);
  ctx.fillStyle = p.outfit;
  ctx.beginPath(); ctx.moveTo(70, CH); ctx.quadraticCurveTo(80, 560, 256, 530); ctx.quadraticCurveTo(432, 560, 442, CH); ctx.fill();
  ctx.fillStyle = skin; ctx.fillRect(226, 440, 60, 100);
  drawNeckline(ctx, p);
  if (p.headphones) {
    ctx.strokeStyle = '#6b6f86'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(256, 520, 70, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ell(ctx, 186, 540, 22, 26, '#a3a8c4'); ell(ctx, 326, 540, 22, 26, '#a3a8c4');
  }

  ell(ctx, 256, 330, 128, 148, skin);
  ell(ctx, 132, 350, 14, 26, '#ffd6c4'); ell(ctx, 380, 350, 14, 26, '#ffd6c4');
  drawEyes(ctx, face === 'shy' ? -1 : 0, face, p.eye, skin);
  drawBrows(ctx, face, dark);
  drawMouth(ctx, face);
  ell(ctx, 256, 398, 4, 3, '#e8b4a4');
  const blush = { shy: 0.6, smile: 0.3, laugh: 0.35, tease: 0.35 }[face] ?? 0.15;
  ctx.globalAlpha = blush; ell(ctx, 180, 402, 30, 14, '#ff7a9a'); ell(ctx, 332, 402, 30, 14, '#ff7a9a'); ctx.globalAlpha = 1;
  if (face === 'shy') { ctx.strokeStyle = '#ff5c80'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(160 + i * 14, 390); ctx.lineTo(170 + i * 14, 412); ctx.stroke(); } }

  // front hair / bangs
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.ellipse(256, 262, 140, 110, 0, Math.PI, 0); ctx.fill();
  const long = p.style === 'longBangs', bangLen = long ? 350 : 300;
  ctx.beginPath(); ctx.moveTo(118, 270);
  for (let i = 0; i <= 7; i++) {
    const x = 118 + (276 / 7) * i;
    const y = i % 2 ? bangLen - (long ? 10 : 30) : bangLen - (i === 0 || i === 7 ? 20 : 0) - 40;
    ctx.lineTo(x, i % 2 ? y : y + 30);
  }
  ctx.lineTo(394, 270); ctx.lineTo(394, 230); ctx.lineTo(118, 230); ctx.fill();
  ctx.fillRect(114, 240, 26, 200); ctx.fillRect(372, 240, 26, 200);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(256, 280, 110, Math.PI * 1.2, Math.PI * 1.45); ctx.stroke();

  if (p.accessory === 'star') { ctx.fillStyle = '#ffd24d'; star(ctx, 150, 250, 26); }
  if (p.accessory === 'ribbons') for (const s of [-1, 1]) { ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.moveTo(256 + s * 120, 230); ctx.lineTo(256 + s * 170, 200); ctx.lineTo(256 + s * 160, 260); ctx.fill(); }
  if (p.accessory === 'horns') { ctx.fillStyle = '#2a1030'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(256 + s * 70, 180); ctx.quadraticCurveTo(256 + s * 120, 110, 256 + s * 150, 120); ctx.quadraticCurveTo(256 + s * 110, 150, 256 + s * 100, 190); ctx.fill(); } }
  if (p.accessory === 'moon') { ctx.fillStyle = '#e8d4ff'; ctx.beginPath(); ctx.arc(360, 240, 22, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(370, 232, 18, 0, Math.PI * 2); ctx.fill(); }
  return c;
}

export function makeMarkerCanvas() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(64, 64, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,180,.9)'; ctx.beginPath(); ctx.arc(64, 64, 20, 0, Math.PI * 2); ctx.fill();
  return c;
}

export function makeGlowCanvas() {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,220,240,.8)'); g.addColorStop(1, 'rgba(255,200,230,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return c;
}
