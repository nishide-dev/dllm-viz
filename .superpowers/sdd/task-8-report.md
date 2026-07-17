# Task 8 Report: Keyboard control and reduced-motion hooks

## Status: DONE

## Files changed

- Created `packages/react/src/keyboard.ts`
- Created `packages/react/src/keyboard.test.tsx`
- Created `packages/react/src/reduced-motion.ts`
- Created `packages/react/src/reduced-motion.test.tsx`
- Modified `packages/react/src/index.ts`

## TDD evidence

### RED

Added the brief's keyboard and reduced-motion tests before either hook module
existed, then ran:

```text
pnpm --filter @dllm-viz/react exec vitest run src/keyboard.test.tsx src/reduced-motion.test.tsx
```

Result: both suites failed at import resolution because `./keyboard` and
`./reduced-motion` did not exist.

### GREEN

Implemented both hooks and package exports. The first green run exposed test
DOM leakage because this package's Vitest setup does not install automatic RTL
cleanup; adding explicit `afterEach(cleanup)` fixed the harness without changing
production behavior.

Added coverage for Shift+Arrow canvas-boundary seeking, all editable target
types, unavailable `matchMedia`, and media-query change notifications. The
editable-target test then failed RED (`frameIndex` became 1) because jsdom does
not populate `isContentEditable`. The implementation was hardened to detect a
`contenteditable` target or ancestor explicitly, after which the complete React
suite passed: 3 files, 16 tests.

## Implementation

- Space toggles playback; arrows step; Home/End seek to endpoints.
- Shift+Arrow seeks among frame 0, `canvas-start`/`canvas-commit` frames, and
  the final frame.
- Keyboard handling is disabled for input, textarea, select, and
  content-editable targets, and can be disabled through the hook option.
- Reduced-motion state uses `useSyncExternalStore`, subscribes to
  `matchMedia("(prefers-reduced-motion: reduce)")`, supports change events and
  SSR, and returns false when `matchMedia` is unavailable.
- Both hooks remain headless and are exported from `@dllm-viz/react`.

## Verification

```text
pnpm lint       # PASS — 4/4 packages
pnpm typecheck  # PASS — 4/4 packages
pnpm test       # PASS — 10 files, 67 tests total
```

Package detail: core 48, React 16, UI 2, web 1.

## Concerns

None.
