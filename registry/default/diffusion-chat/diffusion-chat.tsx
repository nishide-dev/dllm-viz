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
import {
  DiffusionTraceProvider,
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useReducedMotion,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

/**
 * A settled turn (plain text) or an assistant turn replaying a trace.
 * `text` and `trace` are mutually exclusive by construction.
 */
export type ChatTurn =
  | {
      id: string
      role: "user" | "assistant"
      text: string
      trace?: never
      autoPlay?: never
    }
  | {
      id: string
      role: "assistant"
      trace: DiffusionTrace
      /** Start replaying this turn's trace on mount. @default false */
      autoPlay?: boolean
      text?: never
    }

export interface DiffusionChatProps {
  turns: ChatTurn[]
  /**
   * Fires once per mounted trace turn when the player first reaches the
   * last frame (this can happen at mount for single-frame or closed
   * traces, and via manual stepping).
   */
  onGenerationEnd?: (turnId: string) => void
  className?: string
}

const controlClass =
  "inline-flex size-7 items-center justify-center rounded border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"

/** Remove a leading prompt echo from `text`, if present. */
function stripPromptPrefix(text: string, prompt: string | undefined): string {
  const body =
    prompt !== undefined && text.startsWith(prompt)
      ? text.slice(prompt.length)
      : text
  return body.trimStart()
}

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
  const finalCheckedRef = useRef(false)

  const hasFrames = player.frameCount > 0
  // Read `final` from the player's working copy so a live complete() (and
  // not only the prop trace) closes the turn.
  const finalText = player.trace.final?.text
  const closed = player.trace.final !== undefined
  const promptText = trace.prompt?.text
  // A closed trace with no frames (schema-valid) is already at its end.
  const atEnd =
    (hasFrames && snapshot.frameIndex === player.frameCount - 1) ||
    (!hasFrames && closed)
  const playing = snapshot.status === "playing"

  // Re-arm the per-turn latches when the same turn swaps to a new trace
  // object (regenerate flow). Declared before the end-detection effect so
  // the swap re-fires onGenerationEnd for the new trace.
  useEffect(() => {
    endedRef.current = false
    finalCheckedRef.current = false
    setShowGeneration(false)
  }, [trace])

  // Settled text is the player's truth: the completion-region slots of the
  // current snapshot (rendered only when the turn is settled, i.e. at the
  // last frame). A zero-frame closed trace has no committed slots, so fall
  // back to final.text minus the echoed prompt.
  const settledText = useMemo(() => {
    if (!hasFrames) return stripPromptPrefix(finalText ?? "", promptText)
    return snapshot.slots
      .filter((slot) => slot.region !== "prompt" && slot.state !== "prompt")
      .map((slot) => slot.text ?? "")
      .join("")
      .trimStart()
  }, [hasFrames, finalText, promptText, snapshot.slots])

  useEffect(() => {
    if (!atEnd) return
    if (!endedRef.current) {
      endedRef.current = true
      onGenerationEnd?.(turnId)
    }
    // Surface a recorded final.text that disagrees with what the frames
    // actually produce (checked once per mounted trace, on first settle).
    if (hasFrames && finalText !== undefined && !finalCheckedRef.current) {
      finalCheckedRef.current = true
      const recorded = stripPromptPrefix(finalText, promptText)
      if (recorded !== settledText) {
        console.warn(
          `DiffusionChat: trace "${trace.traceId}" final.text disagrees ` +
            "with the text reconstructed from its frames"
        )
      }
    }
  }, [
    atEnd,
    hasFrames,
    finalText,
    onGenerationEnd,
    promptText,
    settledText,
    trace.traceId,
    turnId,
  ])

  const settled = atEnd && !showGeneration
  const step = snapshot.frame?.step ?? Math.max(snapshot.frameIndex, 0)
  const totalSteps =
    trace.generation.totalSteps ?? Math.max(player.frameCount - 1, 0)
  const status = playing
    ? `Denoising · step ${step}/${totalSteps}`
    : !hasFrames && !closed
      ? "Waiting for frames"
      : snapshot.status === "ended"
        ? "Replay ended"
        : snapshot.status === "paused"
          ? "Replay paused"
          : "Replay ready"

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
              // aria-live="off" fences the mutating token canvas off from
              // the surrounding role="log" region: turn additions are
              // announced, per-token mutations are not (spec §18). The
              // canvas's own role="status" summary still announces steps.
              <div aria-live="off" className="flex w-full flex-col gap-2">
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
              </div>
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
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: DEV is Vite's built-in mode flag, not a Turborepo env dependency
  if (import.meta.env.DEV) {
    const seen = new Set<string>()
    for (const turn of turns) {
      if (seen.has(turn.id)) {
        console.warn(`DiffusionChat: duplicate turn id "${turn.id}"`)
      }
      seen.add(turn.id)
    }
  }
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
              <MessageScrollerItem
                key={turn.id}
                // Trace turns anchor the viewport so it follows generation.
                scrollAnchor={"trace" in turn}
              >
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
