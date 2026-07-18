export interface DiffusionTrace {
  schemaVersion: "0.1"
  traceId: string
  createdAt?: string

  source: TraceSource
  model?: ModelDescriptor
  tokenizer?: TokenizerDescriptor

  geometry: TraceGeometry
  generation: GenerationDescriptor
  provenance: TraceProvenance

  prompt?: TraceTextRegion
  initial: TraceCheckpoint
  frames: DiffusionFrame[]

  checkpoints?: TraceCheckpoint[]
  final?: FinalResult
  annotations?: TraceAnnotation[]
}

export interface TraceSource {
  adapter: string
  adapterVersion?: string
  runtime?: string
  runtimeVersion?: string
  repository?: string
  commit?: string
  command?: string
}

export interface TraceGeometry {
  timeDomain: "discrete" | "continuous"
  stateSpace: "token" | "simplex" | "embedding" | "manifold"
  generationMode:
    | "full-sequence"
    | "semi-autoregressive"
    | "block-diffusion"
    | "canvas-diffusion"
    | "variable-length"
    | "hybrid"
}

export interface GenerationDescriptor {
  algorithm?: string
  totalSteps?: number
  canvasCount?: number
  canvasLength?: number
  blockLength?: number
  maxNewTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  guidanceScale?: number
  confidenceType?: "max-prob" | "margin" | "negative-entropy" | "custom"
  remaskingStrategy?: string
  noiseSchedule?: string
  seed?: number | string
}

export interface TraceProvenance {
  mode: "measured" | "mixed" | "illustrative"
  fields?: Record<string, "measured" | "derived" | "illustrative">
  notes?: string[]
}

export interface TokenSlot {
  slotId: string
  index: number
  tokenId?: number
  text?: string
  normalizedText?: string
  state: TokenState
  region?: "prompt" | "completion" | "suffix" | "padding"
  special?: boolean
}

export type TokenState =
  | "prompt"
  | "masked"
  | "proposed"
  | "committed"
  | "fixed"
  | "renoised"
  | "padding"
  | "unknown"

export interface DiffusionFrame {
  frameId: string
  ordinal: number
  kind:
    | "initial"
    | "denoise"
    | "renoise"
    | "canvas-start"
    | "canvas-commit"
    | "resize"
    | "final"

  step?: number
  time?: number
  canvasIndex?: number
  innerStep?: number
  timestampMs?: number

  operations: TraceOperation[]
  metrics?: FrameMetrics
  annotations?: TraceAnnotation[]
}

export type TraceOperation =
  | SetTokenOperation
  | MaskOperation
  | CommitOperation
  | RenoiseOperation
  | InsertSlotsOperation
  | DeleteSlotsOperation
  | MoveSlotOperation
  | SetDistributionOperation
  | SetProjectionOperation
  | SetScalarOperation

export interface SetTokenOperation {
  type: "set-token"
  slotId: string
  tokenId?: number
  text?: string
  state?: TokenState
  confidence?: number
}

export interface MaskOperation {
  type: "mask"
  slotId: string
  previousTokenId?: number
  reason?: string
}

export interface CommitOperation {
  type: "commit"
  slotId: string
  tokenId: number
  text?: string
  confidence?: number
  selectionRank?: number
}

export interface RenoiseOperation {
  type: "renoise"
  slotId: string
  previousTokenId?: number
  score?: number
  reason?: string
}

export interface InsertSlotsOperation {
  type: "insert-slots"
  afterSlotId?: string
  slots: TokenSlot[]
}

export interface DeleteSlotsOperation {
  type: "delete-slots"
  slotIds: string[]
}

export interface MoveSlotOperation {
  type: "move-slot"
  slotId: string
  afterSlotId?: string
}

export interface Candidate {
  tokenId?: number
  text?: string
  probability?: number
  logit?: number
  rank: number
}

export interface SetDistributionOperation {
  type: "set-distribution"
  slotId: string
  candidates: Candidate[]
  entropy?: number
  margin?: number
  omittedMass?: number
}

export interface SetProjectionOperation {
  type: "set-projection"
  slotId?: string
  projectionId: string
  coordinates: number[]
  method: "pca" | "umap" | "tsne" | "simplex-topk" | "custom"
  provenance: "measured" | "derived" | "illustrative"
}

export interface SetScalarOperation {
  type: "set-scalar"
  slotId?: string
  name: string
  value: number
  unit?: string
}

export interface FrameMetrics {
  maskedCount?: number
  maskRatio?: number
  committedThisFrame?: number
  remaskedThisFrame?: number
  changedThisFrame?: number
  meanConfidence?: number
  meanEntropy?: number
  forwardPasses?: number
  elapsedMs?: number
  tokensPerSecond?: number
  memoryBytes?: number
}

export interface ModelDescriptor {
  name: string
  provider?: string
  parameters?: string
  revision?: string
}

export interface TokenizerDescriptor {
  name: string
  vocabSize?: number
  maskTokenId?: number
  maskTokenText?: string
  specialTokenIds?: number[]
}

export interface TraceTextRegion {
  text: string
  tokenIds?: number[]
  slotIds?: string[]
}

export interface TraceCheckpoint {
  checkpointId: string
  /**
   * Ordinal of the last frame whose effects are included in this
   * checkpoint. The `initial` checkpoint uses -1 (state before any frame).
   */
  frameOrdinal: number
  slots: TokenSlot[]
  metrics?: FrameMetrics
}

export interface FinalResult {
  text: string
  tokenIds?: number[]
  finishReason?: "completed" | "length" | "cancelled" | "error"
  totalForwardPasses?: number
  elapsedMs?: number
}

export interface TraceAnnotation {
  annotationId: string
  kind: "note" | "highlight" | "warning"
  text: string
  target?: {
    slotId?: string
    frameId?: string
  }
  provenance?: "measured" | "derived" | "illustrative"
}

export interface DiffusionSnapshot {
  frameIndex: number
  frame?: DiffusionFrame
  slots: TokenSlot[]
  metrics?: FrameMetrics
  status: "idle" | "playing" | "paused" | "ended"
}

export interface DiffusionPlayer {
  readonly trace: DiffusionTrace
  readonly frameIndex: number
  readonly frameCount: number
  readonly status: "idle" | "playing" | "paused" | "ended"

  getSnapshot(): DiffusionSnapshot
  play(): void
  pause(): void
  toggle(): void
  seek(frameIndex: number): void
  stepForward(count?: number): void
  stepBackward(count?: number): void
  setPlaybackRate(rate: number): void
  appendFrame(frame: DiffusionFrame): void
  appendCheckpoint(checkpoint: TraceCheckpoint): void
  complete(result?: FinalResult): void
  dispose(): void
}
