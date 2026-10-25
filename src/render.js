// 셀 → "레이어"(그릴 수 있는 조각) → 묶음 PNG 변환.
//  - 수식 레이어: MathJax(SVG)를 이미지로 불러둔 것 (선명하게 확대되도록 PNG 가 아니라 벡터 상태로 보관)
//  - 텍스트 레이어: 캔버스 글자 + $...$ 인라인 수식 (설정에서 고른 글꼴 사용)
//  - composePng: 레이어들을 왼쪽 정렬로 세로로 쌓아 PNG 한 장으로 만들어요.
import { getFontDataUri } from './storage.js';
import { buildPreamble, macroSignature } from './macros.js';
import { t } from './i18n.js';
import { parseText, validateMath, layoutLines } from './inline-math.js';
import { LIMITS } from './inline-allowlist.js';

export class RenderError extends Error {}

const MAX_WIDTH = 5000; // 이 너비를 넘으면 해상도를 1x까지 낮춰요
const MAX_DIM = 16000;  // 브라우저 캔버스 한계(안전선). 이보다 크면 더 줄여요

/* ---------- 수식 소스 만들기 (순수 함수 → 테스트하기 쉬워요) ---------- */

// 본문 전체가 \begin{..}...\end{..} 하나이면 감싸지 않아요.
export function isSingleEnvironment(body) {
  const s = body.trim();
  const m = /^\\begin\{([a-zA-Z*]+)\}/.exec(s);
  if (!m) return false;
  const re = /\\(begin|end)\{([a-zA-Z*]+)\}/g;
  let depth = 0; let mm; let lastEnd = -1;
  while ((mm = re.exec(s))) {
    if (mm[1] === 'begin') depth++;
    else { depth--; if (depth === 0) lastEnd = mm.index + mm[0].length; }
    if (depth === 0 && mm.index + mm[0].length < s.length && mm[1] === 'end') return false; // 환경이 끝난 뒤에 더 있음
  }
  return depth === 0 && lastEnd === s.length;
}

// 최상위 수준(중괄호/환경 밖)의 \\ 와 & 위치를 찾아 줄(row)로 나눠요.
export function splitRows(body) {
  const rows = []; let cur = ''; let brace = 0; let env = 0; let hasAmp = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') {
      const rest = body.slice(i);
      let m;
      if ((m = /^\\(begin|end)\{[a-zA-Z*]+\}/.exec(rest))) { env += m[1] === 'begin' ? 1 : -1; cur += m[0]; i += m[0].length - 1; continue; }
      if (body[i + 1] === '\\') {
        if (brace === 0 && env === 0) {
          const opt = /^\\\\(\[[^\]]*\])?/.exec(rest);
          rows.push({ text: cur, sep: opt[0] });
          cur = ''; i += opt[0].length - 1; continue;
        }
        cur += '\\\\'; i++; continue;
      }
      cur += c + (body[i + 1] || ''); i++; continue;
    }
    if (c === '{') brace++;
    else if (c === '}') brace--;
    else if (c === '&' && brace === 0 && env === 0) hasAmp = true;
    cur += c;
  }
  rows.push({ text: cur, sep: '' });
  return { rows, hasAmp };
}

// & 가 하나도 없으면 aligned 가 줄마다 오른쪽 정렬해 버려요 → 줄마다 & 를 붙여 왼쪽 정렬로 만들어요.
export function autoLeftAlign(body) {
  const { rows, hasAmp } = splitRows(body);
  if (hasAmp) return body;
  return rows.map((r) => r.text.replace(/^(\s*)/, '$1&') + r.sep).join('');
}

export function hasTopLevelAmp(body) { return splitRows(body).hasAmp; }

export function buildMathSource(cell) {
  const body = cell.code.trim();
  if (isSingleEnvironment(body)) return body;
  const env = cell.wrap === 'gathered' ? 'gathered' : 'aligned';
  const inner = env === 'aligned' ? autoLeftAlign(body) : body;
  return '\\begin{' + env + '}\n' + inner + '\n\\end{' + env + '}';
}

/* ---------- 레이어 만들기 ---------- */
let chain = Promise.resolve();
function serial(fn) {
  const job = chain.then(fn);
  chain = job.catch(() => {});
  return job;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new RenderError('image load failed'));
    img.src = src;
  });
}

