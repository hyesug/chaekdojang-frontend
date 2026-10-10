# Event Forecast Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make timing validation select and report only concrete, event-kind-aware forecasts that generalize under person-level LOO validation.

**Architecture:** Normalize private historical events without inferring missing facts. Generate every registered candidate's native-resolution timing and event-kind scores, then select single systems or pre-registered independent pairs per domain/event kind. Only service-grade selections can drive a concrete report forecast.

**Tech Stack:** Vanilla ES modules, Node test runner, existing fortune timing engine and private ignored casebooks.

**Spec:** `docs/superpowers/specs/2026-10-09-event-forecast-validation-design.md`

## Global Constraints

- Private casebooks remain ignored and no missing dates, kinds, or observation windows are inferred.
- `wedding_ceremony` means ceremony date and `birth` means birth date; pregnancy offsets are excluded.
- All systems remain eligible only through their registered rules; pairs must span independent lineages.
- Score at native candidate/event precision, keep event-kind correctness separate from timing, and use people equally in LOO.
- Provisional evidence is diagnostic only and cannot render a concrete forecast.
- Do not create death, diagnosis, or severe-injury predictions.

## Review Focus

- A legacy 결혼/자녀 row without `eventKind` remains readable but is not used as a wedding/birth target; Task 1 test.
- A known yearly candidate is scored on the event year even if the case knows its month; Task 2 test.
- `birth` never receives the historic nine-month shift; Task 2 test.
- An event score that has the wrong leading event type cannot validate a concrete forecast; Task 2 test.
- A provisional winner remains absent from report policy output; Task 3 test.

---

### Task 1: Canonical private event targets

**Files:**
- Create: `public/unse/src/validation/eventTargets.js`
- Modify: `scripts/learn-report-timing-policy.mjs`
- Modify: `scripts/validate-timing.mjs`
- Modify: `validation/README.md`
- Test: `tests/unse/event-targets.test.mjs`

**Interfaces:**
- Produces `normalizeTimingEvent(event, domain)` returning `{ eventKind, datePrecision, observedThrough, observationEnded, eligible, reason }`.
- Produces `isRegisteredEventKind(domain, eventKind)` using `EVENT_CANDIDATES`.

- [ ] Write tests for explicit wedding/birth targets, legacy rows, invalid kinds, and observation-end metadata.
- [ ] Run `node --test tests/unse/event-targets.test.mjs` and confirm it fails because the module is absent.
- [ ] Implement normalization without mutating or filling private history; propagate normalized fields through both validation scripts.
- [ ] Document event-kind keys and observation metadata in `validation/README.md`.
- [ ] Run the focused tests and commit `feat(unse): 사건 목표 사례 형식 고정`.

### Task 2: Candidate event-kind and native-resolution scoring

**Files:**
- Modify: `public/unse/src/semantic/timing/timeline.js`
- Modify: `scripts/learn-report-timing-policy.mjs`
- Test: `tests/unse/timing-event-candidates.test.mjs`
- Test: `tests/unse/timing-policy-selection.test.mjs`

**Interfaces:**
- `predictTimeline(...)` adds `validationEventCandidates[candidate][domain][period][eventKind]` and `validationCandidateMeta[candidate][domain].resolution`.
- Learner scores the declared `eventKind` from candidate event scores and uses yearly scoring for yearly candidate metadata.

- [ ] Write failing tests proving candidate-specific event scores include `wedding_ceremony`/`birth`-equivalent registered candidates and that yearly metadata invokes yearly scoring.
- [ ] Run the focused tests and confirm the new fields are missing.
- [ ] Generate event scores from each candidate's own pooled activation/direction, retain native candidate resolution, and select only candidates that expose the declared event kind.
- [ ] Remove child `leadMonths` candidates and score `birth` at its recorded date.
- [ ] Run focused tests and commit `feat(unse): 사건별 LOO 후보 점수화`.

### Task 3: Event-specific evidence and report gate

**Files:**
- Modify: `public/unse/src/validation/timingPolicy.js`
- Modify: `public/unse/src/semantic/timing/policy.js`
- Modify: `public/unse/src/report.js`
- Test: `tests/unse/timing-policy-selection.test.mjs`
- Test: `tests/unse/timing-report-policy.test.mjs`

**Interfaces:**
- A policy entry may declare `eventKind` and `resolution`.
- `reportTimingPolicy(domain, eventKind?)` returns only `scope: 'service'` for concrete event requests.

- [ ] Write failing tests proving provisional wedding/birth policy is unavailable to the report and a service policy with a mismatched event kind is rejected.
- [ ] Run focused tests and confirm current provisional behavior fails the new assertion.
- [ ] Gate concrete event output on event-kind match and service scope; preserve non-event timing interpretation without turning it into an outcome claim.
- [ ] Run focused tests and commit `fix(unse): 검증 전 사건 예측 숨김`.

### Task 4: End-to-end learner diagnostics

**Files:**
- Modify: `scripts/learn-report-timing-policy.mjs`
- Modify: `scripts/validate-timing.mjs`
- Test: `tests/unse/event-targets.test.mjs`

**Interfaces:**
- Learner reports skipped legacy/unqualified events, event-kind coverage, native resolution, person-level LOO evidence, and service/provisional decision.

- [ ] Write a fixture test showing unqualified legacy rows are reported as skipped rather than silently scored.
- [ ] Implement aggregate diagnostic counters only; do not print private names or raw birth data in summary sections.
- [ ] Run `npm run test:unse` and the learner against the local private casebook if present.
- [ ] Commit `test(unse): 사건 예측 검증 근거를 분리`.
