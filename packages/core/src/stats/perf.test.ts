import { describe, expect, it } from "vitest"

import { createPlayer } from "../player/player"
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

  it("checkpoint-seeded seeks across the dense trace stay bounded", () => {
    const player = createPlayer(trace)
    const start = Date.now()
    player.seek(511)
    player.seek(0)
    player.seek(256)
    player.seek(500)
    expect(Date.now() - start).toBeLessThan(1500)
    expect(player.frameIndex).toBe(500)
    player.dispose()
  })
})
