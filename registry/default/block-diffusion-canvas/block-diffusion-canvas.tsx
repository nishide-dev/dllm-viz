import type { DiffusionTrace, TokenSlot, TokenState } from "@/lib/dllm-viz-core"
import { describeSnapshot } from "@/lib/dllm-viz-core"
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useOptionalSlotSelection,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

export interface BlockDiffusionCanvasProps {
  showPrompt?: boolean
  className?: string
}

export type CanvasStatus = "committed" | "active" | "future"

export interface CanvasSection {
  canvasIndex: number
  slots: TokenSlot[]
  status: CanvasStatus
  innerStep?: number
  innerStepCount?: number
}

/**
 * Derives canvas membership and progress (spec §15.5). The trace schema
 * has no per-slot canvas field, so completion slots are chunked by
 * generation.canvasLength (derived data). Status comes from
 * canvas-start/canvas-commit frames up to the current frame; the inner
 * step total is the maximum innerStep observed for that canvas across
 * the whole trace (undefined when the trace never records innerStep —
 * never faked from unrelated totals).
 *
 * When the trace declares no canvasLength AND no frame carries a
 * canvasIndex, it has no block/canvas structure: `hasCanvasStructure`
 * is false and no sections are synthesized (no-faking invariant).
 */
export function computeCanvasSections(
  trace: DiffusionTrace,
  slots: readonly TokenSlot[],
  frameIndex: number
): {
  promptSlots: TokenSlot[]
  completionSlots: TokenSlot[]
  sections: CanvasSection[]
  hasCanvasStructure: boolean
} {
  const promptSlots = slots.filter(
    (slot) => slot.region === "prompt" || slot.state === "prompt"
  )
  const completion = slots.filter((slot) => !promptSlots.includes(slot))
  const hasCanvasStructure =
    trace.generation.canvasLength !== undefined ||
    trace.frames.some((frame) => frame.canvasIndex !== undefined)
  if (!hasCanvasStructure) {
    return {
      promptSlots,
      completionSlots: completion,
      sections: [],
      hasCanvasStructure,
    }
  }
  const canvasLength = trace.generation.canvasLength ?? completion.length
  const chunkCount =
    canvasLength > 0 ? Math.ceil(completion.length / canvasLength) : 0

  const committed = new Set<number>()
  let active: number | undefined
  let innerStep: number | undefined
  for (let i = 0; i <= frameIndex; i++) {
    const frame = trace.frames[i]
    if (frame.kind === "canvas-start" && frame.canvasIndex !== undefined) {
      active = frame.canvasIndex
      innerStep = frame.innerStep ?? 0
    } else if (
      frame.kind === "canvas-commit" &&
      frame.canvasIndex !== undefined
    ) {
      committed.add(frame.canvasIndex)
      if (active === frame.canvasIndex) {
        active = undefined
        innerStep = undefined
      }
    } else if (
      frame.canvasIndex !== undefined &&
      frame.canvasIndex === active &&
      frame.innerStep !== undefined
    ) {
      innerStep = frame.innerStep
    }
  }

  const innerStepCounts = new Map<number, number>()
  for (const frame of trace.frames) {
    if (frame.canvasIndex !== undefined && frame.innerStep !== undefined) {
      innerStepCounts.set(
        frame.canvasIndex,
        Math.max(innerStepCounts.get(frame.canvasIndex) ?? 0, frame.innerStep)
      )
    }
  }

  const sections: CanvasSection[] = []
  for (let c = 0; c < chunkCount; c++) {
    sections.push({
      canvasIndex: c,
      slots: completion.slice(c * canvasLength, (c + 1) * canvasLength),
      status: committed.has(c)
        ? "committed"
        : c === active
          ? "active"
          : "future",
      innerStep: c === active ? innerStep : undefined,
      innerStepCount: innerStepCounts.get(c),
    })
  }
  return {
    promptSlots,
    completionSlots: completion,
    sections,
    hasCanvasStructure,
  }
}

