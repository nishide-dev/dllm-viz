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
