import { readFortune } from '../engine.js';
import { buildGrid } from '../hires/grid.js';
import { scoreSystemsForBenchmark } from '../hires/events.js';
import { CORE_IDS } from '../multilayerInterpretation.js';

const addMonths = (date, delta) => {
  const [year, month] = date.split('-').map(Number); const value = year * 12 + month - 1 + delta;
  return { year: Math.floor(value / 12), month: value % 12 + 1 };
};
const keyOf = (from) => `${from.y}-${String(from.m).padStart(2, '0')}`;

export function collectBenchmarkMonths(profile, event, options = {}) {
  const halfWindow = Math.min(30, Math.max(18, options.halfWindowMonths ?? 18));
  const start = addMonths(event.date, -halfWindow);
  const end = addMonths(event.date, halfWindow);
  const fortune = readFortune(profile, { now: new Date(`${start.year}-06-01T00:00:00Z`) });
  const out = Object.fromEntries(CORE_IDS.map((id) => [id, []]));
  for (let year = start.year; year <= end.year; year += 6) {
    const grid = buildGrid(fortune.input, fortune.chart, { fromYear: year, years: Math.min(6, end.year - year + 1), domain: event.domain });
    for (const month of grid.months) {
      const key = keyOf(month.from);
      if (key < event.date.slice(0, 7) && month.from.y * 12 + month.from.m < start.year * 12 + start.month) continue;
      if (month.from.y * 12 + month.from.m > end.year * 12 + end.month) continue;
      const scores = scoreSystemsForBenchmark(month, event.domain);
      for (const id of CORE_IDS) out[id].push({ key, score: scores[id] });
    }
  }
  return out;
}
