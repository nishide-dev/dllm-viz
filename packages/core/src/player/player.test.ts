import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DiffusionTrace } from "../schema/types"
import { maskedRemaskTrace } from "../testing/fixtures"
import { createPlayer } from "./player"

const textAt = (p: ReturnType<typeof createPlayer>, slotId: string) =>
  p.getSnapshot().slots.find((s) => s.slotId === slotId)

// appendFrame/appendCheckpoint/complete reject traces closed by `final`,
// so live-append tests use the fixture without its final result.
function openTrace(): DiffusionTrace {
  const { final: _final, ...rest } = maskedRemaskTrace
  return rest
}

function emptyTrace(): DiffusionTrace {
  return { ...openTrace(), frames: [], checkpoints: [] }
}

describe("createPlayer", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("starts idle at frame 0", () => {
    const p = createPlayer(maskedRemaskTrace)
    expect(p.status).toBe("idle")
    expect(p.frameIndex).toBe(0)
    expect(p.frameCount).toBe(7)
  })

  it("seek and stepBackward reconstruct deterministically", () => {
    const p = createPlayer(maskedRemaskTrace)
    p.seek(5)
    expect(textAt(p, "s3")).toMatchObject({ state: "committed", text: " blue" })
    p.stepBackward()
    expect(textAt(p, "s3")).toMatchObject({ state: "masked" })
    p.stepBackward(2)
    expect(textAt(p, "s3")).toMatchObject({
      state: "committed",
      text: " green",
    })
  })

  it("seek clamps to valid range", () => {
    const p = createPlayer(maskedRemaskTrace)
    p.seek(999)
    expect(p.frameIndex).toBe(6)
    p.seek(-5)
    expect(p.frameIndex).toBe(0)
  })

  it("getSnapshot is referentially stable until a change", () => {
    const p = createPlayer(maskedRemaskTrace)
    expect(p.getSnapshot()).toBe(p.getSnapshot())
    const before = p.getSnapshot()
    p.stepForward()
    expect(p.getSnapshot()).not.toBe(before)
  })

  it("play notifies subscribers immediately so status is visible without a tick", () => {
    const p = createPlayer(maskedRemaskTrace, { frameIntervalMs: 100 })
    const listener = vi.fn()
    p.subscribe(listener)
    p.play()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("play advances on the timer and ends after the last frame", () => {
    const p = createPlayer(maskedRemaskTrace, { frameIntervalMs: 100 })
    const listener = vi.fn()
    p.subscribe(listener)
    p.play()
    expect(p.status).toBe("playing")
    vi.advanceTimersByTime(100)
    expect(p.frameIndex).toBe(1)
    vi.advanceTimersByTime(600)
    expect(p.frameIndex).toBe(6)
    expect(p.status).toBe("ended")
    expect(listener).toHaveBeenCalled()
  })

  it("setPlaybackRate rescales the timer", () => {
    const p = createPlayer(maskedRemaskTrace, { frameIntervalMs: 100 })
    p.setPlaybackRate(2)
    p.play()
    vi.advanceTimersByTime(50)
    expect(p.frameIndex).toBe(1)
  })

  it("pause stops advancing; toggle resumes", () => {
    const p = createPlayer(maskedRemaskTrace, { frameIntervalMs: 100 })
    p.play()
    vi.advanceTimersByTime(100)
    p.pause()
    vi.advanceTimersByTime(500)
    expect(p.frameIndex).toBe(1)
    p.toggle()
    expect(p.status).toBe("playing")
  })

  it("appendFrame accepts the next ordinal and rejects conflicts", () => {
    const p = createPlayer(openTrace())
    p.appendFrame({
      frameId: "f7",
      ordinal: 7,
      kind: "denoise",
      operations: [],
    })
    expect(p.frameCount).toBe(8)
    expect(() =>
      p.appendFrame({
        frameId: "f7",
        ordinal: 8,
        kind: "denoise",
        operations: [],
      })
    ).toThrow(/frameId/)
    expect(() =>
      p.appendFrame({
        frameId: "f9",
        ordinal: 3,
        kind: "denoise",
        operations: [],
      })
    ).toThrow(/ordinal/)
  })

  it("appendFrame does not mutate the input trace", () => {
    const input = openTrace()
    const frameCountBefore = input.frames.length
    const p = createPlayer(input)
    p.appendFrame({
      frameId: "fx",
      ordinal: 7,
      kind: "denoise",
      operations: [],
    })
    expect(input.frames.length).toBe(frameCountBefore)
  })

  it("appendFrame revives an ended player to paused", () => {
    const p = createPlayer(openTrace(), { frameIntervalMs: 10 })
    p.play()
    vi.advanceTimersByTime(1000)
    expect(p.status).toBe("ended")
    p.appendFrame({
      frameId: "f7",
      ordinal: 7,
      kind: "denoise",
      operations: [],
    })
    expect(p.status).toBe("paused")
  })

  it("complete stores the final result", () => {
    const p = createPlayer(openTrace())
    p.complete({ text: "done" })
    expect(p.trace.final?.text).toBe("done")
  })

  it("supports a trace with no frames yet (live streaming)", () => {
    const p = createPlayer(emptyTrace())
    expect(p.frameIndex).toBe(-1)
    expect(p.frameCount).toBe(0)
    expect(p.getSnapshot().frame).toBeUndefined()
    expect(p.getSnapshot().slots).toEqual(maskedRemaskTrace.initial.slots)
    p.appendFrame(maskedRemaskTrace.frames[0])
    p.appendFrame(maskedRemaskTrace.frames[1])
    p.seek(1)
    expect(textAt(p, "s4")).toMatchObject({ state: "committed" })
  })

  it("play on an empty trace does not crash and simply ends", () => {
    const p = createPlayer(emptyTrace(), { frameIntervalMs: 100 })
    expect(() => p.play()).not.toThrow()
    vi.advanceTimersByTime(100)
    expect(p.status).toBe("ended")
    expect(p.frameIndex).toBe(-1)
  })

  it("seek on an empty trace clamps to -1", () => {
    const p = createPlayer(emptyTrace())
    p.seek(5)
    expect(p.frameIndex).toBe(-1)
  })

  it("appendFrame rejects schema-invalid frames", () => {
    const p = createPlayer(openTrace())
    expect(() =>
      p.appendFrame({ ordinal: 7 } as unknown as DiffusionTrace["frames"][0])
    ).toThrow(/invalid frame/)
  })

  it("appendFrame and appendCheckpoint throw after complete()", () => {
    const p = createPlayer(openTrace())
    p.complete({ text: "done" })
    expect(() =>
      p.appendFrame({
        frameId: "f7",
        ordinal: 7,
        kind: "denoise",
        operations: [],
      })
    ).toThrow(/closed by final/)
    expect(() =>
      p.appendCheckpoint({ checkpointId: "cp-x", frameOrdinal: 3, slots: [] })
    ).toThrow(/closed by final/)
  })

  it("complete throws on double-final", () => {
    const p = createPlayer(openTrace())
    p.complete({ text: "done" })
    expect(() => p.complete({ text: "again" })).toThrow(/closed by final/)
  })

  it("appendCheckpoint validates ordinals and duplicate slots", () => {
    const p = createPlayer(openTrace())
    expect(() =>
      p.appendCheckpoint({
        checkpointId: "cp-dup",
        frameOrdinal: 2,
        slots: [
          { slotId: "s0", index: 0, state: "masked" },
          { slotId: "s0", index: 1, state: "masked" },
        ],
      })
    ).toThrow(/duplicate slotId/)
    expect(() =>
      p.appendCheckpoint({
        checkpointId: "cp-far",
        frameOrdinal: 99,
        slots: [],
      })
    ).toThrow(/exceeds last frame ordinal/)
    p.appendCheckpoint({ checkpointId: "cp-2", frameOrdinal: 2, slots: [] })
    expect(() =>
      p.appendCheckpoint({ checkpointId: "cp-old", frameOrdinal: 2, slots: [] })
    ).toThrow(/must exceed/)
  })

  it("setPlaybackRate rejects NaN and non-positive rates", () => {
    const p = createPlayer(maskedRemaskTrace)
    expect(() => p.setPlaybackRate(Number.NaN)).toThrow(/playbackRate/)
    expect(() => p.setPlaybackRate(0)).toThrow(/playbackRate/)
    expect(() => p.setPlaybackRate(-1)).toThrow(/playbackRate/)
  })

  it("seek rejects non-integer targets", () => {
    const p = createPlayer(maskedRemaskTrace)
    expect(() => p.seek(Number.NaN)).toThrow(/integer/)
    expect(() => p.seek(1.5)).toThrow(/integer/)
  })

  it("methods throw after dispose, and dispose stays idempotent", () => {
    const p = createPlayer(maskedRemaskTrace)
    p.dispose()
    expect(() => p.dispose()).not.toThrow()
    expect(() => p.play()).toThrow(/disposed/)
    expect(() => p.seek(1)).toThrow(/disposed/)
    expect(() => p.stepForward()).toThrow(/disposed/)
    expect(() => p.stepBackward()).toThrow(/disposed/)
    expect(() =>
      p.appendFrame({
        frameId: "fx",
        ordinal: 7,
        kind: "denoise",
        operations: [],
      })
    ).toThrow(/disposed/)
    expect(() =>
      p.appendCheckpoint({ checkpointId: "cp-x", frameOrdinal: 3, slots: [] })
    ).toThrow(/disposed/)
    expect(() => p.complete()).toThrow(/disposed/)
  })

  it("a frame that fails during a timer tick pauses instead of freezing", () => {
    // Frame f2 references a slot that never existed; the timer path must
    // swallow the throw into a pause so subscribers observe the stall.
    const poisoned: DiffusionTrace = {
      ...maskedRemaskTrace,
      frames: maskedRemaskTrace.frames.map((frame) =>
        frame.frameId === "f2"
          ? { ...frame, operations: [{ type: "mask", slotId: "ghost" }] }
          : frame
      ),
    }
    const p = createPlayer(poisoned, { frameIntervalMs: 100 })
    p.play()
    vi.advanceTimersByTime(100)
    expect(p.frameIndex).toBe(1)
    vi.advanceTimersByTime(100)
    expect(p.status).toBe("paused")
    expect(p.frameIndex).toBe(1)
    // Synchronous seeking still surfaces the error to the caller.
    expect(() => p.stepForward()).toThrow(/ghost/)
  })

  it("dispose stops the timer and drops listeners", () => {
    const p = createPlayer(maskedRemaskTrace, { frameIntervalMs: 100 })
    const listener = vi.fn()
    p.subscribe(listener)
    p.play()
    // play() itself notifies once (status change visible without a tick);
    // dispose must prevent any *further* notifications from pending ticks.
    expect(listener).toHaveBeenCalledTimes(1)
    p.dispose()
    vi.advanceTimersByTime(500)
    expect(p.frameIndex).toBe(0)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
