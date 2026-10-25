// 저장소: 설정/노트는 localStorage, 글꼴 파일(용량 큼)은 IndexedDB.
// 예전 이름(LaTeX 수식 노트북)으로 저장된 데이터도 읽어서 CoPyTex 형식으로 이어받아요.
export const SETTINGS_KEY = 'copytex:settings';
export const NOTEBOOK_KEY = 'copytex:notebook';
const LEGACY_SETTINGS_KEY = 'ltxpng:settings';
const LEGACY_NOTEBOOK_KEY = 'ltxpng:notebook';

export const SYN_KEYS = ['cmd', 'greek', 'struct', 'macro', 'env', 'bracket', 'number', 'operator', 'text', 'comment'];

export const DEFAULT_SYN = {
  light: { cmd: '#1f4fd8', greek: '#8b3fc4', struct: '#b4540a', macro: '#0f766e', env: '#4a6d8c', bracket: '#5b6475', number: '#1a7f37', operator: '#c2185b', text: '#2e7d32', comment: '#8a93a6' },
  dark:  { cmd: '#7aa2ff', greek: '#c29bff', struct: '#ffb169', macro: '#2dd4bf', env: '#8fb4d9', bracket: '#9aa4b8', number: '#7ee08f', operator: '#ff8fb4', text: '#8fd694', comment: '#6b7690' },
};

// 셀 옵션 기본값 (수식 / 텍스트) 과 묶음 옵션 기본값
export const DEFAULT_OPTS = { color: '#000000', bg: '#ffffff', transparent: true, pad: 12, fs: 28 };
export const DEFAULT_TEXT_OPTS = { color: '#000000', bg: '#ffffff', transparent: true, pad: 12, fs: 24, width: 0 };
export const DEFAULT_GROUP = { dpr: 2, gap: 0, pad: 0, bg: '#ffffff', transparent: true };

export const DEFAULT_SETTINGS = {
  lang: 'ko',
  themeMode: 'system', // 'system' | 'light' | 'dark'
  accent: null, // null 이면 style.css 의 기본 강조색을 써요
  syn: JSON.parse(JSON.stringify(DEFAULT_SYN)),
  editorFs: 15,
  macroList: [], // [{ name, args, body }]  설정 > 내 명령어
  macroRaw: '',  // 표로 못 나타내는 정의(고급)
  packages: ['mhchem', 'physics', 'mathtools', 'cancel', 'boldsymbol', 'braket'],
  fontId: null,
  defaultOpts: { ...DEFAULT_OPTS },
  defaultTextOpts: { ...DEFAULT_TEXT_OPTS },
  defaultGroup: { ...DEFAULT_GROUP },
};

// 백업 가져오기/전체 초기화 직후 새로고침할 때, 종료 시 자동 저장이 복원한 내용을 덮어쓰지 않게 막아요.
let savingDisabled = false;
export function disableSaving() { savingDisabled = true; }

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}
function writeJSON(key, val) {
  if (savingDisabled) return false;
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
}

/* ---------- 예전 형식의 매크로 문자열 → 표 ---------- */
export function parseLegacyMacros(text) {
  const list = []; const rest = [];
  for (const line of String(text || '').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    let m = /^\\(?:re)?newcommand\s*\{\\([a-zA-Z]+)\}\s*(?:\[(\d)\])?\s*\{(.*)\}$/.exec(s);
    if (m) { list.push({ name: m[1], args: m[2] ? +m[2] : 0, body: m[3] }); continue; }
    m = /^\\def\s*\\([a-zA-Z]+)\s*\{(.*)\}$/.exec(s);
    if (m) { list.push({ name: m[1], args: 0, body: m[2] }); continue; }
    rest.push(s);
  }
  return { list, raw: rest.join('\n') };
}

export function loadSettings() {
  const s = readJSON(SETTINGS_KEY) || readJSON(LEGACY_SETTINGS_KEY) || {};
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const k of Object.keys(out)) {
    if (s[k] === undefined) continue;
    if (k === 'syn') {
      for (const m of ['light', 'dark']) out.syn[m] = { ...out.syn[m], ...(s.syn && s.syn[m]) };
    } else if (k === 'defaultOpts' || k === 'defaultTextOpts' || k === 'defaultGroup') {
      out[k] = { ...out[k], ...s[k] };
    } else out[k] = s[k];
  }
  delete out.defaultOpts.dpr; // 해상도는 이제 묶음 옵션이에요
  if (typeof s.macros === 'string' && s.macroList === undefined) {
    const p = parseLegacyMacros(s.macros);
    out.macroList = p.list; out.macroRaw = p.raw;
  }
  if (!Array.isArray(out.macroList)) out.macroList = [];
  return out;
}
export function saveSettings(s) { return writeJSON(SETTINGS_KEY, s); }

