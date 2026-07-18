import {
  generatePerformanceTrace,
  maskedRemaskTrace,
} from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { CommitHeatmap } from "@/registry/default/commit-heatmap/commit-heatmap"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"
import { TraceInspector } from "@/registry/default/trace-inspector/trace-inspector"

// Generated once at module load; never shipped as JSON (spec §19.3).
const denseTrace = generatePerformanceTrace()

export function CommitHeatmapDemo() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="font-medium text-lg">CommitHeatmap</h1>
      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-sm">Linked DOM mode (small trace)</h2>
        <DiffusionSelectionProvider>
          <DiffusionTraceProvider trace={maskedRemaskTrace}>
            <DenoisingTokenCanvas />
            <CommitHeatmap />
            <DiffusionStepControls />
            <TraceInspector />
          </DiffusionTraceProvider>
        </DiffusionSelectionProvider>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-sm">
          Dense canvas mode (generated 256×512 benchmark trace)
        </h2>
        <DiffusionSelectionProvider>
          <DiffusionTraceProvider trace={denseTrace}>
            <CommitHeatmap />
            <DiffusionStepControls keyboard={false} />
          </DiffusionTraceProvider>
        </DiffusionSelectionProvider>
      </section>
    </div>
  )
}
