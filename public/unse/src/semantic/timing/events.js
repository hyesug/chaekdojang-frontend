/**
 * timing/events.js — **활성화**를 현실 **사건 후보**로 옮긴다
 *
 * ── 왜 activation 하나로 사건을 고르지 않는가 ───────────────
 * `career 0.9` 는 "직업 분야가 시끄럽다"까지다. 승진인지 퇴사인지
 * 프리랜서 전환인지는 **방향**이 정한다. 방향을 안 보면 "직업운이
 * 좋습니다"로 뭉개지고, 그게 이 저장소가 여러 번 실패한 자리다.
 *
 * ── 점수 식 ────────────────────────────────────────────────
 *
 *   eventScore = domainActivation      그 분야가 움직이는가          (얼마나)
 *              × natalSusceptibility   원국이 그 사건에 열려 있는가
 *              × directionMatch        방향이 그 사건과 맞는가        (어느 쪽)
 *              × shiftMagnitude        그 방향 신호가 선명한가        (얼마나 또렷이)
 *              × contextCompatibility  지금 상황에 성립하는 사건인가
 *              × (0.6 + 0.4 × systemConsensus)  독립 계보가 겹치는가
 *
 * 하나라도 0 이면 후보가 아니다. 곱으로 둔 이유가 그것이다 —
 * "직업이 시끄럽지만 방향이 안 맞는다"면 그 사건은 아니다.
 *
 * ── 한 정보를 두 번 세지 않는다 ────────────────────────────
 *   activation  분야가 얼마나 움직이나        ← 세기
 *   direction   어느 쪽으로                  ← 방향만. 크기는 뺐다
 *   magnitude   그 방향이 얼마나 또렷한가      ← 방향의 세기
 * 셋이 재는 것이 다르다. `direction` 을 ±1 로 펴 놓고 그 크기까지
 * 쓰면 약한 흔들림이 두 번 증폭된다 — 그래서 크기를 따로 뺐다.
 * `systemConsensus` 는 0 으로 후보를 죽이지 않도록 0.6~1.0 범위로만 건다.
 *
 * ── 후보를 늘릴 때 ─────────────────────────────────────────
 * 틀린 사례를 보고 **그 사례에 맞는 후보를 새로 만들지 않는다.** 그렇게
 * 넣은 후보는 그 한 건에서만 맞고, 맞았다는 사실이 검증으로 오해된다.
 */

import { clamp01 } from './schema.js';

/**
 * 사건 후보.
 *
 *   needs    이 축이 올라가야 이 사건이다
 *   avoid    이 축이 올라가면 이 사건이 아니다
 *   natal    원국의 이 축이 높을수록 이 사건에 열려 있다
 *   requires / excludes  현재 상태가 있을 때만 거르는 조건
 */
const ev = (key, label, o) => ({ key, label, ...o });

