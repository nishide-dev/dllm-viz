# Phase 2: Research-Useful Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement docs/spec.md Phase 2 (§24): `CommitHeatmap` (§15.4), `CandidateDistribution` (§15.6), `BlockDiffusionCanvas` (§15.5), `DiffusionComparison` (§15.7), synchronized selection, new fixtures (`block-canvas`, `confidence-commit`, `ar-baseline` per §23) plus a generated dense performance fixture (§21.6), commit-matrix statistics in core, demo routes (§22), and the four new registry items.

**Architecture:** `@dllm-viz/core` gains a `stats/` module (`buildCommitMatrix` — position × frame typed-array matrix built in one incremental delta pass, seeded from checkpoints for windowed builds) and a deterministic seeded trace generator in `testing/`. `@dllm-viz/react` gains a headless `DiffusionSelectionProvider` + `useSlotSelection()` so canvas/inspector/heatmap/distribution link a selected slot without prop drilling (shared selection is UI state, so it lives in the React package, **not** core). The four new visual components live in `registry/default/*`, import only consumer-safe `@/lib/*` aliases, and are self-contained (no cross-registry-item component imports). `apps/web` gets one demo route per component plus `/compare`, rendering the same registry source users install. `scripts/build-registry.mjs` gains four component items.

**Tech Stack:** unchanged from Phase 1 — React 19, Vite 8, TypeScript ~6, Zod ^4.4.3, Vitest 4 + React Testing Library, Biome, pnpm 10 + Turborepo, react-router-dom ^7. New: `CanvasRenderingContext2D` for the dense heatmap (no charting library).

## Global Constraints

