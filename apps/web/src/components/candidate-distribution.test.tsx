import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { DiffusionTrace } from "@/lib/dllm-viz-core"
import { confidenceCommitTrace, maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { CandidateDistribution } from "@/registry/default/candidate-distribution/candidate-distribution"

const renderAt = (
  trace: DiffusionTrace,
  frame: number,
  slotId?: string | null
) =>
  render(
    <DiffusionTraceProvider initialFrame={frame} trace={trace}>
      <CandidateDistribution slotId={slotId} />
    </DiffusionTraceProvider>
  )

describe("CandidateDistribution", () => {
  it("prompts for a selection when nothing is selected", () => {
    renderAt(confidenceCommitTrace, 1, null)
    expect(screen.getByText(/select a token slot/i)).toBeInTheDocument()
  })

  it("renders ranked bars with probabilities as text", () => {
    renderAt(confidenceCommitTrace, 1, "s2")
    const list = screen.getByRole("list", { name: "Ranked candidates" })
    const rows = within(list).getAllByRole("listitem")
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent("Paris")
    expect(rows[0]).toHaveTextContent("55%")
    expect(rows[2]).toHaveTextContent("10%")
  })

  it("always shows omitted probability mass (spec §15.6 MUST)", () => {
    renderAt(confidenceCommitTrace, 1, "s2")
    expect(screen.getByText(/omitted mass — 15%/)).toBeInTheDocument()
  })

  it("shows entropy and top-1/top-2 margin", () => {
    renderAt(confidenceCommitTrace, 1, "s2")
    expect(screen.getByText("1.42")).toBeInTheDocument()
    expect(screen.getByText("0.35")).toBeInTheDocument()
  })

  it("marks candidate churn between successive distributions", () => {
    renderAt(confidenceCommitTrace, 2, "s2")
    const list = screen.getByRole("list", { name: "Ranked candidates" })
    const rows = within(list).getAllByRole("listitem")
    expect(rows[1]).toHaveTextContent("Nice")
    expect(rows[1]).toHaveTextContent("↑1")
    expect(rows[2]).toHaveTextContent("Lyon")
    expect(rows[2]).toHaveTextContent("↓1")
  })

  it("derives omitted mass when the field is absent and labels it derived", () => {
    const stripped: DiffusionTrace = structuredClone(confidenceCommitTrace)
    for (const frame of stripped.frames) {
      for (const op of frame.operations) {
        if (op.type === "set-distribution") op.omittedMass = undefined
      }
    }
    renderAt(stripped, 1, "s2")
    // 1 − (0.55 + 0.2 + 0.1) = 15%
    const row = screen.getByText(/omitted mass — 15%/).closest("p")
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText("derived")).toBeInTheDocument()
  })

  it("does not show a superseded pre-remask distribution (spec §15.1)", () => {
    renderAt(maskedRemaskTrace, 5, "s3")
    expect(screen.getByText(/no current distribution/i)).toBeInTheDocument()
  })

  it("shows the pre-remask distribution while it is still current", () => {
    renderAt(maskedRemaskTrace, 2, "s3")
    expect(screen.getByText("46%")).toBeInTheDocument()
  })

  it("falls back to the shared selection context", () => {
    render(
      <DiffusionSelectionProvider defaultSelectedSlotId="s2">
        <DiffusionTraceProvider initialFrame={1} trace={confidenceCommitTrace}>
          <CandidateDistribution />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )
    expect(screen.getByText(/candidates for s2/i)).toBeInTheDocument()
  })
})
