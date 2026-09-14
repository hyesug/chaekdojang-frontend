/**
 * josa.js — 조사를 받침에 맞춰 고른다
 *
 * 글을 템플릿으로 찍어내다 보면 "금이 강하고 수이 약함" 같은 것이 나온다.
 * 앞말이 변수라서 조사를 박아둘 수가 없기 때문이다. 피하려고 "은(는)"으로
 * 쓰는 방법도 있지만 읽기에 거슬린다.
 *
 * 한글 음절은 0xAC00 부터 28개씩 종성이 돌아간다. 나머지가 0이면 받침이 없다.
 * 그것만 보면 조사는 기계적으로 정해진다.
 */

/**
 * 조사가 붙을 글자를 고른다.
 *
 * '巳(사)'처럼 한자에 한글 음을 괄호로 단 표기가 많다. 사람은 이걸
 * '사'로 읽으므로 조사도 '사'에 맞춰야 한다. 닫는 괄호만 벗겨내면 된다.
 */
function tailChar(word) {
  const s = String(word ?? '').trim().replace(/[)\]}\s]+$/, '');
  return s ? s.charCodeAt(s.length - 1) : null;
}

/** 종성 번호. 0이면 받침 없음. 한글 음절이 아니면 null */
function jong(word) {
  const code = tailChar(word);
  if (code === null || code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28;
}

/** 받침 있을 때 / 없을 때 */
const PAIRS = {
  '이': ['이', '가'], '가': ['이', '가'],
  '은': ['은', '는'], '는': ['은', '는'],
  '을': ['을', '를'], '를': ['을', '를'],
  '과': ['과', '와'], '와': ['과', '와'],
  '으로': ['으로', '로'], '로': ['으로', '로'],
  '이라': ['이라', '라'], '라': ['이라', '라'],
  '이나': ['이나', '나'], '나': ['이나', '나'],
};

/**
 * 앞말에 맞는 조사를 붙여 돌려준다.
 *
 *   j('금', '이')  → '금이'
 *   j('수', '이')  → '수가'
 *   j('Mars', '이') → 'Mars이(가)'   — 한글이 아니면 판단하지 않는다
 */
export function j(word, particle) {
  const pair = PAIRS[particle];
  const w = String(word ?? '');
  if (!pair) return w + particle;

  const t = jong(w);
  if (t === null) return `${w}${pair[0]}(${pair[1]})`;

  // 'ㄹ' 받침은 '으로'가 아니라 '로'를 쓴다. 서울로, 하늘로.
  if (pair[0] === '으로' && t === 8) return `${w}로`;

  return w + (t !== 0 ? pair[0] : pair[1]);
}
