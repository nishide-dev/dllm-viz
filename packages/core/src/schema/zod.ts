import { z } from "zod"

export const TokenStateSchema = z.enum([
  "prompt",
  "masked",
  "proposed",
  "committed",
  "fixed",
  "renoised",
  "padding",
  "unknown",
])

export const TokenSlotSchema = z.looseObject({
  slotId: z.string().min(1),
  index: z.int().nonnegative(),
  tokenId: z.int().optional(),
  text: z.string().optional(),
  normalizedText: z.string().optional(),
  state: TokenStateSchema,
  region: z.enum(["prompt", "completion", "suffix", "padding"]).optional(),
  special: z.boolean().optional(),
})

export const CandidateSchema = z.looseObject({
  tokenId: z.int().optional(),
  text: z.string().optional(),
  probability: z.number().optional(),
  logit: z.number().optional(),
  rank: z.int().nonnegative(),
})

const provenanceValue = z.enum(["measured", "derived", "illustrative"])

export const TraceOperationSchema = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("set-token"),
    slotId: z.string(),
    tokenId: z.int().optional(),
    text: z.string().optional(),
    state: TokenStateSchema.optional(),
    confidence: z.number().optional(),
  }),
  z.looseObject({
    type: z.literal("mask"),
    slotId: z.string(),
    previousTokenId: z.int().optional(),
    reason: z.string().optional(),
  }),
  z.looseObject({
    type: z.literal("commit"),
    slotId: z.string(),
    tokenId: z.int(),
    text: z.string().optional(),
    confidence: z.number().optional(),
    selectionRank: z.int().optional(),
  }),
  z.looseObject({
    type: z.literal("renoise"),
    slotId: z.string(),
    previousTokenId: z.int().optional(),
    score: z.number().optional(),
    reason: z.string().optional(),
  }),
  z.looseObject({
    type: z.literal("insert-slots"),
    afterSlotId: z.string().optional(),
    slots: z.array(TokenSlotSchema),
  }),
  z.looseObject({
    type: z.literal("delete-slots"),
    slotIds: z.array(z.string()),
  }),
  z.looseObject({
    type: z.literal("move-slot"),
    slotId: z.string(),
    afterSlotId: z.string().optional(),
  }),
  z.looseObject({
    type: z.literal("set-distribution"),
    slotId: z.string(),
    candidates: z.array(CandidateSchema),
    entropy: z.number().optional(),
    margin: z.number().optional(),
    omittedMass: z.number().optional(),
  }),
  z.looseObject({
    type: z.literal("set-projection"),
    slotId: z.string().optional(),
    projectionId: z.string(),
    coordinates: z.array(z.number()),
    method: z.enum(["pca", "umap", "tsne", "simplex-topk", "custom"]),
    provenance: provenanceValue,
  }),
  z.looseObject({
    type: z.literal("set-scalar"),
    slotId: z.string().optional(),
    name: z.string(),
    value: z.number(),
    unit: z.string().optional(),
  }),
])

export const FrameMetricsSchema = z.looseObject({
  maskedCount: z.int().optional(),
  maskRatio: z.number().optional(),
  committedThisFrame: z.int().optional(),
  remaskedThisFrame: z.int().optional(),
  changedThisFrame: z.int().optional(),
  meanConfidence: z.number().optional(),
  meanEntropy: z.number().optional(),
  forwardPasses: z.int().optional(),
  elapsedMs: z.number().optional(),
  tokensPerSecond: z.number().optional(),
  memoryBytes: z.number().optional(),
})

export const TraceAnnotationSchema = z.looseObject({
  annotationId: z.string(),
  kind: z.enum(["note", "highlight", "warning"]),
  text: z.string(),
  target: z
    .looseObject({
      slotId: z.string().optional(),
      frameId: z.string().optional(),
    })
    .optional(),
  provenance: provenanceValue.optional(),
})

