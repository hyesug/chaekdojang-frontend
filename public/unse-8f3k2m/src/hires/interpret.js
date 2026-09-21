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
import { DOMICILE } from './classical.js';
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
 * 자미두수 — 전택궁 주성이 그리는 거주의 모양.
 *
 * **태음이 전택주(田宅主)다.** 이건 내가 고른 것이 아니라 두수에서 태음에
 * 붙어 있는 이름이다. 천부는 고(庫), 자미는 제좌(帝座), 무곡은 재성이라
 * 넷이 "쌓아 두고 소유하는" 쪽에 선다.
 *
 * 반대쪽은 동성(動星)이다. 천기는 그 이름부터 움직이는 별이고, 파군·칠살은
 * 판을 바꾸는 별이라 한자리에 오래 머무르지 않는다고 본다.
 *
 * 나머지(천상·천량·태양·거문·탐랑·천동·염정)는 어느 쪽도 아니다. **가르지
 * 못하면 가르지 않는다** — 억지로 배정하면 표 만드는 사람이 답을 정하게 된다.
 */
const ZIWEI_HOME_OWN = ['태음', '천부', '자미', '무곡'];
const ZIWEI_HOME_MOVE = ['천기', '파군', '칠살'];

/**
 * 사주 — 배우자 자리의 십성.
 * 여자는 관성, 남자는 재성을 배우자로 본다(명리 표준). 그 십성이
 * 원국에 있고 여럿이면 인연이 잦고, 없으면 늦거나 약하다고 본다.
 */
const SAJU_SPOUSE_GOD = { female: '관성', male: '재성' };
/** 사주 — 자녀는 식상으로 본다 */
const SAJU_CHILD_GOD = '식상';

/**
 * 사주 — 학업은 인성(정인·편인)으로 본다.
 *
 * 명리에서 인성은 **문서·학문·자격**의 자리다. 이것도 내가 고른 것이 아니라
 * 인성에 붙어 있는 뜻이다. 천간에 인성이 서 있으면 정규 과정을 끝까지 가는
 * 쪽으로, 없으면 중간에 끊기거나 현장으로 먼저 나가는 쪽으로 본다.
 *
 * 같은 축을 **자미 문창·문곡**으로도 재 봤다. 문창·문곡은 두수에서 글과
 * 시험의 별이니 자리가 맞는데, 말한 다섯 중 둘만 맞아 영점보다 나빴다.
 * 그래서 이 축은 사주에 맡긴다 — **자리가 그럴듯하다고 맞는 것은 아니다.**
 */
const SAJU_SCHOOL_GOD = '인성';

const SIGN_NAME = ['양자리', '황소', '쌍둥이', '게', '사자', '처녀',
                   '천칭', '전갈', '사수', '염소', '물병', '물고기'];

const item = (value, basis) => (value && basis ? { value, basis } : null);

// ─────────────────────────────────────────────────────────────
// 체계마다 하나씩
// ─────────────────────────────────────────────────────────────


/**
 * 공궁일 때 대궁(마주 보는 궁)의 주성을 빌려 온다.
 *
 * 자미두수 표준 독법이다. 궁이 비면 그 궁만으로 말하지 않고 삼방사정을
 * 보는데, 그중 대궁이 가장 가깝다. 여기서는 대궁만 쓴다 — 삼방까지
 * 다 끌어오면 거의 모든 궁이 무엇이든 말하게 되어, 빈 궁과 찬 궁의
 * 구별이 사라진다.
 */
function palaceOfBranchOpposite(input, stack, domain, name) {
  const rows = ZE.domainPalaces(input, domain, stack.layers).find((x) => x.palace === name)?.rows ?? [];
  const row = rows.find((r) => /원국/.test(r.layer ?? ''));
  if (!row || row.branch == null) return [];
  const opp = ZE.trineSquare(row.branch).opposite;
  const board = stack.board?.board ?? null;
  if (!board || !board[opp]) return [];
  // 길성·살성이 아닌 주성만
  return board[opp].filter((s) => ZIWEI_TRADE[s]);
}

