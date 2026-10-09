/**
 * distinct.js — **그 사람에게만 있는 것**을 고른다
 *
 * 생년월일시가 다르면 명반은 수만 가지로 갈리는데, 리포트가 몇 가지 유형표로 문장을
 * 꺼내 쓰면 결과지가 서로 비슷해진다. 여기서는 열일곱 체계의 풀이 가운데 **사람들 사이에서
 * 드물게 나오는 항목**을 찾아 앞에 세운다. 드문 정도는 무작위 2천 명으로 미리 잰 표
 * (data/rarity.js, scripts/build-rarity.mjs)를 쓴다.
 */
import { RARITY, DEFINITIONS } from './data/rarity.js';

/** 해마다·나이마다 바뀌는 항목 — 드문 정도를 잴 수 없고, 평생 특징도 아니다 */
const VOLATILE = /^(상황|과제|조언) — |\d{4}년|올해|지금|다가올|대운|다샤|세운|개인년|달별|이 계산|이 풀이|이 배열|괘사에|판 전체|구궁 전체|천지반|천반과 지반|보태면|색을 쓰는|올해의|마무리|읽는 법/;

/**
 * 손님에게 뜻을 풀어 줄 수 없는 항목 — 점시의 구도(육임 사과·삼전·천장)나 방위 배치는
 * 그 자체로는 "그래서 어떻다는 것"이 없어 특징으로 내세우지 않는다.
 */
const NOT_A_TRAIT = /^(사과|삼전|초전의 천장|말전의 천장|내 자리|구궁|천충|동효|괘의 구조|지괘|삼방사정|사화가 떨어진|살성이)/;

/** 체계 이름 + 풀이 제목 → 표의 열쇠. 바뀌는 항목이면 null */
export function rarityKey(system, title) {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim();
  if (!t || VOLATILE.test(t)) return null;
  return `${system}|${t}`;
}

/** 풀이 제목 → [자리, 값]. "달 — 게자리" 는 자리 '달', 값 '게자리' */
export function slotOf(system, title) {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim();
  const i = t.indexOf(' — ');
  if (i > 0) return [`${system}|${t.slice(0, i)}`, t.slice(i + 3)];
  // "생일수 22"·"본명성 칠적금성" 처럼 대시 없이 값이 붙은 제목
  const m = t.match(/^(\S+)\s+(.+)$/);
  return m ? [`${system}|${m[1]}`, m[2]] : [`${system}|${t}`, t];
}

/** 풀이 글 → 문장들 (강조 표시를 걷고 문장으로 자른다) */
export function sentenceKeys(text) {
  return String(text ?? '').replace(/\*\*/g, '').split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 8);
}

/**
 * 앞머리의 **자리 정의**(같은 자리의 어느 값에나 붙는 문장)만 걷어 낸다.
 * "달 — 게자리" 의 "아무도 안 볼 때의 모습…" 은 정의라 빼고, 그 뒤 게자리의 뜻은 남긴다.
 * 중간에 나오는 공통 문장(배치의 뜻 풀이)은 그 사람에게 필요한 설명이라 남긴다.
 */
export function ownSentences(text) {
  const xs = sentenceKeys(text);
  let i = 0;
  while (i < xs.length && DEFINITIONS?.has(xs[i])) i++;
  return xs.slice(i);
}

/**
 * 그 사람의 풀이를 드문 순으로.
 *
 * @param {object} r `readFortune` 결과
 * @param {object} opts
 *   max        몇 개까지 (기본 6)
 *   perSystem  한 체계에서 몇 개까지 (기본 1 — 한 체계가 앞자리를 다 차지하지 않게)
 *   below      이 비율보다 흔하면 빼기 (기본 0.25 — 넷 중 하나 이상에게 나오면 특징이 아니다)
 * @returns {Array<{system, title, text, share}>}
 */
export function distinctReadings(r, { max = 6, perSystem = 1, below = 0.25 } = {}) {
  const rows = [];
  for (const s of r.results ?? []) {
    for (const x of s.readings ?? []) {
      if (NOT_A_TRAIT.test(String(x.title ?? ''))) continue;
      const k = rarityKey(s.name, x.title);
      const share = k ? RARITY[k] : undefined;
      if (share == null || share > below || !x.text) continue;
      // 정의를 걷고 나서 두 문장 이상 남아야 "그래서 어떻다는 것"까지 말할 수 있다
      if (ownSentences(x.text).length < 2) continue;
      rows.push({ system: s.name, title: x.title, text: x.text, share });
    }
  }
  rows.sort((a, b) => a.share - b.share);
  const used = {};
  const out = [];
  for (const row of rows) {
    if ((used[row.system] ?? 0) >= perSystem) continue;
    used[row.system] = (used[row.system] ?? 0) + 1;
    out.push(row);
    if (out.length >= max) break;
  }
  return out;
}
