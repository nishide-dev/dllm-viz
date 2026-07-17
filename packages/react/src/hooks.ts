import type {
  DiffusionFrame,
  DiffusionSnapshot,
  FrameMetrics,
  TokenSlot,
  TracePlayer,
  TraceProvenance,
} from "@dllm-viz/core"
import { useContext, useSyncExternalStore } from "react"

import { PlayerContext } from "./provider"

export function useDiffusionPlayer(): TracePlayer {
  const player = useContext(PlayerContext)
  if (player === null) {
    throw new Error(
      "useDiffusionPlayer must be used within a DiffusionTraceProvider"
    )
  }
  return player
}

export function useDiffusionSnapshot(): DiffusionSnapshot {
  const player = useDiffusionPlayer()
  return useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getSnapshot
  )
}

export function useDiffusionFrame(): DiffusionFrame | undefined {
  return useDiffusionSnapshot().frame
}

export function useTokenSlots(): TokenSlot[] {
  return useDiffusionSnapshot().slots
}

export function useTraceMetrics(): FrameMetrics | undefined {
  return useDiffusionSnapshot().metrics
}

export function useTraceProvenance(): TraceProvenance {
  return useDiffusionPlayer().trace.provenance
}
