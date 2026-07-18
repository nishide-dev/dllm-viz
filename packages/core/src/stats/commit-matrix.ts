import { applyOperations } from "../player/apply"
import { materializeSlots } from "../player/materialize"
import type {
  DiffusionTrace,
  TokenState,
  TraceOperation,
} from "../schema/types"

export const TOKEN_STATE_CODES = {
  prompt: 0,
  masked: 1,
  proposed: 2,
  committed: 3,
  fixed: 4,
  renoised: 5,
  padding: 6,
  unknown: 7,
} as const satisfies Record<TokenState, number>

const STATES_BY_CODE: readonly TokenState[] = [
  "prompt",
  "masked",
  "proposed",
  "committed",
  "fixed",
  "renoised",
  "padding",
  "unknown",
]

export function tokenStateFromCode(code: number): TokenState | undefined {
  return STATES_BY_CODE[code]
}

/** Cell code for a slot that does not exist at that frame. */
export const MATRIX_ABSENT = 255

export interface CommitMatrixOptions {
  /** First column (inclusive). Seeded via checkpoint-based materialization. */
  startFrame?: number
  /** Last column (inclusive). Defaults to the last frame. */
  endFrame?: number
}

export interface CommitMatrix {
  /**
   * Row order: slots present at the window start (array order), then
   * later-inserted slots in first-appearance order.
   */
  slotIds: readonly string[]
  startFrame: number
  frameCount: number
  /**
   * Row-major slotRow * frameCount + (frameIndex - startFrame). Values
   * are TOKEN_STATE_CODES or MATRIX_ABSENT.
   */
  states: Uint8Array
  /** Last known confidence per cell; NaN when unknown. Reset by mask. */
  confidences: Float32Array
}

export interface CommitMatrixCell {
  slotId: string
  frameIndex: number
  state?: TokenState
  confidence?: number
}

function applyConfidenceOps(
  operations: TraceOperation[],
  lastConfidence: Map<string, number>
): void {
  for (const op of operations) {
    if (op.type === "commit" || op.type === "set-token") {
      if (op.confidence !== undefined) {
        lastConfidence.set(op.slotId, op.confidence)
      }
    } else if (op.type === "mask") {
      lastConfidence.delete(op.slotId)
    } else if (op.type === "delete-slots") {
      for (const id of op.slotIds) {
        lastConfidence.delete(id)
      }
    }
  }
}

/**
 * Builds position × frame state/confidence data for CommitHeatmap in a
 * single incremental delta pass (spec §15.4, §19.2). Windowed builds
 * seed their start state from the nearest checkpoint via
 * materializeSlots instead of replaying from frame zero (spec §9.13).
 */
export function buildCommitMatrix(
  trace: DiffusionTrace,
  options: CommitMatrixOptions = {}
): CommitMatrix {
  const lastIndex = trace.frames.length - 1
  const startFrame = options.startFrame ?? 0
  const endFrame = options.endFrame ?? lastIndex
  if (startFrame < 0 || endFrame > lastIndex || startFrame > endFrame) {
    throw new RangeError(
      `buildCommitMatrix: window [${startFrame}, ${endFrame}] out of range [0, ${lastIndex}]`
    )
  }

  // Checkpoint reuse: state before the first window column.
  let slots = materializeSlots(trace, startFrame - 1)

  // Pre-scan rows: slots present at the window start, then insertions.
  const slotIds = slots.map((s) => s.slotId)
  const rowOf = new Map(slotIds.map((id, row) => [id, row]))
  for (let f = startFrame; f <= endFrame; f++) {
    for (const op of trace.frames[f].operations) {
      if (op.type === "insert-slots") {
        for (const inserted of op.slots) {
          if (!rowOf.has(inserted.slotId)) {
            rowOf.set(inserted.slotId, slotIds.length)
            slotIds.push(inserted.slotId)
          }
        }
      }
    }
  }

  const frameCount = endFrame - startFrame + 1
  const states = new Uint8Array(slotIds.length * frameCount).fill(MATRIX_ABSENT)
  const confidences = new Float32Array(slotIds.length * frameCount).fill(
    Number.NaN
  )
  const lastConfidence = new Map<string, number>()

  // Checkpoints capture slot state but not confidence; replay pre-window
  // ops for confidence only (no slot mutation — safe for poisoned frames).
  for (let f = 0; f < startFrame; f++) {
    applyConfidenceOps(trace.frames[f].operations, lastConfidence)
  }

  for (let f = startFrame; f <= endFrame; f++) {
    const frame = trace.frames[f]
    if (frame.operations.length > 0) {
      slots = applyOperations([...slots], frame.operations)
    }
    applyConfidenceOps(frame.operations, lastConfidence)
    const column = f - startFrame
    for (const slot of slots) {
      const row = rowOf.get(slot.slotId)
      if (row === undefined) continue
      const cell = row * frameCount + column
      states[cell] = TOKEN_STATE_CODES[slot.state]
      const confidence = lastConfidence.get(slot.slotId)
      if (confidence !== undefined) confidences[cell] = confidence
    }
  }

  return { slotIds, startFrame, frameCount, states, confidences }
}

export function getMatrixCell(
  matrix: CommitMatrix,
  slotRow: number,
  frameIndex: number
): CommitMatrixCell {
  const column = frameIndex - matrix.startFrame
  if (slotRow < 0 || slotRow >= matrix.slotIds.length) {
    throw new RangeError(`getMatrixCell: row ${slotRow} out of range`)
  }
  if (column < 0 || column >= matrix.frameCount) {
    throw new RangeError(`getMatrixCell: frame ${frameIndex} out of range`)
  }
  const cell = slotRow * matrix.frameCount + column
  const code = matrix.states[cell]
  const confidence = matrix.confidences[cell]
  return {
    slotId: matrix.slotIds[slotRow],
    frameIndex,
    state: code === MATRIX_ABSENT ? undefined : tokenStateFromCode(code),
    // Float32Array cannot represent e.g. 0.46 exactly; round back to the
    // 4-decimal source precision so cells compare equal to trace values.
    confidence: Number.isNaN(confidence)
      ? undefined
      : Number(confidence.toFixed(4)),
  }
}

/** Exact-value readout for hover/keyboard focus (spec §15.4, §18). */
export function describeMatrixCell(cell: CommitMatrixCell): string {
  const state = cell.state ?? "not present"
  const confidence =
    cell.confidence !== undefined
      ? `, confidence ${cell.confidence.toFixed(2)}`
      : ""
  return `Slot ${cell.slotId}, frame ${cell.frameIndex + 1}: ${state}${confidence}`
}
