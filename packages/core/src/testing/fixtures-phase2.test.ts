import { describe, expect, it } from "vitest"

import { materializeSlots } from "../player/materialize"
import type { DiffusionTrace } from "../schema/types"
import { parseTrace } from "../schema/validate"
import {
  arBaselineTrace,
  blockCanvasTrace,
  confidenceCommitTrace,
} from "./fixtures"

const finalText = (trace: DiffusionTrace) =>
  materializeSlots(trace, trace.frames.length - 1)
    .map((s) => s.text ?? "")
    .join("")

describe("phase 2 fixtures", () => {
  it("all three fixtures pass schema validation", () => {
    expect(() => parseTrace(blockCanvasTrace)).not.toThrow()
    expect(() => parseTrace(confidenceCommitTrace)).not.toThrow()
    expect(() => parseTrace(arBaselineTrace)).not.toThrow()
  })

  it("all three fixtures are labeled illustrative (spec §23)", () => {
    expect(blockCanvasTrace.provenance.mode).toBe("illustrative")
    expect(confidenceCommitTrace.provenance.mode).toBe("illustrative")
    expect(arBaselineTrace.provenance.mode).toBe("illustrative")
  })

  it("block canvas trace exercises canvas geometry (spec §13)", () => {
    expect(blockCanvasTrace.geometry.generationMode).toBe("canvas-diffusion")
    const kinds = blockCanvasTrace.frames.map((f) => f.kind)
    expect(kinds.filter((k) => k === "canvas-start")).toHaveLength(2)
    expect(kinds.filter((k) => k === "canvas-commit")).toHaveLength(2)
    const inner = blockCanvasTrace.frames.filter(
      (f) => f.kind === "denoise" && f.canvasIndex !== undefined
    )
    expect(inner.length).toBeGreaterThan(0)
    for (const frame of inner) {
      expect(frame.innerStep).toBeGreaterThan(0)
    }
  })

  it("block canvas trace has a mid-trace checkpoint for seek tests", () => {
    expect(blockCanvasTrace.checkpoints?.length).toBeGreaterThan(0)
  })

  it("final frame reconstruction matches final.text for all three", () => {
    expect(finalText(blockCanvasTrace)).toBe(blockCanvasTrace.final?.text)
    expect(finalText(confidenceCommitTrace)).toBe(
      confidenceCommitTrace.final?.text
    )
    expect(finalText(arBaselineTrace)).toBe(arBaselineTrace.final?.text)
  })

  it("ar baseline commits strictly left-to-right, one slot per frame", () => {
    const commits = arBaselineTrace.frames.flatMap((f) =>
      f.operations.filter((o) => o.type === "commit")
    )
    expect(commits.map((o) => o.slotId)).toEqual(["s1", "s2", "s3"])
  })

  it("confidence-commit gives s2 two distributions with rank churn", () => {
    const dists = confidenceCommitTrace.frames
      .flatMap((f) => f.operations)
      .filter((o) => o.type === "set-distribution" && o.slotId === "s2")
    expect(dists).toHaveLength(2)
    const rankOf = (d: (typeof dists)[number], text: string) =>
      d.type === "set-distribution"
        ? d.candidates.find((c) => c.text === text)?.rank
        : undefined
    expect(rankOf(dists[0], " Nice")).toBe(2)
    expect(rankOf(dists[1], " Nice")).toBe(1)
  })
})
