/**
 * interpret.js — 체계마다 **자기 말로** 사람을 읽는다
 *
 * ── 왜 이 파일이 생겼는가 ──────────────────────────────────
 * `profile.js` 는 여러 체계를 **한 답으로 섞어서** 낸다. 그런데 그 융합이
 * 실제로 신호를 뭉개고 있었다.
 *
 * 지인 여덟의 자미 원국 관록궁은 천동·염정파군·탐랑·무곡·파군으로 전부
 * 달랐고, 표는 그것을 각각 다른 직업으로 옮긴다. 그런데 융합 결과는
 * **다섯 명 모두 "교육·법률·금융"** 이었다. 베딕 목성 쪽 지표가 표를 덮었다.
 *
 *   융합된 답으로 채점      직업 1/5
 *   자미 단독으로 채점      직업 5~6/8   (탐랑→미용, 천기→연구직 …)
 *
 * **섞기 전에 각자 말하게 해야 한다.** 그것이 이 파일이다.
 *
 * ── 이 파일이 지키는 선 ────────────────────────────────────
 *   1. **섞지 않는다.** 체계마다 따로 내고, 고르는 일은 하지 않는다.
 *      누가 맞았는지는 채점으로 정하지 코드가 정하지 않는다.
 *   2. **표는 그 전통의 것만 쓴다.** 한 체계의 자리를 다른 체계의 어휘로
 *      옮기지 않는다 (자미 관록궁을 행성 카라카로 바꾸는 식은 안 된다).
 *   3. **근거를 붙인다.** 어느 자리에서 나왔는지 못 적으면 내지 않는다.
 *   4. **없으면 없다고 한다.** 공궁이거나 시각 미상이면 `null` 이다.
 */

import * as VE from './vedicExt.js';
import * as ZE from './ziweiExt.js';
import * as WS from './western.js';
import { houseOf } from '../core/planets.js';
import { tenGod, TEN_GOD_GROUP } from '../core/ganzhi.js';

// ─────────────────────────────────────────────────────────────
// 표 — 각 전통이 원래 쓰는 것
// ─────────────────────────────────────────────────────────────

/** 자미두수 — 관록궁 주성이 그리는 직업. 이 표는 profile.js 의 MAIN_STAR 와 같다 */
const ZIWEI_TRADE = {
  자미: '조직에서 자리를 맡는 일', 천부: '모으고 지키는 실무·재무',
  무곡: '돈과 기술을 직접 다루는 실무', 천상: '조율하고 보좌하는 자리',
  천량: '원칙을 세우고 돌보는 일', 태양: '드러나는 자리 — 공공·교육·영업',
  태음: '섬세하게 쌓는 일 — 재무·기획·연구', 천동: '모나지 않은 서비스·관리',
  천기: '기획·분석처럼 머리 쓰는 일', 거문: '말과 전문성으로 먹고사는 일',
  탐랑: '재주가 여럿 — 영업·예술·사교·미용', 염정: '원칙과 욕망의 낙차가 큰 일',
  칠살: '개척하는 일 — 변동이 큰 자리', 파군: '판을 갈아엎는 일 — 자기 사업 쪽',
};

/** 자미두수 — 관록궁 주성이 조직 소속인가 자기 판인가 */
const ZIWEI_SELF = ['파군', '칠살', '탐랑'];
const ZIWEI_ORG = ['자미', '천부', '천상', '천량', '천동'];

/**
 * 사주 — 십성 무리가 그리는 직업.
 *
 * 명리에서 격국을 세우는 자리다. 월지 본기 십성을 우선 보고, 없으면
 * 천간에서 가장 많은 무리를 본다. 유파가 갈리는 대목이라 **월지 우선**
 * 하나로 고정한다.
 */
const SAJU_TRADE = {
  관성: '조직·직책을 맡는 일 — 공직·관리·제도권',
  재성: '돈을 직접 다루는 일 — 사업·영업·재무',
  식상: '만들고 표현하는 일 — 기술·창작·교육·서비스',
  비겁: '스스로 몸을 쓰는 일 — 독립·경쟁·현장',
  인성: '배우고 문서를 다루는 일 — 연구·학술·자격',
};
/** 사주 — 조직형인가 독립형인가 */
const SAJU_SELF = ['비겁', '식상'];
const SAJU_ORG = ['관성', '인성'];

/**
 * 서양 — 10하우스 별자리가 그리는 직업.
 * 사인-직업 대응은 전통 점성술의 표준 배당을 따른다.
 */
