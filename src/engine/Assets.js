import * as THREE from 'three';
import { makeBackgroundCanvas, makeCharacterCanvas, makeMarkerCanvas, makeGlowCanvas, BG_TEXT } from './placeholders.js';

let fontsReady = null;
/** make sure the web font (incl. Korean subsets) is loaded before drawing text onto canvases */
function ensureFonts() {
  if (!fontsReady) {
    fontsReady = document.fonts?.load
      ? Promise.race([
        Promise.all(['900', '700'].map((w) => document.fonts.load(`${w} 40px "Pretendard Variable"`, BG_TEXT + 'UNDERPASS'))),
        new Promise((r) => setTimeout(r, 2500)),
      ]).catch(() => {})
      : Promise.resolve();
  }
  return fontsReady;
}

/**
 * Resolves textures: real image from the manifest if provided, else procedural placeholder.
 * Real files go in /public (e.g. public/pano/classroom_day.jpg -> 'pano/classroom_day.jpg').
 */
export class Assets {
  constructor(story) {
    this.story = story;
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.bgCache = new Map();
  }

  /** tiny LRU so mobile memory stays bounded (4K panoramas are ~32MB each) */
  _remember(map, key, tex, max) {
    map.delete(key);
    map.set(key, tex);
    while (map.size > max) {
      const [k, old] = map.entries().next().value;
      map.delete(k);
      if (old !== this._current) old.dispose();
    }
  }

  _load(url) {
    return new Promise((res, rej) => this.loader.load(import.meta.env.BASE_URL + url, res, undefined, rej));
  }

  async background(key) {
    if (this.bgCache.has(key)) { const t = this.bgCache.get(key); this._remember(this.bgCache, key, t, 2); return (this._current = t); }
    let tex = null;
    const url = this.story.assets?.pano?.[key];
    if (url) { try { tex = await this._load(url); } catch { console.warn('pano load failed, using placeholder', url); } }
    if (!tex) {
      await ensureFonts();
      tex = new THREE.CanvasTexture(makeBackgroundCanvas(key));
      tex.anisotropy = 4;
    }
    this._current = tex;
    this._remember(this.bgCache, key, tex, 2);
    return tex;
  }

  async character(id, face = 'normal', costume = '') {
    const k = `${id}:${face}:${costume}`;
    if (this.cache.has(k)) return this.cache.get(k);
    const def = this.story.characters[id];
    const imgs = (costume && def?.costumeImages?.[costume]) || def?.images || {};
    const url = imgs[face] || imgs.normal;
    let tex = null;
    if (url) { try { tex = await this._load(url); } catch { tex = null; } }
    if (!tex) { await ensureFonts(); tex = new THREE.CanvasTexture(makeCharacterCanvas(def, face, costume)); }
    this._remember(this.cache, k, tex, 28);
    return tex;
  }

  marker() { return (this._marker ??= new THREE.CanvasTexture(makeMarkerCanvas())); }
  glow() { return (this._glow ??= new THREE.CanvasTexture(makeGlowCanvas())); }
}