async function makeMathLayer(cell, settings) {
  await window.__mjReady;
  const MJ = window.MathJax;
  if (MJ.texReset) MJ.texReset();
  const pre = await buildPreamble(settings);
  const node = await MJ.tex2svgPromise(pre + buildMathSource(cell), { display: true });
  const bad = node.querySelector('[data-mml-node="merror"]');
  if (bad) throw new RenderError(bad.getAttribute('data-mjx-error') || 'syntax error');

  const opts = cell.opts;
  const svg = node.querySelector('svg');
  const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number); // 1em = 1000 단위
  const fs = Math.max(8, +opts.fs || 28);
  const w = (vb[2] / 1000) * fs;
  const h = (vb[3] / 1000) * fs;
  svg.setAttribute('width', w.toFixed(3));
  svg.setAttribute('height', h.toFixed(3));
  svg.removeAttribute('style');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  let str = svg.outerHTML.split('currentColor').join(opts.color || '#000000');

  // MathJax 글꼴에 없는 글자(한글 등)는 <text> 로 나오는데, 이미지 안에서는 페이지 글꼴을 못 써요.
  // 그래서 선택한 글꼴을 SVG 안에 직접 넣어 줘요.
  let usedFont = false;
  if (settings.fontId && /<text[\s>]/.test(str)) {
    const f = await getFontDataUri(settings.fontId);
    if (f) {
      const css = '@font-face{font-family:"CoPyTexUser";src:url(data:' + f.mime + ';base64,' + f.b64 + ');}' +
        'text{font-family:"CoPyTexUser",serif !important;}';
      str = str.replace(/<svg[^>]*>/, (m) => m + '<style>' + css + '</style>');
      usedFont = true;
    }
  }
  const svgUrl = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
  let img;
  try {
    img = await loadImage(svgUrl);
    if (usedFont) { await new Promise((r) => setTimeout(r, 80)); img = await loadImage(svgUrl); }
  } catch (e) { URL.revokeObjectURL(svgUrl); throw e; }

  const pad = Math.max(0, +opts.pad || 0);
  return {
    cssW: Math.ceil(w + pad * 2),
    cssH: Math.ceil(h + pad * 2),
    paint(ctx, x, y) {
      if (!opts.transparent) { ctx.fillStyle = opts.bg || '#ffffff'; ctx.fillRect(x, y, this.cssW, this.cssH); }
      ctx.drawImage(img, x + pad, y + pad, w, h);
    },
    dispose() { URL.revokeObjectURL(svgUrl); },
  };
}

/* 텍스트 레이어 */
const loadedFonts = new Map(); // fontId -> family 이름
const FALLBACK_FONTS = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic","Segoe UI",system-ui,sans-serif';

async function ensureUserFont(fontId) {
  if (!fontId) return null;
  if (loadedFonts.has(fontId)) return loadedFonts.get(fontId);
  const f = await getFontDataUri(fontId);
  if (!f) return null;
  const family = 'CoPyTexUser_' + fontId;
  try {
    const face = new FontFace(family, f.data.slice(0));
    await face.load();
    document.fonts.add(face);
    loadedFonts.set(fontId, family);
    return family;
  } catch (e) { return null; }
}

/* 텍스트 셀 안의 $...$ : 허용 목록 검사를 통과한 것만 MathJax 로 그려요. (허용 목록은 inline-allowlist.js)
   하나라도 문제가 있으면 이미지를 만들지 않고 RenderError 를 던져요. */
function inlineError(err, src) {
  const where = src !== undefined ? src : err.line;
  return new RenderError(t(err.key, err.vars) + (where ? '  →  ' + (src !== undefined ? '$' + src + '$' : where) : ''));
}

async function renderInlineMath(src, fs, color) {
  await window.__mjReady;
  const MJ = window.MathJax;
  if (MJ.texReset) MJ.texReset();
  const node = await MJ.tex2svgPromise(src, { display: false }); // 내 명령어는 붙이지 않아요
  const bad = node.querySelector('[data-mml-node="merror"]');
  if (bad) throw inlineError({ key: 'inline.err.render', vars: { msg: bad.getAttribute('data-mjx-error') || 'syntax error' } }, src);

  const svg = node.querySelector('svg');
  const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number); // 1em = 1000 단위, y=0 이 기준선
  const w = (vb[2] / 1000) * fs;
  const h = (vb[3] / 1000) * fs;
  const asc = Math.max(0, (-vb[1] / 1000) * fs);
  const desc = Math.max(0, ((vb[1] + vb[3]) / 1000) * fs);
  svg.setAttribute('width', w.toFixed(3));
  svg.setAttribute('height', h.toFixed(3));
  svg.removeAttribute('style');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const str = svg.outerHTML.split('currentColor').join(color || '#000000');
  const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    return { img: await loadImage(url), url, w, h, asc, desc };
  } catch (e) { URL.revokeObjectURL(url); throw e; }
}

