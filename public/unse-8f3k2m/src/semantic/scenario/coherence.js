/**
 * scenario/coherence.js — **내보내기 전에 한 번 더 의심한다**
 *
 * 중간층이 실수해도 여기서 걸린다. 걸린 것을 조용히 고쳐 쓰지 않는다 —
 * 금지된 구체성은 잘라내고 **잘라냈다는 사실을 함께 적는다.** 조용히
 * 고치면 다음에 같은 실수가 나도 아무도 모른다.
 */

/** 건강에서 절대 만들지 않는 말 — 진단은 이 엔진의 일이 아니다 */
export const HEALTH_FORBIDDEN =
  /(암|종양|수술|입원|사망|진단|질환|질병|골절|당뇨|고혈압|처방|치료받)/;
/** 자녀·학업에서 단정으로 넘어가는 말 */
export const CERTAINTY_FORBIDDEN =
  /(임신한다|임신합니다|출산한다|출산합니다|낳는다|낳습니다|합격한다|합격합니다|붙는다|붙습니다|확정)/;
/** 회사 이름처럼 보이는 것 */
export const COMPANY_LIKE = /(주식회사|㈜|\(주\)|Inc\.|Corp\.|LLC|Ltd\.)/;

const issue = (code, where, detail) => ({ code, where, detail });

/** 시기 눈금의 굵기 순서 — 뒤로 갈수록 잘다 */
const GRAIN = ['year', 'halfyear', 'quarter', 'month'];
const finer = (a, b) => GRAIN.indexOf(a) > GRAIN.indexOf(b);

/**
 * 최종 시나리오를 검사한다.
 *
 * @param scenario composePrepared 가 만든 것 (sanitize 를 마친 뒤)
 * @param prepared prepareScenario 결과
 * @returns {{ok, issues}}
 */
