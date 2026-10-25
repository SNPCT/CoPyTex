// 설정 창: 일반 / 매크로 / 패키지 / 글꼴 / 테마 / 백업.
// 새 설정 항목을 추가하려면 해당 탭 함수(panelXxx)에 입력칸을 넣고 commit('종류') 를 부르세요.
import { h, icon, toast, styleFields, groupFields } from './ui.js';
import { t, LANGS } from './i18n.js';
import { analyzeMacros, renderMacroPreview } from './macros.js';
import {
  SYN_KEYS, DEFAULT_SYN, listFonts, putFont, deleteFont, fontMimeFor, buildBackup, restoreBackup, eraseAll, uid,
} from './storage.js';

// 사용할 수 있는 MathJax TeX 확장 목록 (이름은 MathJax 확장 이름과 같아야 해요)
export const PACKAGE_LIST = [
  'mhchem', 'physics', 'mathtools', 'cancel', 'boldsymbol', 'braket', 'bbox', 'extpfeil',
  'upgreek', 'gensymb', 'cases', 'empheq', 'textmacros',
];
const DOC_NAME = { boldsymbol: 'amsmath' };        // texdoc 이름이 다른 것
const NO_TEXDOC = new Set(['bbox', 'textmacros']); // LaTeX 패키지가 아닌 MathJax 전용 확장
const docUrl = (p) => NO_TEXDOC.has(p)
  ? `https://docs.mathjax.org/en/v3.2/input/tex/extensions/${p}.html`
  : `https://texdoc.org/serve/${DOC_NAME[p] || p}/0`;

