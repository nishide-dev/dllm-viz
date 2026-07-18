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

export interface CandidateDistributionProps {
  slotId?: string | null
  className?: string
}

export interface SlotDistributions {
  current?: SetDistributionOperation
  previous?: SetDistributionOperation
}

/**
 * Latest distribution for a slot up to the frame. Remasking is a normal
 * operation: a distribution published before the most recent
 * mask/renoise on the slot is a superseded decision, so `current` is
 * undefined then (spec §15.1). `previous` is the distribution
 * immediately before `current`, used for churn markers.
 */
export function distributionsForSlot(
  frames: DiffusionFrame[],
  upToFrameIndex: number,
  slotId: string
): SlotDistributions {
  const ops: TraceOperation[] = []
  for (let i = 0; i <= upToFrameIndex; i++) {
    for (const op of frames[i].operations) {
      if ("slotId" in op && op.slotId === slotId) ops.push(op)
    }
  }
  const distributions = ops.filter(
    (op): op is SetDistributionOperation => op.type === "set-distribution"
  )
  const last = distributions.at(-1)
  if (!last) return {}
  const lastPosition = ops.lastIndexOf(last)
  const superseded = ops
    .slice(lastPosition + 1)
    .some((op) => op.type === "mask" || op.type === "renoise")
  return {
    current: superseded ? undefined : last,
    previous:
      distributions.length > 1
        ? distributions[distributions.length - 2]
        : undefined,
  }
}

/**
 * Omitted probability mass (spec §15.6 MUST show). Uses the recorded
 * field when present; otherwise derives 1 − Σp when every candidate
 * carries a probability — the derivation is labeled "derived".
 */
export function omittedMassInfo(
  op: SetDistributionOperation
): { value: number; derived: boolean } | undefined {
  if (op.omittedMass !== undefined) {
    return { value: op.omittedMass, derived: false }
  }
  if (op.candidates.some((c) => c.probability === undefined)) {
    return undefined
  }
  const sum = op.candidates.reduce((acc, c) => acc + (c.probability ?? 0), 0)
  return { value: Math.max(0, 1 - sum), derived: true }
}

function churnMarker(
  candidate: SetDistributionOperation["candidates"][number],
  previous: SetDistributionOperation | undefined
): string | null {
  if (!previous) return null
  const match = previous.candidates.find((c) =>
    candidate.tokenId !== undefined
      ? c.tokenId === candidate.tokenId
      : c.text === candidate.text
  )
  if (!match) return "new"
  if (match.rank > candidate.rank) return `↑${match.rank - candidate.rank}`
  if (match.rank < candidate.rank) return `↓${candidate.rank - match.rank}`
  return null
}

function provenanceFor(provenance: TraceProvenance, key: string): string {
  return provenance.fields?.[key] ?? provenance.mode
}

function Badge({ value }: { value: string }) {
  return (
    <span
      className="rounded border border-dashed px-1 text-[10px] text-muted-foreground"
      data-slot="provenance-badge"
    >
      {value}
    </span>
  )
}

export function CandidateDistribution({
  slotId,
  className,
}: CandidateDistributionProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const selection = useOptionalSlotSelection()
  // Explicit prop (including null) wins; undefined falls back to context.
  const activeSlotId =
    slotId !== undefined ? slotId : (selection?.selectedSlotId ?? null)

  if (!activeSlotId) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        Select a token slot to see its candidate distribution.
      </div>
    )
  }

  const { current, previous } = distributionsForSlot(
    player.trace.frames,
    snapshot.frameIndex,
    activeSlotId
  )

  if (!current) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        No current distribution for slot {activeSlotId} at this frame.
      </div>
    )
  }

  const omitted = omittedMassInfo(current)
  const percent = (p: number) => `${Math.round(p * 100)}%`

  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)}>
      <div className="flex items-baseline gap-2">
        <h3 className="font-medium">Candidates for {activeSlotId}</h3>
        <Badge value={provenanceFor(provenance, "candidates")} />
      </div>
      <dl className="flex gap-4 font-mono text-xs">
        {current.entropy !== undefined && (
          <div className="flex items-baseline gap-1">
            <dt className="text-muted-foreground">entropy</dt>
            <dd>{current.entropy.toFixed(2)}</dd>
            <Badge value={provenanceFor(provenance, "entropy")} />
          </div>
        )}
        {current.margin !== undefined && (
          <div className="flex items-baseline gap-1">
            <dt className="text-muted-foreground">margin</dt>
            <dd>{current.margin.toFixed(2)}</dd>
            <Badge value={provenanceFor(provenance, "margin")} />
          </div>
        )}
      </dl>
      <ol aria-label="Ranked candidates" className="flex flex-col gap-1">
        {current.candidates.map((candidate) => {
          const churn = churnMarker(candidate, previous)
          return (
            <li
              className="flex items-center gap-2 font-mono text-xs"
              key={candidate.rank}
            >
              <span className="w-28 shrink-0 truncate">
                #{candidate.rank} {candidate.text ?? candidate.tokenId}
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums">
                {candidate.probability !== undefined
                  ? percent(candidate.probability)
                  : "—"}
              </span>
              <span aria-hidden className="h-2 flex-1 rounded-sm bg-muted">
                <span
                  className="block h-2 rounded-sm bg-[var(--dllm-committed,#10b981)]"
                  style={{ width: `${(candidate.probability ?? 0) * 100}%` }}
                />
              </span>
              {churn && (
                <span
                  aria-label={
                    churn === "new"
                      ? "new candidate"
                      : churn.startsWith("↑")
                        ? `rank up ${churn.slice(1)}`
                        : `rank down ${churn.slice(1)}`
                  }
                  className="w-8 shrink-0 text-muted-foreground"
                  role="img"
                >
                  {churn}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {omitted !== undefined && (
        <p className="flex items-center gap-2 font-mono text-muted-foreground text-xs">
          <span>omitted mass — {percent(omitted.value)}</span>
          <Badge
            value={
              omitted.derived
                ? "derived"
                : provenanceFor(provenance, "omitted mass")
            }
          />
        </p>
      )}
    </div>
  )
}
