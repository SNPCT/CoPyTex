// 자동완성에 쓰는 명령어 사전. 명령어를 추가하려면 여기만 고치면 돼요.
// - SIMPLE_COMMANDS: 이름만 적으면 \이름 이 그대로 들어가요.
// - SNIPPET_COMMANDS: [이름, 템플릿, 설명]. ${1} ${2} 가 입력 칸이고 Tab 으로 이동해요.
// - ENVIRONMENTS: \begin{ 뒤에 뜨는 환경 이름 목록이에요.
import { snippetCompletion } from '@codemirror/autocomplete';

export const GREEK = new Set((
  'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega ' +
  'Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega'
).split(' '));

export const STRUCT = new Set((
  'frac dfrac tfrac cfrac sqrt sum prod int iint iiint oint lim limsup liminf binom overline underline overbrace underbrace ' +
  'vec hat bar tilde dot ddot xrightarrow xleftarrow overset underset boldsymbol operatorname boxed cancel color textcolor ' +
  'left right big Big bigg Bigg bigcup bigcap bra ket braket dv pdv'
).split(' '));

// 이 명령어의 { } 안은 '글자' 색으로 칠해요.
export const TEXT_COMMANDS = new Set('text textbf textit textrm textsf texttt mbox mathrm operatorname'.split(' '));

const SIMPLE_COMMANDS = (
  Array.from(GREEK).join(' ') + ' ' +
  'times div cdot pm mp ast star circ bullet cap cup setminus in notin ni subset supset subseteq supseteq emptyset varnothing forall exists nexists neg land lor lnot oplus otimes ' +
  'leq geq neq approx equiv sim simeq cong propto ll gg prec succ perp parallel mid ' +
  'to rightarrow leftarrow leftrightarrow Rightarrow Leftarrow Leftrightarrow mapsto longrightarrow longleftarrow Longrightarrow Longleftarrow Longleftrightarrow uparrow downarrow implies iff ' +
  'infty partial nabla hbar ell Re Im aleph prime dots cdots ldots vdots ddots angle triangle degree quad qquad ' +
  'sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh log ln exp max min det dim ker gcd deg arg Pr left right bigcup bigcap ' +
  'coprod langle rangle lfloor rfloor lceil rceil tag nonumber hline'
).split(' ');

const SNIPPET_COMMANDS = [
  ['frac', '\\frac{${1}}{${2}}'], ['dfrac', '\\dfrac{${1}}{${2}}'], ['tfrac', '\\tfrac{${1}}{${2}}'], ['cfrac', '\\cfrac{${1}}{${2}}'],
  ['sqrt', '\\sqrt{${1}}'], ['sqrt[]', '\\sqrt[${1}]{${2}}'],
  ['sum', '\\sum_{${1}}^{${2}}'], ['prod', '\\prod_{${1}}^{${2}}'], ['int', '\\int_{${1}}^{${2}}'], ['iint', '\\iint_{${1}}'], ['oint', '\\oint_{${1}}'],
  ['lim', '\\lim_{${1} \\to ${2}}'], ['limsup', '\\limsup_{${1}}'], ['liminf', '\\liminf_{${1}}'],
  ['binom', '\\binom{${1}}{${2}}'],
  ['text', '\\text{${1}}'], ['textbf', '\\textbf{${1}}'], ['textit', '\\textit{${1}}'], ['mathrm', '\\mathrm{${1}}'], ['mathbf', '\\mathbf{${1}}'],
  ['mathbb', '\\mathbb{${1}}'], ['mathcal', '\\mathcal{${1}}'], ['mathfrak', '\\mathfrak{${1}}'], ['mathit', '\\mathit{${1}}'],
  ['boldsymbol', '\\boldsymbol{${1}}'], ['operatorname', '\\operatorname{${1}}'],
  ['vec', '\\vec{${1}}'], ['hat', '\\hat{${1}}'], ['bar', '\\bar{${1}}'], ['tilde', '\\tilde{${1}}'], ['dot', '\\dot{${1}}'], ['ddot', '\\ddot{${1}}'],
  ['overline', '\\overline{${1}}'], ['underline', '\\underline{${1}}'],
  ['overbrace', '\\overbrace{${1}}^{${2}}'], ['underbrace', '\\underbrace{${1}}_{${2}}'],
  ['overset', '\\overset{${1}}{${2}}'], ['underset', '\\underset{${1}}{${2}}'],
  ['xrightarrow', '\\xrightarrow{${1}}'], ['xleftarrow', '\\xleftarrow{${1}}'],
  ['left(', '\\left( ${1} \\right)'], ['left[', '\\left[ ${1} \\right]'], ['left\\{', '\\left\\{ ${1} \\right\\}'],
  ['left|', '\\left| ${1} \\right|'], ['left\\langle', '\\left\\langle ${1} \\right\\rangle'],
  ['color', '\\color{${1}}'], ['textcolor', '\\textcolor{${1}}{${2}}'], ['boxed', '\\boxed{${1}}'], ['cancel', '\\cancel{${1}}'],
  ['ce', '\\ce{${1}}'],
  ['bra', '\\bra{${1}}'], ['ket', '\\ket{${1}}'], ['braket', '\\braket{${1}|${2}}'], ['dv', '\\dv{${1}}{${2}}'], ['pdv', '\\pdv{${1}}{${2}}'],
  ['newcommand', '\\newcommand{\\${1}}{${2}}'],
];

