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
})
