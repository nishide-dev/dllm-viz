import type { TracePlayer } from "@dllm-viz/core"
import { useEffect } from "react"

import { useDiffusionPlayer } from "./hooks"

export interface DiffusionKeyboardOptions {
  enabled?: boolean
}

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  )
}

function getCanvasBoundaries(player: TracePlayer): number[] {
  const boundaries = new Set<number>([0, player.frameCount - 1])
  player.trace.frames.forEach((frame, frameIndex) => {
    if (frame.kind === "canvas-start" || frame.kind === "canvas-commit") {
      boundaries.add(frameIndex)
    }
  })
  return [...boundaries].sort((a, b) => a - b)
}

export function useDiffusionKeyboard(
  options: DiffusionKeyboardOptions = {}
): void {
  const { enabled = true } = options
  const player = useDiffusionPlayer()

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent): void {
      if (isTextTarget(event.target)) return
      switch (event.key) {
        case " ":
          event.preventDefault()
          player.toggle()
          break
        case "ArrowLeft": {
          event.preventDefault()
          if (event.shiftKey) {
            const previousBoundary = getCanvasBoundaries(player)
              .filter((boundary) => boundary < player.frameIndex)
              .pop()
            player.seek(previousBoundary ?? 0)
          } else {
            player.stepBackward()
          }
          break
        }
        case "ArrowRight": {
          event.preventDefault()
          if (event.shiftKey) {
            const nextBoundary = getCanvasBoundaries(player).find(
              (boundary) => boundary > player.frameIndex
            )
            player.seek(nextBoundary ?? player.frameCount - 1)
          } else {
            player.stepForward()
          }
          break
        }
        case "Home":
          event.preventDefault()
          player.seek(0)
          break
        case "End":
          event.preventDefault()
          player.seek(player.frameCount - 1)
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [player, enabled])
}
