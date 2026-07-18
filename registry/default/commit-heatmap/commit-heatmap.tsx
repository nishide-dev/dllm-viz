import type { KeyboardEvent, MouseEvent } from "react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import type {
  CommitMatrix,
  CommitMatrixCell,
  MatrixCellRef,
  TokenState,
} from "@/lib/dllm-viz-core"
import {
  buildCommitMatrix,
  describeMatrixCell,
  getMatrixCell,
  MATRIX_ABSENT,
  TOKEN_STATE_CODES,
} from "@/lib/dllm-viz-core"
import {
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useOptionalSlotSelection,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

export interface CommitHeatmapProps {
  /** Cell coloring: token state, or committed-confidence intensity. */
  metric?: "state" | "confidence"
  /**
   * Cell-count threshold: at or below renders DOM (a table of semantic
   * buttons), above renders Canvas (spec §15.4, §19.2 — never DOM for
   * tens of thousands of cells).
   */
  domCellLimit?: number
  /** Canvas-mode cell size in CSS px. */
  cellSize?: number
  /**
   * Fired when a cell is activated, in ADDITION to (not instead of) the
   * surrounding DiffusionSelectionProvider's setter when one is present.
   */
  onSlotSelect?: (slotId: string) => void
  className?: string
}

/** Per-state glyphs so the heatmap never encodes state by color alone. */
export const STATE_GLYPHS: Record<TokenState, string> = {
  prompt: "▁",
  masked: "░",
  proposed: "?",
  committed: "●",
  fixed: "◆",
  renoised: "↺",
  padding: "·",
  unknown: "▒",
}

const STATE_COLORS: Record<number, string> = {
  [TOKEN_STATE_CODES.prompt]: "#e4e4e7",
  [TOKEN_STATE_CODES.masked]: "#a1a1aa",
  [TOKEN_STATE_CODES.proposed]: "#f59e0b",
  [TOKEN_STATE_CODES.committed]: "#10b981",
  [TOKEN_STATE_CODES.fixed]: "#047857",
  [TOKEN_STATE_CODES.renoised]: "#ef4444",
  [TOKEN_STATE_CODES.padding]: "#f4f4f5",
  [TOKEN_STATE_CODES.unknown]: "#d4d4d8",
}

/** Pure cell→color mapping shared by DOM and Canvas modes (unit-tested). */
export function heatmapCellColor(
  stateCode: number,
  confidence: number,
  metric: "state" | "confidence"
): string {
  if (stateCode === MATRIX_ABSENT) return "transparent"
  if (metric === "confidence") {
    if (Number.isNaN(confidence)) {
      return stateCode === TOKEN_STATE_CODES.masked ? "#a1a1aa" : "#e4e4e7"
    }
    const clamped = Math.min(Math.max(confidence, 0), 1)
    const alpha = Math.round((0.15 + 0.85 * clamped) * 255)
      .toString(16)
      .padStart(2, "0")
    return `#10b981${alpha}`
  }
  return STATE_COLORS[stateCode] ?? "#d4d4d8"
}

/** Pure point→cell mapping for canvas hit-testing (unit-tested). */
export function cellFromPoint(
  x: number,
  y: number,
  cellSize: number,
  matrix: CommitMatrix
): MatrixCellRef | null {
  const column = Math.floor(x / cellSize)
  const slotRow = Math.floor(y / cellSize)
  if (slotRow < 0 || slotRow >= matrix.slotIds.length) return null
  if (column < 0 || column >= matrix.frameCount) return null
  return { slotRow, frameIndex: matrix.startFrame + column }
}

export interface HeatmapPaintOptions {
  cellSize: number
  metric: "state" | "confidence"
  frameIndex: number
  selectedRow: number
  cursor: MatrixCellRef | null
}

/**
 * Thin paint loop over the pre-computed matrix. All mapping logic lives
 * in the pure functions above so jsdom tests never need a 2D context.
 */
export function paintHeatmap(
  ctx: CanvasRenderingContext2D,
  matrix: CommitMatrix,
  options: HeatmapPaintOptions
): void {
  const { cellSize, metric, frameIndex, selectedRow, cursor } = options
  const width = matrix.frameCount * cellSize
  const height = matrix.slotIds.length * cellSize
  ctx.clearRect(0, 0, width, height)
  for (let row = 0; row < matrix.slotIds.length; row++) {
    for (let column = 0; column < matrix.frameCount; column++) {
      const flat = row * matrix.frameCount + column
      ctx.fillStyle = heatmapCellColor(
        matrix.states[flat],
        matrix.confidences[flat],
        metric
      )
      ctx.fillRect(column * cellSize, row * cellSize, cellSize, cellSize)
    }
  }
  // Linked cursor: current player frame column + selected slot row.
  const frameColumn = frameIndex - matrix.startFrame
  ctx.strokeStyle = "#18181b"
  if (frameColumn >= 0 && frameColumn < matrix.frameCount) {
    ctx.strokeRect(frameColumn * cellSize + 0.5, 0.5, cellSize - 1, height - 1)
  }
  if (selectedRow >= 0) {
    ctx.strokeRect(0.5, selectedRow * cellSize + 0.5, width - 1, cellSize - 1)
  }
  if (cursor) {
    ctx.strokeStyle = "#2563eb"
    ctx.lineWidth = 2
    ctx.strokeRect(
      (cursor.frameIndex - matrix.startFrame) * cellSize + 1,
      cursor.slotRow * cellSize + 1,
      cellSize - 2,
      cellSize - 2
    )
    ctx.lineWidth = 1
  }
}

export function CommitHeatmap({
  metric = "state",
  domCellLimit = 2000,
  cellSize = 4,
  onSlotSelect,
  className,
}: CommitHeatmapProps) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const selection = useOptionalSlotSelection()
  // player.trace identity changes on appendFrame, so live traces rebuild.
  const matrix = useMemo(() => buildCommitMatrix(player.trace), [player.trace])
  const [readoutCell, setReadoutCell] = useState<CommitMatrixCell | null>(null)

  const selectedRow =
    selection?.selectedSlotId != null
      ? matrix.slotIds.indexOf(selection.selectedSlotId)
      : -1
  const reveal = (cell: MatrixCellRef) =>
    setReadoutCell(getMatrixCell(matrix, cell))
  const activate = (cellRef: MatrixCellRef) => {
    const cell = getMatrixCell(matrix, cellRef)
    player.seek(cellRef.frameIndex)
    selection?.setSelectedSlotId(cell.slotId)
    onSlotSelect?.(cell.slotId)
    setReadoutCell(cell)
  }

  const cellCount = matrix.slotIds.length * matrix.frameCount
  const mode = cellCount > domCellLimit ? "canvas" : "dom"

  if (cellCount === 0) {
    return (
      <div className={cn("flex flex-col gap-2", className)} data-mode="empty">
        {provenance.mode !== "measured" && (
          <span
            className="self-start rounded border border-dashed px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
            title={provenance.notes?.join(" ")}
          >
            {provenance.mode}
          </span>
        )}
        <p className="text-muted-foreground text-sm" role="status">
          No frames yet — the heatmap fills in as frames arrive.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)} data-mode={mode}>
      {provenance.mode !== "measured" && (
        <span
          className="self-start rounded border border-dashed px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
          title={provenance.notes?.join(" ")}
        >
          {provenance.mode}
        </span>
      )}
      {mode === "dom" ? (
        <DomModeView
          activate={activate}
          frameIndex={snapshot.frameIndex}
          matrix={matrix}
          metric={metric}
          reveal={reveal}
          selectedRow={selectedRow}
        />
      ) : (
        <CanvasModeView
          activate={activate}
          cellSize={cellSize}
          frameIndex={snapshot.frameIndex}
          matrix={matrix}
          metric={metric}
          reveal={reveal}
          selectedRow={selectedRow}
        />
      )}
      <p
        aria-live="polite"
        className="font-mono text-muted-foreground text-xs"
        data-slot="heatmap-readout"
      >
        {readoutCell
          ? describeMatrixCell(readoutCell)
          : "Hover or focus a cell for exact values."}
      </p>
    </div>
  )
}

