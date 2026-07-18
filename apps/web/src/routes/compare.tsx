import { arBaselineTrace, confidenceCommitTrace } from "@/lib/dllm-viz-core"
import { DiffusionComparison } from "@/registry/default/diffusion-comparison/diffusion-comparison"

export function Compare() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-medium text-lg">Compare</h1>
      <p className="max-w-prose text-sm leading-relaxed">
        Same prompt, two generation orders: confidence-ranked diffusion commits
        against a left-to-right autoregressive baseline. Both traces are
        hand-authored and labeled illustrative.
      </p>
      <DiffusionComparison
        panes={[
          {
            trace: confidenceCommitTrace,
            label: "Diffusion (confidence-ranked)",
          },
          { trace: arBaselineTrace, label: "Autoregressive baseline" },
        ]}
      />
    </div>
  )
}
