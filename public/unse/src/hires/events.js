/**
 * events.js — 사건 추론 엔진
 *
 * grid.js 가 모아 둔 **계산값**을 받아 사건 후보로 옮긴다. 이 파일의 모든
 * 산출물은 계산이 아니라 **해석**이다. 그 구분이 이 파일의 존재 이유다.
 *
 *   LEVEL 1 계산값       — grid.js 가 만든다. 여기서 건드리지 않는다
 *   LEVEL 2 활성 분야    — 어느 영역이 움직이는가
 *   LEVEL 3 사건 후보    — 이직·승진·이사·결혼 같은 현실의 사건 이름
 *   LEVEL 4 사건 속성    — 자발/비자발, 확대/축소, 장거리/근거리 …
 *   LEVEL 5 초구체화     — 가장 강한 구간, 조직 성격, 선후관계
 *
 * ── 점수에 대하여 ──────────────────────────────────────────
 * 아래 숫자는 확률이 아니다. **그 사람의 열두 달(또는 서른여섯 달) 안에서
 * 어느 구간이 상대적으로 두드러지는가**를 가리기 위한 내부 비교값이다.
 * 바깥으로는 최강·강함·보조·약함 네 가지로만 내보낸다. 절대 점수를 확률처럼
 * 옮기지 않도록 formatEvents 에서 숫자를 아예 지운다.
 *
 * ── 대응표의 출처 ──────────────────────────────────────────
 * 아래 규칙은 각 전통이 원래 그 영역을 보라고 지정해 둔 자리를 그대로
 * 옮긴 것이다. 새로 지어낸 대응이 아니다.
 *   사주   — 십신(관성=직책·재성=돈·식상=표현·비겁=독립·인성=문서),
 *            월지=직업의 자리, 일지=배우자·환경의 자리, 역마=이동
 *   자미   — 관록궁=직업, 재백궁=돈, 천이궁=이동, 전택궁=주거,
 *            부처궁=배우자, 사화(녹=기회·권=권한·과=명예·기=막힘)
 *   서양   — 10하우스·MC=직업, 6하우스=일상 노동, 2하우스=보상,
 *            4하우스=집, 7하우스=짝·동업, 토성=제도·책임, 목성=확장,
 *            천왕성=급변, 명왕성=근본 변형
 *   베딕   — 다샤 전환=국면 전환, 사데사티=압박, 목성 고차라=확장
 */

import { j } from '../core/josa.js';

/** 다룰 수 있는 분야. 여기 없는 질문은 '직업'으로 떨어뜨리지 않고 따로 표시한다 */
export const DOMAINS = ['직업', '재물', '관계', '결혼', '주거', '이사', '건강', '학업', '자녀'];

/** LEVEL 3 — 분야별 사건 후보 */
/**
 * LEVEL 3 — 사건 후보.
 *
 * ── 후보를 늘리기 전에 읽을 것 ─────────────────────────────
 * 실제로 틀린 사건을 보고 **그 사건에 맞는 후보를 새로 만드는 것**은
 * 고치는 게 아니라 답을 베끼는 것이다. 그렇게 넣은 후보는 그 한 건에서만
 * 맞고, 맞았다는 사실이 검증으로 오해된다.
 *
 * 지금 비어 있는 것을 알면서 두는 자리:
 *   · 첫 취업 / 직종 전환 — 다른 분야를 준비하다 직종을 갈아타며
 *     처음 취직하는 사건에 맞는 후보가 없다. 실측 사례(2021-10)에서
 *     '직무·역할 변경'은 228달 중 213위로 **오히려 반대**를 짚었고,
 *     실제로 울린 것은 '외부 제안으로 이동'(4위)이었다.
 *
 * 이 자리는 **다음 사례에서 또 어긋날 때** 채운다. 사례 하나에 후보 하나를
 * 만들면 후보 목록이 곧 정답표가 된다.
 */
export const EVENT_CANDIDATES = {
  직업: ['현 직장 유지', '자발적 이직', '외부 제안으로 이동', '직무·역할 변경',
        '조직 개편에 따른 이동', '승진·보상 조정', '퇴사 후 공백', '창업·독립', '부업 병행'],
  재물: ['수입 증가', '큰 지출', '묶인 돈이 풀림', '대출·빚 정리', '계약·정산', '투자 손실 정리'],
  // '새 만남'이 교제 시작까지 함께 본다. 결혼 쪽에도 '교제 시작'이 있지만
  // **같은 분야에 계산식이 같은 후보를 둘 두면 안 된다** — 서로의 여유를
  // 0으로 깎아 신호가 사라진다. 실제로 그렇게 해 봤다가 180달 중 7위였던
  // 것이 39위로 떨어졌다. 교제 시작을 물으면 라우터가 이 '새 만남'으로 보낸다.
  관계: ['새 만남', '관계 정리', '오래된 갈등이 터짐', '거리 조정'],
  결혼: ['교제 시작', '결혼 논의', '상견례·약속', '예식·혼인신고', '동거 시작'],
  주거: ['이사', '독립', '동거', '전월세 계약', '매수·매도', '주거 환경 개선'],
  이사: ['근거리 이사', '타지역 이동', '통근 조건 변화', '해외·장거리'],
  건강: ['누적 피로', '검진·치료 시작', '생활 리듬 재편'],
  학업: ['시험·자격 준비', '합격·수료', '진학·전공 전환'],
  자녀: ['임신·출산', '자녀 계획 논의', '육아와 일의 충돌', '자녀 문제로 생활 재편'],
};

/** LEVEL 4 — 사건 속성 축. 양쪽 이름과 어느 쪽으로 기우는지만 본다 */
export const ATTRIBUTE_AXES = {
  직업: [
    { key: '자발성', a: '스스로 옮김', b: '떠밀려 움직임' },
    { key: '경력', a: '지금 경력을 이어감', b: '직종을 갈아탐' },
    { key: '조직규모', a: '더 제도화된 곳', b: '더 작고 느슨한 곳' },
    { key: '보상', a: '보상이 오르는 쪽', b: '환경·안정이 나아지는 쪽' },
    { key: '거리', a: '근거리', b: '장거리·타지역' },
    { key: '조직성격', a: '안정형', b: '성장·변동형' },
  ],
  주거: [
    { key: '규모', a: '넓히거나 올라감', b: '줄이거나 정리함' },
    { key: '거리', a: '같은 생활권', b: '생활권을 옮김' },
    { key: '형태', a: '계약(전월세)', b: '매매·소유' },
  ],
  결혼: [
    { key: '속도', a: '빠르게 진행', b: '천천히 다져감' },
    { key: '주도', a: '내가 끌고 감', b: '상대·환경이 끌고 감' },
  ],
  재물: [
    { key: '방향', a: '들어오는 쪽', b: '나가고 정리하는 쪽' },
    { key: '경로', a: '일해서 버는 돈', b: '남의 돈·목돈' },
  ],
  자녀: [
    { key: '속도', a: '빠르게 진행', b: '천천히 다져감' },
    { key: '형태', a: '계획대로', b: '상황에 떠밀려' },
  ],
};

// ─────────────────────────────────────────────────────────────
// 한 달치 신호 읽기 — 체계마다 따로
// ─────────────────────────────────────────────────────────────

