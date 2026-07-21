import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { DenoisingTokenCanvas } from "@/components/denoising-token-canvas"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import type { DiffusionTrace } from "@/lib/dllm-viz-core"
import { materializeSlots } from "@/lib/dllm-viz-core"
import {
  DiffusionTraceProvider,
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useReducedMotion,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

/** A settled turn (plain text) or an assistant turn replaying a trace. */
export type ChatTurn =
  | { id: string; role: "user" | "assistant"; text: string }
  | {
      id: string
      role: "assistant"
      trace: DiffusionTrace
      autoPlay?: boolean
    }

export interface DiffusionChatProps {
  turns: ChatTurn[]
  /** Fires once per trace turn when playback first reaches the last frame. */
  onGenerationEnd?: (turnId: string) => void
  className?: string
}

const controlClass =
  "inline-flex size-7 items-center justify-center rounded border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"

function SettledTurn({
  role,
  text,
}: {
  role: "user" | "assistant"
  text: string
}) {
  const align = role === "user" ? "end" : "start"
  return (
    <Message align={align}>
      <MessageContent>
        <Bubble align={align} variant={role === "user" ? "default" : "muted"}>
          {/* Token text is rendered as text, never HTML (spec §20).
              Markdown rendering is deferred to a later sanitized-renderer
              upgrade; `text` stays forward-compatible. */}
          <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/**
 * Assistant bubble replaying a diffusion trace. Pausing halts visual
 * playback only (spec §15.11): in static replay there is no inference,
 * and under live streaming the player keeps accumulating appendFrame
 * while paused — pausing never cancels or blocks ingestion.
 */
function TraceBubble({
  onGenerationEnd,
  trace,
  turnId,
}: {
  onGenerationEnd?: (turnId: string) => void
  trace: DiffusionTrace
  turnId: string
}) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const reducedMotion = useReducedMotion()
  const [showGeneration, setShowGeneration] = useState(false)
  const endedRef = useRef(false)

  const hasFrames = player.frameCount > 0
  const atEnd = hasFrames && snapshot.frameIndex === player.frameCount - 1
  const playing = snapshot.status === "playing"

  useEffect(() => {
    if (atEnd && !endedRef.current) {
      endedRef.current = true
      onGenerationEnd?.(turnId)
    }
  }, [atEnd, onGenerationEnd, turnId])

  // final.text minus the prompt region, derived from the trace itself.
  const settledText = useMemo(() => {
    if (!hasFrames) return trace.final?.text ?? ""
    return materializeSlots(trace, trace.frames.length - 1)
      .filter((slot) => slot.region !== "prompt" && slot.state !== "prompt")
      .map((slot) => slot.text ?? "")
      .join("")
      .trimStart()
  }, [hasFrames, trace])

  const settled = atEnd && !showGeneration
  const step = snapshot.frame?.step ?? Math.max(snapshot.frameIndex, 0)
  const totalSteps =
    trace.generation.totalSteps ?? Math.max(player.frameCount - 1, 0)
  const status = playing
    ? `Denoising · step ${step}/${totalSteps}`
    : hasFrames
      ? "Replay paused"
      : "Waiting for frames"

  return (
    <Message align="start">
      <MessageContent>
        <Bubble align="start" variant="outline">
          <BubbleContent className="flex w-full flex-col gap-2">
            {settled ? (
              <>
                {provenance.mode !== "measured" && (
                  <span
                    className="self-start rounded border border-dashed px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
                    title={provenance.notes?.join(" ")}
                  >
                    {provenance.mode}
                  </span>
                )}
                <p className="whitespace-pre-wrap">{settledText}</p>
                <button
                  className="self-start text-muted-foreground text-xs underline"
                  onClick={() => {
                    setShowGeneration(true)
                    player.seek(0)
                  }}
                  type="button"
                >
                  Show generation
                </button>
              </>
            ) : (
              <>
                <DenoisingTokenCanvas showPrompt={false} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    aria-label="Previous frame"
                    className={controlClass}
                    onClick={() => player.stepBackward()}
                    type="button"
                  >
                    <ChevronLeft aria-hidden className="size-3.5" />
                  </button>
                  <button
                    aria-label={playing ? "Pause replay" : "Resume replay"}
                    className={controlClass}
                    onClick={() => player.toggle()}
                    type="button"
                  >
                    {playing ? (
                      <Pause aria-hidden className="size-3.5" />
                    ) : (
                      <Play aria-hidden className="size-3.5" />
                    )}
                  </button>
                  <button
                    aria-label="Next frame"
                    className={controlClass}
                    onClick={() => player.stepForward()}
                    type="button"
                  >
                    <ChevronRight aria-hidden className="size-3.5" />
                  </button>
                  {atEnd && (
                    <button
                      className="text-muted-foreground text-xs underline"
                      onClick={() => setShowGeneration(false)}
                      type="button"
                    >
                      Show final answer
                    </button>
                  )}
                </div>
                <Marker>
                  <MarkerContent
                    className={cn(playing && !reducedMotion && "animate-pulse")}
                  >
                    {status}
                  </MarkerContent>
                </Marker>
              </>
            )}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/**
 * Chat surface embedding diffusion generation without reducing it to
 * typing (spec §15.11): the mutable answer renders as a token canvas —
 * characters are never appended one at a time. Renders the conversation
 * only; prompt input chrome belongs to the consumer.
 */
export function DiffusionChat({
  turns,
  onGenerationEnd,
  className,
}: DiffusionChatProps) {
  return (
    <MessageScrollerProvider>
      <MessageScroller className={cn("min-h-0", className)}>
        <MessageScrollerViewport>
          <MessageScrollerContent
            aria-label="Conversation"
            className="p-4"
            role="log"
          >
            {turns.map((turn) => (
              <MessageScrollerItem key={turn.id}>
                {"trace" in turn ? (
                  <DiffusionTraceProvider
                    autoPlay={turn.autoPlay ?? false}
                    trace={turn.trace}
                  >
                    <TraceBubble
                      onGenerationEnd={onGenerationEnd}
                      trace={turn.trace}
                      turnId={turn.id}
                    />
                  </DiffusionTraceProvider>
                ) : (
                  <SettledTurn role={turn.role} text={turn.text} />
                )}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
