import type { DiffusionTrace, TokenSlot } from "../schema/types"

function slot(
  slotId: string,
  index: number,
  partial: Partial<TokenSlot> = {}
): TokenSlot {
  return { slotId, index, state: "masked", region: "completion", ...partial }
}

const sharedMeta = {
  schemaVersion: "0.1",
  createdAt: "2026-07-18T00:00:00Z",
  source: { adapter: "hand-authored", adapterVersion: "0.0.1" },
  geometry: {
    timeDomain: "discrete",
    stateSpace: "token",
    generationMode: "full-sequence",
  },
  provenance: {
    mode: "illustrative",
    notes: ["Hand-authored for demos and tests. Not real model output."],
  },
} satisfies Partial<DiffusionTrace>

/**
 * Masked diffusion where visible tokens are never revised.
 * Prompt "Q: color of grass?" then commits " green" and "." (frame 1)
 * followed by " Grass" and " is" (frame 2) — deliberately not
 * left-to-right — with a mid-trace checkpoint after frame ordinal 1.
 */
export const maskedBasicTrace: DiffusionTrace = {
  ...sharedMeta,
  traceId: "fixture-masked-basic",
  generation: { algorithm: "illustrative-topk", totalSteps: 3 },
  prompt: { text: "Q: color of grass?", slotIds: ["s0"] },
  initial: {
    checkpointId: "cp-init",
    frameOrdinal: -1,
    slots: [
      slot("s0", 0, {
        state: "prompt",
        region: "prompt",
        text: "Q: color of grass?",
      }),
      slot("s1", 1),
      slot("s2", 2),
      slot("s3", 3),
      slot("s4", 4),
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
          type: "commit",
          slotId: "s3",
          tokenId: 103,
          text: " green",
          confidence: 0.94,
        },
        {
          type: "commit",
          slotId: "s4",
          tokenId: 104,
          text: ".",
          confidence: 0.99,
        },
      ],
      metrics: { maskedCount: 2, maskRatio: 0.5, committedThisFrame: 2 },
    },
    {
      frameId: "f2",
      ordinal: 2,
      kind: "denoise",
      step: 2,
      operations: [
        {
          type: "commit",
          slotId: "s1",
          tokenId: 101,
          text: " Grass",
          confidence: 0.88,
        },
        {
          type: "commit",
          slotId: "s2",
          tokenId: 102,
          text: " is",
          confidence: 0.91,
        },
      ],
      metrics: { maskedCount: 0, maskRatio: 0, committedThisFrame: 2 },
    },
    {
      frameId: "f3",
      ordinal: 3,
      kind: "final",
      step: 3,
      operations: [
        { type: "set-token", slotId: "s1", state: "fixed" },
        { type: "set-token", slotId: "s2", state: "fixed" },
        { type: "set-token", slotId: "s3", state: "fixed" },
        { type: "set-token", slotId: "s4", state: "fixed" },
      ],
    },
  ],
  checkpoints: [
    {
      checkpointId: "cp-1",
      frameOrdinal: 1,
      slots: [
        slot("s0", 0, {
          state: "prompt",
          region: "prompt",
          text: "Q: color of grass?",
        }),
        slot("s1", 1),
        slot("s2", 2),
        slot("s3", 3, {
          state: "committed",
          tokenId: 103,
          text: " green",
        }),
        slot("s4", 4, { state: "committed", tokenId: 104, text: "." }),
      ],
    },
  ],
  final: {
    text: "Q: color of grass? Grass is green.",
    finishReason: "completed",
  },
}

/**
 * Remasking scenario (spec §15.1 acceptance): slot s3 is committed as
 * " green", renoised, remasked, then committed as " blue".
 */
