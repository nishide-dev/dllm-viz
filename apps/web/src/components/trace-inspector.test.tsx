import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import { DiffusionTraceProvider } from "@/lib/dllm-viz-react"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

const renderAt = (frame: number, selectedSlotId?: string | null) =>
  render(
    <DiffusionTraceProvider trace={maskedRemaskTrace} initialFrame={frame}>
      <TraceInspector selectedSlotId={selectedSlotId} />
    </DiffusionTraceProvider>
  )

describe("TraceInspector", () => {
  it("prompts for a selection when nothing is selected", () => {
    renderAt(0, null)
    expect(screen.getByText(/select a token slot/i)).toBeInTheDocument()
  })

  it("shows exact slot data for the selected slot", () => {
    renderAt(5, "s3")
    expect(screen.getByText("s3")).toBeInTheDocument()
    expect(screen.getByText("232")).toBeInTheDocument()
    expect(screen.getByText("committed")).toBeInTheDocument()
  })

  it("lists the operation history up to the current frame", () => {
    renderAt(5, "s3")
    const history = screen.getByRole("list", { name: /operation history/i })
    const items = history.querySelectorAll("li")
    expect([...items].map((li) => li.textContent)).toEqual([
      expect.stringContaining("set-distribution"),
      expect.stringContaining("commit"),
      expect.stringContaining("renoise"),
      expect.stringContaining("mask"),
      expect.stringContaining("commit"),
    ])
  })

  it("does not show future operations", () => {
    renderAt(2, "s3")
    const history = screen.getByRole("list", { name: /operation history/i })
    expect(history.querySelectorAll("li")).toHaveLength(2)
  })

  it("shows top-k candidates including omitted probability mass", () => {
    renderAt(2, "s3")
    // "green" also appears in the operation history, so use getAllByText.
    expect(screen.getAllByText(/green/).length).toBeGreaterThan(0)
    expect(screen.getByText(/46%/)).toBeInTheDocument()
    expect(screen.getByText(/omitted mass/i)).toBeInTheDocument()
  })

  it("visibly marks illustrative provenance (spec §15.3)", () => {
    renderAt(5, "s3")
    expect(screen.getAllByText("illustrative").length).toBeGreaterThan(0)
  })

  it("marks candidate rows and the omitted-mass row with provenance (spec §15.3)", () => {
    renderAt(2, "s3")
    const candidatesHeading = screen.getByText("Candidates")
    const candidatesList = candidatesHeading.nextElementSibling as HTMLElement
    const rows = [...candidatesList.querySelectorAll("li")]
    // every row (3 candidates + 1 omitted-mass row) carries its own badge.
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(
        row.querySelector('[data-slot="provenance-badge"]')
      ).toBeInTheDocument()
    }
  })

  it("marks each operation-history row with provenance (spec §15.3)", () => {
    renderAt(5, "s3")
    const history = screen.getByRole("list", { name: /operation history/i })
    const rows = [...history.querySelectorAll("li")]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(
        row.querySelector('[data-slot="provenance-badge"]')
      ).toBeInTheDocument()
    }
  })

  it("does not show a stale pre-remask distribution/confidence after remask+recommit", () => {
    // s3 in maskedRemaskTrace: committed "green" (f2) -> renoise (f3) ->
    // mask (f4) -> recommitted "blue" (f5). At frame 5 the only data "current"
    // for the distribution/confidence fields must come from ops after the
    // mask boundary, i.e. the "blue" commit — never the pre-remask "green"
    // decision (46% / candidates / omitted mass).
    renderAt(5, "s3")
    expect(screen.getByText("232")).toBeInTheDocument()
    expect(screen.queryByText("Candidates")).not.toBeInTheDocument()
    expect(screen.queryByText(/46%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/omitted mass/i)).not.toBeInTheDocument()
    // post-remask confidence (0.88) from the "blue" recommit is shown.
    expect(screen.getByText("0.88")).toBeInTheDocument()
  })
})
