import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
  useDiffusionSnapshot,
  useSlotSelection,
} from "@/lib/dllm-viz-react"
import { CommitHeatmap } from "@/registry/default/commit-heatmap/commit-heatmap"

function Probe() {
  const { selectedSlotId } = useSlotSelection()
  const snapshot = useDiffusionSnapshot()
  return <output>{`${selectedSlotId ?? "none"}:${snapshot.frameIndex}`}</output>
}

const renderAt = (
  frame: number,
  props: Parameters<typeof CommitHeatmap>[0] = {}
) =>
  render(
    <DiffusionSelectionProvider>
      <DiffusionTraceProvider initialFrame={frame} trace={maskedRemaskTrace}>
        <CommitHeatmap {...props} />
        <Probe />
      </DiffusionTraceProvider>
    </DiffusionSelectionProvider>
  )

describe("CommitHeatmap (DOM mode)", () => {
  it("renders one cell per slot × frame below the threshold", () => {
    const { container } = renderAt(0)
    expect(container.querySelector('[data-mode="dom"]')).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "Commit heatmap" })
    expect(within(table).getAllByRole("button")).toHaveLength(6 * 7)
  })

  it("exposes exact values on every cell (spec §15.4)", () => {
    renderAt(0)
    expect(
      screen.getByRole("button", {
        name: "Slot s3, frame 6: committed, confidence 0.88",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "Slot s3, frame 4: renoised, confidence 0.46",
      })
    ).toBeInTheDocument()
  })

  it("does not rely on color alone: cells carry state glyphs (spec §18)", () => {
    renderAt(0)
    const cell = screen.getByRole("button", {
      name: "Slot s3, frame 4: renoised, confidence 0.46",
    })
    expect(cell).toHaveAttribute("data-state", "renoised")
    expect(cell).toHaveTextContent("↺")
  })

  it("marks the current frame column as the linked cursor", () => {
    const { container } = renderAt(3)
    expect(container.querySelectorAll('[aria-current="time"]')).toHaveLength(6)
  })

  it("keyboard focus reveals the exact value in the readout", () => {
    const { container } = renderAt(0)
    fireEvent.focus(
      screen.getByRole("button", {
        name: "Slot s3, frame 6: committed, confidence 0.88",
      })
    )
    expect(
      container.querySelector('[data-slot="heatmap-readout"]')
    ).toHaveTextContent("Slot s3, frame 6: committed, confidence 0.88")
  })

  it("hover reveals the exact value in the readout", () => {
    const { container } = renderAt(0)
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Slot s3, frame 1: masked" })
    )
    expect(
      container.querySelector('[data-slot="heatmap-readout"]')
    ).toHaveTextContent("Slot s3, frame 1: masked")
  })

  it("clicking a cell seeks the player and selects the slot", async () => {
    const onSlotSelect = vi.fn()
    renderAt(0, { onSlotSelect })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: "Slot s3, frame 6: committed, confidence 0.88",
      })
    )
    expect(screen.getByRole("status")).toHaveTextContent("s3:5")
    expect(onSlotSelect).toHaveBeenCalledWith("s3")
  })

  it("shows the illustrative provenance badge", () => {
    renderAt(0)
    expect(screen.getByText("illustrative")).toBeInTheDocument()
  })
})
