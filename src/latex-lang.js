// LaTeX(수식 전용) 구문 강조. 색은 style.css 의 --syn-* 변수로 정해지고, 설정의 '테마' 탭에서 바꿔요.
// 토큰 종류를 더 나누고 싶으면 TOKEN_NAMES 와 아래 token() 을 같이 고치세요.
import { StreamLanguage, HighlightStyle } from '@codemirror/language';
import { Tag } from '@lezer/highlight';
import { GREEK, STRUCT, TEXT_COMMANDS, isUserMacro } from './commands.js';

export const TOKEN_NAMES = ['cmd', 'greek', 'struct', 'macro', 'env', 'bracket', 'number', 'operator', 'text', 'comment'];
const TAGS = {};
TOKEN_NAMES.forEach((n) => { TAGS[n] = Tag.define(); });

export function tokenizer(stream, state) {
  // \text{ ... } 안쪽
  if (state.inText > 0) {
    const c = stream.peek();
    if (c === '{') { stream.next(); state.inText++; return 'bracket'; }
    if (c === '}') { stream.next(); state.inText--; return 'bracket'; }
    if (c === '\\') { stream.next(); if (!stream.match(/^[a-zA-Z]+/)) stream.next(); return 'cmd'; }
    stream.eatWhile(/[^{}\\]/);
    return 'text';
  }
  // \begin{ 환경이름 }
  if (state.inEnv) {
    if (stream.peek() === '}') { stream.next(); state.inEnv = false; return 'bracket'; }
    stream.eatWhile(/[^}]/);
    return 'env';
  }
  if (stream.eatSpace()) return null;
  const ch = stream.peek();

  if (ch === '%') { stream.skipToEnd(); return 'comment'; }

  if (ch === '{') {
    stream.next();
    if (state.pendingText) { state.inText = 1; state.pendingText = false; }
    else if (state.pendingEnv) { state.inEnv = true; state.pendingEnv = false; }
    return 'bracket';
  }
  state.pendingText = false;
  state.pendingEnv = false;

  if (ch === '\\') {
    stream.next();
    if (stream.match(/^[a-zA-Z@]+/)) {
      const name = stream.current().slice(1);
      if (name === 'begin' || name === 'end') { state.pendingEnv = true; return 'env'; }
      if (TEXT_COMMANDS.has(name)) { state.pendingText = true; return 'cmd'; }
      if (isUserMacro(name)) return 'macro';
      if (GREEK.has(name)) return 'greek';
      if (STRUCT.has(name)) return 'struct';
      return 'cmd';
    }
    const nx = stream.next();
    if (nx === '\\') return 'operator';
    if (nx === '{' || nx === '}') return 'bracket';
    return 'cmd';
  }
  if (/[}\[\]()]/.test(ch)) { stream.next(); return 'bracket'; }
  if (stream.match(/^\d+(\.\d+)?/)) return 'number';
  if (/[a-zA-Z]/.test(ch)) { stream.eatWhile(/[a-zA-Z]/); return null; }
  if (/[&^_+\-=<>|\/*!'~:;,.]/.test(ch)) { stream.next(); return 'operator'; }
  stream.next();
  return null;
}

export const latexLanguage = StreamLanguage.define({
  name: 'latex-math',
  startState: () => ({ inText: 0, inEnv: false, pendingText: false, pendingEnv: false }),
  copyState: (s) => ({ ...s }),
  token: tokenizer,
  tokenTable: TAGS,
});

export const latexHighlight = HighlightStyle.define([
  ...TOKEN_NAMES.filter((n) => n !== 'comment').map((n) => ({ tag: TAGS[n], color: `var(--syn-${n})` })),
  { tag: TAGS.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
]);
