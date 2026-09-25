/**
 * baserate.js — 명반을 보기 전에 이미 알고 있는 것
 *
 * 이 파일은 점술이 아니다. **통계청 공표값**이다.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────
 * 실제 사례를 열한 번 예측해 한 번 맞혔는데, 빗나간 것 대부분이 **명반보다
 * 인구통계가 잘 맞히는 문제**였다.
 *
 *   "대전에 언제 왔나"      — 커리어를 바꾼 스물아홉 살이면 이사가 따라온다
 *   "해외여행 몇 번 갔나"    — 예순 살 한국 남자는 환갑에 한 번 간다
 *   "결혼 언제 하나"        — 여자 30대 초반이 가장 높다. 명반과 무관하게
 *
 * 그런데 엔진에는 그 기준선이 **아예 없었다.** 그래서 "이 달이 상위 5%"가
 * 무슨 뜻인지 가늠할 자가 없었다. 그 나이에 그 사건이 한 해 5% 확률이면
 * 한 달은 0.4% 다. 상위 5% 인 달도 여전히 거의 일어나지 않는다.
 *
 * ── 이 층이 지키는 선 ──────────────────────────────────────
 *   1. **숫자를 지어내지 않는다.** 모든 값에 출처를 붙였다. 출처를 못 단
 *      분야는 비워 두고 비었다고 말한다(`unknown`).
 *   2. **점수에 넣지 않는다.** 이것은 `[F] 기저율`이라는 별도의 근거 종류다.
 *      명반 점수에 섞으면 무엇이 통계이고 무엇이 점술인지 가릴 수 없게 된다.
 *      환갑을 계산 사실로만 실은 것과 같은 이유다.
 *   3. **한국 기준이다.** 다른 나라 사람에게 대면 안 된다.
 *
 * ── 채워지지 않은 자리 ──────────────────────────────────────
 * 직업(연령별 이직률) · 재물 · 건강 · 학업 · 주거는 공표값을 찾지 못해
 * 비어 있다. 찾으면 아래 표에 출처와 함께 넣으면 된다. **찾기 전에
 * 그럴듯한 숫자를 넣지 말 것.**
 */

/** 출처 — 숫자를 고칠 때 여기도 같이 고친다 */
export const SOURCES = {
  marriage: '국가데이터처 「2024년 혼인·이혼 통계」 (2025-03 공표)',
  birth: '통계청 「2024년 인구동향조사 출생·사망통계(잠정)」 (2025-02 공표)',
  move: '통계청 「2024년 국내인구이동통계 결과」 (2025-01 공표)',
};

/**
 * 연령별 혼인율 — 해당 연령 인구 **1천 명당** 건수 (2024).
 *
 * 공표 자료에 20대 초반과 40대 이상은 수치가 없어 비워 두었다.
 * 없는 칸을 눈대중으로 채우면 이 파일의 존재 이유가 사라진다.
 */
const MARRIAGE_RATE = {
  male:   { 25: 22.8, 30: 48.3, 35: 26.7 },
  female: { 25: 40.3, 30: 51.9, 35: 19.2 },
};

/** 평균 초혼연령 (2024) */
export const FIRST_MARRIAGE_AGE = { male: 33.9, female: 31.6 };

/**
 * 모의 연령별 출산율 — 해당 연령 여성 **1천 명당** 출생아 수 (2024).
 * 남성 기준 통계는 공표되지 않는다.
 */
const BIRTH_RATE = { 25: 20.7, 30: 70.4, 35: 46.0 };

/** 평균 출산연령 (2024) */
export const BIRTH_AGE = { all: 33.7, first: 33.1, second: 34.4, third: 35.5 };

/**
 * 연령별 국내 인구이동률 — 해당 연령 인구 대비 **%** (2024).
 * 공표 자료가 10세 단위라 그대로 10세 단위로 둔다.
 */
const MOVE_RATE = { 20: 23.9, 30: 21.0 };
export const MOVE_RATE_ALL = 12.3;

/** 다섯 살 단위로 내림 (25·30·35 …) */
const band5 = (age) => Math.floor(age / 5) * 5;
const band10 = (age) => Math.floor(age / 10) * 10;
const bandName = (b, w) => `${Math.floor(b / 10) * 10}대 ${b % 10 === 0 ? (w === 10 ? '' : '초반') : '후반'}`.trim();

const pct1 = (v) => Math.round(v * 10) / 10;

/**
 * 그 나이·성별에서 그 일이 한 해에 얼마나 흔한가.
 *
 * @param {string} domain 분야 (결혼·자녀·이사 …)
 * @param {object} who { age, gender } — gender 는 'male' | 'female'
 * @returns {object} 값이 있으면 { annualPct, monthlyPct, band, source, note },
 *                   없으면 { unknown } — **없으면 없다고 말한다**
 */
