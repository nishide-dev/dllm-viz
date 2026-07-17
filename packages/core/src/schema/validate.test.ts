import { describe, expect, it } from "vitest"

import type { DiffusionTrace } from "./types"
import { parseTrace, TraceValidationError } from "./validate"

function minimalTrace(): DiffusionTrace {
  return {
    schemaVersion: "0.1",
    traceId: "t-minimal",
    source: { adapter: "hand-authored" },
    geometry: {
      timeDomain: "discrete",
      stateSpace: "token",
      generationMode: "full-sequence",
    },
    generation: {},
    provenance: { mode: "illustrative" },
    initial: {
      checkpointId: "cp-initial",
      frameOrdinal: -1,
      slots: [
        {
          slotId: "s0",
          index: 0,
          state: "prompt",
          text: "Hi",
          region: "prompt",
        },
        { slotId: "s1", index: 1, state: "masked", region: "completion" },
      ],
    },
    frames: [
      { frameId: "f0", ordinal: 0, kind: "initial", operations: [] },
      {
        frameId: "f1",
        ordinal: 1,
        kind: "denoise",
        operations: [
          { type: "commit", slotId: "s1", tokenId: 42, text: " there" },
        ],
      },
    ],
  }
}

describe("parseTrace", () => {
  it("accepts a minimal valid trace and returns typed data", () => {
    const trace = parseTrace(minimalTrace())
    expect(trace.traceId).toBe("t-minimal")
    expect(trace.frames).toHaveLength(2)
  })

  it("preserves unknown optional fields (forward compat)", () => {
    const raw = { ...minimalTrace(), futureField: { x: 1 } }
    const trace = parseTrace(raw) as unknown as Record<string, unknown>
    expect(trace.futureField).toEqual({ x: 1 })
  })

  it("rejects a wrong schemaVersion", () => {
    expect(() =>
      parseTrace({ ...minimalTrace(), schemaVersion: "9.9" })
    ).toThrow(TraceValidationError)
  })

  it("rejects an initial checkpoint whose frameOrdinal is not -1", () => {
    const raw = minimalTrace()
    raw.initial.frameOrdinal = 0
    expect(() => parseTrace(raw)).toThrow(/frameOrdinal/)
  })

  it("rejects non-increasing frame ordinals", () => {
    const raw = minimalTrace()
    raw.frames[1].ordinal = 0
    expect(() => parseTrace(raw)).toThrow(/ordinal/)
  })

  it("rejects duplicate frame ids", () => {
    const raw = minimalTrace()
    raw.frames[1].frameId = "f0"
    expect(() => parseTrace(raw)).toThrow(/frameId/)
  })

  it("rejects duplicate slot ids in a checkpoint", () => {
    const raw = minimalTrace()
    raw.initial.slots[1].slotId = "s0"
    expect(() => parseTrace(raw)).toThrow(/slotId/)
  })

  it("enforces configurable limits", () => {
    expect(() => parseTrace(minimalTrace(), { maxFrames: 1 })).toThrow(
      /maxFrames/
    )
    expect(() => parseTrace(minimalTrace(), { maxSlots: 1 })).toThrow(
      /maxSlots/
    )
  })
})
