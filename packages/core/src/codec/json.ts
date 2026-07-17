import type { DiffusionTrace } from "../schema/types"
import type { ValidateOptions } from "../schema/validate"
import { parseTrace } from "../schema/validate"
import { StreamEventSchema } from "../schema/zod"

export function parseTraceJson(
  text: string,
  options?: ValidateOptions
): DiffusionTrace {
  return parseTrace(JSON.parse(text), options)
}

export function parseTraceJsonl(
  text: string,
  options?: ValidateOptions
): DiffusionTrace {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) {
    throw new Error("parseTraceJsonl: empty input")
  }
  const events = lines.map((line, i) => {
    const result = StreamEventSchema.safeParse(JSON.parse(line))
    if (!result.success) {
      throw new Error(`parseTraceJsonl: invalid event on line ${i + 1}`)
    }
    return result.data
  })
  const [first, ...rest] = events
  if (first.type !== "metadata") {
    throw new Error("parseTraceJsonl: first event must be metadata")
  }
  const assembled = {
    ...first.trace,
    frames: [...(first.trace.frames ?? [])],
    checkpoints: [...(first.trace.checkpoints ?? [])],
  }
  for (const event of rest) {
    if (event.type === "frame") assembled.frames.push(event.frame)
    else if (event.type === "checkpoint")
      assembled.checkpoints.push(event.checkpoint)
    else if (event.type === "final") assembled.final = event.final
    else throw new Error("parseTraceJsonl: metadata may only appear once")
  }
  return parseTrace(assembled, options)
}