interface ModeViewProps {
  matrix: CommitMatrix
  metric: "state" | "confidence"
  frameIndex: number
  selectedRow: number
  reveal: (cell: MatrixCellRef) => void
  activate: (cell: MatrixCellRef) => void
}

function DomModeView({
  matrix,
  metric,
  frameIndex,
  selectedRow,
  reveal,
  activate,
}: ModeViewProps) {
  const frames = Array.from(
    { length: matrix.frameCount },
    (_, i) => matrix.startFrame + i
  )
  return (
    <div className="overflow-x-auto">
      <table
        aria-label="Commit heatmap"
        className="border-separate border-spacing-0"
      >
        <tbody>
          {matrix.slotIds.map((slotId, row) => (
            <tr key={slotId}>
              <th
                className="pr-2 text-left font-mono font-normal text-muted-foreground text-xs"
                scope="row"
              >
                {slotId}
              </th>
              {frames.map((frame) => {
                const cellRef = { slotRow: row, frameIndex: frame }
                const cell = getMatrixCell(matrix, cellRef)
                const flat =
                  row * matrix.frameCount + (frame - matrix.startFrame)
                return (
                  <td className="p-0" key={frame}>
                    <button
                      aria-current={frame === frameIndex ? "time" : undefined}
                      aria-label={describeMatrixCell(cell)}
                      className={cn(
                        "flex size-5 items-center justify-center border border-transparent text-[9px] leading-none focus-visible:outline-2 focus-visible:outline-ring",
                        frame === frameIndex && "border-foreground",
                        row === selectedRow && "ring-1 ring-ring"
                      )}
                      data-state={cell.state ?? "absent"}
                      onClick={() => activate(cellRef)}
                      onFocus={() => reveal(cellRef)}
                      onMouseEnter={() => reveal(cellRef)}
                      style={{
                        backgroundColor: heatmapCellColor(
                          matrix.states[flat],
                          matrix.confidences[flat],
                          metric
                        ),
                      }}
                      title={describeMatrixCell(cell)}
                      type="button"
                    >
                      <span aria-hidden>
                        {cell.state ? STATE_GLYPHS[cell.state] : ""}
                      </span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Conservative per-dimension backing-store limit. Browsers cap canvas
 * dimensions (typically 16384–65535 device px); beyond the cap they
 * silently produce a blank canvas, so render a message instead.
 */
export const MAX_CANVAS_DIMENSION = 16_384

function CanvasModeView({
  matrix,
  metric,
  frameIndex,
  selectedRow,
  reveal,
  activate,
  cellSize,
}: ModeViewProps & { cellSize: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cursor, setCursor] = useState<MatrixCellRef>({
    slotRow: 0,
    frameIndex: matrix.startFrame,
  })
  const [oversized, setOversized] = useState(false)
  const readoutHintId = useId()

  // The cursor is component state while the matrix can be swapped from
  // outside (live traces, shorter reruns): clamp at every point of use.
  const clampCell = (cell: MatrixCellRef): MatrixCellRef => ({
    slotRow: Math.min(Math.max(cell.slotRow, 0), matrix.slotIds.length - 1),
    frameIndex: Math.min(
      Math.max(cell.frameIndex, matrix.startFrame),
      matrix.startFrame + matrix.frameCount - 1
    ),
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = matrix.frameCount * cellSize
    const height = matrix.slotIds.length * cellSize
    const deviceWidth = Math.round(width * dpr)
    const deviceHeight = Math.round(height * dpr)
    if (
      deviceWidth > MAX_CANVAS_DIMENSION ||
      deviceHeight > MAX_CANVAS_DIMENSION
    ) {
      setOversized(true)
      return
    }
    canvas.width = deviceWidth
    canvas.height = deviceHeight
    if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
      // The backing store refused the size; a blank canvas would follow.
      setOversized(true)
      return
    }
    setOversized(false)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext("2d")
    if (!ctx) return // jsdom: mapping is covered by pure-function tests
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintHeatmap(ctx, matrix, {
      cellSize,
      metric,
      frameIndex,
      selectedRow,
      cursor: clampCell(cursor),
    })
  })

  const moveCursor = (dRow: number, dFrame: number) => {
    const base = clampCell(cursor)
    const next = clampCell({
      slotRow: base.slotRow + dRow,
      frameIndex: base.frameIndex + dFrame,
    })
    setCursor(next)
    reveal(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const handle = (action: () => void) => {
      // Also stop the window-level player bindings from stepping.
      event.preventDefault()
      event.stopPropagation()
      action()
    }
    switch (event.key) {
      case "ArrowRight":
        handle(() => moveCursor(0, 1))
        break
      case "ArrowLeft":
        handle(() => moveCursor(0, -1))
        break
      case "ArrowDown":
        handle(() => moveCursor(1, 0))
        break
      case "ArrowUp":
        handle(() => moveCursor(-1, 0))
        break
      case "Home":
        handle(() => moveCursor(0, Number.NEGATIVE_INFINITY))
        break
      case "End":
        handle(() => moveCursor(0, Number.POSITIVE_INFINITY))
        break
      case "Enter":
      case " ":
        handle(() => activate(clampCell(cursor)))
        break
    }
  }

  const cellAt = (event: MouseEvent<HTMLDivElement>) => {
    // Measure the canvas itself, not the scroll container: the container
    // rect ignores scroll offsets and would hit-test the wrong cell.
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return cellFromPoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      cellSize,
      matrix
    )
  }

  if (oversized) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        This trace is too large for canvas rendering ({matrix.slotIds.length}{" "}
        slots by {matrix.frameCount} frames at {cellSize}px cells). Reduce
        cellSize or window the trace.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        aria-describedby={readoutHintId}
        aria-label={`Commit heatmap: ${matrix.slotIds.length} slots by ${matrix.frameCount} frames. Arrow keys move the cell cursor, Enter seeks and selects.`}
        className="w-fit max-w-full overflow-auto rounded border focus-visible:outline-2 focus-visible:outline-ring"
        onClick={(event) => {
          const cell = cellAt(event)
          if (cell) {
            setCursor(cell)
            activate(cell)
          }
        }}
        onKeyDown={onKeyDown}
        onMouseMove={(event) => {
          const cell = cellAt(event)
          if (cell) reveal(cell)
        }}
        role="img"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the wrapper IS the keyboard cell cursor
        tabIndex={0}
      >
        <canvas ref={canvasRef} />
      </div>
      <p className="sr-only" id={readoutHintId}>
        Exact values for the hovered or focused cell appear in the readout below
        the heatmap.
      </p>
    </div>
  )
}
