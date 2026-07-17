import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react"
import {
  useDiffusionKeyboard,
  useDiffusionPlayer,
  useDiffusionSnapshot,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

export interface DiffusionStepControlsProps {
  keyboard?: boolean
  className?: string
}

const RATES = [0.5, 1, 2, 4]

const buttonClass =
  "inline-flex size-8 items-center justify-center rounded border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"

export function DiffusionStepControls({
  keyboard = true,
  className,
}: DiffusionStepControlsProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  useDiffusionKeyboard({ enabled: keyboard })
  const playing = snapshot.status === "playing"
  const frame = snapshot.frame

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        aria-label="First frame"
        className={buttonClass}
        onClick={() => player.seek(0)}
        type="button"
      >
        <SkipBack aria-hidden className="size-4" />
      </button>
      <button
        aria-label="Previous frame"
        className={buttonClass}
        onClick={() => player.stepBackward()}
        type="button"
      >
        <ChevronLeft aria-hidden className="size-4" />
      </button>
      <button
        aria-label={playing ? "Pause" : "Play"}
        className={buttonClass}
        onClick={() => player.toggle()}
        type="button"
      >
        {playing ? (
          <Pause aria-hidden className="size-4" />
        ) : (
          <Play aria-hidden className="size-4" />
        )}
      </button>
      <button
        aria-label="Next frame"
        className={buttonClass}
        onClick={() => player.stepForward()}
        type="button"
      >
        <ChevronRight aria-hidden className="size-4" />
      </button>
      <button
        aria-label="Last frame"
        className={buttonClass}
        onClick={() => player.seek(player.frameCount - 1)}
        type="button"
      >
        <SkipForward aria-hidden className="size-4" />
      </button>
      <input
        aria-label="Frame"
        className="min-w-24 flex-1 accent-[var(--dllm-committed,#10b981)]"
        max={player.frameCount - 1}
        min={0}
        onChange={(event) => player.seek(Number(event.target.value))}
        type="range"
        value={snapshot.frameIndex}
      />
      <select
        aria-label="Playback rate"
        className="rounded border px-1 py-0.5 text-xs"
        defaultValue="1"
        onChange={(event) => player.setPlaybackRate(Number(event.target.value))}
      >
        {RATES.map((rate) => (
          <option key={rate} value={rate}>
            {rate}x
          </option>
        ))}
      </select>
      <span className="font-mono text-muted-foreground text-xs tabular-nums">
        Frame {snapshot.frameIndex + 1}/{player.frameCount}
        {frame?.step !== undefined && ` · step ${frame.step}`}
        {frame?.canvasIndex !== undefined &&
          ` · canvas ${frame.canvasIndex}${
            frame.innerStep !== undefined ? `:${frame.innerStep}` : ""
          }`}
      </span>
    </div>
  )
}