async function makeTextLayer(cell, settings) {
  const body = cell.code.replace(/\s+$/, '');
  const opts = cell.opts;

  // 1) 나누기 + 검사 (그리기 전에 모두 끝내요)
  const parsed = parseText(body);
  if (parsed.error) throw inlineError(parsed.error);
  const maths = [];
  for (const line of parsed.lines) for (const p of line.parts) if (p.type === 'math') maths.push(p);
  if (maths.length > LIMITS.maxSegments) throw new RenderError(t('inline.err.count', { max: LIMITS.maxSegments }));
  for (const p of maths) { const e = validateMath(p.value); if (e) throw inlineError(e, p.value); }

  // 2) 글꼴 준비
  const family = await ensureUserFont(settings.fontId);
  const fs = Math.max(8, +opts.fs || 24);
  const font = fs + 'px ' + (family ? '"' + family + '",' : '') + FALLBACK_FONTS;
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = font;
  const measure = (str) => mctx.measureText(str).width;

  // 3) 수식 조각 그리기 (글자 크기 = fs, 글자색 = 셀 글자색)
  const urls = [];
  try {
    for (const p of maths) { p.m = await renderInlineMath(p.value, fs, opts.color); urls.push(p.m.url); }
  } catch (e) { urls.forEach((u) => URL.revokeObjectURL(u)); throw e; }

  // 4) 줄 배치: 글자만 있는 줄은 예전과 같은 높이(fs*1.45)로, 수식이 있으면 가장 높은 조각에 맞춰요.
  const lhBase = Math.round(fs * 1.45);
  const layout = layoutLines(parsed.lines, {
    width: Math.max(0, +opts.width || 0), measure,
    textAsc: lhBase / 2 + fs * 0.35, textDesc: lhBase / 2 - fs * 0.35,
  });
  const pad = Math.max(0, +opts.pad || 0);
  const cssW = Math.ceil(layout.width + pad * 2);
  const cssH = Math.ceil(layout.height + pad * 2);
  return {
    cssW, cssH,
    paint(ctx, x, y) {
      if (!opts.transparent) { ctx.fillStyle = opts.bg || '#ffffff'; ctx.fillRect(x, y, cssW, cssH); }
      ctx.font = font; ctx.fillStyle = opts.color || '#000000'; ctx.textBaseline = 'alphabetic';
      let top = y + pad;
      for (const row of layout.rows) {
        const base = top + row.asc; // 줄마다 기준선이 하나 → 글자와 수식이 같은 기준선에 놓여요
        let cx = x + pad;
        for (const a of row.atoms) {
          if (a.t === 'text') ctx.fillText(a.s, cx, base);
          else if (a.t === 'math') ctx.drawImage(a.m.img, cx, base - a.m.asc, a.m.w, a.m.h);
          cx += a.w;
        }
        top += row.h;
      }
    },
    dispose() { urls.forEach((u) => URL.revokeObjectURL(u)); },
  };
}

/* ---------- 레이어 캐시 ---------- */
const layerCache = new Map(); // cell.id -> { key, promise }

export function layerKey(cell, settings) {
  return JSON.stringify([cell.type, cell.code, cell.type === 'math' ? cell.wrap : 0, cell.opts, macroSignature(settings), settings.fontId, settings.packages]);
}

export function invalidateLayer(id) {
  const old = layerCache.get(id);
  if (old) { old.promise.then((l) => l && l.dispose && l.dispose(), () => {}); layerCache.delete(id); }
}

// 같은 입력이면 다시 그리지 않고 이전 레이어를 돌려줘요. (force 이면 새로 만들어요)
export function getLayer(cell, settings, force) {
  const key = layerKey(cell, settings);
  const hit = layerCache.get(cell.id);
  if (hit && hit.key === key && !force) return hit.promise;
  invalidateLayer(cell.id);
  const promise = serial(async () => {
    if (!cell.code.trim()) return null;
    const layer = cell.type === 'math' ? await makeMathLayer(cell, settings) : await makeTextLayer(cell, settings);
    layer.key = key;
    return layer;
  });
  promise.catch(() => {});
  layerCache.set(cell.id, { key, promise });
  return promise;
}

/* ---------- 합성: 레이어들을 왼쪽 정렬로 세로로 쌓아 PNG 한 장 ---------- */
export async function composePng(layers, opt) {
  const pad = Math.max(0, +opt.pad || 0);
  const gap = Math.max(0, +opt.gap || 0);
  const W = Math.ceil(Math.max(...layers.map((l) => l.cssW)) + pad * 2);
  const H = Math.ceil(layers.reduce((s, l) => s + l.cssH, 0) + gap * (layers.length - 1) + pad * 2);

  // 해상도 제한: 너비가 5000px 를 넘으면 1x 까지 낮추고, 그래도 크면 그대로 만들되 알려줘요.
  const wanted = Math.max(1, +opt.dpr || 2);
  let dpr = wanted;
  const notices = [];
  if (W * dpr > MAX_WIDTH) {
    dpr = Math.max(1, Math.floor((MAX_WIDTH / W) * 100) / 100);
    if (dpr < wanted) notices.push({ key: 'status.dprLowered', vars: { dpr } });
    if (W > MAX_WIDTH) notices.push({ key: 'status.tooWide', vars: { w: W, max: MAX_WIDTH } });
  }
  const hard = MAX_DIM / Math.max(W, H);
  if (dpr > hard) {
    dpr = Math.floor(hard * 1000) / 1000;
    notices.push({ key: 'status.clamped', vars: { dpr: dpr.toFixed(2) } });
  }

  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(W * dpr));
  cv.height = Math.max(1, Math.round(H * dpr));
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  if (!opt.transparent) { ctx.fillStyle = opt.bg || '#ffffff'; ctx.fillRect(0, 0, W, H); }
  let y = pad;
  layers.forEach((l) => { l.paint(ctx, pad, y); y += l.cssH + gap; });

  const blob = await new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  if (!blob) throw new RenderError('PNG encoding failed');
  return {
    blob, url: opt.noUrl ? null : URL.createObjectURL(blob),
    cssW: W, cssH: H, pxW: cv.width, pxH: cv.height, dpr, notices,
  };
}