export const EVENT_CANDIDATES = {
  career: [
    ev('first_job', '첫 취업', {
      needs: { organization: 0.6, change: 0.5 }, natal: { organization: 0.5 },
      excludes: { employed: true }, note: '아직 일을 시작하지 않은 사람에게만' }),
    ev('job_change', '이직', {
      needs: { change: 0.9, organization: 0.4 }, avoid: { stability: 0.6 },
      natal: { change: 0.5, organization: 0.4 }, requires: { employed: true } }),
    ev('role_change', '직무 변경', {
      needs: { change: 0.6, specialist: 0.4, organization: 0.5 }, avoid: { independence: 0.5 },
      natal: { organization: 0.5 }, requires: { employed: true } }),
    ev('promotion', '승진·보상 조정', {
      needs: { management: 0.7, organization: 0.6, stability: 0.4 }, avoid: { change: 0.7, independence: 0.6 },
      natal: { management: 0.5, organization: 0.6 }, requires: { employed: true } }),
    ev('resignation', '퇴사·공백', {
      needs: { change: 0.8 }, avoid: { organization: 0.6, stability: 0.5 },
      natal: { independence: 0.4 }, requires: { employed: true } }),
    ev('freelance', '프리랜서 전환', {
      needs: { independence: 0.9, change: 0.6 }, avoid: { organization: 0.7 },
      natal: { independence: 0.6, specialist: 0.4 } }),
    ev('business_start', '창업·자기 판', {
      needs: { independence: 0.8, commercial: 0.7, change: 0.5 }, avoid: { organization: 0.7 },
      natal: { independence: 0.6, commercial: 0.5 } }),
    ev('career_break', '일을 쉬는 구간', {
      needs: { change: 0.6 }, avoid: { competitive: 0.6, organization: 0.5 },
      natal: { stability: 0.3 } }),
    ev('return_to_work', '복귀', {
      needs: { organization: 0.6, change: 0.5, stability: 0.4 },
      natal: { organization: 0.5 }, requires: { employed: false } }),
  ],

  relationship: [
    ev('new_relationship', '새 만남', {
      needs: { bonding: 0.8, passion: 0.6 }, avoid: { autonomy: 0.6 },
      natal: { bonding: 0.5 }, excludes: { partnered: true } }),
    ev('relationship_deepening', '관계가 깊어짐', {
      needs: { commitment: 0.8, bonding: 0.6, stability: 0.4 }, avoid: { volatility: 0.6 },
      natal: { commitment: 0.5 }, requires: { partnered: true } }),
    ev('cohabitation', '동거', {
      needs: { commitment: 0.7, bonding: 0.6 }, avoid: { autonomy: 0.6 },
      natal: { commitment: 0.5 }, requires: { partnered: true } }),
    ev('conflict', '갈등이 커짐', {
      needs: { volatility: 0.8 }, avoid: { stability: 0.6 },
      natal: { volatility: 0.4 }, requires: { partnered: true } }),
    ev('breakup', '관계 정리', {
      needs: { volatility: 0.8, autonomy: 0.6 }, avoid: { commitment: 0.6, bonding: 0.6 },
      natal: { autonomy: 0.4 }, requires: { partnered: true } }),
    ev('reconciliation', '다시 이어짐', {
      needs: { bonding: 0.7, commitment: 0.5 }, avoid: { volatility: 0.7 },
      natal: { bonding: 0.5 } }),
  ],

  marriage: [
    ev('marriage_preparation', '결혼 이야기가 오감', {
      needs: { marriageOrientation: 0.7, spouseStable: 0.4 }, avoid: { spouseVolatile: 0.7 },
      natal: { marriageOrientation: 0.5 }, excludes: { married: true } }),
    ev('engagement_like_transition', '약속·상견례 같은 단계', {
      needs: { marriageOrientation: 0.8, spouseStable: 0.5 }, avoid: { spouseVolatile: 0.7 },
      natal: { marriageOrientation: 0.5 }, excludes: { married: true } }),
    ev('marriage', '결혼 성립', {
      needs: { marriageOrientation: 0.9, spouseStable: 0.5 }, avoid: { spouseVolatile: 0.8 },
      natal: { marriageOrientation: 0.6 }, excludes: { married: true } }),
  ],

  // 임신 여부를 확정적으로 예측하지 않는다. '관련 신호'까지다
  children: [
    ev('pregnancy_related', '자녀 관련 신호', {
      needs: { childThick: 0.8, caregiving: 0.5 }, avoid: { childThin: 0.7 },
      natal: { childThick: 0.5 } }),
    ev('birth', '출산 관련 구간', {
      needs: { childThick: 0.9, caregiving: 0.6 }, avoid: { childThin: 0.7 },
      natal: { childThick: 0.6 } }),
    ev('parenting_transition', '양육 국면 전환', {
      needs: { caregiving: 0.8 }, natal: { caregiving: 0.5 }, requires: { hasChildren: true } }),
    ev('child_related_change', '자녀 문제로 생활이 바뀜', {
      needs: { caregiving: 0.6, childThick: 0.4 }, natal: { caregiving: 0.4 },
      requires: { hasChildren: true } }),
  ],

  // 시험 결과를 확정적으로 단정하지 않는다
  education: [
    ev('study_start', '배움을 시작', {
      needs: { formalContinuity: 0.7, credential: 0.5 }, natal: { formalContinuity: 0.5 } }),
    ev('exam_preparation', '시험 준비', {
      needs: { credential: 0.8, repeatChallenge: 0.4 }, natal: { credential: 0.5 } }),
    ev('qualification_attempt', '자격 도전', {
      needs: { credential: 0.9 }, natal: { credential: 0.6 } }),
    ev('exam_success_window', '결실이 나올 만한 구간', {
      needs: { credential: 0.8, formalContinuity: 0.6 }, avoid: { detour: 0.7 },
      natal: { credential: 0.5, formalContinuity: 0.5 },
      note: '합격을 단정하지 않는다. 결과는 바깥 상대가 정한다' }),
    ev('academic_detour', '중단·우회', {
      needs: { detour: 0.8 }, avoid: { formalContinuity: 0.7 }, natal: { detour: 0.5 } }),
    ev('return_to_study', '다시 배움으로', {
      needs: { formalContinuity: 0.6, repeatChallenge: 0.6 }, natal: { repeatChallenge: 0.5 } }),
  ],

  wealth: [
    ev('income_increase', '수입이 오름', {
      needs: { incomeStability: 0.6, accumulation: 0.6 }, avoid: { wealthVolatility: 0.7 },
      natal: { accumulation: 0.5 } }),
    ev('income_decrease', '수입이 줄어듦', {
      needs: { wealthVolatility: 0.8 }, avoid: { incomeStability: 0.7 },
      natal: { wealthVolatility: 0.4 } }),
    ev('large_expense', '큰 지출', {
      needs: { wealthVolatility: 0.7 }, avoid: { accumulation: 0.7 }, natal: { wealthVolatility: 0.4 } }),
    ev('investment_volatility', '투자 변동', {
      needs: { speculation: 0.8, wealthVolatility: 0.6 }, natal: { speculation: 0.5 } }),
    ev('business_income_change', '사업 수입 변화', {
      needs: { enterprise: 0.8, wealthVolatility: 0.5 }, natal: { enterprise: 0.5 } }),
    ev('asset_accumulation', '자산이 쌓임', {
      needs: { accumulation: 0.8, incomeStability: 0.5 }, avoid: { wealthVolatility: 0.7 },
      natal: { accumulation: 0.6 } }),
    ev('financial_stress', '재정 압박', {
      needs: { wealthVolatility: 0.9 }, avoid: { incomeStability: 0.7, accumulation: 0.6 },
      natal: { wealthVolatility: 0.4 } }),
  ],

  residence: [
    ev('move', '이사', { needs: { homeShrink: 0.4, homeExpand: 0.4 }, avoid: { settled: 0.8 },
      natal: { settled: 0.2 } }),
    ev('independence_from_family', '독립', {
      needs: { homeShrink: 0.5 }, avoid: { settled: 0.7 }, natal: { ownership: 0.3 } }),
    ev('cohabitation_move', '함께 살기 시작', {
      needs: { homeExpand: 0.6 }, natal: { settled: 0.3 } }),
    ev('home_purchase_related', '집을 사는 쪽', {
      needs: { ownership: 0.9, homeExpand: 0.5 }, avoid: { homeShrink: 0.7 },
      natal: { ownership: 0.6 } }),
    ev('rental_change', '임차 조건 변화', {
      needs: { homeShrink: 0.6 }, avoid: { ownership: 0.7 }, natal: { settled: 0.3 } }),
  ],

  movement: [
    ev('regional_move', '생활권을 옮김', {
      needs: { longDistance: 0.8, mobile: 0.6 }, avoid: { localBound: 0.7 },
      natal: { mobile: 0.5 } }),
    ev('short_move', '근거리 이동', {
      needs: { mobile: 0.7 }, avoid: { longDistance: 0.7 }, natal: { mobile: 0.4 } }),
    ev('abroad', '해외·장거리', {
      needs: { abroad: 0.9, longDistance: 0.6 }, avoid: { localBound: 0.7 }, natal: { abroad: 0.5 } }),
  ],

  // 질환명·수술 여부·의료 사건을 예측하지 않는다. 세 가지만 허용한다
  health: [
    ev('physical_load', '몸에 부담이 실리는 구간', {
      needs: { physicalLoad: 0.8 }, natal: { physicalLoad: 0.5 } }),
    ev('recovery_need', '회복이 필요한 구간', {
      needs: { vulnerability: 0.7 }, avoid: { recovery: 0.7 }, natal: { vulnerability: 0.4 } }),
    ev('health_attention_period', '몸을 살필 구간', {
      needs: { vulnerability: 0.6, chronicTendency: 0.5 }, natal: { chronicTendency: 0.4 } }),
  ],

  majorChange: [
    ev('major_life_transition', '인생의 큰 전환 구간', {
      needs: { turningPoint: 0.9 }, avoid: { continuity: 0.7 }, natal: { turningPoint: 0.5 } }),
    ev('self_driven_change', '스스로 판을 바꿈', {
      needs: { turningPoint: 0.7, selfDriven: 0.7 }, natal: { selfDriven: 0.5 } }),
    ev('externally_driven_change', '떠밀려 바뀜', {
      needs: { turningPoint: 0.7, externallyDriven: 0.7 }, natal: { externallyDriven: 0.4 } }),
  ],
};

