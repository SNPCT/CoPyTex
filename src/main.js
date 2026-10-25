// CoPyTex 시작점: 상태(설정/셀/묶음) 관리, 목록 그리기, 테마 적용.
import { h, icon, toast } from './ui.js';
import { t, setLang } from './i18n.js';
import {
  loadSettings, saveSettings, loadNotebook, saveNotebook, makeCell, uid, SYN_KEYS, migrateLegacyFonts,
} from './storage.js';
import { createGroup } from './group.js';
import { setupDropZone } from './dnd.js';
import { openSettings } from './settings.js';
import { analyzeMacros, macroNamesForEditor } from './macros.js';
import { setUserMacros } from './commands.js';

const state = { settings: loadSettings(), cells: [], groups: {}, groupCtrls: [], ctrls: new Map() };
{ const nb = loadNotebook(state.settings); state.cells = nb.cells; state.groups = nb.groups; }
setLang(state.settings.lang);
setUserMacros(macroNamesForEditor(state.settings, null));
migrateLegacyFonts();

const app = document.getElementById('app');
const mq = window.matchMedia('(prefers-color-scheme: dark)');

/* ---------- 테마 ---------- */
function applyTheme() {
  const s = state.settings;
  const mode = s.themeMode === 'system' ? (mq.matches ? 'dark' : 'light') : s.themeMode;
  const root = document.documentElement;
  root.dataset.mode = mode;
  root.style.setProperty('--editor-fs', s.editorFs + 'px');
  if (s.accent) root.style.setProperty('--accent', s.accent); else root.style.removeProperty('--accent');
  SYN_KEYS.forEach((k) => root.style.setProperty('--syn-' + k, s.syn[mode][k]));
}
mq.addEventListener('change', applyTheme);

/* ---------- 저장 ---------- */
let saveTimer;
function saveNow() { saveNotebook(state.cells, state.groups); }
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
window.addEventListener('beforeunload', saveNow);

/* ---------- 셀/묶음 도우미 ---------- */
const indexOf = (id) => state.cells.findIndex((c) => c.id === id);

// 같은 묶음 id 가 떨어져 있으면 따로 떼고, 안 쓰는 묶음 옵션은 지워요.
function normalizeGroups() {
  const seen = new Set();
  let i = 0;
  while (i < state.cells.length) {
    const gid = state.cells[i].group;
    let j = i;
    while (j < state.cells.length && state.cells[j].group === gid) j++;
    if (seen.has(gid)) {
      const nid = uid();
      state.groups[nid] = { ...state.groups[gid] };
      for (let k = i; k < j; k++) state.cells[k].group = nid;
      seen.add(nid);
    } else seen.add(gid);
    i = j;
  }
  const used = new Set(state.cells.map((c) => c.group));
  Object.keys(state.groups).forEach((g) => { if (!used.has(g)) delete state.groups[g]; });
  used.forEach((g) => { if (!state.groups[g]) state.groups[g] = { ...state.settings.defaultGroup }; });
}

// 옮겨진 셀의 소속: 양쪽이 같은 묶음이면 그 안으로 들어가고, 자기 묶음과 붙어 있으면 그대로, 아니면 혼자가 돼요.
function regroupMoved(id) {
  const i = indexOf(id);
  const c = state.cells[i]; const prev = state.cells[i - 1]; const next = state.cells[i + 1];
  if (prev && next && prev.group === next.group && prev.group !== c.group) { c.group = prev.group; return; }
  if ((prev && prev.group === c.group) || (next && next.group === c.group)) return;
  const old = c.group;
  c.group = uid();
  state.groups[c.group] = { ...state.groups[old] };
}

function afterStructureChange() { normalizeGroups(); scheduleSave(); build(); }

function neighborGroupOpts(index) {
  const c = state.cells[index - 1] || state.cells[index];
  return c ? { ...state.groups[c.group] } : { ...state.settings.defaultGroup };
}

function baseFor(type, index) {
  const before = state.cells.slice(0, index).reverse().find((c) => c.type === type);
  const after = state.cells.slice(index).find((c) => c.type === type);
  const src = before || after;
  if (src) return { opts: { ...src.opts }, wrap: src.wrap };
  return { opts: { ...(type === 'math' ? state.settings.defaultOpts : state.settings.defaultTextOpts) }, wrap: 'aligned' };
}

function insertCell(index, type) {
  const prev = state.cells[index - 1]; const next = state.cells[index];
  let gid;
  if (prev && next && prev.group === next.group) gid = prev.group; // 묶음 한가운데에 넣으면 그 묶음에 들어가요
  else { gid = uid(); state.groups[gid] = neighborGroupOpts(index); }
  const base = baseFor(type, index);
  const cell = makeCell(type, base.opts, gid, { wrap: base.wrap });
  state.cells.splice(index, 0, cell);
  afterStructureChange();
  const c = state.ctrls.get(cell.id);
  if (c) c.focus();
}

function link(index) {
  const a = state.cells[index - 1]; const b = state.cells[index];
  if (!a || !b || a.group === b.group) return;
  const gb = b.group;
  state.cells.forEach((c) => { if (c.group === gb) c.group = a.group; });
  afterStructureChange();
}
function unlink(index) {
  const a = state.cells[index - 1]; const b = state.cells[index];
  if (!a || !b || a.group !== b.group) return;
  const gid = a.group; const nid = uid();
  state.groups[nid] = { ...state.groups[gid] };
  for (let k = index; k < state.cells.length && state.cells[k].group === gid; k++) state.cells[k].group = nid;
  afterStructureChange();
}

