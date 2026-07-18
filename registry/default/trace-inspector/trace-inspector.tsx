import type {
  DiffusionFrame,
  SetDistributionOperation,
  TraceOperation,
  TraceProvenance,
} from "@/lib/dllm-viz-core"
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useOptionalSlotSelection,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

export interface TraceInspectorProps {
  selectedSlotId?: string | null
  className?: string
}

interface HistoryEntry {
  frame: DiffusionFrame
  op: TraceOperation
}

function opsForSlot(
  frames: DiffusionFrame[],
  upToIndex: number,
  slotId: string
): HistoryEntry[] {
  const entries: HistoryEntry[] = []
  for (let i = 0; i <= upToIndex; i++) {
    for (const op of frames[i].operations) {
      if ("slotId" in op && op.slotId === slotId) {
        entries.push({ frame: frames[i], op })
      }
    }
  }
  return entries
}

function opSummary(op: TraceOperation): string {
  switch (op.type) {
    case "commit":
      return `commit "${op.text ?? op.tokenId}"${
        op.confidence !== undefined
          ? ` (confidence ${op.confidence.toFixed(2)})`
          : ""
      }`
    case "renoise":
      return `renoise${op.reason ? ` (${op.reason})` : ""}`
    case "set-distribution":
      return `set-distribution (top-${op.candidates.length})`
    default:
      return op.type
  }
}

function latestDistribution(
  history: HistoryEntry[]
): SetDistributionOperation | undefined {
  for (let index = history.length - 1; index >= 0; index--) {
    const operation = history[index].op
    if (operation.type === "set-distribution") {
      return operation
    }
  }
}

function latestConfidence(history: HistoryEntry[]): number | undefined {
  for (let index = history.length - 1; index >= 0; index--) {
    const operation = history[index].op
    if ("confidence" in operation && operation.confidence !== undefined) {
      return operation.confidence
    }
  }
}

/**
 * The trace protocol treats remasking as a normal operation, so a slot's
 * distribution/confidence must be re-derived after every `mask`/`renoise`.
 * Slice off everything up to and including the most recent remask boundary
 * so stale pre-remask data never appears alongside the current frame.
 */
function afterLatestRemaskBoundary(history: HistoryEntry[]): HistoryEntry[] {
  for (let index = history.length - 1; index >= 0; index--) {
    const type = history[index].op.type
    if (type === "mask" || type === "renoise") {
      return history.slice(index + 1)
    }
  }
  return history
}

function provenanceFor(provenance: TraceProvenance, key: string): string {
  return provenance.fields?.[key] ?? provenance.mode
}

function ProvenanceBadge({
  provenance,
  fieldKey,
}: {
  provenance: TraceProvenance
  fieldKey: string
}) {
  return (
    <span
      data-slot="provenance-badge"
      className="rounded border border-dashed px-1 text-[10px] text-muted-foreground"
    >
      {provenanceFor(provenance, fieldKey)}
    </span>
  )
}

export function TraceInspector({
  selectedSlotId,
  className,
}: TraceInspectorProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const selection = useOptionalSlotSelection()
  // Explicit prop (including null) wins; undefined falls back to context.
  const activeSelectedId =
    selectedSlotId !== undefined
      ? selectedSlotId
      : (selection?.selectedSlotId ?? null)
  const slot = snapshot.slots.find((s) => s.slotId === activeSelectedId)

  if (!slot) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        Select a token slot to inspect it.
      </div>
    )
  }

  const history = opsForSlot(
    player.trace.frames,
    snapshot.frameIndex,
    slot.slotId
  )
  // Only ops after the latest mask/renoise are "current"; anything from
  // before that boundary is a superseded decision and must not be shown
  // as if it still described the present frame (spec §15.1 remasking).
  const currentHistory = afterLatestRemaskBoundary(history)
  const distribution = latestDistribution(currentHistory)
  const lastConfidence = latestConfidence(currentHistory)

  // Provenance lookups use the canonical camelCase field keys from the
  // trace schema (`provenance.fields`), not the human-readable labels.
  const field = (
    key: string,
    label: string,
    value: string | number | undefined
  ) =>
    value === undefined ? null : (
      <div className="flex items-baseline gap-2">
        <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
        <dd className="font-mono">{value}</dd>
        <ProvenanceBadge provenance={provenance} fieldKey={key} />
      </div>
    )

  return (
    <div className={cn("flex flex-col gap-3 text-sm", className)}>
      <dl className="flex flex-col gap-1">
        {field("slotId", "slot", slot.slotId)}
        {field("index", "index", slot.index)}
        {field("tokenId", "token id", slot.tokenId)}
        {field("text", "text", slot.text)}
        {field("state", "state", slot.state)}
        {field("confidence", "confidence", lastConfidence?.toFixed(2))}
      </dl>
      {distribution && (
        <div>
          <h3 className="mb-1 font-medium">Candidates</h3>
          <ul className="flex flex-col gap-0.5 font-mono text-xs">
            {distribution.candidates.map((candidate) => (
              <li key={candidate.rank} className="flex items-baseline gap-2">
                <span>
                  #{candidate.rank} {candidate.text ?? candidate.tokenId}
                  {candidate.probability !== undefined &&
                    ` — ${Math.round(candidate.probability * 100)}%`}
                </span>
                <ProvenanceBadge
                  provenance={provenance}
                  fieldKey="candidates"
                />
              </li>
            ))}
            {distribution.omittedMass !== undefined && (
              <li className="flex items-baseline gap-2 text-muted-foreground">
                <span>
                  omitted mass — {Math.round(distribution.omittedMass * 100)}%
                </span>
                <ProvenanceBadge
                  provenance={provenance}
                  fieldKey="omittedMass"
                />
              </li>
            )}
          </ul>
        </div>
      )}
      <div>
        <h3 className="mb-1 font-medium">Operation history</h3>
        <ul
          aria-label="Operation history"
          className="flex flex-col gap-0.5 font-mono text-xs"
        >
          {history.map((entry, i) => (
            <li
              key={`${entry.frame.frameId}-${i}`}
              className="flex items-baseline gap-2"
            >
              <span>
                #{entry.frame.ordinal} {opSummary(entry.op)}
              </span>
              <ProvenanceBadge provenance={provenance} fieldKey="operation" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