export function baseRateFor(domain, who = {}) {
  const age = Number(who.age);
  const gender = who.gender === 'male' || who.gender === 'female' ? who.gender : null;
  if (!Number.isFinite(age) || age < 0) return { unknown: '나이를 알 수 없어 기저율을 댈 수 없다.' };

  if (domain === '결혼') {
    if (!gender) return { unknown: '혼인율은 성별로 갈려 성별을 알아야 한다.' };
    const b = band5(age);
    const per1000 = MARRIAGE_RATE[gender][b];
    if (per1000 == null) {
      return { unknown: `${bandName(b, 5)}의 혼인율은 공표 자료에 없다 (20대 초반·40대 이상은 수치가 없다).` };
    }
    const annual = per1000 / 10; // 천 명당 건수 → %
    const peak = FIRST_MARRIAGE_AGE[gender];
    return {
      annualPct: pct1(annual),
      monthlyPct: Math.round(annual / 12 * 100) / 100,
      band: bandName(b, 5),
      source: SOURCES.marriage,
      note: `평균 초혼연령은 ${gender === 'male' ? '남자' : '여자'} ${peak}세. ` +
        (age < peak - 2 ? '아직 그 앞이다.' : age > peak + 2 ? '이미 그 뒤다.' : '그 언저리다.'),
    };
  }

  if (domain === '자녀') {
    if (gender === 'male') {
      return { unknown: '연령별 출산율은 모(母) 기준으로만 공표된다. 남성 기준 기저율은 없다.' };
    }
    const b = band5(age);
    const per1000 = BIRTH_RATE[b];
    if (per1000 == null) {
      return { unknown: `${bandName(b, 5)}의 출산율은 공표 자료에 없다 (25세 미만·40세 이상은 수치가 없다).` };
    }
    const annual = per1000 / 10;
    return {
      annualPct: pct1(annual),
      monthlyPct: Math.round(annual / 12 * 100) / 100,
      band: bandName(b, 5),
      source: SOURCES.birth,
      note: `첫째아 평균 출산연령 ${BIRTH_AGE.first}세, 전체 평균 ${BIRTH_AGE.all}세.`,
    };
  }

  if (domain === '이사' || domain === '주거') {
    const b = band10(age);
    const rate = MOVE_RATE[b];
    if (rate == null) {
      return { unknown: `${b}대의 이동률은 공표 자료에 없다 (전체 평균은 ${MOVE_RATE_ALL}%).` };
    }
    return {
      annualPct: pct1(rate),
      monthlyPct: Math.round(rate / 12 * 100) / 100,
      band: `${b}대`,
      source: SOURCES.move,
      note: `전체 평균 이동률은 ${MOVE_RATE_ALL}% — 이 나이대가 ${rate > MOVE_RATE_ALL ? '더 자주' : '덜 자주'} 옮긴다. ` +
        '국내 이동 전체이므로 같은 동네 이사까지 들어 있다.',
    };
  }

  return { unknown: `${domain} 분야는 공표 기저율을 아직 넣지 않았다.` };
}

/**
 * 문맥용 글.
 *
 * 순위와 나란히 놓는 것이 요점이다. "상위 5% 인 달"이라는 말은 그 사건이
 * 한 달에 0.4% 로 일어나는 일이라는 사실과 **같이 읽어야** 뜻이 선다.
 */
export function formatBaseRate(domain, who) {
  const r = baseRateFor(domain, who);
  const out = [`### [F] 기저율 — 명반을 보기 전에 이미 알고 있는 것 (${domain})`];
  if (r.unknown) {
    out.push(`${r.unknown} **없는 기저율을 짐작해서 말하지 말 것.**`);
    return out.join('\n');
  }
  out.push(`${who.age}세 ${who.gender === 'male' ? '남성' : '여성'}(${r.band}) 기준 — ` +
    `이 일은 한 해에 **${r.annualPct}%**, 한 달로 치면 **${r.monthlyPct}%** 일어난다.`);
  out.push(`  ${r.note}`);
  out.push(`  출처: ${r.source}`);
  out.push('※ 이 숫자는 통계지 명반이 아니다. **점수에 섞여 있지 않다.** ' +
    '순위와 나란히 읽으라고 싣는다 — "상위 5%인 달"도 기저율이 한 달 0.4%면 ' +
    '여전히 거의 일어나지 않는 일이다. 순위가 높다고 확률이 높아지는 것이 아니다.');
  return out.join('\n');
}
