# Fortune System Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone CLI benchmark that measures each core fortune system's monthly event-ranking performance.

**Architecture:** A validation module collects pre-existing grid values without changing engine calculations. Pure metric functions rank and aggregate scores; a CLI formats and persists the results.

**Tech Stack:** Node.js ESM, Node test runner, existing browser-compatible fortune modules.

**Spec:** `docs/superpowers/specs/2026-09-21-fortune-system-benchmark-design.md`

## Global Constraints

- Preserve all existing fortune logic, UI, weights, `CORE_IDS`, and Claude prompt unchanged.
- Use only the direct score/rank of the four IDs in `CORE_IDS` for v1.
- Standard input is anonymized `profile` plus `events[].date` JSON; do not alter legacy validation input.
- Never fit weights to the benchmark data.

## Review Focus

- Tied score boundary includes every tied month in Hit@K.
- Missing birth time skips only time-required systems.
- One system failure does not abort other systems or events.
- `YYYY-MM` conversion retains the requested civil month across year boundaries.
- Domain samples below ten are visibly marked insufficient.

### Task 1: Pure ranking metrics

**Files:** Create `public/unse/src/validation/metrics.js`; Test `tests/unse/benchmark-metrics.test.mjs`.

- [ ] Write failing tests for peak Hit@1, tolerance hit, percentile, tied ranks, and insufficient samples; run `node --test tests/unse/benchmark-metrics.test.mjs` and observe missing-module failure.
- [ ] Implement minimal pure ranking, baseline, and aggregate functions; rerun the focused test and then `npm test`.

### Task 2: Score collection and result runner

**Files:** Create `public/unse/src/validation/benchmark.js`, `public/unse/src/validation/runner.js`; Test `tests/unse/benchmark-runner.test.mjs`.

- [ ] Write failing tests for new input validation, missing time skip, and isolated system failure; run the focused test and observe failure.
- [ ] Implement the smallest adapter around existing core score functions and runner aggregation; rerun focused tests then `npm test`.

### Task 3: CLI, sample data, and documentation

**Files:** Create `scripts/fortune-benchmark.mjs`, `public/unse/src/validation/README.md`, `public/unse/validation-data/sample.json`; modify `package.json` only to add a script if useful.

- [ ] Write a failing CLI integration test for console and JSON output; run it and observe failure.
- [ ] Implement CLI and docs, execute sample CLI with `--json`, then run `npm test` and `npm run build`.
