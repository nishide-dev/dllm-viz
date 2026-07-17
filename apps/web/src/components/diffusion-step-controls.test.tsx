import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import { DiffusionTraceProvider } from "@/lib/dllm-viz-react"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"

const setup = () =>
  render(
    <DiffusionTraceProvider trace={maskedRemaskTrace}>
      <DiffusionStepControls />
    </DiffusionTraceProvider>
  )

describe("DiffusionStepControls", () => {
  it("steps forward and backward with buttons", async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Next frame" }))
    await user.click(screen.getByRole("button", { name: "Next frame" }))
    await user.click(screen.getByRole("button", { name: "Previous frame" }))
    expect(screen.getByText(/Frame 2\/7/)).toBeInTheDocument()
  })

  it("jumps to first and last frame", async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Last frame" }))
    expect(screen.getByText(/Frame 7\/7/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "First frame" }))
    expect(screen.getByText(/Frame 1\/7/)).toBeInTheDocument()
  })

  it("toggles play/pause and reflects state in the accessible name", async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Play" }))
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Pause" }))
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
  })

  it("scrubs with the range slider", () => {
    setup()
    fireEvent.change(screen.getByRole("slider", { name: "Frame" }), {
      target: { value: "4" },
    })
    expect(screen.getByText(/Frame 5\/7/)).toBeInTheDocument()
  })

  it("shows the model step from the frame", async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Last frame" }))
    expect(screen.getByText(/step 6/)).toBeInTheDocument()
  })

  it("global keyboard shortcuts work through the component", () => {
    setup()
    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(screen.getByText(/Frame 2\/7/)).toBeInTheDocument()
  })
})
