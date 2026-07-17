# dLLM Visualization Registry — Product and Technical Specification

> **Working title:** `dllm-viz` / `@dllm-viz/*`  
> **Status:** Draft for implementation  
> **Date:** 2026-07-18  
> **Primary implementation base:** [`nishide-dev/react-monorepo-template`](https://github.com/nishide-dev/react-monorepo-template)  
> **Primary integration target:** [`nishide-dev/unturtle`](https://github.com/nishide-dev/unturtle)  
> **License proposal:** Apache-2.0  
> **Normative terms:** MUST, SHOULD, MAY are used in the RFC 2119 sense.

---

## 1. Executive summary

This repository will provide open-code, shadcn-installable visualization primitives for diffusion language models (dLLMs).

The project is **not** a generic text-animation collection. It is a model-aware visualization system that can faithfully replay and inspect:

- masked discrete diffusion,
- remasking and confidence-based commitment,
- block or canvas diffusion,
- semi-autoregressive diffusion,
- variable-length infilling,
- simplex/logit-space diffusion,
- continuous embedding or manifold diffusion,
- comparisons between autoregressive and diffusion decoding.

The key architectural decision is to separate:

1. a **model-independent trace protocol and player**,
2. **model/runtime adapters** that produce traces,
3. **headless React bindings**,
4. **shadcn registry components** that render and interact with those traces,
5. a **Vite documentation and demo application**.

The repository MUST be usable for both:

- static research/laboratory web pages using precomputed traces, and
- live inference demos receiving step updates from a Python or remote backend.

The default implementation MUST use the existing React + Vite monorepo template rather than Next.js. shadcn registries are framework-independent as long as JSON can be served, and public GitHub repositories can act directly as registries. Next.js is therefore neither a runtime dependency nor an architectural requirement.

---

## 2. Background and motivation

Diffusion language models generate or refine multiple token positions over a sequence of denoising steps instead of committing strictly one token at a time from left to right.

This creates visual phenomena that ordinary chat interfaces do not represent well:

- tokens may appear in arbitrary order,
- several positions may be updated simultaneously,
- a visible token may later be masked or replaced,
- fixed context and mutable completion slots coexist,
- confidence or entropy may control which positions are committed,
- a model may denoise one fixed-size canvas before moving to another,
- variable-length models may insert, delete, expand, or contract slots,
- continuous models may evolve distributions or embeddings rather than explicit token IDs.

Existing animated text components generally implement typing, scrambling, reveal, blur, or morph effects. These can be visually attractive but do not encode the semantics above. Using them as the primary representation can produce a plausible-looking but scientifically false animation.

This project addresses that gap by treating animation as a rendering of structured inference events rather than as decoration.

---

## 3. Goals

### 3.1 Primary goals

The project MUST:

1. Define a versioned, model-independent trace schema for diffusion-language generation.
2. Replay a complete generation process deterministically from a static trace.
3. accept incremental frames from a live stream.
4. Distinguish measured, derived, and illustrative data.
5. Represent masked discrete diffusion without assuming monotonic unmasking.
6. Represent block/canvas generation as an outer sequence of canvases and inner denoising steps.
7. Reserve a principled representation for simplex and continuous latent diffusion.
8. Expose headless playback state independently of visual components.
9. Distribute visual components through a shadcn-compatible public GitHub registry.
10. Work in ordinary React applications, including Vite, without requiring Next.js.
11. Integrate cleanly with Unturtle generation history and streaming callbacks.
12. Support static deployment to GitHub Pages, Cloudflare Pages, Vercel, or equivalent hosts.
13. Meet accessibility requirements, including keyboard controls and reduced-motion behavior.
14. Provide realistic example traces and adapter fixtures.
15. Prevent ordinary UI animation from being confused with actual model behavior.

### 3.2 Secondary goals

The project SHOULD:

- make it easy to embed one component in a laboratory home page,
- provide a full demo gallery for researchers and students,
- support comparison of different sampling algorithms on the same prompt,
- support export of a selected frame as SVG or PNG where technically reasonable,
- expose timing, forward-pass count, mask ratio, entropy, and commitment statistics,
- permit adapters outside the repository without requiring core changes,
- allow components to be themed through ordinary shadcn/Tailwind conventions.

### 3.3 Non-goals

The first release is NOT intended to:

- train diffusion language models,
- implement model inference in TypeScript,
- replace Gradio as a complete model-serving framework,
- visualize every Transformer layer or attention head,
- transmit full vocabulary logits for every token and every step,
- provide a general-purpose scientific plotting framework,
- emulate model behavior using random text effects when a trace is unavailable,
- require server-side rendering,
- require a particular Python web framework,
- guarantee support for arbitrary multimodal diffusion in the initial release.

---

## 4. Decision summary

| ID | Decision | Status |
|---|---|---|
| D-001 | Use `dllm-viz` and `@dllm-viz/*` as provisional names. | Provisional |
| D-002 | Base the repository on `nishide-dev/react-monorepo-template`. | Accepted |
| D-003 | Use React 19 + Vite + pnpm + Turborepo; do not require Next.js. | Accepted |
| D-004 | Separate headless core from shadcn-distributed visual components. | Accepted |
| D-005 | Make static trace playback the default deployment model. | Accepted |
| D-006 | Use SSE or a fetch-readable stream for one-way live generation updates; WebSocket is optional. | Accepted |
| D-007 | Use delta frames plus periodic checkpoints instead of storing every full sequence. | Accepted |
| D-008 | Treat provenance and truthfulness as first-class schema fields. | Accepted |
| D-009 | Use DOM for normal token canvases and Canvas for dense heatmaps/large trajectories. | Accepted |
| D-010 | Publish original code under Apache-2.0 unless later compatibility review requires a change. | Proposed |

---

## 5. Why Next.js is not required

The chosen template already provides:

- React 19,
- Vite,
- shadcn/ui in a shared package,
- Tailwind CSS v4,
- Turborepo,
- pnpm workspaces,
- Biome,
- Vitest and React Testing Library,
- GitHub Actions.

References:

- [`react-monorepo-template` README](https://github.com/nishide-dev/react-monorepo-template)
- [root `package.json`](https://github.com/nishide-dev/react-monorepo-template/blob/main/package.json)
- [`apps/web/package.json`](https://github.com/nishide-dev/react-monorepo-template/blob/main/apps/web/package.json)
- [`packages/ui/package.json`](https://github.com/nishide-dev/react-monorepo-template/blob/main/packages/ui/package.json)
- [`apps/web/components.json`](https://github.com/nishide-dev/react-monorepo-template/blob/main/apps/web/components.json)

The shadcn registry documentation explicitly permits Next.js, Vite, Vue, Svelte, PHP, static JSON hosting, and public GitHub repositories:

- [shadcn Registry Introduction](https://ui.shadcn.com/docs/registry)
- [shadcn Registry Getting Started](https://ui.shadcn.com/docs/registry/getting-started)
- [shadcn GitHub Registries](https://ui.shadcn.com/docs/registry/github)
- [`registry.json` schema](https://ui.shadcn.com/docs/registry/registry-json)

A public GitHub repository with a root `registry.json` can be installed directly:

```bash
pnpm dlx shadcn@latest add <owner>/<repo>/<item>
```

Next.js MAY be documented as one consumer environment, but:

- registry source MUST NOT import Next.js APIs,
- core packages MUST NOT depend on Next.js,
- components MUST NOT assume React Server Components,
- registry examples MUST use `"rsc": false`,
- the official demo MUST build as a static Vite application.

Next.js would become justified only if the repository later needs tightly integrated server routes, server-rendered private pages, authentication middleware, dynamic OG generation, or an inference backend deployed in the same application. None is required for the initial product.

---

## 6. Prior art and gap analysis

### 6.1 Diffusion language models and runtimes

#### DiffusionGemma

Relevant references:

- [Unsloth DiffusionGemma documentation](https://unsloth.ai/docs/models/diffusiongemma)
- [Google: Diffusion in Text Generation Explained](https://ai.google.dev/gemma/docs/diffusiongemma/explained)
- [Hugging Face Transformers: DiffusionGemma](https://huggingface.co/docs/transformers/en/model_doc/diffusion_gemma)
- [Hugging Face Diffusers: DiffusionGemma pipeline](https://huggingface.co/docs/diffusers/main/en/api/pipelines/diffusion_gemma)

DiffusionGemma uses a block/canvas architecture. A causal encoder processes the prompt and previously completed canvases into a cache. A bidirectional decoder iteratively denoises a fixed-size canvas. The UI implication is that generation has two nested progress dimensions:

1. outer canvas/block progress,
2. inner denoising progress for the active canvas.

A correct visualization MUST distinguish committed canvases from the currently mutable canvas and future canvases.

#### LLaDA

References:

- [LLaDA official repository](https://github.com/ML-GSAI/LLaDA)
- [Large Language Diffusion Models paper](https://arxiv.org/abs/2502.09992)
- [LLaDA generation implementation](https://github.com/ML-GSAI/LLaDA/blob/main/generate.py)
- [LLaDA visualization directory](https://github.com/ML-GSAI/LLaDA/tree/main/visualization)

LLaDA is a masked discrete diffusion language model. Its generation loop predicts candidate tokens at masked positions and selects positions to transfer from masked to visible states. Depending on sampling strategy, tokens may also be remasked.

A correct visualization MUST support arbitrary commitment order and MUST NOT assume that a visible token is final unless the trace marks it as committed/fixed.

#### Dream

References:

- [Dream official repository](https://github.com/DreamLM/Dream)
- [Dream 7B paper](https://arxiv.org/abs/2508.15487)
- [Dream demo application](https://github.com/DreamLM/Dream/blob/main/app.py)
- [DreamOn repository](https://github.com/DreamLM/DreamOn)
- [DreamOn paper](https://arxiv.org/abs/2602.01326)

Dream demonstrates arbitrary-order generation, infilling, and speed/quality trade-offs. DreamOn extends this space with dynamic variable-length generation.

A correct visualization SHOULD support:

- pinned context,
- arbitrary-order completion,
- explicit variable-length slot operations,
- expansion and contraction events,
- distinction between token replacement and sequence resizing.

#### MDLM and remasking

References:

- [MDLM official repository](https://github.com/kuleshov-group/mdlm)
- [MDLM paper](https://arxiv.org/abs/2406.07524)
- [ReMDM repository](https://github.com/kuleshov-group/remdm)
- [ReMDM paper](https://arxiv.org/abs/2503.00307)

MDLM provides masked diffusion and semi-autoregressive sampling. ReMDM makes remasking an explicit inference-time mechanism.

The trace protocol MUST therefore model remasking as a normal operation, not as an error or cosmetic transition.

#### Block Diffusion / BD3-LM

References:

- [BD3-LM official repository](https://github.com/kuleshov-group/bd3lms)
- [Block Diffusion paper](https://arxiv.org/abs/2503.09573)
- [ICLR 2025 paper page](https://proceedings.iclr.cc/paper_files/paper/2025/hash/7ede97c3e082c6df10a8d6103a2eebd2-Abstract-Conference.html)

Block diffusion interpolates between fully autoregressive and fully diffusion-based language modeling. It motivates an explicit `generationMode` field rather than inferring behavior from screenshots.

#### Continuous and simplex diffusion

References:

- [Diffusion-LM repository](https://github.com/XiangLi1999/Diffusion-LM)
- [Diffusion-LM paper](https://arxiv.org/abs/2205.14217)
- [SSD-LM paper](https://aclanthology.org/2023.acl-long.647/)
- [TESS paper](https://aclanthology.org/2024.eacl-long.144/)
- [TESS repository](https://github.com/allenai/tess-diffusion)
- [RDLM repository](https://github.com/harryjo97/RDLM)
- [Continuous Diffusion Model for Language Modeling](https://arxiv.org/abs/2502.11564)

These models do not always expose a meaningful discrete token at every internal step. A visualization system must support projected trajectories, distributions, entropy, and top-k candidates without pretending that a 2D projection is the original latent space.

### 6.2 Existing model visualizations

References:

- [Transformer Explainer](https://github.com/poloclub/transformer-explainer)
- [Transformer Explainer paper](https://arxiv.org/abs/2408.04619)
- [Diffusion Explainer](https://github.com/poloclub/diffusion-explainer)
- [Diffusion Explainer live site](https://poloclub.github.io/diffusion-explainer/)
- [AnimatedLLM paper](https://arxiv.org/abs/2601.04213)
- [AnimatedLLM live site](https://animatedllm.github.io/)

Important design lessons:

1. Precomputed traces can support a high-quality browser experience without exposing a GPU.
2. A visualization should allow movement between overview and detail.
3. The data trace and rendering logic should be separable.
4. A deterministic curated example is often better for education than a slow or unstable live model.
5. A browser-only static deployment makes laboratory and course embedding much easier.

### 6.3 Existing shadcn animation ecosystems

References:

- [shadcn registry directory](https://ui.shadcn.com/docs/directory)
- [Magic UI Text Animate](https://magicui.design/docs/components/text-animate)
- [Magic UI Hyper Text](https://magicui.design/docs/components/hyper-text)
- [Animate UI](https://animate-ui.com/docs)
- [Motion React animation documentation](https://motion.dev/docs/react-animation)

These projects establish that shadcn is a viable distribution channel for animated open-code components. Their typical text effects are still presentation effects rather than inference-state visualizations.

The gap is a registry whose components understand:

- token slots,
- mask and remask operations,
- confidence-based commits,
- nested canvas/step progress,
- trace provenance,
- continuous-state summaries,
- deterministic replay.

### 6.4 Conclusion of prior-art review

There are strong implementations of:

- model-specific Python/Gradio demos,
- generic animated React components,
- full educational visualization applications,
- diffusion training and inference libraries.

There is no established, model-independent, shadcn-installable component system centered on diffusion-language traces. This repository is therefore a reasonable and differentiated project.

---

## 7. Target users and use cases

### 7.1 Research laboratory website

A researcher exports one representative trace, places it in the static site, and embeds:

```tsx
<DenoisingTokenCanvas trace={trace} autoPlay />
```

No GPU or backend is required.

### 7.2 Paper or project demo

A project page compares:

- LLaDA masked diffusion,
- block decoding,
- autoregressive decoding,

using identical prompt and output regions.

### 7.3 Unturtle Studio integration

Unturtle streams token snapshots and metrics. The frontend converts them into trace frames and renders:

- current token state,
- mask ratio,
- committed positions,
- confidence mode,
- timing data.

### 7.4 Teaching

A lecturer uses curated traces and step controls to demonstrate:

- why arbitrary-order generation differs from typing,
- how remasking can revise reasoning,
- how block diffusion differs from full-sequence diffusion,
- why a latent projection is only a projection.

### 7.5 Algorithm debugging

A developer loads two traces and identifies:

- a token committed too early,
- a remasking loop,
- a block boundary bug,
- confidence collapse,
- inconsistent final decoding.

---

## 8. Repository architecture

### 8.1 Bootstrap

The repository SHOULD be created with:

```bash
uvx copier copy --trust gh:nishide-dev/react-monorepo-template dllm-viz
cd dllm-viz
pnpm install
```

### 8.2 Target structure

```text
dllm-viz/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── routes/
│       │   ├── examples/
│       │   ├── content/
│       │   └── registry-preview/
│       └── public/
│           └── traces/
├── packages/
│   ├── core/
│   │   ├── src/schema/
│   │   ├── src/player/
│   │   ├── src/codec/
│   │   ├── src/validation/
│   │   └── src/testing/
│   ├── react/
│   │   ├── src/provider/
│   │   ├── src/hooks/
│   │   └── src/headless/
│   ├── adapters/
│   │   ├── src/unturtle/
│   │   ├── src/diffusiongemma/
│   │   ├── src/llada/
│   │   ├── src/dream/
│   │   └── src/generic/
│   └── ui/
│       └── src/components/
├── registry/
│   └── default/
│       ├── denoising-token-canvas/
│       ├── diffusion-step-controls/
│       ├── trace-inspector/
│       ├── commit-heatmap/
│       ├── block-diffusion-canvas/
│       ├── candidate-distribution/
│       ├── diffusion-comparison/
│       └── diffusion-chat/
├── examples/
│   ├── traces/
│   ├── python/
│   └── integrations/
├── schemas/
│   ├── trace.schema.json
│   └── stream-event.schema.json
├── registry.json
├── pnpm-workspace.yaml
└── turbo.json
```

### 8.3 Package responsibilities

#### `@dllm-viz/core`

MUST contain no React dependency.

Responsibilities:

- TypeScript types,
- Zod or equivalent runtime validation,
- trace normalization,
- delta application,
- checkpoint reconstruction,
- playback state machine,
- seek indexes,
- trace statistics,
- JSON/JSONL codecs,
- provenance checks,
- test fixtures.

#### `@dllm-viz/react`

MUST contain headless React integration only.

Responsibilities:

- `DiffusionTraceProvider`,
- `useDiffusionPlayer`,
- `useDiffusionFrame`,
- `useTokenSlots`,
- `useTraceMetrics`,
- keyboard-control hooks,
- reduced-motion integration.

It MUST NOT impose visual styling.

#### `@dllm-viz/adapters`

MUST provide adapter contracts and maintained adapters.

The initial package MAY remain a single package. If dependency conflicts arise, it SHOULD be split into:

- `@dllm-viz/adapter-unturtle`,
- `@dllm-viz/adapter-transformers`,
- `@dllm-viz/adapter-generic`.

#### `@workspace/ui`

The existing template package SHOULD remain the internal shared shadcn foundation for the demo application.

It MUST NOT become the canonical source of distributable dLLM registry items. Canonical registry item source MUST live under `registry/default/*`, so that installed code does not depend on workspace-only aliases.

#### `registry/default/*`

Each directory MUST be a self-contained shadcn registry item or a clearly declared dependency of another item.

The demo application MUST render the same source files that users install. A duplicate demo-only implementation is not permitted.

---

## 9. Trace model

## 9.1 Design principles

The trace protocol MUST:

- be serializable,
- be incrementally streamable,
- be deterministic,
- permit sparse frames,
- support stable token-slot identity,
- support resizing,
- preserve source provenance,
- avoid mandatory full logits,
- support unknown future fields,
- remain useful when only token snapshots are available.

### 9.2 Top-level schema

```ts
export interface DiffusionTrace {
  schemaVersion: "0.1";
  traceId: string;
  createdAt?: string;

  source: TraceSource;
  model?: ModelDescriptor;
  tokenizer?: TokenizerDescriptor;

  geometry: TraceGeometry;
  generation: GenerationDescriptor;
  provenance: TraceProvenance;

  prompt?: TraceTextRegion;
  initial: TraceCheckpoint;
  frames: DiffusionFrame[];

  checkpoints?: TraceCheckpoint[];
  final?: FinalResult;
  annotations?: TraceAnnotation[];
}
```

### 9.3 Source metadata

```ts
export interface TraceSource {
  adapter: string;
  adapterVersion?: string;
  runtime?: string;
  runtimeVersion?: string;
  repository?: string;
  commit?: string;
  command?: string;
}
```

Examples:

```json
{
  "adapter": "unturtle",
  "adapterVersion": "0.1.0",
  "runtime": "unturtle",
  "repository": "https://github.com/nishide-dev/unturtle",
  "commit": "769344bc529bcff4343669ffaef1afe323a9e2d0"
}
```

### 9.4 Geometry

```ts
export interface TraceGeometry {
  timeDomain: "discrete" | "continuous";
  stateSpace: "token" | "simplex" | "embedding" | "manifold";
  generationMode:
    | "full-sequence"
    | "semi-autoregressive"
    | "block-diffusion"
    | "canvas-diffusion"
    | "variable-length"
    | "hybrid";
}
```

These dimensions MUST remain separate. “Continuous diffusion” MUST NOT be represented as one boolean because continuity may refer to time, state space, or both.

### 9.5 Generation descriptor

```ts
export interface GenerationDescriptor {
  algorithm?: string;
  totalSteps?: number;
  canvasCount?: number;
  canvasLength?: number;
  blockLength?: number;
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  guidanceScale?: number;
  confidenceType?: "max-prob" | "margin" | "negative-entropy" | "custom";
  remaskingStrategy?: string;
  noiseSchedule?: string;
  seed?: number | string;
}
```

### 9.6 Provenance

```ts
export interface TraceProvenance {
  mode: "measured" | "mixed" | "illustrative";
  fields?: Record<string, "measured" | "derived" | "illustrative">;
  notes?: string[];
}
```

Rules:

- `measured` means directly emitted by the model/runtime.
- `derived` means computed from measured data.
- `illustrative` means created for explanation and not asserted as model output.
- A component MUST expose an indicator when the trace or displayed field is illustrative.
- An illustrative trace MUST NOT be styled identically to a measured trace without a visible label.

### 9.7 Stable token slots

Variable-length traces require identity independent of array index.

```ts
export interface TokenSlot {
  slotId: string;
  index: number;
  tokenId?: number;
  text?: string;
  normalizedText?: string;
  state: TokenState;
  region?: "prompt" | "completion" | "suffix" | "padding";
  special?: boolean;
}
```

```ts
export type TokenState =
  | "prompt"
  | "masked"
  | "proposed"
  | "committed"
  | "fixed"
  | "renoised"
  | "padding"
  | "unknown";
```

`renoised` MAY be transient. The stable post-frame state will normally become `masked`.

### 9.8 Frames

```ts
export interface DiffusionFrame {
  frameId: string;
  ordinal: number;
  kind:
    | "initial"
    | "denoise"
    | "renoise"
    | "canvas-start"
    | "canvas-commit"
    | "resize"
    | "checkpoint"
    | "final";

  step?: number;
  time?: number;
  canvasIndex?: number;
  innerStep?: number;
  timestampMs?: number;

  operations: TraceOperation[];
  metrics?: FrameMetrics;
  annotations?: TraceAnnotation[];
}
```

### 9.9 Operations

```ts
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
  | SetScalarOperation;
```

Representative definitions:

```ts
export interface SetTokenOperation {
  type: "set-token";
  slotId: string;
  tokenId?: number;
  text?: string;
  state?: TokenState;
  confidence?: number;
}

export interface MaskOperation {
  type: "mask";
  slotId: string;
  previousTokenId?: number;
  reason?: string;
}

export interface CommitOperation {
  type: "commit";
  slotId: string;
  tokenId: number;
  text?: string;
  confidence?: number;
  selectionRank?: number;
}

export interface RenoiseOperation {
  type: "renoise";
  slotId: string;
  previousTokenId?: number;
  score?: number;
  reason?: string;
}

export interface InsertSlotsOperation {
  type: "insert-slots";
  afterSlotId?: string;
  slots: TokenSlot[];
}

export interface DeleteSlotsOperation {
  type: "delete-slots";
  slotIds: string[];
}
```

### 9.10 Candidate distributions

```ts
export interface Candidate {
  tokenId?: number;
  text?: string;
  probability?: number;
  logit?: number;
  rank: number;
}

export interface SetDistributionOperation {
  type: "set-distribution";
  slotId: string;
  candidates: Candidate[];
  entropy?: number;
  margin?: number;
  omittedMass?: number;
}
```

The default adapter SHOULD store top-k candidates only.

Full logits MUST be opt-in and MUST NOT be part of bundled example traces.

### 9.11 Continuous-state summaries

```ts
export interface SetProjectionOperation {
  type: "set-projection";
  slotId?: string;
  projectionId: string;
  coordinates: number[];
  method:
    | "pca"
    | "umap"
    | "tsne"
    | "simplex-topk"
    | "custom";
  provenance: "measured" | "derived" | "illustrative";
}

export interface SetScalarOperation {
  type: "set-scalar";
  slotId?: string;
  name: string;
  value: number;
  unit?: string;
}
```

A projected trajectory MUST label:

- projection method,
- whether the projection basis is fixed across frames,
- whether coordinates were computed online or after generation,
- whether dimensionality reduction changes global geometry.

### 9.12 Metrics

```ts
export interface FrameMetrics {
  maskedCount?: number;
  maskRatio?: number;
  committedThisFrame?: number;
  remaskedThisFrame?: number;
  changedThisFrame?: number;
  meanConfidence?: number;
  meanEntropy?: number;
  forwardPasses?: number;
  elapsedMs?: number;
  tokensPerSecond?: number;
  memoryBytes?: number;
}
```

### 9.13 Checkpoints and compression

A long trace MUST use:

- one initial checkpoint,
- sparse delta frames,
- periodic checkpoints every configurable number of frames.

Recommended default:

```ts
checkpointInterval = 32
```

The player MUST seek from the nearest previous checkpoint rather than replaying from frame zero.

Supported formats:

| Format | Requirement |
|---|---|
| `.json` | MUST support |
| `.jsonl` | MUST support for streaming/large traces |
| `.json.gz` / `.jsonl.gz` | SHOULD support through normal HTTP compression or preprocessing |
| MessagePack | MAY support after MVP |
| Arrow/Parquet | Out of scope for MVP |

---

## 10. Player API

### 10.1 Core player

```ts
export interface DiffusionPlayer {
  readonly trace: DiffusionTrace;
  readonly frameIndex: number;
  readonly frameCount: number;
  readonly status: "idle" | "playing" | "paused" | "ended";

  getSnapshot(): DiffusionSnapshot;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(frameIndex: number): void;
  stepForward(count?: number): void;
  stepBackward(count?: number): void;
  setPlaybackRate(rate: number): void;
  appendFrame(frame: DiffusionFrame): void;
  appendCheckpoint(checkpoint: TraceCheckpoint): void;
  complete(result?: FinalResult): void;
  dispose(): void;
}
```

### 10.2 React provider

```tsx
<DiffusionTraceProvider
  trace={trace}
  initialFrame={0}
  playbackRate={1}
  autoPlay={false}
>
  <Demo />
</DiffusionTraceProvider>
```

### 10.3 Hooks

```ts
const player = useDiffusionPlayer();
const frame = useDiffusionFrame();
const slots = useTokenSlots();
const metrics = useTraceMetrics();
const provenance = useTraceProvenance();
```

Hooks SHOULD use selector-based subscriptions to avoid rerendering every component for unrelated frame changes.

---

## 11. Adapter contract

```ts
export interface TraceAdapter<TInput = unknown> {
  readonly id: string;
  readonly version: string;

  canHandle(input: unknown): boolean;
  createTrace(input: TInput, options?: AdapterOptions): DiffusionTrace;
  append?(event: unknown, builder: TraceBuilder): void;
  finalize?(result: unknown, builder: TraceBuilder): void;
}
```

Adapters MUST document:

- which fields are measured,
- which fields are derived,
- which generation modes are supported,
- token decoding assumptions,
- whether prompt tokens are included in snapshots,
- whether “visible” means proposed or committed,
- whether remasking can be observed directly.

---

## 12. Unturtle integration

### 12.1 Existing capabilities

Unturtle currently exposes shared masked-diffusion generation with:

- `output_history`,
- `return_dict`,
- a `history` field in `MaskedDiffusionModelOutput`,
- `step_callback`,
- `stream_callback(step, total, x)` snapshots,
- confidence modes including maximum probability, margin, and negative entropy,
- block-decode and BD3LM-related generation paths.

References:

- [Unturtle repository](https://github.com/nishide-dev/unturtle)
- [shared generation utilities](https://github.com/nishide-dev/unturtle/blob/main/unturtle/models/generation/diffusion_generation_utils.py)
- [generate API unification design](https://github.com/nishide-dev/unturtle/blob/main/docs/superpowers/specs/2026-06-11-generate-api-unification-design.md)
- [LLaDA generation utilities](https://github.com/nishide-dev/unturtle/blob/main/unturtle/models/backbones/llada/generation_utils.py)
- [Dream generation utilities](https://github.com/nishide-dev/unturtle/blob/main/unturtle/models/backbones/dream/generation_utils.py)

This makes Unturtle a strong first adapter target.

### 12.2 Minimum Python exporter

The integration SHOULD provide an exporter with an interface similar to:

```python
from dllm_viz import TraceWriter
from unturtle import FastDiffusionModel

writer = TraceWriter(
    model=model,
    tokenizer=tokenizer,
    output="trace.jsonl",
)

output = model.generate(
    input_ids,
    return_dict=True,
    output_history=True,
    stream_callback=writer.on_step,
    output_timing=True,
)

writer.finalize(output)
```

### 12.3 Recommended Unturtle extension

Unturtle SHOULD eventually expose a structured callback in addition to raw token snapshots:

```python
trace_callback(
    step=step,
    total=total,
    token_ids=x,
    committed_mask=transfer_index,
    confidence=confidence,
    canvas_index=canvas_index,
    inner_step=inner_step,
    metrics=metrics,
)
```

This is not required for the first adapter. The initial adapter MAY derive changed and newly visible positions by comparing snapshots. Derived fields MUST be marked as `derived`.

### 12.4 Compatibility rules

- The adapter MUST use stable slot IDs.
- Prompt and generated regions MUST be separated.
- Special tokens MUST be retained internally even when hidden visually.
- Decoding MUST preserve whitespace/subword boundaries.
- If raw history cannot distinguish proposed from committed tokens, the adapter MUST use `unknown` or document the inference rule.
- BD3LM and block-decode MUST not be conflated merely because both use the word “block.”

---

## 13. DiffusionGemma adapter

The DiffusionGemma adapter SHOULD target the official Transformers/Diffusers APIs.

References:

- [Transformers DiffusionGemma docs](https://huggingface.co/docs/transformers/en/model_doc/diffusion_gemma)
- [Diffusers DiffusionGemma pipeline docs](https://huggingface.co/docs/diffusers/main/en/api/pipelines/diffusion_gemma)
- [Google explanation](https://ai.google.dev/gemma/docs/diffusiongemma/explained)

The adapter MUST represent:

- canvas index,
- active canvas length,
- inner denoising step,
- committed prior canvases,
- active mutable canvas,
- renoised positions if exposed,
- final canvas commit.

The adapter SHOULD integrate with a streamer or callback rather than patching UI logic into model code.

---

## 14. Live streaming protocol

### 14.1 Default transport

For server-to-browser generation progress, the default transport SHOULD be:

- SSE through `EventSource`, or
- a fetch response consumed as a readable stream when POST bodies or custom headers are needed.

References:

- [MDN Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

WebSocket MAY be used for interactive constraints, branching, pause/resume commands, or bidirectional editing.

### 14.2 Suggested API

```http
POST /v1/runs
Content-Type: application/json
```

Response:

```json
{
  "runId": "run_123",
  "eventsUrl": "/v1/runs/run_123/events"
}
```

Event stream:

```text
event: metadata
data: {"schemaVersion":"0.1", ...}

event: checkpoint
data: {"checkpoint":{...}}

event: frame
data: {"frame":{...}}

event: complete
data: {"final":{...}}

event: error
data: {"code":"MODEL_ERROR","message":"..."}
```

### 14.3 Stream rules

- Events MUST be ordered.
- Every frame MUST have a monotonically increasing ordinal.
- Clients MUST reject duplicate conflicting frame IDs.
- Servers SHOULD send heartbeats for long inference gaps.
- Clients SHOULD reconnect when transport permits.
- A final event MUST explicitly close the logical trace.
- Partial traces SHOULD remain replayable.
- Error payloads MUST NOT include secrets, raw prompts from other users, or stack traces by default.

---

## 15. Component specifications

## 15.1 `DenoisingTokenCanvas`

### Purpose

Render the current state of token slots for masked, block, or variable-length diffusion.

### Required inputs

```ts
export interface DenoisingTokenCanvasProps {
  trace?: DiffusionTrace;
  snapshot?: DiffusionSnapshot;
  showPrompt?: boolean;
  showWhitespace?: boolean;
  showTokenIds?: boolean;
  groupBy?: "none" | "word" | "canvas" | "block";
  colorMetric?: "state" | "confidence" | "entropy" | "change-age";
  motion?: "full" | "reduced" | "none";
  onSlotSelect?: (slotId: string) => void;
}
```

### Visual semantics

The component MUST distinguish, without relying only on color:

- prompt/fixed tokens,
- masked slots,
- proposed tokens,
- committed tokens,
- remasked/renoised transitions,
- padding,
- selected slot.

Recommended cues include:

- fill,
- border style,
- opacity,
- mask glyph,
- icon or corner marker,
- accessible label,
- tooltip.

### Layout

- Slot positions SHOULD remain stable between frames.
- Token text changes SHOULD NOT cause unrelated tokens to shift.
- A decoded-text view MAY be displayed below the slot view.
- Subword/whitespace markers MUST be optional.
- Variable-length insertions/deletions MUST animate spatially only when motion is allowed.

### Acceptance criteria

- Correctly replays a trace with mask → token → mask → different token.
- Supports 256 visible slots without severe input lag.
- Keyboard selection works.
- Reduced-motion mode replaces movement with immediate state changes or fades.
- Screen readers receive a step summary rather than one live-region update per token.

---

## 15.2 `DiffusionStepControls`

### Purpose

Control deterministic trace playback.

### Features

- play/pause,
- previous/next frame,
- jump to beginning/end,
- scrubber,
- playback rate,
- frame number,
- model step,
- canvas and inner-step labels,
- optional loop,
- optional autoplay.

### Keyboard defaults

| Key | Action |
|---|---|
| Space | Play/pause |
| Left | Previous frame |
| Right | Next frame |
| Shift+Left | Previous checkpoint/canvas |
| Shift+Right | Next checkpoint/canvas |
| Home | First frame |
| End | Final frame |

The component MUST not steal shortcuts while a text input is focused.

---

## 15.3 `TraceInspector`

### Purpose

Display exact data for a selected slot and frame.

### Fields

- slot ID and index,
- token ID,
- decoded token,
- state,
- previous state,
- confidence,
- entropy,
- margin,
- top-k candidates,
- operation history,
- canvas/block membership,
- provenance for each field.

The inspector MUST visibly mark derived and illustrative values.

---

## 15.4 `CommitHeatmap`

### Purpose

Show position × time behavior.

### Encodings

The heatmap SHOULD support:

- mask/unmask state,
- token change,
- commit step,
- remasking events,
- confidence,
- entropy.

### Rendering

- Small heatmaps MAY use DOM/SVG.
- Dense heatmaps MUST use Canvas.
- Hover or keyboard focus MUST reveal exact values.
- A linked cursor SHOULD synchronize with the token canvas and player.

Reference for dense rendering:

- [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MDN Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

---

## 15.5 `BlockDiffusionCanvas`

### Purpose

Represent outer block/canvas progress and inner denoising.

### Required distinctions

- prompt/cache context,
- committed canvases,
- active canvas,
- future/unallocated canvases,
- inner step,
- canvas commit boundary.

The active canvas MUST be visually nested rather than flattened into an ordinary token stream.

### Example

```text
[ prompt ] [ committed canvas 0 ] [ active canvas 1: step 6/16 ] [ future ]
```

---

## 15.6 `CandidateDistribution`

### Purpose

Display top-k candidates for one slot over time.

### Views

- ranked bar list,
- probability sparkline per candidate,
- entropy and top-1/top-2 margin,
- candidate churn.

The component MUST show omitted probability mass when top-k values do not sum to one.

---

## 15.7 `DiffusionComparison`

### Purpose

Synchronize multiple traces.

### Comparison modes

- same prompt, different models,
- same model, different algorithms,
- same seed, different steps,
- autoregressive vs diffusion,
- measured vs illustrative explanation.

### Rules

- Playback MAY synchronize by frame ordinal, normalized time, model step, or completion ratio.
- The selected synchronization rule MUST be visible.
- The UI MUST NOT imply frame-to-frame equivalence when step definitions differ.

---

## 15.8 `InfillingCanvas`

### Purpose

Show prefix/suffix context and mutable middle regions.

### Features

- pinned prefix/suffix,
- multiple editable holes,
- fixed constraints,
- arbitrary-order fill,
- variable-length operations,
- position or slot identity inspection.

This component SHOULD be added after the base token canvas is stable.

---

## 15.9 `SimplexTrajectory`

### Purpose

Visualize changes in token distributions for simplex/logit-space diffusion.

### Requirements

- Default to top-k simplex summaries rather than the entire vocabulary.
- Label axes and projection.
- Support a selected token slot.
- Display entropy and probability mass.
- Never describe a 2D projection as the complete model state.

---

## 15.10 `EmbeddingTrajectory`

### Purpose

Visualize projected continuous latent/embedding movement.

### Requirements

- Require projection metadata.
- Support fixed-basis trajectories.
- Show start, current, and final points.
- Indicate whether token labels are nearest neighbors, decoded outputs, or annotations.
- Mark post-hoc projections as derived.

This component is phase 3, not MVP.

---

## 15.11 `DiffusionChat`

### Purpose

Embed diffusion generation in a familiar chat surface without reducing it to typing.

### Behavior

- The final answer MAY use normal markdown rendering.
- During generation, the mutable answer MUST use token/canvas semantics.
- The interface MUST not append characters one at a time unless the underlying model actually emits them that way.
- A compact mode MAY summarize intermediate states for small screens.
- The user MUST be able to pause visual playback without cancelling model inference.

---

## 16. Registry design

### 16.1 Root registry

Example:

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "dllm-viz",
  "homepage": "https://github.com/<owner>/dllm-viz",
  "items": [
    {
      "name": "denoising-token-canvas",
      "type": "registry:ui",
      "title": "Denoising Token Canvas",
      "description": "Trace-faithful token canvas for diffusion language model denoising.",
      "dependencies": [
        "@dllm-viz/core",
        "@dllm-viz/react",
        "motion"
      ],
      "registryDependencies": [
        "tooltip",
        "badge",
        "scroll-area"
      ],
      "files": [
        {
          "path": "registry/default/denoising-token-canvas/denoising-token-canvas.tsx",
          "type": "registry:component"
        }
      ]
    }
  ]
}
```

### 16.2 Install forms

Before namespace registration:

```bash
pnpm dlx shadcn@latest add <owner>/dllm-viz/denoising-token-canvas
```

After acceptance into the public registry directory:

```bash
pnpm dlx shadcn@latest add @dllm-viz/denoising-token-canvas
```

### 16.3 Registry rules

- Every item MUST declare npm dependencies.
- Every item MUST declare shadcn registry dependencies.
- Installed files MUST use consumer-safe aliases.
- Registry files MUST NOT import from `@workspace/*`.
- Each item MUST include a usage example.
- Complex blocks SHOULD depend on smaller registry items.
- Components SHOULD accept class names and CSS variables.
- Components MUST work in light and dark themes.
- Components MUST have no Next.js import.
- Components MUST work with `rsc: false`.

---

## 17. Styling and motion

### 17.1 Design tokens

The registry SHOULD define semantic CSS variables rather than fixed colors:

```css
--dllm-mask;
--dllm-proposed;
--dllm-committed;
--dllm-fixed;
--dllm-renoised;
--dllm-padding;
--dllm-confidence-low;
--dllm-confidence-high;
```

Consumers MUST be able to override them.

### 17.2 Motion implementation

Motion for React MAY be used for:

- slot insertion/removal,
- opacity transitions,
- selection focus,
- canvas activation,
- small transform-based state changes.

Reference:

- [Motion React animation](https://motion.dev/docs/react-animation)

The implementation SHOULD prefer transform and opacity for animated movement.

### 17.3 Reduced motion

The application and every registry item MUST honor:

```css
@media (prefers-reduced-motion: reduce) {
  /* disable non-essential movement */
}
```

References:

- [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)
- [MDN media queries for accessibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility)

Reduced motion MUST NOT remove information. It should replace spatial motion with immediate changes, outlines, labels, or restrained fades.

---

## 18. Accessibility requirements

All MVP components MUST:

- be keyboard operable,
- expose visible focus states,
- use semantic buttons,
- expose concise accessible names,
- avoid color-only state encoding,
- support 200% zoom,
- support reduced motion,
- maintain readable contrast,
- permit pause/stop of autoplay,
- avoid rapidly flashing changes,
- avoid announcing every token mutation through an ARIA live region.

Recommended screen-reader strategy:

```text
Step 12 of 32. 8 tokens committed, 24 masked, 2 remasked.
```

The detailed token state SHOULD remain available through focusable inspection.

---

## 19. Performance requirements

### 19.1 Token canvas

The MVP target is smooth interaction for:

- up to 256 visible slots,
- up to 512 frames,
- ordinary laptop browsers.

The component SHOULD avoid rerendering every slot when only a few operations changed.

### 19.2 Heatmaps

- DOM SHOULD NOT be used for tens of thousands of cells.
- Canvas SHOULD be used beyond a configurable threshold.
- OffscreenCanvas MAY be evaluated later.

### 19.3 Trace size

Bundled static examples SHOULD target:

- under 1 MB compressed per ordinary example,
- top-k candidates only,
- no hidden states or full logits by default,
- periodic checkpoints rather than full sequence snapshots.

### 19.4 Loading

- Trace parsing SHOULD occur outside render.
- Very large traces MAY be parsed in a Web Worker.
- The first meaningful frame SHOULD render before all optional analytics are computed.

---

## 20. Security and privacy

- All external traces MUST be runtime-validated.
- Token text MUST be rendered as text, never raw HTML.
- Markdown final output MUST use a sanitized renderer.
- Trace size, frame count, slot count, and candidate count MUST have configurable limits.
- Stream events MUST be bounded and validated.
- Adapter errors MUST not expose model paths, secrets, or unrelated user data.
- Example traces MUST not contain private prompts.
- Remote trace URLs SHOULD be subject to an allowlist in hosted demos.
- The registry SHOULD have no analytics dependency by default.

---

## 21. Testing strategy

### 21.1 Core unit tests

MUST test:

- delta application,
- reverse stepping,
- checkpoint seek,
- insertion/deletion,
- remasking,
- duplicate frame handling,
- schema validation,
- unknown optional fields,
- deterministic reconstruction,
- partial/incomplete traces.

### 21.2 Adapter contract tests

Every maintained adapter MUST run against a small fixture and verify:

- stable slot identity,
- prompt separation,
- final output agreement,
- correct frame ordering,
- provenance labels,
- special-token handling.

GPU-dependent tests MAY be optional CI jobs. Snapshot-to-trace conversion MUST have CPU fixtures.

### 21.3 Component tests

Use Vitest and React Testing Library for:

- keyboard controls,
- accessible names,
- reduced-motion branch,
- selected-slot behavior,
- empty and partial traces,
- live frame append,
- error states.

### 21.4 Browser tests

Playwright SHOULD cover:

- demo routes,
- registry component installation smoke test,
- static deployment base path,
- dark/light themes,
- mobile layout,
- cross-component synchronized selection.

### 21.5 Visual regression

Visual regression SHOULD include:

- initial all-mask state,
- mixed state,
- remasking frame,
- final state,
- block boundary,
- reduced-motion state,
- high-contrast theme.

### 21.6 Performance regression

A benchmark fixture SHOULD include:

- 256 slots,
- 512 frames,
- 10 operations per frame,
- one dense heatmap.

CI SHOULD detect substantial regression rather than enforce unrealistic universal FPS.

---

## 22. Documentation and demo application

The Vite `apps/web` application MUST include:

1. project overview,
2. why generic text scramble is insufficient,
3. trace protocol documentation,
4. component gallery,
5. adapter guide,
6. static trace guide,
7. live streaming guide,
8. accessibility guide,
9. provenance/truthfulness guide,
10. model-family examples.

Required demo routes:

```text
/
 /docs/getting-started
 /docs/trace-schema
 /docs/adapters
 /docs/streaming
 /components/denoising-token-canvas
 /components/commit-heatmap
 /components/block-diffusion-canvas
 /examples/llada
 /examples/dream
 /examples/diffusiongemma
 /examples/continuous
 /compare
```

The site MUST build with:

```bash
pnpm build
```

It MUST be statically deployable.

Reference:

- [Vite static deployment guide](https://vite.dev/guide/static-deploy)

---

## 23. Example traces

The repository SHOULD include curated traces with explicit licenses/provenance:

| Fixture | Purpose |
|---|---|
| `masked-basic.json` | Monotonic masked diffusion |
| `masked-remask.json` | Visible token is remasked and replaced |
| `confidence-commit.json` | Confidence-ranked commits |
| `block-canvas.json` | Outer canvas and inner steps |
| `variable-length.json` | Slot insertion and deletion |
| `simplex-topk.json` | Top-k probability trajectory |
| `continuous-projection.json` | Derived fixed-basis latent projection |
| `ar-baseline.json` | Left-to-right comparison baseline |
| `partial-stream.jsonl` | Interrupted live generation |

At least one fixture MUST be hand-authored and labeled illustrative so tests can verify provenance rendering.

---

## 24. Release plan

### Phase 0 — Repository foundation

Deliverables:

- instantiate `react-monorepo-template`,
- add packages,
- add root `registry.json`,
- configure aliases,
- configure package builds,
- add Apache-2.0 license,
- set up docs skeleton.

Exit criteria:

- `pnpm lint`,
- `pnpm typecheck`,
- `pnpm test`,
- `pnpm build`

all pass.

### Phase 1 — Trace core and discrete MVP

Deliverables:

- schema `0.1`,
- core player,
- React provider/hooks,
- `DenoisingTokenCanvas`,
- `DiffusionStepControls`,
- `TraceInspector`,
- basic masked and remasking fixtures.

Exit criteria:

- deterministic replay,
- static Vite demo,
- installable registry items,
- accessibility smoke tests.

### Phase 2 — Research-useful visualizations

Deliverables:

- `CommitHeatmap`,
- `CandidateDistribution`,
- `BlockDiffusionCanvas`,
- synchronized selection,
- comparison component,
- larger trace codec/checkpoints.

Exit criteria:

- correct block/canvas demo,
- dense heatmap performance fixture,
- model/algorithm comparison demo.

### Phase 3 — Unturtle and live streaming

Deliverables:

- Python trace exporter,
- Unturtle adapter,
- SSE/fetch stream client,
- live append mode,
- partial trace recovery.

Exit criteria:

- one Unturtle generation can be replayed from file,
- the same generation can be displayed live,
- final decoded text agrees with Unturtle output.

### Phase 4 — Continuous/simplex support

Deliverables:

- top-k simplex trace support,
- `SimplexTrajectory`,
- projection metadata,
- `EmbeddingTrajectory`,
- continuous fixture and documentation.

Exit criteria:

- projection provenance visible,
- no misleading “true latent space” language,
- fixed-basis trajectory replay works.

### Phase 5 — Public registry release

Deliverables:

- versioned packages,
- public documentation,
- GitHub registry installation,
- registry directory namespace submission,
- contribution guide,
- adapter authoring guide.

---

## 25. MVP definition

The first public version MUST include:

- `@dllm-viz/core`,
- `@dllm-viz/react`,
- trace schema `0.1`,
- static JSON/JSONL loading,
- deterministic player,
- `DenoisingTokenCanvas`,
- `DiffusionStepControls`,
- `TraceInspector`,
- `CommitHeatmap`,
- at least one remasking fixture,
- at least one block/canvas fixture,
- Vite documentation/demo,
- root shadcn `registry.json`,
- reduced-motion behavior,
- keyboard controls,
- provenance labels.

The MVP MAY omit:

- live model hosting,
- full Unturtle structured callback,
- variable-length component,
- latent trajectories,
- WebSocket control,
- binary trace codecs.

---

## 26. Project-level acceptance criteria

The project is ready for an initial stable release when:

1. A user can install a component from the GitHub repository with the shadcn CLI.
2. The installed component works in a clean Vite React application.
3. No installed component imports Next.js.
4. A static LLaDA-style trace can be played, paused, scrubbed, and inspected.
5. A token can be shown as committed, remasked, and replaced without losing its slot identity.
6. A DiffusionGemma-style trace visibly separates outer canvases and inner denoising.
7. A dense position × step heatmap remains responsive.
8. Every displayed metric exposes measured/derived/illustrative provenance.
9. Reduced-motion mode preserves all information.
10. The final reconstructed sequence matches the trace final output.
11. Unturtle history or stream snapshots can be converted without modifying the frontend.
12. All core, component, and browser tests pass.
13. The demo builds and deploys as a static Vite site.
14. Documentation explicitly warns against substituting generic text scramble for real inference traces.

---

## 27. Open questions

These questions do not block phase 0 but should be resolved before schema `1.0`.

1. Should the trace schema be maintained as a standalone language-neutral specification?
2. Should adapters be separate npm packages from the start?
3. Should the Python exporter live here or in Unturtle?
4. Should token distributions use probability, log-probability, or allow both?
5. How should batch generation be represented: one trace per sample or one trace with lanes?
6. How should branching/corrector sampling be represented?
7. Should variable-length slot identity use UUIDs, deterministic position-derived IDs, or adapter-defined IDs?
8. Should annotations be embedded in traces or stored in a sidecar file?
9. Should schema validation use Zod as the canonical source and emit JSON Schema, or vice versa?
10. Which project name is clearest: `dllm-viz`, `diffusion-ui`, `diffusion-language-ui`, or an Unturtle-associated name?

---

## 28. Recommended immediate implementation sequence

1. Create the repository from `react-monorepo-template`.
2. Add `packages/core` and define schema `0.1`.
3. Hand-author `masked-remask.json`.
4. Implement delta reconstruction and seek.
5. Implement React provider/hooks.
6. Implement `DenoisingTokenCanvas`.
7. Implement controls and inspector.
8. Render registry source directly in `apps/web`.
9. Add root `registry.json`.
10. Add `CommitHeatmap`.
11. Build the initial Unturtle snapshot adapter.
12. Add DiffusionGemma canvas fixture.
13. Publish a preview using static Vite hosting.
14. Only then add live streaming and continuous-state components.

This order validates the core product hypothesis before investing in model-serving infrastructure.

---

## 29. Reference index

### Project and framework

- [nishide-dev/react-monorepo-template](https://github.com/nishide-dev/react-monorepo-template)
- [nishide-dev/unturtle](https://github.com/nishide-dev/unturtle)
- [shadcn Registry Introduction](https://ui.shadcn.com/docs/registry)
- [shadcn Registry Getting Started](https://ui.shadcn.com/docs/registry/getting-started)
- [shadcn GitHub Registries](https://ui.shadcn.com/docs/registry/github)
- [shadcn registry.json](https://ui.shadcn.com/docs/registry/registry-json)
- [shadcn Registry Directory](https://ui.shadcn.com/docs/registry/registry-index)
- [Vite static deployment](https://vite.dev/guide/static-deploy)
- [Motion for React](https://motion.dev/docs/react-animation)

### Diffusion language models

- [Unsloth DiffusionGemma](https://unsloth.ai/docs/models/diffusiongemma)
- [Google DiffusionGemma explanation](https://ai.google.dev/gemma/docs/diffusiongemma/explained)
- [Transformers DiffusionGemma](https://huggingface.co/docs/transformers/en/model_doc/diffusion_gemma)
- [Diffusers DiffusionGemma](https://huggingface.co/docs/diffusers/main/en/api/pipelines/diffusion_gemma)
- [LLaDA repository](https://github.com/ML-GSAI/LLaDA)
- [LLaDA paper](https://arxiv.org/abs/2502.09992)
- [Dream repository](https://github.com/DreamLM/Dream)
- [Dream paper](https://arxiv.org/abs/2508.15487)
- [DreamOn repository](https://github.com/DreamLM/DreamOn)
- [DreamOn paper](https://arxiv.org/abs/2602.01326)
- [MDLM repository](https://github.com/kuleshov-group/mdlm)
- [MDLM paper](https://arxiv.org/abs/2406.07524)
- [ReMDM repository](https://github.com/kuleshov-group/remdm)
- [BD3-LM repository](https://github.com/kuleshov-group/bd3lms)
- [Block Diffusion paper](https://arxiv.org/abs/2503.09573)
- [Diffusion-LM repository](https://github.com/XiangLi1999/Diffusion-LM)
- [Diffusion-LM paper](https://arxiv.org/abs/2205.14217)
- [SSD-LM paper](https://aclanthology.org/2023.acl-long.647/)
- [TESS repository](https://github.com/allenai/tess-diffusion)
- [TESS paper](https://aclanthology.org/2024.eacl-long.144/)
- [RDLM repository](https://github.com/harryjo97/RDLM)
- [Continuous Diffusion Model for Language Modeling](https://arxiv.org/abs/2502.11564)
- [Awesome Diffusion Language Models](https://github.com/VILA-Lab/Awesome-DLMs)

### Visualization references

- [Transformer Explainer repository](https://github.com/poloclub/transformer-explainer)
- [Transformer Explainer paper](https://arxiv.org/abs/2408.04619)
- [Diffusion Explainer repository](https://github.com/poloclub/diffusion-explainer)
- [Diffusion Explainer live demo](https://poloclub.github.io/diffusion-explainer/)
- [AnimatedLLM paper](https://arxiv.org/abs/2601.04213)
- [AnimatedLLM live demo](https://animatedllm.github.io/)
- [Magic UI Text Animate](https://magicui.design/docs/components/text-animate)
- [Magic UI Hyper Text](https://magicui.design/docs/components/hyper-text)
- [Animate UI](https://animate-ui.com/docs)

### Web platform and accessibility

- [MDN Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MDN Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)

---

## 30. Final recommendation

The repository should proceed.

The strongest version of the project is not “animated text components for shadcn.” It is:

> A trace protocol, headless playback engine, model adapters, and open-code visualization registry for diffusion language models.

Using `nishide-dev/react-monorepo-template` is appropriate and preferable for the initial implementation. Vite is sufficient for the documentation site, component gallery, static trace player, and GitHub-hosted shadcn registry. Next.js should remain an optional integration target rather than a foundation.

The project’s defensible technical value will come from:

- truthful state semantics,
- trace portability,
- remasking support,
- nested block/canvas representation,
- continuous-state provenance,
- static and live compatibility,
- Unturtle integration,
- accessible, installable shadcn components.

Animation quality matters, but semantic correctness is the core product.

