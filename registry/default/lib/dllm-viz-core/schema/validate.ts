import type { DiffusionTrace, TokenSlot } from "./types"
import { DiffusionTraceSchema } from "./zod"

export interface ValidateOptions {
  maxFrames?: number
  maxSlots?: number
  maxCandidates?: number
  maxOperationsPerFrame?: number
}

const DEFAULTS: Required<ValidateOptions> = {
  maxFrames: 10_000,
  maxSlots: 4096,
  maxCandidates: 64,
  maxOperationsPerFrame: 4096,
}

export class TraceValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`Invalid trace: ${issues.join("; ")}`)
    this.name = "TraceValidationError"
    this.issues = issues
  }
}

function checkSlots(slots: TokenSlot[], where: string, issues: string[]) {
  const seen = new Set<string>()
  for (const slot of slots) {
    if (seen.has(slot.slotId)) {
      issues.push(`duplicate slotId "${slot.slotId}" in ${where}`)
    }
    seen.add(slot.slotId)
  }
}

export function parseTrace(
  data: unknown,
  options: ValidateOptions = {}
): DiffusionTrace {
  const limits = { ...DEFAULTS, ...options }
  const result = DiffusionTraceSchema.safeParse(data)
  if (!result.success) {
    throw new TraceValidationError(
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    )
  }
  const trace = result.data as unknown as DiffusionTrace
  const issues: string[] = []

  if (trace.initial.frameOrdinal !== -1) {
    issues.push("initial.frameOrdinal must be -1")
  }
  if (trace.frames.length > limits.maxFrames) {
    issues.push(`frames exceed maxFrames (${limits.maxFrames})`)
  }
  if (trace.initial.slots.length > limits.maxSlots) {
    issues.push(`initial slots exceed maxSlots (${limits.maxSlots})`)
  }
  checkSlots(trace.initial.slots, "initial", issues)
  for (const cp of trace.checkpoints ?? []) {
    checkSlots(cp.slots, `checkpoint ${cp.checkpointId}`, issues)
  }

  const frameIds = new Set<string>()
  let lastOrdinal = -1
  for (const frame of trace.frames) {
    if (frameIds.has(frame.frameId)) {
      issues.push(`duplicate frameId "${frame.frameId}"`)
    }
    frameIds.add(frame.frameId)
    if (frame.ordinal <= lastOrdinal) {
      issues.push(
        `frame "${frame.frameId}" ordinal ${frame.ordinal} is not increasing`
      )
    }
    lastOrdinal = frame.ordinal
    if (frame.operations.length > limits.maxOperationsPerFrame) {
      issues.push(`frame "${frame.frameId}" exceeds maxOperationsPerFrame`)
    }
    for (const op of frame.operations) {
      if (
        op.type === "set-distribution" &&
        op.candidates.length > limits.maxCandidates
      ) {
        issues.push(`frame "${frame.frameId}" exceeds maxCandidates`)
      }
    }
  }

  let lastCheckpointOrdinal = -1
  for (const cp of trace.checkpoints ?? []) {
    if (cp.frameOrdinal < 0) {
      issues.push(`checkpoint "${cp.checkpointId}" frameOrdinal must be >= 0`)
    }
    if (cp.frameOrdinal <= lastCheckpointOrdinal) {
      issues.push(
        `checkpoint "${cp.checkpointId}" frameOrdinal ${cp.frameOrdinal} ` +
          "is not increasing"
      )
    }
    lastCheckpointOrdinal = cp.frameOrdinal
    if (trace.frames.length > 0 && cp.frameOrdinal > lastOrdinal) {
      issues.push(
        `checkpoint "${cp.checkpointId}" frameOrdinal ${cp.frameOrdinal} ` +
          `exceeds last frame ordinal ${lastOrdinal}`
      )
    }
  }

  if (issues.length > 0) throw new TraceValidationError(issues)
  return trace
}
