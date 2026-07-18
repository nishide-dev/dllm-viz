import type { DiffusionTrace, TracePlayer } from "@dllm-viz/core"
import { createPlayer } from "@dllm-viz/core"
import type { ReactNode } from "react"
import { createContext, useEffect, useMemo, useRef } from "react"

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
  // Player identity follows the trace object; initialFrame and
  // frameIntervalMs are applied at creation time only, read through a ref
  // so option props never recreate the player.
  const optionsRef = useRef({ initialFrame, playbackRate, frameIntervalMs })
  optionsRef.current = { initialFrame, playbackRate, frameIntervalMs }
  const player = useMemo(() => createPlayer(trace, optionsRef.current), [trace])

  // playbackRate is live: prop changes after mount take effect (spec §10.2).
  useEffect(() => {
    player.setPlaybackRate(playbackRate)
  }, [player, playbackRate])

  useEffect(() => {
    if (autoPlay) player.play()
    return () => player.pause()
  }, [player, autoPlay])

  return (
    <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
  )
}
