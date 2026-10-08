/**
 * 적은 실제 사례로 시기 후보를 고를 때의 안전장치.
 *
 * 한 사람의 사건이 여러 개인 경우도 그 사람을 한 표로만 세며, 어떤 후보도
 * 그 사람이 빠진 학습에서 선택돼 그 사람에게 다시 이겨야 한다. 사례집 점수를
 * 올리는 것이 아니라 다음 사람에게 남는 규칙만 채택하기 위한 함수다.
 */
const mean = (xs) => xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null;

function personMean(rows, candidate) {
  const perPerson = new Map();
  for (const row of rows) {
    const value = row.scores?.[candidate];
    if (!Number.isFinite(value)) continue;
    const values = perPerson.get(row.person) ?? [];
    values.push(value);
    perPerson.set(row.person, values);
  }
  return mean([...perPerson.values()].map(mean));
}

function candidatesOf(rows, baseline) {
  const names = new Set([baseline]);
  for (const row of rows) for (const name of Object.keys(row.scores ?? {})) names.add(name);
  return [...names];
}

function pick(rows, baseline) {
  const ranked = candidatesOf(rows, baseline)
    .map((candidate) => ({ candidate, score: personMean(rows, candidate) }))
    .filter((x) => x.score != null)
    .sort((a, b) => b.score - a.score || (a.candidate === baseline ? -1 : b.candidate === baseline ? 1 : a.candidate.localeCompare(b.candidate)));
  return ranked[0] ?? { candidate: baseline, score: null };
}

function heldOutScore(rows, candidate) {
  return personMean(rows, candidate);
}

/**
 * 잠정 정책 고르기 — **빼고 고르기로 늘 하나를 고른다** (통과/불통과 없음).
 *
 * 한 단위를 가려 두고 나머지로 최고 후보를 고르기를 모든 단위에 반복한 뒤,
 * **가장 많이 뽑힌 후보**를 최종으로 쓴다. 동률이면 사례 전체 점수가 높은 쪽.
 * 사례 하나 덕분에 1등이 된 후보는 그 사례를 빼면 뽑히지 않으므로 표가 갈리고,
 * 어느 것을 빼도 계속 뽑히는 후보가 남는다. 후보는 17체계 단독(15체계 + 현대·고전 점성),
 * 계보가 다른 두 체계의 쌍, 그리고 15체계 전체(baseline)다.
 *
 *  · 단위 — 사람이 3명 이상이면 사람, 그보다 적으면(한 사람 이력뿐인 분야) 사건
 *  · cv — 이렇게 고르는 방법이 빠진 쪽을 얼마나 맞혔는지(참고값). 선택을 막지 않는다.
 *
 * @param {Array<{person:string, scores:Record<string,number>}>} rows
 * @param {{baseline:string}} options
 */
export function selectProvisionalPolicy(rows, { baseline } = {}) {
  if (!baseline) throw new Error('baseline 후보가 필요합니다');
  const people = [...new Set(rows.map((row) => row.person).filter(Boolean))];
  const byPerson = people.length >= 3;
  const units = byPerson ? people : rows.map((_, i) => i);
  const full = pick(rows, baseline);
  if (units.length < 2) {
    return { selected: full.candidate, method: 'single', unit: byPerson ? 'person' : 'event', units: units.length,
      full, cv: null, folds: [], votes: null, agreement: null,
      reason: `사례가 ${units.length}건뿐이라 빼고 고를 수 없어 그 사례 최고를 씁니다` };
  }

  const folds = [];
  for (const unit of units) {
    const train = byPerson ? rows.filter((row) => row.person !== unit) : rows.filter((_, i) => i !== unit);
    const test = byPerson ? rows.filter((row) => row.person === unit) : [rows[unit]];
    const selected = pick(train, baseline).candidate;
    folds.push({ unit, selected, candidateScore: heldOutScore(test, selected), baselineScore: heldOutScore(test, baseline) });
  }
  const scored = folds.filter((f) => Number.isFinite(f.candidateScore) && Number.isFinite(f.baselineScore));
  const cv = { selected: mean(scored.map((f) => f.candidateScore)), baseline: mean(scored.map((f) => f.baselineScore)) };
  const votes = new Map();
  for (const f of folds) votes.set(f.selected, (votes.get(f.selected) ?? 0) + 1);
  const fullScore = (c) => personMean(rows, c) ?? -Infinity;
  const [selected, count] = [...votes.entries()]
    .sort((a, b) => b[1] - a[1] || fullScore(b[0]) - fullScore(a[0]) || a[0].localeCompare(b[0]))[0];
  return {
    selected, method: 'loo-vote', unit: byPerson ? 'person' : 'event', units: units.length,
    full, cv, folds, votes: Object.fromEntries(votes), agreement: count / folds.length,
    reason: `${folds.length}번 빼고 고르기 중 ${count}번 뽑혔습니다`,
  };
}
/**
 * @param {Array<{person:string, precision:'month'|'year', scores:Record<string,number>}>} rows
 * @param {{baseline:string, shuffledSelectedScores?:number[]}} options
 */
