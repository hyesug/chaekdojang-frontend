/**
 * router.js — 질문에 따라 계산량을 고른다
 *
 * 모든 질문에 모든 계산을 돌릴 필요가 없다. "어느 도시가 좋은가"에
 * 안타르다샤 전환일이 필요하지 않고, "올해 이직할까"에 릴로케이션 차트가
 * 필요하지 않다. 필요 없는 계산을 돌리면 화면이 느려지고, 문맥이 길어져
 * 정작 중요한 값이 묻힌다.
 *
 * 낱말로 가른다. 맞히지 못하면 '일반'으로 떨어뜨리고, 그때는 분야를
 * 좁히지 않았다는 사실을 문맥에 그대로 적는다 — 엉뚱한 분야를 골라
 * 그럴듯하게 답하는 것보다 낫다.
 */

import { CITIES } from '../core/place.js';
import { isHoraryQuestion } from '../systems/horary.js';

const RULES = [
  // 해외·여행이 어느 낱말 규칙에도 없어서 "해외여행 몇 번 가봤을까"가
  // 폴백으로 직업 분야에 떨어졌다. 그 후보('해외·장거리')는 이사 분야에
  // 있으므로 이쪽으로 보낸다. 나가고 들어오는 일을 한 분야에서 본다.
  { domain: '이사', words: ['이사', '이주', '전세', '월세', '집을 옮', '거처', '이삿', '이전',
                            '해외', '외국', '여행', '출국', '이민', '워홀', '주재원', '파견'] },
  { domain: '주거', words: ['집', '부동산', '아파트', '매매', '매수', '청약', '전셋', '내 집'] },
  { domain: '자녀', words: ['아이', '자녀', '출산', '임신', '아기', '둘째', '첫째'] },
  { domain: '결혼', words: ['결혼', '혼인', '예식', '상견례', '약혼', '청혼', '웨딩', '신혼'] },
  { domain: '관계', words: ['연애', '애인', '남친', '여친', '썸', '소개팅', '이별', '재회', '인연', '짝'] },
  // '직업'·'적성' 이 빠져 있었다. "직업 어때"가 직업으로 간 것은 낱말이
  // 걸려서가 아니라 **폴백이 마침 직업이라서**였고, 그래서 "직업이랑 재물
  // 어때"는 재물만 잡히고 직업은 통째로 빠졌다.
  { domain: '직업', words: ['직업', '적성', '이직', '직장', '회사', '취업', '퇴사', '승진', '연봉', '커리어', '일자리', '면접', '입사', '직무', '부서', '창업', '사업'] },
  { domain: '재물', words: ['돈', '재물', '재테크', '수입', '자산', '빚', '대출', '투자', '정산', '계약금',
                            '부자', '목돈', '상금', '지원금', '월급', '연봉'] },
  { domain: '건강', words: ['건강', '몸', '병', '수술', '치료', '검진', '체력', '아픈'] },
  { domain: '학업', words: ['공부', '시험', '자격', '학업', '합격', '진학', '유학', '전공'] },
];

/** 지역·방향을 묻는가 — 분야와 별개로 켠다 */
const PLACE_WORDS = ['어디', '지역', '도시', '방향', '방위', '남쪽', '북쪽', '동쪽', '서쪽',
                     '이사', '이주', '살면', '거주', '통근', '출퇴근', '수도권', '지방', '해외'];

/** 하루짜리 날짜를 묻는가 — 이때만 일진까지 내려간다 */
const DAY_WORDS = ['며칠', '날짜', '날 잡', '택일', '무슨 요일', '언제가 좋은 날', '길일', '개업일', '수술 날'];

/**
 * 횡재·비정기 재물을 묻는가.
 *
 * 이 낱말이 걸리면 고전 로트·재물 하우스·조디악 릴리징까지 돌린다.
 * 평소 재물 질문보다 봐야 할 자리가 훨씬 많기 때문이다.
 */
const WINDFALL_WORDS = ['횡재', '로또', '복권', '당첨', '대박', '한방', '목돈', '큰돈', '상금',
                        '지원금', '유산', '상속', '보험금', '한탕', '벼락부자'];

/** 평생 재물 곡선을 묻는가 */
const LIFETIME_WORDS = ['평생', '인생', '일생', '언제 부자', '언제쯤 부자', '노후', '말년', '전체적으로'];

