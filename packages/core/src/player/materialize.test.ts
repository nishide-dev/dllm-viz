import { describe, expect, it } from "vitest"

import type { DiffusionTrace } from "../schema/types"
import { maskedBasicTrace, maskedRemaskTrace } from "../testing/fixtures"
import { materializeSlots } from "./materialize"

describe("materializeSlots", () => {
  it("returns initial slots for frameIndex -1", () => {
    expect(materializeSlots(maskedBasicTrace, -1)).toBe(
      maskedBasicTrace.initial.slots
    )
  })

  it("deterministically reconstructs the remask sequence for slot s3", () => {
    const stateAt = (i: number) =>
      materializeSlots(maskedRemaskTrace, i).find((s) => s.slotId === "s3")
    expect(stateAt(1)).toMatchObject({ state: "masked" })
    expect(stateAt(2)).toMatchObject({ state: "committed", text: " green" })
    expect(stateAt(3)).toMatchObject({ state: "renoised", text: " green" })
    expect(stateAt(4)).toMatchObject({ state: "masked" })
    expect(stateAt(5)).toMatchObject({ state: "committed", text: " blue" })
    expect(stateAt(6)).toMatchObject({ state: "fixed", text: " blue" })
  })

  it("final frame state matches trace.final text", () => {
    const slots = materializeSlots(
      maskedRemaskTrace,
      maskedRemaskTrace.frames.length - 1
    )
    const text = slots.map((s) => s.text ?? "").join("")
    expect(text).toBe(maskedRemaskTrace.final?.text)
  })

  it("seeks from the nearest checkpoint instead of frame zero", () => {
    // Poison frame f1 (ordinal 1, covered by checkpoint cp-1) with an
    // operation on a slot that never existed. If seek starts from the
    // checkpoint, f1 is skipped and materialization succeeds; a replay
    // from frame zero would throw on the unknown slot.
    const poisoned: DiffusionTrace = {
      ...maskedBasicTrace,
      frames: maskedBasicTrace.frames.map((frame) =>
        frame.frameId === "f1"
          ? {
              ...frame,
              operations: [{ type: "mask", slotId: "ghost" }],
            }
          : frame
      ),
    }
    expect(() => materializeSlots(poisoned, 3)).not.toThrow()
    expect(() => materializeSlots({ ...poisoned, checkpoints: [] }, 3)).toThrow(
      /ghost/
    )
  })

  it("checkpoint shortcut and full replay agree", () => {
    const withCp = materializeSlots(maskedBasicTrace, 3)
    const noCp = materializeSlots({ ...maskedBasicTrace, checkpoints: [] }, 3)
    expect(withCp).toEqual(noCp)
  })

  it("throws RangeError for out-of-range index", () => {
    expect(() => materializeSlots(maskedBasicTrace, 99)).toThrow(RangeError)
  })
})
