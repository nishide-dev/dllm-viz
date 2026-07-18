import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import type { DiffusionTrace } from "@/lib/dllm-viz-core"
import {
  DiffusionTraceProvider,
  useDiffusionPlayer,
  useDiffusionSnapshot,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

export type ComparisonSyncRule = "frame-ordinal" | "completion-ratio"

export interface ComparisonPane {
  trace: DiffusionTrace
  /** Must be distinct between panes (used as the React key). */
  label: string
}

export interface DiffusionComparisonProps {
  panes: [ComparisonPane, ComparisonPane]
  defaultSyncRule?: ComparisonSyncRule
  /** Rendered inside each pane's DiffusionTraceProvider. */
  renderTrace?: (trace: DiffusionTrace) => ReactNode
  className?: string
}

/**
 * Maps the master position to a pane's frame index (spec §15.7).
 * frame-ordinal clamps to the pane length; completion-ratio maps the
 * master completion fraction onto the pane's own frame range.
 */
export function paneFrameIndex(
  masterIndex: number,
  masterCount: number,
  paneCount: number,
  rule: ComparisonSyncRule
): number {
  if (paneCount <= 0) return 0
  if (rule === "frame-ordinal") return Math.min(masterIndex, paneCount - 1)
  if (masterCount <= 1) return paneCount - 1
  const ratio = masterIndex / (masterCount - 1)
  return Math.round(ratio * (paneCount - 1))
}

const SYNC_RULE_LABELS: Record<ComparisonSyncRule, string> = {
  "frame-ordinal": "frame ordinal",
  "completion-ratio": "completion ratio",
}

function PaneSync({ frameIndex }: { frameIndex: number }) {
  const player = useDiffusionPlayer()
  useEffect(() => {
    player.seek(frameIndex)
  }, [player, frameIndex])
  return null
}

function PanePreview() {
  const snapshot = useDiffusionSnapshot()
  return (
    <div
      className="flex flex-wrap gap-1 rounded border p-2 font-mono text-xs"
      data-slot="comparison-pane"
    >
      {snapshot.slots.map((slot) => (
        <span
          className={cn(
            "rounded border px-1 py-0.5",
            slot.state === "masked" && "border-dashed text-muted-foreground",
            (slot.state === "committed" || slot.state === "fixed") &&
              "border-[var(--dllm-committed,#10b981)]",
            slot.state === "renoised" &&
              "border-[var(--dllm-renoised,#ef4444)] line-through",
            slot.state === "prompt" && "border-transparent bg-muted"
          )}
          data-state={slot.state}
          key={slot.slotId}
          title={`Slot ${slot.index}: ${slot.state}`}
        >
          {slot.state === "masked" ? "░░" : (slot.text ?? "·")}
        </span>
      ))}
    </div>
  )
}

const stepButtonClass =
  "inline-flex size-8 items-center justify-center rounded border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"

export function DiffusionComparison({
  panes,
  defaultSyncRule = "frame-ordinal",
  renderTrace,
  className,
}: DiffusionComparisonProps) {
  const [syncRule, setSyncRule] = useState<ComparisonSyncRule>(defaultSyncRule)
  const [masterIndex, setMasterIndex] = useState(0)
  const masterCount = Math.max(
    panes[0].trace.frames.length,
    panes[1].trace.frames.length
  )
  // masterCount can be 0 while both panes stream up (spec §21.3).
  const clampedMaster = Math.max(Math.min(masterIndex, masterCount - 1), 0)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          aria-label="Previous step"
          className={stepButtonClass}
          onClick={() => setMasterIndex(Math.max(clampedMaster - 1, 0))}
          type="button"
        >
          <span aria-hidden>‹</span>
        </button>
        <button
          aria-label="Next step"
          className={stepButtonClass}
          onClick={() =>
            setMasterIndex(Math.min(clampedMaster + 1, masterCount - 1))
          }
          type="button"
        >
          <span aria-hidden>›</span>
        </button>
        <input
          aria-label="Comparison position"
          className="min-w-24 flex-1 accent-[var(--dllm-committed,#10b981)]"
          max={Math.max(masterCount - 1, 0)}
          min={0}
          onChange={(event) => setMasterIndex(Number(event.target.value))}
          type="range"
          value={clampedMaster}
        />
        <label className="flex items-center gap-1 text-xs">
          Synchronization rule
          <select
            className="rounded border px-1 py-0.5"
            onChange={(event) =>
              setSyncRule(event.target.value as ComparisonSyncRule)
            }
            value={syncRule}
          >
            <option value="frame-ordinal">frame ordinal</option>
            <option value="completion-ratio">completion ratio</option>
          </select>
        </label>
      </div>
      <p className="font-mono text-muted-foreground text-xs">
        Synced by {SYNC_RULE_LABELS[syncRule]}.
        {syncRule === "frame-ordinal" &&
          " Equal ordinals are NOT equivalent steps."}
        {syncRule === "completion-ratio" &&
          " Positions are proportional — frames are not step-equivalent."}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {panes.map((pane) => {
          const paneCount = pane.trace.frames.length
          const frameIndex = paneFrameIndex(
            clampedMaster,
            masterCount,
            paneCount,
            syncRule
          )
          return (
            <figure className="flex flex-col gap-1" key={pane.label}>
              <figcaption className="flex items-baseline gap-2 text-sm">
                <span className="font-medium">{pane.label}</span>
                <span className="font-mono text-muted-foreground text-xs">
                  frame {frameIndex + 1}/{paneCount} ·{" "}
                  {pane.trace.provenance.mode}
                </span>
              </figcaption>
              <DiffusionTraceProvider trace={pane.trace}>
                <PaneSync frameIndex={frameIndex} />
                {renderTrace ? renderTrace(pane.trace) : <PanePreview />}
              </DiffusionTraceProvider>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
