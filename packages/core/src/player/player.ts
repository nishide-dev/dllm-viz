import type {
  DiffusionFrame,
  DiffusionPlayer,
  DiffusionSnapshot,
  DiffusionTrace,
  FinalResult,
  TokenSlot,
  TraceCheckpoint,
} from "../schema/types"
import { applyOperations } from "./apply"
import { materializeSlots } from "./materialize"

// `core` has no DOM/Node lib dependency, so declare the ambient timer
// globals locally. Both browser and Node provide these at runtime.
declare function setTimeout(callback: () => void, ms?: number): number
declare function clearTimeout(id: number): void

export interface PlayerOptions {
  initialFrame?: number
  playbackRate?: number
  frameIntervalMs?: number
}

export interface TracePlayer extends DiffusionPlayer {
  subscribe(listener: () => void): () => void
}

type Status = DiffusionPlayer["status"]

export function createPlayer(
  trace: DiffusionTrace,
  options: PlayerOptions = {}
): TracePlayer {
  // Clone the mutable collections so appendFrame/appendCheckpoint never
  // mutate the caller's trace object.
  let workingTrace: DiffusionTrace = {
    ...trace,
    frames: [...trace.frames],
    checkpoints: [...(trace.checkpoints ?? [])],
  }
  let frameIndex = Math.min(
    Math.max(options.initialFrame ?? 0, 0),
    Math.max(workingTrace.frames.length - 1, 0)
  )
  let rate = options.playbackRate ?? 1
  const frameIntervalMs = options.frameIntervalMs ?? 250
  let status: Status = "idle"
  let slots: TokenSlot[] = materializeSlots(workingTrace, frameIndex)
  let cachedSnapshot: DiffusionSnapshot | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()

  const notify = () => {
    cachedSnapshot = null
    for (const listener of listeners) listener()
  }

  const stopTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const scheduleTick = () => {
    stopTimer()
    timer = setTimeout(tick, frameIntervalMs / rate)
  }

  const tick = () => {
    if (status !== "playing") return
    if (frameIndex >= workingTrace.frames.length - 1) {
      status = "ended"
      stopTimer()
      notify()
      return
    }
    seekTo(frameIndex + 1)
    if (frameIndex >= workingTrace.frames.length - 1) {
      status = "ended"
      stopTimer()
      notify()
    } else {
      scheduleTick()
    }
  }

  const seekTo = (target: number) => {
    const clamped = Math.min(
      Math.max(target, 0),
      workingTrace.frames.length - 1
    )
    if (clamped === frameIndex) return
    if (clamped === frameIndex + 1) {
      // Fast path: apply the next frame's delta incrementally.
      slots = applyOperations(slots, workingTrace.frames[clamped].operations)
    } else {
      slots = materializeSlots(workingTrace, clamped)
    }
    frameIndex = clamped
    notify()
  }

  const player: TracePlayer = {
    get trace() {
      return workingTrace
    },
    get frameIndex() {
      return frameIndex
    },
    get frameCount() {
      return workingTrace.frames.length
    },
    get status() {
      return status
    },
    getSnapshot() {
      if (cachedSnapshot === null) {
        cachedSnapshot = {
          frameIndex,
          frame: workingTrace.frames[frameIndex],
          slots,
          metrics: workingTrace.frames[frameIndex]?.metrics,
          status,
        }
      }
      return cachedSnapshot
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    play() {
      if (status === "playing") return
      if (status === "ended") seekTo(0)
      status = "playing"
      cachedSnapshot = null
      scheduleTick()
    },
    pause() {
      if (status !== "playing") return
      status = "paused"
      stopTimer()
      notify()
    },
    toggle() {
      if (status === "playing") player.pause()
      else player.play()
    },
    seek(target) {
      seekTo(target)
    },
    stepForward(count = 1) {
      seekTo(frameIndex + count)
    },
    stepBackward(count = 1) {
      seekTo(frameIndex - count)
    },
    setPlaybackRate(next) {
      if (next <= 0) throw new Error("playbackRate must be > 0")
      rate = next
      if (status === "playing") scheduleTick()
      notify()
    },
    appendFrame(frame: DiffusionFrame) {
      const last = workingTrace.frames[workingTrace.frames.length - 1]
      if (last && frame.ordinal <= last.ordinal) {
        throw new Error(
          `appendFrame: ordinal ${frame.ordinal} must exceed ${last.ordinal}`
        )
      }
      if (workingTrace.frames.some((f) => f.frameId === frame.frameId)) {
        throw new Error(`appendFrame: duplicate frameId "${frame.frameId}"`)
      }
      workingTrace = {
        ...workingTrace,
        frames: [...workingTrace.frames, frame],
      }
      if (status === "ended") status = "paused"
      notify()
    },
    appendCheckpoint(checkpoint: TraceCheckpoint) {
      workingTrace = {
        ...workingTrace,
        checkpoints: [...(workingTrace.checkpoints ?? []), checkpoint],
      }
      notify()
    },
    complete(result?: FinalResult) {
      if (result) workingTrace = { ...workingTrace, final: result }
      notify()
    },
    dispose() {
      stopTimer()
      listeners.clear()
      status = "idle"
    },
  }

  return player
}