/** 역마 — 寅申巳亥. 이동의 글자다 */
const YEOKMA = [2, 5, 8, 11];

/** 십신 무리가 가리키는 결 */
const GOD_TENDENCY = {
  관성: { 제도화: 2, 유지: 1, 비자발: 1 },
  재성: { 보상: 2, 확대: 1 },
  식상: { 자발: 2, 전환: 2, 성장형: 1 },
  비겁: { 자발: 2, 독립: 2, 경쟁: 1 },
  인성: { 준비: 2, 유지: 1, 안정형: 1 },
};

/** 분야마다 어느 십신이 직접 걸리는가 */
const DOMAIN_GODS = {
  직업: ['관성', '식상', '비겁'],
  재물: ['재성', '식상'],
  관계: ['재성', '관성'],
  결혼: ['관성', '재성'],
  주거: ['인성', '재성'],
  이사: ['인성', '비겁'],
  건강: ['식상', '관성'],
  학업: ['인성', '식상'],
  // 식상은 명리에서 자식을 보는 자리다
  자녀: ['식상', '인성'],
};

/** 자미 궁이 가리키는 분야 */
const PALACE_DOMAIN = {
  관록궁: '직업', 재백궁: '재물', 천이궁: '이사', 전택궁: '주거',
  부처궁: '결혼', 질액궁: '건강', 자녀궁: '자녀', 복덕궁: '관계', 명궁: null,
};

/** 서양 하우스가 가리키는 분야 */
const HOUSE_DOMAIN = {
  10: '직업', 6: '직업', 2: '재물', 8: '재물',
  7: '결혼', 5: '관계', 4: '주거', 3: '이사', 9: '이사', 11: '직업',
};

/** 느린 행성이 가리키는 사건의 결 */
const PLANET_TENDENCY = {
  토성: { 제도화: 2, 비자발: 1, 안정형: 2, 축소: 1 },
  목성: { 확대: 2, 보상: 1, 성장형: 1 },
  천왕성: { 자발: 2, 전환: 2, 성장형: 2, 장거리: 1 },
  명왕성: { 전환: 2, 비자발: 1 },
  해왕성: { 전환: 1 },
  화성: { 자발: 1, 경쟁: 1 },
  라후: { 장거리: 2, 성장형: 1, 전환: 1 },
  태양: { 유지: 1 }, 금성: { 보상: 1 }, 수성: { 준비: 1 },
};

const bump = (acc, obj, mul = 1) => {
  for (const [k, v] of Object.entries(obj ?? {})) acc[k] = (acc[k] ?? 0) + v * mul;
};

/** 사주 한 달 */
function readBazi(m, domain) {
  const b = m.bazi;
  const votes = [];
  const tend = {};
  const wanted = DOMAIN_GODS[domain] ?? [];

  if (wanted.includes(b.godGroup)) {
    votes.push({ system: '사주', w: 2, why: `월운 천간이 ${b.god}(${b.godGroup})` });
  }
  bump(tend, GOD_TENDENCY[b.godGroup], 1);
  bump(tend, GOD_TENDENCY[godGroupOf(b.branchGod)], 0.6);

  for (const h of b.hits) {
    if (h.kind === '충') {
      if (h.with === '월주') {
        votes.push({ system: '사주', w: 2, why: '월지와 충 — 직업·조직의 자리가 흔들림' });
        if (domain === '직업') tend.전환 = (tend.전환 ?? 0) + 1;
      } else if (h.with === '일주') {
        votes.push({ system: '사주', w: 2, why: '일지와 충 — 환경·거처·짝의 자리가 흔들림' });
        if (domain === '주거' || domain === '이사' || domain === '결혼') tend.전환 = (tend.전환 ?? 0) + 1;
      } else {
        votes.push({ system: '사주', w: 1, why: `${h.with}와 충` });
      }
      tend.비자발 = (tend.비자발 ?? 0) + 1;
    } else if (h.good) {
      votes.push({ system: '사주', w: 1, why: `${h.with}와 ${h.kind} — 맺어지는 결` });
      tend.확정 = (tend.확정 ?? 0) + 1;
      if (h.kind === '육합' || h.kind === '천간합') tend.유지 = (tend.유지 ?? 0) + 0.5;
    } else {
      votes.push({ system: '사주', w: 0.7, why: `${h.with}와 ${h.kind}` });
    }
  }

  // 역마가 걸리면 이동이다
  const yeokma = b.hits.some((h) => YEOKMA.includes(b.gz.branch) && (h.kind === '충' || h.kind === '육합'));
  if (yeokma) {
    votes.push({ system: '사주', w: 1.5, why: '역마 글자가 움직임 — 이동·출입이 늘어나는 결' });
    tend.장거리 = (tend.장거리 ?? 0) + 1;
  }
  if (b.combos.length) {
    votes.push({ system: '사주', w: 1.2, why: `${b.combos.map((c) => c.kind).join('·')} 성립` });
    tend.확정 = (tend.확정 ?? 0) + 1;
  }
  if (b.activated.length) {
    votes.push({ system: '사주', w: 0.8, why: `지장간 활성 (${b.activated.slice(0, 2).join(', ')})` });
  }
  return { votes, tend };
}

/** 십신 이름 → 무리. core 의 TEN_GOD_GROUP 과 같은 분류다 */
function godGroupOf(god) {
  return ({
    비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
    편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성',
    편인: '인성', 정인: '인성',
  })[god] ?? null;
}

/** 자미두수 한 달 */
function readZiwei(m, domain) {
  const votes = [];
  const tend = {};
  const ov = m.ziwei?.overlap;
  if (!ov) return { votes, tend };

  for (const row of ov.rows) {
    const d = PALACE_DOMAIN[row.palace];
    const relevant = d == null || d === domain;
    for (const r of row.repeated) {
      votes.push({
        system: '자미두수',
        w: relevant ? 1.5 * (r.layers - 1) : 0.6 * (r.layers - 1),
        why: `${row.palace}이 ${r.layers}개 층에서 같은 자리(${r.branchName})에 겹침`,
      });
    }
    for (const h of row.hits) {
      for (const s of h.sihwa) {
        const kind = s.slice(-2);
        const w = relevant ? 1.4 : 0.5;
        votes.push({ system: '자미두수', w, why: `${h.layer} ${row.palace}에 ${s}` });
        if (kind === '화록') { tend.확대 = (tend.확대 ?? 0) + 1; tend.보상 = (tend.보상 ?? 0) + 1; }
        if (kind === '화권') { tend.제도화 = (tend.제도화 ?? 0) + 1; tend.자발 = (tend.자발 ?? 0) + 1; }
        if (kind === '화과') { tend.유지 = (tend.유지 ?? 0) + 1; tend.안정형 = (tend.안정형 ?? 0) + 1; }
        if (kind === '화기') { tend.전환 = (tend.전환 ?? 0) + 1; tend.비자발 = (tend.비자발 ?? 0) + 1; }
      }
      // 그 자리에 든 별의 성질
      for (const star of h.stars ?? []) {
        if (['칠살', '파군'].includes(star)) { tend.전환 = (tend.전환 ?? 0) + 0.7; tend.성장형 = (tend.성장형 ?? 0) + 0.7; }
        if (['자미', '천부', '천량'].includes(star)) { tend.안정형 = (tend.안정형 ?? 0) + 0.7; tend.제도화 = (tend.제도화 ?? 0) + 0.7; }
        if (['무곡', '태음'].includes(star)) tend.보상 = (tend.보상 ?? 0) + 0.5;
        if (['탐랑', '천기'].includes(star)) tend.성장형 = (tend.성장형 ?? 0) + 0.5;
      }
    }
  }
  return { votes, tend };
}

