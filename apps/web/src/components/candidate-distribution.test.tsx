import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type {
  DiffusionTrace,
  SetDistributionOperation,
} from "@/lib/dllm-viz-core"
import { confidenceCommitTrace, maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import {
  CandidateDistribution,
  churnMarker,
} from "@/registry/default/candidate-distribution/candidate-distribution"
import { oneFrameTrace, zeroFrameTrace } from "@/test/streaming-traces"

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

  it("shows omitted mass as unknown when it cannot be derived", () => {
    const stripped: DiffusionTrace = structuredClone(confidenceCommitTrace)
    for (const frame of stripped.frames) {
      for (const op of frame.operations) {
        if (op.type === "set-distribution") {
          op.omittedMass = undefined
          op.candidates[0].probability = undefined
        }
      }
    }
    renderAt(stripped, 1, "s2")
    expect(screen.getByText(/omitted mass — unknown/)).toBeInTheDocument()
  })

  it("warns when the distribution does not sum to 1", () => {
    const inflated: DiffusionTrace = structuredClone(confidenceCommitTrace)
    const op = inflated.frames[1].operations[0]
    if (op.type !== "set-distribution") throw new Error("fixture changed")
    op.omittedMass = undefined
    op.candidates[0].probability = 0.8
    op.candidates[1].probability = 0.4
    op.candidates[2].probability = 0.2 // Σp = 1.4
    renderAt(inflated, 1, "s2")
    expect(
      screen.getByText(/distribution does not sum to 1/i)
    ).toBeInTheDocument()
  })

  it("does not warn when the distribution is consistent", () => {
    renderAt(confidenceCommitTrace, 1, "s2")
    expect(
      screen.queryByText(/distribution does not sum to 1/i)
    ).not.toBeInTheDocument()
  })

  it("renders zero-frame and one-frame traces without crashing (spec §21.3)", () => {
    const { unmount } = renderAt(zeroFrameTrace, 0, "s2")
    expect(screen.getByText(/no current distribution/i)).toBeInTheDocument()
    unmount()
    renderAt(oneFrameTrace, 0, "s2")
    expect(screen.getByText(/no current distribution/i)).toBeInTheDocument()
  })

  it("churnMarker never matches candidates lacking both tokenId and text", () => {
    const previous: SetDistributionOperation = {
      type: "set-distribution",
      slotId: "s2",
      candidates: [{ rank: 0 }],
    }
    // Neither side is identifiable — no marker rather than a bogus match.
    expect(churnMarker({ rank: 1 }, previous)).toBeNull()
  })

  // Rationale, not a spec mandate: remasking invalidates earlier per-slot
  // decisions — cf. §15.1 remask replay acceptance.
  it("does not show a superseded pre-remask distribution", () => {
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
