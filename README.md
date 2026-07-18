# dllm-viz

Open-code, shadcn-installable visualization primitives for **diffusion language models (dLLMs)**.

Diffusion LMs don't type left-to-right: tokens appear in arbitrary order, several positions update at once, and a visible token may later be remasked and replaced. Generic "text scramble" animations can look like this but encode none of it. `dllm-viz` treats animation as a **rendering of structured inference events**: components deterministically replay a versioned trace of what the model actually did — never a fake effect.

> **Status:** Phase 1 MVP — trace schema `0.1`, deterministic player, and the first three registry components. See [`docs/spec.md`](docs/spec.md) for the full specification and roadmap.

## Install components

Components are distributed as a [shadcn registry](https://ui.shadcn.com/docs/registry) directly from this repository:

```bash
pnpm dlx shadcn@latest add nishide-dev/dllm-viz/denoising-token-canvas
pnpm dlx shadcn@latest add nishide-dev/dllm-viz/diffusion-step-controls
pnpm dlx shadcn@latest add nishide-dev/dllm-viz/trace-inspector
```

Each component pulls in the shared `dllm-viz-core` (trace schema, validation, playback engine) and `dllm-viz-react` (headless provider/hooks) lib items automatically. No Next.js required — everything works in a plain Vite React app with `rsc: false`.

| Component | Purpose |
|---|---|
| `denoising-token-canvas` | Token slots with mask / proposed / committed / remasked states, non-color-only encoding, screen-reader step summary |
| `diffusion-step-controls` | Play/pause, frame stepping, scrubber, playback rate, keyboard shortcuts (Space, ←/→, Home/End) |
| `trace-inspector` | Exact slot/frame data: token IDs, confidence, top-k candidates, operation history, per-field provenance |

## Usage

```tsx
import { parseTraceJson } from "@/lib/dllm-viz-core"
import { DiffusionTraceProvider } from "@/lib/dllm-viz-react"
import { DenoisingTokenCanvas } from "@/components/denoising-token-canvas"
import { DiffusionStepControls } from "@/components/diffusion-step-controls"

const trace = parseTraceJson(await fetch("/traces/masked-remask.json").then((r) => r.text()))

export function Demo() {
  return (
    <DiffusionTraceProvider trace={trace}>
      <DenoisingTokenCanvas />
      <DiffusionStepControls />
    </DiffusionTraceProvider>
  )
}
```

Traces are plain JSON/JSONL files conforming to schema `0.1` ([`schemas/trace.schema.json`](schemas/trace.schema.json), generated from the canonical Zod definitions). Example traces live in [`examples/traces/`](examples/traces). Remasking is a first-class operation, and every trace declares its provenance — `measured`, `derived`, or `illustrative` — which components label visibly.

## Repository structure

```
apps/
  web/          # Vite docs/demo site — renders the same registry source users install
packages/
  core/         # @dllm-viz/core — trace schema 0.1, validation, codecs, player (no React)
  react/        # @dllm-viz/react — headless DiffusionTraceProvider + hooks (no styling)
  ui/           # @workspace/ui — internal shadcn foundation for the demo app only
registry/
  default/      # canonical registry item sources (+ generated lib/ copies of core/react)
schemas/        # JSON Schemas generated from Zod (do not edit by hand)
examples/
  traces/       # curated example traces (all current fixtures are labeled illustrative)
registry.json   # shadcn registry index (generated)
```

## Development

pnpm 10 + Turborepo monorepo, Node >= 20.

```bash
pnpm install
pnpm dev             # start the Vite demo site
pnpm build           # typecheck + build all packages
pnpm test            # vitest across all packages
pnpm lint            # biome check
pnpm format          # biome check --write
pnpm typecheck       # tsc --noEmit per package
pnpm registry:build  # regenerate registry/default/lib + registry.json from packages/*
```

Run a single package or test file:

```bash
pnpm --filter @dllm-viz/core test
pnpm --filter web exec vitest run src/components/denoising-token-canvas.test.tsx
```

`registry/default/lib/*` and `registry.json` are generated — edit `packages/core` / `packages/react` and run `pnpm registry:build`; CI fails on drift.

Adding internal shadcn/ui components for the demo app (these land in `packages/ui/src/components` and are **not** part of the distributed registry):

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

## Design principles

- **Semantic correctness over decoration.** Components replay traces; they never simulate model behavior with generic text effects.
- **No monotonicity assumptions.** Arbitrary commit order, remasking, and variable-length operations are normal, not errors.
- **Truthful provenance.** Illustrative or derived data is always visibly labeled.
- **Accessible by requirement.** Keyboard operable, `prefers-reduced-motion` without information loss, no color-only state encoding.
- **Headless core.** `@dllm-viz/core` has no React dependency; `@dllm-viz/react` has no visual styling.

## License

[Apache-2.0](LICENSE)

> Generated with [react-monorepo-template](https://github.com/nishide-dev/react-monorepo-template)
