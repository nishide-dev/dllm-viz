# DiffusionChat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved DiffusionChat design (`docs/superpowers/specs/2026-07-22-diffusion-chat-design.md`, spec §15.11): a research-demo chat surface that embeds diffusion trace playback in assistant bubbles. Deliverables: the four official shadcn chat items (`message-scroller`, `message`, `bubble`, `marker`) installed into `@workspace/ui` with `apps/web` bridge files; the hand-authored `chatRemaskTrace` fixture (28-slot completion, confidence-ranked commits, one showcase remask slot); the `diffusion-chat` registry item; and the `/components/diffusion-chat` scripted-send demo route with a "Chat" nav entry. Exactly the design's scope — no markdown rendering, no free-form input, no attachments.

**Architecture:** `DiffusionChat` is a registry component (`registry/default/diffusion-chat/diffusion-chat.tsx`) that renders a `ChatTurn[]` conversation inside the official `MessageScroller` chrome. Settled turns render plain text in a `Bubble` (whitespace preserved, token text as text per §20). Trace turns mount a per-turn `DiffusionTraceProvider` and render `DenoisingTokenCanvas` with `showPrompt={false}` plus compact inline pause/step controls that call the player API directly (no `DiffusionStepControls`, no global keyboard hook) and a `Marker` status line. When playback reaches the last frame the bubble swaps to the settled completion text (derived by materializing the final frame and dropping prompt slots) with a "Show generation" toggle that reseeks to frame 0; `onGenerationEnd(turnId)` fires once per mounted turn. Chat chrome is imported via consumer-standard `@/components/ui/<name>` aliases; in `apps/web` those resolve through bridge files re-exporting `@workspace/ui/components/<name>` (where the shadcn CLI installs the official items), and `DenoisingTokenCanvas` is imported via `@/components/denoising-token-canvas` with an analogous bridge to the registry source. `chatRemaskTrace` joins the existing fixtures in `packages/core/src/testing/fixtures.ts` and the JSON export script. `scripts/build-registry.mjs` gains the `diffusion-chat` item with bare official `registryDependencies` plus `nishide-dev/dllm-viz/<item>` for our own items.

**Tech Stack:** unchanged from Phase 2 — React 19, Vite 8, TypeScript ~6, Zod ^4.4.3, Vitest 4 + React Testing Library, Biome, pnpm 10 + Turborepo, react-router-dom ^7. New: official shadcn chat items vendored into `packages/ui/src/components` via the shadcn CLI; npm dependency `@shadcn/react` (headless `message-scroller` primitives) added to `@workspace/ui` by the install. `bubble`/`marker` use `@base-ui/react` + `class-variance-authority`, both already dependencies of `@workspace/ui`.

**Registry reality check (performed 2026-07-22, network):** all four items exist at `https://ui.shadcn.com/r/styles/base-nova/<name>.json` (HTTP 200; `apps/web/components.json` has `"style": "base-nova"`, so this is the URL form the CLI uses). Shapes:

| item | npm dependencies | registryDependencies | exports |
|---|---|---|---|
| `message-scroller` | `@shadcn/react` | `button` | `MessageScrollerProvider`, `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerButton`, `useMessageScroller`, `useMessageScrollerScrollable`, `useMessageScrollerVisibility` |
| `message` | — | — | `MessageGroup`, `Message` (`align?: "start" \| "end"`), `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter` |
| `bubble` | — (`@base-ui/react`, `cva` already present) | — | `BubbleGroup`, `Bubble` (`variant`, `align`), `BubbleContent`, `BubbleReactions` |
| `marker` | — (`@base-ui/react`, `cva` already present) | — | `Marker`, `MarkerIcon`, `MarkerContent`, `markerVariants` |

