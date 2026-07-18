import type { DiffusionTrace } from "@/lib/dllm-viz-core"
import { confidenceCommitTrace } from "@/lib/dllm-viz-core"

/**
 * Live-stream startup shapes (spec §21.3): components must render a
 * trace that has no frames yet, and one with a single frame.
 */
export const zeroFrameTrace: DiffusionTrace = {
  ...confidenceCommitTrace,
  traceId: "test-zero-frame",
  frames: [],
  checkpoints: [],
  final: undefined,
}

export const oneFrameTrace: DiffusionTrace = {
  ...confidenceCommitTrace,
  traceId: "test-one-frame",
  frames: [confidenceCommitTrace.frames[0]],
  checkpoints: [],
  final: undefined,
}
