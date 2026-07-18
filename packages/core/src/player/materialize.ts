import type {
  DiffusionTrace,
  TokenSlot,
  TraceCheckpoint,
} from "../schema/types"
import { applyOperations } from "./apply"

export function materializeSlots(
  trace: DiffusionTrace,
  frameIndex: number
): TokenSlot[] {
  // Copy so callers never hold a reference into the trace object itself.
  if (frameIndex === -1) return [...trace.initial.slots]
  if (frameIndex < -1 || frameIndex >= trace.frames.length) {
    throw new RangeError(
      `frameIndex ${frameIndex} out of range [-1, ${trace.frames.length - 1}]`
    )
  }
  const targetOrdinal = trace.frames[frameIndex].ordinal
  let base: TraceCheckpoint = trace.initial
  for (const cp of trace.checkpoints ?? []) {
    if (
      cp.frameOrdinal <= targetOrdinal &&
      cp.frameOrdinal > base.frameOrdinal
    ) {
      base = cp
    }
  }
  let slots: TokenSlot[] = [...base.slots]
  for (let i = 0; i <= frameIndex; i++) {
    const frame = trace.frames[i]
    if (frame.ordinal <= base.frameOrdinal) continue
    if (frame.operations.length === 0) continue
    slots = applyOperations(slots, frame.operations)
  }
  return slots
}
