import type {
  DiffusionFrame,
  DiffusionPlayer,
  DiffusionSnapshot,
  DiffusionTrace,
  FinalResult,
  TokenSlot,
  TraceCheckpoint,
} from "../schema/types"
import { DiffusionFrameSchema, TraceCheckpointSchema } from "../schema/zod"
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
  // Give workingTrace its own identity (appendFrame/appendCheckpoint
  // already copy-on-write) and normalize `checkpoints` to a defined array.
  let workingTrace: DiffusionTrace = {
    ...trace,
    frames: [...trace.frames],
    checkpoints: [...(trace.checkpoints ?? [])],
  }
  // With no frames yet (live streaming), -1 means "initial slots".
  let frameIndex =
    workingTrace.frames.length === 0
      ? -1
      : Math.min(
          Math.max(options.initialFrame ?? 0, 0),
          workingTrace.frames.length - 1
        )
  let rate = options.playbackRate ?? 1
  const frameIntervalMs = options.frameIntervalMs ?? 250
  let status: Status = "idle"
  let disposed = false
  let slots: TokenSlot[] = materializeSlots(workingTrace, frameIndex)
  let cachedSnapshot: DiffusionSnapshot | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()

  const assertNotDisposed = () => {
    if (disposed) throw new Error("player is disposed")
  }

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
    try {
      seekTo(frameIndex + 1)
    } catch {
      // A corrupt frame must not leave the player "playing" forever with a
      // dead timer; pause so subscribers observe the stall.
      status = "paused"
      stopTimer()
      notify()
      return
    }
    if (frameIndex >= workingTrace.frames.length - 1) {
      status = "ended"
      stopTimer()
      notify()
    } else {
      scheduleTick()
    }
  }

  const seekTo = (target: number) => {
    if (!Number.isInteger(target)) {
      throw new Error(`seek target must be an integer, got ${target}`)
    }
    // With no frames the only valid position is -1 (initial slots).
    const min = workingTrace.frames.length === 0 ? -1 : 0
    const clamped = Math.min(
      Math.max(target, min),
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
      assertNotDisposed()
      if (status === "playing") return
      if (status === "ended") seekTo(0)
      status = "playing"
      notify()
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
      assertNotDisposed()
      seekTo(target)
    },
    stepForward(count = 1) {
      assertNotDisposed()
      seekTo(frameIndex + count)
    },
    stepBackward(count = 1) {
      assertNotDisposed()
      seekTo(frameIndex - count)
    },
    setPlaybackRate(next) {
      if (!Number.isFinite(next) || next <= 0) {
        throw new Error("playbackRate must be a finite number > 0")
      }
      rate = next
      if (status === "playing") scheduleTick()
      notify()
    },
    appendFrame(frame: DiffusionFrame) {
      assertNotDisposed()
      if (workingTrace.final !== undefined) {
        throw new Error("appendFrame: trace already closed by final")
      }
      const parsed = DiffusionFrameSchema.safeParse(frame)
      if (!parsed.success) {
        throw new Error(
          `appendFrame: invalid frame: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`
        )
      }
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
      assertNotDisposed()
      if (workingTrace.final !== undefined) {
        throw new Error("appendCheckpoint: trace already closed by final")
      }
      const parsed = TraceCheckpointSchema.safeParse(checkpoint)
      if (!parsed.success) {
        throw new Error(
          `appendCheckpoint: invalid checkpoint: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`
        )
      }
      const seen = new Set<string>()
      for (const slot of checkpoint.slots) {
        if (seen.has(slot.slotId)) {
          throw new Error(`appendCheckpoint: duplicate slotId "${slot.slotId}"`)
        }
        seen.add(slot.slotId)
      }
      const checkpoints = workingTrace.checkpoints ?? []
      const lastCheckpointOrdinal =
        checkpoints[checkpoints.length - 1]?.frameOrdinal ??
        workingTrace.initial.frameOrdinal
      if (checkpoint.frameOrdinal <= lastCheckpointOrdinal) {
        throw new Error(
          `appendCheckpoint: frameOrdinal ${checkpoint.frameOrdinal} must ` +
            `exceed ${lastCheckpointOrdinal}`
        )
      }
      const lastFrameOrdinal =
        workingTrace.frames[workingTrace.frames.length - 1]?.ordinal ?? -1
      if (checkpoint.frameOrdinal > lastFrameOrdinal) {
        throw new Error(
          `appendCheckpoint: frameOrdinal ${checkpoint.frameOrdinal} exceeds ` +
            `last frame ordinal ${lastFrameOrdinal}`
        )
      }
      workingTrace = {
        ...workingTrace,
        checkpoints: [...checkpoints, checkpoint],
      }
      notify()
    },
    complete(result?: FinalResult) {
      assertNotDisposed()
      if (workingTrace.final !== undefined) {
        throw new Error("complete: trace already closed by final")
      }
      if (result) workingTrace = { ...workingTrace, final: result }
      notify()
    },
    dispose() {
      disposed = true
      stopTimer()
      listeners.clear()
      status = "idle"
    },
  }

  return player
}