`button` (the only peer registryDependency) already exists in `packages/ui/src/components/button.tsx`. There is **no `shimmer` registry item** (the design's reference list mentions one; `/r/styles/base-nova/shimmer.json` 404s) — the "shimmer" status text is implemented as an `animate-pulse` class gated on reduced motion. The `message-scroller` payload imports `IconPlaceholder` from `@/app/(create)/components/icon-placeholder`; the CLI replaces icon placeholders with the configured `iconLibrary` (`lucide`) at install time — Task 1 verifies this and gives a manual fix if any placeholder survives.

## Global Constraints

- Node `>=20`, pnpm `10.33.4` (`packageManager` field). Run everything from repo root with `pnpm --filter <pkg> …`.
- Biome-enforced style: 2-space indent, line width 80, double quotes, semicolons `asNeeded`, trailing commas `es5`, sorted Tailwind classes in `cn()`, alphabetically sorted JSX props. Unused vars/imports are errors. Pre-commit hook auto-fixes staged files. Run `pnpm format` after the CLI install (Task 1) — vendored upstream code is not Biome-styled.
- `@dllm-viz/core` MUST have no React dependency; `@dllm-viz/react` MUST be headless (spec §8.3). This plan adds nothing to `packages/react`.
- Registry source under `registry/default/*` MUST NOT import `@workspace/*` or Next.js APIs (spec §16.3). Allowed imports for `diffusion-chat`: react, lucide-react, `@/lib/dllm-viz-core`, `@/lib/dllm-viz-react`, `@/lib/utils`, chat chrome via `@/components/ui/<name>`, and the composed canvas via `@/components/denoising-token-canvas` — these are the consumer-standard install-target aliases (spec §16.3 "installed files MUST use consumer-safe aliases"). `@/registry/...` paths remain demo-only and MUST NOT appear in registry source.
- **registryDependencies rules:** bare names (`message-scroller`, `message`, `bubble`, `marker`) ONLY for official shadcn items — they resolve against the official registry, which is correct for official items. Our own items MUST use the `nishide-dev/dllm-viz/<item>` form (bare names for our items 404 — PR #2 lesson). The `componentItem` helper's `extra` spread replaces the default `registryDependencies`, so the `diffusion-chat` entry must list `nishide-dev/dllm-viz/dllm-viz-core` and `nishide-dev/dllm-viz/dllm-viz-react` explicitly alongside the official bare names.
- `apps/web` tsconfig uses `erasableSyntaxOnly` + `verbatimModuleSyntax`: registry files must not use enums/namespaces and must use `import type` for types.
- `DiffusionSnapshot.slots` is `readonly TokenSlot[]`. New code must accept `readonly TokenSlot[]`; never cast the readonly away.
- The keyboard hook (`useDiffusionKeyboard`) MUST NOT be bound globally inside chat: multiple trace turns and chat inputs share the page (design decision). Inline controls call the player API (`toggle`/`stepForward`/`stepBackward`/`seek`) directly.
- §15.11 MUSTs: the mutable answer uses token/canvas semantics — the interface never appends characters one at a time; pause halts visual playback only (in static replay there is no inference; under live streaming the player already accumulates `appendFrame` while paused — documented in component JSDoc, not re-implemented here).
- §20: token text and settled answers are rendered as text, never raw HTML. Markdown rendering is deferred (design "Out of scope"); do not add a markdown dependency.
- Trace rules: `schemaVersion: "0.1"`; `initial.frameOrdinal === -1`; frame ordinals strictly increasing; slot IDs monotonic `s0`, `s1`, … never reused; checkpoints only in the top-level `checkpoints` array.
- All hand-authored fixtures MUST set `provenance.mode: "illustrative"` (spec §23); the trace-turn bubble shows a visible provenance badge in every view. No `Math.random` anywhere in fixtures.
- The trace protocol treats remasking as normal — `chatRemaskTrace` exercises it, and the component derives everything from player snapshots (no monotonic-unmasking or left-to-right assumptions).
- Accessibility (spec §18): keyboard operable, semantic buttons, concise accessible names, visible focus, no color-only state encoding, `prefers-reduced-motion` respected without information loss (the shimmer is decoration; the status text carries the information), no per-token live regions, autoplay pausable.
- Before every commit: `pnpm lint && pnpm typecheck && pnpm test` must pass. Tasks that touch `packages/*` sources must also run `pnpm registry:build` before committing so `registry/default/lib` and `registry.json` stay in sync (CI has a drift check).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

```
packages/ui/src/components/
  message-scroller.tsx               (Task 1) installed by shadcn CLI (or vendored fallback)
  message.tsx                        (Task 1) installed by shadcn CLI
  bubble.tsx                         (Task 1) installed by shadcn CLI
  marker.tsx                         (Task 1) installed by shadcn CLI
packages/ui/package.json             (Task 1, modified by CLI) + @shadcn/react dependency
packages/core/
  src/testing/fixtures.ts            (Task 2, modify) + chatRemaskTrace
  src/testing/fixtures-chat.test.ts  (Task 2)
  scripts/export-fixtures.mjs        (Task 2, modify) + chat-remask.json
apps/web/src/
  test/setup.ts                      (Task 1, modify) ResizeObserver / scrollTo / IntersectionObserver stubs
  components/ui/message-scroller.ts  (Task 1) bridge → @workspace/ui/components/message-scroller
  components/ui/message.ts           (Task 1) bridge
  components/ui/bubble.ts            (Task 1) bridge
  components/ui/marker.ts            (Task 1) bridge
  components/ui-chrome.test.tsx      (Task 1) import + jsdom render smoke test
  components/denoising-token-canvas.ts (Task 3) bridge → @/registry/default/denoising-token-canvas/…
  components/diffusion-chat.test.tsx (Task 3)
  routes/diffusion-chat-demo.tsx     (Task 4)
  routes/home.tsx                    (Task 4, modify) gallery link
  components/site-nav.tsx            (Task 4, modify) "Chat" nav entry
  App.tsx  App.test.tsx              (Task 4, modify) route + route tests
registry/default/diffusion-chat/diffusion-chat.tsx (Task 3)
scripts/build-registry.mjs           (Task 4, modify) + diffusion-chat item
examples/traces/chat-remask.json     GENERATED (Task 2)
apps/web/public/traces/chat-remask.json GENERATED (Task 2)
```

Component tests live in `apps/web/src/components` (not `registry/`) so the existing vitest setup applies; they import registry source through the same aliases users get.

---

### Task 1: Install the official chat chrome into `@workspace/ui` and bridge it into `apps/web`

**Files:**
- Create (via CLI): `packages/ui/src/components/message-scroller.tsx`, `message.tsx`, `bubble.tsx`, `marker.tsx`
- Create: `apps/web/src/components/ui/message-scroller.ts`, `message.ts`, `bubble.ts`, `marker.ts`, `apps/web/src/components/ui-chrome.test.tsx`
- Modify: `apps/web/src/test/setup.ts`, `packages/ui/package.json` (by CLI: `@shadcn/react`)

**Interfaces:**
- Consumes: shadcn CLI with `apps/web/components.json` (`style: base-nova`, alias `ui` → `@workspace/ui/components`, so installed files land in `packages/ui/src/components`); existing `button.tsx` satisfies `message-scroller`'s only registry dependency.
- Produces: chat chrome importable as `@/components/ui/<name>` inside `apps/web` (and therefore inside registry source rendered by the demo) — exports per the reality-check table above. The bridges are one-line `export *` files; `@workspace/ui` stays the internal demo foundation and is never imported from `registry/`.

- [ ] **Step 1: Install the four official items**

Run from repo root:

```bash
pnpm dlx shadcn@latest add message-scroller message bubble marker -c apps/web
git status --short
```

Expected: `packages/ui/src/components/{message-scroller,message,bubble,marker}.tsx` created; `packages/ui/package.json` gains `@shadcn/react`; lockfile updated (run `pnpm install` afterwards if the CLI did not). `button.tsx` may be reported as skipped/existing — fine.

- [ ] **Step 2: Verify the installed sources**

Read each installed file and confirm:

1. Imports were rewritten to this workspace's aliases: `cn` from `@workspace/ui/lib/utils` (per `components.json` `aliases.utils`), `Button` from `@workspace/ui/components/button` (per `aliases.ui`). If any `@/registry/base-nova/...` import survived, rewrite it to the corresponding `@workspace/ui/...` path by hand.
2. No `IconPlaceholder` import remains in `message-scroller.tsx` (upstream payload imports it from `@/app/(create)/components/icon-placeholder`; the CLI replaces icon placeholders using `iconLibrary: "lucide"`). If it survived, replace the import with `import { ArrowDown } from "lucide-react"` and the `<IconPlaceholder … />` usage inside `MessageScrollerButton` with `<ArrowDown />`.
3. Exports match the reality-check table (the diffusion-chat component and bridges depend on these names).

Then normalize style and confirm the workspace still typechecks:

```bash
pnpm install
pnpm format
pnpm --filter @workspace/ui typecheck
```

Expected: PASS. If Biome flags an unfixable rule inside the vendored files, add a targeted `// biome-ignore <rule>: vendored shadcn source` comment rather than restructuring upstream code. If `useRender`/`mergeProps` types fail against `@base-ui/react` `^1.6.0`, bump `@base-ui/react` in `packages/ui` to the latest 1.x and re-run.

**Contingency (design risk — CLI install fails):** if `pnpm dlx shadcn@latest add …` cannot install any item (network, style 404, or `@shadcn/react` unresolvable), vendor minimal equivalents while keeping the bare `registryDependencies` for consumers:

1. Fetch payloads directly and write the component files:

```bash
for n in message bubble marker; do
  curl -s "https://ui.shadcn.com/r/styles/base-nova/$n.json" \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).files[0].content))' \
    > packages/ui/src/components/$n.tsx
done
```

2. In each written file, rewrite `@/registry/base-nova/lib/utils` → `@workspace/ui/lib/utils`.
3. For `message-scroller` (the only item needing `@shadcn/react`), write this minimal equivalent instead — same export names the chat uses, plain overflow scrolling pinned to bottom:

```tsx
// packages/ui/src/components/message-scroller.tsx
// Minimal fallback for the official message-scroller (design risk note):
// same export surface DiffusionChat uses, without @shadcn/react.
import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

function MessageScrollerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex size-full min-h-0 flex-col overflow-hidden",
        className
      )}
      data-slot="message-scroller"
      {...props}
    />
  )
}

function MessageScrollerViewport({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const pin = () => node.scrollTo({ top: node.scrollHeight })
    const observer = new MutationObserver(pin)
    observer.observe(node, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return (
    <div
      className={cn(
        "size-full min-h-0 overflow-y-auto overscroll-contain",
        className
      )}
      data-slot="message-scroller-viewport"
      ref={ref}
      {...props}
    >
      {children}
    </div>
  )
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex h-max min-h-full flex-col gap-6", className)}
      data-slot="message-scroller-content"
      {...props}
    />
  )
}

function MessageScrollerItem({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-w-0 shrink-0", className)}
      data-slot="message-scroller-item"
      {...props}
    />
  )
}

export {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
}
```

Then continue with Step 3 unchanged (the bridges and all later code use only the shared export surface; the smoke test deliberately omits `MessageScrollerButton` and the hooks so it passes against either implementation).

- [ ] **Step 3: Add jsdom stubs required by the scroller primitives**

Append to `apps/web/src/test/setup.ts` (all guarded, so nothing breaks if jsdom grows support):

```ts
// The message-scroller primitives observe element size and scroll the
// viewport; jsdom implements neither.
if (!("ResizeObserver" in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver
}
if (!("IntersectionObserver" in window)) {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  window.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo
}
```

- [ ] **Step 4: Write the failing bridge smoke test** (`apps/web/src/components/ui-chrome.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

describe("chat chrome bridges", () => {
  it("re-export the official chat components", () => {
    for (const component of [
      Bubble,
      BubbleContent,
      Marker,
      MarkerContent,
      Message,
      MessageContent,
      MessageScroller,
      MessageScrollerContent,
      MessageScrollerItem,
      MessageScrollerProvider,
      MessageScrollerViewport,
    ]) {
      expect(typeof component).toBe("function")
    }
  })

  it("renders a bubble inside the scroller in jsdom", () => {
    render(
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent>
              <MessageScrollerItem>
                <Message align="end">
                  <MessageContent>
                    <Bubble align="end">
                      <BubbleContent>hello</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    )
    expect(screen.getByText("hello")).toBeInTheDocument()
    render(
      <Marker>
        <MarkerContent>status</MarkerContent>
      </Marker>
    )
    expect(screen.getByText("status")).toBeInTheDocument()
  })
})
```

Run: `pnpm --filter web exec vitest run src/components/ui-chrome.test.tsx`
Expected: FAIL — the `@/components/ui/*` bridge modules do not exist.

- [ ] **Step 5: Create the bridge files**

Each bridge is one line; they make the consumer-standard `@/components/ui/<name>` alias resolve inside `apps/web` (where `aliases.ui` points at `@workspace/ui/components` instead):

`apps/web/src/components/ui/message-scroller.ts`:

```ts
export * from "@workspace/ui/components/message-scroller"
```

`apps/web/src/components/ui/message.ts`:

```ts
export * from "@workspace/ui/components/message"
```

`apps/web/src/components/ui/bubble.ts`:

```ts
export * from "@workspace/ui/components/bubble"
```

`apps/web/src/components/ui/marker.ts`:

```ts
export * from "@workspace/ui/components/marker"
```

Run: `pnpm --filter web exec vitest run src/components/ui-chrome.test.tsx`
Expected: PASS (2 tests). This is the jsdom canary for the scroller primitives: if the second test throws inside `@shadcn/react` despite the Step 3 stubs, add the missing guarded stub to `setup.ts` (match the error, e.g. `scrollBy`, `requestAnimationFrame` timing) rather than mocking the chrome away.

- [ ] **Step 6: Full verification and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS (registry source untouched, so `pnpm registry:build` is not required here; running it anyway must produce no diff).

```bash
git add -A
git commit -m "feat(ui): install official shadcn chat chrome (message-scroller, message, bubble, marker) with web bridges

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `chatRemaskTrace` fixture

**Files:**
- Create: `packages/core/src/testing/fixtures-chat.test.ts`
- Modify: `packages/core/src/testing/fixtures.ts`, `packages/core/scripts/export-fixtures.mjs`

**Interfaces:**
- Consumes: `slot()` and `sharedMeta` helpers already in `fixtures.ts` (module-private — the fixture is appended to the same file); `parseTrace`, `materializeSlots`.
- Produces (exported from `@dllm-viz/core` via the existing `export * from "./testing/fixtures"` — no `index.ts` change needed):
  - `chatRemaskTrace: DiffusionTrace` — illustrative chat Q&A. Prompt region: single slot `s0`, `"Why can diffusion LMs revise their own output?"`. Completion: 28 slots `s1`–`s28`, committed in confidence-ranked order across 8 denoise/renoise steps (deliberately not left-to-right). Showcase slot `s20` goes `set-distribution → commit(" regenerated") → renoise → mask → set-distribution → commit(" resampled")` — a visible remask that changes the token. Final frame fixes all 28 completion slots; `final.text` equals prompt + concatenated completion (tested by reconstruction).
  - JSON exports `examples/traces/chat-remask.json` and `apps/web/public/traces/chat-remask.json`.

- [ ] **Step 1: Write the failing fixture tests** (`packages/core/src/testing/fixtures-chat.test.ts`)

```ts
import { describe, expect, it } from "vitest"

import { materializeSlots } from "../player/materialize"
import { parseTrace } from "../schema/validate"
import { chatRemaskTrace } from "./fixtures"

const slotNumber = (slotId: string) => Number(slotId.slice(1))

describe("chatRemaskTrace", () => {
  it("passes schema validation and is labeled illustrative (spec §23)", () => {
    expect(() => parseTrace(chatRemaskTrace)).not.toThrow()
    expect(chatRemaskTrace.provenance.mode).toBe("illustrative")
  })

  it("has one prompt slot and 28 masked completion slots", () => {
    const slots = chatRemaskTrace.initial.slots
    expect(slots).toHaveLength(29)
    expect(slots[0]).toMatchObject({ slotId: "s0", state: "prompt" })
    expect(chatRemaskTrace.prompt?.slotIds).toEqual(["s0"])
    expect(
      slots.slice(1).every((slot) => slot.state === "masked")
    ).toBe(true)
  })

  it("commits confidence-ranked, not left-to-right", () => {
    const commitOrder = chatRemaskTrace.frames.flatMap((frame) =>
      frame.operations
        .filter((op) => op.type === "commit")
        .map((op) => op.slotId)
    )
    // The very first commit is the sentence-final period (highest
    // confidence), and the overall order is not index order.
    expect(commitOrder[0]).toBe("s28")
    expect(commitOrder).not.toEqual(
      [...commitOrder].sort((a, b) => slotNumber(a) - slotNumber(b))
    )
    // Every completion slot is committed at least once.
    expect(new Set(commitOrder).size).toBe(28)
  })

  it("showcase slot s20 is distributed, committed, renoised, masked, and recommitted with a different token", () => {
    const showcaseOps = chatRemaskTrace.frames
      .flatMap((frame) => frame.operations)
      .filter((op) => "slotId" in op && op.slotId === "s20")
    expect(showcaseOps.map((op) => op.type)).toEqual([
      "set-distribution",
      "commit",
      "renoise",
      "mask",
      "set-distribution",
      "commit",
      "set-token",
    ])
    const commits = showcaseOps.filter((op) => op.type === "commit")
    expect(commits[0]).toMatchObject({ tokenId: 601, text: " regenerated" })
    expect(commits[1]).toMatchObject({ tokenId: 520, text: " resampled" })
  })

  it("final frame reconstruction matches final.text", () => {
    const text = materializeSlots(
      chatRemaskTrace,
      chatRemaskTrace.frames.length - 1
    )
      .map((slot) => slot.text ?? "")
      .join("")
    expect(text).toBe(chatRemaskTrace.final?.text)
  })

  it("the final frame fixes all 28 completion slots", () => {
    const last = chatRemaskTrace.frames.at(-1)
    expect(last?.kind).toBe("final")
    expect(last?.operations).toHaveLength(28)
    expect(
      last?.operations.every(
        (op) => op.type === "set-token" && op.state === "fixed"
      )
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @dllm-viz/core exec vitest run src/testing/fixtures-chat.test.ts`
Expected: FAIL — `chatRemaskTrace` is not exported.

- [ ] **Step 3: Append the fixture to `packages/core/src/testing/fixtures.ts`**

First add `TraceOperation` to the existing type import at the top of the file:

```ts
import type { DiffusionTrace, TokenSlot, TraceOperation } from "../schema/types"
```

Then append after `arBaselineTrace`:

```ts
/**
 * Chat-shaped remasking trace for DiffusionChat (spec §15.11, design
 * 2026-07-22): a 28-token answer committed in confidence-ranked order —
 * deliberately not left-to-right — with one showcase slot (s20) that is
 * distributed, committed as " regenerated", renoised, remasked, and
 * finally recommitted as " resampled". Hand-authored token table; the
 * commit/fix operations are derived from it deterministically.
 */
const chatTokens = [
  " Diffusion",
  " LMs",
  " denoise",
  " every",
  " position",
  " in",
  " parallel",
  ",",
  " so",
  " a",
  " token",
  " that",
  " no",
  " longer",
  " fits",
  " can",
  " be",
  " remasked",
  " and",
  " resampled",
  " until",
  " the",
  " whole",
  " answer",
  " is",
  " self",
  "-consistent",
  ".",
] as const

/** Commit completion token i (1-based) with the given confidence. */
const chatCommit = (i: number, confidence: number): TraceOperation => ({
  type: "commit",
  slotId: `s${i}`,
  tokenId: 500 + i,
  text: chatTokens[i - 1],
  confidence,
})

export const chatRemaskTrace: DiffusionTrace = {
  ...sharedMeta,
  traceId: "fixture-chat-remask",
  generation: {
    algorithm: "illustrative-confidence-remask",
    totalSteps: 9,
    remaskingStrategy: "loop",
    confidenceType: "max-prob",
  },
  prompt: {
    text: "Why can diffusion LMs revise their own output?",
    slotIds: ["s0"],
  },
  initial: {
    checkpointId: "cp-init",
    frameOrdinal: -1,
    slots: [
      slot("s0", 0, {
        state: "prompt",
        region: "prompt",
        text: "Why can diffusion LMs revise their own output?",
      }),
      ...chatTokens.map((_, i) => slot(`s${i + 1}`, i + 1)),
    ],
  },
  frames: [
    { frameId: "f0", ordinal: 0, kind: "initial", operations: [] },
    {
      frameId: "f1",
      ordinal: 1,
      kind: "denoise",
      step: 1,
      operations: [
        chatCommit(28, 0.99),
        chatCommit(2, 0.97),
        chatCommit(1, 0.96),
        chatCommit(8, 0.95),
      ],
      metrics: { maskedCount: 24, committedThisFrame: 4 },
    },
    {
      frameId: "f2",
      ordinal: 2,
      kind: "denoise",
      step: 2,
      operations: [
        {
          type: "set-distribution",
          slotId: "s20",
          candidates: [
            { tokenId: 601, text: " regenerated", probability: 0.44, rank: 0 },
            { tokenId: 520, text: " resampled", probability: 0.41, rank: 1 },
            { tokenId: 602, text: " rewritten", probability: 0.09, rank: 2 },
          ],
          entropy: 1.05,
          margin: 0.03,
          omittedMass: 0.06,
        },
        {
          type: "commit",
          slotId: "s20",
          tokenId: 601,
          text: " regenerated",
          confidence: 0.44,
          selectionRank: 0,
        },
        chatCommit(3, 0.93),
        chatCommit(7, 0.92),
      ],
      metrics: { maskedCount: 21, committedThisFrame: 3 },
    },
    {
      frameId: "f3",
      ordinal: 3,
      kind: "denoise",
      step: 3,
      operations: [
        chatCommit(9, 0.9),
        chatCommit(18, 0.89),
        chatCommit(5, 0.88),
        chatCommit(25, 0.87),
      ],
      metrics: { maskedCount: 17, committedThisFrame: 4 },
    },
    {
      frameId: "f4",
      ordinal: 4,
      kind: "renoise",
      step: 4,
      operations: [
        {
          type: "renoise",
          slotId: "s20",
          previousTokenId: 601,
          score: 0.38,
          reason: "low joint confidence with ' remasked and'",
        },
      ],
      metrics: { remaskedThisFrame: 1 },
    },
    {
      frameId: "f5",
      ordinal: 5,
      kind: "denoise",
      step: 5,
      operations: [
        { type: "mask", slotId: "s20", previousTokenId: 601 },
        chatCommit(4, 0.86),
        chatCommit(6, 0.85),
        chatCommit(19, 0.84),
      ],
      metrics: { maskedCount: 15, committedThisFrame: 3 },
    },
    {
      frameId: "f6",
      ordinal: 6,
      kind: "denoise",
      step: 6,
      operations: [
        {
          type: "set-distribution",
          slotId: "s20",
          candidates: [
            { tokenId: 520, text: " resampled", probability: 0.83, rank: 0 },
            { tokenId: 601, text: " regenerated", probability: 0.08, rank: 1 },
            { tokenId: 602, text: " rewritten", probability: 0.04, rank: 2 },
          ],
          entropy: 0.52,
          margin: 0.75,
          omittedMass: 0.05,
        },
        chatCommit(20, 0.83),
        chatCommit(11, 0.82),
        chatCommit(16, 0.8),
      ],
      metrics: { maskedCount: 12, committedThisFrame: 3 },
    },
    {
      frameId: "f7",
      ordinal: 7,
      kind: "denoise",
      step: 7,
      operations: [
        chatCommit(10, 0.79),
        chatCommit(12, 0.78),
        chatCommit(17, 0.77),
        chatCommit(21, 0.76),
        chatCommit(26, 0.75),
      ],
      metrics: { maskedCount: 7, committedThisFrame: 5 },
    },
    {
      frameId: "f8",
      ordinal: 8,
      kind: "denoise",
      step: 8,
      operations: [
        chatCommit(13, 0.74),
        chatCommit(14, 0.73),
        chatCommit(15, 0.72),
        chatCommit(22, 0.71),
        chatCommit(23, 0.7),
        chatCommit(24, 0.69),
        chatCommit(27, 0.68),
      ],
      metrics: { maskedCount: 0, committedThisFrame: 7 },
    },
    {
      frameId: "f9",
      ordinal: 9,
      kind: "final",
      step: 9,
      operations: chatTokens.map(
        (_, i): TraceOperation => ({
          type: "set-token",
          slotId: `s${i + 1}`,
          state: "fixed",
        })
      ),
    },
  ],
  final: {
    text: "Why can diffusion LMs revise their own output? Diffusion LMs denoise every position in parallel, so a token that no longer fits can be remasked and resampled until the whole answer is self-consistent.",
    finishReason: "completed",
  },
}
```

Note: `chatCommit(20, 0.83)` commits `tokenId: 520, text: " resampled"` from the token table — a *different* token than the first `s20` commit (`601, " regenerated"`), which is the point of the showcase slot. The commit-order sanity check: f1 `{28,2,1,8}`, f2 `{20,3,7}`, f3 `{9,18,5,25}`, f5 `{4,6,19}`, f6 `{20,11,16}`, f7 `{10,12,17,21,26}`, f8 `{13,14,15,22,23,24,27}` — 28 unique slots, s20 twice.

- [ ] **Step 4: Run fixture tests to verify they pass**

Run: `pnpm --filter @dllm-viz/core exec vitest run src/testing/fixtures-chat.test.ts`
Expected: PASS (6 tests). Also run the existing fixture suites to confirm nothing regressed:
`pnpm --filter @dllm-viz/core exec vitest run src/testing/`
Expected: PASS.

- [ ] **Step 5: Export the JSON fixture**

In `packages/core/scripts/export-fixtures.mjs`, add `chatRemaskTrace` to the import from `../src/testing/fixtures.ts` and append to the `fixtures` array:

```js
  ["chat-remask.json", chatRemaskTrace],
```

Run: `pnpm --filter @dllm-viz/core run fixtures`
Expected: 12 JSON files written (6 fixtures × 2 targets), including both `chat-remask.json` files.

- [ ] **Step 6: Full verification and commit**

Run: `pnpm registry:build && pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS (`registry/default/lib` regenerates with the new fixture included; `registry.json` unchanged).

```bash
git add -A
git commit -m "feat(core): chatRemaskTrace fixture with confidence-ranked commits and a showcase remask slot

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `diffusion-chat` registry component

**Files:**
- Create: `registry/default/diffusion-chat/diffusion-chat.tsx`, `apps/web/src/components/denoising-token-canvas.ts`, `apps/web/src/components/diffusion-chat.test.tsx`

**Interfaces:**
- Consumes: `DiffusionTrace`, `materializeSlots` from `@/lib/dllm-viz-core`; `DiffusionTraceProvider`, `useDiffusionPlayer`, `useDiffusionSnapshot`, `useReducedMotion`, `useTraceProvenance` from `@/lib/dllm-viz-react` (verified current export names); `DenoisingTokenCanvas` (props `showPrompt`, `className`, …) via `@/components/denoising-token-canvas`; chat chrome via `@/components/ui/*` (Task 1); player API `toggle()`, `stepForward()`, `stepBackward()`, `seek()`, `frameCount`, snapshot `frameIndex`/`status`/`frame`.
- Produces (registry item source; canonical per design):
  - `type ChatTurn = { id: string; role: "user" | "assistant"; text: string } | { id: string; role: "assistant"; trace: DiffusionTrace; autoPlay?: boolean }`
  - `interface DiffusionChatProps { turns: ChatTurn[]; onGenerationEnd?: (turnId: string) => void; className?: string }`
  - `DiffusionChat` — conversation renderer only; prompt input chrome belongs to the consumer (Task 4's demo page provides it).
- The `apps/web/src/components/denoising-token-canvas.ts` bridge mirrors the consumer install target (`@/components/denoising-token-canvas`) onto the registry source, exactly like the Task 1 ui bridges mirror `@workspace/ui`.

- [ ] **Step 1: Write the failing component tests** (`apps/web/src/components/diffusion-chat.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { DiffusionTrace } from "@/lib/dllm-viz-core"
import { chatRemaskTrace } from "@/lib/dllm-viz-core"
import type { ChatTurn } from "@/registry/default/diffusion-chat/diffusion-chat"
import { DiffusionChat } from "@/registry/default/diffusion-chat/diffusion-chat"

const COMPLETION_TEXT =
  "Diffusion LMs denoise every position in parallel, so a token that no longer fits can be remasked and resampled until the whole answer is self-consistent."

const traceTurn: ChatTurn = {
  id: "gen",
  role: "assistant",
  trace: chatRemaskTrace,
}

// Frame 0 is the initial frame; the player starts there when autoPlay is
// off, so LAST_FRAME next-clicks land exactly on the last frame.
const LAST_FRAME = chatRemaskTrace.frames.length - 1

async function stepToEnd(user: ReturnType<typeof userEvent.setup>) {
  const next = screen.getByRole("button", { name: "Next frame" })
  for (let i = 0; i < LAST_FRAME; i++) {
    await user.click(next)
  }
}

describe("DiffusionChat", () => {
  it("renders settled user and assistant turns with preserved whitespace", () => {
    render(
      <DiffusionChat
        turns={[
          { id: "u1", role: "user", text: "Hi there" },
          { id: "a1", role: "assistant", text: "Hello!\nSecond line" },
        ]}
      />
    )
    expect(screen.getByText("Hi there")).toBeInTheDocument()
    const assistant = screen.getByText(/Second line/)
    expect(assistant.className).toContain("whitespace-pre-wrap")
  })

  it("renders the generating turn as token slots, never as partial text", () => {
    render(<DiffusionChat turns={[traceTurn]} />)
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: /masked/ }).length
    ).toBeGreaterThan(0)
    // The completion never appears as accumulated plain text …
    expect(screen.queryByText(COMPLETION_TEXT)).not.toBeInTheDocument()
    // … and the prompt region is hidden inside the bubble.
    expect(
      screen.queryByText(/Why can diffusion LMs revise their own output\?/)
    ).not.toBeInTheDocument()
  })

  it("pause/resume via the inline toggle changes player status", async () => {
    const user = userEvent.setup()
    render(<DiffusionChat turns={[traceTurn]} />)
    expect(screen.getByText("Replay paused")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Resume replay" }))
    expect(screen.getByText(/Denoising · step \d+\/9/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Pause replay" }))
    expect(screen.getByText("Replay paused")).toBeInTheDocument()
  })

  it("swaps to the settled completion on playback end and fires onGenerationEnd once", async () => {
    const user = userEvent.setup()
    const onEnd = vi.fn()
    render(<DiffusionChat onGenerationEnd={onEnd} turns={[traceTurn]} />)
    await stepToEnd(user)
    expect(screen.getByText(COMPLETION_TEXT)).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "Token canvas" })
    ).not.toBeInTheDocument()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith("gen")
    // The rendered settled text is exactly final.text minus the prompt.
    const promptLength = chatRemaskTrace.prompt?.text.length ?? 0
    expect(
      chatRemaskTrace.final?.text?.slice(promptLength).trimStart()
    ).toBe(COMPLETION_TEXT)
  })

  it("Show generation returns to the canvas at frame 0 without refiring onGenerationEnd", async () => {
    const user = userEvent.setup()
    const onEnd = vi.fn()
    render(<DiffusionChat onGenerationEnd={onEnd} turns={[traceTurn]} />)
    await stepToEnd(user)
    await user.click(screen.getByRole("button", { name: "Show generation" }))
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
    // Reseeked to frame 0: everything is masked again.
    expect(
      screen.getAllByRole("button", { name: /masked/ })
    ).toHaveLength(28)
    await stepToEnd(user)
    // Still in generation view (explicit toggle wins) and no second call.
    expect(onEnd).toHaveBeenCalledTimes(1)
    await user.click(
      screen.getByRole("button", { name: "Show final answer" })
    )
    expect(screen.getByText(COMPLETION_TEXT)).toBeInTheDocument()
  })

  it("shows a provenance badge in both generation and settled views", async () => {
    const user = userEvent.setup()
    render(<DiffusionChat turns={[traceTurn]} />)
    expect(screen.getByText("illustrative")).toBeInTheDocument()
    await stepToEnd(user)
    expect(screen.getByText("illustrative")).toBeInTheDocument()
  })

  it("renders a zero-frame trace turn without crashing or ending", () => {
    const onEnd = vi.fn()
    const emptyTrace: DiffusionTrace = {
      ...chatRemaskTrace,
      traceId: "fixture-chat-remask-empty",
      frames: [],
      checkpoints: [],
    }
    render(
      <DiffusionChat
        onGenerationEnd={onEnd}
        turns={[{ id: "live", role: "assistant", trace: emptyTrace }]}
      />
    )
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
    expect(screen.getByText("Waiting for frames")).toBeInTheDocument()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it("drops animation classes under prefers-reduced-motion", async () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
    try {
      const user = userEvent.setup()
      render(<DiffusionChat turns={[traceTurn]} />)
      await user.click(screen.getByRole("button", { name: "Resume replay" }))
      const status = screen.getByText(/Denoising · step/)
      expect(status.className).not.toContain("animate-pulse")
      const slot = screen.getAllByRole("button", { name: /masked/ })[0]
      expect(slot.className).not.toContain("transition-colors")
    } finally {
      window.matchMedia = original
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/components/diffusion-chat.test.tsx`
Expected: FAIL — `registry/default/diffusion-chat/diffusion-chat.tsx` does not exist.

- [ ] **Step 3: Create the canvas bridge and implement the component**

`apps/web/src/components/denoising-token-canvas.ts` (mirrors the consumer install target `@/components/denoising-token-canvas` onto the canonical registry source):

```ts
export * from "@/registry/default/denoising-token-canvas/denoising-token-canvas"
```

`registry/default/diffusion-chat/diffusion-chat.tsx`:

```tsx
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { DenoisingTokenCanvas } from "@/components/denoising-token-canvas"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import type { DiffusionTrace } from "@/lib/dllm-viz-core"
import { materializeSlots } from "@/lib/dllm-viz-core"
import {
  DiffusionTraceProvider,
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useReducedMotion,
  useTraceProvenance,
} from "@/lib/dllm-viz-react"
import { cn } from "@/lib/utils"

/** A settled turn (plain text) or an assistant turn replaying a trace. */
export type ChatTurn =
  | { id: string; role: "user" | "assistant"; text: string }
  | {
      id: string
      role: "assistant"
      trace: DiffusionTrace
      autoPlay?: boolean
    }

export interface DiffusionChatProps {
  turns: ChatTurn[]
  /** Fires once per trace turn when playback first reaches the last frame. */
  onGenerationEnd?: (turnId: string) => void
  className?: string
}

const controlClass =
  "inline-flex size-7 items-center justify-center rounded border hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"

function SettledTurn({
  role,
  text,
}: {
  role: "user" | "assistant"
  text: string
}) {
  const align = role === "user" ? "end" : "start"
  return (
    <Message align={align}>
      <MessageContent>
        <Bubble align={align} variant={role === "user" ? "default" : "muted"}>
          {/* Token text is rendered as text, never HTML (spec §20).
              Markdown rendering is deferred to a later sanitized-renderer
              upgrade; `text` stays forward-compatible. */}
          <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/**
 * Assistant bubble replaying a diffusion trace. Pausing halts visual
 * playback only (spec §15.11): in static replay there is no inference,
 * and under live streaming the player keeps accumulating appendFrame
 * while paused — pausing never cancels or blocks ingestion.
 */
function TraceBubble({
  onGenerationEnd,
  trace,
  turnId,
}: {
  onGenerationEnd?: (turnId: string) => void
  trace: DiffusionTrace
  turnId: string
}) {
  const player = useDiffusionPlayer()
  const snapshot = useDiffusionSnapshot()
  const provenance = useTraceProvenance()
  const reducedMotion = useReducedMotion()
  const [showGeneration, setShowGeneration] = useState(false)
  const endedRef = useRef(false)

  const hasFrames = player.frameCount > 0
  const atEnd = hasFrames && snapshot.frameIndex === player.frameCount - 1
  const playing = snapshot.status === "playing"

  useEffect(() => {
    if (atEnd && !endedRef.current) {
      endedRef.current = true
      onGenerationEnd?.(turnId)
    }
  }, [atEnd, onGenerationEnd, turnId])

  // final.text minus the prompt region, derived from the trace itself.
  const settledText = useMemo(() => {
    if (!hasFrames) return trace.final?.text ?? ""
    return materializeSlots(trace, trace.frames.length - 1)
      .filter((slot) => slot.region !== "prompt" && slot.state !== "prompt")
      .map((slot) => slot.text ?? "")
      .join("")
      .trimStart()
  }, [hasFrames, trace])

  const settled = atEnd && !showGeneration
  const step = snapshot.frame?.step ?? Math.max(snapshot.frameIndex, 0)
  const totalSteps =
    trace.generation.totalSteps ?? Math.max(player.frameCount - 1, 0)
  const status = playing
    ? `Denoising · step ${step}/${totalSteps}`
    : hasFrames
      ? "Replay paused"
      : "Waiting for frames"

  return (
    <Message align="start">
      <MessageContent>
        <Bubble align="start" variant="outline">
          <BubbleContent className="flex w-full flex-col gap-2">
            {settled ? (
              <>
                {provenance.mode !== "measured" && (
                  <span
                    className="self-start rounded border border-dashed px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
                    title={provenance.notes?.join(" ")}
                  >
                    {provenance.mode}
                  </span>
                )}
                <p className="whitespace-pre-wrap">{settledText}</p>
                <button
                  className="self-start text-muted-foreground text-xs underline"
                  onClick={() => {
                    setShowGeneration(true)
                    player.seek(0)
                  }}
                  type="button"
                >
                  Show generation
                </button>
              </>
            ) : (
              <>
                <DenoisingTokenCanvas showPrompt={false} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    aria-label="Previous frame"
                    className={controlClass}
                    onClick={() => player.stepBackward()}
                    type="button"
                  >
                    <ChevronLeft aria-hidden className="size-3.5" />
                  </button>
                  <button
                    aria-label={playing ? "Pause replay" : "Resume replay"}
                    className={controlClass}
                    onClick={() => player.toggle()}
                    type="button"
                  >
                    {playing ? (
                      <Pause aria-hidden className="size-3.5" />
                    ) : (
                      <Play aria-hidden className="size-3.5" />
                    )}
                  </button>
                  <button
                    aria-label="Next frame"
                    className={controlClass}
                    onClick={() => player.stepForward()}
                    type="button"
                  >
                    <ChevronRight aria-hidden className="size-3.5" />
                  </button>
                  {atEnd && (
                    <button
                      className="text-muted-foreground text-xs underline"
                      onClick={() => setShowGeneration(false)}
                      type="button"
                    >
                      Show final answer
                    </button>
                  )}
                </div>
                <Marker>
                  <MarkerContent
                    className={cn(
                      playing && !reducedMotion && "animate-pulse"
                    )}
                  >
                    {status}
                  </MarkerContent>
                </Marker>
              </>
            )}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/**
 * Chat surface embedding diffusion generation without reducing it to
 * typing (spec §15.11): the mutable answer renders as a token canvas —
 * characters are never appended one at a time. Renders the conversation
 * only; prompt input chrome belongs to the consumer.
 */
export function DiffusionChat({
  turns,
  onGenerationEnd,
  className,
}: DiffusionChatProps) {
  return (
    <MessageScrollerProvider>
      <MessageScroller className={cn("min-h-0", className)}>
        <MessageScrollerViewport>
          <MessageScrollerContent
            aria-label="Conversation"
            className="p-4"
            role="log"
          >
            {turns.map((turn) => (
              <MessageScrollerItem key={turn.id}>
                {"trace" in turn ? (
                  <DiffusionTraceProvider
                    autoPlay={turn.autoPlay ?? false}
                    trace={turn.trace}
                  >
                    <TraceBubble
                      onGenerationEnd={onGenerationEnd}
                      trace={turn.trace}
                      turnId={turn.id}
                    />
                  </DiffusionTraceProvider>
                ) : (
                  <SettledTurn role={turn.role} text={turn.text} />
                )}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
```

Notes on the load-bearing details:

- `endedRef` makes `onGenerationEnd` fire once per mounted turn — replaying via "Show generation" never refires (tested).
- The zero-frame guard is `player.frameCount > 0`: with no frames, `frameIndex` is `-1 === frameCount - 1`, so an unguarded `atEnd` would be true and the bubble would settle (and fire the callback) immediately.
- The provenance badge renders in the settled view; in the generation view `DenoisingTokenCanvas` already renders the identical chip, so exactly one badge is visible in every view (no duplication).
- The badge/chip is `provenance.mode !== "measured"`-gated, same convention as the canvas.
- `settledText` is derived by materializing the last frame and dropping prompt slots — never by slicing `final.text` (the test cross-checks the two agree on the fixture).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/components/diffusion-chat.test.tsx`
Expected: PASS (8 tests). If the scroller primitives throw in jsdom despite the Task 1 stubs, extend `setup.ts` with the missing guarded stub (see Task 1 Step 5 note) — do not mock the chrome in this test file unless the primitive is fundamentally jsdom-incompatible, and if you must, `vi.mock` only `@/components/ui/message-scroller` with passthrough `<div>`s and record it in the PR description.

- [ ] **Step 5: Full verification and commit**

Run: `pnpm registry:build && pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS. `registry:build` output unchanged in this task (the item is registered in Task 4); `pnpm lint` covers `registry/` via the web package's biome scope.

```bash
git add -A
git commit -m "feat(registry): DiffusionChat component with per-turn trace playback and settled swap

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Demo route, nav entry, registry item, final verification

**Files:**
- Create: `apps/web/src/routes/diffusion-chat-demo.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/components/site-nav.tsx`, `apps/web/src/routes/home.tsx`, `scripts/build-registry.mjs`

**Interfaces:**
- Consumes: `DiffusionChat`/`ChatTurn` (Task 3), `chatRemaskTrace` (Task 2), existing `SiteLayout` route shell and `links` array, `componentItem` helper and `REPO` constant in `scripts/build-registry.mjs`.
- Produces: route `/components/diffusion-chat` (scripted-send flow, read-only input labeled "Scripted demo", reset link); nav entry "Chat"; registry item `diffusion-chat` installable via `pnpm dlx shadcn@latest add nishide-dev/dllm-viz/diffusion-chat` with `registryDependencies: ["message-scroller", "message", "bubble", "marker", "nishide-dev/dllm-viz/dllm-viz-core", "nishide-dev/dllm-viz/dllm-viz-react", "nishide-dev/dllm-viz/denoising-token-canvas"]`.

- [ ] **Step 1: Write the failing route tests** (append inside the existing `describe` in `apps/web/src/App.test.tsx`, and add `import userEvent from "@testing-library/user-event"` to the imports)

```tsx
  it("renders the diffusion chat demo route with a read-only scripted input", () => {
    renderAt("/components/diffusion-chat")
    expect(screen.getByLabelText("Scripted prompt")).toHaveAttribute(
      "readonly"
    )
    expect(screen.getByText("Scripted demo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled()
  })

  it("send appends the scripted user turn and the generating assistant turn", async () => {
    const user = userEvent.setup()
    renderAt("/components/diffusion-chat")
    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(
      screen.getByText("Why can diffusion LMs revise their own output?")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("reset restores the initial scripted-demo state", async () => {
    const user = userEvent.setup()
    renderAt("/components/diffusion-chat")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(
      screen.queryByRole("group", { name: "Token canvas" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled()
  })
```

Run: `pnpm --filter web exec vitest run src/App.test.tsx` — expect FAIL (route missing).

- [ ] **Step 2: Create the demo route** (`apps/web/src/routes/diffusion-chat-demo.tsx`)

```tsx
import { useState } from "react"

import { chatRemaskTrace } from "@/lib/dllm-viz-core"
import type { ChatTurn } from "@/registry/default/diffusion-chat/diffusion-chat"
import { DiffusionChat } from "@/registry/default/diffusion-chat/diffusion-chat"

const SCRIPTED_QUESTION = "Why can diffusion LMs revise their own output?"

const INITIAL_TURNS: ChatTurn[] = [
  { id: "t1", role: "user", text: "What is a diffusion language model?" },
  {
    id: "t2",
    role: "assistant",
    text: "A diffusion language model generates text by iteratively denoising a masked sequence: every position is refined in parallel across steps instead of being appended left to right.",
  },
]

export function DiffusionChatDemo() {
  const [turns, setTurns] = useState<ChatTurn[]>(INITIAL_TURNS)
  const [sent, setSent] = useState(false)

  const send = () => {
    setTurns([
      ...INITIAL_TURNS,
      { id: "t3", role: "user", text: SCRIPTED_QUESTION },
      { id: "t4", role: "assistant", trace: chatRemaskTrace, autoPlay: true },
    ])
    setSent(true)
  }

  const reset = () => {
    setTurns(INITIAL_TURNS)
    setSent(false)
  }

  return (
    <div className="flex h-[calc(100svh-6rem)] flex-col gap-4 p-6">
      <div className="flex items-baseline gap-3">
        <h1 className="font-medium text-lg">DiffusionChat</h1>
        <button
          className="text-muted-foreground text-xs underline"
          onClick={reset}
          type="button"
        >
          Reset
        </button>
      </div>
      <DiffusionChat className="min-h-0 flex-1 rounded border" turns={turns} />
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!sent) send()
        }}
      >
        <span className="rounded border px-1.5 py-0.5 text-muted-foreground text-xs">
          Scripted demo
        </span>
        <input
          aria-label="Scripted prompt"
          className="min-w-0 flex-1 rounded border bg-muted px-3 py-2 text-sm"
          readOnly
          value={SCRIPTED_QUESTION}
        />
        <button
          className="rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          disabled={sent}
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Register the route, nav entry, and gallery link**

In `apps/web/src/App.tsx`, add the import and route (inside the `SiteLayout` route, after the token-canvas route):

```tsx
import { DiffusionChatDemo } from "@/routes/diffusion-chat-demo"
```

```tsx
        <Route
          element={<DiffusionChatDemo />}
          path="/components/diffusion-chat"
        />
```

In `apps/web/src/components/site-nav.tsx`, append to the `links` array (before the `/compare` entry):

```ts
  { to: "/components/diffusion-chat", label: "Chat" },
```

In `apps/web/src/routes/home.tsx`, append to the gallery `<ul>`:

```tsx
          <li>
            <Link className="underline" to="/components/diffusion-chat">
              DiffusionChat
            </Link>
          </li>
```

Run: `pnpm --filter web exec vitest run src/App.test.tsx`
Expected: PASS (9 tests — 6 existing + 3 new).

- [ ] **Step 4: Add the registry item**

In `scripts/build-registry.mjs`, append after the `diffusion-comparison` `componentItem(...)` entry. The `extra` spread *replaces* the helper's default `registryDependencies`, so core/react are restated explicitly; official items use bare names (they resolve against the official registry — correct for official items), ours use the `REPO` form:

```js
    componentItem(
      "diffusion-chat",
      "Diffusion Chat",
      "Chat surface embedding diffusion trace playback in assistant bubbles.",
      {
        dependencies: ["lucide-react"],
        registryDependencies: [
          "message-scroller",
          "message",
          "bubble",
          "marker",
          `${REPO}/dllm-viz-core`,
          `${REPO}/dllm-viz-react`,
          `${REPO}/denoising-token-canvas`,
        ],
      }
    ),
```

Run: `pnpm registry:build`
Expected: `registry.json` now lists 10 items; the `diffusion-chat` entry has the seven registryDependencies above and file `registry/default/diffusion-chat/diffusion-chat.tsx` (type `registry:component`).

- [ ] **Step 5: Install smoke test (manual, once pushed)**

After merge + push, from a throwaway Vite app with default aliases:

```bash
pnpm dlx shadcn@latest add nishide-dev/dllm-viz/diffusion-chat
```

Expected: `components/diffusion-chat.tsx` + `components/denoising-token-canvas.tsx` land alongside `components/ui/{message-scroller,message,bubble,marker}.tsx` (pulled from the official registry, including their `button` dependency and `@shadcn/react` npm dep), lib deps in `lib/dllm-viz-core` + `lib/dllm-viz-react`, and the app compiles. Record the result in the PR description.

- [ ] **Step 6: Final verification**

Run: `pnpm registry:build && pnpm --filter @dllm-viz/core run fixtures && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS; `apps/web/dist` builds statically with the new route; `git status` shows no unexpected generated-file drift (registry lib, `registry.json`, and trace JSONs already committed in Tasks 2–4).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): DiffusionChat demo route, Chat nav entry, and diffusion-chat registry item

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Design coverage (2026-07-22 design doc):** registry item + demo route ✔ (T3 canonical source, T4 route renders the same source — no demo-only duplicate); built on the four official chat items ✔ (T1 install + bridges; bare official registryDependencies + `nishide-dev/dllm-viz/<item>` for ours in T4); scripted-send demo ✔ (T4: pre-filled read-only input, "Scripted demo" label, Send appends user bubble + autoPlay trace turn then disables, Reset restores); `chatRemaskTrace` fixture ✔ (T2: illustrative, single hidden prompt slot, 28 completion slots, confidence-ranked commits, showcase slot `set-distribution → commit → renoise → mask → commit(different token)`, final frame fixes all, `final.text` agreement tested); component API matches the design's `ChatTurn`/`DiffusionChatProps` verbatim ✔; rendering rules ✔ (whitespace-pre-wrap settled text, no markdown dependency, `showPrompt={false}` canvas, inline pause/step via the player API with no global keyboard hook, Marker + shimmer status with `Denoising · step {step}/{totalSteps}` / `Replay paused`, settled swap + "Show generation" toggle reseeking to 0, `onGenerationEnd` once, provenance badge visible in every view, pause-vs-inference documented in JSDoc); every test in the design's Testing section has a corresponding `it()` (T3: turn kinds, token-slots/no-partial-text, pause/resume, end+`final.text`+once, show-generation, badge, zero-frame, reduced-motion; T4: send flow, read-only input; T2: fixture suite). Out-of-scope items (markdown, free-form input, attachments, compact mode) are not implemented anywhere.
- **Registry reality check honored:** export names in the component/bridges/tests match the fetched payloads (`MessageScrollerProvider/…/Item`, `Message`+`MessageContent` with `align`, `Bubble`+`BubbleContent` with `variant`/`align`, `Marker`+`MarkerContent`); `message-scroller`'s real deps (`@shadcn/react` npm, `button` registry) are accounted for (button pre-exists; npm dep added by CLI); there is no official `shimmer` item — shimmer is `animate-pulse`, reduced-motion-gated, which also satisfies §17.3 (decoration drops, status text stays).
- **§15.11 MUSTs:** token/canvas semantics during generation ✔ (canvas, tested "never partial text"); no char-by-char appending ✔; pause without cancelling inference ✔ (replay-only pause; live-streaming note in JSDoc — the player's paused `appendFrame` accumulation is existing Phase 1 behavior, verified in `packages/core` player tests); markdown MAY deferred with rationale (§20 sanitized-renderer requirement).
- **§16.3:** no `@workspace/*` or Next.js imports in `registry/default/diffusion-chat`; all imports are consumer-standard aliases (`@/lib/*`, `@/components/ui/*`, `@/components/denoising-token-canvas`); works with `rsc: false` (no server APIs); npm dep (`lucide-react`) and registry deps declared.
- **§18:** semantic buttons with concise `aria-label`s; visible focus (`focus-visible:outline-2`); status is text, not color; no live-region spam (canvas keeps its single sr-only summary); autoplay pausable via the inline toggle; reduced motion tested.
- **Type consistency (verified against current sources):** `TracePlayer`/`DiffusionPlayer` exposes `frameCount`, `toggle()`, `stepForward()`, `stepBackward()`, `seek()` (`packages/core/src/schema/types.ts:281`); snapshot exposes `frameIndex`, `status`, `frame` (with optional `step`); react package exports `DiffusionTraceProvider` (props include `autoPlay`, pauses on unmount), `useDiffusionPlayer`, `useDiffusionSnapshot`, `useReducedMotion`, `useTraceProvenance`; `DenoisingTokenCanvas` accepts `showPrompt` and filters prompt slots, renders masked slots as `role=button` with "masked" in the accessible name, gates `transition-colors` on `useReducedMotion`, and shows the provenance chip when `mode !== "measured"` — all relied on by the T3 tests. `materializeSlots` is exported from core's index; `slot()`/`sharedMeta` are file-local to `fixtures.ts`, which is why `chatRemaskTrace` is appended there. `componentItem`'s `...extra` spread overriding `registryDependencies` was verified in `scripts/build-registry.mjs`.
- **Fixture arithmetic:** 28 tokens concatenate exactly to the `final.text` completion (checked token by token); commit sets per frame cover all 28 slots with `s20` twice; maskedCount ledger: 28 → f1 24 → f2 21 → f3 17 → f4 17 (renoise ≠ masked) → f5 15 (+1 mask, −3 commits) → f6 12 → f7 7 → f8 0. Frames `f0`–`f9` = 10 frames, so `LAST_FRAME = 9` next-clicks from frame 0 reach the end.
- **Resolved ambiguities:**
  1. *Cross-item canvas import vs Phase 2's "no cross-item imports" rule* — the design explicitly composes `DenoisingTokenCanvas` with a `registryDependencies` entry, which Phase 2's rule (motivated by unreliable `@/registry/...` rewriting) did not anticipate. Resolved by importing through the consumer install target `@/components/denoising-token-canvas` (what the CLI produces for a `registry:component` file) and bridging that alias in `apps/web` — `@/registry/...` still never appears in registry source.
  2. *No `shimmer` registry item exists* — implemented as an `animate-pulse` class on the Marker text, disabled under reduced motion.
  3. *Provenance badge placement* — the canvas already renders a provenance chip, so the bubble renders its own badge only in the settled view; exactly one truthful badge is visible in each view ("always visible" without duplication). Both are asserted in the badge test.
  4. *"Fires once"* — interpreted as once per mounted trace turn (ref-guarded), so replaying via "Show generation" does not refire; tested.
  5. *Zero-frame `atEnd`* — with `frames: []`, `frameIndex === -1 === frameCount - 1`; guarded with `frameCount > 0` so a live-stream shell shows "Waiting for frames" instead of settling instantly.
  6. *Showcase sequence* — the design's `…mask → commit` is preceded by a second `set-distribution` before the recommit (richer and more honest: the recommit has a source distribution); the design's five required stages all occur in order and the test pins the full seven-op sequence.
  7. *Settled text derivation* — computed from `materializeSlots` on the last frame filtered to non-prompt slots (trace-faithful), with a test cross-checking it equals `final.text` minus the prompt prefix.
  8. *Idle status label* — the player starts `idle` (not `paused`) without autoPlay; the label shows "Replay paused" for any non-playing state with frames, which matches the design's user-facing intent without exposing player internals.
- **Placeholder scan:** no TODOs, no stub implementations, no "fill in later" — every test and implementation block is complete verbatim code; every run command states its expected result; test counts were tallied against the `it()` blocks (T1: 2, T2: 6, T3: 8, T4: +3 → 9 in `App.test.tsx`).
- **Known risks carried as explicit contingencies:** CLI install failure (T1 vendored-fallback code, per the design's Risks section), surviving `IconPlaceholder`/alias imports (T1 Step 2 manual fixes), jsdom incompatibility of `@shadcn/react` primitives (T1 Step 3 stubs + T1 Step 5 canary + T3 Step 4 last-resort mock policy), `@base-ui/react` version drift (T1 Step 2 bump note).
