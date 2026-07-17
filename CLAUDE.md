# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`dllm-viz` — shadcn-installable visualization primitives for diffusion language models (dLLMs). The full product/technical specification lives in **`docs/spec.md`** and is the source of truth for what to build. Read it before making design decisions.

The repository is currently in template state (from `nishide-dev/react-monorepo-template`). Development workflow: review/refine the spec, write a plan, implement, review, merge — iteratively.

## Commands

pnpm + Turborepo monorepo. All root commands fan out via turbo:

```bash
pnpm install         # install (pnpm 10, Node >= 20)
pnpm dev             # start Vite dev server (apps/web)
pnpm build           # tsc -b + vite build
pnpm lint            # biome check (lint + format check)
pnpm format          # biome check --write (auto-fix)
pnpm typecheck       # tsc --noEmit per package
pnpm test            # vitest run per package
```

Per-package / single test:

```bash
pnpm --filter web test                              # one package's tests
pnpm --filter web exec vitest run src/App.test.tsx  # one test file
pnpm --filter @workspace/ui exec vitest run src/components/button.test.tsx
```

Adding shadcn/ui components (they land in `packages/ui/src/components`):

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build. Lefthook runs `biome check --write` on staged files pre-commit.

## Code style

Biome enforced: 2-space indent, 80 line width, double quotes, semicolons `asNeeded`, sorted Tailwind classes via `cn`/`cva`. Unused variables/imports are errors.

## Architecture

### Current state (template)

- `apps/web` — Vite + React 19 app. Tests use Vitest + React Testing Library (jsdom, setup in `src/test/setup.ts`). Alias `@` → `apps/web/src`.
- `packages/ui` — shared shadcn foundation `@workspace/ui`, exported via subpaths (`@workspace/ui/components/*`, `/lib/*`, `/hooks/*`, `/globals.css`). Tailwind CSS v4 (CSS-based config in `src/styles/globals.css`, no tailwind.config).
- shadcn config: `rsc: false`, style `base-nova`, base-ui (`@base-ui/react`) primitives, lucide icons.

### Target architecture (per docs/spec.md)

Layered separation that must be preserved:

1. `packages/core` (`@dllm-viz/core`) — model-independent trace schema (`0.1`), playback state machine, delta/checkpoint reconstruction, codecs, validation. **No React dependency.**
2. `packages/react` (`@dllm-viz/react`) — headless provider/hooks (`useDiffusionPlayer`, `useTokenSlots`, …). **No visual styling.**
3. `packages/adapters` — adapters converting model/runtime output (Unturtle, LLaDA, Dream, DiffusionGemma) into traces.
4. `registry/default/*` — canonical source of distributable shadcn registry items (DenoisingTokenCanvas, DiffusionStepControls, TraceInspector, CommitHeatmap, …), listed in root `registry.json`.
5. `apps/web` — static Vite docs/demo site that renders the same registry source users install (no demo-only duplicates).

Key invariants from the spec:

- Registry item source must NOT import `@workspace/*` aliases or Next.js APIs; components must work with `rsc: false` and build as a static Vite site.
- Traces distinguish `measured` / `derived` / `illustrative` provenance; illustrative data must be visibly labeled — never fake model behavior with generic text effects.
- The trace protocol treats remasking as a normal operation and must not assume monotonic unmasking or left-to-right generation.
- Accessibility is required: keyboard controls, `prefers-reduced-motion` (reduce motion without losing information), no color-only state encoding.
- `@workspace/ui` stays the internal demo foundation; it is not the distribution channel for dLLM components.