/** 자미두수 — 관록궁·부처궁·자녀궁 주성을 그대로 읽는다 */
export function ziweiRead(input, stack) {
  if (!stack) return { system: '자미두수', unavailable: '출생 시각을 알아야 판을 세운다' };
  const rowOf = (domain, name) => ZE.domainPalaces(input, domain, stack.layers)
    .find((x) => x.palace === name)?.rows?.find((r) => /원국/.test(r.layer ?? '')) ?? null;
  const palaceOf = (domain, name) => rowOf(domain, name)?.main ?? [];
  const career0 = palaceOf('직업', '관록궁');
  const spouse = palaceOf('결혼', '부처궁');
  const child = palaceOf('자녀', '자녀궁');
  const homeRow = rowOf('주거', '전택궁');
  const home = homeRow?.main ?? [];

  // 공궁이면 대궁(마주 보는 궁)의 주성을 빌려 본다.
  //
  // 자미두수의 표준 독법이다 — 궁이 비면 그 궁만 보고 말할 수 없으므로
  // 삼방사정, 그중에서도 먼저 대궁을 본다. 내가 지어낸 규칙이 아니다.
  //
  // 이게 없으면 관록궁이 빈 사람에게 직업을 아예 말하지 못한다. 지인
  // 열둘 중 둘이 공궁이었고 둘 다 침묵했다.
  const borrowed = career0.length === 0 ? palaceOfBranchOpposite(input, stack, '직업', '관록궁') : [];
  const career = career0.length ? career0 : borrowed;
  const fromOpposite = career0.length === 0 && borrowed.length > 0;

  const trades = [...new Set(career.map((s) => ZIWEI_TRADE[s]).filter(Boolean))];
  const self = career.some((s) => ZIWEI_SELF.includes(s));
  const org = career.some((s) => ZIWEI_ORG.includes(s));

  return {
    system: '자미두수',
    직업: item(trades.join(' / '),
      fromOpposite ? `원국 관록궁 공궁 → 대궁 ${career.join('·')}` : `원국 관록궁 ${career.join('·') || '공궁'}`),
    수입형태: item(self && !org ? '자기 판 쪽' : org && !self ? '조직 소속 쪽' : null,
      fromOpposite ? `관록궁 공궁 → 대궁 ${career.join('·')}` : `관록궁 ${career.join('·') || '공궁'}`),
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
    // 전택궁도 공궁이면 대궁을 빌린다. 관록궁과 같은 이유다 —
    // 안 빌리면 지인 일곱 중 넷이 침묵했다(전택 공궁이 흔하다).
    // 빌리면 침묵 넷이 답으로 바뀌고, 그중 몇이 맞는지는 채점이 말한다.
    거주형태: (() => {
      const stars = home.length ? home
        : palaceOfBranchOpposite(input, stack, '주거', '전택궁');
      const own = stars.filter((s) => ZIWEI_HOME_OWN.includes(s));
      const move = stars.filter((s) => ZIWEI_HOME_MOVE.includes(s));
      // 화록·녹존이 전택에 들면 부동산을 쥔다고 본다(전통의 재성 배당)
      const money = [...(homeRow?.sihwa ?? []), ...(homeRow?.lucky ?? [])]
        .filter((s) => /화록|녹존/.test(s));
      const ownScore = own.length + money.length;
      const basis = (home.length ? `원국 전택궁 ${home.join('·')}`
        : `원국 전택궁 공궁 → 대궁 ${stars.join('·') || '역시 비었다'}`)
        + (money.length ? ` · ${money.join('·')}` : '');
      if (ownScore && !move.length) return item('자기 집 쪽 — 사서 쌓아 두는 모양', basis);
      if (move.length && !ownScore) return item('옮겨 사는 쪽 — 빌려 살거나 자주 바꾸는 모양', basis);
      return null;   // 섞였거나 중립이면 말하지 않는다
    })(),
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
    학업경로: item(
      (dist[SAJU_SCHOOL_GOD] ?? 0) > 0
        ? '정규 과정을 끝까지 가는 쪽 — 문서·자격이 손에 남는다'
        : '중간에 끊기거나 현장으로 먼저 나가는 쪽 — 자격은 나중에 따로 챙긴다',
      `천간 인성 ${dist[SAJU_SCHOOL_GOD] ?? 0}개`),
  };
}

