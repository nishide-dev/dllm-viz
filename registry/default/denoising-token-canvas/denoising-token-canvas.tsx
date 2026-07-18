import type { TokenSlot } from "@/lib/dllm-viz-core"
import { describeSnapshot } from "@/lib/dllm-viz-core"
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useOptionalSlotSelection,
  useReducedMotion,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

export interface DenoisingTokenCanvasProps {
  showPrompt?: boolean
  showTokenIds?: boolean
  selectedSlotId?: string | null
  onSlotSelect?: (slotId: string) => void
  className?: string
}

const STATE_CLASSES: Record<TokenSlot["state"], string> = {
  prompt: "border-transparent bg-muted text-muted-foreground",
  masked:
    "border-dashed border-[var(--dllm-mask,#a1a1aa)] text-muted-foreground",
  proposed: "border-dotted border-[var(--dllm-proposed,#f59e0b)] italic",
  committed: "border-solid border-[var(--dllm-committed,#10b981)]",
  fixed:
    "border-solid border-[var(--dllm-fixed,#10b981)] bg-[color-mix(in_srgb,var(--dllm-fixed,#10b981)_15%,transparent)] font-medium",
  renoised:
    "border-double border-2 border-[var(--dllm-renoised,#ef4444)] line-through",
  padding: "border-transparent opacity-40",
  unknown: "border-solid border-[var(--dllm-mask,#a1a1aa)] opacity-70",
}

function slotLabel(slot: TokenSlot): string {
  const text = slot.text !== undefined ? ` ${slot.text.trim() || "space"}` : ""
  return `Slot ${slot.index}:${text}, ${slot.state}`
}

export function DenoisingTokenCanvas({
  showPrompt = true,
  showTokenIds = false,
  selectedSlotId,
  onSlotSelect,
  className,
}: DenoisingTokenCanvasProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const reducedMotion = useReducedMotion()
  const selection = useOptionalSlotSelection()
  // Explicit prop (including null) wins; undefined falls back to context.
  const activeSelectedId =
    selectedSlotId !== undefined
      ? selectedSlotId
      : (selection?.selectedSlotId ?? null)
  const handleSelect = (slotId: string) => {
    selection?.setSelectedSlotId(slotId)
    onSlotSelect?.(slotId)
  }
  const slots = showPrompt
    ? snapshot.slots
    : snapshot.slots.filter(
        (slot) => slot.region !== "prompt" && slot.state !== "prompt"
      )

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {provenance.mode !== "measured" && (
        <span
          className="self-start rounded border border-dashed px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
          title={provenance.notes?.join(" ")}
        >
          {provenance.mode}
        </span>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: not a form control group; <fieldset> would be semantically wrong here */}
      <div
        aria-label="Token canvas"
        className="flex flex-wrap gap-1 font-mono text-sm"
        role="group"
      >
        {slots.map((slot) => (
          <button
            aria-label={slotLabel(slot)}
            aria-pressed={slot.slotId === activeSelectedId}
            className={cn(
              "rounded border px-1.5 py-0.5 focus-visible:outline-2 focus-visible:outline-ring",
              !reducedMotion && "transition-colors duration-200",
              STATE_CLASSES[slot.state],
              slot.slotId === activeSelectedId && "ring-2 ring-ring"
            )}
            data-state={slot.state}
            key={slot.slotId}
            onClick={() => handleSelect(slot.slotId)}
            type="button"
          >
            {slot.state === "masked" ? (
              <span aria-hidden>░░</span>
            ) : (
              (slot.text ?? "·")
            )}
            {slot.state === "renoised" && <span aria-hidden> ≈</span>}
            {showTokenIds && slot.tokenId !== undefined && (
              <span className="ml-1 text-[10px] opacity-60">
                {slot.tokenId}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="sr-only" role="status">
        {describeSnapshot(snapshot, player.frameCount)}
      </p>
    </div>
  )
}
