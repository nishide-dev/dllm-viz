import { describe, expect, it } from "vitest"

import type { DiffusionTrace } from "../schema/types"
import { maskedBasicTrace, maskedRemaskTrace } from "../testing/fixtures"
import { generatePerformanceTrace } from "../testing/generate"
import {
  buildCommitMatrix,
  describeMatrixCell,
  getMatrixCell,
  MATRIX_ABSENT,
  TOKEN_STATE_CODES,
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
    const confidence = (frameIndex: number) =>
      getMatrixCell(m, { slotRow: 3, frameIndex }).confidence
    expect(confidence(2)).toBe(0.46)
    expect(confidence(3)).toBe(0.46) // renoise keeps it
    expect(confidence(4)).toBeUndefined() // mask clears
    expect(confidence(5)).toBe(0.88)
    expect(confidence(6)).toBe(0.88) // fixed keeps it
  })

  it("preserves exact source confidences (no rounding)", () => {
    // Slot s3's commit in frame f1 gets a confidence that a Float32Array
    // cannot represent exactly; the matrix must round-trip it as-is.
    const trace: DiffusionTrace = {
      ...maskedBasicTrace,
      checkpoints: [],
      frames: maskedBasicTrace.frames.map((frame) =>
        frame.frameId === "f1"
          ? {
              ...frame,
              operations: frame.operations.map((op) =>
                op.type === "commit" && op.slotId === "s3"
                  ? { ...op, confidence: 0.123456 }
                  : op
              ),
            }
          : frame
      ),
    }
    const m = buildCommitMatrix(trace)
    expect(getMatrixCell(m, { slotRow: 3, frameIndex: 1 }).confidence).toBe(
      0.123456
    )
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
        expect(
          getMatrixCell(windowed, { slotRow: row, frameIndex: frame })
        ).toEqual(getMatrixCell(full, { slotRow: row, frameIndex: frame }))
      }
    }
  })

  it("windowed and full builds agree on variable-length traces", () => {
    // Insert/delete ops both before and inside the window, so the two
    // builds derive different row ORDERS — cell content per slotId must
    // still agree for every shared slot.
    const resizing: DiffusionTrace = {
      ...maskedBasicTrace,
      traceId: "t-var-window",
      geometry: {
        ...maskedBasicTrace.geometry,
        generationMode: "variable-length",
      },
      checkpoints: [],
      initial: {
        checkpointId: "cp-init",
        frameOrdinal: -1,
        slots: [
          { slotId: "s0", index: 0, state: "masked", region: "completion" },
          { slotId: "s1", index: 1, state: "masked", region: "completion" },
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
              slots: [{ slotId: "s2", index: 1, state: "masked" }],
            },
          ],
        },
        {
          frameId: "f2",
          ordinal: 2,
          kind: "denoise",
          operations: [
            {
              type: "commit",
              slotId: "s1",
              tokenId: 1,
              text: " a",
              confidence: 0.7,
            },
          ],
        },
        {
          frameId: "f3",
          ordinal: 3,
          kind: "resize",
          operations: [{ type: "delete-slots", slotIds: ["s0"] }],
        },
        {
          frameId: "f4",
          ordinal: 4,
          kind: "resize",
          operations: [
            {
              type: "insert-slots",
              afterSlotId: "s1",
              slots: [{ slotId: "s3", index: 2, state: "masked" }],
            },
          ],
        },
        {
          frameId: "f5",
          ordinal: 5,
          kind: "denoise",
          operations: [
            {
              type: "commit",
              slotId: "s2",
              tokenId: 2,
              text: " b",
              confidence: 0.9,
            },
          ],
        },
      ],
    }
    const full = buildCommitMatrix(resizing)
    const windowed = buildCommitMatrix(resizing, { startFrame: 3, endFrame: 5 })
    for (const slotId of windowed.slotIds) {
      const fullRow = full.slotIds.indexOf(slotId)
      const windowedRow = windowed.slotIds.indexOf(slotId)
      expect(fullRow).toBeGreaterThanOrEqual(0)
      for (let frame = 3; frame <= 5; frame++) {
        expect(
          getMatrixCell(windowed, { slotRow: windowedRow, frameIndex: frame })
        ).toEqual(getMatrixCell(full, { slotRow: fullRow, frameIndex: frame }))
      }
    }
  })

  it("windowed builds seed from the nearest checkpoint (spec §9.13)", () => {
    // Same poisoning trick as the materialize tests: frame f1 (ordinal 1,
    // covered by checkpoint cp-1) references a slot that never existed.
    // A window starting after the checkpoint must not apply f1 to slot
    // state (confidence replay still scans it).
    const poisoned: DiffusionTrace = {
      ...maskedBasicTrace,
      frames: maskedBasicTrace.frames.map((frame) =>
        frame.frameId === "f1"
          ? { ...frame, operations: [{ type: "mask", slotId: "ghost" }] }
          : frame
      ),
    }
    expect(() => buildCommitMatrix(poisoned, { startFrame: 2 })).not.toThrow()
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
    expect(
      getMatrixCell(m, { slotRow: 0, frameIndex: 2 }).state
    ).toBeUndefined()
  })

  it("returns an empty matrix for a zero-frame trace (spec §21.3)", () => {
    const empty: DiffusionTrace = {
      ...maskedBasicTrace,
      traceId: "t-empty",
      frames: [],
      checkpoints: [],
      final: undefined,
    }
    const m = buildCommitMatrix(empty)
    expect(m.slotIds).toEqual(["s0", "s1", "s2", "s3", "s4"])
    expect(m.startFrame).toBe(0)
    expect(m.frameCount).toBe(0)
    expect(m.states).toHaveLength(0)
    expect(m.confidences).toHaveLength(0)
  })

  it("rejects an explicit window on a zero-frame trace with a clear error", () => {
    const empty: DiffusionTrace = {
      ...maskedBasicTrace,
      traceId: "t-empty",
      frames: [],
      checkpoints: [],
      final: undefined,
    }
    expect(() => buildCommitMatrix(empty, { startFrame: 0 })).toThrow(
      /no frames/
    )
  })

  it("rejects non-integer window bounds with a RangeError", () => {
    expect(() =>
      buildCommitMatrix(maskedBasicTrace, { startFrame: 2.5 })
    ).toThrow(RangeError)
    expect(() =>
      buildCommitMatrix(maskedBasicTrace, { endFrame: 1.5 })
    ).toThrow(RangeError)
  })

  it("getMatrixCell throws RangeError out of range", () => {
    const m = buildCommitMatrix(maskedRemaskTrace)
    expect(() => getMatrixCell(m, { slotRow: 99, frameIndex: 0 })).toThrow(
      RangeError
    )
    expect(() => getMatrixCell(m, { slotRow: 0, frameIndex: 99 })).toThrow(
      RangeError
    )
    const windowed = buildCommitMatrix(maskedRemaskTrace, { startFrame: 2 })
    expect(() =>
      getMatrixCell(windowed, { slotRow: 0, frameIndex: 1 })
    ).toThrow(RangeError)
  })

  it("describeMatrixCell renders the exact-value readout", () => {
    const m = buildCommitMatrix(maskedRemaskTrace)
    expect(
      describeMatrixCell(getMatrixCell(m, { slotRow: 3, frameIndex: 5 }))
    ).toBe("Slot s3, frame 6: committed, confidence 0.88")
    expect(
      describeMatrixCell(getMatrixCell(m, { slotRow: 3, frameIndex: 0 }))
    ).toBe("Slot s3, frame 1: masked")
  })

  it("handles the dense generated trace", () => {
    const trace = generatePerformanceTrace({ slotCount: 64, frameCount: 64 })
    const m = buildCommitMatrix(trace)
    expect(m.states).toHaveLength(64 * 64)
  })
})