const WEST_TRADE = [
  '앞장서고 개척하는 일 — 경쟁·체육·군경',      // 양자리
  '값을 다루고 쌓는 일 — 금융·농식품·미용',      // 황소
  '말과 정보를 옮기는 일 — 상업·글·교육·IT',     // 쌍둥이
  '돌보고 먹이는 일 — 가정·요식·부동산',        // 게
  '드러나고 이끄는 일 — 예능·경영·아동',        // 사자
  '가다듬고 관리하는 일 — 실무·의료·분석',       // 처녀
  '맞추고 중재하는 일 — 상담·법률·디자인',       // 천칭
  '파고들고 다루는 일 — 조사·의료·남의 돈',      // 전갈
  '넓히고 가르치는 일 — 교육·출판·외국',        // 사수
  '세우고 견디는 일 — 제조·건설·행정',          // 염소
  '새로 짜는 일 — 기술·네트워크·비정통',        // 물병
  '녹이고 상상하는 일 — 예술·돌봄·영성',        // 물고기
];

/** 베딕 — 행성 카라카가 그리는 직업 (profile.js 의 PLANET_TRADE 와 같다) */
const VEDIC_TRADE = {
  태양: '공공·행정·관리직', 달: '돌봄·서비스·유통',
  화성: '기술·공학·의료·군경·체육', 수성: '상업·문서·IT·교육',
  목성: '교육·법률·금융·상담', 금성: '예술·디자인·미용·접객',
  토성: '제조·건설·행정', 라후: '신기술·외국·비정통', 케투: '기술 하나로 파고드는 일',
};


/**
 * 자미두수 — 부처궁 주성이 그리는 혼인의 결.
 * 안정 쪽(자미·천부·천상·천량·태음)과 변동 쪽(파군·칠살·탐랑·염정)으로 가른다.
 * 이 갈림은 MAIN_STAR 의 `stable` 값과 같은 전통 배당이다.
 */
const ZIWEI_MARRY_STABLE = ['자미', '천부', '천상', '천량', '태음', '천동', '무곡'];
const ZIWEI_MARRY_SHAKY = ['파군', '칠살', '탐랑', '염정'];

/** 자미두수 — 자녀궁이 두터운가 얇은가. 주성이 있고 길성이면 두텁게 본다 */
const ZIWEI_CHILD_MANY = ['천부', '태음', '천동', '천량', '자미', '거문'];
const ZIWEI_CHILD_FEW = ['칠살', '파군', '염정', '천기'];

/**
 * 사주 — 배우자 자리의 십성.
 * 여자는 관성, 남자는 재성을 배우자로 본다(명리 표준). 그 십성이
 * 원국에 있고 여럿이면 인연이 잦고, 없으면 늦거나 약하다고 본다.
 */
const SAJU_SPOUSE_GOD = { female: '관성', male: '재성' };
/** 사주 — 자녀는 식상으로 본다 */
const SAJU_CHILD_GOD = '식상';

const SIGN_NAME = ['양자리', '황소', '쌍둥이', '게', '사자', '처녀',
                   '천칭', '전갈', '사수', '염소', '물병', '물고기'];

const item = (value, basis) => (value && basis ? { value, basis } : null);

// ─────────────────────────────────────────────────────────────
// 체계마다 하나씩
// ─────────────────────────────────────────────────────────────

/** 자미두수 — 관록궁·부처궁·자녀궁 주성을 그대로 읽는다 */
export function ziweiRead(input, stack) {
  if (!stack) return { system: '자미두수', unavailable: '출생 시각을 알아야 판을 세운다' };
  const palaceOf = (domain, name) => {
    const rows = ZE.domainPalaces(input, domain, stack.layers).find((x) => x.palace === name)?.rows ?? [];
    return rows.find((r) => /원국/.test(r.layer ?? ''))?.main ?? [];
  };
  const career = palaceOf('직업', '관록궁');
  const spouse = palaceOf('결혼', '부처궁');
  const child = palaceOf('자녀', '자녀궁');

  const trades = [...new Set(career.map((s) => ZIWEI_TRADE[s]).filter(Boolean))];
  const self = career.some((s) => ZIWEI_SELF.includes(s));
  const org = career.some((s) => ZIWEI_ORG.includes(s));

  return {
    system: '자미두수',
    직업: item(trades.join(' / '), `원국 관록궁 ${career.join('·') || '공궁'}`),
    수입형태: item(self && !org ? '자기 판 쪽' : org && !self ? '조직 소속 쪽' : null,
      `관록궁 ${career.join('·') || '공궁'}`),
    배우자: item(spouse.map((s) => ZIWEI_TRADE[s]).filter(Boolean).join(' / '),
      `원국 부처궁 ${spouse.join('·') || '공궁'}`),
    혼인안정: item(
      spouse.some((s) => ZIWEI_MARRY_SHAKY.includes(s)) ? '흔들리는 쪽'
        : spouse.some((s) => ZIWEI_MARRY_STABLE.includes(s)) ? '오래 가는 쪽' : null,
      `부처궁 ${spouse.join('·') || '공궁'}`),
    자녀두께: item(
      child.some((s) => ZIWEI_CHILD_MANY.includes(s)) ? '자녀 자리가 두터운 쪽'
        : child.some((s) => ZIWEI_CHILD_FEW.includes(s)) ? '자녀 자리가 얇은 쪽' : null,
      `자녀궁 ${child.join('·') || '공궁'}`),
  };
}

