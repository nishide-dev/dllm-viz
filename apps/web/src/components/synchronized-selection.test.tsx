import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

describe("synchronized selection", () => {
  it("clicking a canvas slot updates the inspector through context", async () => {
    render(
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider initialFrame={5} trace={maskedRemaskTrace}>
          <DenoisingTokenCanvas />
          <TraceInspector />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )
    expect(screen.getByText(/select a token slot/i)).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /blue.*committed/i }))
    expect(screen.getByText("s3")).toBeInTheDocument()
    expect(screen.getByText("232")).toBeInTheDocument()
  })

  it("an explicit selectedSlotId prop overrides context", () => {
    render(
      <DiffusionSelectionProvider defaultSelectedSlotId="s3">
        <DiffusionTraceProvider initialFrame={5} trace={maskedRemaskTrace}>
          <TraceInspector selectedSlotId={null} />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    )
    expect(screen.getByText(/select a token slot/i)).toBeInTheDocument()
  })
})