- Node `>=20`, pnpm `10.33.4` (`packageManager` field). Run everything from repo root with `pnpm --filter <pkg> …`.
- Biome-enforced style: 2-space indent, line width 80, double quotes, semicolons `asNeeded`, trailing commas `es5`, sorted Tailwind classes in `cn()`, alphabetically sorted JSX props. Unused vars/imports are errors. Pre-commit hook auto-fixes staged files.
- `@dllm-viz/core` MUST have no React dependency (spec §8.3). `@dllm-viz/react` MUST be headless — no visual styling (spec §8.3). The selection provider renders no DOM of its own.
- Registry source under `registry/default/*` MUST NOT import `@workspace/*` or Next.js APIs (spec §16.3). Allowed imports: react, lucide-react, `@/lib/dllm-viz-core`, `@/lib/dllm-viz-react`, `@/lib/utils`.
- Registry items must NOT import each other's component source (`@/registry/...` paths are demo-only and are not rewritten reliably for custom registries on install). Where two items need the same visual chip, duplicate the small helper — registry items are self-contained by design.
- **registryDependencies for cross-item deps MUST use the `nishide-dev/dllm-viz/<item>` form** — bare names are resolved against the official shadcn registry and 404 (learned in PR #2). The existing `componentItem` helper in `scripts/build-registry.mjs` already does this; new items MUST go through it.
- `apps/web` tsconfig uses `erasableSyntaxOnly` + `verbatimModuleSyntax`: registry files must not use enums/namespaces and must use `import type` for types.
- `DiffusionSnapshot.slots` is `readonly TokenSlot[]` (and `useTokenSlots()` returns `readonly TokenSlot[]`). New code must accept `readonly TokenSlot[]` or copy with `[...slots]` before mutating-style APIs; never cast the readonly away.
- Canvas rendering MUST handle `devicePixelRatio` (backing store scaled by dpr, CSS size in layout px). The heatmap MUST NOT use DOM for tens of thousands of cells (spec §19.2): DOM/SVG at or below a configurable cell-count threshold, Canvas above it.
- jsdom cannot test real canvas painting. Structure canvas code so all data mapping (`buildCommitMatrix`, cell→color, point→cell) is pure and unit-testable, and the paint function is a thin loop over the matrix. Component tests assert the DOM-mode markup, the mode threshold, and the accessible exact-value readout — never painted pixels.
- Trace rules: `schemaVersion: "0.1"`; checkpoints only in top-level `checkpoints` array, never as frames (D-014); `initial.frameOrdinal === -1`; frame ordinals strictly increasing; slot IDs are monotonic `s0`, `s1`, … never reused (D-013).
- All hand-authored fixtures MUST set `provenance.mode: "illustrative"` (spec §23). The dense performance fixture is generated at build/test time by a committed deterministic generator — the generated JSON (>1 MB, spec §19.3) is NEVER committed or exported to `examples/` or `apps/web/public/traces`.
- No `Math.random` anywhere in fixtures or generators — the generator uses a seeded LCG so output is byte-identical across runs.
- Accessibility (spec §18): keyboard operable, no color-only state encoding (the heatmap uses per-state glyphs plus a focus/hover exact-value readout, not just cell color), `prefers-reduced-motion` respected without information loss (§17.3), no per-token live-region spam, semantic buttons, visible focus.
- The trace protocol treats remasking as normal: components must re-derive "current" distribution/confidence after every `mask`/`renoise` boundary (same rule TraceInspector already implements) and must not assume monotonic unmasking or left-to-right generation.
- `DiffusionComparison` MUST show the selected sync rule visibly and MUST NOT imply frame-to-frame equivalence when step definitions differ (spec §15.7).
- Before every commit: `pnpm lint && pnpm typecheck && pnpm test` must pass. Tasks that touch `packages/*` sources must also run `pnpm registry:build` before committing so `registry/default/lib` and `registry.json` stay in sync (CI has a drift check).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

```
packages/core/
  src/testing/fixtures.ts            (Task 1, modify) + blockCanvasTrace, confidenceCommitTrace, arBaselineTrace
  src/testing/fixtures-phase2.test.ts (Task 1)
  src/testing/generate.ts            (Task 1) generatePerformanceTrace (seeded LCG)
  src/testing/generate.test.ts       (Task 1)
  scripts/export-fixtures.mjs        (Task 1, modify) export the 3 new JSON fixtures (NOT the perf trace)
  src/stats/commit-matrix.ts         (Task 2) buildCommitMatrix, getMatrixCell, describeMatrixCell, TOKEN_STATE_CODES, MATRIX_ABSENT
  src/stats/commit-matrix.test.ts    (Task 2)
  src/stats/perf.test.ts             (Task 9) performance smoke (spec §21.6)
  src/index.ts                       (Tasks 1–2, modify)
packages/react/
  src/selection.tsx                  (Task 3) DiffusionSelectionProvider, useSlotSelection, useOptionalSlotSelection
  src/selection.test.tsx             (Task 3)
  src/index.ts                       (Task 3, modify)
registry/default/
  denoising-token-canvas/…           (Task 3, modify) selection-context fallback
  trace-inspector/…                  (Task 3, modify) selection-context fallback
  commit-heatmap/commit-heatmap.tsx  (Tasks 4–5)
  candidate-distribution/candidate-distribution.tsx (Task 6)
  block-diffusion-canvas/block-diffusion-canvas.tsx (Task 7)
  diffusion-comparison/diffusion-comparison.tsx     (Task 8)
  lib/                               GENERATED by scripts/build-registry.mjs — never edit
apps/web/src/
  test/setup.ts                      (Task 5, modify) quiet canvas getContext stub
  components/synchronized-selection.test.tsx (Task 3)
  components/commit-heatmap.test.tsx          (Tasks 4–5)
  components/candidate-distribution.test.tsx  (Task 6)
  components/block-diffusion-canvas.test.tsx  (Task 7)
  components/diffusion-comparison.test.tsx    (Task 8)
  routes/commit-heatmap-demo.tsx              (Task 9)
  routes/candidate-distribution-demo.tsx      (Task 9)
  routes/block-diffusion-canvas-demo.tsx      (Task 9)
  routes/compare.tsx                          (Task 9)
  routes/home.tsx  App.tsx  App.test.tsx      (Task 9, modify)
  routes/denoising-token-canvas-demo.tsx      (Task 3, modify — use selection provider)
scripts/build-registry.mjs           (Task 9, modify) + 4 component items
examples/traces/*.json               GENERATED (block-canvas.json, confidence-commit.json, ar-baseline.json)
apps/web/public/traces/*.json        GENERATED (same three)
```

Component tests live in `apps/web/src/components` (not `registry/`) so the existing vitest setup applies; they import registry source through the same aliases users get.

---

### Task 1: Phase 2 fixtures and the dense performance-trace generator

**Files:**
- Create: `packages/core/src/testing/fixtures-phase2.test.ts`, `packages/core/src/testing/generate.ts`, `packages/core/src/testing/generate.test.ts`
- Modify: `packages/core/src/testing/fixtures.ts`, `packages/core/scripts/export-fixtures.mjs`, `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `slot()` and `sharedMeta` helpers already in `fixtures.ts`; `applyOperations`, `parseTrace`, `materializeSlots`.
- Produces (exported from `@dllm-viz/core` and `@dllm-viz/core/testing`):
  - `blockCanvasTrace: DiffusionTrace` — `geometry.generationMode: "canvas-diffusion"`, two canvases of `canvasLength: 3`, `canvas-start`/`canvas-commit` frames with `canvasIndex`, inner `denoise` frames with `canvasIndex` + `innerStep` (§13 required distinctions), mid-trace checkpoint after canvas 0 commits. Final text `"List two colors: One: red, Two: blue."`.
  - `confidenceCommitTrace: DiffusionTrace` — confidence-ranked commits; every commit is preceded by a `set-distribution` (with `entropy`, `margin`, `omittedMass`); slot `s2` receives two successive distributions so churn is visible. Final text `"The capital of France is Paris."`.
  - `arBaselineTrace: DiffusionTrace` — left-to-right autoregressive baseline, one commit per frame in index order, same prompt and final text as `confidenceCommitTrace` (so `/compare` is a same-prompt AR-vs-diffusion demo).
  - `generatePerformanceTrace(options?: PerformanceTraceOptions): DiffusionTrace` — deterministic LCG-seeded dense trace, defaults 256 slots × 512 frames × 10 ops/frame with checkpoints every 64 frames (spec §21.6, §9.13). `PerformanceTraceOptions = { slotCount?; frameCount?; opsPerFrame?; checkpointInterval?; seed? }`.

- [ ] **Step 1: Write the failing fixture tests** (`packages/core/src/testing/fixtures-phase2.test.ts`)

```ts
import { describe, expect, it } from "vitest"

import { materializeSlots } from "../player/materialize"
import type { DiffusionTrace } from "../schema/types"
import { parseTrace } from "../schema/validate"
import {
  arBaselineTrace,
  blockCanvasTrace,
  confidenceCommitTrace,
} from "./fixtures"

const finalText = (trace: DiffusionTrace) =>
  materializeSlots(trace, trace.frames.length - 1)
    .map((s) => s.text ?? "")
    .join("")

describe("phase 2 fixtures", () => {
  it("all three fixtures pass schema validation", () => {
    expect(() => parseTrace(blockCanvasTrace)).not.toThrow()
    expect(() => parseTrace(confidenceCommitTrace)).not.toThrow()
    expect(() => parseTrace(arBaselineTrace)).not.toThrow()
  })

  it("all three fixtures are labeled illustrative (spec §23)", () => {
    expect(blockCanvasTrace.provenance.mode).toBe("illustrative")
    expect(confidenceCommitTrace.provenance.mode).toBe("illustrative")
    expect(arBaselineTrace.provenance.mode).toBe("illustrative")
  })

  it("block canvas trace exercises canvas geometry (spec §13)", () => {
    expect(blockCanvasTrace.geometry.generationMode).toBe("canvas-diffusion")
    const kinds = blockCanvasTrace.frames.map((f) => f.kind)
    expect(kinds.filter((k) => k === "canvas-start")).toHaveLength(2)
    expect(kinds.filter((k) => k === "canvas-commit")).toHaveLength(2)
    const inner = blockCanvasTrace.frames.filter(
      (f) => f.kind === "denoise" && f.canvasIndex !== undefined
    )
    expect(inner.length).toBeGreaterThan(0)
    for (const frame of inner) {
      expect(frame.innerStep).toBeGreaterThan(0)
    }
  })

  it("block canvas trace has a mid-trace checkpoint for seek tests", () => {
    expect(blockCanvasTrace.checkpoints?.length).toBeGreaterThan(0)
  })

  it("final frame reconstruction matches final.text for all three", () => {
    expect(finalText(blockCanvasTrace)).toBe(blockCanvasTrace.final?.text)
    expect(finalText(confidenceCommitTrace)).toBe(
      confidenceCommitTrace.final?.text
    )
    expect(finalText(arBaselineTrace)).toBe(arBaselineTrace.final?.text)
  })

  it("ar baseline commits strictly left-to-right, one slot per frame", () => {
    const commits = arBaselineTrace.frames.flatMap((f) =>
      f.operations.filter((o) => o.type === "commit")
    )
    expect(commits.map((o) => o.slotId)).toEqual(["s1", "s2", "s3"])
  })

  it("confidence-commit gives s2 two distributions with rank churn", () => {
    const dists = confidenceCommitTrace.frames
      .flatMap((f) => f.operations)
      .filter((o) => o.type === "set-distribution" && o.slotId === "s2")
    expect(dists).toHaveLength(2)
    const rankOf = (d: (typeof dists)[number], text: string) =>
      d.type === "set-distribution"
        ? d.candidates.find((c) => c.text === text)?.rank
        : undefined
    expect(rankOf(dists[0], " Nice")).toBe(2)
    expect(rankOf(dists[1], " Nice")).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @dllm-viz/core exec vitest run src/testing/fixtures-phase2.test.ts`
Expected: FAIL — the three fixtures are not exported.

- [ ] **Step 3: Append the fixtures to `packages/core/src/testing/fixtures.ts`**

Append after `maskedRemaskTrace` (reuse the existing `slot()` and `sharedMeta` helpers):

```ts
/**
 * Outer-canvas / inner-step trace (spec §23 block-canvas.json, §13):
 * two canvases of length 3, each opened by canvas-start, denoised over
 * two inner steps, and sealed by canvas-commit. Checkpoint after the
 * first canvas commit.
 */
export const blockCanvasTrace: DiffusionTrace = {
  ...sharedMeta,
  traceId: "fixture-block-canvas",
  geometry: {
    timeDomain: "discrete",
    stateSpace: "token",
    generationMode: "canvas-diffusion",
  },
  generation: {
    algorithm: "illustrative-block",
    canvasCount: 2,
    canvasLength: 3,
    totalSteps: 2,
  },
  prompt: { text: "List two colors:", slotIds: ["s0"] },
  initial: {
    checkpointId: "cp-init",
    frameOrdinal: -1,
    slots: [
      slot("s0", 0, {
        state: "prompt",
        region: "prompt",
        text: "List two colors:",
      }),
      slot("s1", 1),
      slot("s2", 2),
      slot("s3", 3),
      slot("s4", 4),
      slot("s5", 5),
      slot("s6", 6),
    ],
  },
  frames: [
    { frameId: "f0", ordinal: 0, kind: "initial", operations: [] },
    {
      frameId: "f1",
      ordinal: 1,
      kind: "canvas-start",
      canvasIndex: 0,
      operations: [],
    },
    {
      frameId: "f2",
      ordinal: 2,
      kind: "denoise",
      canvasIndex: 0,
      innerStep: 1,
      operations: [
        { type: "commit", slotId: "s2", tokenId: 402, text: " red", confidence: 0.9 },
      ],
      metrics: { maskedCount: 5, committedThisFrame: 1 },
    },
    {
      frameId: "f3",
      ordinal: 3,
      kind: "denoise",
      canvasIndex: 0,
      innerStep: 2,
      operations: [
        { type: "commit", slotId: "s1", tokenId: 401, text: " One:", confidence: 0.85 },
        { type: "commit", slotId: "s3", tokenId: 403, text: ",", confidence: 0.96 },
      ],
      metrics: { maskedCount: 3, committedThisFrame: 2 },
    },
    {
      frameId: "f4",
      ordinal: 4,
      kind: "canvas-commit",
      canvasIndex: 0,
      operations: [
        { type: "set-token", slotId: "s1", state: "fixed" },
        { type: "set-token", slotId: "s2", state: "fixed" },
        { type: "set-token", slotId: "s3", state: "fixed" },
      ],
    },
    {
      frameId: "f5",
      ordinal: 5,
      kind: "canvas-start",
      canvasIndex: 1,
      operations: [],
    },
    {
      frameId: "f6",
      ordinal: 6,
      kind: "denoise",
      canvasIndex: 1,
      innerStep: 1,
      operations: [
        { type: "commit", slotId: "s6", tokenId: 406, text: ".", confidence: 0.98 },
      ],
      metrics: { maskedCount: 2, committedThisFrame: 1 },
    },
    {
      frameId: "f7",
      ordinal: 7,
      kind: "denoise",
      canvasIndex: 1,
      innerStep: 2,
      operations: [
        { type: "commit", slotId: "s4", tokenId: 404, text: " Two:", confidence: 0.88 },
        { type: "commit", slotId: "s5", tokenId: 405, text: " blue", confidence: 0.92 },
      ],
      metrics: { maskedCount: 0, committedThisFrame: 2 },
    },
    {
      frameId: "f8",
      ordinal: 8,
      kind: "canvas-commit",
      canvasIndex: 1,
      operations: [
        { type: "set-token", slotId: "s4", state: "fixed" },
        { type: "set-token", slotId: "s5", state: "fixed" },
        { type: "set-token", slotId: "s6", state: "fixed" },
      ],
    },
    { frameId: "f9", ordinal: 9, kind: "final", operations: [] },
  ],
  checkpoints: [
    {
      checkpointId: "cp-1",
      frameOrdinal: 4,
      slots: [
        slot("s0", 0, {
          state: "prompt",
          region: "prompt",
          text: "List two colors:",
        }),
        slot("s1", 1, { state: "fixed", tokenId: 401, text: " One:" }),
        slot("s2", 2, { state: "fixed", tokenId: 402, text: " red" }),
        slot("s3", 3, { state: "fixed", tokenId: 403, text: "," }),
        slot("s4", 4),
        slot("s5", 5),
        slot("s6", 6),
      ],
    },
  ],
  final: {
    text: "List two colors: One: red, Two: blue.",
    finishReason: "completed",
  },
}

/**
 * Confidence-ranked commits (spec §23 confidence-commit.json): each
 * denoise frame publishes candidate distributions and commits the most
 * confident remaining slot — deliberately not left-to-right. Slot s2
 * receives two successive distributions so churn is observable.
 */
export const confidenceCommitTrace: DiffusionTrace = {
  ...sharedMeta,
  traceId: "fixture-confidence-commit",
  generation: {
    algorithm: "illustrative-confidence",
    totalSteps: 3,
    confidenceType: "max-prob",
  },
  prompt: { text: "The capital of France", slotIds: ["s0"] },
  initial: {
    checkpointId: "cp-init",
    frameOrdinal: -1,
    slots: [
      slot("s0", 0, {
        state: "prompt",
        region: "prompt",
        text: "The capital of France",
      }),
      slot("s1", 1),
      slot("s2", 2),
      slot("s3", 3),
    ],
  },
  frames: [
    { frameId: "f0", ordinal: 0, kind: "initial", operations: [] },
    {
      frameId: "f1",
      ordinal: 1,
      kind: "denoise",
      step: 1,
      operations: [
        {
          type: "set-distribution",
          slotId: "s2",
          candidates: [
            { tokenId: 301, text: " Paris", probability: 0.55, rank: 0 },
            { tokenId: 302, text: " Lyon", probability: 0.2, rank: 1 },
            { tokenId: 303, text: " Nice", probability: 0.1, rank: 2 },
          ],
          entropy: 1.42,
          margin: 0.35,
          omittedMass: 0.15,
        },
        {
          type: "set-distribution",
          slotId: "s3",
          candidates: [
            { tokenId: 304, text: ".", probability: 0.97, rank: 0 },
            { tokenId: 305, text: "!", probability: 0.02, rank: 1 },
          ],
          entropy: 0.14,
          margin: 0.95,
          omittedMass: 0.01,
        },
        { type: "commit", slotId: "s3", tokenId: 304, text: ".", confidence: 0.97, selectionRank: 0 },
      ],
      metrics: { maskedCount: 2, committedThisFrame: 1, meanConfidence: 0.97 },
    },
    {
      frameId: "f2",
      ordinal: 2,
      kind: "denoise",
      step: 2,
      operations: [
        {
          type: "set-distribution",
          slotId: "s2",
          candidates: [
            { tokenId: 301, text: " Paris", probability: 0.82, rank: 0 },
            { tokenId: 303, text: " Nice", probability: 0.07, rank: 1 },
            { tokenId: 302, text: " Lyon", probability: 0.06, rank: 2 },
          ],
          entropy: 0.71,
          margin: 0.75,
          omittedMass: 0.05,
        },
        { type: "commit", slotId: "s2", tokenId: 301, text: " Paris", confidence: 0.82, selectionRank: 0 },
      ],
      metrics: { maskedCount: 1, committedThisFrame: 1, meanConfidence: 0.82 },
    },
    {
      frameId: "f3",
      ordinal: 3,
      kind: "denoise",
      step: 3,
      operations: [
        {
          type: "set-distribution",
          slotId: "s1",
          candidates: [
            { tokenId: 306, text: " is", probability: 0.74, rank: 0 },
            { tokenId: 307, text: " was", probability: 0.12, rank: 1 },
            { tokenId: 308, text: " remains", probability: 0.05, rank: 2 },
          ],
          entropy: 0.98,
          margin: 0.62,
          omittedMass: 0.09,
        },
        { type: "commit", slotId: "s1", tokenId: 306, text: " is", confidence: 0.74, selectionRank: 0 },
      ],
      metrics: { maskedCount: 0, committedThisFrame: 1, meanConfidence: 0.74 },
    },
    {
      frameId: "f4",
      ordinal: 4,
      kind: "final",
      operations: [
        { type: "set-token", slotId: "s1", state: "fixed" },
        { type: "set-token", slotId: "s2", state: "fixed" },
        { type: "set-token", slotId: "s3", state: "fixed" },
      ],
    },
  ],
  final: {
    text: "The capital of France is Paris.",
    finishReason: "completed",
  },
}

/**
 * Autoregressive baseline (spec §23 ar-baseline.json): same prompt and
 * final text as confidenceCommitTrace, committed strictly left-to-right
 * one token per frame — the schema has no AR generation mode, so this is
 * modeled as full-sequence with algorithm "autoregressive-baseline" and
 * an explanatory annotation.
 */
export const arBaselineTrace: DiffusionTrace = {
  ...sharedMeta,
  traceId: "fixture-ar-baseline",
  generation: { algorithm: "autoregressive-baseline", totalSteps: 3 },
  prompt: { text: "The capital of France", slotIds: ["s0"] },
  initial: {
    checkpointId: "cp-init",
    frameOrdinal: -1,
    slots: [
      slot("s0", 0, {
        state: "prompt",
        region: "prompt",
        text: "The capital of France",
      }),
      slot("s1", 1),
      slot("s2", 2),
      slot("s3", 3),
    ],
  },
  frames: [
    { frameId: "f0", ordinal: 0, kind: "initial", operations: [] },
    {
      frameId: "f1",
      ordinal: 1,
      kind: "denoise",
      step: 1,
      operations: [
        { type: "commit", slotId: "s1", tokenId: 306, text: " is", confidence: 0.91 },
      ],
      metrics: { maskedCount: 2, committedThisFrame: 1 },
    },
    {
      frameId: "f2",
      ordinal: 2,
      kind: "denoise",
      step: 2,
      operations: [
        { type: "commit", slotId: "s2", tokenId: 301, text: " Paris", confidence: 0.95 },
      ],
      metrics: { maskedCount: 1, committedThisFrame: 1 },
    },
    {
      frameId: "f3",
      ordinal: 3,
      kind: "denoise",
      step: 3,
      operations: [
        { type: "commit", slotId: "s3", tokenId: 304, text: ".", confidence: 0.99 },
      ],
      metrics: { maskedCount: 0, committedThisFrame: 1 },
    },
    {
      frameId: "f4",
      ordinal: 4,
      kind: "final",
      operations: [
        { type: "set-token", slotId: "s1", state: "fixed" },
        { type: "set-token", slotId: "s2", state: "fixed" },
        { type: "set-token", slotId: "s3", state: "fixed" },
      ],
    },
  ],
  final: {
    text: "The capital of France is Paris.",
    finishReason: "completed",
  },
  annotations: [
    {
      annotationId: "a0",
      kind: "note",
      text: "Autoregressive baseline for comparison demos; each frame commits the next left-to-right token.",
      provenance: "illustrative",
    },
  ],
}
```

- [ ] **Step 4: Run fixture tests to verify they pass**

Run: `pnpm --filter @dllm-viz/core exec vitest run src/testing/fixtures-phase2.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing generator tests** (`packages/core/src/testing/generate.test.ts`)

```ts
import { describe, expect, it } from "vitest"

import { parseTrace } from "../schema/validate"
import { generatePerformanceTrace } from "./generate"

describe("generatePerformanceTrace", () => {
  it("is deterministic for the same seed (no Math.random)", () => {
    const a = generatePerformanceTrace({ slotCount: 16, frameCount: 32 })
    const b = generatePerformanceTrace({ slotCount: 16, frameCount: 32 })
    expect(a).toEqual(b)
  })

  it("different seeds produce different operations", () => {
    const a = generatePerformanceTrace({ slotCount: 16, frameCount: 32, seed: 1 })
    const b = generatePerformanceTrace({ slotCount: 16, frameCount: 32, seed: 2 })
    expect(a.frames).not.toEqual(b.frames)
  })

  it("output passes schema validation", () => {
    const trace = generatePerformanceTrace({ slotCount: 32, frameCount: 64 })
    expect(() => parseTrace(trace)).not.toThrow()
    expect(trace.provenance.mode).toBe("illustrative")
  })

  it("defaults match the spec §21.6 benchmark shape", () => {
    const trace = generatePerformanceTrace()
    expect(trace.initial.slots).toHaveLength(256)
    expect(trace.frames).toHaveLength(512)
    expect(trace.frames[1].operations).toHaveLength(10)
    // checkpoints every 64 frames: ordinals 64, 128, …, 448
    expect(trace.checkpoints?.map((c) => c.frameOrdinal)).toEqual([
      64, 128, 192, 256, 320, 384, 448,
    ])
  })

  it("respects custom options", () => {
    const trace = generatePerformanceTrace({
      slotCount: 12,
      frameCount: 20,
      opsPerFrame: 3,
      checkpointInterval: 8,
      seed: 7,
    })
    expect(trace.initial.slots).toHaveLength(12)
    expect(trace.frames).toHaveLength(20)
    expect(trace.frames[5].operations).toHaveLength(3)
    expect(trace.checkpoints?.map((c) => c.frameOrdinal)).toEqual([8, 16])
  })
})
```

- [ ] **Step 6: Run to verify failure, then implement `generate.ts`**

Run: `pnpm --filter @dllm-viz/core exec vitest run src/testing/generate.test.ts` — expect FAIL (module does not exist).

`packages/core/src/testing/generate.ts`:

```ts
import { applyOperations } from "../player/apply"
import type {
  DiffusionFrame,
  DiffusionTrace,
  TokenSlot,
  TraceCheckpoint,
  TraceOperation,
} from "../schema/types"

export interface PerformanceTraceOptions {
  /** Total slots including the prompt prefix. Default 256 (spec §21.6). */
  slotCount?: number
  /** Total frames including the initial frame. Default 512. */
  frameCount?: number
  /** Operations per non-initial frame. Default 10. */
  opsPerFrame?: number
  /** A checkpoint is emitted every N frames. Default 64 (spec §9.13). */
  checkpointInterval?: number
  /** LCG seed. Same seed ⇒ byte-identical trace. Default 42. */
  seed?: number
}

/**
 * Deterministic linear congruential generator (numerical-recipes
 * constants). Used instead of Math.random so the dense performance
 * fixture never needs to be committed as JSON (spec §19.3) yet stays
 * reproducible across runs and machines.
 */
function createLcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * Generates the dense benchmark trace from spec §21.6 (256 slots ×
 * 512 frames × 10 ops/frame by default). Built at test/build time —
 * NEVER export or commit the resulting JSON.
 */
export function generatePerformanceTrace(
  options: PerformanceTraceOptions = {}
): DiffusionTrace {
  const {
    slotCount = 256,
    frameCount = 512,
    opsPerFrame = 10,
    checkpointInterval = 64,
    seed = 42,
  } = options
  const random = createLcg(seed)
  const pick = (n: number) => Math.floor(random() * n)

  const promptCount = Math.min(8, Math.max(1, slotCount - 1))
  const initialSlots: TokenSlot[] = Array.from(
    { length: slotCount },
    (_, i): TokenSlot =>
      i < promptCount
        ? {
            slotId: `s${i}`,
            index: i,
            state: "prompt",
            region: "prompt",
            text: `p${i} `,
          }
        : { slotId: `s${i}`, index: i, state: "masked", region: "completion" }
  )

  const frames: DiffusionFrame[] = [
    { frameId: "f0", ordinal: 0, kind: "initial", operations: [] },
  ]
  const checkpoints: TraceCheckpoint[] = []
  let slots = initialSlots

  for (let f = 1; f < frameCount; f++) {
    const operations: TraceOperation[] = []
    for (let o = 0; o < opsPerFrame; o++) {
      const target = slots[promptCount + pick(slotCount - promptCount)]
      const roll = random()
      if (roll < 0.5 || target.state === "masked") {
        operations.push({
          type: "commit",
          slotId: target.slotId,
          tokenId: 1000 + pick(5000),
          text: ` t${pick(100)}`,
          confidence: Math.round(random() * 100) / 100,
        })
      } else if (roll < 0.65) {
        operations.push({
          type: "renoise",
          slotId: target.slotId,
          previousTokenId: target.tokenId,
          score: Math.round(random() * 100) / 100,
        })
      } else if (roll < 0.8) {
        operations.push({
          type: "mask",
          slotId: target.slotId,
          previousTokenId: target.tokenId,
        })
      } else {
        operations.push({
          type: "set-distribution",
          slotId: target.slotId,
          candidates: [
            {
              tokenId: 1000 + pick(5000),
              text: ` c${pick(100)}`,
              probability: 0.5,
              rank: 0,
            },
            {
              tokenId: 1000 + pick(5000),
              text: ` c${pick(100)}`,
              probability: 0.3,
              rank: 1,
            },
          ],
          omittedMass: 0.2,
        })
      }
    }
    slots = applyOperations(slots, operations)
    frames.push({ frameId: `f${f}`, ordinal: f, kind: "denoise", step: f, operations })
    if (f % checkpointInterval === 0) {
      checkpoints.push({ checkpointId: `cp-${f}`, frameOrdinal: f, slots })
    }
  }

  return {
    schemaVersion: "0.1",
    traceId: `generated-perf-${slotCount}x${frameCount}-seed${seed}`,
    source: { adapter: "generated-performance-fixture" },
    geometry: {
      timeDomain: "discrete",
      stateSpace: "token",
      generationMode: "full-sequence",
    },
    generation: { algorithm: "generated-lcg", totalSteps: frameCount - 1, seed },
    provenance: {
      mode: "illustrative",
      notes: [
        "Deterministically generated dense benchmark trace (spec §21.6). Not real model output.",
      ],
    },
    initial: { checkpointId: "cp-init", frameOrdinal: -1, slots: initialSlots },
    frames,
    checkpoints,
  }
}
```

Note: `target.state` is read from the frame-start snapshot, so a slot touched twice in one frame may see a stale state — every branch still emits a schema-valid operation (`mask` on a masked slot and `renoise` on a masked slot are both legal for `applyOperations`), which is all the benchmark needs. Checkpoint `slots` arrays are safe to share because `applyOperations` never mutates its input.

- [ ] **Step 7: Run generator tests**

Run: `pnpm --filter @dllm-viz/core exec vitest run src/testing/generate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Export fixtures as JSON and from the package index**

Append to `packages/core/src/index.ts`:

```ts
export * from "./testing/generate"
```

In `packages/core/scripts/export-fixtures.mjs`, replace the import and `fixtures` array with:

```js
import {
  arBaselineTrace,
  blockCanvasTrace,
  confidenceCommitTrace,
  maskedBasicTrace,
  maskedRemaskTrace,
} from "../src/testing/fixtures.ts"
```

```js
// The dense performance fixture is intentionally NOT exported: it is
// generated on demand by generatePerformanceTrace (spec §19.3 — bundled
// examples stay under 1 MB; only the generator is committed).
const fixtures = [
  ["masked-basic.json", maskedBasicTrace],
  ["masked-remask.json", maskedRemaskTrace],
  ["block-canvas.json", blockCanvasTrace],
  ["confidence-commit.json", confidenceCommitTrace],
  ["ar-baseline.json", arBaselineTrace],
]
```

Run: `pnpm --filter @dllm-viz/core run fixtures`
Expected: 10 JSON files written (5 fixtures × 2 targets).

- [ ] **Step 9: Full verification and commit**

Run: `pnpm registry:build && pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS (registry lib regenerates with `testing/generate.ts` included).

```bash
git add -A
git commit -m "feat(core): block-canvas, confidence-commit, ar-baseline fixtures and seeded dense-trace generator

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Core commit-matrix statistics (`buildCommitMatrix`)

**Files:**
- Create: `packages/core/src/stats/commit-matrix.ts`, `packages/core/src/stats/commit-matrix.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `applyOperations`, `materializeSlots`, `DiffusionTrace`, `TokenState`, fixtures.
- Produces (exported from `@dllm-viz/core`):
  - `TOKEN_STATE_CODES: Record<TokenState, number>` (prompt 0 … unknown 7) and `tokenStateFromCode(code: number): TokenState | undefined`
  - `MATRIX_ABSENT = 255` — cell code for a slot that does not exist at that frame (pre-insert / post-delete)
  - `buildCommitMatrix(trace: DiffusionTrace, options?: CommitMatrixOptions): CommitMatrix` — one incremental `applyOperations` pass over the frame window (never `materializeSlots` per column). `CommitMatrixOptions = { startFrame?: number; endFrame?: number }` (inclusive, defaults full trace); a windowed build seeds its start state via `materializeSlots(trace, startFrame - 1)`, which reuses the nearest checkpoint (spec §9.13) instead of replaying from frame zero.
  - `CommitMatrix = { slotIds: readonly string[]; startFrame: number; frameCount: number; states: Uint8Array; confidences: Float32Array }` — row-major `slotRow * frameCount + (frameIndex - startFrame)`; column at `frameIndex` is the state AFTER applying `frames[0..frameIndex]` (matches player snapshots). Rows: slots present at the window start in array order, then later-inserted slots in first-appearance order. `confidences` holds the last confidence from a `commit`/`set-token` op, `NaN` when unknown; a `mask` resets it (a `renoise` keeps it, since the token text also stays visible).
  - `getMatrixCell(matrix: CommitMatrix, slotRow: number, frameIndex: number): CommitMatrixCell` — `CommitMatrixCell = { slotId: string; frameIndex: number; state?: TokenState; confidence?: number }` (`state` undefined for absent cells, `confidence` undefined for NaN); throws `RangeError` out of range.
  - `describeMatrixCell(cell: CommitMatrixCell): string` — e.g. `"Slot s3, frame 6: committed, confidence 0.88"` / `"Slot s1, frame 1: not present"` — the accessible exact-value readout used by `CommitHeatmap` (spec §15.4 hover/focus MUST reveal exact values).

- [ ] **Step 1: Write the failing tests** (`packages/core/src/stats/commit-matrix.test.ts`)

```ts
import { describe, expect, it } from "vitest"

import type { DiffusionTrace } from "../schema/types"
import { maskedBasicTrace, maskedRemaskTrace } from "../testing/fixtures"
import { generatePerformanceTrace } from "../testing/generate"
import {
  MATRIX_ABSENT,
  TOKEN_STATE_CODES,
  buildCommitMatrix,
  describeMatrixCell,
  getMatrixCell,
} from "./commit-matrix"

const codeAt = (
  m: ReturnType<typeof buildCommitMatrix>,
  row: number,
  frame: number
) => m.states[row * m.frameCount + (frame - m.startFrame)]

describe("buildCommitMatrix", () => {
  it("has one row per slot in initial order and one column per frame", () => {
    const m = buildCommitMatrix(maskedRemaskTrace)
    expect(m.slotIds).toEqual(["s0", "s1", "s2", "s3", "s4", "s5"])
    expect(m.startFrame).toBe(0)
    expect(m.frameCount).toBe(7)
    expect(m.states).toHaveLength(6 * 7)
  })

  it("records the full remask timeline for slot s3", () => {
    const m = buildCommitMatrix(maskedRemaskTrace)
    const timeline = Array.from({ length: 7 }, (_, f) => codeAt(m, 3, f))
    expect(timeline).toEqual([
      TOKEN_STATE_CODES.masked,
      TOKEN_STATE_CODES.masked,
      TOKEN_STATE_CODES.committed,
      TOKEN_STATE_CODES.renoised,
      TOKEN_STATE_CODES.masked,
      TOKEN_STATE_CODES.committed,
      TOKEN_STATE_CODES.fixed,
    ])
  })

  it("tracks confidence and resets it at mask boundaries", () => {
    const m = buildCommitMatrix(maskedRemaskTrace)
    expect(getMatrixCell(m, 3, 2).confidence).toBe(0.46)
    expect(getMatrixCell(m, 3, 3).confidence).toBe(0.46) // renoise keeps it
    expect(getMatrixCell(m, 3, 4).confidence).toBeUndefined() // mask clears
    expect(getMatrixCell(m, 3, 5).confidence).toBe(0.88)
    expect(getMatrixCell(m, 3, 6).confidence).toBe(0.88) // fixed keeps it
  })

  it("a windowed build equals the matching slice of the full build", () => {
    const full = buildCommitMatrix(maskedBasicTrace)
    const windowed = buildCommitMatrix(maskedBasicTrace, {
      startFrame: 2,
      endFrame: 3,
    })
    expect(windowed.slotIds).toEqual(full.slotIds)
    expect(windowed.startFrame).toBe(2)
    expect(windowed.frameCount).toBe(2)
    for (let row = 0; row < full.slotIds.length; row++) {
      for (let frame = 2; frame <= 3; frame++) {
        expect(getMatrixCell(windowed, row, frame)).toEqual(
          getMatrixCell(full, row, frame)
        )
      }
    }
  })

  it("windowed builds seed from the nearest checkpoint (spec §9.13)", () => {
    // Same poisoning trick as the materialize tests: frame f1 (ordinal 1,
    // covered by checkpoint cp-1) references a slot that never existed.
    // A window starting after the checkpoint must skip f1 entirely.
    const poisoned: DiffusionTrace = {
      ...maskedBasicTrace,
      frames: maskedBasicTrace.frames.map((frame) =>
        frame.frameId === "f1"
          ? { ...frame, operations: [{ type: "mask", slotId: "ghost" }] }
          : frame
      ),
    }
    expect(() =>
      buildCommitMatrix(poisoned, { startFrame: 2 })
    ).not.toThrow()
    expect(() => buildCommitMatrix(poisoned)).toThrow(/ghost/)
  })

  it("marks cells absent before insertion and after deletion", () => {
    const resizeTrace: DiffusionTrace = {
      schemaVersion: "0.1",
      traceId: "t-resize",
      source: { adapter: "hand-authored" },
      geometry: {
        timeDomain: "discrete",
        stateSpace: "token",
        generationMode: "variable-length",
      },
      generation: {},
      provenance: { mode: "illustrative" },
      initial: {
        checkpointId: "cp",
        frameOrdinal: -1,
        slots: [
          { slotId: "s0", index: 0, state: "masked", region: "completion" },
        ],
      },
      frames: [
        { frameId: "f0", ordinal: 0, kind: "initial", operations: [] },
        {
          frameId: "f1",
          ordinal: 1,
          kind: "resize",
          operations: [
            {
              type: "insert-slots",
              afterSlotId: "s0",
              slots: [{ slotId: "s1", index: 1, state: "masked" }],
            },
          ],
        },
        {
          frameId: "f2",
          ordinal: 2,
          kind: "resize",
          operations: [{ type: "delete-slots", slotIds: ["s0"] }],
        },
      ],
    }
    const m = buildCommitMatrix(resizeTrace)
    expect(m.slotIds).toEqual(["s0", "s1"])
    expect(codeAt(m, 1, 0)).toBe(MATRIX_ABSENT) // s1 before insertion
    expect(codeAt(m, 1, 1)).toBe(TOKEN_STATE_CODES.masked)
    expect(codeAt(m, 0, 2)).toBe(MATRIX_ABSENT) // s0 after deletion
    expect(getMatrixCell(m, 0, 2).state).toBeUndefined()
  })

  it("getMatrixCell throws RangeError out of range", () => {
    const m = buildCommitMatrix(maskedRemaskTrace)
    expect(() => getMatrixCell(m, 99, 0)).toThrow(RangeError)
    expect(() => getMatrixCell(m, 0, 99)).toThrow(RangeError)
    const windowed = buildCommitMatrix(maskedRemaskTrace, { startFrame: 2 })
    expect(() => getMatrixCell(windowed, 0, 1)).toThrow(RangeError)
  })

  it("describeMatrixCell renders the exact-value readout", () => {
    const m = buildCommitMatrix(maskedRemaskTrace)
    expect(describeMatrixCell(getMatrixCell(m, 3, 5))).toBe(
      "Slot s3, frame 6: committed, confidence 0.88"
    )
    expect(describeMatrixCell(getMatrixCell(m, 3, 0))).toBe(
      "Slot s3, frame 1: masked"
    )
  })

  it("handles the dense generated trace", () => {
    const trace = generatePerformanceTrace({ slotCount: 64, frameCount: 64 })
    const m = buildCommitMatrix(trace)
    expect(m.states).toHaveLength(64 * 64)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @dllm-viz/core exec vitest run src/stats/commit-matrix.test.ts`
Expected: FAIL — `commit-matrix.ts` does not exist.

- [ ] **Step 3: Implement `commit-matrix.ts`**

```ts
import { applyOperations } from "../player/apply"
import { materializeSlots } from "../player/materialize"
import type { DiffusionTrace, TokenState } from "../schema/types"

export const TOKEN_STATE_CODES = {
  prompt: 0,
  masked: 1,
  proposed: 2,
  committed: 3,
  fixed: 4,
  renoised: 5,
  padding: 6,
  unknown: 7,
} as const satisfies Record<TokenState, number>

const STATES_BY_CODE: readonly TokenState[] = [
  "prompt",
  "masked",
  "proposed",
  "committed",
  "fixed",
  "renoised",
  "padding",
  "unknown",
]

export function tokenStateFromCode(code: number): TokenState | undefined {
  return STATES_BY_CODE[code]
}

/** Cell code for a slot that does not exist at that frame. */
export const MATRIX_ABSENT = 255

export interface CommitMatrixOptions {
  /** First column (inclusive). Seeded via checkpoint-based materialization. */
  startFrame?: number
  /** Last column (inclusive). Defaults to the last frame. */
  endFrame?: number
}

export interface CommitMatrix {
  /**
   * Row order: slots present at the window start (array order), then
   * later-inserted slots in first-appearance order.
   */
  slotIds: readonly string[]
  startFrame: number
  frameCount: number
  /**
   * Row-major slotRow * frameCount + (frameIndex - startFrame). Values
   * are TOKEN_STATE_CODES or MATRIX_ABSENT.
   */
  states: Uint8Array
  /** Last known confidence per cell; NaN when unknown. Reset by mask. */
  confidences: Float32Array
}

export interface CommitMatrixCell {
  slotId: string
  frameIndex: number
  state?: TokenState
  confidence?: number
}

/**
 * Builds position × frame state/confidence data for CommitHeatmap in a
 * single incremental delta pass (spec §15.4, §19.2). Windowed builds
 * seed their start state from the nearest checkpoint via
 * materializeSlots instead of replaying from frame zero (spec §9.13).
 */
export function buildCommitMatrix(
  trace: DiffusionTrace,
  options: CommitMatrixOptions = {}
): CommitMatrix {
  const lastIndex = trace.frames.length - 1
  const startFrame = options.startFrame ?? 0
  const endFrame = options.endFrame ?? lastIndex
  if (startFrame < 0 || endFrame > lastIndex || startFrame > endFrame) {
    throw new RangeError(
      `buildCommitMatrix: window [${startFrame}, ${endFrame}] out of range [0, ${lastIndex}]`
    )
  }

  // Checkpoint reuse: state before the first window column.
  let slots = materializeSlots(trace, startFrame - 1)

  // Pre-scan rows: slots present at the window start, then insertions.
  const slotIds = slots.map((s) => s.slotId)
  const rowOf = new Map(slotIds.map((id, row) => [id, row]))
  for (let f = startFrame; f <= endFrame; f++) {
    for (const op of trace.frames[f].operations) {
      if (op.type === "insert-slots") {
        for (const inserted of op.slots) {
          if (!rowOf.has(inserted.slotId)) {
            rowOf.set(inserted.slotId, slotIds.length)
            slotIds.push(inserted.slotId)
          }
        }
      }
    }
  }

  const frameCount = endFrame - startFrame + 1
  const states = new Uint8Array(slotIds.length * frameCount).fill(MATRIX_ABSENT)
  const confidences = new Float32Array(slotIds.length * frameCount).fill(
    Number.NaN
  )
  const lastConfidence = new Map<string, number>()

  for (let f = startFrame; f <= endFrame; f++) {
    const frame = trace.frames[f]
    if (frame.operations.length > 0) {
      slots = applyOperations([...slots], frame.operations)
    }
    for (const op of frame.operations) {
      if (op.type === "commit" || op.type === "set-token") {
        if (op.confidence !== undefined) {
          lastConfidence.set(op.slotId, op.confidence)
        }
      } else if (op.type === "mask") {
        lastConfidence.delete(op.slotId)
      } else if (op.type === "delete-slots") {
        for (const id of op.slotIds) {
          lastConfidence.delete(id)
        }
      }
    }
    const column = f - startFrame
    for (const slot of slots) {
      const row = rowOf.get(slot.slotId)
      if (row === undefined) continue
      const cell = row * frameCount + column
      states[cell] = TOKEN_STATE_CODES[slot.state]
      const confidence = lastConfidence.get(slot.slotId)
      if (confidence !== undefined) confidences[cell] = confidence
    }
  }

  return { slotIds, startFrame, frameCount, states, confidences }
}

export function getMatrixCell(
  matrix: CommitMatrix,
  slotRow: number,
  frameIndex: number
): CommitMatrixCell {
  const column = frameIndex - matrix.startFrame
  if (slotRow < 0 || slotRow >= matrix.slotIds.length) {
    throw new RangeError(`getMatrixCell: row ${slotRow} out of range`)
  }
  if (column < 0 || column >= matrix.frameCount) {
    throw new RangeError(`getMatrixCell: frame ${frameIndex} out of range`)
  }
  const cell = slotRow * matrix.frameCount + column
  const code = matrix.states[cell]
  const confidence = matrix.confidences[cell]
  return {
    slotId: matrix.slotIds[slotRow],
    frameIndex,
    state: code === MATRIX_ABSENT ? undefined : tokenStateFromCode(code),
    // Float32Array cannot represent e.g. 0.46 exactly; round back to the
    // 4-decimal source precision so cells compare equal to trace values.
    confidence: Number.isNaN(confidence)
      ? undefined
      : Number(confidence.toFixed(4)),
  }
}

/** Exact-value readout for hover/keyboard focus (spec §15.4, §18). */
export function describeMatrixCell(cell: CommitMatrixCell): string {
  const state = cell.state ?? "not present"
  const confidence =
    cell.confidence !== undefined
      ? `, confidence ${cell.confidence.toFixed(2)}`
      : ""
  return `Slot ${cell.slotId}, frame ${cell.frameIndex + 1}: ${state}${confidence}`
}
```

Note: `applyOperations([...slots], …)` copies because `materializeSlots(trace, -1)` returns `trace.initial.slots` by reference — `applyOperations` never mutates its input, but the defensive copy keeps the shared initial/checkpoint arrays clearly untouched. The `toFixed(4)` round-trip in `getMatrixCell` is load-bearing: `Float32Array` cannot store 0.46/0.88 exactly, and the tests compare against the original trace values.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @dllm-viz/core exec vitest run src/stats/commit-matrix.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Export, verify, commit**

Append to `packages/core/src/index.ts`:

```ts
export * from "./stats/commit-matrix"
```

Run: `pnpm registry:build && pnpm lint && pnpm typecheck && pnpm test` — expect PASS.

```bash
git add -A
git commit -m "feat(core): commit-matrix statistics with checkpoint-seeded windows

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Synchronized selection — `DiffusionSelectionProvider` + `useSlotSelection`

**Files:**
- Create: `packages/react/src/selection.tsx`, `packages/react/src/selection.test.tsx`, `apps/web/src/components/synchronized-selection.test.tsx`
- Modify: `packages/react/src/index.ts`, `registry/default/denoising-token-canvas/denoising-token-canvas.tsx`, `registry/default/trace-inspector/trace-inspector.tsx`, `apps/web/src/routes/denoising-token-canvas-demo.tsx`

**Interfaces:**
- Consumes: react context/state only. No `@dllm-viz/core` dependency — shared selection is UI state and does NOT belong in core.
- Produces (exported from `@dllm-viz/react`):
  - `DiffusionSelectionProvider(props: { defaultSelectedSlotId?: string | null; children: ReactNode })` — headless, renders no DOM.
  - `useSlotSelection(): SlotSelection` where `SlotSelection = { selectedSlotId: string | null; setSelectedSlotId: (slotId: string | null) => void }` — throws outside the provider (same convention as `useDiffusionPlayer`).
  - `useOptionalSlotSelection(): SlotSelection | null` — returns `null` outside the provider, so registry components stay usable standalone.
- Prop/context precedence rule for components: an explicitly passed `selectedSlotId` prop (including an explicit `null`) wins over context; an omitted prop (`undefined`) falls back to context.

- [ ] **Step 1: Write the failing hook tests** (`packages/react/src/selection.test.tsx`)

```tsx
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import {
  DiffusionSelectionProvider,
  useOptionalSlotSelection,
  useSlotSelection,
} from "./selection"

const wrapper = ({ children }: { children: ReactNode }) => (
  <DiffusionSelectionProvider>{children}</DiffusionSelectionProvider>
)

describe("DiffusionSelectionProvider", () => {
  it("useSlotSelection throws outside the provider", () => {
    expect(() => renderHook(() => useSlotSelection())).toThrow(
      /DiffusionSelectionProvider/
    )
  })

  it("useOptionalSlotSelection returns null outside the provider", () => {
    const { result } = renderHook(() => useOptionalSlotSelection())
    expect(result.current).toBeNull()
  })

  it("shares selection between consumers", () => {
    const { result } = renderHook(
      () => ({ a: useSlotSelection(), b: useSlotSelection() }),
      { wrapper }
    )
    expect(result.current.a.selectedSlotId).toBeNull()
    act(() => result.current.a.setSelectedSlotId("s3"))
    expect(result.current.b.selectedSlotId).toBe("s3")
    act(() => result.current.b.setSelectedSlotId(null))
    expect(result.current.a.selectedSlotId).toBeNull()
  })

  it("honors defaultSelectedSlotId", () => {
    const { result } = renderHook(() => useSlotSelection(), {
      wrapper: ({ children }) => (
        <DiffusionSelectionProvider defaultSelectedSlotId="s1">
          {children}
        </DiffusionSelectionProvider>
      ),
    })
    expect(result.current.selectedSlotId).toBe("s1")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @dllm-viz/react exec vitest run src/selection.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `selection.tsx`**

```tsx
import type { ReactNode } from "react"
import { createContext, useContext, useMemo, useState } from "react"

export interface SlotSelection {
  selectedSlotId: string | null
  setSelectedSlotId: (slotId: string | null) => void
}

const SelectionContext = createContext<SlotSelection | null>(null)

export interface DiffusionSelectionProviderProps {
  defaultSelectedSlotId?: string | null
  children: ReactNode
}

/**
 * Shares a selected token slot between canvas, inspector, heatmap, and
 * distribution components without prop drilling (spec §24 Phase 2
 * "synchronized selection"). Headless: renders no DOM.
 */
export function DiffusionSelectionProvider({
  defaultSelectedSlotId = null,
  children,
}: DiffusionSelectionProviderProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(
    defaultSelectedSlotId
  )
  const value = useMemo(
    () => ({ selectedSlotId, setSelectedSlotId }),
    [selectedSlotId]
  )
  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSlotSelection(): SlotSelection {
  const selection = useContext(SelectionContext)
  if (selection === null) {
    throw new Error(
      "useSlotSelection must be used within a DiffusionSelectionProvider"
    )
  }
  return selection
}

/** Context if present, null otherwise — for components that also accept props. */
export function useOptionalSlotSelection(): SlotSelection | null {
  return useContext(SelectionContext)
}
```

Append to `packages/react/src/index.ts`:

```ts
export * from "./selection"
```

Run: `pnpm --filter @dllm-viz/react exec vitest run src/selection.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 4: Write the failing cross-component test** (`apps/web/src/components/synchronized-selection.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

describe("synchronized selection", () => {
  it("clicking a canvas slot updates the inspector through context", async () => {
    render(
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider initialFrame={5} trace={maskedRemaskTrace}>
          <DenoisingTokenCanvas />
          <TraceInspector />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )
    expect(screen.getByText(/select a token slot/i)).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /blue.*committed/i }))
    expect(screen.getByText("s3")).toBeInTheDocument()
    expect(screen.getByText("232")).toBeInTheDocument()
  })

  it("an explicit selectedSlotId prop overrides context", () => {
    render(
      <DiffusionSelectionProvider defaultSelectedSlotId="s3">
        <DiffusionTraceProvider initialFrame={5} trace={maskedRemaskTrace}>
          <TraceInspector selectedSlotId={null} />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )
    expect(screen.getByText(/select a token slot/i)).toBeInTheDocument()
  })
})
```

Run: `pnpm --filter web exec vitest run src/components/synchronized-selection.test.tsx`
Expected: FAIL — components ignore the selection context.

- [ ] **Step 5: Wire the context into the two existing registry components**

`registry/default/denoising-token-canvas/denoising-token-canvas.tsx` — three edits:

1. Add `useOptionalSlotSelection` to the `@/lib/dllm-viz-react` import block:

```tsx
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useOptionalSlotSelection,
  useReducedMotion,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
```

2. Replace the destructured default `selectedSlotId = null,` with `selectedSlotId,` and insert the resolution logic after the existing hook calls (after `const reducedMotion = useReducedMotion()`):

```tsx
  const selection = useOptionalSlotSelection()
  // Explicit prop (including null) wins; undefined falls back to context.
  const activeSelectedId =
    selectedSlotId !== undefined
      ? selectedSlotId
      : (selection?.selectedSlotId ?? null)
  const handleSelect = (slotId: string) => {
    selection?.setSelectedSlotId(slotId)
    onSlotSelect?.(slotId)
  }
```

3. In the slot `<button>`, replace both `slot.slotId === selectedSlotId` occurrences with `slot.slotId === activeSelectedId` and replace `onClick={() => onSlotSelect?.(slot.slotId)}` with `onClick={() => handleSelect(slot.slotId)}`.

`registry/default/trace-inspector/trace-inspector.tsx` — two edits:

1. Add `useOptionalSlotSelection` to the `@/lib/dllm-viz-react` import block (alphabetical position after `useDiffusionSnapshot`).
2. Replace the function head and slot lookup:

```tsx
export function TraceInspector({
  selectedSlotId,
  className,
}: TraceInspectorProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const selection = useOptionalSlotSelection()
  // Explicit prop (including null) wins; undefined falls back to context.
  const activeSelectedId =
    selectedSlotId !== undefined
      ? selectedSlotId
      : (selection?.selectedSlotId ?? null)
  const slot = snapshot.slots.find((s) => s.slotId === activeSelectedId)
```

(The rest of the component already uses `slot.slotId`, so no further changes.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/components`
Expected: PASS — the 2 new tests plus all existing component tests (they pass explicit props, which still win).

- [ ] **Step 7: Use the provider in the existing demo route**

Replace the body of `apps/web/src/routes/denoising-token-canvas-demo.tsx` (drop `useState` and the props):

```tsx
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

export function DenoisingTokenCanvasDemo() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">DenoisingTokenCanvas</h1>
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider trace={maskedRemaskTrace}>
          <DenoisingTokenCanvas />
          <DiffusionStepControls />
          <TraceInspector />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    </div>
  )
}
```

- [ ] **Step 8: Verify workspace, rebuild registry lib, commit**

Run: `pnpm registry:build && pnpm lint && pnpm typecheck && pnpm test` — expect PASS.

```bash
git add -A
git commit -m "feat(react): DiffusionSelectionProvider and synchronized slot selection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `CommitHeatmap` — matrix wiring and DOM mode with exact-value cells

**Files:**
- Create: `registry/default/commit-heatmap/commit-heatmap.tsx`, `apps/web/src/components/commit-heatmap.test.tsx`

**Interfaces:**
- Consumes: `buildCommitMatrix`, `getMatrixCell`, `describeMatrixCell`, `MATRIX_ABSENT`, `TOKEN_STATE_CODES` via `@/lib/dllm-viz-core`; `useDiffusionPlayer`, `useDiffusionSnapshot`, `useOptionalSlotSelection`, `useTraceProvenance` via `@/lib/dllm-viz-react`; `cn`.
- Produces:
  - `CommitHeatmap(props: CommitHeatmapProps)` where `CommitHeatmapProps = { metric?: "state" | "confidence"; domCellLimit?: number; cellSize?: number; onSlotSelect?: (slotId: string) => void; className?: string }` — must be rendered inside `DiffusionTraceProvider`; selection context optional.
  - Exported pure helpers (unit-testable, shared by both modes): `STATE_GLYPHS: Record<TokenState, string>`, `heatmapCellColor(stateCode, confidence, metric): string`.
  - Mode rule (spec §15.4/§19.2): `slotCount × frameCount <= domCellLimit` (default 2000) renders a `<table>` of semantic cell buttons; above it renders Canvas (Task 5 — this task ships a marked placeholder for that branch).
  - DOM cells encode state by background color **and** glyph **and** `aria-label` exact value (no color-only encoding, spec §18); the current player frame column is the linked cursor (`aria-current="time"` + border); clicking a cell seeks the player and selects the slot; hover and keyboard focus write the exact value into a persistent readout line (`data-slot="heatmap-readout"`).

- [ ] **Step 1: Write the failing component tests** (`apps/web/src/components/commit-heatmap.test.tsx`)

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
  useDiffusionSnapshot,
  useSlotSelection,
} from "@/lib/dllm-viz-react"
import { CommitHeatmap } from "@/registry/default/commit-heatmap/commit-heatmap"

function Probe() {
  const { selectedSlotId } = useSlotSelection()
  const snapshot = useDiffusionSnapshot()
  return <output>{`${selectedSlotId ?? "none"}:${snapshot.frameIndex}`}</output>
}

const renderAt = (
  frame: number,
  props: Parameters<typeof CommitHeatmap>[0] = {}
) =>
  render(
    <DiffusionSelectionProvider>
      <DiffusionTraceProvider initialFrame={frame} trace={maskedRemaskTrace}>
        <CommitHeatmap {...props} />
        <Probe />
      </DiffusionTraceProvider>
    </DiffusionSelectionProvider>
  )

describe("CommitHeatmap (DOM mode)", () => {
  it("renders one cell per slot × frame below the threshold", () => {
    const { container } = renderAt(0)
    expect(container.querySelector('[data-mode="dom"]')).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "Commit heatmap" })
    expect(within(table).getAllByRole("button")).toHaveLength(6 * 7)
  })

  it("exposes exact values on every cell (spec §15.4)", () => {
    renderAt(0)
    expect(
      screen.getByRole("button", {
        name: "Slot s3, frame 6: committed, confidence 0.88",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "Slot s3, frame 4: renoised, confidence 0.46",
      })
    ).toBeInTheDocument()
  })

  it("does not rely on color alone: cells carry state glyphs (spec §18)", () => {
    renderAt(0)
    const cell = screen.getByRole("button", {
      name: "Slot s3, frame 4: renoised, confidence 0.46",
    })
    expect(cell).toHaveAttribute("data-state", "renoised")
    expect(cell).toHaveTextContent("↺")
  })

  it("marks the current frame column as the linked cursor", () => {
    const { container } = renderAt(3)
    expect(container.querySelectorAll('[aria-current="time"]')).toHaveLength(6)
  })

  it("keyboard focus reveals the exact value in the readout", () => {
    const { container } = renderAt(0)
    fireEvent.focus(
      screen.getByRole("button", {
        name: "Slot s3, frame 6: committed, confidence 0.88",
      })
    )
    expect(
      container.querySelector('[data-slot="heatmap-readout"]')
    ).toHaveTextContent("Slot s3, frame 6: committed, confidence 0.88")
  })

  it("hover reveals the exact value in the readout", () => {
    const { container } = renderAt(0)
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Slot s3, frame 1: masked" })
    )
    expect(
      container.querySelector('[data-slot="heatmap-readout"]')
    ).toHaveTextContent("Slot s3, frame 1: masked")
  })

  it("clicking a cell seeks the player and selects the slot", async () => {
    const onSlotSelect = vi.fn()
    renderAt(0, { onSlotSelect })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: "Slot s3, frame 6: committed, confidence 0.88",
      })
    )
    expect(screen.getByRole("status")).toHaveTextContent("s3:5")
    expect(onSlotSelect).toHaveBeenCalledWith("s3")
  })

  it("shows the illustrative provenance badge", () => {
    renderAt(0)
    expect(screen.getByText("illustrative")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/commit-heatmap.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component** (`registry/default/commit-heatmap/commit-heatmap.tsx`)

```tsx
import type {
  CommitMatrix,
  CommitMatrixCell,
  TokenState,
} from "@/lib/dllm-viz-core"
import {
  MATRIX_ABSENT,
  TOKEN_STATE_CODES,
  buildCommitMatrix,
  describeMatrixCell,
  getMatrixCell,
} from "@/lib/dllm-viz-core"
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useOptionalSlotSelection,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"

export interface CommitHeatmapProps {
  /** Cell coloring: token state, or committed-confidence intensity. */
  metric?: "state" | "confidence"
  /**
   * Cell-count threshold: at or below renders DOM (a table of semantic
   * buttons), above renders Canvas (spec §15.4, §19.2 — never DOM for
   * tens of thousands of cells).
   */
  domCellLimit?: number
  /** Canvas-mode cell size in CSS px. */
  cellSize?: number
  onSlotSelect?: (slotId: string) => void
  className?: string
}

/** Per-state glyphs so the heatmap never encodes state by color alone. */
export const STATE_GLYPHS: Record<TokenState, string> = {
  prompt: "▁",
  masked: "░",
  proposed: "?",
  committed: "●",
  fixed: "◆",
  renoised: "↺",
  padding: "·",
  unknown: "▒",
}

const STATE_COLORS: Record<number, string> = {
  [TOKEN_STATE_CODES.prompt]: "#e4e4e7",
  [TOKEN_STATE_CODES.masked]: "#a1a1aa",
  [TOKEN_STATE_CODES.proposed]: "#f59e0b",
  [TOKEN_STATE_CODES.committed]: "#10b981",
  [TOKEN_STATE_CODES.fixed]: "#047857",
  [TOKEN_STATE_CODES.renoised]: "#ef4444",
  [TOKEN_STATE_CODES.padding]: "#f4f4f5",
  [TOKEN_STATE_CODES.unknown]: "#d4d4d8",
}

/** Pure cell→color mapping shared by DOM and Canvas modes (unit-tested). */
export function heatmapCellColor(
  stateCode: number,
  confidence: number,
  metric: "state" | "confidence"
): string {
  if (stateCode === MATRIX_ABSENT) return "transparent"
  if (metric === "confidence") {
    if (Number.isNaN(confidence)) {
      return stateCode === TOKEN_STATE_CODES.masked ? "#a1a1aa" : "#e4e4e7"
    }
    const clamped = Math.min(Math.max(confidence, 0), 1)
    const alpha = Math.round((0.15 + 0.85 * clamped) * 255)
      .toString(16)
      .padStart(2, "0")
    return `#10b981${alpha}`
  }
  return STATE_COLORS[stateCode] ?? "#d4d4d8"
}

export function CommitHeatmap({
  metric = "state",
  domCellLimit = 2000,
  cellSize = 4,
  onSlotSelect,
  className,
}: CommitHeatmapProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const selection = useOptionalSlotSelection()
  // player.trace identity changes on appendFrame, so live traces rebuild.
  const matrix = useMemo(() => buildCommitMatrix(player.trace), [player.trace])
  const [readoutCell, setReadoutCell] = useState<CommitMatrixCell | null>(null)

  const selectedRow =
    selection?.selectedSlotId != null
      ? matrix.slotIds.indexOf(selection.selectedSlotId)
      : -1
  const reveal = (row: number, frame: number) =>
    setReadoutCell(getMatrixCell(matrix, row, frame))
  const activate = (row: number, frame: number) => {
    const cell = getMatrixCell(matrix, row, frame)
    player.seek(frame)
    selection?.setSelectedSlotId(cell.slotId)
    onSlotSelect?.(cell.slotId)
    setReadoutCell(cell)
  }

  const cellCount = matrix.slotIds.length * matrix.frameCount
  const mode = cellCount > domCellLimit ? "canvas" : "dom"

  return (
    <div className={cn("flex flex-col gap-2", className)} data-mode={mode}>
      {provenance.mode !== "measured" && (
        <span
          className="self-start rounded border border-dashed px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
          title={provenance.notes?.join(" ")}
        >
          {provenance.mode}
        </span>
      )}
      {mode === "dom" ? (
        <DomModeView
          activate={activate}
          frameIndex={snapshot.frameIndex}
          matrix={matrix}
          metric={metric}
          reveal={reveal}
          selectedRow={selectedRow}
        />
      ) : (
        <CanvasModeView
          activate={activate}
          cellSize={cellSize}
          frameIndex={snapshot.frameIndex}
          matrix={matrix}
          metric={metric}
          reveal={reveal}
          selectedRow={selectedRow}
        />
      )}
      <p
        className="font-mono text-muted-foreground text-xs"
        data-slot="heatmap-readout"
      >
        {readoutCell
          ? describeMatrixCell(readoutCell)
          : "Hover or focus a cell for exact values."}
      </p>
    </div>
  )
}

interface ModeViewProps {
  matrix: CommitMatrix
  metric: "state" | "confidence"
  frameIndex: number
  selectedRow: number
  reveal: (row: number, frame: number) => void
  activate: (row: number, frame: number) => void
}

function DomModeView({
  matrix,
  metric,
  frameIndex,
  selectedRow,
  reveal,
  activate,
}: ModeViewProps) {
  const frames = Array.from(
    { length: matrix.frameCount },
    (_, i) => matrix.startFrame + i
  )
  return (
    <div className="overflow-x-auto">
      <table
        aria-label="Commit heatmap"
        className="border-separate border-spacing-0"
      >
        <tbody>
          {matrix.slotIds.map((slotId, row) => (
            <tr key={slotId}>
              <th
                className="pr-2 text-left font-mono font-normal text-muted-foreground text-xs"
                scope="row"
              >
                {slotId}
              </th>
              {frames.map((frame) => {
                const cell = getMatrixCell(matrix, row, frame)
                const flat =
                  row * matrix.frameCount + (frame - matrix.startFrame)
                return (
                  <td className="p-0" key={frame}>
                    <button
                      aria-current={frame === frameIndex ? "time" : undefined}
                      aria-label={describeMatrixCell(cell)}
                      className={cn(
                        "flex size-5 items-center justify-center border border-transparent text-[9px] leading-none focus-visible:outline-2 focus-visible:outline-ring",
                        frame === frameIndex && "border-foreground",
                        row === selectedRow && "ring-1 ring-ring"
                      )}
                      data-state={cell.state ?? "absent"}
                      onClick={() => activate(row, frame)}
                      onFocus={() => reveal(row, frame)}
                      onMouseEnter={() => reveal(row, frame)}
                      style={{
                        backgroundColor: heatmapCellColor(
                          matrix.states[flat],
                          matrix.confidences[flat],
                          metric
                        ),
                      }}
                      title={describeMatrixCell(cell)}
                      type="button"
                    >
                      <span aria-hidden>
                        {cell.state ? STATE_GLYPHS[cell.state] : ""}
                      </span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Canvas mode is implemented in the next task (dense traces, spec §19.2).
function CanvasModeView(_props: ModeViewProps & { cellSize: number }) {
  return (
    <div data-slot="heatmap-canvas-placeholder">
      Dense heatmap (canvas mode) arrives in the next task.
    </div>
  )
}
```

Design notes (spec §15.4/§18): the DOM grid is a real `<table>` with `scope="row"` slot-ID headers, so screen readers get row context for free; every cell is a semantic button whose accessible name IS the exact value; the shared `data-slot="heatmap-readout"` line is plain text (not a live region — no per-cell announcement spam) updated on hover and focus. `heatmapCellColor` is a function declaration so `DomModeView` can reference it regardless of definition order.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/components/commit-heatmap.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Verify workspace, commit**

Run: `pnpm lint && pnpm typecheck && pnpm test` — expect PASS.

```bash
git add -A
git commit -m "feat(registry): CommitHeatmap DOM mode with exact-value cells and linked frame cursor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `CommitHeatmap` — Canvas mode, devicePixelRatio, keyboard cell cursor

**Files:**
- Modify: `registry/default/commit-heatmap/commit-heatmap.tsx`, `apps/web/src/components/commit-heatmap.test.tsx`, `apps/web/src/test/setup.ts`

**Interfaces:**
- Produces (added exports from the component file):
  - `cellFromPoint(x: number, y: number, cellSize: number, matrix: CommitMatrix): { row: number; frame: number } | null` — pure hit-testing.
  - `paintHeatmap(ctx: CanvasRenderingContext2D, matrix: CommitMatrix, options: HeatmapPaintOptions): void` — thin paint loop; `HeatmapPaintOptions = { cellSize; metric; frameIndex; selectedRow; cursor }`.
  - `CanvasModeView` (internal) replaces the Task 4 placeholder: dpr-scaled backing store, mousemove hover readout, focusable wrapper with an arrow-key cell cursor, Enter/Space to seek + select, painted linked cursor for the current player frame column and selected slot row.
- jsdom contract: `getContext("2d")` returns `null` there — the paint effect guards on it, so component tests cover markup/keyboard/readout while `paintHeatmap` stays a thin, untested-by-jsdom loop over the already-tested matrix + color mapping.

- [ ] **Step 1: Quiet canvas stub in the web test setup**

Append to `apps/web/src/test/setup.ts`:

```ts
// jsdom has no canvas implementation; return null quietly so canvas-mode
// components take their guarded no-paint branch without console noise.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext
```

- [ ] **Step 2: Write the failing tests** (append to `apps/web/src/components/commit-heatmap.test.tsx`)

Extend the import lines at the top of the file:

```tsx
import {
  MATRIX_ABSENT,
  TOKEN_STATE_CODES,
  buildCommitMatrix,
  describeMatrixCell,
  generatePerformanceTrace,
  getMatrixCell,
  maskedRemaskTrace,
} from "@/lib/dllm-viz-core"
```

```tsx
import {
  CommitHeatmap,
  STATE_GLYPHS,
  cellFromPoint,
  heatmapCellColor,
} from "@/registry/default/commit-heatmap/commit-heatmap"
```

Append the new describe blocks:

```tsx
describe("CommitHeatmap (canvas mode)", () => {
  const denseTrace = generatePerformanceTrace({
    slotCount: 64,
    frameCount: 64,
    seed: 7,
  })
  const matrix = buildCommitMatrix(denseTrace)

  const renderDense = () =>
    render(
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider trace={denseTrace}>
          <CommitHeatmap />
          <Probe />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )

  it("switches to canvas above the cell threshold (spec §19.2)", () => {
    const { container } = renderDense()
    expect(
      container.querySelector('[data-mode="canvas"]')
    ).toBeInTheDocument()
    expect(container.querySelector("canvas")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("scales the backing store by devicePixelRatio", () => {
    vi.stubGlobal("devicePixelRatio", 2)
    const { container } = renderDense()
    const canvas = container.querySelector("canvas")
    // 64 frames × 4px default cells × dpr 2
    expect(canvas?.width).toBe(64 * 4 * 2)
    expect(canvas?.style.width).toBe("256px")
    vi.unstubAllGlobals()
  })

  it("keyboard cell cursor reveals exact values (spec §15.4)", () => {
    const { container } = renderDense()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowDown" })
    expect(
      container.querySelector('[data-slot="heatmap-readout"]')
    ).toHaveTextContent(describeMatrixCell(getMatrixCell(matrix, 1, 2)))
  })

  it("Enter on the cursor seeks the player and selects the slot", () => {
    renderDense()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "Enter" })
    expect(screen.getByRole("status")).toHaveTextContent("s0:2")
  })
})

describe("CommitHeatmap pure helpers", () => {
  it("heatmapCellColor maps states, confidence, and absence", () => {
    expect(heatmapCellColor(MATRIX_ABSENT, Number.NaN, "state")).toBe(
      "transparent"
    )
    expect(
      heatmapCellColor(TOKEN_STATE_CODES.committed, Number.NaN, "state")
    ).toBe("#10b981")
    expect(
      heatmapCellColor(TOKEN_STATE_CODES.committed, 1, "confidence")
    ).toBe("#10b981ff")
    expect(
      heatmapCellColor(TOKEN_STATE_CODES.masked, Number.NaN, "confidence")
    ).toBe("#a1a1aa")
  })

  it("cellFromPoint maps points to cells and rejects out-of-bounds", () => {
    const matrix = buildCommitMatrix(maskedRemaskTrace)
    expect(cellFromPoint(9, 13, 4, matrix)).toEqual({ row: 3, frame: 2 })
    expect(cellFromPoint(-1, 0, 4, matrix)).toBeNull()
    expect(cellFromPoint(4 * 7, 0, 4, matrix)).toBeNull()
  })

  it("every token state has a glyph (no color-only encoding)", () => {
    for (const state of Object.keys(TOKEN_STATE_CODES)) {
      expect(STATE_GLYPHS[state as keyof typeof STATE_GLYPHS]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/components/commit-heatmap.test.tsx`
Expected: FAIL — `cellFromPoint` is not exported and the canvas branch is a placeholder.

- [ ] **Step 4: Implement canvas mode**

In `registry/default/commit-heatmap/commit-heatmap.tsx`:

1. Extend the react imports:

```tsx
import type { KeyboardEvent, MouseEvent } from "react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
```

2. Add the pure helpers after `heatmapCellColor`:

```tsx
/** Pure point→cell mapping for canvas hit-testing (unit-tested). */
export function cellFromPoint(
  x: number,
  y: number,
  cellSize: number,
  matrix: CommitMatrix
): { row: number; frame: number } | null {
  const column = Math.floor(x / cellSize)
  const row = Math.floor(y / cellSize)
  if (row < 0 || row >= matrix.slotIds.length) return null
  if (column < 0 || column >= matrix.frameCount) return null
  return { row, frame: matrix.startFrame + column }
}

export interface HeatmapPaintOptions {
  cellSize: number
  metric: "state" | "confidence"
  frameIndex: number
  selectedRow: number
  cursor: { row: number; frame: number } | null
}

/**
 * Thin paint loop over the pre-computed matrix. All mapping logic lives
 * in the pure functions above so jsdom tests never need a 2D context.
 */
export function paintHeatmap(
  ctx: CanvasRenderingContext2D,
  matrix: CommitMatrix,
  options: HeatmapPaintOptions
): void {
  const { cellSize, metric, frameIndex, selectedRow, cursor } = options
  const width = matrix.frameCount * cellSize
  const height = matrix.slotIds.length * cellSize
  ctx.clearRect(0, 0, width, height)
  for (let row = 0; row < matrix.slotIds.length; row++) {
    for (let column = 0; column < matrix.frameCount; column++) {
      const flat = row * matrix.frameCount + column
      ctx.fillStyle = heatmapCellColor(
        matrix.states[flat],
        matrix.confidences[flat],
        metric
      )
      ctx.fillRect(column * cellSize, row * cellSize, cellSize, cellSize)
    }
  }
  // Linked cursor: current player frame column + selected slot row.
  const frameColumn = frameIndex - matrix.startFrame
  ctx.strokeStyle = "#18181b"
  if (frameColumn >= 0 && frameColumn < matrix.frameCount) {
    ctx.strokeRect(frameColumn * cellSize + 0.5, 0.5, cellSize - 1, height - 1)
  }
  if (selectedRow >= 0) {
    ctx.strokeRect(0.5, selectedRow * cellSize + 0.5, width - 1, cellSize - 1)
  }
  if (cursor) {
    ctx.strokeStyle = "#2563eb"
    ctx.lineWidth = 2
    ctx.strokeRect(
      (cursor.frame - matrix.startFrame) * cellSize + 1,
      cursor.row * cellSize + 1,
      cellSize - 2,
      cellSize - 2
    )
    ctx.lineWidth = 1
  }
}
```

3. Replace the placeholder `CanvasModeView` entirely with:

```tsx
function CanvasModeView({
  matrix,
  metric,
  frameIndex,
  selectedRow,
  reveal,
  activate,
  cellSize,
}: ModeViewProps & { cellSize: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cursor, setCursor] = useState({ row: 0, frame: matrix.startFrame })
  const readoutHintId = useId()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = matrix.frameCount * cellSize
    const height = matrix.slotIds.length * cellSize
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext("2d")
    if (!ctx) return // jsdom: mapping is covered by pure-function tests
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintHeatmap(ctx, matrix, {
      cellSize,
      metric,
      frameIndex,
      selectedRow,
      cursor,
    })
  }, [matrix, cellSize, metric, frameIndex, selectedRow, cursor])

  const moveCursor = (dRow: number, dFrame: number) => {
    const row = Math.min(
      Math.max(cursor.row + dRow, 0),
      matrix.slotIds.length - 1
    )
    const frame = Math.min(
      Math.max(cursor.frame + dFrame, matrix.startFrame),
      matrix.startFrame + matrix.frameCount - 1
    )
    setCursor({ row, frame })
    reveal(row, frame)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const handle = (action: () => void) => {
      // Also stop the window-level player bindings from stepping.
      event.preventDefault()
      event.stopPropagation()
      action()
    }
    switch (event.key) {
      case "ArrowRight":
        handle(() => moveCursor(0, 1))
        break
      case "ArrowLeft":
        handle(() => moveCursor(0, -1))
        break
      case "ArrowDown":
        handle(() => moveCursor(1, 0))
        break
      case "ArrowUp":
        handle(() => moveCursor(-1, 0))
        break
      case "Home":
        handle(() => moveCursor(0, matrix.startFrame - cursor.frame))
        break
      case "End":
        handle(() =>
          moveCursor(
            0,
            matrix.startFrame + matrix.frameCount - 1 - cursor.frame
          )
        )
        break
      case "Enter":
      case " ":
        handle(() => activate(cursor.row, cursor.frame))
        break
    }
  }

  const cellAt = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return cellFromPoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      cellSize,
      matrix
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {/* biome-ignore lint/a11y/useSemanticElements: a canvas cell grid has no semantic HTML element; img role plus a keyboard cell cursor is the pattern here */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the wrapper IS the keyboard cell cursor */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: see above */}
      <div
        aria-describedby={readoutHintId}
        aria-label={`Commit heatmap: ${matrix.slotIds.length} slots by ${matrix.frameCount} frames. Arrow keys move the cell cursor, Enter seeks and selects.`}
        className="w-fit max-w-full overflow-auto rounded border focus-visible:outline-2 focus-visible:outline-ring"
        onClick={(event) => {
          const cell = cellAt(event)
          if (cell) {
            setCursor(cell)
            activate(cell.row, cell.frame)
          }
        }}
        onKeyDown={onKeyDown}
        onMouseMove={(event) => {
          const cell = cellAt(event)
          if (cell) reveal(cell.row, cell.frame)
        }}
        role="img"
        tabIndex={0}
      >
        <canvas ref={canvasRef} />
      </div>
      <p className="sr-only" id={readoutHintId}>
        Exact values for the hovered or focused cell appear in the readout
        below the heatmap.
      </p>
    </div>
  )
}
```

If Biome flags different a11y rule names on the wrapper than the three listed, keep the wrapper structure and adjust the `biome-ignore` rule names to the ones actually reported (with the same justifications) — do not restructure into a non-focusable element, and do not drop keyboard handling.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/components/commit-heatmap.test.tsx`
Expected: PASS (15 tests: 8 DOM + 4 canvas + 3 pure helpers).

- [ ] **Step 6: Verify workspace, commit**

Run: `pnpm lint && pnpm typecheck && pnpm test` — expect PASS.

```bash
git add -A
git commit -m "feat(registry): CommitHeatmap canvas mode with dpr scaling and keyboard cell cursor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `CandidateDistribution` registry component

**Files:**
- Create: `registry/default/candidate-distribution/candidate-distribution.tsx`, `apps/web/src/components/candidate-distribution.test.tsx`

**Interfaces:**
- Consumes: types `DiffusionFrame`, `SetDistributionOperation`, `TraceOperation`, `TraceProvenance` via `@/lib/dllm-viz-core`; `useDiffusionPlayer`, `useDiffusionSnapshot`, `useOptionalSlotSelection`, `useTraceProvenance`; `cn`.
- Produces:
  - `CandidateDistribution(props: { slotId?: string | null; className?: string })` — explicit `slotId` prop (including `null`) wins; omitted falls back to selection context.
  - Exported pure helpers: `distributionsForSlot(frames, upToFrameIndex, slotId): { current?: SetDistributionOperation; previous?: SetDistributionOperation }` (a distribution published before the most recent `mask`/`renoise` on the slot is superseded → `current` undefined); `omittedMassInfo(op): { value: number; derived: boolean } | undefined` (recorded field, else `1 − Σp` labeled derived).
  - Renders ranked bars (probability as **text**, bar as redundant length encoding), entropy + top-1/top-2 margin with provenance badges, churn markers vs the previous distribution (`↑n`/`↓n`/`new`), and the omitted-mass row — spec §15.6 MUST show omitted probability mass when top-k does not sum to one.

- [ ] **Step 1: Write the failing tests** (`apps/web/src/components/candidate-distribution.test.tsx`)

```tsx
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { DiffusionTrace } from "@/lib/dllm-viz-core"
import { confidenceCommitTrace, maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { CandidateDistribution } from "@/registry/default/candidate-distribution/candidate-distribution"

const renderAt = (
  trace: DiffusionTrace,
  frame: number,
  slotId?: string | null
) =>
  render(
    <DiffusionTraceProvider initialFrame={frame} trace={trace}>
      <CandidateDistribution slotId={slotId} />
    </DiffusionTraceProvider>
  )

describe("CandidateDistribution", () => {
  it("prompts for a selection when nothing is selected", () => {
    renderAt(confidenceCommitTrace, 1, null)
    expect(screen.getByText(/select a token slot/i)).toBeInTheDocument()
  })

  it("renders ranked bars with probabilities as text", () => {
    renderAt(confidenceCommitTrace, 1, "s2")
    const list = screen.getByRole("list", { name: "Ranked candidates" })
    const rows = within(list).getAllByRole("listitem")
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent("Paris")
    expect(rows[0]).toHaveTextContent("55%")
    expect(rows[2]).toHaveTextContent("10%")
  })

  it("always shows omitted probability mass (spec §15.6 MUST)", () => {
    renderAt(confidenceCommitTrace, 1, "s2")
    expect(screen.getByText(/omitted mass — 15%/)).toBeInTheDocument()
  })

  it("shows entropy and top-1/top-2 margin", () => {
    renderAt(confidenceCommitTrace, 1, "s2")
    expect(screen.getByText("1.42")).toBeInTheDocument()
    expect(screen.getByText("0.35")).toBeInTheDocument()
  })

  it("marks candidate churn between successive distributions", () => {
    renderAt(confidenceCommitTrace, 2, "s2")
    const list = screen.getByRole("list", { name: "Ranked candidates" })
    const rows = within(list).getAllByRole("listitem")
    expect(rows[1]).toHaveTextContent("Nice")
    expect(rows[1]).toHaveTextContent("↑1")
    expect(rows[2]).toHaveTextContent("Lyon")
    expect(rows[2]).toHaveTextContent("↓1")
  })

  it("derives omitted mass when the field is absent and labels it derived", () => {
    const stripped: DiffusionTrace = structuredClone(confidenceCommitTrace)
    for (const frame of stripped.frames) {
      for (const op of frame.operations) {
        if (op.type === "set-distribution") op.omittedMass = undefined
      }
    }
    renderAt(stripped, 1, "s2")
    // 1 − (0.55 + 0.2 + 0.1) = 15%
    const row = screen.getByText(/omitted mass — 15%/).closest("p")
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText("derived")).toBeInTheDocument()
  })

  it("does not show a superseded pre-remask distribution (spec §15.1)", () => {
    renderAt(maskedRemaskTrace, 5, "s3")
    expect(screen.getByText(/no current distribution/i)).toBeInTheDocument()
  })

  it("shows the pre-remask distribution while it is still current", () => {
    renderAt(maskedRemaskTrace, 2, "s3")
    expect(screen.getByText("46%")).toBeInTheDocument()
  })

  it("falls back to the shared selection context", () => {
    render(
      <DiffusionSelectionProvider defaultSelectedSlotId="s2">
        <DiffusionTraceProvider initialFrame={1} trace={confidenceCommitTrace}>
          <CandidateDistribution />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )
    expect(screen.getByText(/candidates for s2/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/candidate-distribution.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement** (`registry/default/candidate-distribution/candidate-distribution.tsx`)

```tsx
import type {
  DiffusionFrame,
  SetDistributionOperation,
  TraceOperation,
  TraceProvenance,
} from "@/lib/dllm-viz-core"
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useOptionalSlotSelection,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

export interface CandidateDistributionProps {
  slotId?: string | null
  className?: string
}

export interface SlotDistributions {
  current?: SetDistributionOperation
  previous?: SetDistributionOperation
}

/**
 * Latest distribution for a slot up to the frame. Remasking is a normal
 * operation: a distribution published before the most recent
 * mask/renoise on the slot is a superseded decision, so `current` is
 * undefined then (spec §15.1). `previous` is the distribution
 * immediately before `current`, used for churn markers.
 */
export function distributionsForSlot(
  frames: DiffusionFrame[],
  upToFrameIndex: number,
  slotId: string
): SlotDistributions {
  const ops: TraceOperation[] = []
  for (let i = 0; i <= upToFrameIndex; i++) {
    for (const op of frames[i].operations) {
      if ("slotId" in op && op.slotId === slotId) ops.push(op)
    }
  }
  const distributions = ops.filter(
    (op): op is SetDistributionOperation => op.type === "set-distribution"
  )
  const last = distributions.at(-1)
  if (!last) return {}
  const lastPosition = ops.lastIndexOf(last)
  const superseded = ops
    .slice(lastPosition + 1)
    .some((op) => op.type === "mask" || op.type === "renoise")
  return {
    current: superseded ? undefined : last,
    previous:
      distributions.length > 1
        ? distributions[distributions.length - 2]
        : undefined,
  }
}

/**
 * Omitted probability mass (spec §15.6 MUST show). Uses the recorded
 * field when present; otherwise derives 1 − Σp when every candidate
 * carries a probability — the derivation is labeled "derived".
 */
export function omittedMassInfo(
  op: SetDistributionOperation
): { value: number; derived: boolean } | undefined {
  if (op.omittedMass !== undefined) {
    return { value: op.omittedMass, derived: false }
  }
  if (op.candidates.some((c) => c.probability === undefined)) {
    return undefined
  }
  const sum = op.candidates.reduce((acc, c) => acc + (c.probability ?? 0), 0)
  return { value: Math.max(0, 1 - sum), derived: true }
}

function churnMarker(
  candidate: SetDistributionOperation["candidates"][number],
  previous: SetDistributionOperation | undefined
): string | null {
  if (!previous) return null
  const match = previous.candidates.find((c) =>
    candidate.tokenId !== undefined
      ? c.tokenId === candidate.tokenId
      : c.text === candidate.text
  )
  if (!match) return "new"
  if (match.rank > candidate.rank) return `↑${match.rank - candidate.rank}`
  if (match.rank < candidate.rank) return `↓${candidate.rank - match.rank}`
  return null
}

function provenanceFor(provenance: TraceProvenance, key: string): string {
  return provenance.fields?.[key] ?? provenance.mode
}

function Badge({ value }: { value: string }) {
  return (
    <span
      className="rounded border border-dashed px-1 text-[10px] text-muted-foreground"
      data-slot="provenance-badge"
    >
      {value}
    </span>
  )
}

export function CandidateDistribution({
  slotId,
  className,
}: CandidateDistributionProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const selection = useOptionalSlotSelection()
  // Explicit prop (including null) wins; undefined falls back to context.
  const activeSlotId =
    slotId !== undefined ? slotId : (selection?.selectedSlotId ?? null)

  if (!activeSlotId) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        Select a token slot to see its candidate distribution.
      </div>
    )
  }

  const { current, previous } = distributionsForSlot(
    player.trace.frames,
    snapshot.frameIndex,
    activeSlotId
  )

  if (!current) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        No current distribution for slot {activeSlotId} at this frame.
      </div>
    )
  }

  const omitted = omittedMassInfo(current)
  const percent = (p: number) => `${Math.round(p * 100)}%`

  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)}>
      <div className="flex items-baseline gap-2">
        <h3 className="font-medium">Candidates for {activeSlotId}</h3>
        <Badge value={provenanceFor(provenance, "candidates")} />
      </div>
      <dl className="flex gap-4 font-mono text-xs">
        {current.entropy !== undefined && (
          <div className="flex items-baseline gap-1">
            <dt className="text-muted-foreground">entropy</dt>
            <dd>{current.entropy.toFixed(2)}</dd>
            <Badge value={provenanceFor(provenance, "entropy")} />
          </div>
        )}
        {current.margin !== undefined && (
          <div className="flex items-baseline gap-1">
            <dt className="text-muted-foreground">margin</dt>
            <dd>{current.margin.toFixed(2)}</dd>
            <Badge value={provenanceFor(provenance, "margin")} />
          </div>
        )}
      </dl>
      <ol aria-label="Ranked candidates" className="flex flex-col gap-1">
        {current.candidates.map((candidate) => {
          const churn = churnMarker(candidate, previous)
          return (
            <li
              className="flex items-center gap-2 font-mono text-xs"
              key={candidate.rank}
            >
              <span className="w-28 shrink-0 truncate">
                #{candidate.rank} {candidate.text ?? candidate.tokenId}
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums">
                {candidate.probability !== undefined
                  ? percent(candidate.probability)
                  : "—"}
              </span>
              <span aria-hidden className="h-2 flex-1 rounded-sm bg-muted">
                <span
                  className="block h-2 rounded-sm bg-[var(--dllm-committed,#10b981)]"
                  style={{ width: `${(candidate.probability ?? 0) * 100}%` }}
                />
              </span>
              {churn && (
                <span
                  aria-label={
                    churn === "new"
                      ? "new candidate"
                      : churn.startsWith("↑")
                        ? `rank up ${churn.slice(1)}`
                        : `rank down ${churn.slice(1)}`
                  }
                  className="w-8 shrink-0 text-muted-foreground"
                >
                  {churn}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {omitted !== undefined && (
        <p className="flex items-center gap-2 font-mono text-muted-foreground text-xs">
          <span>omitted mass — {percent(omitted.value)}</span>
          <Badge
            value={
              omitted.derived
                ? "derived"
                : provenanceFor(provenance, "omitted mass")
            }
          />
        </p>
      )}
    </div>
  )
}
```

Design notes (spec §15.6/§18): the bar is `aria-hidden` redundant length encoding — the probability is always present as text, so no value is color/length-only. The probability-sparkline view is deferred (see Self-Review Notes); omitted mass, ranked bars, entropy/margin, and churn are the Phase 2 surface.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/components/candidate-distribution.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Verify workspace, commit**

Run: `pnpm lint && pnpm typecheck && pnpm test` — expect PASS.

```bash
git add -A
git commit -m "feat(registry): CandidateDistribution with omitted mass, churn, and remask-aware currency

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `BlockDiffusionCanvas` registry component

**Files:**
- Create: `registry/default/block-diffusion-canvas/block-diffusion-canvas.tsx`, `apps/web/src/components/block-diffusion-canvas.test.tsx`

**Interfaces:**
- Consumes: `describeSnapshot`, types `DiffusionTrace`, `TokenSlot`, `TokenState` via `@/lib/dllm-viz-core`; provider hooks + optional selection; `cn`; `blockCanvasTrace` fixture in tests.
- Produces:
  - `BlockDiffusionCanvas(props: { showPrompt?: boolean; className?: string })`
  - Exported pure helper `computeCanvasSections(trace, slots, frameIndex): { promptSlots: TokenSlot[]; sections: CanvasSection[] }` with `CanvasSection = { canvasIndex; slots; status: "committed" | "active" | "future"; innerStep?; innerStepCount? }`. Canvas membership is DERIVED: completion slots chunked by `generation.canvasLength` (the schema has no per-slot canvas field); status from `canvas-start`/`canvas-commit` frames up to the current frame; `innerStepCount` is the max `innerStep` observed for that canvas across the whole trace (fallback `generation.totalSteps`).
  - Required distinctions (spec §15.5): prompt/cache context section; committed canvases (solid border + "committed" header, fixed chips); active canvas **visually nested** (outer highlighted section wrapping an inner `data-slot="active-canvas-inner"` container) with "step i/n" progress; future canvases (dashed, dimmed, masked chips). One sr-only step summary including the active canvas/inner step — no per-token live regions.

- [ ] **Step 1: Write the failing tests** (`apps/web/src/components/block-diffusion-canvas.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { blockCanvasTrace, materializeSlots } from "@/lib/dllm-viz-core"
import { DiffusionTraceProvider } from "@/lib/dllm-viz-react"
import {
  BlockDiffusionCanvas,
  computeCanvasSections,
} from "@/registry/default/block-diffusion-canvas/block-diffusion-canvas"

const renderAt = (frame: number) =>
  render(
    <DiffusionTraceProvider initialFrame={frame} trace={blockCanvasTrace}>
      <BlockDiffusionCanvas />
    </DiffusionTraceProvider>
  )

describe("BlockDiffusionCanvas", () => {
  it("separates prompt context and marks both canvases future initially", () => {
    renderAt(0)
    expect(
      screen.getByRole("region", { name: "Prompt context" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 0: future" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 1: future" })
    ).toBeInTheDocument()
  })

  it("nests the active canvas and shows inner-step progress (spec §15.5)", () => {
    renderAt(2)
    const active = screen.getByRole("region", { name: "Canvas 0: active" })
    expect(active).toHaveTextContent("canvas 0 · step 1/2")
    expect(
      active.querySelector('[data-slot="active-canvas-inner"]')
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 1: future" })
    ).toBeInTheDocument()
  })

  it("marks canvas 0 committed at its canvas-commit boundary", () => {
    renderAt(4)
    expect(
      screen.getByRole("region", { name: "Canvas 0: committed" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 1: future" })
    ).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="active-canvas-inner"]')
    ).toBeNull()
  })

  it("activates canvas 1 after its canvas-start", () => {
    renderAt(6)
    expect(
      screen.getByRole("region", { name: "Canvas 0: committed" })
    ).toBeInTheDocument()
    const active = screen.getByRole("region", { name: "Canvas 1: active" })
    expect(active).toHaveTextContent("canvas 1 · step 1/2")
  })

  it("marks both canvases committed at the end", () => {
    renderAt(9)
    expect(
      screen.getByRole("region", { name: "Canvas 0: committed" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 1: committed" })
    ).toBeInTheDocument()
  })

  it("renders committed chips as fixed and future chips as masked", () => {
    renderAt(4)
    const committed = screen.getByRole("region", {
      name: "Canvas 0: committed",
    })
    for (const chip of committed.querySelectorAll("button")) {
      expect(chip).toHaveAttribute("data-state", "fixed")
    }
    const future = screen.getByRole("region", { name: "Canvas 1: future" })
    for (const chip of future.querySelectorAll("button")) {
      expect(chip).toHaveAttribute("data-state", "masked")
    }
  })

  it("announces the active canvas in the single step summary", () => {
    renderAt(6)
    expect(screen.getByRole("status")).toHaveTextContent(
      /Canvas 1 active, inner step 1 of 2/
    )
  })

  it("computeCanvasSections derives status and progress", () => {
    const slots = materializeSlots(blockCanvasTrace, 7)
    const { promptSlots, sections } = computeCanvasSections(
      blockCanvasTrace,
      slots,
      7
    )
    expect(promptSlots.map((s) => s.slotId)).toEqual(["s0"])
    expect(sections.map((s) => s.status)).toEqual(["committed", "active"])
    expect(sections[1].innerStep).toBe(2)
    expect(sections[1].innerStepCount).toBe(2)
    expect(sections[1].slots.map((s) => s.slotId)).toEqual(["s4", "s5", "s6"])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/block-diffusion-canvas.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement** (`registry/default/block-diffusion-canvas/block-diffusion-canvas.tsx`)

```tsx
import type {
  DiffusionTrace,
  TokenSlot,
  TokenState,
} from "@/lib/dllm-viz-core"
import { describeSnapshot } from "@/lib/dllm-viz-core"
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useOptionalSlotSelection,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

export interface BlockDiffusionCanvasProps {
  showPrompt?: boolean
  className?: string
}

export type CanvasStatus = "committed" | "active" | "future"

export interface CanvasSection {
  canvasIndex: number
  slots: TokenSlot[]
  status: CanvasStatus
  innerStep?: number
  innerStepCount?: number
}

/**
 * Derives canvas membership and progress (spec §15.5, §13). The trace
 * schema has no per-slot canvas field, so completion slots are chunked
 * by generation.canvasLength (derived data). Status comes from
 * canvas-start/canvas-commit frames up to the current frame; the inner
 * step total is the maximum innerStep observed for that canvas across
 * the whole trace (fallback generation.totalSteps).
 */
export function computeCanvasSections(
  trace: DiffusionTrace,
  slots: readonly TokenSlot[],
  frameIndex: number
): { promptSlots: TokenSlot[]; sections: CanvasSection[] } {
  const promptSlots = slots.filter(
    (slot) => slot.region === "prompt" || slot.state === "prompt"
  )
  const completion = slots.filter((slot) => !promptSlots.includes(slot))
  const canvasLength = trace.generation.canvasLength ?? completion.length
  const chunkCount =
    canvasLength > 0 ? Math.ceil(completion.length / canvasLength) : 0

  const committed = new Set<number>()
  let active: number | undefined
  let innerStep: number | undefined
  for (let i = 0; i <= frameIndex; i++) {
    const frame = trace.frames[i]
    if (frame.kind === "canvas-start" && frame.canvasIndex !== undefined) {
      active = frame.canvasIndex
      innerStep = frame.innerStep ?? 0
    } else if (
      frame.kind === "canvas-commit" &&
      frame.canvasIndex !== undefined
    ) {
      committed.add(frame.canvasIndex)
      if (active === frame.canvasIndex) {
        active = undefined
        innerStep = undefined
      }
    } else if (
      frame.canvasIndex !== undefined &&
      frame.canvasIndex === active &&
      frame.innerStep !== undefined
    ) {
      innerStep = frame.innerStep
    }
  }

  const innerStepCounts = new Map<number, number>()
  for (const frame of trace.frames) {
    if (frame.canvasIndex !== undefined && frame.innerStep !== undefined) {
      innerStepCounts.set(
        frame.canvasIndex,
        Math.max(innerStepCounts.get(frame.canvasIndex) ?? 0, frame.innerStep)
      )
    }
  }

  const sections: CanvasSection[] = []
  for (let c = 0; c < chunkCount; c++) {
    sections.push({
      canvasIndex: c,
      slots: completion.slice(c * canvasLength, (c + 1) * canvasLength),
      status: committed.has(c)
        ? "committed"
        : c === active
          ? "active"
          : "future",
      innerStep: c === active ? innerStep : undefined,
      innerStepCount: innerStepCounts.get(c) ?? trace.generation.totalSteps,
    })
  }
  return { promptSlots, sections }
}

// Registry items are self-contained: these chip styles deliberately
// mirror DenoisingTokenCanvas instead of importing across registry items.
const CHIP_CLASSES: Record<TokenState, string> = {
  prompt: "border-transparent bg-muted text-muted-foreground",
  masked:
    "border-dashed border-[var(--dllm-mask,#a1a1aa)] text-muted-foreground",
  proposed: "border-dotted border-[var(--dllm-proposed,#f59e0b)] italic",
  committed: "border-solid border-[var(--dllm-committed,#10b981)]",
  fixed:
    "border-solid border-[var(--dllm-fixed,#10b981)] bg-[color-mix(in_srgb,var(--dllm-fixed,#10b981)_15%,transparent)] font-medium",
  renoised:
    "border-double border-2 border-[var(--dllm-renoised,#ef4444)] line-through",
  padding: "border-transparent opacity-40",
  unknown: "border-solid border-[var(--dllm-mask,#a1a1aa)] opacity-70",
}

function SlotChip({
  slot,
  selected,
  onSelect,
}: {
  slot: TokenSlot
  selected: boolean
  onSelect: (slotId: string) => void
}) {
  const text = slot.text !== undefined ? ` ${slot.text.trim() || "space"}` : ""
  return (
    <button
      aria-label={`Slot ${slot.index}:${text}, ${slot.state}`}
      aria-pressed={selected}
      className={cn(
        "rounded border px-1.5 py-0.5 focus-visible:outline-2 focus-visible:outline-ring",
        CHIP_CLASSES[slot.state],
        selected && "ring-2 ring-ring"
      )}
      data-state={slot.state}
      onClick={() => onSelect(slot.slotId)}
      type="button"
    >
      {slot.state === "masked" ? (
        <span aria-hidden>░░</span>
      ) : (
        (slot.text ?? "·")
      )}
    </button>
  )
}

export function BlockDiffusionCanvas({
  showPrompt = true,
  className,
}: BlockDiffusionCanvasProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const selection = useOptionalSlotSelection()
  const { promptSlots, sections } = computeCanvasSections(
    player.trace,
    snapshot.slots,
    snapshot.frameIndex
  )
  const activeSection = sections.find((s) => s.status === "active")
  const select = (slotId: string) => selection?.setSelectedSlotId(slotId)

  const sectionLabel = (section: CanvasSection) =>
    section.status === "active"
      ? `canvas ${section.canvasIndex} · step ${section.innerStep ?? 0}/${section.innerStepCount ?? "?"}`
      : `canvas ${section.canvasIndex} · ${section.status}`

  const chips = (section: CanvasSection) =>
    section.slots.map((slot) => (
      <SlotChip
        key={slot.slotId}
        onSelect={select}
        selected={slot.slotId === selection?.selectedSlotId}
        slot={slot}
      />
    ))

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {provenance.mode !== "measured" && (
        <span
          className="self-start rounded border border-dashed px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
          title={provenance.notes?.join(" ")}
        >
          {provenance.mode}
        </span>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: not a form control group; <fieldset> would be semantically wrong here */}
      <div
        aria-label="Block diffusion canvases"
        className="flex flex-wrap items-stretch gap-2 font-mono text-sm"
        role="group"
      >
        {showPrompt && promptSlots.length > 0 && (
          <section
            aria-label="Prompt context"
            className="flex flex-wrap items-center gap-1 rounded border border-transparent bg-muted/50 p-1"
          >
            {promptSlots.map((slot) => (
              <SlotChip
                key={slot.slotId}
                onSelect={select}
                selected={slot.slotId === selection?.selectedSlotId}
                slot={slot}
              />
            ))}
          </section>
        )}
        {sections.map((section) => (
          <section
            aria-label={`Canvas ${section.canvasIndex}: ${section.status}`}
            className={cn(
              "flex flex-col gap-1 rounded border p-1",
              section.status === "committed" && "border-solid",
              section.status === "active" &&
                "border-2 border-[var(--dllm-committed,#10b981)]",
              section.status === "future" && "border-dashed opacity-60"
            )}
            data-status={section.status}
            key={section.canvasIndex}
          >
            <header className="px-1 text-muted-foreground text-xs">
              {sectionLabel(section)}
            </header>
            {section.status === "active" ? (
              <div
                className="flex flex-wrap items-center gap-1 rounded border border-dashed p-1"
                data-slot="active-canvas-inner"
              >
                {chips(section)}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                {chips(section)}
              </div>
            )}
          </section>
        ))}
      </div>
      <p className="sr-only" role="status">
        {describeSnapshot(snapshot, player.frameCount)}
        {activeSection &&
          ` Canvas ${activeSection.canvasIndex} active, inner step ${activeSection.innerStep ?? 0} of ${activeSection.innerStepCount ?? "?"}.`}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/components/block-diffusion-canvas.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Verify workspace, commit**

Run: `pnpm lint && pnpm typecheck && pnpm test` — expect PASS.

```bash
git add -A
git commit -m "feat(registry): BlockDiffusionCanvas with nested active canvas and inner-step progress

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `DiffusionComparison` registry component

**Files:**
- Create: `registry/default/diffusion-comparison/diffusion-comparison.tsx`, `apps/web/src/components/diffusion-comparison.test.tsx`

**Interfaces:**
- Consumes: `DiffusionTraceProvider`, `useDiffusionPlayer`, `useDiffusionSnapshot` via `@/lib/dllm-viz-react` (a registry component MAY render providers — the provider is headless library code, not another registry item); `cn`.
- Produces:
  - `DiffusionComparison(props: DiffusionComparisonProps)` where `DiffusionComparisonProps = { panes: [ComparisonPane, ComparisonPane]; defaultSyncRule?: ComparisonSyncRule; renderTrace?: (trace: DiffusionTrace) => ReactNode; className?: string }`, `ComparisonPane = { trace: DiffusionTrace; label: string }` (labels must be distinct — they are used as React keys), `ComparisonSyncRule = "frame-ordinal" | "completion-ratio"`.
  - Renders two independent `DiffusionTraceProvider`s driven by one master position; `renderTrace` (rendered inside each pane's provider) lets demos compose `DenoisingTokenCanvas` etc. without cross-registry-item imports; the built-in `PanePreview` token strip is the default.
  - Exported pure helper `paneFrameIndex(masterIndex, masterCount, paneCount, rule): number` — ordinal clamps to pane length; ratio maps proportionally.
  - Spec §15.7 rules: the selected sync rule is visible (labeled `<select>` + plain-text "Synced by …" line) and the UI never implies frame equivalence — frame-ordinal mode always shows "Equal ordinals are NOT equivalent steps." (even when frame counts match); completion-ratio mode always states positions are proportional.

- [ ] **Step 1: Write the failing tests** (`apps/web/src/components/diffusion-comparison.test.tsx`)

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import {
  arBaselineTrace,
  confidenceCommitTrace,
  maskedRemaskTrace,
} from "@/lib/dllm-viz-core"
import {
  DiffusionComparison,
  paneFrameIndex,
} from "@/registry/default/diffusion-comparison/diffusion-comparison"

const panes: Parameters<typeof DiffusionComparison>[0]["panes"] = [
  { trace: maskedRemaskTrace, label: "Diffusion (remasking)" },
  { trace: arBaselineTrace, label: "Autoregressive baseline" },
]

const setup = (
  props: Partial<Parameters<typeof DiffusionComparison>[0]> = {}
) => render(<DiffusionComparison panes={panes} {...props} />)

describe("DiffusionComparison", () => {
  it("renders both traces with their labels and provenance", () => {
    setup()
    expect(screen.getByText("Diffusion (remasking)")).toBeInTheDocument()
    expect(screen.getByText("Autoregressive baseline")).toBeInTheDocument()
    expect(
      document.querySelectorAll('[data-slot="comparison-pane"]')
    ).toHaveLength(2)
    expect(screen.getAllByText(/illustrative/)).not.toHaveLength(0)
  })

  it("makes the selected sync rule visible (spec §15.7 MUST)", () => {
    setup()
    expect(screen.getByLabelText("Synchronization rule")).toHaveValue(
      "frame-ordinal"
    )
    expect(screen.getByText(/synced by frame ordinal/i)).toBeInTheDocument()
  })

  it("warns that frame-ordinal sync does not imply equivalent steps", () => {
    setup()
    expect(
      screen.getByText(/equal ordinals are not equivalent steps/i)
    ).toBeInTheDocument()
  })

  it("warns in frame-ordinal mode when frame counts match but algorithms differ", () => {
    render(
      <DiffusionComparison
        panes={[
          { trace: confidenceCommitTrace, label: "Confidence commit" },
          { trace: arBaselineTrace, label: "Autoregressive baseline" },
        ]}
      />
    )
    expect(screen.getAllByText(/frame 1\/5/)).toHaveLength(2)
    expect(
      screen.getByText(/equal ordinals are not equivalent steps/i)
    ).toBeInTheDocument()
  })

  it("advances both panes from the shared controls (frame-ordinal)", async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Next step" }))
    await user.click(screen.getByRole("button", { name: "Next step" }))
    await user.click(screen.getByRole("button", { name: "Next step" }))
    expect(screen.getByText(/frame 4\/7/)).toBeInTheDocument()
    expect(screen.getByText(/frame 4\/5/)).toBeInTheDocument()
  })

  it("clamps the shorter trace at its final frame (frame-ordinal)", () => {
    setup()
    fireEvent.change(
      screen.getByRole("slider", { name: "Comparison position" }),
      { target: { value: "6" } }
    )
    expect(screen.getByText(/frame 7\/7/)).toBeInTheDocument()
    expect(screen.getByText(/frame 5\/5/)).toBeInTheDocument()
  })

  it("maps positions proportionally in completion-ratio mode", () => {
    setup({ defaultSyncRule: "completion-ratio" })
    expect(
      screen.getByText(/synced by completion ratio/i)
    ).toBeInTheDocument()
    fireEvent.change(
      screen.getByRole("slider", { name: "Comparison position" }),
      { target: { value: "3" } }
    )
    // master 3 of 0..6 = 50% → pane B round(0.5 × 4) = 2 → frame 3/5
    expect(screen.getByText(/frame 4\/7/)).toBeInTheDocument()
    expect(screen.getByText(/frame 3\/5/)).toBeInTheDocument()
  })

  it("supports a custom pane renderer inside each provider", () => {
    setup({
      renderTrace: (trace) => <div data-testid="custom">{trace.traceId}</div>,
    })
    expect(screen.getAllByTestId("custom")).toHaveLength(2)
    expect(screen.getByText("fixture-masked-remask")).toBeInTheDocument()
  })

  it("paneFrameIndex maps ordinal and ratio rules", () => {
    expect(paneFrameIndex(3, 7, 5, "frame-ordinal")).toBe(3)
    expect(paneFrameIndex(6, 7, 5, "frame-ordinal")).toBe(4)
    expect(paneFrameIndex(3, 7, 5, "completion-ratio")).toBe(2)
    expect(paneFrameIndex(6, 7, 5, "completion-ratio")).toBe(4)
    expect(paneFrameIndex(0, 1, 5, "completion-ratio")).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/components/diffusion-comparison.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement** (`registry/default/diffusion-comparison/diffusion-comparison.tsx`)

```tsx
import type { DiffusionTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionTraceProvider,
  useDiffusionPlayer,
  useDiffusionSnapshot,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"

export type ComparisonSyncRule = "frame-ordinal" | "completion-ratio"

export interface ComparisonPane {
  trace: DiffusionTrace
  /** Must be distinct between panes (used as the React key). */
  label: string
}

export interface DiffusionComparisonProps {
  panes: [ComparisonPane, ComparisonPane]
  defaultSyncRule?: ComparisonSyncRule
  /** Rendered inside each pane's DiffusionTraceProvider. */
  renderTrace?: (trace: DiffusionTrace) => ReactNode
  className?: string
}

/**
 * Maps the master position to a pane's frame index (spec §15.7).
 * frame-ordinal clamps to the pane length; completion-ratio maps the
 * master completion fraction onto the pane's own frame range.
 */
export function paneFrameIndex(
  masterIndex: number,
  masterCount: number,
  paneCount: number,
  rule: ComparisonSyncRule
): number {
  if (paneCount <= 0) return 0
  if (rule === "frame-ordinal") return Math.min(masterIndex, paneCount - 1)
  if (masterCount <= 1) return paneCount - 1
  const ratio = masterIndex / (masterCount - 1)
  return Math.round(ratio * (paneCount - 1))
}

const SYNC_RULE_LABELS: Record<ComparisonSyncRule, string> = {
  "frame-ordinal": "frame ordinal",
  "completion-ratio": "completion ratio",
}

function PaneSync({ frameIndex }: { frameIndex: number }) {
  const player = useDiffusionPlayer()
  useEffect(() => {
    player.seek(frameIndex)
  }, [player, frameIndex])
  return null
}

function PanePreview() {
  const snapshot = useDiffusionSnapshot()
  return (
    <div
      className="flex flex-wrap gap-1 rounded border p-2 font-mono text-xs"
      data-slot="comparison-pane"
    >
      {snapshot.slots.map((slot) => (
        <span
          className={cn(
            "rounded border px-1 py-0.5",
            slot.state === "masked" && "border-dashed text-muted-foreground",
            (slot.state === "committed" || slot.state === "fixed") &&
              "border-[var(--dllm-committed,#10b981)]",
            slot.state === "renoised" &&
              "border-[var(--dllm-renoised,#ef4444)] line-through",
            slot.state === "prompt" && "border-transparent bg-muted"
          )}
          data-state={slot.state}
          key={slot.slotId}
          title={`Slot ${slot.index}: ${slot.state}`}
        >
          {slot.state === "masked" ? "░░" : (slot.text ?? "·")}
        </span>
      ))}
    </div>
  )
}

const stepButtonClass =
  "inline-flex size-8 items-center justify-center rounded border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"

export function DiffusionComparison({
  panes,
  defaultSyncRule = "frame-ordinal",
  renderTrace,
  className,
}: DiffusionComparisonProps) {
  const [syncRule, setSyncRule] = useState<ComparisonSyncRule>(defaultSyncRule)
  const [masterIndex, setMasterIndex] = useState(0)
  const masterCount = Math.max(
    panes[0].trace.frames.length,
    panes[1].trace.frames.length
  )
  const clampedMaster = Math.min(masterIndex, masterCount - 1)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          aria-label="Previous step"
          className={stepButtonClass}
          onClick={() => setMasterIndex(Math.max(clampedMaster - 1, 0))}
          type="button"
        >
          <span aria-hidden>‹</span>
        </button>
        <button
          aria-label="Next step"
          className={stepButtonClass}
          onClick={() =>
            setMasterIndex(Math.min(clampedMaster + 1, masterCount - 1))
          }
          type="button"
        >
          <span aria-hidden>›</span>
        </button>
        <input
          aria-label="Comparison position"
          className="min-w-24 flex-1 accent-[var(--dllm-committed,#10b981)]"
          max={masterCount - 1}
          min={0}
          onChange={(event) => setMasterIndex(Number(event.target.value))}
          type="range"
          value={clampedMaster}
        />
        <label className="flex items-center gap-1 text-xs">
          Synchronization rule
          <select
            className="rounded border px-1 py-0.5"
            onChange={(event) =>
              setSyncRule(event.target.value as ComparisonSyncRule)
            }
            value={syncRule}
          >
            <option value="frame-ordinal">frame ordinal</option>
            <option value="completion-ratio">completion ratio</option>
          </select>
        </label>
      </div>
      <p className="font-mono text-muted-foreground text-xs">
        Synced by {SYNC_RULE_LABELS[syncRule]}.
        {syncRule === "frame-ordinal" &&
          " Equal ordinals are NOT equivalent steps."}
        {syncRule === "completion-ratio" &&
          " Positions are proportional — frames are not step-equivalent."}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {panes.map((pane) => {
          const paneCount = pane.trace.frames.length
          const frameIndex = paneFrameIndex(
            clampedMaster,
            masterCount,
            paneCount,
            syncRule
          )
          return (
            <figure className="flex flex-col gap-1" key={pane.label}>
              <figcaption className="flex items-baseline gap-2 text-sm">
                <span className="font-medium">{pane.label}</span>
                <span className="font-mono text-muted-foreground text-xs">
                  frame {frameIndex + 1}/{paneCount} ·{" "}
                  {pane.trace.provenance.mode}
                </span>
              </figcaption>
              <DiffusionTraceProvider trace={pane.trace}>
                <PaneSync frameIndex={frameIndex} />
                {renderTrace ? renderTrace(pane.trace) : <PanePreview />}
              </DiffusionTraceProvider>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
```

Note: each pane's provider owns an independent player; `PaneSync` seeks it whenever the computed pane index changes, so panes never share playback state and a pane can be scrubbed past its own end only by clamping. The custom-renderer test asserts `renderTrace` output renders **inside** the provider (it can call `useDiffusionSnapshot`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/components/diffusion-comparison.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Verify workspace, commit**

Run: `pnpm lint && pnpm typecheck && pnpm test` — expect PASS.

```bash
git add -A
git commit -m "feat(registry): DiffusionComparison with visible sync rule and non-equivalence guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Demo routes, registry items, performance smoke, final verification

**Files:**
- Create: `apps/web/src/routes/commit-heatmap-demo.tsx`, `apps/web/src/routes/candidate-distribution-demo.tsx`, `apps/web/src/routes/block-diffusion-canvas-demo.tsx`, `apps/web/src/routes/compare.tsx`, `packages/core/src/stats/perf.test.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/routes/home.tsx`, `scripts/build-registry.mjs`, `registry.json` (generated), `registry/default/lib/*` (generated)

**Interfaces:**
- Consumes: all four new components; fixtures + `generatePerformanceTrace` via `@/lib/dllm-viz-core`.
- Produces: routes `/components/commit-heatmap`, `/components/candidate-distribution`, `/components/block-diffusion-canvas`, `/compare` (spec §22); registry items `commit-heatmap`, `candidate-distribution`, `block-diffusion-canvas`, `diffusion-comparison` installable via `pnpm dlx shadcn@latest add nishide-dev/dllm-viz/<item>`; spec §21.6 performance smoke tests (Phase 2 exit criterion "dense heatmap performance fixture").

- [ ] **Step 1: Write the failing route tests** (append to `apps/web/src/App.test.tsx`, inside the existing `describe`)

```tsx
  it("renders the commit heatmap demo route", () => {
    renderAt("/components/commit-heatmap")
    expect(
      screen.getByRole("table", { name: "Commit heatmap" })
    ).toBeInTheDocument()
  })

  it("renders the candidate distribution demo route", () => {
    renderAt("/components/candidate-distribution")
    expect(screen.getByText(/candidates for s2/i)).toBeInTheDocument()
  })

  it("renders the block diffusion canvas demo route", () => {
    renderAt("/components/block-diffusion-canvas")
    expect(
      screen.getByRole("group", { name: "Block diffusion canvases" })
    ).toBeInTheDocument()
  })

  it("renders the compare route with a visible sync rule", () => {
    renderAt("/compare")
    expect(screen.getByLabelText("Synchronization rule")).toBeInTheDocument()
  })
```

Run: `pnpm --filter web exec vitest run src/App.test.tsx` — expect FAIL (routes missing).

- [ ] **Step 2: Create the route files**

`apps/web/src/routes/commit-heatmap-demo.tsx`:

```tsx
import {
  generatePerformanceTrace,
  maskedRemaskTrace,
} from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { CommitHeatmap } from "@/registry/default/commit-heatmap/commit-heatmap"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

// Generated once at module load; never shipped as JSON (spec §19.3).
const denseTrace = generatePerformanceTrace()

export function CommitHeatmapDemo() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="font-medium text-lg">CommitHeatmap</h1>
      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-sm">Linked DOM mode (small trace)</h2>
        <DiffusionSelectionProvider>
          <DiffusionTraceProvider trace={maskedRemaskTrace}>
            <DenoisingTokenCanvas />
            <CommitHeatmap />
            <DiffusionStepControls />
            <TraceInspector />
          </DiffusionTraceProvider>
        </DiffusionSelectionProvider>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-sm">
          Dense canvas mode (generated 256×512 benchmark trace)
        </h2>
        <DiffusionSelectionProvider>
          <DiffusionTraceProvider trace={denseTrace}>
            <CommitHeatmap />
            <DiffusionStepControls keyboard={false} />
          </DiffusionTraceProvider>
        </DiffusionSelectionProvider>
      </section>
    </div>
  )
}
```

`apps/web/src/routes/candidate-distribution-demo.tsx` (starts at frame 2 so the second `s2` distribution and its churn markers are visible immediately):

```tsx
import { confidenceCommitTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { CandidateDistribution } from "@/registry/default/candidate-distribution/candidate-distribution"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"

export function CandidateDistributionDemo() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">CandidateDistribution</h1>
      <DiffusionSelectionProvider defaultSelectedSlotId="s2">
        <DiffusionTraceProvider initialFrame={2} trace={confidenceCommitTrace}>
          <DenoisingTokenCanvas />
          <DiffusionStepControls />
          <CandidateDistribution />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    </div>
  )
}
```

`apps/web/src/routes/block-diffusion-canvas-demo.tsx`:

```tsx
import { blockCanvasTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { BlockDiffusionCanvas } from "@/registry/default/block-diffusion-canvas/block-diffusion-canvas"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

export function BlockDiffusionCanvasDemo() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">BlockDiffusionCanvas</h1>
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider trace={blockCanvasTrace}>
          <BlockDiffusionCanvas />
          <DiffusionStepControls />
          <TraceInspector />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    </div>
  )
}
```

`apps/web/src/routes/compare.tsx`:

```tsx
import { arBaselineTrace, confidenceCommitTrace } from "@/lib/dllm-viz-core"
import { DiffusionComparison } from "@/registry/default/diffusion-comparison/diffusion-comparison"

export function Compare() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">Compare</h1>
      <p className="max-w-prose text-sm leading-relaxed">
        Same prompt, two generation orders: confidence-ranked diffusion
        commits against a left-to-right autoregressive baseline. Both traces
        are hand-authored and labeled illustrative.
      </p>
      <DiffusionComparison
        panes={[
          {
            trace: confidenceCommitTrace,
            label: "Diffusion (confidence-ranked)",
          },
          { trace: arBaselineTrace, label: "Autoregressive baseline" },
        ]}
      />
    </div>
  )
}
```

- [ ] **Step 3: Register the routes and update the home nav**

`apps/web/src/App.tsx` (replace entirely):

```tsx
import { Route, Routes } from "react-router-dom"

import { BlockDiffusionCanvasDemo } from "@/routes/block-diffusion-canvas-demo"
import { CandidateDistributionDemo } from "@/routes/candidate-distribution-demo"
import { CommitHeatmapDemo } from "@/routes/commit-heatmap-demo"
import { Compare } from "@/routes/compare"
import { DenoisingTokenCanvasDemo } from "@/routes/denoising-token-canvas-demo"
import { Home } from "@/routes/home"

export function App() {
  return (
    <Routes>
      <Route element={<Home />} path="/" />
      <Route
        element={<DenoisingTokenCanvasDemo />}
        path="/components/denoising-token-canvas"
      />
      <Route
        element={<CommitHeatmapDemo />}
        path="/components/commit-heatmap"
      />
      <Route
        element={<CandidateDistributionDemo />}
        path="/components/candidate-distribution"
      />
      <Route
        element={<BlockDiffusionCanvasDemo />}
        path="/components/block-diffusion-canvas"
      />
      <Route element={<Compare />} path="/compare" />
    </Routes>
  )
}
```

In `apps/web/src/routes/home.tsx`, replace the single-item `<ul>` with:

```tsx
        <ul className="list-disc pl-5 text-sm">
          <li>
            <Link className="underline" to="/components/denoising-token-canvas">
              DenoisingTokenCanvas
            </Link>
          </li>
          <li>
            <Link className="underline" to="/components/commit-heatmap">
              CommitHeatmap
            </Link>
          </li>
          <li>
            <Link className="underline" to="/components/candidate-distribution">
              CandidateDistribution
            </Link>
          </li>
          <li>
            <Link className="underline" to="/components/block-diffusion-canvas">
              BlockDiffusionCanvas
            </Link>
          </li>
          <li>
            <Link className="underline" to="/compare">
              DiffusionComparison
            </Link>
          </li>
        </ul>
```

Run: `pnpm --filter web exec vitest run src/App.test.tsx` — expect PASS (6 tests).

- [ ] **Step 4: Performance smoke tests (spec §21.6)** (`packages/core/src/stats/perf.test.ts`)

```ts
import { describe, expect, it } from "vitest"

import { createPlayer } from "../player/player"
import { generatePerformanceTrace } from "../testing/generate"
import { buildCommitMatrix } from "./commit-matrix"

// Regression tripwires (spec §21.6): generous budgets that catch
// order-of-magnitude regressions — not FPS guarantees.
describe("performance smoke (256 slots × 512 frames × 10 ops)", () => {
  const trace = generatePerformanceTrace()

  it("generates the dense benchmark trace in bounded time", () => {
    const start = performance.now()
    generatePerformanceTrace({ seed: 43 })
    expect(performance.now() - start).toBeLessThan(2000)
  })

  it("builds the full commit matrix in bounded time", () => {
    const start = performance.now()
    const matrix = buildCommitMatrix(trace)
    const elapsed = performance.now() - start
    expect(matrix.states.length).toBe(256 * 512)
    expect(elapsed).toBeLessThan(1000)
  })

  it("checkpoint-seeded seeks across the dense trace stay bounded", () => {
    const player = createPlayer(trace)
    const start = performance.now()
    player.seek(511)
    player.seek(0)
    player.seek(256)
    player.seek(500)
    expect(performance.now() - start).toBeLessThan(1500)
    expect(player.frameIndex).toBe(500)
    player.dispose()
  })
})
```

Run: `pnpm --filter @dllm-viz/core exec vitest run src/stats/perf.test.ts` — expect PASS (3 tests).

- [ ] **Step 5: Add the four registry items**

In `scripts/build-registry.mjs`, append after the `trace-inspector` `componentItem(...)` entry (the `componentItem` helper already emits `nishide-dev/dllm-viz/<item>` registryDependencies — required, bare names 404):

```js
    componentItem(
      "commit-heatmap",
      "Commit Heatmap",
      "Position × time heatmap with DOM and Canvas rendering modes."
    ),
    componentItem(
      "candidate-distribution",
      "Candidate Distribution",
      "Ranked top-k candidates with entropy, margin, churn, and omitted mass."
    ),
    componentItem(
      "block-diffusion-canvas",
      "Block Diffusion Canvas",
      "Outer canvas progress with a nested active canvas and inner steps."
    ),
    componentItem(
      "diffusion-comparison",
      "Diffusion Comparison",
      "Synchronized side-by-side trace playback with an explicit sync rule."
    ),
```

Run: `pnpm registry:build`
Expected: `registry.json` now lists 9 items; `registry/default/lib` regenerates (now including `stats/commit-matrix.ts`, `testing/generate.ts`, and `selection.tsx`).

- [ ] **Step 6: Install smoke test (manual, once pushed)**

After merge + push, from a throwaway Vite app:

```bash
pnpm dlx shadcn@latest add nishide-dev/dllm-viz/commit-heatmap
pnpm dlx shadcn@latest add nishide-dev/dllm-viz/diffusion-comparison
```

Expected: components land in `components/`, lib deps in `lib/dllm-viz-core` + `lib/dllm-viz-react`, and the app compiles. Record the result in the PR description (Phase 2 exit criteria).

- [ ] **Step 7: Final verification**

Run: `pnpm registry:build && pnpm --filter @dllm-viz/core run fixtures && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS; `apps/web/dist` builds statically with the new routes; `git status` shows only intended generated-file changes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Phase 2 demo routes, registry items, and dense performance smoke tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage (Phase 2 deliverables, §24):** `CommitHeatmap` ✔ (T4–T5), `CandidateDistribution` ✔ (T6), `BlockDiffusionCanvas` ✔ (T7), synchronized selection ✔ (T3), comparison component ✔ (T8), larger trace handling ✔ (T1 generator + T2 checkpoint-seeded matrix + §21.6 smoke in T9). Exit criteria: correct block/canvas demo ✔ (T7 + T9 route, driven by `blockCanvasTrace`), dense heatmap performance fixture ✔ (T1 generator + T5 canvas mode + T9 perf tests + dense demo section), model/algorithm comparison demo ✔ (T8 + `/compare` route with same-prompt AR vs diffusion fixtures).
- **§15.4 coverage:** state/commit/remask/confidence encodings via `metric` + state colors/glyphs (renoised cells are visible remask events); DOM/SVG small + Canvas dense with configurable `domCellLimit` ✔; hover AND keyboard focus reveal exact values ✔ (DOM: aria-label/title + readout; Canvas: mousemove + arrow-key cursor + readout); linked cursor synchronized with player frame (aria-current column / painted column) and selection (row highlight) ✔. Entropy as a heatmap metric is not stored in `CommitMatrix` (SHOULD, not MUST) — noted as a follow-up; `metric` is a closed union so adding `"entropy"` later is non-breaking.
- **§15.5 coverage:** prompt/cache context, committed/active/future canvases, inner step, canvas commit boundary, active canvas visually nested (`data-slot="active-canvas-inner"`, tested) ✔.
- **§15.6 coverage:** ranked bars ✔, entropy/margin ✔, omitted mass MUST ✔ (recorded or derived-and-labeled), churn ✔. Per-candidate probability sparkline is a listed view but not a MUST and not in Phase 2 exit criteria — deliberately deferred; `distributionsForSlot` already exposes the data needed to add it.
- **§15.7 coverage:** two `DiffusionTraceProvider`s ✔, sync by frame ordinal or completion ratio ✔, selected rule visible (select + text line) ✔, non-equivalence guard text in both modes ✔.
- **§18/§17.3:** no color-only encoding anywhere (heatmap glyphs + readout, distribution % text next to bars, canvas-section borders + status text + data-status); single sr-only summaries, no per-token live regions; all interactions keyboard operable (DOM cells are buttons; canvas grid has a key-driven cell cursor; comparison uses native controls). New components introduce no animation, so there is no reduced-motion branch to add — existing `DenoisingTokenCanvas` transitions already honor `useReducedMotion`.
- **§19.2/§19.3:** DOM never used above `domCellLimit` (default 2000 cells); canvas backing store dpr-scaled (tested via stubbed `devicePixelRatio`); perf fixture generated, never committed/exported (export script comment + generator-only policy).
- **Type consistency (verified against current sources):** core exports `applyOperations(slots: TokenSlot[], …)`, `materializeSlots(trace, frameIndex)` (supports `-1`), `describeSnapshot`, `createPlayer`/`TracePlayer`, fixtures `maskedBasicTrace`/`maskedRemaskTrace` with `slot()`/`sharedMeta` helpers reused in T1; react exports `DiffusionTraceProvider`, `useDiffusionPlayer`, `useDiffusionSnapshot`, `useTokenSlots(): readonly TokenSlot[]`, `useTraceProvenance`, `useReducedMotion`, `useDiffusionKeyboard`; `DiffusionSnapshot.slots` is `readonly TokenSlot[]` — `buildCommitMatrix` takes the trace (not snapshot slots) and `computeCanvasSections` accepts `readonly TokenSlot[]`. `maskedRemaskTrace` numbers used in tests (7 frames, 6 slots, s3 = row 3, commit confidences 0.46/0.88, tokenId 232) match `packages/core/src/testing/fixtures.ts`. `build-registry.mjs` `componentItem` already emits `nishide-dev/dllm-viz/<item>` registryDependencies (PR #2 lesson) — new items reuse it unchanged.
- **Resolved ambiguities:**
  1. *AR baseline representation* — the schema has no autoregressive generation mode; modeled as `full-sequence` + `algorithm: "autoregressive-baseline"` + an illustrative annotation (spec §15.7 lists "autoregressive vs diffusion" as a comparison mode, so the trace protocol must carry it).
  2. *Canvas membership* — no per-slot canvas field exists; derived by chunking completion slots by `generation.canvasLength`, and the derivation is documented in `computeCanvasSections` (it is layout, not a trace claim, so no provenance badge per chunk).
  3. *Inner-step total* — not in the schema; derived as max observed `innerStep` per canvas with `generation.totalSteps` fallback.
  4. *"Checkpoint reuse" for `buildCommitMatrix`* — a full-trace build is already a single incremental pass (checkpoints cannot beat it); reuse is implemented where it helps: windowed builds seed via `materializeSlots(trace, startFrame - 1)`, proven by the poisoned-frame test.
  5. *Heatmap confidence semantics* — last `commit`/`set-token` confidence, kept through `renoise` (text stays visible), cleared by `mask`.
  6. *Cross-item component reuse* — `DiffusionComparison` takes a `renderTrace` prop plus a built-in preview instead of importing `DenoisingTokenCanvas`, because `@/registry/...` import rewriting is not guaranteed for custom registries on install; demos compose freely.
  7. *Selection precedence* — explicit prop (even `null`) beats context; omitted prop falls back — keeps every Phase 1 test green without prop changes.
  8. *jsdom + canvas* — `getContext` stubbed to return `null` in web test setup; the paint effect guards on it; all mapping is pure and unit-tested (`heatmapCellColor`, `cellFromPoint`, `buildCommitMatrix`).
- **Float32 precision** — `getMatrixCell` rounds confidences back to 4 decimals because `Float32Array` cannot represent values like 0.46; tests compare against source trace values (T2 note).
- **Known deferrals (not Phase 2 scope per §24):** entropy heatmap metric, candidate probability sparklines, `InfillingCanvas`/`SimplexTrajectory` (§15.8–15.9, Phase 4), live streaming client and `.gz` codec (Phase 3), Playwright cross-component browser tests and visual regression (§21.4–21.5 — the synchronized-selection behavior they would cover is unit-tested in T3), docs routes beyond the component gallery (spec §22 `/docs/*` and `/examples/*` routes remain future work; Phase 2 exit criteria require only the component/compare demos).
- **Test-count integrity:** every "Expected: PASS (n tests)" was counted against the `it()` blocks written in that task (T1: 7+5, T2: 9, T3: 4+2, T4: 8, T5: +7 → 15 in file, T6: 9, T7: 8, T8: 8, T9: +4 App tests → 6, perf 3).