export function selectTimingPolicy(rows, { baseline, shuffledSelectedScores = [], candidateSystems = {} } = {}) {
  if (!baseline) throw new Error('baseline 후보가 필요합니다');
  const people = [...new Set(rows.map((row) => row.person).filter(Boolean))];
  const monthlyEvents = rows.filter((row) => row.precision === 'month').length;
  const full = pick(rows, baseline);

  if (people.length < 6) {
    return { promote: false, scope: 'personal', selected: baseline, personalSelected: full.candidate,
      reason: `사람 ${people.length}명 — 최소 6명이 필요합니다`, people: people.length, monthlyEvents, pairComparison: null };
  }
  if (monthlyEvents < 8) {
    return { promote: false, scope: 'personal', selected: baseline, personalSelected: full.candidate,
      reason: `월 정밀 사건 ${monthlyEvents}건 — 최소 8건이 필요합니다`, people: people.length, monthlyEvents, pairComparison: null };
  }
  if (full.candidate === baseline) {
    return { promote: false, scope: 'personal', selected: baseline, personalSelected: full.candidate,
      reason: '기존 방식보다 나은 후보가 없습니다', people: people.length, monthlyEvents, pairComparison: null };
  }

  const selectedScores = [];
  const baselineScores = [];
  const folds = [];
  for (const person of people) {
    const train = rows.filter((row) => row.person !== person);
    const test = rows.filter((row) => row.person === person);
    const selected = pick(train, baseline).candidate;
    const candidateScore = heldOutScore(test, selected);
    const baselineScore = heldOutScore(test, baseline);
    if (candidateScore != null) selectedScores.push(candidateScore);
    if (baselineScore != null) baselineScores.push(baselineScore);
    folds.push({ person, selected, candidateScore, baselineScore });
  }
  const loo = { selected: mean(selectedScores), baseline: mean(baselineScores) };
  const stable = folds.every((fold) => fold.selected === full.candidate);
  const gain = loo.selected == null || loo.baseline == null ? null : loo.selected - loo.baseline;
  const nulls = shuffledSelectedScores.filter(Number.isFinite);
  const permutationP = nulls.length
    ? (nulls.filter((score) => score >= loo.selected).length + 1) / (nulls.length + 1)
    : null;
  const selectedSystems = candidateSystems[full.candidate] ?? [];
  const isPair = selectedSystems.length === 2;
  const memberNames = isPair ? Object.entries(candidateSystems)
    .filter(([, systems]) => Array.isArray(systems) && systems.length === 1 && selectedSystems.includes(systems[0]))
    .map(([name]) => name) : [];
  const fixedLoo = (candidate) => mean(people.map((person) =>
    heldOutScore(rows.filter((row) => row.person === person), candidate)).filter(Number.isFinite));
  const memberScores = memberNames.map((name) => ({ candidate: name, score: fixedLoo(name) }))
    .filter((x) => x.score != null).sort((a, b) => b.score - a.score);
  const pairScore = isPair ? fixedLoo(full.candidate) : null;
  const pairComparison = isPair ? {
    pair: full.candidate, pairScore, bestMember: memberScores[0]?.candidate ?? null,
    bestMemberScore: memberScores[0]?.score ?? null,
    beatsBestMember: memberScores.length ? pairScore > memberScores[0].score : true,
  } : null;
  const pairWins = pairComparison?.beatsBestMember ?? true;
  const promote = stable && pairWins && gain != null && gain >= 5 && permutationP != null && permutationP <= 0.1;
  const reason = !stable ? '사람 하나를 빼면 고르는 후보가 흔들립니다'
    : !pairWins ? '쌍 후보가 사람 단위 LOO에서 가장 나은 단독 후보를 이기지 못합니다'
    : gain == null || gain < 5 ? '사람을 빼고 보면 기존 방식보다 충분히 낫지 않습니다'
      : permutationP == null ? '사건 날짜를 섞은 기준선 검증이 없습니다'
        : permutationP > 0.1 ? '사건 날짜를 섞어도 비슷하게 나와 우연과 구별되지 않습니다'
          : '사람 단위 LOO·날짜 섞기 기준을 통과했습니다';

  return {
    promote, scope: promote ? 'service' : 'personal',
    selected: promote ? full.candidate : baseline, personalSelected: full.candidate, reason,
    people: people.length, monthlyEvents, full, loo, gain, stable, folds,
    permutation: { p: permutationP, rounds: nulls.length }, pairComparison,
  };
}