/** 사주 — 월지 본기 십성으로 격을 본다 */
export function sajuRead(input, chart) {
  const m = chart?.pillars?.month;
  if (!m) return { system: '사주', unavailable: '월주가 없다' };
  // 월지 본기(정기) 십성. 지장간 본기는 core 가 이미 들고 있다
  const stemGod = tenGod(chart.dayStem, m.stem);
  const grp = TEN_GOD_GROUP?.[stemGod] ?? null;

  // 천간 넷의 무리 분포도 함께 — 격이 흐릴 때 보조로 쓴다
  const dist = {};
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = chart.pillars[k];
    if (!p) continue;
    const g = TEN_GOD_GROUP?.[tenGod(chart.dayStem, p.stem)];
    if (g) dist[g] = (dist[g] ?? 0) + 1;
  }
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const lead = grp ?? top;

  return {
    system: '사주',
    직업: item(SAJU_TRADE[lead], `월간 ${stemGod}(${grp ?? '—'}) · 천간 최다 ${top ?? '—'}`),
    수입형태: item(
      SAJU_SELF.includes(lead) ? '자기 판 쪽' : SAJU_ORG.includes(lead) ? '조직 소속 쪽' : null,
      `${lead ?? '—'} 가 앞선다`),
    십성분포: item(Object.entries(dist).map(([k, v]) => `${k}${v}`).join(' '), '원국 천간 넷'),
    배우자자리: item(
      (() => {
        const want = SAJU_SPOUSE_GOD[input.gender];
        if (!want) return null;
        const n = dist[want] ?? 0;
        return n === 0 ? '배우자 글자가 천간에 없다 — 늦거나 약한 쪽'
          : n >= 2 ? '배우자 글자가 여럿 — 인연이 잦은 쪽' : '배우자 글자가 하나 — 보통';
      })(),
      `${SAJU_SPOUSE_GOD[input.gender] ?? '—'} ${dist[SAJU_SPOUSE_GOD[input.gender]] ?? 0}개`),
    자녀자리: item(
      (dist[SAJU_CHILD_GOD] ?? 0) === 0 ? '식상이 천간에 없다 — 얇은 쪽'
        : (dist[SAJU_CHILD_GOD] ?? 0) >= 2 ? '식상이 여럿 — 두터운 쪽' : '식상 하나 — 보통',
      `식상 ${dist[SAJU_CHILD_GOD] ?? 0}개`),
  };
}

/** 서양 — 10하우스 별자리와 그 주인 */
export function westernRead(input) {
  if (!input?.timeKnown) return { system: '점성술', unavailable: '출생 시각을 알아야 하우스를 세운다' };
  const N = WS.natalPack(input);
  if (!N?.cusps) return { system: '점성술', unavailable: '하우스를 세우지 못했다' };
  const mcSign = Math.floor((((N.cusps[10] % 360) + 360) % 360) / 30);
  const occupants = Object.entries(N.pos)
    .filter(([, v]) => houseOf(v.lon, N.cusps) === 10)
    .map(([k]) => k);

  return {
    system: '점성술',
    직업: item(WEST_TRADE[mcSign], `10하우스 ${SIGN_NAME[mcSign]}` +
      (occupants.length ? ` · 그 안에 ${occupants.join('·')}` : ' · 비어 있음')),
    십하우스거주: item(occupants.join('·') || null, '10하우스에 든 행성'),
    배우자: item(WEST_TRADE[Math.floor((((N.cusps[7] % 360) + 360) % 360) / 30)],
      `7하우스 ${SIGN_NAME[Math.floor((((N.cusps[7] % 360) + 360) % 360) / 30)]}`),
    자녀자리: item(SIGN_NAME[Math.floor((((N.cusps[5] % 360) + 360) % 360) / 30)],
      `5하우스 ${SIGN_NAME[Math.floor((((N.cusps[5] % 360) + 360) % 360) / 30)]}`),
  };
}

/** 베딕 — D10(직업 전용 분할도) 라그나주와 10궁주 */
export function vedicRead(input) {
  const wp = VE.wealthPack(input);
  if (!wp) return { system: '베딕', unavailable: '차트를 세우지 못했다' };
  const lagLord = wp.d10_1?.lord ?? null;
  const tenLord = wp.d10_10?.lord ?? null;
  const says = [...new Set([lagLord, tenLord].map((p) => VEDIC_TRADE[p]).filter(Boolean))];

  return {
    system: '베딕',
    직업: item(says.join(' / '),
      `D10 라그나 ${wp.d10Lagna ?? '—'} 주인 ${lagLord ?? '—'} · D10 10궁주 ${tenLord ?? '—'}`),
  };
}

