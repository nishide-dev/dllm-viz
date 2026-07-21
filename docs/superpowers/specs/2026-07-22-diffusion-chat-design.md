# DiffusionChat Design

**Date:** 2026-07-22
**Status:** Approved (brainstorming session)
**Spec anchor:** docs/spec.md §15.11 (`DiffusionChat`), §16 (registry rules), §18 (a11y), §20 (security)
**Reference:** shadcn 2026-06 chat components (`message-scroller`, `message`, `bubble`, `attachment`, `marker`, `shimmer`)

## Goal

A well-designed research-demo chat surface that embeds diffusion generation
in a familiar chat UI without reducing it to typing. Distributed as registry
item `diffusion-chat`; the demo page renders the same source (no demo-only
duplicate).

## Decisions

1. **Registry item + demo route** — canonical source in
   `registry/default/diffusion-chat/diffusion-chat.tsx`, demo at
   `/components/diffusion-chat`.
2. **Built on shadcn's official chat components** — `message-scroller`,
   `message`, `bubble`, `marker` (bare names in `registryDependencies`
   resolve against the official registry, which is correct for official
   items; our own items keep the `nishide-dev/dllm-viz/<item>` form).
   The generating bubble's *content* is replaced with token semantics;
   the chat chrome (scrolling, anchoring, bubbles, status markers) is
   not reinvented.
3. **Scripted-send demo** — the input is pre-filled with a scripted
   question and read-only, labeled "Scripted demo". Sending appends the
   user bubble and starts assistant playback. Free-form input is out of
   scope (a canned answer to arbitrary input would fake inference).
4. **New hand-authored fixture** — `chatRemaskTrace` (illustrative),
   a chat-appropriate Q&A with a visible remask event.

## Component API

```ts
// registry/default/diffusion-chat/diffusion-chat.tsx
export type ChatTurn =
  | { id: string; role: "user" | "assistant"; text: string } // settled
  | { id: string; role: "assistant"; trace: DiffusionTrace; autoPlay?: boolean }

export interface DiffusionChatProps {
  turns: ChatTurn[]
  /** Fires when a trace turn's playback reaches the last frame. */
  onGenerationEnd?: (turnId: string) => void
  className?: string
}
```

The component renders the conversation only. Prompt input chrome belongs to
the consumer (the demo page provides it).

## Rendering rules (per spec §15.11)

- **User turns / settled assistant turns:** plain text inside `Bubble`,
  whitespace preserved (`whitespace-pre-wrap`). Markdown rendering is
  deferred: token text MUST be rendered as text (§20), and pulling in a
  sanitized markdown renderer is out of scope for v1. The API's `text`
  field is forward-compatible with a later markdown upgrade.
- **Trace turns (generating):** inside the bubble —
  - `DiffusionTraceProvider` (per-turn player, `autoPlay` honored via prop)
  - `DenoisingTokenCanvas` with `showPrompt={false}` — the mutable answer
    uses token/canvas semantics; the interface never appends characters
    one at a time (§15.11 MUST).
  - Compact inline controls: pause/resume toggle + prev/next frame step
    (subset of DiffusionStepControls scale; reuses the player API, not the
    full controls component, to keep the bubble compact). Keyboard hook is
    NOT bound globally inside chat (multiple turns; chat inputs present).
  - `Marker` + shimmer text: `Denoising · step {step}/{totalSteps}` while
    playing; `Replay paused` when paused.
  - Illustrative/mixed provenance badge always visible on the bubble.
- **On playback end:** the bubble swaps to the settled text rendering
  (`trace.final.text` minus the prompt region), with a
  "Show generation" toggle that switches back to the canvas + controls
  and reseeks to frame 0. `onGenerationEnd(turnId)` fires once.
- **Pause vs inference (§15.11 MUST):** in static replay there is no
  inference; pause halts playback only. Under live streaming (Phase 3),
  the existing player already accumulates `appendFrame` while paused, so
  pausing the visual never cancels or blocks ingestion. Documented in the
  component JSDoc.

## Fixture: `chatRemaskTrace`

Hand-authored, `provenance.mode: "illustrative"`, in
`packages/core/src/testing/fixtures.ts` (exported like the others, added to
the JSON export script).

- Prompt region: `"Why can diffusion LMs revise their own output?"`
  (single prompt slot, hidden in chat rendering).
- Completion: ~28 slots. Commit order is confidence-ranked (not
  left-to-right). One showcase slot goes
  `set-distribution → commit → renoise → mask → commit(different token)`.
  Final frame fixes all slots.
- `final.text` equals the concatenated settled completion text (tested).
- Also a settled Q&A pair for turn 1 (plain strings in the demo, no trace).

## Demo page `/components/diffusion-chat`

- Turn 1: settled user question + settled assistant answer (shows the
  final-form rendering).
- Input row: read-only input pre-filled with the scripted question,
  "Scripted demo" label, Send button. Send appends the user bubble and the
  trace turn (`autoPlay`), then disables itself. Reset link restores the
  initial state.
- Nav entry "Chat" added to `SiteLayout`.

## Dependencies & aliases

- `registryDependencies`: `message-scroller`, `message`, `bubble`,
  `marker` (official, bare) + `nishide-dev/dllm-viz/dllm-viz-core`,
  `nishide-dev/dllm-viz/dllm-viz-react`,
  `nishide-dev/dllm-viz/denoising-token-canvas`.
- Registry source imports chat chrome via `@/components/ui/<name>` (the
  consumer-standard location). The demo app gets bridge files
  `apps/web/src/components/ui/<name>.ts` re-exporting from
  `@workspace/ui/components/<name>`, after installing the four official
  items via `pnpm dlx shadcn@latest add message-scroller message bubble marker -c apps/web`.
- Registry source must not import `@workspace/*` (unchanged rule); the
  build script gains the `diffusion-chat` item.

## Testing

Component tests in `apps/web/src/components/diffusion-chat.test.tsx`:

- renders all four turn kinds (user, settled assistant, generating trace,
  post-generation settled swap)
- generating bubble renders token slots (role=button masked slots), and
  never renders partial character-by-character text
- pause/resume via the inline toggle changes player status
- playback end: settled text equals `trace.final.text` completion, and
  `onGenerationEnd` fires once
- "Show generation" toggle returns to canvas mode
- provenance badge visible on trace turns
- zero-frame trace turn renders without crashing
- reduced-motion: no transition classes when `prefers-reduced-motion`
- demo route: send flow appends bubbles; input is read-only

Fixture tests in core: schema-valid, illustrative, remask sequence on the
showcase slot, `final.text` agreement with materialized last frame.

## Out of scope (v1)

- Markdown rendering of settled answers (needs a sanitized renderer)
- Free-form input / real model backend (Phase 3+)
- Attachments, reactions, multi-canvas (block) traces in chat
- Compact small-screen summarization mode (spec MAY)

## Risks

- The four official chat items are new (June 2026); if the shadcn CLI
  cannot install any of them into `packages/ui`, fall back to vendoring
  minimal equivalents into `@workspace/ui` for the demo while keeping the
  registryDependencies for consumers. (Install is verified in the plan's
  first task before anything is built on top.)