export function openSettings({ state, commit, onReset }) {
  const dlg = h('dialog', { class: 'settings', 'aria-labelledby': 'settings-title' });
  let activeTab = 'general';
  const tabs = [
    ['general', 'settings.tab.general', panelGeneral],
    ['macros', 'settings.tab.macros', panelMacros],
    ['packages', 'settings.tab.packages', panelPackages],
    ['fonts', 'settings.tab.fonts', panelFonts],
    ['theme', 'settings.tab.theme', panelTheme],
    ['backup', 'settings.tab.backup', panelBackup],
  ];

  function draw() {
    const nav = h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, key]) => h('button', {
      type: 'button', role: 'tab', class: 'tab' + (id === activeTab ? ' on' : ''), 'aria-selected': id === activeTab ? 'true' : 'false',
      onClick: () => { activeTab = id; draw(); },
    }, t(key))));
    const panel = h('div', { class: 'panel-body', role: 'tabpanel' });
    const fn = tabs.find((x) => x[0] === activeTab)[2];
    const content = fn();
    dlg.replaceChildren(
      h('div', { class: 'dlg-head' },
        h('h2', { id: 'settings-title' }, t('settings.title')),
        h('button', { type: 'button', class: 'btn', onClick: () => dlg.close() }, t('settings.close'))),
      nav, panel);
    if (content && content.then) content.then((el) => panel.appendChild(el)); else panel.appendChild(content);
  }

  /* ----- 일반 ----- */
  function panelGeneral() {
    const s = state.settings;
    const lang = h('select', { onChange: (e) => { s.lang = e.target.value; commit('lang'); draw(); } },
      LANGS.map((l) => h('option', { value: l.code }, l.label)));
    lang.value = s.lang;
    const mode = h('select', { onChange: (e) => { s.themeMode = e.target.value; commit('theme'); } },
      [['system', 'settings.modeSystem'], ['light', 'settings.modeLight'], ['dark', 'settings.modeDark']].map(([v, k]) => h('option', { value: v }, t(k))));
    mode.value = s.themeMode;
    const fs = h('input', { type: 'number', min: 11, max: 28, step: 1, value: s.editorFs,
      onInput: (e) => { const v = parseInt(e.target.value, 10); if (v >= 11 && v <= 28) { s.editorFs = v; commit('theme'); } } });
    return h('div', { class: 'form' },
      h('label', { class: 'field' }, h('span', null, t('settings.language')), lang),
      h('label', { class: 'field' }, h('span', null, t('settings.themeMode')), mode),
      h('label', { class: 'field' }, h('span', null, t('settings.editorFs')), fs),
      h('h3', null, t('settings.defaultMath')),
      h('div', { class: 'opts-grid' }, styleFields(s.defaultOpts, () => commit('defaults'), false)),
      h('h3', null, t('settings.defaultText')),
      h('div', { class: 'opts-grid' }, styleFields(s.defaultTextOpts, () => commit('defaults'), true)),
      h('h3', null, t('settings.defaultGroup')),
      h('div', { class: 'opts-grid' }, groupFields(s.defaultGroup, () => commit('defaults'), true)));
  }

  /* ----- 내 명령어 (매크로) ----- */
  function panelMacros() {
    const s = state.settings;
    const wrap = h('div', { class: 'form' });
    const table = h('div', { class: 'macro-table' });
    let rows = [];

    const msgFor = (st, m) => {
      const empty = !(m.name || '').trim() && !(m.body || '').trim();
      if (empty) return ['', ''];
      if (st === 'invalid') return [t('macro.status.invalid'), 'is-err'];
      if (st === 'dupe') return [t('macro.status.dupe'), 'is-err'];
      if (st === 'conflict') return [t('macro.status.conflict'), 'is-err'];
      if (st === 'empty') return [t('macro.status.empty'), 'hint'];
      return ['', ''];
    };

    async function paint() {
      let st = [];
      try { st = await analyzeMacros(s); } catch (e) { st = []; }
      rows.forEach((r, i) => {
        const [text, kind] = msgFor(st[i], r.m);
        r.msg.textContent = text; r.msg.className = 'm-msg ' + kind;
        r.row.classList.toggle('bad', kind === 'is-err');
        r.prev.replaceChildren();
        if (st[i] === 'ok') {
          renderMacroPreview(r.m, s).then((node) => { if (node) r.prev.replaceChildren(node); })
            .catch((e) => { r.msg.textContent = t('macro.status.previewFailed', { msg: e.message }); r.msg.className = 'm-msg is-err'; });
        }
      });
    }
    const save = () => { commit('macros'); paint(); };

    function draw() {
      rows = []; table.replaceChildren(
        h('div', { class: 'mrow mhead' }, h('span'), h('span', null, t('macro.col.name')), h('span', null, t('macro.col.args')), h('span', null, t('macro.col.body')), h('span', null, t('macro.col.preview')), h('span')));
      s.macroList.forEach((m, idx) => {
        const name = h('input', { class: 'm-name', value: m.name, spellcheck: 'false', 'aria-label': t('macro.col.name'),
          onChange: (e) => { m.name = e.target.value.replace(/^[\\\s]+/, '').trim(); e.target.value = m.name; save(); } });
        const args = h('select', { class: 'm-args', 'aria-label': t('macro.col.args'), onChange: (e) => { m.args = +e.target.value; save(); } },
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('option', { value: String(n) }, String(n))));
        args.value = String(m.args || 0);
        const body = h('input', { class: 'm-body', value: m.body, spellcheck: 'false', placeholder: t('macro.bodyPlaceholder'), 'aria-label': t('macro.col.body'),
          onChange: (e) => { m.body = e.target.value; save(); } });
        const prev = h('span', { class: 'm-prev' });
        const msg = h('div', { class: 'm-msg' });
        const del = h('button', { type: 'button', class: 'tool', title: t('macro.delete'), 'aria-label': t('macro.delete'),
          onClick: () => { s.macroList.splice(idx, 1); draw(); save(); } }, icon('x'));
        const row = h('div', { class: 'mrow' }, h('span', { class: 'bs' }, '\\'), name, args, body, prev, del, msg);
        rows.push({ m, row, prev, msg });
        table.appendChild(row);
      });
      paint();
    }
    draw();

    const raw = h('textarea', { class: 'macro-area', spellcheck: 'false', rows: '4', value: s.macroRaw,
      placeholder: '\\def\\half{\\frac12}',
      onChange: () => { s.macroRaw = raw.value; save(); } });
    wrap.append(
      h('p', { class: 'help' }, t('settings.macrosHelp')),
      table,
      h('button', { type: 'button', class: 'btn', onClick: () => { s.macroList.push({ name: '', args: 0, body: '' }); draw(); const ins = table.querySelectorAll('.m-name'); ins[ins.length - 1].focus(); } }, t('macro.add')),
      h('details', { class: 'opts' }, h('summary', null, t('macro.raw')), h('p', { class: 'help' }, t('macro.rawHelp')), raw),
      h('p', { class: 'help' }, t('settings.macrosNote')));
    return wrap;
  }

  /* ----- 패키지 ----- */
  function panelPackages() {
    const chosen = new Set(state.settings.packages);
    return h('div', { class: 'form' },
      h('p', { class: 'help' }, t('settings.packagesHelp')),
      h('div', { class: 'pkg-grid' }, PACKAGE_LIST.map((p) => h('label', { class: 'inline pkg' },
        h('input', { type: 'checkbox', checked: chosen.has(p), onChange: (e) => { if (e.target.checked) chosen.add(p); else chosen.delete(p); } }),
        h('span', null, h('a', { class: 'pkg-link', href: docUrl(p), target: '_blank', rel: 'noopener noreferrer',
         title: t('settings.pkg.docHint') }, p), ' ', t('settings.pkg.' + p))))),
      h('button', { type: 'button', class: 'btn primary', onClick: () => { state.settings.packages = PACKAGE_LIST.filter((p) => chosen.has(p)); commit('packages'); } }, t('settings.packagesReload')));
  }

  /* ----- 글꼴 ----- */
  async function panelFonts() {
    const fonts = await listFonts();
    const s = state.settings;
    const radio = (id, label, extra) => h('label', { class: 'inline font-row' },
      h('input', { type: 'radio', name: 'font', checked: (s.fontId || null) === id, onChange: () => { s.fontId = id; commit('font'); } }),
      h('span', null, label), extra);
    const file = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', onChange: async () => {
      const f = file.files[0];
      if (!f) return;
      const mime = fontMimeFor(f.name);
      if (!mime) { toast(t('status.fontFailed')); return; }
      try {
        const id = uid();
        await putFont({ id, name: f.name, mime, data: await f.arrayBuffer() });
        s.fontId = id; commit('font'); toast(t('status.fontAdded')); draw();
      } catch (e) { toast(t('status.fontFailed')); }
    } });
    return h('div', { class: 'form' },
      h('p', { class: 'help' }, t('settings.fontsHelp')),
      h('label', { class: 'field' }, h('span', null, t('settings.fontUpload')), file),
      h('div', { class: 'font-list' },
        radio(null, t('settings.fontNone')),
        fonts.length ? fonts.map((f) => radio(f.id, f.name + ' (' + Math.round(f.size / 1024) + ' KB)',
          h('button', { type: 'button', class: 'btn small', onClick: async () => {
            await deleteFont(f.id);
            if (s.fontId === f.id) { s.fontId = null; commit('font'); }
            draw();
          } }, t('settings.fontDelete')))) : h('p', { class: 'help' }, t('settings.fontEmpty'))));
  }

  /* ----- 테마 ----- */
  function panelTheme() {
    const s = state.settings;
    const accent = h('input', { type: 'color', value: s.accent || getComputedStyle(document.documentElement).getPropertyValue('--accent-default').trim() || '#2552e8',
      onInput: (e) => { s.accent = e.target.value; commit('theme'); } });
    const rows = SYN_KEYS.map((k) => h('tr', null,
      h('td', null, t('syn.' + k)),
      ['light', 'dark'].map((m) => h('td', null, h('input', {
        type: 'color', value: s.syn[m][k], onInput: (e) => { s.syn[m][k] = e.target.value; commit('theme'); },
      })))));
    return h('div', { class: 'form' },
      h('p', { class: 'help' }, t('settings.themeHelp')),
      h('label', { class: 'field' }, h('span', null, t('settings.accent')), accent),
      h('table', { class: 'syn-table' },
        h('thead', null, h('tr', null, h('th', null, t('settings.syntax')), h('th', null, t('settings.light')), h('th', null, t('settings.dark')))),
        h('tbody', null, rows)),
      h('button', { type: 'button', class: 'btn', onClick: () => {
        s.accent = null; s.syn = JSON.parse(JSON.stringify(DEFAULT_SYN)); commit('theme'); draw();
      } }, t('settings.themeReset')));
  }

  /* ----- 백업 ----- */
  function panelBackup() {
    const file = h('input', { type: 'file', accept: 'application/json,.json', onChange: async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        await restoreBackup(JSON.parse(await f.text()));
        toast(t('status.imported'));
        setTimeout(() => location.reload(), 700);
      } catch (e) { toast(t('status.importFailed', { msg: e.message })); }
    } });
    return h('div', { class: 'form' },
      h('p', { class: 'help' }, t('settings.backupHelp')),
      h('div', { class: 'row-btns' },
        h('button', { type: 'button', class: 'btn primary', onClick: async () => {
          const data = await buildBackup(state.settings, state.cells, state.groups);
          const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
          const a = h('a', { href: url, download: 'copytex-backup.json' });
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        } }, t('settings.export'))),
      h('label', { class: 'field' }, h('span', null, t('settings.import')), file),
      h('div', { class: 'row-btns' },
        h('button', { type: 'button', class: 'btn danger', onClick: async () => {
          if (!confirm(t('settings.resetConfirm'))) return;
          await eraseAll(); onReset();
        } }, t('settings.reset'))));
  }

  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.appendChild(dlg);
  draw();
  dlg.showModal();
}