export function uid() { return 'c' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

/* ---------- 셀 / 묶음 ---------- */
export function makeCell(type, baseOpts, groupId, extra) {
  const defaults = type === 'math' ? DEFAULT_OPTS : DEFAULT_TEXT_OPTS;
  return {
    id: uid(), type, code: '', name: '', collapsed: false, include: true,
    wrap: 'aligned', group: groupId || uid(),
    opts: { ...defaults, ...(baseOpts || {}) },
    ...(extra || {}),
  };
}

function normalizeCell(c) {
  const type = c.type === 'text' ? 'text' : 'math';
  const defaults = type === 'math' ? DEFAULT_OPTS : DEFAULT_TEXT_OPTS;
  const opts = { ...defaults, ...(c.opts || {}) };
  delete opts.dpr;
  if (type === 'text' && c.opts && c.opts.size && !c.opts.fs) opts.fs = { sm: 20, md: 24, lg: 30 }[c.opts.size] || 24;
  delete opts.size;
  if (type === 'math') delete opts.width;
  return {
    id: c.id || uid(), type, code: typeof c.code === 'string' ? c.code : '',
    name: typeof c.name === 'string' ? c.name : '', collapsed: !!c.collapsed,
    include: c.include !== false, wrap: c.wrap === 'gathered' ? 'gathered' : 'aligned',
    group: c.group || uid(), opts,
  };
}

export function loadNotebook(settings) {
  const nb = readJSON(NOTEBOOK_KEY) || readJSON(LEGACY_NOTEBOOK_KEY);
  if (nb && Array.isArray(nb.cells) && nb.cells.length) {
    const cells = nb.cells.map(normalizeCell);
    const groups = {};
    cells.forEach((c) => { groups[c.group] = { ...settings.defaultGroup, ...((nb.groups && nb.groups[c.group]) || {}) }; });
    return { cells, groups };
  }
  const first = makeCell('math', settings.defaultOpts);
  first.code = '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}';
  return { cells: [first], groups: { [first.group]: { ...settings.defaultGroup } } };
}
export function saveNotebook(cells, groups) { return writeJSON(NOTEBOOK_KEY, { version: 2, cells, groups }); }

/* ---------- IndexedDB: fonts ---------- */
const DB_NAME = 'copytex';
function openDB(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name || DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('fonts', { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function withStore(mode, fn, dbName) {
  const db = await openDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fonts', mode);
    const store = tx.objectStore('fonts');
    const req = fn(store);
    tx.oncomplete = () => { db.close(); resolve(req && req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// 예전 이름의 글꼴 저장소가 있으면 한 번만 옮겨 와요.
export async function migrateLegacyFonts() {
  try {
    if (!indexedDB.databases) return;
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === 'ltxpng')) return;
    const old = await withStore('readonly', (s) => s.getAll(), 'ltxpng');
    const cur = await withStore('readonly', (s) => s.getAll());
    if (!cur.length) for (const f of old || []) await withStore('readwrite', (s) => s.put(f));
  } catch (e) { /* 옮기지 못해도 괜찮아요 */ }
}

const FONT_MIME = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
export function fontMimeFor(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return FONT_MIME[ext] || null;
}

export async function listFonts() {
  try {
    const all = await withStore('readonly', (s) => s.getAll());
    return (all || []).map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.data.byteLength }));
  } catch (e) { return []; }
}
export async function putFont(rec) { return withStore('readwrite', (s) => s.put(rec)); }
export async function getFont(id) { return withStore('readonly', (s) => s.get(id)); }
export async function deleteFont(id) { fontCache.delete(id); return withStore('readwrite', (s) => s.delete(id)); }
export async function clearFonts() { fontCache.clear(); return withStore('readwrite', (s) => s.clear()); }

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

const fontCache = new Map();
// 수식 SVG 안에 넣을 때 쓰는 data URI
export async function getFontDataUri(id) {
  if (!id) return null;
  if (fontCache.has(id)) return fontCache.get(id);
  const rec = await getFont(id);
  if (!rec) return null;
  const uri = { mime: rec.mime, b64: toBase64(rec.data), data: rec.data };
  fontCache.set(id, uri);
  return uri;
}

/* ---------- backup ---------- */
export async function buildBackup(settings, cells, groups) {
  const fonts = [];
  try {
    const all = await withStore('readonly', (s) => s.getAll());
    for (const f of all || []) fonts.push({ id: f.id, name: f.name, mime: f.mime, b64: toBase64(f.data) });
  } catch (e) { /* ignore */ }
  return { app: 'copytex', version: 2, settings, cells, groups, fonts };
}

export async function restoreBackup(obj) {
  if (!obj || (obj.app !== 'copytex' && obj.app !== 'latex-png-notebook')) throw new Error('not a CoPyTex backup file');
  savingDisabled = false; // 아래에서 직접 저장한 뒤 다시 막아요
  if (obj.settings) saveSettings(obj.settings);
  if (Array.isArray(obj.cells)) saveNotebook(obj.cells, obj.groups || {});
  if (Array.isArray(obj.fonts)) {
    await clearFonts();
    for (const f of obj.fonts) await putFont({ id: f.id, name: f.name, mime: f.mime, data: fromBase64(f.b64) });
  }
  savingDisabled = true;
}

export async function eraseAll() {
  savingDisabled = true;
  try {
    [SETTINGS_KEY, NOTEBOOK_KEY, LEGACY_SETTINGS_KEY, LEGACY_NOTEBOOK_KEY].forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  try { await clearFonts(); } catch (e) { /* ignore */ }
}
