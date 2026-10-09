/**
 * Private timing casebook event-target normalization.
 *
 * The casebook owner has defined its legacy domain labels: marriage means a
 * wedding ceremony and children means a birth date. The aliases below bridge
 * the existing event-score key with the product's explicit event definition.
 */
import { candidatesOf } from '../semantic/timing/events.js';

const CONCRETE_TARGETS = Object.freeze({
  marriage: Object.freeze({ wedding_ceremony: 'marriage' }),
  children: Object.freeze({ birth: 'birth' }),
});
const LEGACY_DOMAIN_TARGETS = Object.freeze({ marriage: 'wedding_ceremony', children: 'birth' });

const END_REASONS = new Set(['death', 'lost_contact', 'unknown_history']);
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isRegisteredEventKind(domain, eventKind) {
  if (typeof eventKind !== 'string' || !eventKind) return false;
  if (CONCRETE_TARGETS[domain]?.[eventKind]) return true;
  return candidatesOf(domain).some((candidate) => candidate.key === eventKind);
}

export function eventCandidateKind(domain, eventKind) {
  return CONCRETE_TARGETS[domain]?.[eventKind] ?? eventKind ?? null;
}

/**
 * Normalize validation metadata without changing the historical event itself.
 * @param {{eventKind?: string, month?: number, datePrecision?: string, observedThrough?: string|null, observationEnded?: string|null}} event
 * @param {string} domain
 */
export function normalizeTimingEvent(event = {}, domain) {
  const eventKind = event.eventKind ?? LEGACY_DOMAIN_TARGETS[domain] ?? null;
  const candidateKind = eventCandidateKind(domain, eventKind);
  const precision = event.datePrecision ?? (Number.isInteger(event.month) ? 'month' : 'year');
  const observedThrough = event.observedThrough ?? null;
  const observationEnded = event.observationEnded ?? null;
  const invalidObservation = observedThrough != null && !MONTH_KEY.test(observedThrough) && !/^\d{4}$/.test(observedThrough);
  const invalidEnd = observationEnded != null && !END_REASONS.has(observationEnded);

  let reason = null;
  if (!eventKind) reason = 'eventKind가 없어 구체 사건 검증 목표가 아닙니다';
  else if (!isRegisteredEventKind(domain, eventKind)) reason = '등록된 사건 종류가 아닙니다';
  else if (!['month', 'year'].includes(precision)) reason = 'datePrecision은 month 또는 year여야 합니다';
  else if (invalidObservation) reason = 'observedThrough는 YYYY 또는 YYYY-MM이어야 합니다';
  else if (invalidEnd) reason = 'observationEnded 값이 등록되지 않았습니다';

  return {
    eventKind,
    candidateKind: candidateKind ?? null,
    datePrecision: precision,
    observedThrough,
    observationEnded,
    eligible: reason == null,
    reason,
  };
}

export const EVENT_END_REASONS = Object.freeze([...END_REASONS]);
