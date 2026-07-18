import { blockCanvasTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { BlockDiffusionCanvas } from "@/registry/default/block-diffusion-canvas/block-diffusion-canvas"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

export function BlockDiffusionCanvasDemo() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">BlockDiffusionCanvas</h1>
      <DiffusionSelectionProvider>
        <DiffusionTraceProvider trace={blockCanvasTrace}>
          <BlockDiffusionCanvas />
          <DiffusionStepControls />
          <TraceInspector />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    </div>
  )
}