/**
 * 질문이 **어떤 사건**을 묻는가.
 *
 * 이걸 집어내는 것이 생각보다 훨씬 중요하다. 실제 사례로 재 보니
 *   사건을 지정하면        180달 중 7위
 *   지정하지 않고 자동 선택 180달 중 177위
 * 였다. 엔진은 주어진 사건이 언제인지는 제법 고르지만, 어떤 사건이
 * 일어날지는 고르지 못한다. 정반대 사건('새 만남' vs '관계 정리')을
 * 골라 버리면 답이 뒤집힌다.
 *
 * 그래서 질문에서 사건을 읽어내면 반드시 그것에 맞춰 계산한다.
 * 읽어내지 못하면 **짐작하지 않고** 사건별 달을 따로 내놓는다.
 */
const EVENT_WORDS = [
  // 교제 시작도 '새 만남'으로 보낸다. 관계 분야에서 이 후보 하나가
  // 만남·교제 시작을 함께 본다 (계산식이 같은 후보를 둘 두면 서로의
  // 여유를 0으로 깎아 신호가 사라진다)
  ['새 만남', '관계', ['만남', '만나', '소개팅', '새 인연', '인연이',
                      '교제', '사귀', '연애 시작', '썸', '고백']],
  ['관계 정리', '관계', ['헤어', '이별', '정리', '끝나', '깨질']],
  ['예식·혼인신고', '결혼', ['예식', '혼인신고', '식을', '결혼식']],
  ['결혼 논의', '결혼', ['결혼', '혼인', '상견례', '청혼', '프러포즈']],
  ['자발적 이직', '직업', ['이직', '옮기', '회사를 바꾸', '새 직장']],
  ['퇴사 후 공백', '직업', ['퇴사', '그만둘', '그만두', '쉬는']],
  ['승진·보상 조정', '직업', ['승진', '연봉', '인상', '진급']],
  ['창업·독립', '직업', ['창업', '독립', '사업을 시작', '내 사업']],
  ['직무·역할 변경', '직업', ['부서', '직무', '역할', '보직']],
  ['이사', '이사', ['이사', '이삿']],
  ['해외·장거리', '이사', ['해외', '외국', '출국', '이민', '워홀', '유학', '주재원']],
  ['타지역 이동', '이사', ['타지역', '지방', '먼 곳', '멀리']],
  ['매수·매도', '주거', ['매수', '매도', '집을 사', '분양', '청약']],
  ['전월세 계약', '주거', ['전세', '월세', '계약']],
  ['임신·출산', '자녀', ['임신', '출산', '아기', '아이를 가']],
  ['수입 증가', '재물', ['수입', '돈이 들어', '벌이']],
];

/**
 * 횟수를 묻는 질문.
 *
 * "몇 번째 회사냐"는 시기 질문이 아니라 **개수 질문**이고, 이 엔진은 개수를
 * 세지 못한다. 그런데 못 센다고 말해 주지 않으면 답변이 달 순위를 받아
 * 봉우리를 세어 버린다. 그래서 질문이 개수를 묻는지 먼저 가린다.
 */
const COUNT_WORDS = /몇 ?번|몇 ?군데|몇 ?개|몇 ?곳|몇 ?차례|횟수|얼마나 자주|여러 ?번/;

/**
 * 되는가 안 되는가를 묻는 질문.
 *
 * "서류 붙었을까"는 시기 질문이 아니라 **판정 질문**이고, 이 엔진은 판정을
 * 하지 못한다. 달 순위는 그 사람의 여러 시기를 서로 견준 값이지, 바깥
 * 상대(회사·학교·심사위원)가 예라고 할지를 재는 자가 아니다.
 *
 * 게다가 후보 목록이 한쪽으로만 서 있다. 아홉 분야 가운데 **여섯에는
 * '안 된 쪽' 후보가 없다** — 학업에는 '합격·수료'만 있고 '불합격'이 없고,
 * 결혼에는 '예식·혼인신고'만 있고 '무산'이 없다. 그러니 그 분야에서 나오는
 * 점수는 아무리 높아도 "된다"를 뜻할 수 없다. 질 상대가 없기 때문이다.
 *
 * 실제로 이것 때문에 틀렸다. '합격·수료 상위 17%'를 근거로 서류합격을
 * 단언했고, 결과는 불합격이었다.
 */
const OUTCOME_STRONG = /합격|불합격|붙[을었]|떨어[질졌]|탈락|당첨|통과/;

/**
 * 약한 판정 낱말 — 시기 낱말과 같이 오면 판정이 아니라 시기 질문이다.
 * "언제 이직하게 **될까**"는 되는지를 묻는 게 아니라 언제인지를 묻는다.
 */
const OUTCOME_WEAK = /될까|되나|되려나|가능할까|성공|잘 ?되/;
const WHEN_WORDS = /언제|시기|몇 ?월|몇 ?년|어느 ?달|어느 ?해|타이밍/;

