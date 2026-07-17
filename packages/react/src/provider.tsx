import type { DiffusionTrace, TracePlayer } from "@dllm-viz/core"
import { createPlayer } from "@dllm-viz/core"
import type { ReactNode } from "react"
import { createContext, useEffect, useMemo } from "react"

export const PlayerContext = createContext<TracePlayer | null>(null)

export interface DiffusionTraceProviderProps {
  trace: DiffusionTrace
  initialFrame?: number
  playbackRate?: number
  autoPlay?: boolean
  frameIntervalMs?: number
  children: ReactNode
}

export function DiffusionTraceProvider({
  trace,
  initialFrame = 0,
  playbackRate = 1,
  autoPlay = false,
  frameIntervalMs,
  children,
}: DiffusionTraceProviderProps) {
  // Player identity follows the trace object; playback options are
  // applied at creation time only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: options are creation-time only
  const player = useMemo(
    () => createPlayer(trace, { initialFrame, playbackRate, frameIntervalMs }),
    [trace]
  )

  useEffect(() => {
    if (autoPlay) player.play()
    return () => player.pause()
  }, [player, autoPlay])

  return (
    <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
  )
}
