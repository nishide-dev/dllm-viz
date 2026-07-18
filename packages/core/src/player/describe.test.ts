import { describe, expect, it } from "vitest"

import { maskedRemaskTrace } from "../testing/fixtures"
import { describeSnapshot } from "./describe"
import { createPlayer } from "./player"

describe("describeSnapshot", () => {
  it("summarizes committed, masked, and remasked counts", () => {
    const p = createPlayer(maskedRemaskTrace)
    p.seek(3) // s3 renoised, s2/s4/s5 committed
    expect(describeSnapshot(p.getSnapshot(), p.frameCount)).toBe(
      "Step 4 of 7. 3 tokens committed, 0 masked, 1 remasked."
    )
  })
})