/** 서양 점성술 한 달 */
function readWestern(m, domain) {
  const votes = [];
  const tend = {};
  const t = m.western?.transits;
  if (!t) return { votes, tend };

  // ── 고전: 그 해의 시간주 ──
  //
  // 여태 이 함수는 트랜싯과 프로그레션만 봤다. 섹트·디그니티·로트·조디악
  // 릴리징·프로펙션은 전부 계산해 놓고 **월 점수에 0을 기여**했다.
  // 그래서 '점성술'이라고 부르던 칸은 사실 '현대 트랜싯'이었다.
  //
  // 고전 기법은 연 단위라 그대로 더하면 12달이 통째로 동률이 된다(프로펙션은
  // 한 해에 한 칸, ZR 2단계도 평균 18달짜리 덩어리다). 그래서 **점수를 더하지
  // 않고 무게만 바꾼다** — 그 해의 주인 행성에 걸린 트랜싯을 무겁게 본다.
  // 고전 독법이 원래 그렇다: 프로펙션이 그 해의 주인을 정하고, 그 주인에
  // 걸리는 트랜싯이 달을 짚는다.
  //
  // 이미 달마다 변하는 값의 무게만 조절하므로 동률이 생기지 않는다.
  const prof = m.western?.profection ?? null;
  const lord = prof?.timeLord ?? null;
  const profHouse = prof?.house ?? null;
  // 그 해의 무대가 이 분야인가 (7하우스 해에 결혼을 묻는 것처럼)
  const stageFits = profHouse != null && HOUSE_DOMAIN[profHouse] === domain;

  for (const h of t.hits.slice(0, 10)) {
    const d = h.house ? HOUSE_DOMAIN[h.house] : null;
    const isAngle = h.targetKind === 'angle' || h.targetKind === 'ruler';
    const relevant = d === domain || isAngle;
    const base = (h.aspect === '합' ? 1.6 : h.aspect === '대각' || h.aspect === '사각' ? 1.4 : 1.0);
    // 시간주에 걸린 트랜싯, 또는 시간주가 움직여서 생긴 트랜싯
    const onLord = lord && (h.planet === lord || String(h.target).includes(lord));
    const w = base * h.tight * (relevant ? 1.4 : 0.5) * (h.applying ? 1.15 : 0.9)
      * (onLord ? 1.5 : 1) * (stageFits ? 1.2 : 1);
    votes.push({
      system: '점성술', w: Math.round(w * 100) / 100,
      why: `${h.planet}${h.retro ? '(역행)' : ''}이 ${h.target}에 ${h.aspect}` +
        `${h.applying ? ', 다가오는 중' : ', 멀어지는 중'}` +
        (onLord ? ` · 올해 시간주 ${lord}` : ''),
    });
    // 시간주에 걸린 각은 결도 더 세게 센다
    if (onLord) bump(tend, PLANET_TENDENCY[h.planet], 0.5);
    bump(tend, PLANET_TENDENCY[h.planet], relevant ? 1 : 0.4);
    if (h.house === 4) tend.정착 = (tend.정착 ?? 0) + 1;
    if (h.house === 9 || h.house === 3) tend.장거리 = (tend.장거리 ?? 0) + 1;
    if (h.house === 2) tend.보상 = (tend.보상 ?? 0) + 1;
    if (h.house === 6) tend.환경 = (tend.환경 ?? 0) + 1;
  }

  // 트랜싯 행성이 그 분야의 하우스를 지나는 것만으로도 그 자리가 켜진다
  for (const [p, hn] of Object.entries(t.inHouse ?? {})) {
    if (HOUSE_DOMAIN[hn] === domain) {
      votes.push({ system: '점성술', w: 0.6, why: `${p}이 ${hn}하우스를 지나는 중` });
      bump(tend, PLANET_TENDENCY[p], 0.5);
    }
  }

  // 진행 달이 별자리나 하우스를 갈아타면 국면이 바뀐다
  const pm = m.western?.progressed;
  if (pm?.moonHits?.length) {
    for (const mh of pm.moonHits.slice(0, 2)) {
      votes.push({ system: '점성술', w: 0.8, why: `진행 달이 ${mh.target}에 ${mh.aspect}` });
    }
  }
  return { votes, tend };
}

/** 베딕 한 달 */
function readVedic(m, domain) {
  const votes = [];
  const tend = {};
  const d = m.vedic?.dasha;
  const g = m.vedic?.gochara;

  if (d?.ad) {
    // 그 달 안에 안타르다샤가 바뀌면 국면 전환이다
    const st = d.ad.from;
    if (st && st.y === m.from.y && st.m === m.from.m) {
      votes.push({ system: '베딕', w: 2, why: `안타르다샤가 ${d.ad.lord}로 바뀌는 달` });
      tend.전환 = (tend.전환 ?? 0) + 1.5;
    } else {
      votes.push({ system: '베딕', w: 0.7, why: `${d.md.lord}–${d.ad.lord} 다샤 안` });
    }
  }
  if (d?.pd?.from && d.pd.from.y === m.from.y && d.pd.from.m === m.from.m) {
    votes.push({ system: '베딕', w: 1, why: `프라탼타르다샤가 ${d.pd.lord}로 바뀜` });
  }
  if (g) {
    if (g.sadeSati) {
      votes.push({ system: '베딕', w: 1.2, why: `사데사티 ${g.sadeSatiPhase} — 눌리고 다져지는 구간` });
      tend.비자발 = (tend.비자발 ?? 0) + 1;
      tend.제도화 = (tend.제도화 ?? 0) + 0.5;
    }
    if (g.jupiterFavorable) {
      votes.push({ system: '베딕', w: 1, why: '목성 고차라가 달에서 순한 자리' });
      tend.확대 = (tend.확대 ?? 0) + 1;
    }
    for (const r of g.rows) {
      if (domain === '직업' && r.fromMoon === 10) {
        votes.push({ system: '베딕', w: 1, why: `${r.planet}이 달에서 열 번째 자리(직업)를 지남` });
      }
      if ((domain === '주거' || domain === '이사') && r.fromMoon === 4) {
        votes.push({ system: '베딕', w: 1, why: `${r.planet}이 달에서 네 번째 자리(집)를 지남` });
      }
      if (domain === '결혼' && r.fromMoon === 7) {
        votes.push({ system: '베딕', w: 1, why: `${r.planet}이 달에서 일곱 번째 자리(짝)를 지남` });
      }
    }
  }
  return { votes, tend };
}

// ─────────────────────────────────────────────────────────────
// LEVEL 2 + 시간 구간 점수화
// ─────────────────────────────────────────────────────────────

