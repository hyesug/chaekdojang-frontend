/**
 * scenario/specificity.js — **어디까지 내려가도 되는가**
 *
 * 이 층이 없으면 다음 단계가 "2028년 3월 대전 대덕구 A회사" 까지 내려간다.
 * 그 문장의 앞부분과 뒷부분은 근거의 두께가 전혀 다른데, 한 문장이 되는
 * 순간 같은 무게로 읽힌다.
 *
 * ── 아래로 갈수록 강해질 수 없다 ───────────────────────────
 * 8단계를 두고 **각 단계의 확신은 윗 단계를 넘을 수 없게** 깎는다
 * (`confidence(5) ≤ confidence(4)`). 근거가 더해져서 좁아지는 것이 아니라,
 * 좁힐수록 같은 근거를 더 잘게 쪼개 쓰는 것이기 때문이다.
 *
 * ── 절대 넘지 않는 선 ──────────────────────────────────────
 *   특정 회사(7)  운세 신호로 만들지 않는다. 명반에는 회사 이름이 없다.
 *                 나중에 Reality Matcher 가 실제 채용 정보와 맞댈 때만.
 *   구·동(6)      운세로 좁히지 않는다. 사용자가 말해 준 경우에만 쓴다.
 *   도시권(5)     방위·아스트로카토그래피 같은 **위치 근거가 실제로 있을
 *                 때만**. 없으면 막는다.
 *
 * "모르겠다"(level 0) 는 실패가 아니라 정상 결과다.
 */

const L = (level, key, label, note) => ({ level, key, label, note });

export const LEVELS = [
  L(0, 'none', '변화 없음 / 모름', '이것도 정상 결과다'),
  L(1, 'domain', '분야가 움직인다', '어느 분야가 시끄러운가까지'),
  L(2, 'event_type', '사건 종류', '이직인가 승진인가 퇴사인가'),
  L(3, 'direction_role', '방향·역할', '조직 쪽인가 독립 쪽인가'),
  L(4, 'industry_employment', '산업·고용형태', '기술직인가, 월급인가 자기 판인가'),
  L(5, 'metro', '도시권', '위치 근거가 실제로 있을 때만'),
  L(6, 'district', '구·지역', '운세로 좁히지 않는다'),
  L(7, 'company', '특정 회사', '운세 신호로는 절대 만들지 않는다'),
];

export const TIMING_GRAIN = ['year', 'halfyear', 'quarter', 'month'];

/** 시기 눈금을 한 칸 뒤로 물린다 */
const coarser = (g) => TIMING_GRAIN[Math.max(0, TIMING_GRAIN.indexOf(g) - 1)];

const AGREE_SCORE = { strong: 1, partial: 0.6, weak: 0.3, none: 0 };
const DIR_SCORE = { unanimous: 1, majority: 0.75, mixed: 0.4, unknown: 0 };

/**
 * 구체성 게이트.
 *
 * @param {object} o
 *   conflict        resolveConflict 결과
 *   phase           timingPhases 의 한 국면 (없어도 된다)
 *   question        interpretQuestion 결과
 *   natalSupport    정적 해석이 그 분야에서 얼마나 두꺼운가 (0~1)
 *   locationEvidence 위치를 말할 계산 근거가 실제로 있는가 (기본 없음)
 *   contextLocation  사용자가 알려준 지역 (있으면 6단계까지 context 로 허용)
 */
