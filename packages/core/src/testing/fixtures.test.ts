import { describe, expect, it } from "vitest"

import { parseTrace } from "../schema/validate"
import { maskedBasicTrace, maskedRemaskTrace } from "./fixtures"

describe("fixtures", () => {
  it("both fixtures pass schema validation", () => {
    expect(() => parseTrace(maskedBasicTrace)).not.toThrow()
    expect(() => parseTrace(maskedRemaskTrace)).not.toThrow()
  })

  it("fixtures are labeled illustrative (spec §23)", () => {
    expect(maskedBasicTrace.provenance.mode).toBe("illustrative")
    expect(maskedRemaskTrace.provenance.mode).toBe("illustrative")
  })

  it("masked-remask exercises mask → token → mask → different token", () => {
    const ops = maskedRemaskTrace.frames.flatMap((f) => f.operations)
    const s3 = ops.filter((o) => "slotId" in o && o.slotId === "s3")
    const kinds = s3.map((o) => o.type)
    expect(kinds).toEqual([
      "set-distribution",
      "commit",
      "renoise",
      "mask",
      "commit",
      "set-token",
    ])
  })

  it("masked-basic has a mid-trace checkpoint for seek tests", () => {
    expect(maskedBasicTrace.checkpoints?.length).toBeGreaterThan(0)
  })
})
