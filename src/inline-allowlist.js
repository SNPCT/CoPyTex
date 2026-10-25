// 텍스트 셀의 $...$ 안에서 쓸 수 있는 것만 모아 둔 "허용 목록"이에요.
// 여기에 없는 명령어와 글자는 모두 막혀요. (막을 것을 나열하는 방식이 아니라서 \begin, \\, \href, \newcommand 등은 자동으로 막혀요)
// 허용 범위를 넓히고 싶으면 아래 목록에 이름만 추가하세요. 고친 뒤에는 npm run build 만 하면 돼요.

const words = (s) => s.trim().split(/\s+/);

export const ALLOWED_COMMANDS = new Set([
  // 그리스 문자
  ...words(`alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi
            rho varrho sigma varsigma tau upsilon phi varphi chi psi omega
            Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega`),
  // 기호
  ...words(`times div cdot pm mp ast star circ bullet cap cup setminus in notin ni subset supset subseteq supseteq
            emptyset varnothing forall exists nexists neg land lor lnot oplus otimes
            leq geq neq approx equiv sim simeq cong propto ll gg prec succ perp parallel mid
            to rightarrow leftarrow leftrightarrow Rightarrow Leftarrow Leftrightarrow mapsto
            longrightarrow longleftarrow uparrow downarrow implies iff
            infty partial nabla hbar ell Re Im aleph prime dots cdots ldots vdots ddots angle triangle degree
            langle rangle lfloor rfloor lceil rceil quad qquad`),
  // 함수 이름과 큰 기호 (윗첨자/아랫첨자와 함께 써요)
  ...words(`sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh log ln exp max min det dim ker gcd deg arg
            lim sum prod int oint`),
  // 악센트
  ...words(`hat bar tilde vec dot ddot widehat widetilde overline underline`),
  // 곧은 글꼴, 분수, 제곱근
  ...words(`mathrm frac sqrt`),
]);

// \ 바로 뒤에 올 수 있는 한 글자: \{ \} \, \; \: \! \% \& \_ \# \$ \| \(공백)
// (\\ 는 줄바꿈이라 허용하지 않아요)
export const ALLOWED_ESCAPES = new Set(['{', '}', ',', ';', ':', '!', '%', '&', '_', '#', '$', '|', ' ']);

// 명령어 밖에서 쓸 수 있는 글자: 영문, 숫자, 공백, 그리고 아래 기호 (한글 등은 $...$ 밖에 쓰세요)
export const ALLOWED_CHARS = /^[A-Za-z0-9 \t+\-=<>()[\]|/*!',.:;^_~?]$/;

// 한 수식의 최대 길이, 중괄호 최대 깊이, 한 셀의 최대 수식 개수
export const LIMITS = { maxLength: 300, maxDepth: 6, maxSegments: 80 };