export function specificityGate(o = {}) {
  const { conflict = null, phase = null, question = null,
    natalSupport = null, locationEvidence = null, contextLocation = null } = o;

  const act = AGREE_SCORE[conflict?.activationAgreement] ?? 0;
  const dir = DIR_SCORE[conflict?.directionalAgreement] ?? 0;
  const strength = conflict?.evidenceStrength ?? 0;
  const natal = Number.isFinite(natalSupport) ? natalSupport : 0.5;
  // 국면이 창보다 오래 이어지고 봉우리가 뚜렷할수록 시기를 말할 근거가 두껍다
  const phaseScore = phase
    ? Math.min(1, (phase.peakPercentile / 100) * Math.min(1.2, phase.persistence)) : 0;

  // 단계마다 **날것의** 확신. 아직 단조성을 걸지 않았다
  const raw = {
    0: 1,
    1: act,
    2: act * (0.4 + 0.6 * dir),
    3: dir * (0.5 + 0.5 * strength),
    4: dir * natal * 0.9,
    5: locationEvidence ? Math.min(0.5, dir * 0.5) : 0,
    6: contextLocation ? Math.min(0.4, dir * 0.4) : 0,
    7: 0,
  };

  // **아래로 갈수록 강해질 수 없다**
  const confidence = {};
  let cap = 1;
  for (const lv of LEVELS) {
    cap = Math.min(cap, raw[lv.level] ?? 0);
    confidence[lv.level] = Math.round(cap * 100) / 100;
  }

  const FLOOR = 0.25;
  const blocked = [];
  let allowedLevel = 0;
  for (const lv of LEVELS) {
    if (lv.level === 0) { allowedLevel = 0; continue; }
    if (confidence[lv.level] >= FLOOR) { allowedLevel = lv.level; continue; }
    blocked.push({ level: lv.level, key: lv.key, reason: reasonFor(lv, o, confidence) });
  }
  // 막힌 단계 아래도 전부 막힌 것으로 적는다 (윗단계가 열려 보이지 않게)
  for (const lv of LEVELS) {
    if (lv.level > allowedLevel && !blocked.some((b) => b.level === lv.level)) {
      blocked.push({ level: lv.level, key: lv.key, reason: `${allowedLevel}단계까지만 근거가 있다` });
    }
  }
  blocked.sort((a, b) => a.level - b.level);

  // ── 시기 눈금 ──
  const requested = question?.requestedSpecificity?.timing ?? 'quarter';
  let allowedTiming = requested;
  const timingReasons = [];
  if (!phase) {
    allowedTiming = 'year';
    timingReasons.push('국면을 가르지 못했다 — 해 단위로 물러선다');
  } else {
    if (phaseScore < 0.75 && allowedTiming === 'month') {
      allowedTiming = coarser(allowedTiming);
      timingReasons.push('봉우리가 한 달을 짚을 만큼 뾰족하지 않다');
    }
    if (act < 0.6 && allowedTiming !== 'year') {
      allowedTiming = coarser(allowedTiming);
      timingReasons.push('활성 합의가 약하다');
    }
    // 그 분야의 눈금보다 잘게 말하지 않는다
    const grain = phase.resolution ?? 'quarter';
    if (TIMING_GRAIN.indexOf(allowedTiming) > TIMING_GRAIN.indexOf(grain)) {
      allowedTiming = grain;
      timingReasons.push(`이 분야의 해상도가 ${grain} 이다`);
    }
  }

  return {
    allowedLevel,
    allowedLabel: LEVELS[allowedLevel].label,
    confidenceByLevel: confidence,
    blocked,
    timing: { requested, allowed: allowedTiming,
      reasons: timingReasons,
      note: allowedTiming === requested ? null : '물은 것보다 굵게 답한다 — 근거가 거기까지다' },
    monotonic: true,
    note: 'confidence 는 근거의 두께이지 확률이 아니다. 아래 단계가 위 단계보다 강할 수 없다',
  };
}

function reasonFor(lv, o, confidence) {
  if (lv.level === 7) {
    return '특정 회사는 운세 신호로 만들 수 없다 — 실제 채용 정보와 맞대는 Reality Matcher 가 있어야 한다';
  }
  if (lv.level === 6 && !o.contextLocation) {
    return '구·동은 운세로 좁히지 않는다 — 사용자가 알려준 지역이 있을 때만';
  }
  if (lv.level === 5 && !o.locationEvidence) return 'location evidence insufficient — 위치를 말할 계산 근거가 없다';
  if (lv.level === 4) return '산업·고용형태를 가를 만큼 방향이 선명하지 않다';
  if (lv.level === 3) return '방향이 갈려 있다';
  if (lv.level === 2) return '어느 사건인지 가릴 근거가 모자란다';
  if (lv.level === 1) return '그 분야가 움직인다고 할 근거가 없다';
  return `확신 ${confidence[lv.level]}`;
}

/** 어떤 주장이 허용 단계 안인가 (다음 층이 쓰는 문지기) */
export function allows(gate, level) {
  return gate.allowedLevel >= level;
}

/** 회사 이름은 어떤 경우에도 운세에서 나오지 않는다 */
export const COMPANY_FORBIDDEN =
  '특정 회사명은 fortune 근거로 생성하지 않는다';
