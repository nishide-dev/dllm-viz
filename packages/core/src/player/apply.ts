import type { TokenSlot, TraceOperation } from "../schema/types"

function indexOf(slots: TokenSlot[], slotId: string): number {
  const i = slots.findIndex((s) => s.slotId === slotId)
  if (i === -1) throw new Error(`applyOperations: unknown slotId "${slotId}"`)
  return i
}

function reindex(slots: TokenSlot[]): TokenSlot[] {
  return slots.map((s, i) => (s.index === i ? s : { ...s, index: i }))
}

export function applyOperations(
  slots: TokenSlot[],
  operations: TraceOperation[]
): TokenSlot[] {
  let next = slots.slice()
  let resized = false

  for (const op of operations) {
    switch (op.type) {
      case "set-token": {
        const i = indexOf(next, op.slotId)
        next[i] = {
          ...next[i],
          ...(op.tokenId !== undefined && { tokenId: op.tokenId }),
          ...(op.text !== undefined && { text: op.text }),
          ...(op.state !== undefined && { state: op.state }),
        }
        break
      }
      case "commit": {
        const i = indexOf(next, op.slotId)
        next[i] = {
          ...next[i],
          tokenId: op.tokenId,
          ...(op.text !== undefined && { text: op.text }),
          state: "committed",
        }
        break
      }
      case "mask": {
        const i = indexOf(next, op.slotId)
        const { tokenId: _tokenId, text: _text, ...rest } = next[i]
        next[i] = { ...rest, state: "masked" }
        break
      }
      case "renoise": {
        const i = indexOf(next, op.slotId)
        next[i] = { ...next[i], state: "renoised" }
        break
      }
      case "insert-slots": {
        const existing = new Set(next.map((s) => s.slotId))
        for (const inserted of op.slots) {
          if (existing.has(inserted.slotId)) {
            throw new Error(
              `applyOperations: insert-slots duplicate slotId "${inserted.slotId}"`
            )
          }
          existing.add(inserted.slotId)
        }
        const at =
          op.afterSlotId === undefined ? 0 : indexOf(next, op.afterSlotId) + 1
        next.splice(at, 0, ...op.slots)
        resized = true
        break
      }
      case "delete-slots": {
        const ids = new Set(op.slotIds)
        for (const id of op.slotIds) indexOf(next, id)
        next = next.filter((s) => !ids.has(s.slotId))
        resized = true
        break
      }
      case "move-slot": {
        const from = indexOf(next, op.slotId)
        const [moved] = next.splice(from, 1)
        const at =
          op.afterSlotId === undefined ? 0 : indexOf(next, op.afterSlotId) + 1
        next.splice(at, 0, moved)
        resized = true
        break
      }
      // Observation-only operations: they annotate slots but do not change
      // slot state, so applying them is intentionally a no-op here.
      case "set-distribution":
      case "set-projection":
      case "set-scalar":
        break
      default: {
        // Runtime input can bypass TypeScript; fail loudly on unknown ops.
        const _exhaustive: never = op
        throw new Error(
          `applyOperations: unknown operation type "${
            (_exhaustive as { type?: string }).type
          }"`
        )
      }
    }
  }

  return resized ? reindex(next) : next
}
