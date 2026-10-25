// 텍스트 셀의 $...$ 인라인 수식: 나누기(parseText), 검사(validateMath), 줄 배치(layoutLines).
// 이 파일은 화면/MathJax 에 의존하지 않는 순수 함수들이에요. (MathJax 로 그리는 일은 render.js 가 해요)
import { ALLOWED_COMMANDS, ALLOWED_ESCAPES, ALLOWED_CHARS, LIMITS } from './inline-allowlist.js';

/* ---------- 1. 나누기 ----------
   한 줄을 { type:'text'|'math', value } 조각들로 나눠요.
   - $...$ 안이 수식이에요. 수식은 줄을 넘길 수 없어요.
   - \$ 는 글자 $ 예요.
   - 짝이 안 맞는 $ 나 빈 수식($$)은 오류예요. */
export function parseLine(line) {
  const parts = []; let buf = ''; let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === '\\' && line[i + 1] === '$') { buf += '$'; i += 2; continue; }
    if (c === '$') {
      let j = i + 1;
      while (j < n) {
        if (line[j] === '\\') { j += 2; continue; }
        if (line[j] === '$') break;
        j++;
      }
      if (j >= n) return { parts, error: { key: 'inline.err.unmatched' } };
      const src = line.slice(i + 1, j).trim();
      if (!src) return { parts, error: { key: 'inline.err.empty' } };
      if (buf) { parts.push({ type: 'text', value: buf }); buf = ''; }
      parts.push({ type: 'math', value: src });
      i = j + 1;
      continue;
    }
    buf += c; i++;
  }
  if (buf) parts.push({ type: 'text', value: buf });
  return { parts, error: null };
}

export function parseText(body) {
  const lines = [];
  for (const raw of body.split('\n')) {
    const r = parseLine(raw);
    if (r.error) return { lines, error: { ...r.error, line: raw } };
    lines.push({ parts: r.parts });
  }
  return { lines, error: null };
}

/* ---------- 2. 검사 ----------
   허용 목록에 있는 것만 통과시켜요. 문제가 있으면 { key, vars } 를, 괜찮으면 null 을 돌려줘요. */
export function validateMath(src) {
  if (src.length > LIMITS.maxLength) return { key: 'inline.err.length', vars: { max: LIMITS.maxLength } };
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      const m = /^[a-zA-Z]+/.exec(src.slice(i + 1));
      if (m) {
        if (!ALLOWED_COMMANDS.has(m[0])) return { key: 'inline.err.command', vars: { cmd: '\\' + m[0] } };
        i += m[0].length;
        continue;
      }
      const nx = src[i + 1];
      if (nx === undefined) return { key: 'inline.err.trailing' };
      if (!ALLOWED_ESCAPES.has(nx)) return { key: 'inline.err.command', vars: { cmd: '\\' + nx } };
      i++;
      continue;
    }
    if (c === '{') { if (++depth > LIMITS.maxDepth) return { key: 'inline.err.depth', vars: { max: LIMITS.maxDepth } }; continue; }
    if (c === '}') { if (--depth < 0) return { key: 'inline.err.braces' }; continue; }
    if (!ALLOWED_CHARS.test(c)) return { key: 'inline.err.char', vars: { ch: c } };
  }
  if (depth !== 0) return { key: 'inline.err.braces' };
  return null;
}

/* ---------- 3. 줄 배치 ----------
   글자 조각과 수식 조각(이미 그려진 크기 p.m = { w, asc, desc })을 한 줄에 섞어서 놓아요.
   - width(px)가 0 이면 자동 줄바꿈 없음, 있으면 단어 단위로 줄을 바꿔요. (수식은 쪼개지 않아요)
   - 단어 하나가 width 보다 길면 글자 단위로 나눠요.
   - 줄 높이는 그 줄에서 가장 높은 조각에 맞춰요. 기준선(baseline)은 줄마다 하나예요. */
export function layoutLines(lines, { width, measure, textAsc, textDesc }) {
  const rows = [];
  const limit = width > 0 ? width : Infinity;

  const closeRow = (row) => {
    while (row.atoms.length && row.atoms[row.atoms.length - 1].t === 'space') row.w -= row.atoms.pop().w;
    row.asc = textAsc; row.desc = textDesc;
    row.atoms.forEach((a) => { if (a.t === 'math') { row.asc = Math.max(row.asc, a.m.asc); row.desc = Math.max(row.desc, a.m.desc); } });
    row.h = row.asc + row.desc;
    rows.push(row);
  };

  for (const line of lines) {
    let row = { atoms: [], w: 0 }; let first = true;
    const push = (atom) => {
      if (atom.t === 'space') {
        if (row.atoms.length === 0 && !first) return; // 줄바꿈된 줄의 맨 앞 공백은 버려요
        row.atoms.push(atom); row.w += atom.w; return;
      }
      if (row.w + atom.w > limit && row.atoms.some((a) => a.t !== 'space')) {
        closeRow(row); row = { atoms: [], w: 0 }; first = false;
      }
      row.atoms.push(atom); row.w += atom.w;
    };

    for (const part of line.parts) {
      if (part.type === 'math') { push({ t: 'math', m: part.m, w: part.m.w }); continue; }
      for (const unit of part.value.split(/(\s+)/)) {
        if (!unit) continue;
        if (/^\s+$/.test(unit)) { push({ t: 'space', s: unit, w: measure(unit) }); continue; }
        const w = measure(unit);
        if (w > limit) for (const ch of unit) push({ t: 'text', s: ch, w: measure(ch) });
        else push({ t: 'text', s: unit, w });
      }
    }
    closeRow(row);
  }
  return {
    rows,
    width: Math.max(1, ...rows.map((r) => r.w)),
    height: rows.reduce((s, r) => s + r.h, 0),
  };
}
