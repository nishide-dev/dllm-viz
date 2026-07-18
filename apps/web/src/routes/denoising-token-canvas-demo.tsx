import { useState } from "react"
import { maskedRemaskTrace } from "@/lib/dllm-viz-core"
import { DiffusionTraceProvider } from "@/lib/dllm-viz-react"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

export function DenoisingTokenCanvasDemo() {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">DenoisingTokenCanvas</h1>
      <DiffusionTraceProvider trace={maskedRemaskTrace}>
        <DenoisingTokenCanvas
          onSlotSelect={setSelectedSlotId}
          selectedSlotId={selectedSlotId}
        />
        <DiffusionStepControls />
        <TraceInspector selectedSlotId={selectedSlotId} />
      </DiffusionTraceProvider>
    </div>
  )
}