/** 그 축들이 실제로 올라왔는가 (0~1) */
export function match(shift, wants) {
  const keys = Object.keys(wants ?? {});
  if (!keys.length) return 1;
  let num = 0, den = 0;
  for (const [ax, w] of Object.entries(wants)) {
    const v = shift?.[ax] ?? 0;
    num += w * Math.max(0, v);
    den += w;
  }
  // 합친 방향은 가장 센 축이 ±1 이 되게 편 값이라, 0.5 면 온전히 맞은 것으로 본다
  return den ? clamp01(num / den / 0.5) : 1;
}

/** 피해야 할 축이 올라왔으면 깎는다 */
export function penalty(shift, avoid) {
  const keys = Object.keys(avoid ?? {});
  if (!keys.length) return 1;
  let worst = 0;
  for (const [ax, w] of Object.entries(avoid)) worst = Math.max(worst, w * Math.max(0, shift?.[ax] ?? 0));
  return clamp01(1 - worst);
}

/** 원국이 그 사건에 얼마나 열려 있는가 */
function susceptibility(natalProfile, wants) {
  const keys = Object.keys(wants ?? {});
  if (!keys.length || !natalProfile) return 0.6;      // 모르면 중간
  let num = 0, den = 0;
  for (const [ax, w] of Object.entries(wants)) {
    num += w * (0.5 + 0.5 * Math.max(-1, Math.min(1, natalProfile[ax] ?? 0)));
    den += w;
  }
  return den ? clamp01(num / den) : 0.6;
}

