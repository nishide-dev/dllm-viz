import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { arBaselineTrace, maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionComparison,
  paneFrameIndex,
} from "@/registry/default/diffusion-comparison/diffusion-comparison"

const panes: Parameters<typeof DiffusionComparison>[0]["panes"] = [
  { trace: maskedRemaskTrace, label: "Diffusion (remasking)" },
  { trace: arBaselineTrace, label: "Autoregressive baseline" },
]

const setup = (
  props: Partial<Parameters<typeof DiffusionComparison>[0]> = {}
) => render(<DiffusionComparison panes={panes} {...props} />)

describe("DiffusionComparison", () => {
  it("renders both traces with their labels and provenance", () => {
    setup()
    expect(screen.getByText("Diffusion (remasking)")).toBeInTheDocument()
    expect(screen.getByText("Autoregressive baseline")).toBeInTheDocument()
    expect(
      document.querySelectorAll('[data-slot="comparison-pane"]')
    ).toHaveLength(2)
    expect(screen.getAllByText(/illustrative/)).not.toHaveLength(0)
  })

  it("makes the selected sync rule visible (spec §15.7 MUST)", () => {
    setup()
    expect(screen.getByLabelText("Synchronization rule")).toHaveValue(
      "frame-ordinal"
    )
    expect(screen.getByText(/synced by frame ordinal/i)).toBeInTheDocument()
  })

  it("warns that differing frame counts are not equivalent steps", () => {
    setup()
    expect(screen.getByText(/not equivalent steps/i)).toBeInTheDocument()
  })

  it("advances both panes from the shared controls (frame-ordinal)", async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Next step" }))
    await user.click(screen.getByRole("button", { name: "Next step" }))
    await user.click(screen.getByRole("button", { name: "Next step" }))
    expect(screen.getByText(/frame 4\/7/)).toBeInTheDocument()
    expect(screen.getByText(/frame 4\/5/)).toBeInTheDocument()
  })

  it("clamps the shorter trace at its final frame (frame-ordinal)", () => {
    setup()
    fireEvent.change(
      screen.getByRole("slider", { name: "Comparison position" }),
      { target: { value: "6" } }
    )
    expect(screen.getByText(/frame 7\/7/)).toBeInTheDocument()
    expect(screen.getByText(/frame 5\/5/)).toBeInTheDocument()
  })

  it("maps positions proportionally in completion-ratio mode", () => {
    setup({ defaultSyncRule: "completion-ratio" })
    expect(screen.getByText(/synced by completion ratio/i)).toBeInTheDocument()
    fireEvent.change(
      screen.getByRole("slider", { name: "Comparison position" }),
      { target: { value: "3" } }
    )
    // master 3 of 0..6 = 50% → pane B round(0.5 × 4) = 2 → frame 3/5
    expect(screen.getByText(/frame 4\/7/)).toBeInTheDocument()
    expect(screen.getByText(/frame 3\/5/)).toBeInTheDocument()
  })

  it("supports a custom pane renderer inside each provider", () => {
    setup({
      renderTrace: (trace) => <div data-testid="custom">{trace.traceId}</div>,
    })
    expect(screen.getAllByTestId("custom")).toHaveLength(2)
    expect(screen.getByText("fixture-masked-remask")).toBeInTheDocument()
  })

  it("paneFrameIndex maps ordinal and ratio rules", () => {
    expect(paneFrameIndex(3, 7, 5, "frame-ordinal")).toBe(3)
    expect(paneFrameIndex(6, 7, 5, "frame-ordinal")).toBe(4)
    expect(paneFrameIndex(3, 7, 5, "completion-ratio")).toBe(2)
    expect(paneFrameIndex(6, 7, 5, "completion-ratio")).toBe(4)
    expect(paneFrameIndex(0, 1, 5, "completion-ratio")).toBe(4)
  })
})