export function auditCoherence(scenario, prepared) {
  const issues = [];
  const gate = prepared?.specificity ?? {};
  const cap = gate.allowedLevel ?? 0;
  const grain = gate.timing?.allowed ?? 'year';
  const p = scenario?.primary ?? null;

  // 1. 허용 단계를 넘지 않았는가
  if ((scenario?.meta?.maxSpecificityUsed ?? 0) > cap) {
    issues.push(issue('specificity_over_gate', 'meta',
      `${scenario.meta.maxSpecificityUsed} 단계를 썼는데 허용은 ${cap} 이다`));
  }

  if (p) {
    // 2. 시기가 게이트보다 잘지 않은가
    if (finer(p.timing?.grain, grain)) {
      issues.push(issue('timing_too_fine', 'primary.timing',
        `${p.timing.grain} 로 냈는데 허용은 ${grain} 이다`));
    }
    if (p.timing?.peak && p.timing.grain !== 'month') {
      issues.push(issue('peak_month_leaked', 'primary.timing.peak',
        '달 눈금이 아닌데 봉우리 달을 내보냈다'));
    }

    // 3. 사건이 그 국면의 실제 후보인가
    const sig = (prepared?.resolvedSignals ?? []).find((s) => s.phase.id === p.phaseId);
    if (p.event?.type) {
      const known = (sig?.rawEvents ?? []).some((e) => e.type === p.event.type);
      if (!known) {
        issues.push(issue('event_not_in_phase', 'primary.event',
          `${p.phaseId} 국면의 후보에 없는 사건 ${p.event.type}`));
      }
      const reachable = (sig?.reachableEvents ?? []).some((e) => e.type === p.event.type);
      if (!reachable && prepared?.stateKnown) {
        issues.push(issue('event_unreachable', 'primary.event',
          `지금 상태에서 갈 수 없는 사건 ${p.event.type}`));
      }
    }

    // 4. 가지 1단계와 같은 자리에서 출발했는가
    // (사건을 말할 수 없는 단계에서는 가지 자체가 없으므로 맞댈 것도 없다)
    const a = (scenario.branches ?? [])[0];
    if (p.event?.type && a?.steps?.[0]) {
      if (a.steps[0].phaseId !== p.phaseId || a.steps[0].event !== p.event?.type) {
        issues.push(issue('primary_branch_mismatch', 'branches[0]',
          `primary ${p.phaseId}/${p.event?.type} vs 가지 ${a.steps[0].phaseId}/${a.steps[0].event}`));
      }
    }

    // 5~7. 넘지 않는 선
    if (p.company != null) issues.push(issue('company_generated', 'primary.company', '회사는 언제나 null 이다'));
    if (p.location?.metro && !prepared?.locationEvidenceUsed) {
      issues.push(issue('metro_without_evidence', 'primary.location.metro', '위치 근거 없이 도시권을 냈다'));
    }
    if (p.location?.district && p.location.sourceType !== 'context') {
      issues.push(issue('district_without_context', 'primary.location.district',
        '사용자가 알려준 지역이 아닌데 구·동을 냈다'));
    }

    // 11. 값이 있는 상세에는 근거가 붙어 있는가
    for (const [k, v] of Object.entries(p.detail ?? {})) {
      if (v == null) continue;
      const refs = p.provenance?.detail?.[k] ?? [];
      if (!refs.length) issues.push(issue('detail_without_provenance', `primary.detail.${k}`, '근거가 없다'));
    }
    for (const k of ['timing', 'event']) {
      if (p[k] == null) continue;
      if (!(p.provenance?.[k] ?? []).length) {
        issues.push(issue('field_without_provenance', `primary.${k}`, '근거가 없다'));
      }
    }

    // 12. 분야별 금지어
    const text = JSON.stringify({ event: p.event, detail: p.detail, conditions: p.conditions });
    if (prepared?.domain === 'health' && HEALTH_FORBIDDEN.test(text)) {
      issues.push(issue('health_medical_language', 'primary', '건강에서 진단·질환·수술을 말했다'));
    }
    if (CERTAINTY_FORBIDDEN.test(text)) {
      issues.push(issue('certainty_language', 'primary', '결과를 단정하는 말이 들어갔다'));
    }
    if (COMPANY_LIKE.test(text)) issues.push(issue('company_like_string', 'primary', '회사 이름 같은 문자열'));
  }

  // 8. 1·2위가 팽팽한데 하나를 고른 티를 냈는가
  if (prepared?.scenarioInput?.distinct === false && scenario?.selectionStatus !== 'close') {
    issues.push(issue('close_but_decisive', 'selectionStatus',
      '근거 차이가 거의 없는데 대표를 고른 것처럼 냈다'));
  }

  // 9. 질문과 다른 답을 숨기지 않았는가
  if (prepared?.scenarioInput?.answersQuestion === false
    && scenario?.questionAnswer?.answersQuestion !== false) {
    issues.push(issue('question_mismatch_hidden', 'questionAnswer', '물은 것과 다른 답인데 그렇게 적지 않았다'));
  }

  // 10. 가지의 예측 상태가 사실로 올라가지 않았는가
  for (const br of scenario?.branches ?? []) {
    for (let i = 0; i < (br.steps ?? []).length; i++) {
      const st = br.steps[i];
      if (i > 0 && !st.conditional) {
        issues.push(issue('branch_step_not_conditional', `branches.${br.id}.steps[${i}]`,
          '두 번째 단계부터는 조건부여야 한다'));
      }
      if (st.stateAfter?.kind !== 'predicted') {
        issues.push(issue('branch_state_promoted', `branches.${br.id}.steps[${i}]`,
          '가지의 상태가 predicted 가 아니다'));
      }
    }
  }
  const observed = Object.keys(prepared?.snapshot?.observed ?? {});
  const predictedKeys = Object.keys(prepared?.snapshot?.predicted ?? {});
  for (const k of predictedKeys) {
    if (observed.includes(k)) {
      issues.push(issue('predicted_promoted', `snapshot.${k}`, '예측이 관측 칸에 들어갔다'));
    }
  }

  return { ok: issues.length === 0, issues };
}
