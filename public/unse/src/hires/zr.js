/**
 * zr.js — 조디악 릴리징 (Zodiacal Releasing)
 *
 * 발렌스가 쓴 헬레니즘 시기법이다. 로트(포춘·스피릿)가 놓인 별자리에서
 * 출발해 별자리마다 정해진 햇수만큼 머물며 순서대로 돌아간다.
 *
 *   스피릿 기준 — 뜻·직업·명성이 어느 시기에 올라오는가
 *   포춘 기준   — 몸·물질·환경이 어느 시기에 달라지는가
 *
 * 재물을 볼 때 이 둘을 갈라 쓰는 것이 요점이다. 스피릿 쪽이 강한 구간은
 * 일로 버는 시기이고, 포춘 쪽이 강한 구간은 환경과 물질이 바뀌는 시기다.
 *
 * ── 유파 고지 ──────────────────────────────────────────────
 *   기간표    : 발렌스 표준 (양15 황소8 쌍둥이20 게25 사자19 처녀20
 *               천칭8 전갈15 사수12 염소27 물병30 물고기12). 한 바퀴 211년
 *   1단계     : 해 단위. 2단계 : 같은 숫자를 달 단위로
 *   한 해 길이 : 365.2425일. 한 달 = 그 1/12. 360일 년을 쓰는 방식과 다르다
 *   끈 풀림   : 한 단계가 열두 별자리를 다 돌고도 시간이 남으면, 같은
 *               자리로 되돌아가지 않고 **출발 별자리의 맞은편**으로 건너뛴다
 *   정점 구간 : 기준 로트에서 앵귤러(1·4·7·10번째)인 별자리에 든 구간
 *
 * **이 기법은 2단계까지만 쓴다.** 3단계(일 단위) 아래는 구현마다 값이
 * 갈리고 검증할 길이 마땅치 않아 만들지 않는다 — 없는 정밀도를 만들지 않는다.
 */

import { SIGNS } from '../systems/astrology.js';

/** 발렌스 기간표 (해). 별자리 순서대로 */
export const ZR_YEARS = [15, 8, 20, 25, 19, 20, 8, 15, 12, 27, 30, 12];
/** 한 바퀴 */
export const ZR_CIRCUIT = ZR_YEARS.reduce((a, b) => a + b, 0);   // 211

const mod12 = (n) => ((n % 12) + 12) % 12;

/**
 * 1단계 — 로트가 놓인 별자리에서 출발해 순서대로.
 *
 * @param {number} startSign 기준 로트의 별자리
 * @param {number} maxAge    몇 살까지 만들 것인가
 */
export function level1(startSign, maxAge = 100) {
  const out = [];
  let sign = mod12(startSign);
  let age = 0;
  let circuit = 1;
  while (age < maxAge) {
    const years = ZR_YEARS[sign];
    out.push({
      level: 1, sign, signName: SIGNS[sign].name,
      fromAge: Math.round(age * 100) / 100,
      toAge: Math.round((age + years) * 100) / 100,
      years, circuit,
    });
    age += years;
    sign = mod12(sign + 1);
    if (sign === mod12(startSign)) circuit += 1;
  }
  return out;
}

/**
 * 2단계 — 그 1단계 구간 안을 다시 나눈다. 같은 숫자를 달로 센다.
 *
 * 열두 별자리를 다 돌고도 부모 구간이 안 끝나면 **끈이 풀린다**.
 * 그때는 출발 별자리로 되돌아가지 않고 그 맞은편에서 다시 시작한다.
 */
export function level2(parent) {
  const out = [];
  const startSign = parent.sign;
  let sign = startSign;
  let age = parent.fromAge;
  let stepped = 0;
  let loosed = false;

  while (age < parent.toAge - 1e-9) {
    const months = ZR_YEARS[sign];
    const years = months / 12;
    const to = Math.min(age + years, parent.toAge);
    out.push({
      level: 2, sign, signName: SIGNS[sign].name,
      fromAge: Math.round(age * 100) / 100,
      toAge: Math.round(to * 100) / 100,
      months,
      // 부모 구간이 먼저 끝나면 잘린다
      truncated: to < age + years - 1e-9,
      loosingOfTheBond: loosed && stepped === 12,
    });
    age = to;
    stepped += 1;
    if (stepped === 12) {
      // 한 바퀴를 다 돌았다 — 끈을 푼다
      sign = mod12(startSign + 6);
      loosed = true;
      stepped = 0;
    } else {
      sign = mod12(sign + 1);
    }
  }
  return out;
}

