/**
 * varga.js — 분할 차트 (바르가)
 *
 * 베딕은 한 장의 명반만 보지 않는다. 황경을 잘게 나눠 다시 세운 차트를
 * 주제마다 따로 본다. 직업은 D10, 결혼은 D9, 재물은 D2, 주거는 D4 다.
 *
 * ── 왜 core 에 있는가 ──────────────────────────────────────
 * 원래 `hires/vedic.js` 에 있었는데, 그 파일이 `systems/vedic.js` 에서
 * `RASHI` 를 가져온다. 그래서 `systems/vedic.js` 쪽에서 분할 차트를 쓰려면
 * 순환 import 가 된다. 이 함수들은 **황경 하나만 받는 순수 함수**라
 * 아무 데도 기대지 않으므로 여기로 내렸다.
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 * 파라샤라 계열의 표준 산법 하나만 쓴다. D10·D7 의 짝수 별자리 시작점,
 * D9 의 연속식 계산은 유파에 따라 다르게 적는 곳도 있다.
 *
 *   D2  호라      — 홀수 별자리 앞 15° 사자, 뒤 15° 게 / 짝수는 반대
 *   D4  차투르탐샤 — 7°30′ 씩, 자기 별자리에서 세 칸씩 순행
 *   D7  삽탐샤    — 30/7° 씩, 홀수는 자기 자리부터 짝수는 일곱 번째부터
 *   D9  나밤샤    — 3°20′ 씩, 황경을 9배 해 이어 세는 연속식
 *   D10 다샴샤    — 3° 씩, 홀수는 자기 자리부터 짝수는 아홉 번째부터
 *
 * 돌려주는 값은 전부 **0부터 세는 별자리 번호**(0 = 메샤/양자리)다.
 */

/** D9 나밤샤 — 3°20′ 마다 한 칸. 황경을 9배 해 이어 세면 표와 같아진다 */
export const navamsa = (lon) => Math.floor(lon / (30 / 9)) % 12;

/** D10 다샴샤 — 홀수 별자리는 자기 자리부터, 짝수는 아홉 번째부터 */
export function dasamsa(lon) {
  const sign = Math.floor(lon / 30);
  const part = Math.floor((lon % 30) / 3);
  const odd = sign % 2 === 0;                  // 0=메샤(양자리)=홀수 별자리
  return (sign + (odd ? 0 : 8) + part) % 12;
}

/** D2 호라 — 홀수 별자리 앞 절반은 사자(4), 뒤는 게(3). 짝수는 반대 */
export function hora(lon) {
  const sign = Math.floor(lon / 30);
  const firstHalf = (lon % 30) < 15;
  const odd = sign % 2 === 0;
  return odd ? (firstHalf ? 4 : 3) : (firstHalf ? 3 : 4);
}

/** D4 차투르탐샤 — 7°30′ 마다. 자기 별자리에서 세 칸씩 순행 */
export function chaturthamsa(lon) {
  const sign = Math.floor(lon / 30);
  const part = Math.floor((lon % 30) / 7.5);
  return (sign + part * 3) % 12;
}

/** D7 삽탐샤 — 30/7 도마다. 홀수 별자리는 자기 자리부터, 짝수는 일곱 번째부터 */
export function saptamsa(lon) {
  const sign = Math.floor(lon / 30);
  const part = Math.floor((lon % 30) / (30 / 7));
  const odd = sign % 2 === 0;
  return (sign + (odd ? 0 : 6) + part) % 12;
}

export const VARGA = {
  D1: (lon) => Math.floor(lon / 30),
  D2: hora,
  D4: chaturthamsa,
  D7: saptamsa,
  D9: navamsa,
  D10: dasamsa,
};
