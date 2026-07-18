import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { DiffusionTrace } from "@/lib/dllm-viz-core"
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
  paintHeatmap,
  STATE_GLYPHS,
} from "@/registry/default/commit-heatmap/commit-heatmap"
import { oneFrameTrace, zeroFrameTrace } from "@/test/streaming-traces"

function Probe() {
  const { selectedSlotId } = useSlotSelection()
  const snapshot = useDiffusionSnapshot()
  return <output>{`${selectedSlotId ?? "none"}:${snapshot.frameIndex}`}</output>
}

const renderAt = (
  frame: number,
  props: Parameters<typeof CommitHeatmap>[0] = {},
  trace: DiffusionTrace = maskedRemaskTrace
) =>
  render(
    <DiffusionSelectionProvider>
      <DiffusionTraceProvider initialFrame={frame} trace={trace}>
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

describe("CommitHeatmap (streaming startup, spec §21.3)", () => {
  it("renders an accessible empty state for a zero-frame trace", () => {
    renderAt(0, {}, zeroFrameTrace)
    const empty = screen.getByText(/no frames yet/i)
    expect(empty).toHaveRole("status")
  })

  it("renders a one-frame trace without crashing", () => {
    renderAt(0, {}, oneFrameTrace)
    expect(
      screen.getByRole("table", { name: "Commit heatmap" })
    ).toBeInTheDocument()
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

  // maskedRemaskTrace with domCellLimit 0 forces canvas mode on a small,
  // hand-authored matrix whose exact readouts are known literals.
  const renderSmallCanvas = (props: Parameters<typeof CommitHeatmap>[0] = {}) =>
    renderAt(0, { domCellLimit: 0, ...props })

  const mockCanvasRect = (container: HTMLElement, left = 0, top = 0) => {
    const canvas = container.querySelector("canvas")
    if (!canvas) throw new Error("canvas not rendered")
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left,
      top,
      right: left + 28,
      bottom: top + 24,
      width: 28,
      height: 24,
      x: left,
      y: top,
      toJSON: () => ({}),
    } as DOMRect)
    return canvas
  }

  const readout = (container: HTMLElement) =>
    container.querySelector('[data-slot="heatmap-readout"]')

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

  it("shows a fallback message when the canvas would exceed the size cap", () => {
    renderSmallCanvas({ cellSize: 3000 })
    // 7 frames × 3000px = 21000 device px > 16384 cap
    const fallback = screen.getByText(/too large for canvas rendering/i)
    expect(fallback).toHaveRole("status")
  })

  it("keyboard cell cursor reveals exact values (spec §15.4)", () => {
    const { container } = renderDense()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowDown" })
    expect(readout(container)).toHaveTextContent(
      describeMatrixCell(getMatrixCell(matrix, { slotRow: 1, frameIndex: 2 }))
    )
  })

  it("Enter on the cursor seeks the player and selects the slot", () => {
    renderDense()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "Enter" })
    expect(screen.getByRole("status")).toHaveTextContent("s0:2")
  })

  it("hover reveals the hovered cell in the readout", () => {
    const { container } = renderSmallCanvas()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    mockCanvasRect(container)
    // cellSize 4: (21, 13) → column 5, row 3
    fireEvent.mouseMove(grid, { clientX: 21, clientY: 13 })
    expect(readout(container)).toHaveTextContent(
      "Slot s3, frame 6: committed, confidence 0.88"
    )
  })

  it("hit-testing follows the canvas rect after horizontal scroll", () => {
    const { container } = renderSmallCanvas()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    // Scrolled 8px right: the canvas rect starts left of the viewport.
    mockCanvasRect(container, -8)
    fireEvent.mouseMove(grid, { clientX: 13, clientY: 13 })
    expect(readout(container)).toHaveTextContent(
      "Slot s3, frame 6: committed, confidence 0.88"
    )
  })

  it("click seeks the player and selects the hit-tested slot", () => {
    const onSlotSelect = vi.fn()
    const { container } = renderSmallCanvas({ onSlotSelect })
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    mockCanvasRect(container)
    fireEvent.click(grid, { clientX: 21, clientY: 13 })
    expect(screen.getByRole("status")).toHaveTextContent("s3:5")
    expect(onSlotSelect).toHaveBeenCalledWith("s3")
  })

  it("ArrowLeft and ArrowUp at the origin stay put", () => {
    const { container } = renderSmallCanvas()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "ArrowLeft" })
    fireEvent.keyDown(grid, { key: "ArrowUp" })
    expect(readout(container)).toHaveTextContent("Slot s0, frame 1: prompt")
  })

  it("End jumps to the last column and ArrowRight stays there", () => {
    const { container } = renderSmallCanvas()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "End" })
    expect(readout(container)).toHaveTextContent("Slot s0, frame 7: prompt")
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    expect(readout(container)).toHaveTextContent("Slot s0, frame 7: prompt")
  })

  it("Home returns to the first column", () => {
    const { container } = renderSmallCanvas()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "End" })
    fireEvent.keyDown(grid, { key: "Home" })
    expect(readout(container)).toHaveTextContent("Slot s0, frame 1: prompt")
  })

  it("announces readout changes politely for keyboard cursor moves", () => {
    const { container } = renderSmallCanvas()
    expect(readout(container)).toHaveAttribute("aria-live", "polite")
  })

  it("survives a swap to a shorter trace with a stale cursor", () => {
    const { container, rerender } = renderSmallCanvas()
    const grid = screen.getByRole("img", { name: /commit heatmap/i })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    fireEvent.keyDown(grid, { key: "ArrowRight" })
    rerender(
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider initialFrame={0} trace={oneFrameTrace}>
          <CommitHeatmap domCellLimit={0} />
          <Probe />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )
    expect(() =>
      fireEvent.keyDown(screen.getByRole("img", { name: /commit heatmap/i }), {
        key: "Enter",
      })
    ).not.toThrow()
    expect(readout(container)).toHaveTextContent("Slot s0, frame 1: prompt")
    expect(screen.getByRole("status")).toHaveTextContent("s0:0")
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
    expect(cellFromPoint(9, 13, 4, matrix)).toEqual({
      slotRow: 3,
      frameIndex: 2,
    })
    expect(cellFromPoint(-1, 0, 4, matrix)).toBeNull()
    expect(cellFromPoint(4 * 7, 0, 4, matrix)).toBeNull()
  })

  it("every token state has a glyph (no color-only encoding)", () => {
    for (const state of Object.keys(TOKEN_STATE_CODES)) {
      expect(STATE_GLYPHS[state as keyof typeof STATE_GLYPHS]).toBeTruthy()
    }
  })

  it("paintHeatmap paints each cell and the overlays at exact rects", () => {
    const matrix = buildCommitMatrix(maskedRemaskTrace) // 6 slots × 7 frames
    const fills: { style: string; rect: number[] }[] = []
    const strokes: { style: string; lineWidth: number; rect: number[] }[] = []
    const clears: number[][] = []
    const ctx = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      clearRect: (...rect: number[]) => {
        clears.push(rect)
      },
      fillRect(...rect: number[]) {
        fills.push({ style: this.fillStyle, rect })
      },
      strokeRect(...rect: number[]) {
        strokes.push({
          style: this.strokeStyle,
          lineWidth: this.lineWidth,
          rect,
        })
      },
    }
    paintHeatmap(ctx as unknown as CanvasRenderingContext2D, matrix, {
      cellSize: 4,
      metric: "state",
      frameIndex: 2,
      selectedRow: 1,
      cursor: { slotRow: 3, frameIndex: 5 },
    })
    expect(clears).toEqual([[0, 0, 28, 24]])
    expect(fills).toHaveLength(6 * 7)
    // Cell (row 3, column 5) is s3's second commit — committed green.
    expect(fills[3 * 7 + 5]).toEqual({
      style: "#10b981",
      rect: [5 * 4, 3 * 4, 4, 4],
    })
    // Frame column, selected row, then cursor overlays.
    expect(strokes).toEqual([
      { style: "#18181b", lineWidth: 1, rect: [8.5, 0.5, 3, 23] },
      { style: "#18181b", lineWidth: 1, rect: [0.5, 4.5, 27, 3] },
      { style: "#2563eb", lineWidth: 2, rect: [21, 13, 2, 2] },
    ])
  })
})
