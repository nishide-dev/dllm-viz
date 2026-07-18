import { describe, expect, it } from "vitest"

import { maskedRemaskTrace } from "../testing/fixtures"
import { parseTraceJson, parseTraceJsonl } from "./json"

function toJsonl(): string {
  const { frames, checkpoints, final, ...header } = maskedRemaskTrace
  const lines = [
    JSON.stringify({ type: "metadata", trace: { ...header, frames: [] } }),
    ...frames.map((frame) => JSON.stringify({ type: "frame", frame })),
    ...(checkpoints ?? []).map((checkpoint) =>
      JSON.stringify({ type: "checkpoint", checkpoint })
    ),
    ...(final ? [JSON.stringify({ type: "final", final })] : []),
  ]
  return `${lines.join("\n")}\n`
}

describe("codec", () => {
  it("round-trips a trace through JSON", () => {
    const parsed = parseTraceJson(JSON.stringify(maskedRemaskTrace))
    expect(parsed).toEqual(maskedRemaskTrace)
  })

  it("assembles a trace from JSONL stream events", () => {
    const parsed = parseTraceJsonl(toJsonl())
    expect(parsed.frames).toHaveLength(maskedRemaskTrace.frames.length)
    expect(parsed.final?.text).toBe(maskedRemaskTrace.final?.text)
  })

  it("keeps a partial stream (no final) replayable", () => {
    const lines = toJsonl().trim().split("\n")
    const partial = lines.slice(0, 4).join("\n") // metadata + 3 frames
    const parsed = parseTraceJsonl(partial)
    expect(parsed.frames).toHaveLength(3)
    expect(parsed.final).toBeUndefined()
  })

  it("rejects a frame event after final closes the trace", () => {
    const lines = toJsonl().trim().split("\n")
    expect(() => parseTraceJsonl([...lines, lines[1]].join("\n"))).toThrow(
      /event after final/
    )
  })

  it("rejects a duplicate final event", () => {
    const lines = toJsonl().trim().split("\n")
    const final = lines.at(-1)
    expect(final).toBeDefined()
    expect(() => parseTraceJsonl([...lines, final].join("\n"))).toThrow(
      /event after final/
    )
  })

  it("rejects a stream that does not start with metadata", () => {
    const lines = toJsonl().trim().split("\n")
    expect(() => parseTraceJsonl(lines.slice(1).join("\n"))).toThrow(/metadata/)
  })

  it("rejects invalid JSON lines", () => {
    expect(() => parseTraceJsonl("not json")).toThrow()
  })

  it("reports the line number of malformed JSON", () => {
    const lines = toJsonl().trim().split("\n")
    expect(() =>
      parseTraceJsonl([lines[0], "{oops", ...lines.slice(1)].join("\n"))
    ).toThrow(/malformed JSON on line 2/)
  })

  it("includes zod issue details for schema-invalid events", () => {
    const lines = toJsonl().trim().split("\n")
    const invalid = JSON.stringify({ type: "frame", frame: { ordinal: 99 } })
    expect(() =>
      parseTraceJsonl([...lines.slice(0, -1), invalid].join("\n"))
    ).toThrow(/frame\.frameId/)
  })

  it("rejects a duplicated frame event via trace validation", () => {
    const lines = toJsonl().trim().split("\n")
    const frameLine = lines[1]
    const withoutFinal = lines.slice(0, -1)
    expect(() =>
      parseTraceJsonl([...withoutFinal, frameLine].join("\n"))
    ).toThrow(/frameId/)
  })

  it("rejects a second metadata event", () => {
    const lines = toJsonl().trim().split("\n")
    const withoutFinal = lines.slice(0, -1)
    expect(() =>
      parseTraceJsonl([...withoutFinal, lines[0]].join("\n"))
    ).toThrow(/metadata may only appear once/)
  })
})
