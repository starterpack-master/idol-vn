const PREFIX = 'b1-idol-';
export const SLOT_COUNT = 6;

export function newState() {
  return {
    name: '강도현',
    scene: null,
    day: 100,
    date: '',
    stats: {
      pro: 0, line: 0,
      love: { seoha: 0, chaei: 0, eunsol: 0, lilith: 0 },
      team: { vocal: 10, dance: 10, charm: 10, fans: 0, mood: 60 },
    },
    vars: { team: '' },
    flags: {},
    visited: {},
    profiles: { seoha: true },
    counts: {}, // how many times each schedule option was chosen
  };
}

export const clone = (o) => JSON.parse(JSON.stringify(o));

function deepMerge(base, over) {
  for (const k in over) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') deepMerge(base[k], v);
    else base[k] = v;
  }
  return base;
}
/** fills in fields missing from older saves */
export const normalize = (s) => deepMerge(newState(), s || {});

export function getStat(state, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.stats) ?? 0;
}

export function addStat(state, key, n) {
  const parts = key.split('.');
  let o = state.stats;
  while (parts.length > 1) { const k = parts.shift(); o = o[k] ??= {}; }
  const k = parts[0];
  const max = key.endsWith('fans') ? 99999 : 100;
  o[k] = Math.max(0, Math.min(max, (o[k] ?? 0) + n));
}

export function evalCond(state, cond) {
  if (typeof cond === 'function') return !!cond(state);
  const m = cond.match(/^\s*([\w.]+)\s*(>=|<=|==|>|<)\s*(-?\d+)\s*$/);
  if (m) {
    const v = getStat(state, m[1]), n = +m[3];
    return { '>=': v >= n, '<=': v <= n, '==': v === n, '>': v > n, '<': v < n }[m[2]];
  }
  if (cond.startsWith('!')) return !state.flags[cond.slice(1)];
  return !!state.flags[cond];
}

// ---------------- storage ----------------
const get = (k) => { try { return JSON.parse(localStorage.getItem(PREFIX + k)); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch { return false; } };

/** slot: 'auto' | 1..SLOT_COUNT. data: { state, meta: { label, day, date, savedAt, thumb } } */
export const saves = {
  read: (slot) => get(`save-${slot}`),
  write: (slot, data) => set(`save-${slot}`, data),
  remove: (slot) => localStorage.removeItem(`${PREFIX}save-${slot}`),
  hasAny: () => ['auto', ...Array.from({ length: SLOT_COUNT }, (_, i) => i + 1)].some((s) => !!get(`save-${s}`)),
};

/** state snapshot captured when a chapter's first scene is reached (for chapter select) */
export const chapterSnaps = {
  all: () => get('chapters') || {},
  write: (id, state) => { const all = get('chapters') || {}; all[id] = state; set('chapters', all); },
};

export const DEFAULT_SETTINGS = { textSpeed: 28, autoWait: 1, bgm: 0.5, sfx: 0.7, toasts: true, showNumbers: false };
export const settingsStore = {
  load: () => ({ ...DEFAULT_SETTINGS, ...(get('settings') || {}) }),
  save: (s) => set('settings', s),
};