export const DiffusionFrameSchema = z.looseObject({
  frameId: z.string().min(1),
  ordinal: z.int().nonnegative(),
  kind: z.enum([
    "initial",
    "denoise",
    "renoise",
    "canvas-start",
    "canvas-commit",
    "resize",
    "final",
  ]),
  step: z.number().optional(),
  time: z.number().optional(),
  canvasIndex: z.int().optional(),
  innerStep: z.int().optional(),
  timestampMs: z.number().optional(),
  operations: z.array(TraceOperationSchema),
  metrics: FrameMetricsSchema.optional(),
  annotations: z.array(TraceAnnotationSchema).optional(),
})

export const TraceCheckpointSchema = z.looseObject({
  checkpointId: z.string().min(1),
  frameOrdinal: z.int().gte(-1),
  slots: z.array(TokenSlotSchema),
  metrics: FrameMetricsSchema.optional(),
})

export const FinalResultSchema = z.looseObject({
  text: z.string(),
  tokenIds: z.array(z.int()).optional(),
  finishReason: z
    .enum(["completed", "length", "cancelled", "error"])
    .optional(),
  totalForwardPasses: z.int().optional(),
  elapsedMs: z.number().optional(),
})

export const DiffusionTraceSchema = z.looseObject({
  schemaVersion: z.literal("0.1"),
  traceId: z.string().min(1),
  createdAt: z.string().optional(),
  source: z.looseObject({
    adapter: z.string(),
    adapterVersion: z.string().optional(),
    runtime: z.string().optional(),
    runtimeVersion: z.string().optional(),
    repository: z.string().optional(),
    commit: z.string().optional(),
    command: z.string().optional(),
  }),
  model: z
    .looseObject({
      name: z.string(),
      provider: z.string().optional(),
      parameters: z.string().optional(),
      revision: z.string().optional(),
    })
    .optional(),
  tokenizer: z
    .looseObject({
      name: z.string(),
      vocabSize: z.int().optional(),
      maskTokenId: z.int().optional(),
      maskTokenText: z.string().optional(),
      specialTokenIds: z.array(z.int()).optional(),
    })
    .optional(),
  geometry: z.looseObject({
    timeDomain: z.enum(["discrete", "continuous"]),
    stateSpace: z.enum(["token", "simplex", "embedding", "manifold"]),
    generationMode: z.enum([
      "full-sequence",
      "semi-autoregressive",
      "block-diffusion",
      "canvas-diffusion",
      "variable-length",
      "hybrid",
    ]),
  }),
  generation: z.looseObject({
    algorithm: z.string().optional(),
    totalSteps: z.int().optional(),
    canvasCount: z.int().optional(),
    canvasLength: z.int().optional(),
    blockLength: z.int().optional(),
    maxNewTokens: z.int().optional(),
    temperature: z.number().optional(),
    topP: z.number().optional(),
    topK: z.int().optional(),
    guidanceScale: z.number().optional(),
    confidenceType: z
      .enum(["max-prob", "margin", "negative-entropy", "custom"])
      .optional(),
    remaskingStrategy: z.string().optional(),
    noiseSchedule: z.string().optional(),
    seed: z.union([z.int(), z.string()]).optional(),
  }),
  provenance: z.looseObject({
    mode: z.enum(["measured", "mixed", "illustrative"]),
    fields: z.record(z.string(), provenanceValue).optional(),
    notes: z.array(z.string()).optional(),
  }),
  prompt: z
    .looseObject({
      text: z.string(),
      tokenIds: z.array(z.int()).optional(),
      slotIds: z.array(z.string()).optional(),
    })
    .optional(),
  initial: TraceCheckpointSchema,
  frames: z.array(DiffusionFrameSchema),
  checkpoints: z.array(TraceCheckpointSchema).optional(),
  final: FinalResultSchema.optional(),
  annotations: z.array(TraceAnnotationSchema).optional(),
})

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("metadata"),
    trace: DiffusionTraceSchema.omit({ frames: true }).extend({
      frames: z.array(DiffusionFrameSchema).optional(),
    }),
  }),
  z.looseObject({
    type: z.literal("frame"),
    frame: DiffusionFrameSchema,
  }),
  z.looseObject({
    type: z.literal("checkpoint"),
    checkpoint: TraceCheckpointSchema,
  }),
  z.looseObject({
    type: z.literal("final"),
    final: FinalResultSchema,
  }),
])
