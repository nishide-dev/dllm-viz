import { describe, expect, it } from "vitest"

import { parseTrace } from "../schema/validate"
import { generatePerformanceTrace } from "./generate"

describe("generatePerformanceTrace", () => {
  it("is deterministic for the same seed (no Math.random)", () => {
    const a = generatePerformanceTrace({ slotCount: 16, frameCount: 32 })
    const b = generatePerformanceTrace({ slotCount: 16, frameCount: 32 })
    expect(a).toEqual(b)
  })

  it("different seeds produce different operations", () => {
    const a = generatePerformanceTrace({
      slotCount: 16,
      frameCount: 32,
      seed: 1,
    })
    const b = generatePerformanceTrace({
      slotCount: 16,
      frameCount: 32,
      seed: 2,
    })
    expect(a.frames).not.toEqual(b.frames)
  })

  it("output passes schema validation", () => {
    const trace = generatePerformanceTrace({ slotCount: 32, frameCount: 64 })
    expect(() => parseTrace(trace)).not.toThrow()
    expect(trace.provenance.mode).toBe("illustrative")
  })

  it("defaults match the spec §21.6 benchmark shape", () => {
    const trace = generatePerformanceTrace()
    expect(trace.initial.slots).toHaveLength(256)
    expect(trace.frames).toHaveLength(512)
    expect(trace.frames[1].operations).toHaveLength(10)
    // checkpoints every 64 frames: ordinals 64, 128, …, 448
    expect(trace.checkpoints?.map((c) => c.frameOrdinal)).toEqual([
      64, 128, 192, 256, 320, 384, 448,
    ])
  })

  it("respects custom options", () => {
    const trace = generatePerformanceTrace({
      slotCount: 12,
      frameCount: 20,
      opsPerFrame: 3,
      checkpointInterval: 8,
      seed: 7,
    })
    expect(trace.initial.slots).toHaveLength(12)
    expect(trace.frames).toHaveLength(20)
    expect(trace.frames[5].operations).toHaveLength(3)
    expect(trace.checkpoints?.map((c) => c.frameOrdinal)).toEqual([8, 16])
  })
})
