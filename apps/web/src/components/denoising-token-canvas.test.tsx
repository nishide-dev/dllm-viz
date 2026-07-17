import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import { DiffusionTraceProvider } from "@/lib/dllm-viz-react"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"

const renderAt = (
  frame: number,
  props: Parameters<typeof DenoisingTokenCanvas>[0] = {}
) =>
  render(
    <DiffusionTraceProvider trace={maskedRemaskTrace} initialFrame={frame}>
      <DenoisingTokenCanvas {...props} />
    </DiffusionTraceProvider>
  )

describe("DenoisingTokenCanvas", () => {
  it("renders masked slots with an accessible masked label, not color only", () => {
    renderAt(0)
    const masked = screen.getAllByRole("button", { name: /masked/i })
    expect(masked).toHaveLength(4)
  })

  it("renders committed token text after denoising", () => {
    renderAt(5)
    expect(
      screen.getByRole("button", { name: /blue.*committed/i })
    ).toBeInTheDocument()
  })

  it("marks renoised slots distinctly", () => {
    renderAt(3)
    expect(
      screen.getByRole("button", { name: /green.*renoised/i })
    ).toHaveAttribute("data-state", "renoised")
  })

  it("hides prompt slots when showPrompt is false", () => {
    renderAt(0, { showPrompt: false })
    expect(
      screen.queryByRole("button", { name: /prompt/i })
    ).not.toBeInTheDocument()
  })

  it("keyboard-activates slot selection", async () => {
    const onSlotSelect = vi.fn()
    renderAt(0, { onSlotSelect })
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard("{Enter}")
    expect(onSlotSelect).toHaveBeenCalledWith("s0")
  })

  it("exposes one step summary for screen readers, not per-token regions", () => {
    renderAt(3)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Step 4 of 7. 3 tokens committed, 0 masked, 1 remasked."
    )
  })

  it("shows an illustrative provenance badge (spec §9.6)", () => {
    renderAt(0)
    expect(screen.getByText("illustrative")).toBeInTheDocument()
  })
})
