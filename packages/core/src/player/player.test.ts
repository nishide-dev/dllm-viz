import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { maskedRemaskTrace } from "../testing/fixtures"
import { createPlayer } from "./player"

const textAt = (p: ReturnType<typeof createPlayer>, slotId: string) =>
  p.getSnapshot().slots.find((s) => s.slotId === slotId)

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
    const p = createPlayer(maskedRemaskTrace)
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
    const frameCountBefore = maskedRemaskTrace.frames.length
    const p = createPlayer(maskedRemaskTrace)
    p.appendFrame({
      frameId: "fx",
      ordinal: 7,
      kind: "denoise",
      operations: [],
    })
    expect(maskedRemaskTrace.frames.length).toBe(frameCountBefore)
  })

  it("appendFrame revives an ended player to paused", () => {
    const p = createPlayer(maskedRemaskTrace, { frameIntervalMs: 10 })
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
    const p = createPlayer(maskedRemaskTrace)
    p.complete({ text: "done" })
    expect(p.trace.final?.text).toBe("done")
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