/** 기존 열두 달 점수가 있으면 보태 준다 — 이미 보정된 값이라 그대로 쓴다 */
const AREA_OF = {
  직업: '직장운', 재물: '금전운', 관계: '애정운', 결혼: '애정운',
  주거: '총운', 이사: '총운', 건강: '건강운', 학업: '학업운', 자녀: '애정운',
};

/** 한 달을 점수로 — 어디까지나 그 사람 안에서의 상대값이다 */
export function scoreMonth(m, domain) {
  // ── 베딕은 시기 판단에서 뺐다 ──────────────────────────────
  //
  // 빼기로 한 것은 취향이 아니라 측정 결과다. 같은 명반 360달에서
  //
  //   체계        결(tend)이 빈 달   서로 다른 결의 가짓수
  //   점성술            0%              360   ← 달마다 다르다
  //   자미두수           0%              329
  //   사주              0%              203
  //   베딕          41~45%              5~7   ← 30년이 예닐곱 덩어리
  //
  // 베딕이 하는 말의 357/360 이 "…다샤 안"(w 0.7)이라는 상수다. 결을 내는
  // 자리가 셋뿐이고(안타르다샤 전환·사데사티·목성 고차라), 사데사티는
  // 7년 반을 통째로 같은 값으로 채운다.
  //
  // 그래서 알려진 실제 사건 여섯 건을 베딕만으로 채점하면 **여섯 건 모두
  // 동률 덩어리에 빠져 잴 수 없다**(그중 하나는 540달 전부가 같은 값이었다).
  // 점수에는 매달 1.56 을 보태 활성도만 부풀리고, '지지 체계'로는 360달 중
  // 0번 세어졌다. 아무 말도 못 하면서 '핵심 넷 중 하나'로 계산되던 것이다.
  //
  // **다샤·고차라 계산은 그대로 남는다** — [A] 계산 사실로 문맥에 실리고
  // (vedicJson), 프로파일·재물 층도 그대로 쓴다. 여기서 빠지는 것은
  // **달의 순위를 매기는 일**뿐이다.
  //
  // 되돌리려면 readVedic 이 달마다 다른 결을 내도록 먼저 고쳐야 한다.
  // 고차라 표가 votes 만 올리고 tend 를 내지 않는 것이 출발점이다.
  const parts = {
    사주: readBazi(m, domain),
    자미두수: readZiwei(m, domain),
    점성술: readWestern(m, domain),
  };

  const tend = {};
  const bySystem = {};
  let total = 0;
  for (const [name, p] of Object.entries(parts)) {
    const s = p.votes.reduce((t, v) => t + v.w, 0);
    // 체계별 tend 를 남긴다. 합치고 나면 **어느 체계가 그 결을 냈는지**
    // 알 수 없게 되는데, 그걸 모르면 "넷 중 하나가 실제로 맞히고 있는가"를
    // 영영 잴 수 없다. 점수 계산에는 쓰지 않고 계측에만 쓴다.
    bySystem[name] = { score: Math.round(s * 100) / 100, votes: p.votes, tend: p.tend };
    total += s;
    bump(tend, p.tend);
  }

  // 기존 엔진이 낸 그 달의 영역 점수는 **합산에 넣지 않는다.**
  //
  // 넣었다가 뺐다. 그 점수는 readForecast 가 계산하는 올해 열두 달에만 있고
  // 이듬해부터는 없다. 그런데 이 점수가 들어가면 올해 달들만 폭이 넓어지고,
  // 우리는 여러 해 가운데 **가장 높은 달**을 고르므로 폭이 넓은 쪽이 이긴다.
  // 실제로 명반 120개를 돌려 보니 직업·결혼·재물 세 분야가 모두 첫해 2월을
  // 최빈 답으로 내놓았다 — 그 사람이 아니라 계산 구조가 만든 답이었다.
  //
  // 해마다 15체계를 다시 돌려 채울 수도 있지만, 그러면 핵심 넷을 두 번 세는
  // 셈이 된다(아래 parts 가 이미 그 넷이다). 빼는 쪽이 맞다.
  // 화면 표시용으로만 들고 간다.
  const area = m.areas?.[AREA_OF[domain]]?.score ?? null;

  const active = Object.entries(bySystem).filter(([, v]) => v.score >= 1.5).map(([k]) => k);
  // 여기서는 그 달 안의 몫으로만 잰다. **체계 자신의 평소와 견주는 일은
  // inferEvents 가** 창 전체를 본 다음에 한다 (markSupport 참조) — 한 달만
  // 보고서는 그 체계가 평소보다 높은지 알 수 없기 때문이다.
  const bar = Math.max(2.5, total * 0.2);
  const strong = Object.entries(bySystem).filter(([, v]) => v.score >= bar).map(([k]) => k);

  // 이 달이 어떤 사건처럼 생겼는가. total 이 "얼마나 시끄러운가"라면
  // 이쪽은 "무엇처럼 보이는가"다. 둘은 다른 질문이고 답도 다르다.
  const candidates = candidatesOf(tend, domain);
  const byName = Object.fromEntries(candidates.map((c) => [c.name, c.score]));

  return {
    key: m.key, year: m.year, index: m.index, label: m.label, from: m.from,
    total: Math.round(total * 100) / 100,
    bySystem, active, strong, tend,
    candidates, candidateScore: byName,
    areaScore: area,
  };
}

/** 백테스트용: 합의도·가중 합산 없이 각 체계가 직접 낸 월 점수만 읽는다. */
export function scoreSystemsForBenchmark(m, domain) {
  const parts = {
    saju: readBazi(m, domain),
    jamidusu: readZiwei(m, domain),
    astrology: readWestern(m, domain),
    vedic: readVedic(m, domain),
  };
  return Object.fromEntries(Object.entries(parts).map(([id, part]) => [id,
    Math.round(part.votes.reduce((total, vote) => total + vote.w, 0) * 100) / 100,
  ]));
}

/**
 * 사건 묶음 — 묻는 사람은 이름표를 가리지 않는다.
 *
 * "언제 이직했나"를 묻는 사람에게 스스로 옮겼는지 제안을 받았는지 조직이
 * 개편됐는지는 뒷이야기다. 그런데 셋을 따로 세면 답이 갈린다. 실제로
 * 그래서 틀렸다 — '자발적 이직'으로 골라 답했는데 그 달의 1위 후보는
 * '외부 제안으로 이동'이었다. 묶어서 재면 153위가 66위가 된다.
 *
 * 묶음은 **겹치지 않게** 만든다. 한 후보가 두 묶음에 들면 같은 달이 두 이름으로
 * 두 번 나와 "따로 세웠다"는 말이 무색해진다. '매수·매도'를 '이사'와 묶지 않은
 * 것도 그래서다 — 계약하는 달과 짐 옮기는 달은 실제로 다르다.
 */
const EVENT_FAMILIES = [
  ['자발적 이직', '외부 제안으로 이동', '조직 개편에 따른 이동'],
  ['결혼 논의', '상견례·약속', '예식·혼인신고'],
  ['이사', '전월세 계약'],
];

/** 묶음 안의 어느 이름으로 물어도 같은 묶음이 나오도록 펼쳐 둔다 */
export const EVENT_GROUPS = Object.fromEntries(
  EVENT_FAMILIES.flatMap((family) => family.map((name) => [name, family])),
);

