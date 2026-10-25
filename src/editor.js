// CodeMirror 6 에디터 설정: 구문 강조, 자동완성(\begin{} → 환경 목록), 괄호 자동 닫기, 단축키.
import { EditorState, Prec, Annotation } from '@codemirror/state';
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, insertTab } from '@codemirror/commands';
import { syntaxHighlighting, bracketMatching, indentUnit } from '@codemirror/language';
import {
  autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap,
  acceptCompletion, startCompletion, nextSnippetField, prevSnippetField,
} from '@codemirror/autocomplete';
import { latexLanguage, latexHighlight } from './latex-lang.js';
import { buildCommandOptions, buildEnvOptions, macroOptions } from './commands.js';

const envOptions = buildEnvOptions();
const commandOptions = buildCommandOptions((view) => startCompletion(view));

function envSource(ctx) {
  const m = ctx.matchBefore(/\\(?:begin|end)\{[a-zA-Z*]*/);
  if (!m) return null;
  const from = m.from + m.text.indexOf('{') + 1;
  return { from, options: envOptions, validFor: /^[a-zA-Z*]*$/ };
}

function commandSource(ctx) {
  const m = ctx.matchBefore(/\\[a-zA-Z]*/);
  if (!m) return null;
  if (m.text.length < 2 && !ctx.explicit) return null; // "\" 만 쳤을 땐 글자가 하나 이상 나올 때 띄워요
  return { from: m.from, options: commandOptions.concat(macroOptions()), validFor: /^\\[a-zA-Z]*$/ };
}

// \{ \( \[ 앞의 괄호는 짝을 만들지 않아요.
const noPairAfterBackslash = EditorView.inputHandler.of((view, from, to, text) => {
  if ((text === '{' || text === '(' || text === '[') && from > 0 && view.state.doc.sliceString(from - 1, from) === '\\') {
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + 1 }, userEvent: 'input.type' });
    return true;
  }
  return false;
});


// \begin{이름} 의 이름을 고치면 짝이 되는 \end{이름} 도 같이 바뀌어요. (Overleaf 와 같은 동작)
// 짝을 못 찾거나, 원래 \end 이름이 \begin 과 달랐다면 건드리지 않아요.
const BEGIN_RE = /\\begin\{([a-zA-Z*]*)\}/g;
function findMatchingEnd(doc, from) {
  const text = doc.sliceString(from, Math.min(doc.length, from + 30000));
  const re = /\\(begin|end)\{([a-zA-Z*]*)\}/g;
  let depth = 1; let m;
  while ((m = re.exec(text))) {
    if (m[1] === 'begin') depth++;
    else if (--depth === 0) {
      const nameFrom = from + m.index + m[0].indexOf('{') + 1;
      return { from: nameFrom, to: nameFrom + m[2].length, name: m[2] };
    }
  }
  return null;
}
const envSync = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.annotation(syncNote)) return tr;
  const oldDoc = tr.startState.doc;
  let extra = null;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (extra) return;
    const line = oldDoc.lineAt(fromA);
    BEGIN_RE.lastIndex = 0;
    let m;
    while ((m = BEGIN_RE.exec(line.text))) {
      const nameFrom = line.from + m.index + m[0].indexOf('{') + 1;
      const nameTo = nameFrom + m[1].length;
      if (fromA >= nameFrom && toA <= nameTo) {
        const end = findMatchingEnd(oldDoc, line.from + m.index + m[0].length);
        if (end && end.name === m[1]) {
          const newName = tr.newDoc.sliceString(tr.changes.mapPos(nameFrom, -1), tr.changes.mapPos(nameTo, 1));
          if (/^[a-zA-Z*]*$/.test(newName) && newName !== end.name) extra = { from: end.from, to: end.to, insert: newName };
        }
        break;
      }
    }
  });
  if (!extra) return tr;
  return [tr, { changes: extra, annotations: syncNote.of(true), sequential: false }];
});
const syncNote = Annotation.define();

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--ink)', fontSize: 'var(--editor-fs, 15px)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--ink)', padding: '6px 0' },
  '.cm-line': { padding: '0 12px' },
  '.cm-cursor': { borderLeftColor: 'var(--ink)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent)' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', outline: 'none' },
  '.cm-snippetField': { backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)' },
  '.cm-tooltip': { backgroundColor: 'var(--pop-bg)', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(10,16,30,.22)' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--mono)', fontSize: '13.5px', maxHeight: '15em' },
  '.cm-tooltip-autocomplete ul li': { padding: '3px 10px', color: 'var(--ink)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--pop-sel)', color: 'var(--ink)' },
  '.cm-completionMatchedText': { textDecoration: 'none', color: 'var(--accent)', fontWeight: '600' },
  '.cm-completionDetail': { color: 'var(--muted)', fontStyle: 'normal', marginLeft: '1.5em' },
  '.cm-completionIcon': { display: 'none' },
});

export function createEditor(parent, { doc, onChange, onRun, onRunNext }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        Prec.highest(noPairAfterBackslash),
        envSync,
        Prec.highest(keymap.of([
          { key: 'Mod-Enter', run: () => { onRun(); return true; } },
          { key: 'Shift-Enter', run: () => { onRunNext(); return true; } },
          { key: 'Tab', run: (v) => acceptCompletion(v) || nextSnippetField(v) || insertTab(v) },
          { key: 'Shift-Tab', run: (v) => prevSnippetField(v) },
        ])),
        history(),
        drawSelection(),
        highlightActiveLine(),
        closeBrackets(),
        bracketMatching(),
        indentUnit.of('  '),
        latexLanguage,
        syntaxHighlighting(latexHighlight),
        autocompletion({ override: [envSource, commandSource], activateOnTyping: true, maxRenderedOptions: 14 }),
        keymap.of([...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
        theme,
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange(u.state.doc.toString()); }),
      ],
    }),
  });
  return view;
}
