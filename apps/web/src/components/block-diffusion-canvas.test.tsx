import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import {
  blockCanvasTrace,
  confidenceCommitTrace,
  materializeSlots,
} from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
  useSlotSelection,
} from "@/lib/dllm-viz-react"
import {
  BlockDiffusionCanvas,
  computeCanvasSections,
} from "@/registry/default/block-diffusion-canvas/block-diffusion-canvas"
import { oneFrameTrace, zeroFrameTrace } from "@/test/streaming-traces"

const renderAt = (frame: number) =>
  render(
    <DiffusionTraceProvider initialFrame={frame} trace={blockCanvasTrace}>
      <BlockDiffusionCanvas />
    </DiffusionTraceProvider>
  )

describe("BlockDiffusionCanvas", () => {
  it("separates prompt context and marks both canvases future initially", () => {
    renderAt(0)
    expect(
      screen.getByRole("region", { name: "Prompt context" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 0: future" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 1: future" })
    ).toBeInTheDocument()
  })

  it("nests the active canvas and shows inner-step progress (spec §15.5)", () => {
    renderAt(2)
    const active = screen.getByRole("region", { name: "Canvas 0: active" })
    expect(active).toHaveTextContent("canvas 0 · step 1/2")
    expect(
      active.querySelector('[data-slot="active-canvas-inner"]')
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 1: future" })
    ).toBeInTheDocument()
  })

  it("marks canvas 0 committed at its canvas-commit boundary", () => {
    renderAt(4)
    expect(
      screen.getByRole("region", { name: "Canvas 0: committed" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 1: future" })
    ).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="active-canvas-inner"]')
    ).toBeNull()
  })

  it("activates canvas 1 after its canvas-start", () => {
    renderAt(6)
    expect(
      screen.getByRole("region", { name: "Canvas 0: committed" })
    ).toBeInTheDocument()
    const active = screen.getByRole("region", { name: "Canvas 1: active" })
    expect(active).toHaveTextContent("canvas 1 · step 1/2")
  })

  it("marks both canvases committed at the end", () => {
    renderAt(9)
    expect(
      screen.getByRole("region", { name: "Canvas 0: committed" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Canvas 1: committed" })
    ).toBeInTheDocument()
  })

  it("renders committed chips as fixed and future chips as masked", () => {
    renderAt(4)
    const committed = screen.getByRole("region", {
      name: "Canvas 0: committed",
    })
    for (const chip of committed.querySelectorAll("button")) {
      expect(chip).toHaveAttribute("data-state", "fixed")
    }
    const future = screen.getByRole("region", { name: "Canvas 1: future" })
    for (const chip of future.querySelectorAll("button")) {
      expect(chip).toHaveAttribute("data-state", "masked")
    }
  })

  it("announces the active canvas in the single step summary", () => {
    renderAt(6)
    expect(screen.getByRole("status")).toHaveTextContent(
      /Canvas 1 active, inner step 1 of 2/
    )
  })

  it("labels traces without block/canvas structure instead of faking one", () => {
    // confidenceCommitTrace has neither generation.canvasLength nor any
    // frame with canvasIndex — no canvas sections may be synthesized.
    render(
      <DiffusionTraceProvider initialFrame={1} trace={confidenceCommitTrace}>
        <BlockDiffusionCanvas />
      </DiffusionTraceProvider>
    )
    expect(screen.getByText(/no block\/canvas structure/i)).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: /future/i })
    ).not.toBeInTheDocument()
    // Prompt and completion tokens still render plainly.
    expect(
      screen.getByRole("region", { name: "Prompt context" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Slot 3: ., committed/ })
    ).toBeInTheDocument()
  })

  it("renders zero-frame and one-frame traces without crashing (spec §21.3)", () => {
    const { unmount } = render(
      <DiffusionTraceProvider trace={zeroFrameTrace}>
        <BlockDiffusionCanvas />
      </DiffusionTraceProvider>
    )
    expect(screen.getByText(/no block\/canvas structure/i)).toBeInTheDocument()
    unmount()
    render(
      <DiffusionTraceProvider trace={oneFrameTrace}>
        <BlockDiffusionCanvas />
      </DiffusionTraceProvider>
    )
    expect(screen.getByText(/no block\/canvas structure/i)).toBeInTheDocument()
  })

  it("clicking a slot chip selects it in the shared selection context", async () => {
    function Probe() {
      const { selectedSlotId } = useSlotSelection()
      return <output data-testid="probe">{selectedSlotId ?? "none"}</output>
    }
    render(
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider initialFrame={2} trace={blockCanvasTrace}>
          <BlockDiffusionCanvas />
          <Probe />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )
    const chip = screen.getByRole("button", { name: /Slot 2: red, committed/ })
    expect(chip).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(chip)
    expect(chip).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("probe")).toHaveTextContent("s2")
  })

  it("computeCanvasSections derives status and progress", () => {
    const slots = materializeSlots(blockCanvasTrace, 7)
    const { promptSlots, sections } = computeCanvasSections(
      blockCanvasTrace,
      slots,
      7
    )
    expect(promptSlots.map((s) => s.slotId)).toEqual(["s0"])
    expect(sections.map((s) => s.status)).toEqual(["committed", "active"])
    expect(sections[1].innerStep).toBe(2)
    expect(sections[1].innerStepCount).toBe(2)
    expect(sections[1].slots.map((s) => s.slotId)).toEqual(["s4", "s5", "s6"])
  })
})