/**
 * 한 달이 특정 사건처럼 보이는 정도.
 *
 * ── 왜 점유율인가 ──────────────────────────────────────────
 * 처음에는 **여유**(다른 후보보다 얼마나 앞서는가)로 쟀다. 그 발상 자체는
 * 맞다 — 합·충·사화·트랜싯이 많이 걸린 달은 **정반대 사건도 같이 오르므로**
 * 점수의 높낮이만으로는 새 만남과 관계 정리가 구별되지 않는다.
 *
 * 그런데 여유에는 결함이 있다. **달마다 크기가 달라 서로 비교할 수 없다.**
 * 시끄러운 달은 그냥 시끄럽다는 이유로 여유도 커진다. 조용한 달에서
 * 한 후보가 확실히 앞서도 여유는 작게 나온다.
 *
 * 점유율은 그 달의 후보 총량으로 나누므로 조용한 달과 시끄러운 달을
 * 같은 자로 잰다. "이 달은 40% 만큼 이 사건처럼 보인다"는 어느 달에서나
 * 같은 뜻이다.
 *
 * 실제 사건 두 건으로 다섯 지표를 재 봤다 (180달 중 순위, 낮을수록 좋음):
 *   여유        7위 / 113위   (합 120)
 *   후보 점수    58위 /  68위   (합 126)
 *   **점유율**   11위 /  66위   (합  77)  ← 채택
 *   여유×활성도   7위 / 115위   (합 122)
 *   1위여부+점수 36위 /  68위   (합 104)
 *
 * @param {object} row scoreMonth 결과
 * @param {string|string[]} event 사건 이름, 또는 묶어서 볼 이름들
 */
export function fitFor(row, event) {
  const group = Array.isArray(event) ? event : (EVENT_GROUPS[event] ?? [event]);
  const scores = group.map((g) => row.candidateScore?.[g]).filter((v) => v != null);
  if (!scores.length) return null;
  const mine = Math.max(...scores);

  const others = row.candidates.filter((c) => !group.includes(c.name)).map((c) => c.score);
  const margin = mine - (others.length ? Math.max(...others) : 0);
  // 그 달 후보들의 양수 총량. 0 이하인 후보는 "그렇게 안 보인다"는 뜻이라 뺀다
  const mass = row.candidates.filter((c) => c.score > 0).reduce((t, c) => t + c.score, 0);

  return {
    share: mass > 0 ? Math.round((mine / mass) * 1000) / 1000 : 0,
    margin: Math.round(margin * 100) / 100,
    score: Math.round(mine * 100) / 100,
  };
}

/**
 * "이 체계가 이 달을 지지했다"를 체계 **자신의 평소와 견주어** 다시 매긴다.
 *
 * 절대 점수로 재면 말이 안 된다. 같은 명반 360달을 재 보니 이랬다.
 *
 *   체계       '지지했다'로 센 달   평균 점수
 *   점성술        360/360 (100%)     10.37   ← 언제나 지지한다 = 아무 뜻 없음
 *   자미두수       327/360  (91%)      8.76
 *   사주          236/360  (66%)      5.93
 *   베딕            0/360   (0%)      1.56   ← 한 번도 지지하지 않는다
 *
 * 그래서 "핵심 넷 중 셋이 지지했다"가 **거의 자동으로 참**이 됐다. 점성술은
 * 언제나, 자미두수는 열에 아홉, 사주는 셋에 둘이니 셋은 기본값이지 근거가
 * 아니다. 그 위에 세운 단언 등급도 같이 부풀었다.
 *
 * 체계마다 점수의 자릿수가 다른 것이 원인이다. 평균 10인 체계에게 2.5는
 * 낮고 평균 1.5인 체계에게는 닿을 수 없다. 그러니 **그 체계가 이 창에서
 * 평소보다 높은 달인가**로 묻는다 — 자기 분포의 위 4분의 1.
 *
 * 결(tend)을 내지 않은 달은 세지 않는다. 베딕은 달의 41~45%에서 결이
 * 비어 있는데(360달에 서로 다른 결이 대여섯 가지뿐이다), 그런 달을
 * '지지'로 세면 60달이 통째로 같은 말을 하는 셈이 된다.
 */
function markSupport(rows) {
  const names = Object.keys(rows[0]?.bySystem ?? {});
  for (const name of names) {
    const scores = rows.map((r) => r.bySystem[name].score).sort((a, b) => a - b);
    // 위 4분의 1 — 그 체계 자신의 분포에서
    const cut = scores[Math.floor(scores.length * 0.75)];
    for (const r of rows) {
      const v = r.bySystem[name];
      const hollow = !v.tend || Object.keys(v.tend).length === 0;
      v.supports = !hollow && v.score >= cut && v.score > 0;
    }
  }
  for (const r of rows) {
    r.strong = names.filter((n) => r.bySystem[n].supports);
  }
  return rows;
}

/**
 * 달을 가르지 못하는 후보를 걸러내는 선 (점유율 %p).
 *
 * 어떤 후보는 **어느 달에 넣어도 같은 값**이 나온다. 계산식이 달마다
 * 변하는 항에 거의 기대지 않기 때문이다. 그런 후보도 정렬하면 1위가
 * 나오지만 그 1위는 아무 뜻이 없다 — `compareZones` 가 도시를 헛되이
 * 줄 세웠던 것과 같은 함정이다. 그때처럼 **없으면 없다고 말한다.**
 *
 * 선은 한 명반이 아니라 **다섯 명반**에서 쟀다. 후보마다 "가장 높은 달의
 * 점유율 − 중간 달의 점유율"을 19년(228달) 치 구해 본 값이다.
 *
 *   부업 병행        2.6 ~ 3.7 %p  ← 가르지 못함
 *   타지역 이동       2.5 ~ 5.2 %p  ← 가르지 못함
 *   ────────────────────────────  틈
 *   직무·역할 변경     6.3 ~ 7.7 %p
 *   동거 시작        5.3 ~ 8.1 %p
 *   (나머지는 모두 그 위, 최대 58 %p)
 *
 * 5.2 와 6.3 사이가 비어 있어 6 %p 로 끊었다. 명반마다 다시 재므로
 * 어떤 사람에게는 가르고 어떤 사람에게는 못 가르는 후보도 제대로 잡힌다.
 */
const FLAT_SPREAD = 0.06;

/**
 * 1등이 혼자 서 있어야 1등이다 — 같은 값으로 인쇄되는 달이 이만큼 있으면
 * 하나를 고르지 않는다.
 *
 * 셋으로 끊은 이유는 임계값을 고른 게 아니라 **말의 뜻**이다. 하나면 유일하고,
 * 둘이면 "둘 중 하나"라고 말할 수 있지만, 셋부터는 그냥 평탄면이다.
 * 기준은 화면에 적히는 정밀도(정수 %)다 — 인쇄해서 구별되지 않는 것을
 * 순위로 구별하는 척하지 않는다.
 */
const TIED_TOP = 3;

/** 최강·강함·보조·약함 — 절대 점수가 아니라 이 사람 안에서의 순위다 */
function bandOf(rank, n) {
  const p = rank / Math.max(1, n - 1);
  return p <= 0.08 ? '최강' : p <= 0.25 ? '강함' : p <= 0.55 ? '보조' : '약함';
}

