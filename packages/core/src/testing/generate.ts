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
  /**
   * A checkpoint is emitted every N frames. Default 64 — spec §9.13
   * recommends 32; a wider interval suffices for the synthetic benchmark.
   */
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
    frames.push({
      frameId: `f${f}`,
      ordinal: f,
      kind: "denoise",
      step: f,
      operations,
    })
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
    generation: {
      algorithm: "generated-lcg",
      totalSteps: frameCount - 1,
      seed,
    },
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
