# Personal Timing Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compare each timing domain on an independent event window, then let personal historical cases choose between all single systems and disciplined combinations, including separate classical and modern Western-astrology candidates.

**Architecture:** Extract person-domain event windows from the private casebook so an unrelated old event cannot alter a domain's score. Score both the activation date and the declared event kind/direction (such as promotion, income increase, move, relationship start, or breakup). Add two Western timing candidates behind the existing common timing schema, while retaining the current combined `astrology` output for compatibility. The policy learner evaluates singles and only pre-registered two-system combinations with person-level leave-one-out selection; personal-only findings remain marked as personal and cannot overwrite a service-wide policy.

**Tech Stack:** Vanilla ES modules, Node test runner, existing timing timeline and validation metrics.

**Spec:** Conversation requirements on 2026-10-08: compare all 15 traditions; distinguish classic and modern Western astrology; use supplied personal history for provisional personal calibration; do not treat uncertain dates or correlated job/salary events as independent universal proof.

## Global Constraints

- Keep `validation/cases.json` private and ignored; never commit personal history.
- Preserve the existing 15-system result shape for current report and AI flows.
- Score dates at their declared precision; inferred dates carry their source and are never presented as exact facts.
- Do not predict medical diagnoses or use family hardship as a predictive target.
- Production policy requires multi-person evidence; personal policy is visibly scoped to that chart only.

## Review Focus

- An unrelated 2010 relationship event must not alter a 2021–2026 career score.
- An uncertain month must never become an exact-day score.
- A salary change caused by one job move must not be counted as two independent validation people/events for promotion.
- A candidate that catches the month but ranks a breakup above a relationship start does not receive situation-match credit.
- Time-unknown charts must keep classical/modern astrology unavailable rather than inventing houses.
- Pair combinations must not be promoted when their leave-one-out score is lower than the selected single system.

---

### Task 1: Domain-isolated validation windows

**Files:**
- Create: `public/unse/src/validation/timingCaseWindows.js`
- Modify: `scripts/validate-timing.mjs`
- Test: `tests/unse/timing-case-windows.test.mjs`

**Interfaces:**
- Produces `groupTimingEvents(cases, domainOf, { paddingYears })`, yielding `{ person, domain, birth, events, from, to }` once per person-domain.
- `validate-timing.mjs` consumes each group to call `predictTimeline` independently.

- [x] Write a failing test proving a P01 career group keeps the same `from` and `to` when an unrelated 2010 relationship event is added.
- [x] Run the new test and confirm it fails because `groupTimingEvents` is missing.
- [x] Implement `groupTimingEvents` and change the validator to calculate one timeline per person-domain group.
- [x] Run the focused test and `npm run unse:timing-validate`; confirm the career window is no longer expanded by relationship history.
- [x] Commit with `fix(unse): 분야별 검증 창 분리`.

### Task 2: Situation-and-direction validation

**Files:**
- Modify: `public/unse/src/validation/timingMetrics.js`
- Modify: `scripts/validate-timing.mjs`
- Test: `tests/unse/timing-event-match.test.mjs`

**Interfaces:**
- Case events may declare `eventKind` from `EVENT_CANDIDATES[domain]` and optional `eventFamily` for correlated job/salary changes.
- Produces `scoreEventKind(series, eventKey)`, using the same ranking semantics as `scoreEvent` but over the declared candidate's score.

- [x] Write a failing test where a high activation month is not a situation hit when `breakup` outranks the recorded `new_relationship`.
- [x] Run the focused test and confirm `scoreEventKind` is missing.
- [x] Add event-kind and event-family handling to the private case reader; report timing accuracy and situation-match accuracy separately; policy learning consumes families in Task 4.
- [x] Run the focused test and `npm run unse:timing-validate`; confirm the output distinguishes “when” from “what happened.”
- [ ] Commit with `feat(unse): 사건 성격까지 시기 검증`.

### Task 3: Classical and modern Western timing candidates

**Files:**
- Modify: `public/unse/src/semantic/timing/adapters.js`
- Modify: `public/unse/src/semantic/timing/timeline.js`
- Modify: `public/unse/src/semantic/extract.js`
- Test: `tests/unse/western-timing-candidates.test.mjs`

**Interfaces:**
- Produces `modernAstrologyTiming(...)` and `classicalAstrologyTiming(...)`, each conforming to the existing `signal()` shape.
- `predictTimeline(..., { validationPolicies })` exposes both only as validation candidates; current `astrology` remains backward-compatible.

- [ ] Write failing tests showing classical and modern candidates have distinct IDs and that unknown birth time makes both unavailable.
- [ ] Run the focused test and confirm the candidate functions do not yet exist.
- [ ] Implement modern timing from transits/progressions/solar-arc material already calculated by the Western engine; implement classical timing from traditional seven planets, house rulers, and annual profection.
- [ ] Run the focused test and the relevant timing tests; verify existing `astrology` results remain available.
- [ ] Commit with `feat(unse): 고전·현대 점성 시기 후보 분리`.

### Task 4: Scoped single-and-pair policy selection

**Files:**
- Modify: `scripts/learn-report-timing-policy.mjs`
- Modify: `public/unse/src/validation/timingPolicy.js`
- Modify: `public/unse/src/semantic/timing/policy.js`
- Test: `tests/unse/timing-policy-selection.test.mjs`

**Interfaces:**
- Learner emits `{ scope: 'service' | 'personal', systems, basis, evidence }`.
- The report policy accepts only `scope: 'service'`; a personal result is diagnostic until explicitly enabled for that user.

- [ ] Write failing tests proving a pair is rejected when it loses leave-one-out performance to its best member, and personal-only evidence cannot overwrite a service policy.
- [ ] Run the focused test and confirm it fails on missing scope/selection behavior.
- [ ] Generate all single candidates and pre-registered independent pairs, use person-level leave-one-out and shuffled-date comparison, and record correlated event families as one effective event.
- [ ] Run the focused tests, `npm run unse:timing-learn`, and `npm run test:unse`.
- [ ] Commit with `feat(unse): 개인·서비스 시기 정책 분리`.

## Self-review

- Task 1 owns window independence; Task 2 owns event-semantic accuracy; Task 3 adds candidates without changing current report contracts; Task 4 consumes candidate IDs and enforces personal/service scope.
- No task treats family background, health diagnosis, or an unknown date as a forecast target.
- The plan deliberately limits combinations to pairs: exhaustive subsets would overfit the current small casebook and cannot be validated by leave-one-out.
