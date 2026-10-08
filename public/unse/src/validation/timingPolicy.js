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
 * @param {Array<{person:string, precision:'month'|'year', scores:Record<string,number>}>} rows
 * @param {{baseline:string, shuffledSelectedScores?:number[]}} options
 */
export function selectTimingPolicy(rows, { baseline, shuffledSelectedScores = [] } = {}) {
  if (!baseline) throw new Error('baseline 후보가 필요합니다');
  const people = [...new Set(rows.map((row) => row.person).filter(Boolean))];
  const monthlyEvents = rows.filter((row) => row.precision === 'month').length;
  const full = pick(rows, baseline);

  if (people.length < 6) {
    return { promote: false, selected: baseline, reason: `사람 ${people.length}명 — 최소 6명이 필요합니다`, people: people.length, monthlyEvents };
  }
  if (monthlyEvents < 8) {
    return { promote: false, selected: baseline, reason: `월 정밀 사건 ${monthlyEvents}건 — 최소 8건이 필요합니다`, people: people.length, monthlyEvents };
  }
  if (full.candidate === baseline) {
    return { promote: false, selected: baseline, reason: '기존 방식보다 나은 후보가 없습니다', people: people.length, monthlyEvents };
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
  const promote = stable && gain != null && gain >= 5 && permutationP != null && permutationP <= 0.1;
  const reason = !stable ? '사람 하나를 빼면 고르는 후보가 흔들립니다'
    : gain == null || gain < 5 ? '사람을 빼고 보면 기존 방식보다 충분히 낫지 않습니다'
      : permutationP == null ? '사건 날짜를 섞은 기준선 검증이 없습니다'
        : permutationP > 0.1 ? '사건 날짜를 섞어도 비슷하게 나와 우연과 구별되지 않습니다'
          : '사람 단위 LOO·날짜 섞기 기준을 통과했습니다';

  return {
    promote, selected: promote ? full.candidate : baseline, reason,
    people: people.length, monthlyEvents, full, loo, gain, stable, folds,
    permutation: { p: permutationP, rounds: nulls.length },
  };
}
