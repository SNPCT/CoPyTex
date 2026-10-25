// 내 명령어(매크로) 처리: 이름 검사, 기존 명령어와의 충돌 확인, 미리보기, MathJax 에 넘길 앞부분(preamble) 만들기.
// 표(settings.macroList)의 각 줄 상태: 'ok' | 'empty' | 'invalid' | 'dupe' | 'conflict'

const definedByUs = new Set(); // 우리가 이미 MathJax 에 등록한 이름(기존 명령어와 충돌로 오해하지 않기 위해)
let memo = { sig: '', statuses: [] };

const NAME_RE = /^[a-zA-Z]+$/;

export function macroSignature(settings) {
  return JSON.stringify([settings.macroList, settings.macroRaw, settings.packages]);
}

// MathJax 에 이미 있는 명령어인지 확인: 정의되지 않았다면 'Undefined control sequence' 오류가 나요.
function isBuiltin(name) {
  try {
    const mml = window.MathJax.tex2mml('\\' + name);
    return !/Undefined control sequence/.test(mml);
  } catch (e) {
    return true; // 자동 로딩이 필요한 확장의 명령어(\ce 등)는 예외가 나요 → 이미 있는 것으로 봐요
  }
}

export async function analyzeMacros(settings) {
  const sig = macroSignature(settings);
  if (memo.sig === sig) return memo.statuses;
  await window.__mjReady;
  const seen = new Set();
  const statuses = settings.macroList.map((m) => {
    const name = (m.name || '').trim();
    if (!name || !NAME_RE.test(name)) return 'invalid';
    if (seen.has(name)) return 'dupe';
    seen.add(name);
    if (!definedByUs.has(name) && isBuiltin(name)) return 'conflict';
    if (!(m.body || '').trim()) return 'empty';
    return 'ok';
  });
  statuses.forEach((s, i) => { if (s === 'ok') definedByUs.add(settings.macroList[i].name.trim()); });
  memo = { sig, statuses };
  return statuses;
}

function definition(m) {
  const n = Math.max(0, Math.min(9, +m.args || 0));
  return '\\newcommand{\\' + m.name.trim() + '}' + (n ? '[' + n + ']' : '') + '{' + m.body.trim() + '}';
}

// 모든 수식 앞에 붙는 정의 (유효한 줄만)
export async function buildPreamble(settings) {
  const statuses = await analyzeMacros(settings);
  const lines = [];
  settings.macroList.forEach((m, i) => { if (statuses[i] === 'ok') lines.push(definition(m)); });
  const raw = (settings.macroRaw || '').trim();
  if (raw) lines.push(raw);
  return lines.length ? lines.join('\n') + '\n' : '';
}

// 자동완성/색 구분에 쓸 이름 목록 (충돌 판정 전이라도 형식이 맞으면 포함)
export function macroNamesForEditor(settings, statuses) {
  const out = [];
  settings.macroList.forEach((m, i) => {
    const name = (m.name || '').trim();
    if (!NAME_RE.test(name) || !(m.body || '').trim()) return;
    if (statuses && (statuses[i] === 'conflict' || statuses[i] === 'dupe')) return;
    out.push({ name, args: Math.max(0, Math.min(9, +m.args || 0)) });
  });
  return out;
}

// 표의 한 줄 미리보기: 인자는 a, b, c … 로 채워서 보여줘요. 결과는 MathJax 가 만든 SVG 노드예요.
export async function renderMacroPreview(entry, settings) {
  const statuses = await analyzeMacros(settings);
  const idx = settings.macroList.indexOf(entry);
  if (idx < 0 || statuses[idx] !== 'ok') return null;
  const pre = await buildPreamble(settings);
  const args = 'abcdefghi'.slice(0, Math.max(0, Math.min(9, +entry.args || 0))).split('').map((c) => '{' + c + '}').join('');
  const node = await window.MathJax.tex2svgPromise(pre + '\\' + entry.name.trim() + args, { display: false });
  const bad = node.querySelector('[data-mml-node="merror"]');
  if (bad) throw new Error(bad.getAttribute('data-mjx-error') || 'syntax error');
  return node.querySelector('svg') || node;
}