/** 이어지는 달을 한 구간으로 묶는다 */
function groupRuns(rows) {
  const out = [];
  let run = null;
  for (const r of rows) {
    const contiguous = run &&
      ((r.year === run.endYear && r.index === run.endIndex + 1) ||
       (r.year === run.endYear + 1 && run.endIndex === 11 && r.index === 0));
    if (contiguous) {
      run.endYear = r.year; run.endIndex = r.index; run.to = r.from; run.members.push(r);
      continue;
    }
    if (run) out.push(run);
    run = {
      startYear: r.year, endYear: r.year, startIndex: r.index, endIndex: r.index,
      from: r.from, to: r.from, members: [r],
    };
  }
  if (run) out.push(run);
  return out;
}

// ─────────────────────────────────────────────────────────────
// LEVEL 3~5
// ─────────────────────────────────────────────────────────────

/**
 * 성향 두 축 가운데 어디로 기우는가.
 *
 * 기울기는 **차이의 절대량이 아니라 비율**로 본다. 여러 달을 합치면 양쪽
 * 값이 다 커져서, 절대 차이로 재면 거의 모든 축이 '뚜렷'으로 나온다.
 * 실제로 그렇게 짜 보니 여섯 축이 전부 '뚜렷'이 되어 아무 말도 아니게 됐다.
 */
function lean(tend, aKeys, bKeys) {
  const a = aKeys.reduce((t, k) => t + (tend[k] ?? 0), 0);
  const b = bKeys.reduce((t, k) => t + (tend[k] ?? 0), 0);
  const sum = a + b;
  if (sum < 2) return { side: null, strength: '근거 부족', a, b };
  const ratio = Math.abs(a - b) / sum;
  return {
    side: a === b ? null : a > b ? 'a' : 'b',
    strength: ratio >= 0.35 ? '뚜렷' : ratio >= 0.12 ? '약간' : '팽팽',
    a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10,
  };
}

const AXIS_KEYS = {
  자발성: [['자발', '독립'], ['비자발']],
  경력: [['유지', '제도화'], ['전환']],
  조직규모: [['확대', '제도화'], ['축소']],
  보상: [['보상'], ['환경', '안정형']],
  거리: [['정착', '안정형'], ['장거리']],
  조직성격: [['안정형', '제도화'], ['성장형']],
  규모: [['확대'], ['축소']],
  형태: [['유지', '제도화'], ['전환']],
  속도: [['자발', '전환'], ['안정형', '준비']],
  주도: [['자발'], ['비자발']],
  방향: [['보상', '확대'], ['축소']],
  경로: [['보상'], ['전환']],
};

/** LEVEL 4 — 사건 속성 */
export function attributesOf(tend, domain) {
  const axes = ATTRIBUTE_AXES[domain] ?? ATTRIBUTE_AXES.직업;
  return axes.map((ax) => {
    const [aK, bK] = AXIS_KEYS[ax.key] ?? [[], []];
    const l = lean(tend, aK, bK);
    return {
      key: ax.key,
      a: ax.a, b: ax.b,
      lean: l.side === 'a' ? ax.a : l.side === 'b' ? ax.b : null,
      strength: l.strength,
    };
  });
}

/** LEVEL 3 — 사건 후보에 점수를 매긴다 */
export function candidatesOf(tend, domain) {
  const list = EVENT_CANDIDATES[domain] ?? [];
  const t = (k) => tend[k] ?? 0;

  const table = {
    '현 직장 유지': t('유지') + t('안정형') + t('제도화') * 0.5 - t('전환'),
    '자발적 이직': t('자발') + t('전환') + t('독립') * 0.5 - t('비자발') * 0.5,
    '외부 제안으로 이동': t('확대') + t('보상') + t('전환') * 0.5,
    '직무·역할 변경': t('전환') * 0.8 + t('유지') * 0.8 + t('제도화') * 0.4,
    '조직 개편에 따른 이동': t('비자발') + t('전환') * 0.6,
    '승진·보상 조정': t('제도화') + t('보상') + t('확대') * 0.6 - t('전환') * 0.5,
    '퇴사 후 공백': t('비자발') * 0.6 + t('축소') - t('보상'),
    '창업·독립': t('독립') + t('자발') * 0.6 - t('제도화'),
    '부업 병행': t('성장형') * 0.5 + t('보상') * 0.4,

    '수입 증가': t('보상') + t('확대'),
    '큰 지출': t('축소') + t('비자발') * 0.5,
    '묶인 돈이 풀림': t('확정') + t('확대') * 0.5,
    '대출·빚 정리': t('제도화') + t('축소') * 0.5,
    '계약·정산': t('확정') + t('제도화') * 0.5,
    '투자 손실 정리': t('축소') + t('전환') * 0.4,

    '새 만남': t('확대') + t('자발') * 0.5,
    '관계 정리': t('전환') + t('축소') * 0.5,
    '오래된 갈등이 터짐': t('비자발') + t('경쟁'),
    '거리 조정': t('안정형') * 0.5 + t('환경') * 0.5,

    '교제 시작': t('확대') + t('자발') * 0.5,
    '결혼 논의': t('확정') + t('제도화'),
    '상견례·약속': t('확정') * 0.8 + t('안정형') * 0.5,
    '예식·혼인신고': t('확정') + t('제도화') * 0.8,
    '동거 시작': t('확정') * 0.6 + t('정착') * 0.8,

    '이사': t('전환') + t('정착') * 0.6,
    '독립': t('독립') + t('자발') * 0.5,
    '동거': t('확정') + t('정착') * 0.5,
    '전월세 계약': t('확정') + t('제도화') * 0.5,
    '매수·매도': t('보상') + t('확대') * 0.6 + t('정착') * 0.5,
    '주거 환경 개선': t('환경') + t('안정형') * 0.5,

    '근거리 이사': t('정착') + t('안정형') * 0.5 - t('장거리'),
    '타지역 이동': t('장거리') + t('전환') * 0.5,
    '통근 조건 변화': t('환경') + t('전환') * 0.4,
    '해외·장거리': t('장거리') * 1.2 + t('성장형') * 0.4,

    '누적 피로': t('비자발') + t('경쟁') * 0.5,
    '검진·치료 시작': t('제도화') * 0.6 + t('환경') * 0.6,
    '생활 리듬 재편': t('환경') + t('안정형') * 0.5,

    '시험·자격 준비': t('준비') + t('제도화') * 0.5,
    '합격·수료': t('확정') + t('제도화') * 0.5,
    '진학·전공 전환': t('전환') + t('준비') * 0.5,

    '임신·출산': t('확정') + t('정착') * 0.6,
    '자녀 계획 논의': t('준비') + t('확정') * 0.5,
    '육아와 일의 충돌': t('경쟁') + t('비자발') * 0.6,
    '자녀 문제로 생활 재편': t('전환') + t('환경') * 0.5,
  };

  return list
    .map((name) => ({ name, score: Math.round((table[name] ?? 0) * 100) / 100 }))
    .sort((a, b) => b.score - a.score);
}

/**
 * LEVEL 5 — 한 사건이 지나가는 네 국면.
 *
 * 하나의 운을 "이직운"으로 뭉뚱그리지 않으려면 준비·발생·확정·정착을
 * 갈라야 한다. 각 달의 신호 성질로 가른다.
 */