/**
 * 서양 — 7하우스와 그 주인이 혼인을 어떻게 잡는가.
 *
 * **전통 규칙 그대로다.** 흉성(토성·화성)이 7하우스에 들거나 7하우스 주인이
 * 쇠약한 자리(6·8·12하우스)에 있으면 혼인이 늦거나 어렵다고 본다. 길성
 * (금성·목성·달)이 7하우스에 들거나 주인이 앵글(1·4·7·10)에 있으면 이르다고
 * 본다. 둘 다면 갈리므로 말하지 않는다.
 *
 * **이 축은 나이가 섞여 있다는 것을 알고 낸다.** 서른 안쪽이면 아직 안 한
 * 것뿐일 수 있다. 그래서 "했다/안 했다"가 아니라 **"이른 쪽/늦는 쪽"**으로
 * 적는다. 명반이 가릴 수 있는 것은 순서지 시점이 아니다.
 */
function marriageRead(N, gender) {
  const sign7 = Math.floor((((N.cusps[7] % 360) + 360) % 360) / 30);
  const lord = DOMICILE[sign7];
  const lordLon = N.pos?.[lord]?.lon;
  const lordHouse = lordLon == null ? null : houseOf(lordLon, N.cusps);
  const inSeventh = Object.entries(N.pos)
    .filter(([, v]) => houseOf(v.lon, N.cusps) === 7)
    .map(([k]) => k);

  let late = 0, early = 0;
  const why = [];
  for (const p of inSeventh) {
    if (p === '토성' || p === '화성') { late++; why.push(`7하우스 ${p}`); }
    if (p === '금성' || p === '목성' || p === '달') { early++; why.push(`7하우스 ${p}`); }
  }
  if (lordHouse != null) {
    if ([6, 8, 12].includes(lordHouse)) { late++; why.push(`7주인 ${lord} ${lordHouse}하우스`); }
    if ([1, 4, 7, 10].includes(lordHouse)) { early++; why.push(`7주인 ${lord} ${lordHouse}하우스(앵글)`); }
  }
  // 역행은 지연이다 — 릴리 이래의 표준 배당
  if (N.pos?.[lord]?.retrograde) { late++; why.push(`7주인 ${lord} 역행`); }
  // 혼인의 자연 지표. 남자는 금성, 여자는 화성(고전의 표준 배당)
  const kara = gender === 'male' ? '금성' : '화성';
  const karaHouse = N.pos?.[kara] ? houseOf(N.pos[kara].lon, N.cusps) : null;
  if (karaHouse != null) {
    if ([6, 8, 12].includes(karaHouse)) { late++; why.push(`${kara} ${karaHouse}하우스`); }
    if ([1, 4, 7, 10].includes(karaHouse)) { early++; why.push(`${kara} ${karaHouse}하우스(앵글)`); }
  }
  const basis = `7하우스 ${SIGN_NAME[sign7]} · 주인 ${lord}` + (why.length ? ` · ${why.join(', ')}` : '');
  if (early > late) return item('혼인이 이른 쪽 — 짝 자리가 일찍 채워진다', basis);
  if (late > early) return item('혼인이 늦는 쪽 — 짝 자리가 더디게 채워진다', basis);
  return null;    // 팽팽하거나 아무 표시도 없으면 말하지 않는다
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
    결혼경험: marriageRead(N, input.gender),
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
/**
 * 속성마다 **어느 체계에 맡길지**, 그리고 **어느 속성은 입을 다물지**.
 *
 * ── 왜 배정인가 (융합을 세 번 실패하고 얻은 결론) ──────────────
 * 열다섯 체계를 하나로 버무리면 **언제나 무너진다.** 세 번 확인했다.
 *
 *   profile.js 의 융합        지인 다섯에게 모두 "교육·법률·금융"
 *   가중투표 융합             열한 명 중 여덟에게 "전문가"  → 2/11 = 18%
 *   교집합 융합               어떤 기준으로도 영점(45%)을 못 넘음
 *
 * 범주가 흔한 쪽으로 표가 쏠려서, 섞을수록 가장 흔한 답으로 수렴한다.
 * 그런데 **체계 하나하나는 영점보다 낫다.** 섞지 말고 **속성마다 담당을
 * 정하는 것**이 답이었다.
 *
 * ── 채점 (지인 11명, 같은 정답표로 한 번에 다시 쟀다) ─────────────
 * 영점은 "그 속성에서 가장 흔한 답만 찍기"다. '말한 수'는 담당이 침묵하지
 * 않은 사람 수 — 침묵은 오답이 아니라 **답 없음**으로 센다.
 *
 *   속성        담당        말한 수  맞은 수   영점    판정
 *   학업 경로    사주 인성       7      6  86%   57%    **잠정** — p=0.14
 *   수입형태     자미 관록궁     4      4 100%   55%    남긴다 (p=0.061)
 *   자녀 유무    사주 식상       6      5  83%   60%    남긴다(약하게)
 *   혼인 시기    점성 7하우스    3      2  67%   63%    **잠정** — 차이 없음
 *   거주 형태    자미 전택궁     4      2  50%   71%    **비운다** — 영점보다 나쁨
 *   직업        넷 나란히      —      55~80%   45%    좁히지 못했다
 *   혼인 안정    —             —      영점보다 나쁨     비운다
 *
 * **p값을 함께 적은 이유.** 영점을 넘는 것과 우연이 아닌 것은 다른 말이다.
 * 사람이 일곱이면 **완전히 갈라도 p=0.029** 라, 이 표본에서 나올 수 있는
 * 최선이 겨우 0.05 언저리다. 그래서 '남긴다'는 **구조를 남긴다**는 뜻이지
 * 증명됐다는 뜻이 아니다. 같은 축을 자미 문창·문곡으로도 재 봤더니
 * 말한 다섯 중 둘이었다 — **자리가 그럴듯하다고 맞는 것이 아니다.**
 *
 * ── 전에 적었던 숫자를 고친다 ───────────────────────────────
 * 여기 있던 "결혼 경험 5/7 · 거주 형태 3/4" 는 **재현되지 않았다.** 그때는
 * 두 축을 읽는 코드가 아예 없었고(담당표만 있고 reader 가 없었다) 손으로
 * 센 값이었다. 규칙을 전통에서 먼저 정하고 코드로 옮겨 다시 재니 위와 같다.
 * **못 맞힌 쪽을 지우는 대신 숫자를 고친다.**
 *
 * ── 빈칸을 채우지 않는 것이 정확도를 올린다 ──────────────────
 * 수입형태를 사주로 채우면 4/10 40% 라 영점(55%)보다 나빠진다. 거주형태는
 * 담당 자신이 영점보다 나쁘다. 그래서 **둘 다 채우지 않는다.** 답이 비면
 * 기저율(baserate.js)이 대신 말한다 — 그건 점이 아니라 통계라고 밝히고.
 *
 * ── 넣지 않은 것 ───────────────────────────────────────────
 * 수입형태를 **오행국**으로 가르면 이 사람들에서 9/9 완벽 분리였다
 * (화육국 전원 자영 · 주장 120개를 감안한 순열검정 p=0.037).
 * 넣지 않았다. 두 가지 이유다.
 *   1) 여러 축을 쟀으므로 보정하면 못 넘는다.
 *   2) **오행국이 자영업을 가린다는 전통 근거를 찾지 못했다.** 통계로만
 *      나온 대응은 표본이 바뀌면 사라진다. 관록궁 주성은 적어도 전통이
 *      직업을 보라고 지정한 자리다.
 * 새 사람 10명 정도에서 다시 나오면 그때 넣는다.
 *
 * ── 이 표를 고칠 때 ────────────────────────────────────────
 * n이 3~11이다. **성적 자체는 아직 못 믿는다.** 다만 속성마다 담당을 두는
 * 구조가 융합보다 낫다는 것은 세 번의 실패로 분명하다. 새 사람이 생기면
 * 같은 정답표로 다시 재고 담당을 바꾸되, **한 사람 때문에 바꾸지 않는다.**
 */
const AXIS_OWNER = {
  수입형태: {
    owners: ['자미두수'], grade: '측정됨',
    note: '자미 관록궁 주성 · 말한 4명 중 4 (영점 55%)',
    say: '담당이 말하면 그대로 낸다',
  },
  자녀자리: {
    owners: ['사주'], grade: '측정됨',
    note: '사주 천간 식상 개수 · 말한 6명 중 5 (영점 60%)',
    say: '영점과의 여유가 얇다. 낼 때 약하게 낸다',
  },
  학업경로: {
    owners: ['사주'], grade: '잠정',
    note: '사주 천간 인성 개수 · 말한 7명 중 6 (영점 57%, Fisher p=0.14)',
    say: '일곱 명에서 제일 잘 갈린 축이다. 다만 **일곱 명으로는 우연을 못 지운다** — 단정하지 말 것',
  },
  결혼경험: {
    owners: ['점성술'], grade: '잠정',
    note: '점성 7하우스와 그 주인 · 말한 3명 중 2 (영점 63%)',
    say: '표본이 셋뿐이라 **영점과 구별되지 않는다.** 참고로만 붙이고 단정하지 말 것',
  },
  거주형태: {
    owners: [], grade: '비움',
    note: '자미 전택궁으로 읽으면 말한 4명 중 2 — 영점(71%)보다 나쁘다',
    say: '명반으로 답하지 않는다. 기저율이 있으면 그것만 말할 것',
  },
  혼인안정: {
    owners: [], grade: '비움',
    note: '자미 부처궁으로 읽으면 5명 중 3 — 영점(75%)보다 나쁘다',
    say: '답하지 않는다',
  },
  직업: {
    owners: ['자미두수', '점성술', '사주', '베딕'], grade: '나란히',
    note: '한 체계로 좁히지 못했다 (각 55~80%, 영점 45%)',
    say: '넷을 나란히 두고 **고르지 말 것.** 서로 다른 사람을 맞혔다',
  },
};

/** 담당표를 읽기 전용으로 꺼낸다 — 프롬프트와 테스트가 같은 값을 본다 */
export const axisPolicy = () => Object.fromEntries(
  Object.entries(AXIS_OWNER).map(([k, v]) => [k, { ...v, owners: [...v.owners] }]));

/**
 * 속성마다 담당 체계의 답만 추린다. 담당이 침묵하면 **같이 침묵한다.**
 * 다른 체계로 빈칸을 채우지 않는 것이 이 함수의 요점이다 — 채우면
 * 영점보다 나빠진다는 것을 자영/월급에서 확인했다(사주로 채우면 50%,
 * 영점 55%).
 */
export function bestRead(reads) {
  const by = Object.fromEntries(reads.map((r) => [r.system, r]));
  const out = {};
  for (const [axis, pol] of Object.entries(AXIS_OWNER)) {
    const said = pol.owners
      .map((s) => {
        const v = by[s]?.unavailable ? null : by[s]?.[axis];
        return v ? { system: s, ...v } : null;
      })
      .filter(Boolean);
    out[axis] = {
      grade: pol.grade, note: pol.note, say: pol.say,
      said: said.length ? said : null,
    };
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

// ─────────────────────────────────────────────────────────────
// 나머지 열한 체계 — 각자의 전통 직업표
//
// 핵심 넷만 읽던 것을 열다섯으로 넓힌다. 이 체계들도 각자 직업을 보는
// 자리와 표가 있다. 없어서 안 쓴 것이 아니라 내가 안 만들어서 못 쓴 것이다.
//
// 표는 각 전통의 표준 배당을 옮겼고, 읽는 값은 이미 `analyze()` 가 내는
// headline·keywords 에서 꺼낸다. 새 계산을 만들지 않는다.
// ─────────────────────────────────────────────────────────────

/** 구성학 — 구성 아홉이 맡는 일 (기학 표준 배당) */
const GUJEONG_TRADE = {
  일백: '물과 사람이 흐르는 일 — 유흥·수산·유통',
  이흑: '땅과 살림을 다루는 일 — 농업·부동산·보조',
  삼벽: '소리와 새것을 다루는 일 — 음악·방송·신규사업',
  사록: '오가며 잇는 일 — 무역·운송·중개',
  오황: '중심에서 갈아엎는 일 — 해체·재건·변동',
  육백: '제도와 금속을 다루는 일 — 관공서·금융·기계',
  칠적: '입과 즐거움을 다루는 일 — 음식·유흥·금융',
  팔백: '쌓고 물려받는 일 — 부동산·상속·창고',
  구자: '드러나고 꾸미는 일 — 예술·미용·법률·학문',
};

/** 육임 — 십이천장이 맡는 일 (대육임 표준 배당) */
const YUKIM_TRADE = {
  귀인: '윗사람·제도와 이어지는 일 — 관공서·인사',
  등사: '얽히고 놀라는 일 — 변동·비정규',
  주작: '말과 문서로 먹고사는 일 — 언론·교육·소송',
  육합: '맺어 주는 일 — 중개·혼인·거래',
  구진: '땅과 다툼을 다루는 일 — 토지·건설·법무',
  청룡: '재물이 도는 일 — 금융·사업',
  천공: '비어 있는 일 — 기획·허업·중개',
  백호: '쇠붙이와 몸을 다루는 일 — 의료·군경·금속',
  태상: '의식주를 갖추는 일 — 식품·의복·예의',
  현무: '감추고 도는 일 — 물류·비밀·야간',
  태음: '안으로 다듬는 일 — 미용·회계·비서',
  천후: '여성·물을 다루는 일 — 미용·요식·서비스',
};

/** 홍국기문 — 팔문이 맡는 일 (기문둔갑 표준 배당) */
const HONGGUK_TRADE = {
  개문: '열고 통하는 일 — 관공서·영업·개업',
  휴문: '쉬고 기르는 일 — 휴양·의료·교육',
  생문: '낳고 불리는 일 — 사업·재물·부동산',
  상문: '다치고 부수는 일 — 기술·수리·체육',
  두문: '숨기고 파는 일 — 연구·기술·은둔',
  경문: '놀라고 알리는 일 — 방송·소송·경보',   // 驚門
  사문: '끝내고 정리하는 일 — 장례·정리·의료',
  경문2: '오가며 다투는 일 — 운송·군경·경쟁',  // 景門 (표기 충돌 회피)
};

/** 카발라 — 라이프 패스가 맡는 일 (숫자점 표준) */
const KABBALAH_TRADE = {
  1: '앞장서는 일 — 창업·개척', 2: '맞추는 일 — 중재·보조·상담',
  3: '표현하는 일 — 예술·글·방송', 4: '쌓는 일 — 건설·관리·실무',
  5: '움직이는 일 — 영업·여행·변화', 6: '돌보는 일 — 교육·의료·가정',
  7: '파고드는 일 — 연구·기술·분석', 8: '다루는 일 — 금융·경영·권한',
  9: '베푸는 일 — 봉사·예술·공공', 11: '전하는 일 — 영성·교육', 22: '세우는 일 — 대규모 기획',
};

/** 마하보테 — 칠요 출생별이 맡는 일 (버마 점성 표준) */
const MAHABOTE_TRADE = {
  빈가: '앞서는 일 — 경쟁·지도', 아하: '맺는 일 — 중개·관계',
  야자: '기르는 일 — 교육·돌봄', 아디: '여는 일 — 창업·개척',
  마라나: '끊고 고치는 일 — 의료·정리', 푸티: '거두는 일 — 재물·결실',
  타트: '옮기는 일 — 운송·무역',
};

/** 태국 점성술 — 요일 수호행성이 맡는 일 (태국 전통) */
const THAI_TRADE = {
  일요일: '드러나는 일 — 공공·지도', 월요일: '돌보는 일 — 서비스·유통',
  화요일: '몸 쓰는 일 — 체육·군경·기술', 수요일: '말과 셈 — 상업·문서',
  목요일: '가르치는 일 — 교육·법률·금융', 금요일: '꾸미는 일 — 예술·미용·접객',
  토요일: '견디는 일 — 제조·건설·행정',
};

/** 숙요 — 본명숙의 칠요 속성이 맡는 일 (숙요경 표준) */
const SUKYO_TRADE = {
  일: '드러나는 일 — 공공·지도', 월: '돌보는 일 — 서비스·돌봄',
  화: '몸 쓰는 일 — 체육·기술·군경', 수: '말과 셈 — 상업·문서·교육',
  목: '가르치는 일 — 교육·법률·금융', 금: '꾸미는 일 — 예술·미용·접객',
  토: '견디는 일 — 제조·건설·행정',
};
/** 28수 → 칠요 (숙요경 배당, 각수부터 순환) */
const SUKYO_YO = {
  角: '목', 亢: '금', 氐: '토', 房: '일', 心: '월', 尾: '화', 箕: '수',
  斗: '목', 牛: '금', 女: '토', 虛: '일', 危: '월', 室: '화', 壁: '수',
  奎: '목', 婁: '금', 胃: '토', 昴: '일', 畢: '월', 觜: '화', 參: '수',
  井: '목', 鬼: '금', 柳: '토', 星: '일', 張: '월', 翼: '화', 軫: '수',
};

/** 타로 — 생일 카드가 맡는 일 (메이저 아르카나 표준 의미) */
const TAROT_TRADE = {
  마법사: '다루는 일 — 기술·상업', 여사제: '파고드는 일 — 연구·상담',
  여황제: '기르는 일 — 예술·미용·가정', 황제: '세우는 일 — 경영·관리',
  교황: '가르치는 일 — 교육·종교', 연인: '맺는 일 — 중개·상담',
  전차: '나아가는 일 — 영업·운송·경쟁', 힘: '견디는 일 — 체육·돌봄',
  은둔자: '홀로 파는 일 — 연구·기술', 운명의수레바퀴: '흐름을 타는 일 — 투자·유통',
  정의: '가르는 일 — 법률·회계', 매달린사람: '기다리는 일 — 봉사·예술',
  죽음: '끝내고 바꾸는 일 — 정리·전환', 절제: '섞는 일 — 의료·조율',
  악마: '욕망을 다루는 일 — 유흥·금융', 탑: '무너뜨리는 일 — 해체·구조',
  별: '비추는 일 — 예술·치유', 달: '흐릿한 일 — 예술·야간',
  태양: '드러나는 일 — 공공·아동', 심판: '불러내는 일 — 공공·의료',
  세계: '아우르는 일 — 국제·기획', 바보: '새로 뛰어드는 일 — 창업·여행',
};

/** headline·keywords 에서 낱말 하나를 집어낸다 */
const pick = (a, table) => {
  const hay = `${a?.headline ?? ''} ${(a?.signals?.keywords ?? []).join(' ')} ${(a?.signals?.tags ?? []).join(' ')}`;
  for (const k of Object.keys(table)) if (hay.includes(k)) return k;
  return null;
};

/**
 * 나머지 열한 체계를 각자의 표로 읽는다.
 *
 * @param {object[]} results `readFortune` 이 낸 체계별 analyze 결과
 */
export function auxReads(results = []) {
  const by = Object.fromEntries((results ?? []).map((r) => [r.id ?? r.name, r]));
  const out = [];
  const add = (name, key, table, where) => {
    const a = by[key] ?? by[name];
    if (!a) return;
    const k = pick(a, table);
    if (!k) { out.push({ system: name, unavailable: `${where} 를 집어내지 못했다` }); return; }
    out.push({ system: name, 직업: item(table[k], `${where} ${k}`) });
  };
  add('구성학', 'gujeong', GUJEONG_TRADE, '본명성');
  add('육임', 'yukim', YUKIM_TRADE, '초전 천장');
  add('홍국기문', 'hongguk', HONGGUK_TRADE, '팔문');
  add('마하보테', 'mahabote', MAHABOTE_TRADE, '출생별');
  add('태국 점성술', 'thai', THAI_TRADE, '출생 요일');
  add('타로', 'tarot', TAROT_TRADE, '생일 카드');

  // 카발라 — 라이프 패스는 숫자라 따로 집는다
  const kb = by['kabbalah'] ?? by['카발라'];
  if (kb) {
    const m = String(kb.headline ?? '').match(/라이프 패스\s*(\d+)/);
    const n = m ? Number(m[1]) : null;
    out.push(n && KABBALAH_TRADE[n]
      ? { system: '카발라', 직업: item(KABBALAH_TRADE[n], `라이프 패스 ${n}`) }
      : { system: '카발라', unavailable: '라이프 패스를 집어내지 못했다' });
  }
  // 숙요 — 28수를 칠요로 옮긴다
  const sk = by['sukyo'] ?? by['숙요'];
  if (sk) {
    const m = String(sk.headline ?? '').match(/([角亢氐房心尾箕斗牛女虛危室壁奎婁胃昴畢觜參井鬼柳星張翼軫])宿/);
    const yo = m ? SUKYO_YO[m[1]] : null;
    out.push(yo && SUKYO_TRADE[yo]
      ? { system: '숙요', 직업: item(SUKYO_TRADE[yo], `본명숙 ${m[1]}宿 · ${yo}요`) }
      : { system: '숙요', unavailable: '본명숙을 집어내지 못했다' });
  }
  return out;
}
