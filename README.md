# CoPyTex

LaTeX 수식과 메모를 쓰면 PNG 이미지로 바로 만들어 줘요. 이미지를 PDF 등으로 끌어다 놓거나 "이미지 복사"로 붙여넣을 수 있어요.
MathJax(SVG) → 캔버스 → PNG 로 변환하고, 에디터는 CodeMirror 6 입니다.

Author: hjang, Claude

## 실행

**그냥 쓰기 (빌드 불필요):** `docs/` 폴더에 빌드 결과가 들어 있어요.
- VS Code: Live Server 확장으로 `docs/index.html` 열기 (또는 `docs/` 에서 `npx http-server -p 5173`)
- GitHub Pages: 저장소 Settings → Pages → Branch `main` / Folder `/docs`

**코드를 고칠 때:**
```bash
npm install
npm run watch     # 저장할 때마다 docs/ 자동 빌드 (브라우저는 직접 새로고침)
npm run build     # 배포용(압축) 빌드
```
MathJax 는 CDN(jsdelivr)에서 불러오므로 인터넷 연결이 필요해요.

## 사용법 요약
- **셀:** 수식 셀(`$$ \begin{aligned} … \end{aligned} $$`)과 텍스트 셀. 제목줄의 `›`/`⌄` 로 접고 펴요.
- **이름 바꾸기:** 제목 글자를 더블클릭 (또는 연필 아이콘).
- **순서 바꾸기:** 제목줄을 잡고 끌기, 또는 ▲▼ 버튼.
- **aligned ↔ gathered:** 위아래의 `aligned` 글자를 누르면 바뀌어요. `&` 가 하나도 없으면 줄마다 왼쪽 정렬로 자동 처리돼요. 본문이 이미 `\begin{…}…\end{…}` 하나이면 감싸지 않아요.
- **묶음 이미지:** 셀 사이의 `묶기` 로 위아래 셀을 하나의 이미지로 묶어요. 오른쪽 `}` 옆에 묶음 이미지가 맨 위에 붙어서 따라와요. 글자는 왼쪽 정렬로 쌓이고, 너비는 가장 넓은 항목에 맞춰요.
  - 해상도·항목 간격·바깥 여백·배경은 묶음의 "이미지 옵션"에서 정해요.
  - 너비가 5000px 를 넘으면 해상도를 1x 까지 자동으로 낮춰요. 그래도 넘으면 그대로 만들고 안내해요. (브라우저 한계 16000px)
  - 헤더의 복사 버튼은 "이 셀만", 묶음 패널의 복사 버튼은 "묶음 전체"예요.
- **텍스트 셀:** 수식과 같은 글자 옵션(글자색/배경/여백/크기)에 줄바꿈 너비가 더 있어요. "묶음 이미지에 포함"을 끄면 메모로만 남아요.
- **텍스트 셀의 `$...$` 수식:** `$...$` 안은 TeX 수식으로 그려져요. 글자 $ 는 `\$` 로 써요. (자세한 규칙은 아래 "텍스트 셀의 인라인 수식")
- **내 명령어:** 설정 > 내 명령어 표에서 `명령어 / 인자 수 / 정의 / 미리보기`. 기존 명령어와 겹치면 쓸 수 없다고 표시하고 적용하지 않아요. 만든 명령어는 자동완성과 색 구분에도 나와요.

## 텍스트 셀의 인라인 수식
텍스트 셀에서 `$...$` 로 감싼 부분만 TeX 수식이에요. 예: `분산 $\bar{\sigma} = \langle\sigma^2\rangle$ 와 $H_{11}$`

**쓸 수 있는 것 (허용 목록):** 그리스 문자, 기호(`\times \pm \leq \infty \partial \langle \rangle` 등), 윗첨자 `^` 와 아랫첨자 `_`, 괄호, 악센트(`\hat \bar \tilde \vec \dot \ddot`), `\mathrm`, `\frac`, `\sqrt`, 함수 이름(`\sin \log \lim` 등), `\sum \prod \int`.

**막히는 것:** 허용 목록에 없는 모든 명령어(`\begin`, `\text`, `\href`, `\newcommand`, 내 명령어 등)와 줄바꿈 `\\`, 영문·숫자·기본 기호 밖의 글자(한글 포함 → 한글은 `$...$` 밖에 쓰세요), 짝이 안 맞는 `$`·`{}`, 빈 수식 `$$`, 한 수식 300글자 초과.

**하나라도 막히면 그 셀(과 그 셀이 속한 묶음)의 이미지는 만들지 않아요.** 셀 아래와 묶음 패널에 이유와 문제의 수식이 표시되고, 이전 이미지는 흐리게 남아요. 고치면 바로 다시 만들어져요.

- 수식은 한 줄 안에서만 쓸 수 있어요. (줄을 넘기는 `$...$` 는 오류예요)
- 글자 크기와 글자색은 텍스트 셀 옵션을 그대로 따라가요.
- "묶음 이미지에 포함"을 끈 텍스트 셀은 검사하지 않아요.
- 허용 범위를 넓히려면 `src/inline-allowlist.js` 의 목록에 이름을 추가하고 `npm run build` 하면 돼요.

## 단축키
- `Ctrl/⌘ + Enter`: 지금 셀 다시 렌더링
- `Shift + Enter`: 다음 셀로 이동 (마지막 셀이면 새 수식 셀 추가)
- `Tab`: 추천 확정 → 다음 `{}` 칸으로 이동 → 들여쓰기 (`Shift+Tab` 은 이전 칸)

## 어디를 고치면 되나요

