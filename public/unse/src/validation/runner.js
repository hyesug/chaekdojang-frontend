import { evaluateMonths, summarize } from './metrics.js';
import { CORE_IDS } from '../multilayerInterpretation.js';

export function runBenchmark(cases, options = {}) {
  const people = [];
  const resultsBySystem = Object.fromEntries(CORE_IDS.map((id) => [id, []]));
  const resultsByDomain = {};
  for (const person of cases) {
    const events = [];
    for (const event of person.events ?? []) {
      const systems = {};
      let collected = {};
      try { collected = options.collect ? options.collect(person.profile, event) : {}; } catch (error) { collected = Object.fromEntries(CORE_IDS.map((id) => [id, error])); }
      for (const id of CORE_IDS) {
        if (person.profile.hour == null && id === 'jamidusu') { systems[id] = { status: 'skipped', reason: 'birth time unknown' }; continue; }
        const months = collected[id];
        if (months instanceof Error) { systems[id] = { status: 'error', message: months.message }; continue; }
        const metric = evaluateMonths(months ?? [], event.date, event.toleranceMonths ?? 0);
        if (!metric) { systems[id] = { status: 'unavailable', reason: 'no score for event month' }; continue; }
        systems[id] = { status: 'ok', ...metric };
        resultsBySystem[id].push(metric);
        ((resultsByDomain[event.domain] ??= {})[id] ??= []);
        resultsByDomain[event.domain][id].push(metric);
      }
      events.push({ ...event, systems });
    }
    people.push({ id: person.id, events });
  }
  return { people, systems: Object.fromEntries(CORE_IDS.map((id) => [id, summarize(resultsBySystem[id])])), domains: Object.fromEntries(Object.entries(resultsByDomain).map(([domain, v]) => [domain, Object.fromEntries(CORE_IDS.map((id) => [id, summarize(v[id] ?? [])]))])) };
}