const asksOutcomeOf = (q) =>
  OUTCOME_STRONG.test(q) || (OUTCOME_WEAK.test(q) && !WHEN_WORDS.test(q));

/**
 * 그 분야의 후보 목록에 **'안 된 쪽'** 이 있는가.
 *
 * 있으면 점수 싸움이 성립한다(새 만남 vs 관계 정리). 없으면 점수가 아무리
 * 높아도 "된다"를 뜻하지 못한다 — 질 상대가 없기 때문이다.
 * EVENT_CANDIDATES 를 고치면 여기도 같이 고쳐야 한다.
 */
const NEGATIVE_CANDIDATES = {
  직업: true,   // 현 직장 유지 · 퇴사 후 공백
  재물: true,   // 큰 지출 · 투자 손실 정리
  관계: true,   // 관계 정리 · 거리 조정
  결혼: false, 주거: false, 이사: false, 건강: false, 학업: false, 자녀: false,
};

/** 생활권을 넘는 이동의 낌새. 같은 동네 이사는 일과 덜 엮인다 */
const INTERCITY_MOVE = /타지역|지방|수도권|먼 ?곳|멀리|상경|내려가|올라가|이주|전근|발령/;

/** 질문에서 사건 하나를 집어낸다. 못 집어내면 null */
export function eventFromQuestion(q) {
  const hits = EVENT_WORDS
    .map(([event, domain, words]) => {
      const at = words.map((w) => q.indexOf(w)).filter((i) => i >= 0);
      return at.length ? { event, domain, at: Math.min(...at) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
  return hits[0] ?? null;
}

/** 몇 해를 볼 것인가 */
function spanFromQuestion(q, thisYear) {
  // 평생을 물으면 넓게 본다. 십 년 단위 곡선은 이 범위 안에서 만든다
  if (/평생|인생|일생|노후|말년/.test(q)) return { fromYear: thisYear, years: 6 };
  const years = [...q.matchAll(/(20\d{2})\s*년?/g)].map((m) => Number(m[1]))
    .filter((y) => y >= thisYear - 30 && y <= thisYear + 30);
  if (years.length) {
    const from = Math.min(...years, thisYear);
    const to = Math.max(...years);
    return { fromYear: from, years: Math.max(1, Math.min(6, to - from + 1)) };
  }
  if (/올해|금년|이번 ?해/.test(q)) return { fromYear: thisYear, years: 1 };
  if (/내년|다음 ?해/.test(q)) return { fromYear: thisYear, years: 2 };
  if (/앞으로|향후|몇 ?년|장기/.test(q)) return { fromYear: thisYear, years: 5 };
  return { fromYear: thisYear, years: 3 };
}

/**
 * 질문 하나를 계산 계획으로 옮긴다.
 *
 * @param {string} question
 * @param {number} thisYear 사주 연도 기준 올해
 */
/**
 * 사용자가 **체계·기법·배치를 콕 집어** 물었는가.
 *
 * "태양과 MC로 보면 직업이 뭐야"는 서양점성술을 지정한 질문이다. 여기에
 * 자미두수·베딕을 얹으면 묻지 않은 것을 답하는 것이고, 무엇보다 **어느 체계가
 * 한 말인지 묻는 사람이 이미 정해 놓은 것을 무시하는 것**이다.
 *
 * 분야 라우팅(직업·재물…)과는 다른 축이다. 분야는 "무엇을 묻는가",
 * 이건 "무엇으로 보라고 하는가"다. **지정이 있으면 지정이 이긴다.**
 */
const SCOPE = [
  ['서양점성술', /태양|MC|엠씨|미드헤븐|어센던트|상승궁|하우스|점성술|별자리|행성|금성|화성|목성|토성|수성|천왕성|해왕성/],
  ['자미두수', /자미|두수|관록궁|재백궁|명궁|부처궁|자녀궁|전택궁|질액궁|복덕궁|천이궁|노복궁|형제궁|부모궁|사화|대한/],
  ['사주', /사주|대운|세운|십성|일간|원국|팔자|천간|지지|용신|격국|재성|관성|인성|식상|비겁/],
  ['베딕', /베딕|다샤|나밤샤|라그나|D1|D9|D10|분할도|아야남사|나크샤트라/],
  ['주역', /주역|괘|효|점괘|점시/],
  // '연도 기운'은 그 해 판을 세우는 구성학이 맡는다. "올해 운세" 같은 두루뭉술한
  // 말까지 잠그면 오히려 답이 좁아지므로 '연도 기운' 꼴만 잡는다
  ['구성학', /구성학|구성|방위반|본명성|오황|세파|음력\s*연도|연도\s*기운|한 해의 기운/],
  ['숙요', /숙요|숙|나크샤트라/],
  ['토정비결', /토정/],
  ['카발라', /카발라|생명나무|세피라|라이프 ?패스|수비학/],
  ['육임', /육임|사과삼전/],
  ['홍국기문', /홍국|기문|팔문/],
  ['태을신수', /태을/],
  // **요일을 보는 체계는 이 둘뿐이다.** 다만 맨 '요일'은 택일 질문("계약은
  // 무슨 요일에")에도 들어가므로, 타고난 것을 가리키는 한정어를 요구한다
  ['마하보테', /마하보테|(타고난|수호|본명|탄생|생일)\s*요일|요일\s*(기운|주성|행성|별)/],
  ['태국 점성술', /태국|(타고난|수호|본명|탄생|생일)\s*요일|요일\s*(기운|주성|행성|별)/],
  ['타로', /타로/],
];

/** "종합해서 봐줘" 처럼 **일부러 여러 체계를 부른** 말 */
const ASK_ALL = /종합|합쳐|다 ?봐|전부|모든 체계|여러 체계|열다섯|15개|전체 ?풀이/;

export function scopeLockOf(question) {
  const q = String(question ?? '');
  if (ASK_ALL.test(q)) return null;                 // 본인이 전부를 불렀다
  const named = SCOPE.filter(([, re]) => re.test(q)).map(([name]) => name);
  return named.length ? [...new Set(named)] : null;
}

export function routeQuestion(question, thisYear) {
  const q = String(question ?? '');
  // 먼저 나온 낱말이 그 사람이 정말로 묻는 것이다. "이직할까요? 이사도
  // 하게 되나요?" 에서 주된 분야는 이직이지 이사가 아니다. 규칙을 적어 둔
  // 순서가 아니라 질문에 나온 순서로 고른다.
  const hits = RULES
    .map((r) => {
      const at = r.words
        .map((w) => q.indexOf(w))
        .filter((i) => i >= 0);
      return at.length ? { domain: r.domain, at: Math.min(...at), n: at.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at || b.n - a.n);
  const domains = hits.map((h) => h.domain);

  // 이직은 직업과 이사를 함께 묻는 일이 많다. 둘 다 켜 두고 선후를 따진다
  if (domains.includes('직업') && /이사|통근|출퇴근|옮기|지방|수도권/.test(q)) {
    if (!domains.includes('이사')) domains.push('이사');
  }
  if (domains.includes('결혼') && !domains.includes('주거') && /집|살림|신혼/.test(q)) {
    domains.push('주거');
  }
  // 결혼을 물으면 상대의 직업·경제가 곧바로 따라 나온다 (확장 추론).
  // 묻지 않았어도 계산이 되는 자리는 미리 켜 둔다.
  if (domains.includes('결혼') && !domains.includes('재물')) domains.push('재물');

  const primary = domains[0] ?? null;
  const span = spanFromQuestion(q, thisYear);

  // 질문에 실제 도시 이름이 나오면 그 도시로 릴로케이션 차트를 견준다
  const cities = CITIES.filter((c) => c.kr && q.includes(c.name)).map((c) => c.name).slice(0, 5);

  const windfall = WINDFALL_WORDS.some((w) => q.includes(w));
  const lifetime = LIFETIME_WORDS.some((w) => q.includes(w));
  // 횡재를 물으면 재물 분야가 켜져 있어야 한다
  if (windfall && !domains.includes('재물')) domains.unshift('재물');

  // 사건을 집어냈으면 그 사건의 분야를 맨 앞으로 올린다.
  // '교제 시작'을 결혼 분야에서 재면 180달 중 78위, 관계 분야에서 재면
  // 7위였다 — 어느 분야에서 재느냐가 답을 가른다.
  const ev = eventFromQuestion(q);
  if (ev) {
    const i = domains.indexOf(ev.domain);
    if (i > 0) domains.splice(i, 1);
    if (i !== 0) domains.unshift(ev.domain);
  }

  // 그리고 그 반대쪽 — 위 '직업 → 이사' 규칙의 짝이 빠져 있었다.
  //
  // 성인이 생활권을 넘어 옮기는 일은 대개 **일 때문에** 벌어진다. 그때
  // 신호는 주거가 아니라 직업 분야에 있다. 이사는 결과고 원인이 일이다.
  // 실측: 취직하며 다른 도시로 옮긴 달을 주거 분야에서 재면 228달 중
  // 150위(상위 66% — 동전 던지기)였는데, 같은 달을 직업 분야에서 재면
  // 9위(상위 4%)였다. 분야를 잘못 골라서 틀린 것이지 계산이 없던 게 아니다.
  //
  // 같은 동네 이사는 일과 덜 엮이므로 생활권을 넘는 낌새가 있을 때만 켠다.
  // 맨 뒤에 붙이지 않고 두 번째 자리에 꽂는다 — domains 는 셋까지만
  // 쓰이므로 뒤에 붙이면 조용히 잘려 나간다.
  //
  // **반드시 위 ev 블록 다음이어야 한다.** 낱말 규칙(RULES)에 안 걸리고
  // 사건 낱말에만 걸리는 질문이 있어서("언제 지방으로 옮기게 될까"),
  // 그 앞에 두면 domains 가 아직 비어 있어 조건이 헛돈다.
  if ((domains.includes('이사') || domains.includes('주거')) && !domains.includes('직업') &&
      (INTERCITY_MOVE.test(q) || cities.length)) {
    domains.splice(1, 0, '직업');
  }

  return {
    event: ev?.event ?? null,
    eventDomain: ev?.domain ?? null,
    needsWealth: domains.includes('재물') || windfall,
    needsWindfall: windfall,
    needsLifetime: lifetime,
    question: q,
    matched: domains.length > 0,
    primary,
    domains: domains.length ? domains.slice(0, 3) : ['직업'],
    // 맞히지 못했으면 그 사실을 문맥에 적는다
    fallback: domains.length === 0,
    // 개수를 묻는 질문이다. 이 엔진은 순위만 내고 개수는 세지 못한다
    asksCount: COUNT_WORDS.test(q),
    // 되는가 안 되는가를 묻는 질문이다. 이 엔진은 시기를 줄 세울 뿐 판정하지 못한다
    asksOutcome: asksOutcomeOf(q),
    // "지금 이걸 해도 될까" 처럼 **현재 의사결정**을 묻는 질문이다.
    // 이때만 질문시각으로 괘를 세운다 — 평생·시기 질문은 명반이 답할 자리다
    needsHorary: isHoraryQuestion(q),
    // 사용자가 체계를 지정했으면 그 지정이 분야 라우팅보다 앞선다
    scopeLock: scopeLockOf(q),
    // 그 분야에 '안 된 쪽' 후보가 있는가. 없으면 점수가 높아도 "된다"가 아니다
    hasNegativeCandidate: NEGATIVE_CANDIDATES[domains[0]] ?? false,
    needsPlace: PLACE_WORDS.some((w) => q.includes(w)) || cities.length > 0,
    needsDay: DAY_WORDS.some((w) => q.includes(w)),
    cities,
    ...span,
    pipeline: pipelineFor(domains.length ? domains : ['직업'], {
      place: PLACE_WORDS.some((w) => q.includes(w)) || cities.length > 0,
      day: DAY_WORDS.some((w) => q.includes(w)),
    }),
  };
}

/** 어느 계산을 돌릴지 — 분야마다 다르다 */
export function pipelineFor(domains, flags = {}) {
  const p = {
    bazi: ['세운', '월운'],
    ziwei: ['대한', '유년', '유월'],
    western: ['transit'],
    vedic: ['dasha'],
    location: false,
    day: false,
  };
  if (flags.day) { p.bazi.push('일진'); p.day = true; }
  if (flags.place) p.location = true;

  const d = new Set(domains);
  if (d.has('직업') || d.has('재물')) {
    p.western.push('solarReturn', 'progression');
    p.vedic.push('D10', 'gochara');
  }
  if (d.has('결혼') || d.has('관계')) {
    p.western.push('progression');
    p.vedic.push('D9');
  }
  if (d.has('재물')) p.vedic.push('D2');
  if (d.has('자녀')) p.vedic.push('D7');
  if (d.has('주거') || d.has('이사')) {
    p.vedic.push('D4');
    p.location = true;
  }
  // 연도를 좁히는 기법은 어느 분야에서나 쓴다
  p.western.push('solarArc', 'profection');
  if (d.has('건강')) p.bazi.push('오행편중');
  return p;
}

/** 화면에서 바로 쓰는 기본 계획 (질문을 아직 모를 때) */
export function defaultPlan(thisYear) {
  return {
    question: '', matched: false, primary: null, fallback: true,
    domains: ['직업', '재물', '관계'],
    event: null, eventDomain: null,
    needsPlace: false, needsDay: false, cities: [],
    needsWealth: true, needsWindfall: false, needsLifetime: false,
    fromYear: thisYear, years: 3,
    pipeline: pipelineFor(['직업', '재물', '관계']),
  };
}
