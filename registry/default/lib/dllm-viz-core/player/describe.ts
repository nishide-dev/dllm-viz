import type { DiffusionSnapshot } from "../schema/types"

export function describeSnapshot(
  snapshot: DiffusionSnapshot,
  frameCount: number
): string {
  let committed = 0
  let masked = 0
  let remasked = 0
  for (const slot of snapshot.slots) {
    if (slot.region === "prompt" || slot.state === "prompt") continue
    if (slot.state === "committed" || slot.state === "fixed") committed++
    else if (slot.state === "masked") masked++
    else if (slot.state === "renoised") remasked++
  }
  return (
    `Step ${snapshot.frameIndex + 1} of ${frameCount}. ` +
    `${committed} tokens committed, ${masked} masked, ${remasked} remasked.`
  )
}