/**
 * 현재 상태가 있으면 성립하지 않는 후보를 거른다.
 * **없으면 명반으로 상태를 추측하지 않는다** — 그냥 거르지 않는다.
 */
function contextOk(cand, ctx) {
  if (!ctx) return { ok: true, factor: 1, why: '현재 상태를 받지 않아 거르지 않았다' };
  const state = {
    employed: ctx.employmentType ? ctx.employmentType !== 'none' : (ctx.occupation ? true : null),
    partnered: ctx.relationshipStatus ? ['dating', 'engaged', 'married', 'cohabiting'].includes(ctx.relationshipStatus) : null,
    married: ctx.maritalStatus ? ctx.maritalStatus === 'married' : null,
    hasChildren: typeof ctx.hasChildren === 'boolean' ? ctx.hasChildren : null,
  };
  for (const [k, want] of Object.entries(cand.requires ?? {})) {
    if (state[k] == null) continue;
    if (state[k] !== want) return { ok: false, factor: 0, why: `${k} 가 ${want} 일 때만 성립` };
  }
  for (const [k, bad] of Object.entries(cand.excludes ?? {})) {
    if (state[k] == null) continue;
    if (state[k] === bad) return { ok: false, factor: 0, why: `${k} 가 ${bad} 라 성립하지 않음` };
  }
  return { ok: true, factor: 1, why: null };
}

/**
 * 한 시기 한 분야의 사건 후보를 점수 매긴다.
 *
 * @param {string} domain
 * @param {number} activation   합친 분야 활성도 0~1
 * @param {object} shift        합친 방향 (−1~1)
 * @param {object} natalProfile 정적 해석의 그 분야 profile
 * @param {number} consensus    독립 계보 합의 0~1
 * @param {object|null} ctx     현재 상태
 */
export function scoreEvents(domain, activation, direction, natalProfile, consensus, ctx = null, magnitude = 1) {
  const out = [];
  if (!Number.isFinite(activation)) return out;      // 말할 근거가 없으면 후보도 없다
  for (const cand of EVENT_CANDIDATES[domain] ?? []) {
    const c = contextOk(cand, ctx);
    // `direction` 은 방향만 편 값이고, 얼마나 선명한지는 `magnitude` 가 쥔다.
    // 둘을 곱해야 아주 약한 흔들림이 강한 사건으로 둔갑하지 않는다.
    const directionMatch = match(direction, cand.needs) * penalty(direction, cand.avoid);
    const susc = susceptibility(natalProfile, cand.natal);
    const mag = clamp01(magnitude);
    const score = activation * susc * directionMatch * mag * c.factor * (0.6 + 0.4 * consensus);
    out.push({
      type: cand.key, label: cand.label,
      score: Math.round(score * 1000) / 1000,
      parts: {
        activation: Math.round(activation * 1000) / 1000,
        natalSusceptibility: Math.round(susc * 1000) / 1000,
        directionMatch: Math.round(directionMatch * 1000) / 1000,
        shiftMagnitude: Math.round(mag * 1000) / 1000,
        contextCompatibility: c.factor,
        systemConsensus: Math.round(consensus * 1000) / 1000,
      },
      ...(c.why ? { contextNote: c.why } : {}),
      ...(cand.note ? { caution: cand.note } : {}),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** 후보 목록만 (문서·테스트용) */
export const candidatesOf = (domain) => EVENT_CANDIDATES[domain] ?? [];