const PHASE_KEYS = {
  준비기: ['준비', '경쟁'],
  발생기: ['전환', '비자발', '자발'],
  확정기: ['확정', '제도화'],
  정착기: ['정착', '안정형'],
};

/**
 * 낱말 수로 나눠 평균을 쓴다. 그냥 더하면 낱말을 셋 가진 '발생기'가
 * 늘 이겨서 모든 달이 발생기로 찍힌다 — 실제로 그렇게 나왔다.
 */
export function phaseOf(row) {
  const scores = Object.entries(PHASE_KEYS).map(([k, keys]) => [
    k, keys.reduce((t, x) => t + (row.tend[x] ?? 0), 0) / keys.length,
  ]).sort((a, b) => b[1] - a[1]);
  // 1등과 2등이 거의 같으면 국면을 정하지 않는다. 억지로 붙이지 않는다.
  if (scores[0][1] <= 0) return null;
  if (scores[1] && scores[0][1] - scores[1][1] < scores[0][1] * 0.15) return null;
  return scores[0][0];
}

/** §14 — 신뢰도 등급 */
export function confidenceOf(activeSystems) {
  const n = activeSystems.length;
  return n >= 3 ? { grade: 'B', text: '강한 교차 신호 — 핵심 체계 3개 이상이 같은 주제를 지지' }
    : n === 2 ? { grade: 'C', text: '중간 교차 신호 — 핵심 체계 2개가 지지' }
    : { grade: 'D', text: '약한 해석 — 한 체계만 지지하거나 상충 근거가 있음' };
}

// ─────────────────────────────────────────────────────────────
// 바깥에서 쓰는 입구
// ─────────────────────────────────────────────────────────────

/**
 * 격자 하나에서 한 분야의 사건 추론을 통째로 만든다.
 *
 * @param {object} grid buildGrid 결과
 * @param {string} domain
 */
/**
 * @param {object} grid buildGrid 결과
 * @param {string} domain
 * @param {object} [opts]
 * @param {string} [opts.event] 특정 사건을 물었을 때 그 이름.
 *   주면 그 사건에 맞춰 달을 고른다. 없으면 그 기간에 가장 두드러진
 *   후보를 스스로 골라 그것에 맞춘다.
 */
