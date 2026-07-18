import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  buildCommitMatrix,
  describeMatrixCell,
  generatePerformanceTrace,
  getMatrixCell,
  MATRIX_ABSENT,
  maskedRemaskTrace,
  TOKEN_STATE_CODES,
} from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
  useDiffusionSnapshot,
  useSlotSelection,
} from "@/lib/dllm-viz-react"
import {
  CommitHeatmap,
  cellFromPoint,
  heatmapCellColor,
  STATE_GLYPHS,
} from "@/registry/default/commit-heatmap/commit-heatmap"

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

describe("CommitHeatmap (canvas mode)", () => {
  const denseTrace = generatePerformanceTrace({
    slotCount: 64,
    frameCount: 64,
    seed: 7,
  })
  const matrix = buildCommitMatrix(denseTrace)

  const renderDense = () =>
    render(
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider trace={denseTrace}>
          <CommitHeatmap />
          <Probe />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )

  it("switches to canvas above the cell threshold (spec §19.2)", () => {
    const { container } = renderDense()
    expect(container.querySelector('[data-mode="canvas"]')).toBeInTheDocument()
    expect(container.querySelector("canvas")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("scales the backing store by devicePixelRatio", () => {
    vi.stubGlobal("devicePixelRatio", 2)
    const { container } = renderDense()
    const canvas = container.querySelector("canvas")
    // 64 frames × 4px default cells × dpr 2
    expect(canvas?.width).toBe(64 * 4 * 2)
    expect(canvas?.style.width).toBe("256px")
    vi.unstubAllGlobals()
  })

  it("keyboard cell cursor reveals exact values (spec §15.4)", () => {
    const { container } = renderDense()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowDown" })
    expect(
      container.querySelector('[data-slot="heatmap-readout"]')
    ).toHaveTextContent(describeMatrixCell(getMatrixCell(matrix, 1, 2)))
  })

  it("Enter on the cursor seeks the player and selects the slot", () => {
    renderDense()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "Enter" })
    expect(screen.getByRole("status")).toHaveTextContent("s0:2")
  })
})

describe("CommitHeatmap pure helpers", () => {
  it("heatmapCellColor maps states, confidence, and absence", () => {
    expect(heatmapCellColor(MATRIX_ABSENT, Number.NaN, "state")).toBe(
      "transparent"
    )
    expect(
      heatmapCellColor(TOKEN_STATE_CODES.committed, Number.NaN, "state")
    ).toBe("#10b981")
    expect(heatmapCellColor(TOKEN_STATE_CODES.committed, 1, "confidence")).toBe(
      "#10b981ff"
    )
    expect(
      heatmapCellColor(TOKEN_STATE_CODES.masked, Number.NaN, "confidence")
    ).toBe("#a1a1aa")
  })

  it("cellFromPoint maps points to cells and rejects out-of-bounds", () => {
    const matrix = buildCommitMatrix(maskedRemaskTrace)
    expect(cellFromPoint(9, 13, 4, matrix)).toEqual({ row: 3, frame: 2 })
    expect(cellFromPoint(-1, 0, 4, matrix)).toBeNull()
    expect(cellFromPoint(4 * 7, 0, 4, matrix)).toBeNull()
  })

  it("every token state has a glyph (no color-only encoding)", () => {
    for (const state of Object.keys(TOKEN_STATE_CODES)) {
      expect(STATE_GLYPHS[state as keyof typeof STATE_GLYPHS]).toBeTruthy()
    }
  })
})