/**
 * 넷을 나란히 낸다. **섞지 않는다.**
 *
 * 누가 맞았는지는 채점이 정한다. 코드가 하나를 고르면 그 순간
 * 다시 융합이고, 융합이 신호를 뭉갠다는 것이 이 파일의 출발점이다.
 */
export function readAll(input, chart, stack) {
  return [
    sajuRead(input, chart),
    ziweiRead(input, stack),
    westernRead(input),
    vedicRead(input),
  ];
}

/**
 * 축마다 **어느 체계에 맡길지**, 그리고 **언제 입을 다물지**.
 *
 * ── 이 표가 나온 과정 ──────────────────────────────────────
 * 지인 12명(시각 있는 사람 9~11명)에게 축마다 체계별로 채점했다.
 * 영점은 "가장 흔한 답만 찍기"다.
 *
 *   축            체계별 성적                              영점    판정
 *   직업          자미 4/7 57% · 점성술 4/9 44%
 *                 사주 3/11 27% · 베딕 2/9 22%             —      자미·점성술
 *   자영/월급      자미 4/4 100%(11명 중 4명에게만 답)
 *                 사주 4/10 40%                           55%    자미만
 *   자녀 유무      사주 5/6 83% · 자미 4/7 57%              60%    근거 약함
 *   혼인 안정      자미 3/5 60%                            75%    **영점보다 나쁨**
 *
 * 그래서 이렇게 한다.
 *   · **직업** — 자미를 먼저, 점성술을 나란히. 둘은 서로 다른 사람을 맞혔다
 *     (자미는 미용·연구, 점성술은 체육·요식). 하나로 합치지 않는다.
 *   · **자영/월급** — 자미가 말할 때만 말한다. 사주로 빈칸을 채우면 40%라
 *     영점(55%)보다 나빠진다. **채우지 않는 것이 정확도를 올린다.**
 *   · **혼인 안정** — 답하지 않는다. 영점보다 나쁘다.
 *   · **자녀** — 사주가 낫지만 영점(60%) 대비 여유가 얇다. 낼 때 약하게 낸다.
 *
 * ── 넣지 않은 것 ───────────────────────────────────────────
 * 자영/월급을 **오행국**으로 가르면 이 12명에서 9/9 완벽 분리였다
 * (화육국 전원 자영, 나머지 전원 월급 · 주장 120개를 감안한 순열검정 p=0.037).
 * 넣지 않았다. 두 가지 이유다.
 *   1) 세 축을 쟀으므로 보정하면 p<0.017 이 필요한데 못 넘는다.
 *   2) **오행국이 자영업을 가린다는 전통 근거를 찾지 못했다.** 통계로만
 *      나온 대응은 표본이 바뀌면 사라진다. 관록궁 주성은 적어도 전통이
 *      직업을 보라고 지정한 자리다.
 * 새 사람 10명 정도에서 다시 나오면 그때 넣는다.
 */
const AXIS_OWNER = {
  직업: ['자미두수', '점성술'],
  수입형태: ['자미두수'],
  자녀자리: ['사주'],
  혼인안정: [],          // 영점보다 나빠 비워 둔다
};

/**
 * 축마다 담당 체계의 답만 추린다. 담당이 침묵하면 **같이 침묵한다.**
 * 다른 체계로 빈칸을 채우지 않는 것이 이 함수의 요점이다.
 */
export function bestRead(reads) {
  const by = Object.fromEntries(reads.map((r) => [r.system, r]));
  const out = {};
  for (const [axis, owners] of Object.entries(AXIS_OWNER)) {
    const said = owners
      .map((s) => (by[s]?.unavailable ? null : by[s]?.[axis]))
      .filter(Boolean)
      .map((v, i) => ({ system: owners[i], ...v }));
    out[axis] = said.length ? said : null;
  }
  return out;
}

/** 문맥용 글 — 체계마다 갈라서 적는다 */
export function formatReads(reads) {
  const out = ['### 체계마다 따로 읽은 프로파일 (섞지 않았다)'];
  out.push('같은 사람을 네 전통이 각자의 자리에서 읽은 것이다. **서로 다른 말이 나오는 것이 정상이고**, ' +
    '어느 하나로 합치지 않았다. 갈리는 지점 자체가 읽을거리다.');
  for (const r of reads) {
    if (r.unavailable) { out.push(`[${r.system}] ${r.unavailable}`); continue; }
    out.push(`[${r.system}]`);
    for (const [k, v] of Object.entries(r)) {
      if (k === 'system' || !v) continue;
      out.push(`  ${k}: ${v.value}`);
      out.push(`    근거: ${v.basis}`);
    }
  }
  return out.join('\n');
}