export function inferEvents(grid, domain, opts = {}) {
  // 창 전체를 본 뒤에야 "이 체계가 평소보다 높은 달인가"를 물을 수 있다
  const rows = markSupport(grid.months.map((m) => scoreMonth(m, domain)));

  // ── 사건을 지정했는가, 안 했는가 ──
  //
  // 이 갈림이 중요하다. 실제 사례로 재 보고 알았다.
  //   사건을 지정하면        — 180달 중 7위 (상위 4%)
  //   기간에서 자동으로 고르면 — 180달 중 177위
  // 자동 선택이 정반대 사건('관계 정리')을 골라 버렸기 때문이다.
  //
  // 엔진은 **주어진 사건이 언제인지**는 제법 고르지만 **어떤 사건이
  // 일어날지**는 고르지 못한다. 그래서 짐작해서 하나를 고르지 않는다.
  // 지정하지 않으면 "그 영역이 언제 시끄러운가"(total)로만 줄을 세우고,
  // 사건별 달은 아래 perEvent 에 따로 담아 둔다.
  // 그 분야에 없는 사건을 받으면 조용히 무시하지 않는다. 무시하면 활성도로
  // 줄을 세우고도 "사건에 맞춰 골랐다"고 말하게 된다.
  const known = EVENT_CANDIDATES[domain] ?? [];
  const eventNotFound = !!opts.event && !known.includes(opts.event);
  const focusEvent = eventNotFound ? null : (opts.event ?? null);

  for (const r of rows) {
    const f = focusEvent ? fitFor(r, focusEvent) : null;
    // 줄을 세우는 값은 점유율이다. 여유와 원점수도 함께 들고 다닌다 —
    // 답변에서 "이 달은 이 사건처럼 보인다"를 설명할 때 쓴다
    r.fit = f ? f.share : null;
    r.fitDetail = f;
    r.focusEvent = focusEvent;
  }
  const ranked = rows.slice().sort((a, b) => focusEvent
    ? ((b.fit - a.fit) || (b.total - a.total))
    : (b.total - a.total));
  const rankOf = new Map(ranked.map((r, i) => [r.key, i]));

  // 사건마다 따로 줄을 세운다. "이직을 묻는다면 이 달, 퇴사를 묻는다면 저 달"
  // 이라고 말할 수 있어야 한다 — 한 줄로 뭉치면 정반대 사건이 섞인다.
  // 묶인 사건은 한 줄로만 낸다. 묶음 안의 이름을 하나씩 다 내면 똑같은 달
  // 목록이 세 번 나오고, 읽는 쪽은 그게 세 개의 근거인 줄 안다.
  const perEvent = {};
  const done = new Set();
  // 달을 가르지 못하는 후보의 이름. 아래 '사건 후보'·'주 시나리오' 줄에서도
  // 같은 표시를 달아야 한다 — 한쪽에서만 막으면 다른 쪽이 답이 된다
  const flatEvents = new Set();
  for (const name of EVENT_CANDIDATES[domain] ?? []) {
    const group = EVENT_GROUPS[name] ?? [name];
    if (done.has(group[0])) continue;
    done.add(group[0]);
    const scored = rows
      .map((r) => ({ row: r, f: fitFor(r, group) }))
      .filter((x) => x.f)
      .sort((a, b) => (b.f.share - a.f.share) || (b.row.total - a.row.total));
    if (!scored.length) continue;

    // 이 후보가 달을 **가르기는 하는가**. 가르지 못하면 순위를 내지 않는다.
    //
    // 두 가지를 따로 본다. 하나만 보면 놓친다.
    //   ① 어디나 똑같은가 — 최고와 중간의 차이(spread)
    //   ② **1등이 혼자 서 있는가** — 같은 값으로 인쇄되는 달이 몇 개인가
    //
    // ②가 필요한 이유: 최고 48% / 중간 39% 라 ①은 통과하는데, 상위 열두 달이
    // 48~47% 로 몰려 1998년부터 2017년까지 걸쳐 있는 후보가 실제로 있었다.
    // "1위는 2014년 11월"이라고 내놓으면 20년 폭의 동률에서 하나를 뽑아
    // 단정하는 셈이다. 화면에 적히는 정밀도(정수 %)로 구별되지 않으면
    // 구별되지 않는다고 말한다.
    const shares = scored.map((x) => x.f.share);
    const typical = shares[Math.floor(shares.length / 2)];
    const spread = shares[0] - typical;
    const pc = (v) => Math.round(v * 100);
    const tied = shares.filter((v) => pc(v) === pc(shares[0])).length;
    const flat = spread < FLAT_SPREAD || tied >= TIED_TOP;

    if (flat) for (const g of group) flatEvents.add(g);

    perEvent[group.length > 1 ? group.join(' / ') : name] = {
      flat,
      spread: Math.round(spread * 1000) / 10, // %p
      tied,
      top: Math.round(shares[0] * 1000) / 10,
      typical: Math.round(typical * 1000) / 10,
      // 가르지 못하는 후보는 달 목록 자체를 만들지 않는다. 만들어 두면
      // 어딘가에서 반드시 쓰이고, 쓰이면 뜻 없는 순위가 답이 된다.
      months: flat ? [] : scored.slice(0, 5).map((x) => ({
        label: x.row.label, year: x.row.year, from: x.row.from,
        share: x.f.share, margin: x.f.margin, total: x.row.total, systems: x.row.strong,
      })),
    };
  }

  for (const r of rows) {
    r.band = bandOf(rankOf.get(r.key), rows.length);
    r.phase = phaseOf(r);
  }

  const strong = rows.filter((r) => r.band === '최강' || r.band === '강함');
  const windows = groupRuns(strong).map((w) => {
    const tend = {};
    const systems = new Set();
    const reasons = [];
    for (const m of w.members) {
      bump(tend, m.tend);
      for (const s of m.active) systems.add(s);
      for (const [name, v] of Object.entries(m.bySystem)) {
        for (const vote of v.votes.slice(0, 2)) reasons.push({ month: m.label, system: name, why: vote.why, w: vote.w });
      }
    }
    const best = w.members.slice().sort((a, b) => focusEvent
      ? ((b.fit - a.fit) || (b.total - a.total))
      : (b.total - a.total))[0];
    return {
      label: `${w.from.y}년 ${w.from.m}/${w.from.d}~${w.to.m}월`,
      fromYear: w.startYear,
      from: w.from, to: w.to,
      months: w.members.length,
      band: w.members.some((m) => m.band === '최강') ? '최강' : '강함',
      // 정점 달에서 실제로 말한 체계만 따로 들고 간다. 구간 전체의 합집합을
      // 쓰면 넉 달 동안 네 체계가 한 번씩만 끼어도 '넷이 합의'가 되어 버린다.
      peakKey: best.key,
      peak: { label: best.label, year: best.year, from: best.from, phase: best.phase,
              systems: best.strong },
      phases: w.members.map((m) => ({ label: m.label, phase: m.phase, band: m.band })),
      systems: [...systems],
      confidence: confidenceOf([...systems]),
      tend,
      reasons: reasons.sort((a, b) => b.w - a.w).slice(0, 6),
    };
  });

  // 어느 구간이 '그' 구간인가.
  //
  // windows 는 시간 순서다. 그래서 `windows.find(band==='최강')` 으로 집으면
  // 최강 구간이 여럿일 때 **언제나 가장 이른 것**이 뽑힌다. 명반 60개를 돌려
  // 보니 절기월 위치별 1위 횟수가 16,11,6,6,4,2,… 로 앞쪽에 쏠렸는데
  // 달별 평균 점수는 26.4~27.6 으로 평평했다. 즉 사람이 아니라 고르는 방식이
  // 만든 쏠림이었다. 점수가 가장 높은 달이 든 구간을 집는다.
  const keyOf = (w) => rows.find((r) => r.key === w.peakKey);
  const bestWindow = windows.slice().sort((a, b) => {
    const pa = keyOf(a), pb = keyOf(b);
    return focusEvent
      ? (((pb?.fit ?? 0) - (pa?.fit ?? 0)) || ((pb?.total ?? 0) - (pa?.total ?? 0)))
      : ((pb?.total ?? 0) - (pa?.total ?? 0));
  })[0] ?? null;

  // 전체 성향 — 강한 구간의 신호만 모은다
  const overall = {};
  for (const w of windows) bump(overall, w.tend);
  if (!windows.length) for (const r of rows) bump(overall, r.tend, 0.3);

  const cands = candidatesOf(overall, domain);
  const attrs = attributesOf(overall, domain);

  // §15 — 상충. 같은 축의 양쪽이 모두 두툼하면 숨기지 않는다
  const conflicts = attrs
    .filter((a) => a.strength === '팽팽')
    .map((a) => `${a.key}: ${a.a} / ${a.b} 양쪽 근거가 비슷하다`);

  // §16 — 주 / 대안 / 반대
  const main = cands[0] ?? null;
  const alternative = cands.find((c) => c !== main && c.score > 0) ?? cands[1] ?? null;
  const contrary = cands.slice().reverse().find((c) => c.score < 0) ?? null;

  const activeSystems = [...new Set(windows.flatMap((w) => w.systems))];

  return {
    domain,
    // 어느 사건에 맞춰 달을 골랐는가. 답변에서 이 사건 이름을 써야
    // "무엇이 언제"가 맞물린다 — 구간만 말하면 무슨 일인지가 빠진다
    focusEvent,
    // 사건마다 따로 세운 상위 다섯 달. 사건을 지정하지 않았을 때는
    // 구간(windows)이 "그 영역이 시끄러운 때"일 뿐이므로 이쪽을 함께 봐야 한다
    perEvent,
    // 이 후보들은 어느 달에 넣어도 같은 값이라 시기를 말할 수 없다
    flatEvents: [...flatEvents],
    eventNotFound: eventNotFound ? opts.event : null,
    rankedBy: focusEvent ? `사건 점유율(${focusEvent})`
      : eventNotFound ? `영역 활성도 (요청한 '${opts.event}' 는 ${domain} 분야의 후보가 아니다)`
      : '영역 활성도',
    span: { from: grid.fromYear, to: grid.toYear },
    rows,
    windows,
    // 시간 순서가 아니라 **점수가 가장 높은 달이 든** 구간. 시기를 하나만
    // 집어야 할 때는 반드시 이쪽을 쓴다 (windows[0] 을 쓰면 앞쪽이 유리하다)
    bestWindow,
    candidates: cands,
    attributes: attrs,
    conflicts,
    scenarios: {
      main: main && { name: main.name, weight: main.score > 0 ? '상대적으로 강함' : '근거 얇음' },
      alternative: alternative && { name: alternative.name, weight: '중간' },
      contrary: contrary && { name: contrary.name, note: '이 방향을 막는 신호가 있다' },
    },
    confidence: confidenceOf(activeSystems),
    activeSystems,
  };
}

/**
 * §12 — 사건 연쇄. 여러 분야의 최강 구간을 견줘 선후를 본다.
 * 같은 기간에 켜지는 영역들의 순서를 알아야 "직장이 먼저냐 이사가 먼저냐"에
 * 답할 수 있다.
 */
export function chainOf(inferences) {
  const peaks = inferences
    .map((inf) => {
      const w = inf.windows.find((x) => x.band === '최강') ?? inf.windows[0];
      return w ? {
        domain: inf.domain,
        at: w.peak.from,
        key: w.peak.year * 100 + w.peak.from.m,
        label: `${w.peak.from.y}년 ${w.peak.from.m}월 무렵`,
        band: w.band,
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.key - b.key);

  const order = peaks.map((p) => `${p.domain}(${p.label})`).join(' → ');
  const notes = [];
  for (let i = 1; i < peaks.length; i++) {
    const a = peaks[i - 1].domain, b = peaks[i].domain;
    notes.push(peaks[i].key === peaks[i - 1].key
      ? `${j(a, '과')} ${j(b, '이')} 같은 달에 겹친다`
      : `${j(a, '이')} ${b}보다 먼저다`);
  }
  return { peaks, order, notes };
}
