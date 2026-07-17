# Task 6 Report: JSON/JSONL codecs and accessible step summary

## Status

Implemented `parseTraceJson`, `parseTraceJsonl`, and `describeSnapshot`, with
public exports from `@dllm-viz/core`.

## TDD evidence

1. RED: Added the six specified tests and ran:
   `pnpm --filter @dllm-viz/core exec vitest run src/codec src/player/describe.test.ts`
   Both suites failed because `./json` and `./describe` did not exist.
2. GREEN: Added the minimal implementations and reran the same command.
   Result: 2 test files passed, 6 tests passed.
3. VERIFY: Ran `pnpm lint && pnpm typecheck && pnpm test`. The first lint run
   identified one formatting-only issue in `json.test.ts`; after applying the
   formatter's expected layout, the full command passed.

## Verification

- Lint: 4/4 package tasks passed.
- Typecheck: 4/4 package tasks passed.
- Tests: all package tasks passed; core has 7 files and 45 tests passing.

## Self-review

- JSON input delegates schema and configured limit checks to `parseTrace`.
- JSONL requires metadata first, validates every event, assembles ordered
  frames/checkpoints/final data, and preserves streams without a final event.
- Snapshot summaries omit prompt slots and count fixed slots as committed and
  renoised slots as remasked.
- No React dependency or unrelated changes were introduced.

## Concerns

None.

---

## Review fix: final closes the logical trace

### What changed

- Added a `parseTraceJsonl` guard that rejects every stream event after a
  `final` event, including a duplicate `final`.
- Added regression tests for a frame after final and a duplicate final.
- Updated the Task 6 plan and task brief to preserve the spec decision.
- Metadata payloads were left intact: metadata-internal frames/final are NOT
  rejected by the codec.

### TDD and verification

- RED:
  `pnpm --filter @dllm-viz/core exec vitest run src/codec/json.test.ts`
  failed in the two new tests for the expected missing guard.
- GREEN:
  `pnpm --filter @dllm-viz/core exec vitest run src/codec`
  passed: 1 file, 7 tests.
- Full:
  `pnpm lint && pnpm typecheck && pnpm test`
  passed: lint 4/4 tasks, typecheck 4/4 tasks, and all test tasks; core passed
  7 files and 47 tests.

### Files changed

- `packages/core/src/codec/json.ts`
- `packages/core/src/codec/json.test.ts`
- `docs/superpowers/plans/2026-07-18-phase0-1-trace-core-mvp.md`
- `.superpowers/sdd/task-6-brief.md`
- `.superpowers/sdd/task-6-report.md`