const actions = {
  onChange: scheduleSave,
  move(id, dir) {
    const i = indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= state.cells.length) return;
    [state.cells[i], state.cells[j]] = [state.cells[j], state.cells[i]];
    regroupMoved(id);
    afterStructureChange();
  },
  duplicate(id) {
    const i = indexOf(id);
    const src = state.cells[i];
    const copy = { ...src, id: uid(), collapsed: false, opts: { ...src.opts } };
    state.cells.splice(i + 1, 0, copy);
    afterStructureChange();
    const c = state.ctrls.get(copy.id);
    if (c) c.focus();
  },
  remove(id) {
    const i = indexOf(id);
    if (state.cells[i].code.trim() && !confirm(t('settings.deleteCellConfirm'))) return;
    state.cells.splice(i, 1);
    if (!state.cells.length) {
      const c = makeCell('math', state.settings.defaultOpts);
      state.groups[c.group] = { ...state.settings.defaultGroup };
      state.cells.push(c);
    }
    afterStructureChange();
  },
  runNext(id) {
    const i = indexOf(id);
    if (i < state.cells.length - 1) { const n = state.ctrls.get(state.cells[i + 1].id); if (n) n.focus(); }
    else insertCell(state.cells.length, 'math');
  },
};

// 드래그로 옮기기: 놓은 자리(index)로 이동
function moveTo(id, index) {
  const from = indexOf(id);
  if (from < 0) return;
  const to = from < index ? index - 1 : index;
  if (to === from) return;
  const [c] = state.cells.splice(from, 1);
  state.cells.splice(to, 0, c);
  regroupMoved(id);
  afterStructureChange();
}

/* ---------- 화면 ---------- */
function insertBar(index) {
  const n = state.cells.length;
  const kids = [
    h('button', { type: 'button', class: 'btn small ghost', onClick: () => insertCell(index, 'math') }, t('cell.insertMath')),
    h('button', { type: 'button', class: 'btn small ghost', onClick: () => insertCell(index, 'text') }, t('cell.insertText')),
  ];
  if (index > 0 && index < n) {
    const same = state.cells[index - 1].group === state.cells[index].group;
    kids.push(h('button', {
      type: 'button', class: 'btn small ghost link', title: t(same ? 'cell.unlinkHint' : 'cell.linkHint'),
      onClick: () => (same ? unlink(index) : link(index)),
    }, icon(same ? 'unlink' : 'link'), t(same ? 'cell.unlink' : 'cell.link')));
  }
  return h('div', { class: 'insert' }, kids);
}

function build() {
  state.groupCtrls.forEach((g) => g.destroy());
  state.groupCtrls = [];
  state.ctrls.clear();
  document.title = t('app.title');

  const numbers = new Map(); let m = 0; let x = 0;
  state.cells.forEach((c) => numbers.set(c.id, c.type === 'math' ? ++m : ++x));

  const setAll = (collapsed) => { state.ctrls.forEach((c) => c.setCollapsed(collapsed)); scheduleSave(); };
  const top = h('header', { class: 'top' },
    h('div', { class: 'titles' }, h('h1', null, t('app.title')), h('p', null, t('app.subtitle'))),
    h('div', { class: 'top-tools' },
      h('button', { type: 'button', class: 'btn', onClick: () => insertCell(state.cells.length, 'math') }, t('toolbar.addMath')),
      h('button', { type: 'button', class: 'btn', onClick: () => insertCell(state.cells.length, 'text') }, t('toolbar.addText')),
      h('button', { type: 'button', class: 'btn', onClick: () => setAll(true) }, t('toolbar.collapseAll')),
      h('button', { type: 'button', class: 'btn', onClick: () => setAll(false) }, t('toolbar.expandAll')),
      h('button', { type: 'button', class: 'btn', onClick: () => state.groupCtrls.forEach((g) => g.update(true)) }, icon('refresh'), t('toolbar.refreshAll')),
      h('button', { type: 'button', class: 'btn', onClick: openSettingsDialog }, icon('gear'), t('toolbar.settings'))));

  const list = h('main', { class: 'list' });
  list.appendChild(insertBar(0));
  let i = 0;
  while (i < state.cells.length) {
    const gid = state.cells[i].group;
    const cells = [];
    while (i < state.cells.length && state.cells[i].group === gid) cells.push(state.cells[i++]);
    const g = createGroup({
      cells, opts: state.groups[gid], settings: state.settings, numbers,
      startIndex: i - cells.length, total: state.cells.length, actions, insertBar,
    });
    state.groupCtrls.push(g);
    g.ctrls.forEach((c, id) => state.ctrls.set(id, c));
    list.appendChild(g.el);
    list.appendChild(insertBar(i));
  }
  app.replaceChildren(top, list, h('footer', { class: 'foot' }, 'CoPyTex · hjang, Claude'));
  setupDropZone(list, moveTo);
  state.groupCtrls.forEach((g) => g.update(false));
}

async function refreshMacros() {
  const st = await analyzeMacros(state.settings);
  const names = macroNamesForEditor(state.settings, st);
  const before = JSON.stringify(macroNamesForEditor(state.settings, null));
  setUserMacros(names);
  return JSON.stringify(names) !== before;
}

function openSettingsDialog() {
  openSettings({
    state,
    commit(kind) {
      const s = state.settings;
      saveSettings(s);
      if (kind === 'lang') { setLang(s.lang); build(); }
      else if (kind === 'theme') applyTheme();
      else if (kind === 'macros') refreshMacros().then(() => { build(); }).catch(() => build());
      else if (kind === 'font') state.groupCtrls.forEach((g) => g.update(false));
      else if (kind === 'packages') location.reload();
    },
    onReset() { location.reload(); },
  });
}

normalizeGroups();
applyTheme();
build();

if (window.__mjReady) {
  window.__mjReady
    .then(() => refreshMacros())
    .then((changed) => { if (changed) build(); })
    .catch(() => toast(t('status.mathjaxFailed')));
}
