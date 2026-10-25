// UI 문자열은 전부 locales/*.json 에 있어요. 코드에서는 t('키')로만 불러옵니다.
// 새 언어 추가: locales/xx.json 을 만들고 아래 DICTS 와 LANGS 에 한 줄씩 추가하세요.
import ko from '../locales/ko.json';
import en from '../locales/en.json';

const DICTS = { ko, en };
export const LANGS = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
];

let current = 'ko';

export function setLang(code) {
  if (DICTS[code]) current = code;
  document.documentElement.lang = current;
}
export function getLang() { return current; }

export function t(key, vars) {
  let s = (DICTS[current] && DICTS[current][key]);
  if (s === undefined) s = DICTS.en[key];
  if (s === undefined) s = key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}
