/**
 * dict.js — **17체계 해석 사전**을 불러오고, 한 사람의 명반에서 사전의 항목을 고른다
 *
 * 사전 본문(public/unse/dict/*.json)은 체계마다 그 사람의 특징(일간×태어난 달, 일주, 명궁 별,
 * 태양·달·상승, 27수, 괘, 수, 카드, 요일 행성 …) 하나에 대해 생활 언어로 쓴 다섯 칸이다.
 *   p 성격 · w 일할 때 · m 돈 · r 관계 · c 조심할 점
 * 한 사람은 20개 안팎의 항목을 받고, 그 조합이 사람마다 거의 다 다르다.
 *
 * 사전은 크기 때문에 번들에 넣지 않고 리포트를 그리기 직전에 한 번 불러온다(loadDicts).
 */
import { STEMS_KR, BRANCHES_KR } from '../core/ganzhi.js';
import { buildBoard } from '../hires/ziwei.js';
import { planetPositions, toSidereal } from '../core/planets.js';
import { SIGNS } from '../systems/astrology.js';
import { chart as vedicChart } from '../hires/vedicExt.js';
import { nakshatraOf } from '../systems/sukyo.js';
import { starOfYear, getsumeiOf } from '../systems/gujeong.js';
import { HEXAGRAM_TABLE } from '../systems/juyeok.js';
import { modFrom1 } from '../systems/_base.js';
import { DICT_SHARE } from './data/rarity.js';

export const DICT_FILES = [
  'saju-stem-month-1', 'saju-stem-month-2', 'saju-stem-month-3', 'saju-stem-month-4',
  'saju-ilju-1', 'saju-ilju-2', 'ziwei-ming', 'western', 'vedic', 'mansion',
  'gujeong', 'juyeok', 'kabbalah', 'tarot', 'weekday', 'boards',
  'daeun-stem', 'daeun-branch-1', 'daeun-branch-2',
];
/** 파일 → 사전 묶음 이름 */
const GROUP = (file) => file.replace(/-\d+$/, '');

let DICT = null;

/** 사전을 한 번만 불러온다. 브라우저는 fetch, 노드(테스트·스크립트)는 파일에서 읽는다 */
export async function loadDicts() {
  if (DICT) return DICT;
  const out = {};
  if (typeof window === 'undefined') {
    // 모듈 이름을 변수로 둬서 브라우저 번들러가 노드 모듈을 끌어들이지 않게 한다
    const nodeFs = 'node:fs', nodeUrl = 'node:url';
    const { readFileSync } = await import(nodeFs);
    const { fileURLToPath } = await import(nodeUrl);
    for (const f of DICT_FILES) {
      const path = fileURLToPath(new URL(`../../dict/${f}.json`, import.meta.url));
      Object.assign(out[GROUP(f)] ??= {}, JSON.parse(readFileSync(path, 'utf8')));
    }
  } else {
    const all = await Promise.all(DICT_FILES.map((f) => fetch(`dict/${f}.json`).then((res) => (res.ok ? res.json() : {})).catch(() => ({}))));
    DICT_FILES.forEach((f, i) => Object.assign(out[GROUP(f)] ??= {}, all[i]));
  }
  DICT = out;
  return DICT;
}

/** 이미 불러온 사전 (없으면 null — 리포트는 사전 없이도 그려진다) */
export const dictLoaded = () => DICT;

const MAIN = ['자미', '천기', '태양', '무곡', '천동', '염정', '천부', '태음', '탐랑', '거문', '천상', '천량', '칠살', '파군'];
const PALACE_KR = { 乾: '건', 離: '리', 艮: '간', 震: '진', 巽: '손', 坤: '곤', 兌: '태', 坎: '감' };
const titleOf = (r, sys, re) => (r.results ?? []).find((s) => s.name === sys)?.readings?.find((x) => re.test(String(x.title)))?.title ?? '';

/**
 * 그 사람의 사전 열쇠들 — [묶음, 열쇠, 화면에 쓸 이름]
 * 열쇠를 계산하지 못하는 체계(출생 시각 없음 등)는 빠진다.
 */
