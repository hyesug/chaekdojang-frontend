const monthNumber = (key) => { const [y, m] = key.split('-').map(Number); return y * 12 + m - 1; };
const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

export function evaluateMonths(months, eventKey, toleranceMonths = 0) {
  const rows = months.filter((row) => Number.isFinite(row.score));
  const actual = rows.find((row) => row.key === eventKey);
  if (!actual || !rows.length) return null;
  const sorted = rows.slice().sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const higher = sorted.filter((row) => row.score > actual.score).length;
  const equal = sorted.filter((row) => row.score === actual.score).length;
  const rank = higher + (equal + 1) / 2;
  const bestScore = sorted[0].score;
  const peaks = sorted.filter((row) => row.score === bestScore);
  const inTolerance = (row) => Math.abs(monthNumber(row.key) - monthNumber(eventKey)) <= toleranceMonths;
  const hit = (k) => {
    const threshold = sorted[Math.min(k, sorted.length) - 1]?.score;
    return sorted.filter((row) => row.score >= threshold).some(inTolerance);
  };
  return {
    actualScore: actual.score, rank: round(rank), totalMonths: rows.length,
    percentile: rows.length === 1 ? 100 : round(100 * (rows.length - rank) / (rows.length - 1)),
    hitAt: { 1: hit(1), 3: hit(3), 5: hit(5) },
    peakMonths: peaks.map((row) => row.key),
    nearestPeakError: Math.min(...peaks.map((row) => Math.abs(monthNumber(row.key) - monthNumber(eventKey)))),
    toleranceHit: peaks.some(inTolerance),
    baseline: {
      hitAt: { 1: 1 / rows.length, 3: Math.min(3, rows.length) / rows.length, 5: Math.min(5, rows.length) / rows.length },
      toleranceHit: rows.filter(inTolerance).length / rows.length,
    },
  };
}

export function summarize(results) {
  const values = results.filter(Boolean);
  const percentiles = values.map((r) => r.percentile).sort((a, b) => a - b);
  const median = percentiles.length % 2 ? percentiles[(percentiles.length - 1) / 2]
    : (percentiles[percentiles.length / 2 - 1] + percentiles[percentiles.length / 2]) / 2;
  const avg = (list) => list.length ? round(list.reduce((sum, v) => sum + v, 0) / list.length, 1) : null;
  return {
    sampleSize: values.length, insufficientSample: values.length < 10,
    meanPercentile: avg(values.map((r) => r.percentile)), medianPercentile: median == null ? null : round(median, 1),
    hitAt: { 1: avg(values.map((r) => r.hitAt[1] ? 100 : 0)), 3: avg(values.map((r) => r.hitAt[3] ? 100 : 0)), 5: avg(values.map((r) => r.hitAt[5] ? 100 : 0)) },
    meanPeakError: avg(values.map((r) => r.nearestPeakError)),
  };
}
