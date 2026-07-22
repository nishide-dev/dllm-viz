import { describe, expect, it } from "vitest"

import { materializeSlots } from "../player/materialize"
import { parseTrace } from "../schema/validate"
import { chatRemaskTrace } from "./fixtures"

const slotNumber = (slotId: string) => Number(slotId.slice(1))

describe("chatRemaskTrace", () => {
  it("passes schema validation and is labeled illustrative (spec §23)", () => {
    expect(() => parseTrace(chatRemaskTrace)).not.toThrow()
    expect(chatRemaskTrace.provenance.mode).toBe("illustrative")
  })

  it("has one prompt slot and 28 masked completion slots", () => {
    const slots = chatRemaskTrace.initial.slots
    expect(slots).toHaveLength(29)
    expect(slots[0]).toMatchObject({ slotId: "s0", state: "prompt" })
    expect(chatRemaskTrace.prompt?.slotIds).toEqual(["s0"])
    expect(slots.slice(1).every((slot) => slot.state === "masked")).toBe(true)
  })

  it("commits confidence-ranked, not left-to-right", () => {
    const commitOrder = chatRemaskTrace.frames.flatMap((frame) =>
      frame.operations
        .filter((op) => op.type === "commit")
        .map((op) => op.slotId)
    )
    // The very first commit is the sentence-final period (highest
    // confidence), and the overall order is not index order.
    expect(commitOrder[0]).toBe("s28")
    expect(commitOrder).not.toEqual(
      [...commitOrder].sort((a, b) => slotNumber(a) - slotNumber(b))
    )
    // Every completion slot is committed at least once.
    expect(new Set(commitOrder).size).toBe(28)
  })

  it("showcase slot s20 is distributed, committed, renoised, masked, and recommitted with a different token", () => {
    const showcaseOps = chatRemaskTrace.frames
      .flatMap((frame) => frame.operations)
      .filter((op) => "slotId" in op && op.slotId === "s20")
    expect(showcaseOps.map((op) => op.type)).toEqual([
      "set-distribution",
      "commit",
      "renoise",
      "mask",
      "set-distribution",
      "commit",
      "set-token",
    ])
    const commits = showcaseOps.filter((op) => op.type === "commit")
    expect(commits[0]).toMatchObject({ tokenId: 601, text: " regenerated" })
    expect(commits[1]).toMatchObject({ tokenId: 520, text: " resampled" })
  })

  it("final frame reconstruction matches final.text", () => {
    const text = materializeSlots(
      chatRemaskTrace,
      chatRemaskTrace.frames.length - 1
    )
      .map((slot) => slot.text ?? "")
      .join("")
    expect(text).toBe(chatRemaskTrace.final?.text)
  })

  it("the final frame fixes all 28 completion slots", () => {
    const last = chatRemaskTrace.frames.at(-1)
    expect(last?.kind).toBe("final")
    expect(last?.operations).toHaveLength(28)
    expect(
      last?.operations.every(
        (op) => op.type === "set-token" && op.state === "fixed"
      )
    ).toBe(true)
  })
})