export function dictKeys(r) {
  const { input, chart } = r;
  const keys = [];
  const add = (group, key, label) => { if (key != null && key !== '') keys.push([group, String(key), label]); };
  const safe = (fn) => { try { fn(); } catch { /* 그 체계만 빠진다 */ } };

  safe(() => add('saju-stem-month', `${STEMS_KR[chart.dayStem]}-${BRANCHES_KR[chart.pillars.month.branch]}`, '사주'));
  safe(() => add('saju-ilju', chart.pillars.day.kr, '사주 일주'));
  safe(() => {
    if (!input.timeKnown) return;
    const b = buildBoard(input);
    add('ziwei-ming', MAIN.filter((s) => b.board[b.myeong].includes(s)).join('·') || '공궁', '자미두수');
  });
  safe(() => {
    const pos = planetPositions(input.jdUT);
    add('western', `태양|${SIGNS[Math.floor(pos.태양.lon / 30) % 12].name}`, '서양 점성(태양)');
    add('western', `달|${SIGNS[Math.floor(pos.달.lon / 30) % 12].name}`, '서양 점성(달)');
    add('vedic', `달|${Math.floor(toSidereal(pos.달.lon, input.jdUT) / 30) % 12}`, '베딕(달)');
  });
  safe(() => {
    if (!input.timeKnown) return;
    const asc = titleOf(r, '점성술', /^상승점 — /).replace(/^상승점 — /, '');
    if (asc) add('western', `상승|${asc}`, '서양 점성(상승)');
    const d1 = vedicChart(input, 'D1');
    if (d1?.lagna != null) add('vedic', `라그나|${d1.lagna}`, '베딕(라그나)');
  });
  safe(() => add('mansion', nakshatraOf(input.jdUT).index, '숙요'));
  safe(() => {
    const hon = starOfYear(chart.sajuYear);
    add('gujeong', `본명|${hon}`, '구성학');
    add('gujeong', `월명|${getsumeiOf(hon, chart.sector?.index ?? 0)}`, '구성학(달)');
  });
  safe(() => {
    const base = input.yearBranch + 1 + input.lunar.month + input.lunar.day;
    const up = modFrom1(base, 8) - 1;
    const lo = modFrom1(base + (input.timeKnown ? input.hourBranch + 1 : 1), 8) - 1;
    add('juyeok', HEXAGRAM_TABLE[up][lo], '주역');
  });
  safe(() => {
    const lp = titleOf(r, '카발라', /라이프 패스/).match(/라이프 패스 (\d+)/)?.[1];
    add('kabbalah', lp ? `인생|${lp}` : null, '카발라');
    add('kabbalah', `생일|${input.day}`, '카발라(생일)');
  });
  safe(() => {
    let s = input.month + input.day + input.year;
    while (s > 22) s = String(s).split('').reduce((a, c) => a + Number(c), 0);
    add('tarot', s === 22 ? 0 : s, '타로');
  });
  safe(() => {
    const planet = titleOf(r, '마하보테', /^내 행성은/).match(/내 행성은 (\S+)/)?.[1];
    add('weekday', planet ? `행성|${planet}` : null, '태어난 요일');
    const house = titleOf(r, '마하보테', / — .*자리$/).split(' ')[0];
    add('weekday', house ? `자리|${house}` : null, '마하보테');
  });
  safe(() => {
    const gen = titleOf(r, '육임', /^초전의 천장 — /).replace(/^초전의 천장 — /, '');
    add('boards', gen && gen !== '없음' ? `천장|${gen}` : null, '육임');
    const gate = titleOf(r, '홍국기문', /문 \(/).split(' ')[0];
    add('boards', gate ? `문|${gate}` : null, '홍국기문');
    const hanja = titleOf(r, '태을신수', /^태을이 .궁에 있습니다/).match(/^태을이 (.)궁/)?.[1];
    add('boards', PALACE_KR[hanja] ? `궁|${PALACE_KR[hanja]}` : null, '태을신수');
  });
  return keys;
}

/**
 * 그 사람의 사전 항목들 — 드문 것부터.
 * share 는 무작위 2천 명에서 그 열쇠가 나온 비율(data/rarity.js). 없으면 중간값으로 둔다.
 * @returns {Array<{group, key, label, entry, share}>}
 */
export function dictEntries(r) {
  if (!DICT) return [];
  return dictKeys(r)
    .map(([group, key, label]) => ({ group, key, label, entry: DICT[group]?.[key] ?? null, share: DICT_SHARE?.[`${group}|${key}`] ?? 0.1 }))
    .filter((x) => x.entry)
    .sort((a, b) => a.share - b.share);
}

/**
 * 한 칸(성격·일·돈·관계·조심)을 여러 체계에서 모은다 — 드문 것부터, 같은 문장은 한 번만.
 * @param {'p'|'w'|'m'|'r'|'c'} field
 */
export function dictField(entries, field, max = 4) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const t = e.entry[field];
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push({ text: t, label: e.label, share: e.share });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 10년 운(대운) 한 칸의 해석 — 전통대로 천간은 앞 다섯 해, 지지는 뒤 다섯 해를 맡는다.
 * 일간 × 대운 천간(100) · 일간 × 대운 지지(120) 사전에서 고른다.
 * @returns {{front: {h,g,c}|null, back: {h,g,c}|null}}
 */
export function daeunEntry(dayStem, stem, branch) {
  if (!DICT) return { front: null, back: null };
  const me = STEMS_KR[dayStem];
  return {
    front: DICT['daeun-stem']?.[`${me}|${STEMS_KR[stem]}`] ?? null,
    back: DICT['daeun-branch']?.[`${me}|${BRANCHES_KR[branch]}`] ?? null,
  };
}
