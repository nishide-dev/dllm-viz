import { confidenceCommitTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionSelectionProvider,
  DiffusionTraceProvider,
} from "@/lib/dllm-viz-react"
import { CandidateDistribution } from "@/registry/default/candidate-distribution/candidate-distribution"
import { DenoisingTokenCanvas } from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
import { DiffusionStepControls } from "@/registry/default/diffusion-step-controls/diffusion-step-controls"

export function CandidateDistributionDemo() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">CandidateDistribution</h1>
      <DiffusionSelectionProvider defaultSelectedSlotId="s2">
        <DiffusionTraceProvider initialFrame={2} trace={confidenceCommitTrace}>
          <DenoisingTokenCanvas />
          <DiffusionStepControls />
          <CandidateDistribution />
        </DiffusionTraceProvider>
      </DiffusionSelectionProvider>
    </div>
  )
}