// Registry items are self-contained: these chip styles deliberately
// mirror DenoisingTokenCanvas instead of importing across registry items.
const CHIP_CLASSES: Record<TokenState, string> = {
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

function SlotChip({
  slot,
  selected,
  onSelect,
}: {
  slot: TokenSlot
  selected: boolean
  onSelect: (slotId: string) => void
}) {
  const text = slot.text !== undefined ? ` ${slot.text.trim() || "space"}` : ""
  return (
    <button
      aria-label={`Slot ${slot.index}:${text}, ${slot.state}`}
      aria-pressed={selected}
      className={cn(
        "rounded border px-1.5 py-0.5 focus-visible:outline-2 focus-visible:outline-ring",
        CHIP_CLASSES[slot.state],
        selected && "ring-2 ring-ring"
      )}
      data-state={slot.state}
      onClick={() => onSelect(slot.slotId)}
      type="button"
    >
      {slot.state === "masked" ? (
        <span aria-hidden>░░</span>
      ) : (
        (slot.text ?? "·")
      )}
    </button>
  )
}

export function BlockDiffusionCanvas({
  showPrompt = true,
  className,
}: BlockDiffusionCanvasProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const selection = useOptionalSlotSelection()
  const { promptSlots, completionSlots, sections, hasCanvasStructure } =
    computeCanvasSections(player.trace, snapshot.slots, snapshot.frameIndex)
  const activeSection = sections.find((s) => s.status === "active")
  const select = (slotId: string) => selection?.setSelectedSlotId(slotId)

  const sectionLabel = (section: CanvasSection) =>
    section.status === "active"
      ? `canvas ${section.canvasIndex} · step ${section.innerStep ?? 0}/${section.innerStepCount ?? "?"}`
      : `canvas ${section.canvasIndex} · ${section.status}`

  const chips = (section: CanvasSection) =>
    section.slots.map((slot) => (
      <SlotChip
        key={slot.slotId}
        onSelect={select}
        selected={slot.slotId === selection?.selectedSlotId}
        slot={slot}
      />
    ))

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
        aria-label="Block diffusion canvases"
        className="flex flex-wrap items-stretch gap-2 font-mono text-sm"
        role="group"
      >
        {showPrompt && promptSlots.length > 0 && (
          <section
            aria-label="Prompt context"
            className="flex flex-wrap items-center gap-1 rounded border border-transparent bg-muted/50 p-1"
          >
            {promptSlots.map((slot) => (
              <SlotChip
                key={slot.slotId}
                onSelect={select}
                selected={slot.slotId === selection?.selectedSlotId}
                slot={slot}
              />
            ))}
          </section>
        )}
        {!hasCanvasStructure && (
          <section
            aria-label="Completion tokens"
            className="flex flex-col gap-1 rounded border border-transparent p-1"
          >
            <p className="px-1 text-muted-foreground text-xs">
              This trace has no block/canvas structure — showing tokens without
              canvas grouping.
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {completionSlots.map((slot) => (
                <SlotChip
                  key={slot.slotId}
                  onSelect={select}
                  selected={slot.slotId === selection?.selectedSlotId}
                  slot={slot}
                />
              ))}
            </div>
          </section>
        )}
        {sections.map((section) => (
          <section
            aria-label={`Canvas ${section.canvasIndex}: ${section.status}`}
            className={cn(
              "flex flex-col gap-1 rounded border p-1",
              section.status === "committed" && "border-solid",
              section.status === "active" &&
                "border-2 border-[var(--dllm-committed,#10b981)]",
              section.status === "future" && "border-dashed opacity-60"
            )}
            data-status={section.status}
            key={section.canvasIndex}
          >
            <header className="px-1 text-muted-foreground text-xs">
              {sectionLabel(section)}
            </header>
            {section.status === "active" ? (
              <div
                className="flex flex-wrap items-center gap-1 rounded border border-dashed p-1"
                data-slot="active-canvas-inner"
              >
                {chips(section)}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                {chips(section)}
              </div>
            )}
          </section>
        ))}
      </div>
      <p className="sr-only" role="status">
        {describeSnapshot(snapshot, player.frameCount)}
        {activeSection &&
          ` Canvas ${activeSection.canvasIndex} active, inner step ${activeSection.innerStep ?? 0} of ${activeSection.innerStepCount ?? "?"}.`}
      </p>
    </div>
  )
}
