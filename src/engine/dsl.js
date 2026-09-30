/**
 * Script DSL — writers compose scenes as arrays of these commands.
 * Pure data (no Three.js), so tools/export-script.mjs can turn it into a readable scenario doc.
 *
 * Panorama direction grammar (see docs/01_기획서.md §8):
 *   LOCK   -> lock()                 camera fixed
 *   TURN   -> turn(yaw, pitch, ms)   scripted camera turn
 *   LOOK   -> look({...})            free exploration with hotspots
 *   GAZE   -> gaze({...})            choose by looking at someone
 *   SEARCH -> search({...})          timed "find it" look
 *   MISS   -> hotspot with hidden:true (only found by turning around)
 */

// ---- text ----
// Placeholders: {name} {given} {team} ... and Korean particles {given:아} -> 도현아 / 민수야,
// {name:은} {name:이} {name:을} {team:과} {team:으로} pick the right form automatically.
export const say = (who, text, o = {}) => ({ t: 'say', who, text, ...o });
export const nar = (text, o = {}) => ({ t: 'say', who: null, text, ...o });
export const think = (text, o = {}) => ({ t: 'say', who: '@me', text, think: true, ...o });
export const me = (text, o = {}) => ({ t: 'say', who: '@me', text, ...o });

// ---- camera ----
export const lock = () => ({ t: 'lock' });
export const unlock = () => ({ t: 'unlock' });
export const turn = (yaw, pitch = 0, ms = 1200) => ({ t: 'turn', yaw, pitch, ms });
export const zoom = (mul = 1, ms = 600) => ({ t: 'zoom', mul, ms });
export const shake = (power = 1, ms = 400) => ({ t: 'shake', power, ms });

// ---- stage ----
export const bg = (key) => ({ t: 'bg', key });
export const show = (id, o = {}) => ({ t: 'show', id, ...o }); // yaw, pitch, dist, height, face, fade
export const move = (id, o = {}) => ({ t: 'move', id, ...o }); // yaw, pitch, dist, ms
export const hide = (id, o = {}) => ({ t: 'hide', id, ...o });
export const face = (id, f) => ({ t: 'face', id, face: f });
export const fade = (dir, ms = 600) => ({ t: 'fade', dir, ms });
export const flash = (color = '#fff', ms = 300) => ({ t: 'flash', color, ms });
export const wait = (ms) => ({ t: 'wait', ms });
export const sfx = (name) => ({ t: 'sfx', name });
export const chapter = (title, sub = '') => ({ t: 'chapter', title, sub });
export const bgm = (name) => ({ t: 'bgm', name }); // track id or null
export const fx = (name, o = {}) => ({ t: 'fx', name, ...o }); // 'sparkle' | 'stage' | null
/** D-day counter shown in the HUD: day(99, '9월 2일 (수)') */
export const day = (n, date = '') => ({ t: 'day', n, date });
export const profile = (id) => ({ t: 'profile', id }); // unlock a member page in the notebook
export const caption = (text) => ({ t: 'caption', text }); // place/time card

// ---- phone overlay ----
export const phone = (o) => ({ t: 'phone', ...o }); // {on, mode:'fancam'|'chat'|'sns', title}
export const msg = (from, text) => ({ t: 'msg', from, text }); // chat bubble: 'them' | 'me' | 'sys'

// ---- interaction ----
export const choice = (options, o = {}) => ({ t: 'choice', options, ...o });
export const look = (o) => ({ t: 'look', ...o });
export const gaze = (o) => ({ t: 'gaze', ...o });
export const search = (o) => ({ t: 'search', ...o });
export const askName = () => ({ t: 'askName' });
export const askText = (key, prompt, def = '') => ({ t: 'askText', key, prompt, def });
/** produce mini-game: weekly training plan. See chapter1.js for the option format */
export const schedule = (o) => ({ t: 'schedule', ...o });

// ---- flow & state ----
export const goto = (scene) => ({ t: 'goto', scene });
export const stat = (key, n) => ({ t: 'stat', key, n });
export const love = (id, n) => stat(`love.${id}`, n);
export const pro = (n) => stat('pro', n);
export const line = (n) => stat('line', n);
export const flag = (k, v = true) => ({ t: 'flag', k, v });
/** text variable usable in lines as {key}, e.g. setvar('team', '오늘밤은 소다맛') */
export const setvar = (key, value) => ({ t: 'setvar', key, value });
/** cond: 'flagName' | '!flagName' | 'love.seoha >= 3' */
export const when = (cond, then, otherwise = []) => ({ t: 'if', cond, then, else: otherwise });
export const end = (text) => ({ t: 'end', text });
