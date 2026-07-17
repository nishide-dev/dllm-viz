import type {
  DiffusionFrame,
  SetDistributionOperation,
  TraceOperation,
} from "@/lib/dllm-viz-core"
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
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

export function TraceInspector({
  selectedSlotId = null,
  className,
}: TraceInspectorProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const slot = snapshot.slots.find((s) => s.slotId === selectedSlotId)

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
  const distribution = latestDistribution(history)
  const lastConfidence = latestConfidence(history)
  const provenanceLabel = provenance.mode

  const field = (label: string, value: string | number | undefined) =>
    value === undefined ? null : (
      <div className="flex items-baseline gap-2">
        <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
        <dd className="font-mono">{value}</dd>
        <span className="rounded border border-dashed px-1 text-[10px] text-muted-foreground">
          {provenance.fields?.[label] ?? provenanceLabel}
        </span>
      </div>
    )

  return (
    <div className={cn("flex flex-col gap-3 text-sm", className)}>
      <dl className="flex flex-col gap-1">
        {field("slot", slot.slotId)}
        {field("index", slot.index)}
        {field("token id", slot.tokenId)}
        {field("text", slot.text)}
        {field("state", slot.state)}
        {field("confidence", lastConfidence?.toFixed(2))}
      </dl>
      {distribution && (
        <div>
          <h3 className="mb-1 font-medium">Candidates</h3>
          <ul className="flex flex-col gap-0.5 font-mono text-xs">
            {distribution.candidates.map((candidate) => (
              <li key={candidate.rank}>
                #{candidate.rank} {candidate.text ?? candidate.tokenId}
                {candidate.probability !== undefined &&
                  ` — ${Math.round(candidate.probability * 100)}%`}
              </li>
            ))}
            {distribution.omittedMass !== undefined && (
              <li className="text-muted-foreground">
                omitted mass — {Math.round(distribution.omittedMass * 100)}%
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
            <li key={`${entry.frame.frameId}-${i}`}>
              #{entry.frame.ordinal} {opSummary(entry.op)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
