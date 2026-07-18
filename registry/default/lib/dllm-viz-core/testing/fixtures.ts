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
 * Prompt "Q: color of grass?" then commits " Grass", " is", " green", "."
 * two per frame, with a mid-trace checkpoint after frame ordinal 1.
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
