/**
 * axes.js — LEVEL 3. 열다섯 전통이 **함께 쓰는 의미축**
 *
 * ── 왜 축이 먼저인가 ───────────────────────────────────────
 * 지금까지 체계들은 곧바로 직업 문구를 냈다.
 *
 *   자미  "재주가 여럿 — 영업·예술·사교·미용"
 *   점성  "말과 정보를 옮기는 일 — 상업·글·교육·IT"
 *
 * 이 문구들은 **채점할 수가 없다.** 겹치는지 어긋나는지도 눈대중이고,
 * 합치려 들면 문자열이 섞여 근거가 사라진다. 그래서 '무슨 직업인가'를
 * 묻기 전에 **무엇을 다루는 사람인가**를 먼저 숫자로 적는다.
 *
 * ── 눈금 ───────────────────────────────────────────────────
 * 모든 축은 **0~1 의 '지지도'** 하나로 통일한다.
 *
 *   0    이 축을 지지하는 전통 근거가 없다
 *   1    그 체계가 이 축을 가장 세게 가리킨다
 *
 * 양극(독립↔조직, 안정↔변화, 조혼↔만혼)은 **한 축을 −1~+1 로 쓰지 않고
 * 두 축으로 나눈다.** 이유가 있다. 한 축으로 만들면 "근거가 없다(0)"와
 * "양쪽이 팽팽하다(0)"가 같은 숫자가 되어 구별이 사라진다. 두 축이면
 * 전자는 (0,0), 후자는 (0.6,0.6) 이라 **엔진이 침묵해야 할 자리를 안다.**
 *
 * ── 축을 늘릴 때 ───────────────────────────────────────────
 * **실제 사례를 맞히려고 축을 추가하지 않는다.** 축은 전통이 그 자리에서
 * 원래 말하던 것을 담는 그릇이지, 정답표를 담는 그릇이 아니다.
 */

/** 분야별 의미축. 순서가 곧 벡터의 순서다 */
export const AXES = {
  // 직업 스무 축.
  //
  // 앞의 열여섯에 넷을 더했다 — `information`(지식·정보를 다루는가),
  // `problemSolving`(막힌 것을 푸는가), `specialist`(한 우물을 깊게
  // 파는가), `competitive`(성과로 겨루는가). 실제 직업을 속성으로
  // 적어 보니 이 넷이 없으면 **개발자와 연구원이 구별되지 않았고**
  // (둘 다 기술+분석) **트레이너와 생산직도 구별되지 않았다**(둘 다 신체).
  career: [
    'technical', 'analytical', 'research', 'information', 'problemSolving',
    'creative', 'aesthetic', 'interpersonal', 'verbal', 'commercial',
    'management', 'physical', 'care', 'public', 'competitive',
    'specialist', 'independence', 'organization', 'stability', 'change',
  ],
  // 관계 — 양극은 두 축으로 나눈다 (위 '눈금' 참조)
  relationship: ['bonding', 'commitment', 'autonomy', 'earlyUnion', 'lateUnion', 'stability', 'volatility'],
  children: ['childThick', 'childThin', 'caregiving'],
  education: ['formalContinuity', 'credential', 'detour', 'repeatChallenge'],
  residence: ['settled', 'mobile', 'ownership'],
  wealth: ['incomeStability', 'accumulation', 'speculation', 'enterprise', 'volatility'],
  // 건강은 **질환명·수술 여부를 만들지 않는다.** 전통이 말하는 '몸에 실리는
  // 부담'까지만 적고, 의료 판단처럼 쓰지 못하게 분야 자체에 표시를 단다.
  health: ['physicalLoad', 'vulnerability'],
};

export const DOMAINS = Object.keys(AXES);

/** 화면·문맥에 적을 우리말 이름 */
export const AXIS_LABEL = {
  technical: '기술', analytical: '분석', research: '연구', information: '정보·지식',
  problemSolving: '문제해결', creative: '창작', aesthetic: '미적감각',
  interpersonal: '대인', verbal: '언어·소통', commercial: '상업·영업',
  management: '관리·운영', physical: '신체·현장', care: '돌봄', public: '공공·제도',
  competitive: '경쟁·성과', specialist: '전문성', independence: '독립·자영',
  organization: '조직 적응', stability: '안정 추구', change: '변화·변동',

  bonding: '관계 형성', commitment: '결혼 지향', autonomy: '관계 안의 자율',
  earlyUnion: '이른 결합', lateUnion: '늦은 결합',
  volatility: '변동성',

  childThick: '자녀 자리 두터움', childThin: '자녀 자리 얇음', caregiving: '돌봄 책임',
  formalContinuity: '정규 과정 지속', credential: '자격·시험', detour: '중단·우회',
  repeatChallenge: '반복 도전',
  settled: '정착성', mobile: '이동성', ownership: '소유 지향',
  incomeStability: '소득 안정성', accumulation: '자산 축적',
  speculation: '투기·변동', enterprise: '사업성',
  physicalLoad: '신체 부담', vulnerability: '취약 신호',
};

/** 전부 0 인 벡터 */
export const zero = (domain) =>
  Object.fromEntries((AXES[domain] ?? []).map((k) => [k, 0]));

/** a 에 b 를 w 배로 더한다. a 를 바꾸지 않고 새로 만든다 */
export function add(a, b, w = 1) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    if (!(k in out)) continue;      // 분야에 없는 축은 조용히 버린다
    out[k] += v * w;
  }
  return out;
}

/**
 * 가장 큰 축이 1 이 되게 맞춘다.
 *
 * 합이 아니라 **최댓값**으로 나눈다. 합으로 나누면 축을 많이 건드리는
 * 체계일수록 축마다의 값이 작아져서, 말을 많이 하는 체계가 자동으로
 * 약해진다. 여기서 재는 것은 '얼마나 많이 말했나'가 아니라
 * '무엇을 가장 세게 가리켰나'다.
 */
export function scaleToUnit(v) {
  const max = Math.max(0, ...Object.values(v));
  if (max <= 0) return { ...v };
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x / max]));
}

/**
 * 0~1 로 자른다. **여기서 최댓값으로 나누지 않는다.**
 *
 * 처음에 `scaleToUnit` 을 썼더니 "약하게 걸렸다"와 "세게 걸렸다"가 같은
 * 1.0 이 됐다. 오행이 고른 사람의 `physicalLoad: 0.2` 가 혼자 있다는
 * 이유로 1.0 이 되어, **뜻이 뒤집혔다.** 절대 세기가 남아야 한다.
 */
export const clamp01 = (v) =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.min(1, Math.max(0, x))]));

/** 프로토타입이 쓰지 않는 축은 그 분포에 끼어들지 못하게 잘라 낸다 */
export const restrictTo = (v, keys) =>
  Object.fromEntries(keys.map((k) => [k, v[k] ?? 0]));

/** 벡터가 비었는가 — 아무 근거도 없으면 말하지 않는다 */
export const isEmpty = (v) => Object.values(v ?? {}).every((x) => x <= 0);

/** 코사인 닮음. 두 벡터가 모두 0 이상이므로 0~1 이다 */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const k of Object.keys(a)) {
    const x = a[k] ?? 0, y = b[k] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** 소수 자리를 잘라 둔다 — 같은 입력에 같은 글자가 나와야 한다 */
export const round3 = (v) =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round(x * 1000) / 1000]));