export const ENVIRONMENTS = [
  'aligned', 'align', 'align*', 'alignedat', 'gathered', 'gather', 'gather*', 'split', 'equation', 'equation*',
  'array', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix', 'cases', 'subarray',
];

// 설정 > 내 명령어 에서 만든 명령어 (자동완성과 색 구분에 쓰여요)
let userMacros = [];
let userMacroNames = new Set();
export function setUserMacros(list) { userMacros = list; userMacroNames = new Set(list.map((m) => m.name)); }
export function isUserMacro(name) { return userMacroNames.has(name); }
export function macroOptions() {
  return userMacros.map((m) => {
    const label = '\\' + m.name;
    if (!m.args) return { label, type: 'function', detail: 'macro', boost: 5 };
    const tpl = label + Array.from({ length: m.args }, (_, i) => '{${' + (i + 1) + '}}').join('');
    return snippetCompletion(tpl, { label, type: 'function', detail: 'macro', boost: 5 });
  });
}

const BEGIN_TEMPLATE = '\\begin{${1}}\n\t${2}\n\\end{${1}}';

export function buildCommandOptions(afterBegin) {
  const opts = [];
  // \begin{} 를 가장 먼저 보여줘요. 고르면 \end{} 까지 만들고, 환경 이름 목록이 바로 떠요.
  const begin = snippetCompletion(BEGIN_TEMPLATE, { label: '\\begin{}', type: 'keyword', detail: 'env', boost: 10 });
  const inner = begin.apply;
  begin.apply = (view, completion, from, to) => {
    inner(view, completion, from, to);
    setTimeout(() => afterBegin(view), 0);
  };
  opts.push(begin);

  const snippetNames = new Set(SNIPPET_COMMANDS.map((s) => s[0]));
  for (const [name, tpl] of SNIPPET_COMMANDS) {
    opts.push(snippetCompletion(tpl, { label: '\\' + name, type: 'function', detail: 'cmd' }));
  }
  for (const name of SIMPLE_COMMANDS) {
    if (snippetNames.has(name)) continue; // 같은 이름의 스니펫 항목이 대신해요
    opts.push({ label: '\\' + name, type: 'keyword', detail: GREEK.has(name) ? 'greek' : 'cmd' });
  }
  opts.push({
    label: '\\end{}', type: 'keyword', detail: 'env',
    apply: (view, completion, from, to) => {
      const ins = '\\end{}';
      view.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + ins.length - 1 } });
      setTimeout(() => afterBegin(view), 0);
    },
  });
  return opts;
}

export function buildEnvOptions() {
  return ENVIRONMENTS.map((e) => ({ label: e, type: 'type', detail: 'env' }));
}
