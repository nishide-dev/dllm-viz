import { describe, expect, it } from "vitest"

import type { TokenSlot } from "../schema/types"
import { applyOperations } from "./apply"

const base = (): TokenSlot[] => [
  { slotId: "s0", index: 0, state: "prompt", text: "Hi", region: "prompt" },
  { slotId: "s1", index: 1, state: "masked", region: "completion" },
  { slotId: "s2", index: 2, state: "masked", region: "completion" },
]

describe("applyOperations", () => {
  it("commit sets token, text, and committed state", () => {
    const out = applyOperations(base(), [
      { type: "commit", slotId: "s1", tokenId: 7, text: " yo" },
    ])
    expect(out[1]).toMatchObject({
      tokenId: 7,
      text: " yo",
      state: "committed",
    })
  })

  it("does not mutate input and keeps untouched slot identity", () => {
    const input = base()
    const out = applyOperations(input, [
      { type: "commit", slotId: "s1", tokenId: 7 },
    ])
    expect(input[1].state).toBe("masked")
    expect(out[0]).toBe(input[0])
    expect(out[2]).toBe(input[2])
  })

  it("mask clears token and text", () => {
    const withToken = applyOperations(base(), [
      { type: "commit", slotId: "s1", tokenId: 7, text: " yo" },
    ])
    const out = applyOperations(withToken, [{ type: "mask", slotId: "s1" }])
    expect(out[1].state).toBe("masked")
    expect(out[1].tokenId).toBeUndefined()
    expect(out[1].text).toBeUndefined()
  })

  it("renoise marks state but keeps text visible", () => {
    const withToken = applyOperations(base(), [
      { type: "commit", slotId: "s1", tokenId: 7, text: " yo" },
    ])
    const out = applyOperations(withToken, [
      { type: "renoise", slotId: "s1", previousTokenId: 7 },
    ])
    expect(out[1].state).toBe("renoised")
    expect(out[1].text).toBe(" yo")
  })

  it("set-token only touches provided fields", () => {
    const out = applyOperations(base(), [
      { type: "set-token", slotId: "s0", state: "fixed" },
    ])
    expect(out[0]).toMatchObject({ state: "fixed", text: "Hi" })
  })

  it("insert-slots inserts after anchor and reindexes", () => {
    const out = applyOperations(base(), [
      {
        type: "insert-slots",
        afterSlotId: "s0",
        slots: [{ slotId: "s3", index: 0, state: "masked" }],
      },
    ])
    expect(out.map((s) => s.slotId)).toEqual(["s0", "s3", "s1", "s2"])
    expect(out.map((s) => s.index)).toEqual([0, 1, 2, 3])
  })

  it("delete-slots removes and reindexes", () => {
    const out = applyOperations(base(), [
      { type: "delete-slots", slotIds: ["s1"] },
    ])
    expect(out.map((s) => s.slotId)).toEqual(["s0", "s2"])
    expect(out.map((s) => s.index)).toEqual([0, 1])
  })

  it("set-distribution does not change slots", () => {
    const input = base()
    const out = applyOperations(input, [
      {
        type: "set-distribution",
        slotId: "s1",
        candidates: [{ text: " a", probability: 0.5, rank: 0 }],
      },
    ])
    expect(out).toEqual(input)
  })

  it("insert-slots prepends when afterSlotId is undefined", () => {
    const out = applyOperations(base(), [
      {
        type: "insert-slots",
        slots: [{ slotId: "s3", index: 0, state: "masked" }],
      },
    ])
    expect(out.map((s) => s.slotId)).toEqual(["s3", "s0", "s1", "s2"])
    expect(out.map((s) => s.index)).toEqual([0, 1, 2, 3])
  })

  it("insert-slots throws on a duplicate slotId", () => {
    expect(() =>
      applyOperations(base(), [
        {
          type: "insert-slots",
          afterSlotId: "s0",
          slots: [{ slotId: "s1", index: 0, state: "masked" }],
        },
      ])
    ).toThrow(/duplicate slotId "s1"/)
    expect(() =>
      applyOperations(base(), [
        {
          type: "insert-slots",
          slots: [
            { slotId: "s3", index: 0, state: "masked" },
            { slotId: "s3", index: 1, state: "masked" },
          ],
        },
      ])
    ).toThrow(/duplicate slotId "s3"/)
  })

  it("move-slot moves forward, backward, and to the front", () => {
    const forward = applyOperations(base(), [
      { type: "move-slot", slotId: "s0", afterSlotId: "s1" },
    ])
    expect(forward.map((s) => s.slotId)).toEqual(["s1", "s0", "s2"])
    expect(forward.map((s) => s.index)).toEqual([0, 1, 2])

    const backward = applyOperations(base(), [
      { type: "move-slot", slotId: "s2", afterSlotId: "s0" },
    ])
    expect(backward.map((s) => s.slotId)).toEqual(["s0", "s2", "s1"])

    const toFront = applyOperations(base(), [
      { type: "move-slot", slotId: "s2" },
    ])
    expect(toFront.map((s) => s.slotId)).toEqual(["s2", "s0", "s1"])
  })

  it("throws on unknown slotId", () => {
    expect(() =>
      applyOperations(base(), [{ type: "mask", slotId: "nope" }])
    ).toThrow(/nope/)
  })

  it("throws on an unknown operation type from untyped input", () => {
    const bogus = { type: "explode", slotId: "s0" } as unknown as Parameters<
      typeof applyOperations
    >[1][0]
    expect(() => applyOperations(base(), [bogus])).toThrow(
      /unknown operation type "explode"/
    )
  })
})
