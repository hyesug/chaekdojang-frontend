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
export const EVENT_CANDIDATES = {
  직업: ['현 직장 유지', '자발적 이직', '외부 제안으로 이동', '직무·역할 변경',
        '조직 개편에 따른 이동', '승진·보상 조정', '퇴사 후 공백', '창업·독립', '부업 병행'],
  재물: ['수입 증가', '큰 지출', '묶인 돈이 풀림', '대출·빚 정리', '계약·정산', '투자 손실 정리'],
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

  for (const h of t.hits.slice(0, 10)) {
    const d = h.house ? HOUSE_DOMAIN[h.house] : null;
    const isAngle = h.targetKind === 'angle' || h.targetKind === 'ruler';
    const relevant = d === domain || isAngle;
    const base = (h.aspect === '합' ? 1.6 : h.aspect === '대각' || h.aspect === '사각' ? 1.4 : 1.0);
    const w = base * h.tight * (relevant ? 1.4 : 0.5) * (h.applying ? 1.15 : 0.9);
    votes.push({
      system: '점성술', w: Math.round(w * 100) / 100,
      why: `${h.planet}${h.retro ? '(역행)' : ''}이 ${h.target}에 ${h.aspect}` +
        `${h.applying ? ', 다가오는 중' : ', 멀어지는 중'}`,
    });
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
  const parts = {
    사주: readBazi(m, domain),
    자미두수: readZiwei(m, domain),
    점성술: readWestern(m, domain),
    베딕: readVedic(m, domain),
  };

  const tend = {};
  const bySystem = {};
  let total = 0;
  for (const [name, p] of Object.entries(parts)) {
    const s = p.votes.reduce((t, v) => t + v.w, 0);
    bySystem[name] = { score: Math.round(s * 100) / 100, votes: p.votes };
    total += s;
    bump(tend, p.tend);
  }

  // 기존 엔진이 이미 낸 그 달의 영역 점수. 새로 계산하지 않고 얹기만 한다
  const area = m.areas?.[AREA_OF[domain]]?.score ?? null;
  if (area != null) total += (area - 50) / 10;

  const active = Object.entries(bySystem).filter(([, v]) => v.score >= 1.5).map(([k]) => k);
  // 단언 등급에 쓰는 더 엄한 기준. 한마디 거든 것과 실제로 그 달을 끌고 간
  // 것은 다르다. 그 달 전체 무게의 20% 이상을 낸 체계만 '지지했다'로 센다.
  const bar = Math.max(2.5, total * 0.2);
  const strong = Object.entries(bySystem).filter(([, v]) => v.score >= bar).map(([k]) => k);

  return {
    key: m.key, year: m.year, index: m.index, label: m.label, from: m.from,
    total: Math.round(total * 100) / 100,
    bySystem, active, strong, tend,
    areaScore: area,
  };
}

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
export function inferEvents(grid, domain) {
  const rows = grid.months.map((m) => scoreMonth(m, domain));
  const ranked = rows.slice().sort((a, b) => b.total - a.total);
  const rankOf = new Map(ranked.map((r, i) => [r.key, i]));

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
    const best = w.members.slice().sort((a, b) => b.total - a.total)[0];
    return {
      label: `${w.from.y}년 ${w.from.m}/${w.from.d}~${w.to.m}월`,
      fromYear: w.startYear,
      from: w.from, to: w.to,
      months: w.members.length,
      band: w.members.some((m) => m.band === '최강') ? '최강' : '강함',
      // 정점 달에서 실제로 말한 체계만 따로 들고 간다. 구간 전체의 합집합을
      // 쓰면 넉 달 동안 네 체계가 한 번씩만 끼어도 '넷이 합의'가 되어 버린다.
      peak: { label: best.label, year: best.year, from: best.from, phase: best.phase,
              systems: best.strong },
      phases: w.members.map((m) => ({ label: m.label, phase: m.phase, band: m.band })),
      systems: [...systems],
      confidence: confidenceOf([...systems]),
      tend,
      reasons: reasons.sort((a, b) => b.w - a.w).slice(0, 6),
    };
  });

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
    span: { from: grid.fromYear, to: grid.toYear },
    rows,
    windows,
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