export const maskedRemaskTrace: DiffusionTrace = {
  ...sharedMeta,
  traceId: "fixture-masked-remask",
  generation: {
    algorithm: "illustrative-remdm",
    totalSteps: 6,
    remaskingStrategy: "loop",
    confidenceType: "max-prob",
  },
  prompt: { text: "The sky is", slotIds: ["s0", "s1"] },
  initial: {
    checkpointId: "cp-init",
    frameOrdinal: -1,
    slots: [
      slot("s0", 0, {
        state: "prompt",
        region: "prompt",
        text: "The sky",
      }),
      slot("s1", 1, { state: "prompt", region: "prompt", text: " is" }),
      slot("s2", 2),
      slot("s3", 3),
      slot("s4", 4),
      slot("s5", 5),
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
          type: "commit",
          slotId: "s4",
          tokenId: 204,
          text: " today",
          confidence: 0.92,
        },
        {
          type: "commit",
          slotId: "s5",
          tokenId: 205,
          text: ".",
          confidence: 0.97,
        },
      ],
      metrics: { maskedCount: 2, maskRatio: 0.5, committedThisFrame: 2 },
    },
    {
      frameId: "f2",
      ordinal: 2,
      kind: "denoise",
      step: 2,
      operations: [
        {
          type: "commit",
          slotId: "s2",
          tokenId: 202,
          text: " very",
          confidence: 0.81,
        },
        {
          type: "set-distribution",
          slotId: "s3",
          candidates: [
            { tokenId: 231, text: " green", probability: 0.46, rank: 0 },
            { tokenId: 232, text: " blue", probability: 0.41, rank: 1 },
            { tokenId: 233, text: " gray", probability: 0.08, rank: 2 },
          ],
          entropy: 1.02,
          margin: 0.05,
          omittedMass: 0.05,
        },
        {
          type: "commit",
          slotId: "s3",
          tokenId: 231,
          text: " green",
          confidence: 0.46,
        },
      ],
      metrics: { maskedCount: 0, maskRatio: 0, committedThisFrame: 2 },
    },
    {
      frameId: "f3",
      ordinal: 3,
      kind: "renoise",
      step: 3,
      operations: [
        {
          type: "renoise",
          slotId: "s3",
          previousTokenId: 231,
          score: 0.41,
          reason: "low joint confidence",
        },
      ],
      metrics: { remaskedThisFrame: 1 },
    },
    {
      frameId: "f4",
      ordinal: 4,
      kind: "denoise",
      step: 4,
      operations: [{ type: "mask", slotId: "s3", previousTokenId: 231 }],
      metrics: { maskedCount: 1, maskRatio: 0.25 },
    },
    {
      frameId: "f5",
      ordinal: 5,
      kind: "denoise",
      step: 5,
      operations: [
        {
          type: "commit",
          slotId: "s3",
          tokenId: 232,
          text: " blue",
          confidence: 0.88,
        },
      ],
      metrics: { maskedCount: 0, maskRatio: 0, committedThisFrame: 1 },
    },
    {
      frameId: "f6",
      ordinal: 6,
      kind: "final",
      step: 6,
      operations: [
        { type: "set-token", slotId: "s2", state: "fixed" },
        { type: "set-token", slotId: "s3", state: "fixed" },
        { type: "set-token", slotId: "s4", state: "fixed" },
        { type: "set-token", slotId: "s5", state: "fixed" },
      ],
    },
  ],
  final: { text: "The sky is very blue today.", finishReason: "completed" },
}

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
        {
          type: "commit",
          slotId: "s2",
          tokenId: 402,
          text: " red",
          confidence: 0.9,
        },
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
        {
          type: "commit",
          slotId: "s1",
          tokenId: 401,
          text: " One:",
          confidence: 0.85,
        },
        {
          type: "commit",
          slotId: "s3",
          tokenId: 403,
          text: ",",
          confidence: 0.96,
        },
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
        {
          type: "commit",
          slotId: "s6",
          tokenId: 406,
          text: ".",
          confidence: 0.98,
        },
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
        {
          type: "commit",
          slotId: "s4",
          tokenId: 404,
          text: " Two:",
          confidence: 0.88,
        },
        {
          type: "commit",
          slotId: "s5",
          tokenId: 405,
          text: " blue",
          confidence: 0.92,
        },
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
        {
          type: "commit",
          slotId: "s3",
          tokenId: 304,
          text: ".",
          confidence: 0.97,
          selectionRank: 0,
        },
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
        {
          type: "commit",
          slotId: "s2",
          tokenId: 301,
          text: " Paris",
          confidence: 0.82,
          selectionRank: 0,
        },
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
        {
          type: "commit",
          slotId: "s1",
          tokenId: 306,
          text: " is",
          confidence: 0.74,
          selectionRank: 0,
        },
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
        {
          type: "commit",
          slotId: "s1",
          tokenId: 306,
          text: " is",
          confidence: 0.91,
        },
      ],
      metrics: { maskedCount: 2, committedThisFrame: 1 },
    },
    {
      frameId: "f2",
      ordinal: 2,
      kind: "denoise",
      step: 2,
      operations: [
        {
          type: "commit",
          slotId: "s2",
          tokenId: 301,
          text: " Paris",
          confidence: 0.95,
        },
      ],
      metrics: { maskedCount: 1, committedThisFrame: 1 },
    },
    {
      frameId: "f3",
      ordinal: 3,
      kind: "denoise",
      step: 3,
      operations: [
        {
          type: "commit",
          slotId: "s3",
          tokenId: 304,
          text: ".",
          confidence: 0.99,
        },
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
