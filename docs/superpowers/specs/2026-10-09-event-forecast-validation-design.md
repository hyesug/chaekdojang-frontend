# Event Forecast Validation Design

## Goal

Evaluate every registered fortune-system rule against private, person-level history and select a single system or a pre-registered independent-system pair only when it generalizes under leave-one-person-out (LOO) validation. The product may state only the event type and time precision that passed validation.

The initial target event definitions are fixed:

- `wedding_ceremony`: the month/year of the wedding ceremony.
- `birth`: the month/year of a birth.

Pregnancy, marriage registration, cohabitation, illness diagnosis, death, and severe injury are not aliases for these targets. Death, loss of contact, and unknown history end observation; they are not events to predict.

## Canonical private casebook

Private casebooks remain ignored by Git. Each event gains optional, explicit fields:

- `eventKind`: the concrete outcome, such as `wedding_ceremony`, `birth`, `job_change`, or `move`.
- `datePrecision`: `month` or `year`; absent month data is never invented.
- `eventFamily`: groups records with one underlying cause so they contribute one effective observation.
- `observedThrough`: the last year/month for which absence of an event is known.
- `observationEnded`: `death`, `lost_contact`, or `unknown_history` when later non-events cannot be scored.

Legacy `결혼` and `자녀` records without an `eventKind` remain readable for diagnostic history but do not qualify as verified wedding/birth targets.

## Rule and candidate registry

Every candidate carries its system IDs, domain, event-kind coverage, natural time resolution, rule version, and an explanation of unavailable coverage. A system may compete for an event only if its own rule defines that event at the relevant resolution. Generic relationship/family activation cannot be counted as a wedding/birth prediction.

Candidates include all single systems and only pre-registered pairs from independent lineages. Candidate IDs, pair eligibility, scoring, and thresholds are fixed before inspecting a held-out person's score. New rules create new versioned candidates; they do not overwrite prior evidence.

## Scoring

For each event, score at the coarsest of the event's recorded precision and candidate's native resolution:

- A yearly candidate is evaluated against the event year, not against a month.
- A monthly candidate may receive a secondary month score, but a year hit remains separately reported.
- An event-kind match is required to claim a concrete outcome. Timing activation and event-kind correctness are reported separately.
- Candidate scores are compared with both a same-person shuffled-date null distribution and an explicit baseline candidate.

Non-events only contribute inside a known observation window. Time after `observedThrough` or after `observationEnded` is excluded rather than treated as an incorrect future forecast.

## Nested LOO selection

Selection is performed per `(domain, eventKind)`:

1. Hold out one person.
2. Select a single candidate or eligible pair using the remaining people only.
3. Score the selected candidate on the held-out person's observed events at native resolution.
4. Repeat for every person and aggregate people equally.

The report policy can be `service` only when the pipeline is stable across folds, improves on baseline by the configured minimum, and beats shuffled dates. A `provisional` candidate remains a diagnostic result and never drives a concrete future-event statement. When no candidate passes, the report omits the event forecast rather than substituting a broad generic signal.

## Product output

User-facing output names the actual prediction and precision: for example, “2029년 결혼식 신호” only for a validated yearly wedding-ceremony candidate. It never upgrades a generic relationship signal into a wedding claim or a family/child signal into a birth claim. Medical diagnoses, death, and severe injury are excluded from prediction output.

## Calculation audit

Calculation correctness is assessed separately from prediction validity using deterministic reference fixtures for calendar boundaries, time-zone/DST handling, lunar/solar conversion, true-solar-time day boundaries, major-cycle boundaries, and system-specific board construction. A passing calculation fixture proves a computation boundary only; it is not evidence that the associated event prediction is valid.

## Initial implementation scope

1. Add canonical event-target and observation-window normalization with tests.
2. Make learner candidates declare event-kind coverage and remove the birth `leadMonths: 9` variant from the birth target.
3. Add nested-LOO evidence and policy gating by event kind and native resolution.
4. Prevent provisional policies from rendering concrete wedding/birth forecasts.
5. Add calculation-audit fixture coverage without changing a formula unless a reproducible discrepancy is found.

## Non-goals

- Infer missing event months, birth times, event kinds, or observation windows.
- Fit rules, weights, or pair lists to a held-out person's result.
- Predict death, diagnoses, severe injury, or other high-stakes medical outcomes.
- Claim a validated forecast before the service gate passes.