| 하고 싶은 것 | 고칠 곳 |
|---|---|
| 자동완성 명령어/환경 추가 | `src/commands.js` (SIMPLE_COMMANDS, SNIPPET_COMMANDS, ENVIRONMENTS) |
| 코드 색 구분 규칙 | `src/latex-lang.js` 의 `tokenizer`, 분류 목록은 `src/commands.js` 의 GREEK / STRUCT / TEXT_COMMANDS |
| 코드 색 기본값 | `src/storage.js` 의 `DEFAULT_SYN` (사용자는 설정 > 테마에서 변경) |
| 셀/묶음 이미지 옵션 기본값 | `src/storage.js` 의 `DEFAULT_OPTS`, `DEFAULT_TEXT_OPTS`, `DEFAULT_GROUP` |
| aligned/gathered 감싸기, 자동 왼쪽 정렬 규칙 | `src/render.js` 의 `buildMathSource`, `autoLeftAlign`, `isSingleEnvironment` |
| 해상도 제한(5000px / 16000px) | `src/render.js` 맨 위 `MAX_WIDTH`, `MAX_DIM` 과 `composePng` |
| 묶음 이미지 합치는 방식(정렬, 간격) | `src/render.js` 의 `composePng` |
| 텍스트를 이미지로 그리는 방식(줄 간격, 글꼴, 글자+수식 기준선) | `src/render.js` 의 `makeTextLayer` |
| 텍스트 셀 `$...$` 에서 허용할 명령어/글자/길이 제한 | `src/inline-allowlist.js` |
| `$...$` 나누기 규칙(`\$`, 짝 검사), 검사, 줄 배치 | `src/inline-math.js` (`parseLine`, `validateMath`, `layoutLines`) |
| `$...$` 오류 문구 | `locales/*.json` 의 `inline.err.*` |
| 수식 이미지 생성(크기 계산, 글꼴 삽입) | `src/render.js` 의 `makeMathLayer` |
| 내 명령어 검사/충돌 판정/미리보기 | `src/macros.js` |
| 사용할 수 있는 TeX 패키지 목록 | `src/settings.js` 의 `PACKAGE_LIST` + `locales/*.json` 의 `settings.pkg.이름` |
| 처음 켜질 때 패키지 | `src/storage.js` 의 `DEFAULT_SETTINGS.packages` 와 `index.html` 안의 `packages` 배열 (둘이 같아야 해요) |
| 에디터 동작(단축키, 괄호 닫기, 자동완성, `\begin`↔`\end` 동기화) | `src/editor.js` |
| 셀 머리글/이름 바꾸기/접기/aligned 칩 | `src/cell.js` |
| 묶음 화면(오른쪽 패널, `}` 모양, 복사, 미리보기) | `src/group.js` |
| 드래그로 순서 바꾸기 | `src/dnd.js` |
| 셀 추가·이동·복제·묶기/풀기·저장 | `src/main.js` (`actions`, `link`, `unlink`, `regroupMoved`) |
| 설정 창 항목 | `src/settings.js` (탭마다 `panelXxx` 함수) |
| 저장하는 데이터 종류, 백업 형식, 예전 데이터 이전 | `src/storage.js` |
| 화면 색, 간격, 글꼴 | `src/style.css` 맨 위 변수 |
| 화면에 보이는 글 | `locales/ko.json`, `locales/en.json` |
| MathJax 버전/설정 | `index.html` 안의 `<script>` |

`index.html` 이나 `src/style.css` 를 고친 뒤에는 `npm run build`(또는 watch)가 `docs/` 로 복사해 줘요.

## 번역 추가 (Crowdin 등)
화면 글은 전부 `locales/*.json` 의 `키: 문장` 형태예요. 기준 언어는 `ko.json` 이고, `crowdin.yml` 이 이미 들어 있어요.
새 언어를 추가하려면 `locales/xx.json` 을 만들고 `src/i18n.js` 의 `DICTS`, `LANGS` 에 한 줄씩 넣으면 돼요.
(키가 없는 문장은 영어로, 영어에도 없으면 키 이름이 그대로 보여요.)

## 저장되는 것
- 브라우저(localStorage): 노트(코드, 이름, 접힘, 셀별 옵션, 묶음 구성과 묶음 옵션), 설정(언어, 모드, 코드 색, 내 명령어, 패키지, 에디터 글자 크기, 기본 옵션)
- 브라우저(IndexedDB): 업로드한 글꼴 파일
- 주소(origin)마다 따로 저장돼요. `localhost` 와 `github.io` 는 서로 다른 저장소이니 설정 > 백업의 JSON 으로 옮기세요.
- 예전 이름("LaTeX 수식 노트북")으로 저장된 데이터는 처음 열 때 자동으로 이어받아요.

## 알아둘 점
- 패키지를 바꾸면 페이지를 다시 불러와야 적용돼요. (MathJax 는 시작할 때만 패키지를 읽어요)
- 내 명령어는 이미 불러온 정의가 새로고침 전까지 남을 수 있어요.
- `\text{한글}` 처럼 MathJax 글꼴에 없는 글자는 수식 이미지 안에서 시스템 글꼴로 그려져요. 특정 글꼴을 쓰려면 설정 > 글꼴에 파일을 올리세요. 용량이 큰 글꼴(수 MB)은 렌더링이 몇 초 느려지니 작은 woff2 를 권해요.
- 묶음 가운데에서 꺼낸 셀이 묶음의 맨 끝에 놓이면 계속 묶음에 속해요. 완전히 떼려면 `묶음 풀기`를 쓰세요.
- 텍스트 셀에 글자 `$` 를 쓰려면 `\$` 로 써야 해요. (`$` 하나만 쓰면 짝이 안 맞는다는 오류가 나요)
