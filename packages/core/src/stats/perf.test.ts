import { describe, expect, it } from "vitest"

import { createPlayer } from "../player/player"
import type { DiffusionTrace } from "../schema/types"
import { generatePerformanceTrace } from "../testing/generate"
import { buildCommitMatrix } from "./commit-matrix"

// Regression tripwires (spec §21.6): generous budgets that catch
// order-of-magnitude regressions — not FPS guarantees.
describe("performance smoke (256 slots × 512 frames × 10 ops)", () => {
  const trace = generatePerformanceTrace()

  it("generates the dense benchmark trace in bounded time", () => {
    const start = Date.now()
    generatePerformanceTrace({ seed: 43 })
    expect(Date.now() - start).toBeLessThan(2000)
  })

  it("builds the full commit matrix in bounded time", () => {
    const start = Date.now()
    const matrix = buildCommitMatrix(trace)
    const elapsed = Date.now() - start
    expect(matrix.states.length).toBe(256 * 512)
    expect(elapsed).toBeLessThan(1000)
  })

  // Proof of mechanism: frame f10 (well before the first checkpoint at
  // f64) is poisoned with an op on a slot that never existed. Anything
  // that replays f10 against slot state throws — so checkpoint-seeded
  // paths succeed ONLY if they actually skip pre-checkpoint frames.
  const poisoned: DiffusionTrace = {
    ...trace,
    frames: trace.frames.map((frame) =>
      frame.frameId === "f10"
        ? { ...frame, operations: [{ type: "mask", slotId: "ghost" }] }
        : frame
    ),
  }

  it("checkpoint-seeded seeks skip poisoned pre-checkpoint frames", () => {
    const player = createPlayer(poisoned)
    // Materializing frame 20 must replay f10 from the initial slots.
    expect(() => player.seek(20)).toThrow(/ghost/)
    const start = Date.now()
    player.seek(511)
    player.seek(256)
    player.seek(500)
    expect(Date.now() - start).toBeLessThan(1500)
    expect(player.frameIndex).toBe(500)
    player.dispose()
  })

  it("windowed matrix builds seed from checkpoints at scale", () => {
    expect(() => buildCommitMatrix(poisoned)).toThrow(/ghost/)
    const start = Date.now()
    const windowed = buildCommitMatrix(poisoned, { startFrame: 256 })
    expect(Date.now() - start).toBeLessThan(1000)
    expect(windowed.frameCount).toBe(512 - 256)
  })
})