/**
 * 조디악 릴리징 한 벌.
 *
 * @param {number} lotSign 기준 로트의 별자리 (스피릿 또는 포춘)
 * @param {string} label   '스피릿' 또는 '포춘'
 * @param {number} maxAge
 */
export function releasing(lotSign, label, maxAge = 100) {
  const l1 = level1(lotSign, maxAge);
  // 기준 로트에서 앵귤러인 별자리가 그 사람 인생의 정점 구간이 된다
  const angularSigns = [0, 3, 6, 9].map((k) => mod12(lotSign + k));
  const mark = (p) => ({
    ...p,
    angular: angularSigns.includes(p.sign),
    fromLot: mod12(p.sign - lotSign) + 1,
  });

  return {
    label, lotSign, lotSignName: SIGNS[lotSign].name,
    angularSigns: angularSigns.map((s) => SIGNS[s].name),
    periods: l1.map((p) => ({ ...mark(p), sub: level2(p).map(mark) })),
  };
}

/** 그 나이에 걸린 1·2단계 구간 */
export function atAge(rel, age) {
  const p1 = rel.periods.find((p) => age >= p.fromAge && age < p.toAge) ?? null;
  const p2 = p1 ? p1.sub.find((p) => age >= p.fromAge && age < p.toAge) ?? null : null;
  return { l1: p1, l2: p2 };
}

/**
 * 어느 해가 두드러지는가 — 정점 구간과 끈 풀림만 추린다.
 * 구간을 전부 실으면 백 살까지 수십 줄이 되어 정작 중요한 자리가 묻힌다.
 */
export function highlights(rel, birthYear, fromYear, toYear) {
  const out = [];
  const toY = (age) => birthYear + age;

  for (const p of rel.periods) {
    const y0 = toY(p.fromAge), y1 = toY(p.toAge);
    if (y1 < fromYear || y0 > toYear) continue;
    if (p.angular) {
      out.push({ kind: '1단계 정점', signName: p.signName,
        fromYear: Math.round(y0), toYear: Math.round(y1),
        note: `${p.signName} 구간 — 기준 로트에서 ${p.fromLot}번째(앵귤러)` });
    }
    for (const s of p.sub) {
      const sy0 = toY(s.fromAge), sy1 = toY(s.toAge);
      if (sy1 < fromYear || sy0 > toYear) continue;
      if (s.angular) {
        out.push({ kind: '2단계 정점', signName: s.signName,
          fromYear: Math.round(sy0 * 10) / 10, toYear: Math.round(sy1 * 10) / 10,
          note: `${p.signName} 안의 ${s.signName} — 앵귤러` });
      }
      if (s.loosingOfTheBond) {
        out.push({ kind: '끈 풀림', signName: s.signName,
          fromYear: Math.round(sy0 * 10) / 10, toYear: Math.round(sy1 * 10) / 10,
          note: '열두 자리를 다 돌고 맞은편으로 건너뛰는 자리 — 전통적으로 국면이 바뀌는 때로 본다' });
      }
    }
  }
  return out.sort((a, b) => a.fromYear - b.fromYear);
}

/** 프롬프트용 */
export function formatZR(rel, birthYear, fromYear, toYear) {
  const out = [`${rel.label} 기준 조디악 릴리징 — 출발 ${rel.lotSignName}, 앵귤러 ${rel.angularSigns.join('·')}`];
  const cur = rel.periods.filter((p) =>
    birthYear + p.toAge >= fromYear && birthYear + p.fromAge <= toYear);
  for (const p of cur) {
    out.push(`  1단계 ${p.signName} ${Math.round(birthYear + p.fromAge)}~${Math.round(birthYear + p.toAge)}년` +
      `${p.angular ? ' ※정점' : ''}`);
    for (const s of p.sub) {
      const y0 = birthYear + s.fromAge, y1 = birthYear + s.toAge;
      if (y1 < fromYear || y0 > toYear) continue;
      out.push(`    2단계 ${s.signName} ${y0.toFixed(1)}~${y1.toFixed(1)}년` +
        `${s.angular ? ' ※정점' : ''}${s.loosingOfTheBond ? ' ※끈 풀림' : ''}`);
    }
  }
  return out.join('\n');
}
