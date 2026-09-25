/**
 * scenario/attributes.js — **사건이 얼마나 오래 걸리는 일인가**
 *
 * 입사일은 하루고 이사 준비는 몇 달이다. 둘을 같은 '사건'으로 두면 국면의
 * 세 토막(준비 → 고비 → 정리)을 같은 폭으로 읽게 된다.
 *
 * 여기 표는 **사건의 성질**이지 그 사람의 계산값이 아니다. 명반에서 나오는
 * 값이 아니므로 점수에 넣지 않고, 국면을 읽을 때 폭의 기준으로만 쓴다.
 * (`timing/events.js` 는 얼려 둔 표라 건드리지 않고 여기에 따로 둔다.)
 *
 *   instant  그날 하루로 끝나는 일        혼인신고·입사일·계약일
 *   short    몇 주~두어 달                면접·시험·이사
 *   medium   한두 분기                    이직 과정 전체·결혼 준비
 *   long     반년 이상                    창업 안착·양육 국면·학위
 */

/** 사건 → 걸리는 결. 표에 없으면 `unknown` 이다 (지어내지 않는다) */
export const EVENT_DURATION = {
  // 직업
  first_job: 'medium', job_change: 'medium', role_change: 'short', promotion: 'instant',
  resignation: 'short', freelance: 'medium', business_start: 'long',
  career_break: 'long', return_to_work: 'medium',
  // 관계
  new_relationship: 'short', relationship_deepening: 'medium', cohabitation: 'short',
  conflict: 'medium', breakup: 'short', reconciliation: 'short',
  // 결혼
  marriage_preparation: 'long', engagement_like_transition: 'short', marriage: 'instant',
  // 자녀
  pregnancy_related: 'medium', birth: 'instant',
  parenting_transition: 'long', child_related_change: 'medium',
  // 학업
  study_start: 'short', exam_preparation: 'long', qualification_attempt: 'short',
  exam_success_window: 'short', academic_detour: 'medium', return_to_study: 'short',
  // 재물
  income_increase: 'medium', income_decrease: 'medium', large_expense: 'instant',
  investment_volatility: 'medium', business_income_change: 'medium',
  asset_accumulation: 'long', financial_stress: 'long',
  // 주거·이동
  move: 'short', independence_from_family: 'short', cohabitation_move: 'short',
  home_purchase_related: 'medium', rental_change: 'short',
  regional_move: 'short', short_move: 'short', abroad: 'medium',
  // 건강·전환
  physical_load: 'long', recovery_need: 'medium', health_attention_period: 'long',
  major_life_transition: 'long', self_driven_change: 'medium', externally_driven_change: 'short',
};

export const DURATION_LABEL = {
  instant: '하루로 끝나는 일', short: '몇 주에서 두어 달',
  medium: '한두 분기', long: '반년 이상', unknown: '얼마나 걸릴지는 표에 없다',
};

/** 국면의 세 토막이 뜻하는 것 — 준비 단계를 사건으로 읽지 않으려고 적어 둔다 */
export const PHASE_ROLE = {
  buildup: {
    label: '전조', means: '아직 일이 일어나지 않은 단계',
    examples: '불만이 쌓이고, 알아보고, 지원하고, 이야기를 꺼내는 자리',
    caution: '전조를 사건으로 세지 않는다',
  },
  peak: {
    label: '고비', means: '실제로 결정·성립이 일어날 만한 구간',
    examples: '입사·퇴사·계약·혼인·이사·시험',
    caution: '일어난다는 뜻이 아니라 일어난다면 이 자리라는 뜻이다',
  },
  resolution: {
    label: '정리', means: '일이 지나간 뒤 자리를 잡는 단계',
    examples: '새 일터 적응·결혼 뒤 생활 정착·이사 뒤 안정·결과 확인',
    caution: '앞 단계가 일어나야 성립하는 구간이다',
  },
};

/**
 * 사건 하나의 성질.
 * 표에 없으면 `unknown` 이고, 그것을 추정으로 채우지 않는다.
 */
export function attributesOf(eventType) {
  const durationType = EVENT_DURATION[eventType] ?? 'unknown';
  return {
    durationType,
    durationLabel: DURATION_LABEL[durationType],
    /** 실제 햇수·달수는 사람마다 다르고 계산으로 나오지 않는다 */
    estimatedDuration: null,
    sourceType: 'derived',
    note: '사건의 성질이지 이 사람의 계산값이 아니다',
  };
}
