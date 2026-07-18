import { maskedRemaskTrace } from "@dllm-viz/core"
import { act, render, renderHook, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import {
  DiffusionTraceProvider,
  useDiffusionPlayer,
  useDiffusionSnapshot,
  useTokenSlots,
  useTraceProvenance,
} from "./index"

const wrapper = ({ children }: { children: ReactNode }) => (
  <DiffusionTraceProvider trace={maskedRemaskTrace}>
    {children}
  </DiffusionTraceProvider>
)

function Probe() {
  const slots = useTokenSlots()
  return <output>{slots.filter((s) => s.state === "masked").length}</output>
}

describe("DiffusionTraceProvider", () => {
  it("useDiffusionPlayer throws outside the provider", () => {
    expect(() => renderHook(() => useDiffusionPlayer())).toThrow(
      /DiffusionTraceProvider/
    )
  })

  it("exposes the player and snapshot", () => {
    const { result } = renderHook(
      () => ({
        player: useDiffusionPlayer(),
        snapshot: useDiffusionSnapshot(),
      }),
      { wrapper }
    )
    expect(result.current.player.frameCount).toBe(7)
    expect(result.current.snapshot.frameIndex).toBe(0)
  })

  it("re-renders subscribers when the player advances", () => {
    const { result } = renderHook(
      () => ({ player: useDiffusionPlayer(), slots: useTokenSlots() }),
      { wrapper }
    )
    expect(
      result.current.slots.filter((s) => s.state === "masked")
    ).toHaveLength(4)
    act(() => result.current.player.seek(2))
    expect(
      result.current.slots.filter((s) => s.state === "masked")
    ).toHaveLength(0)
  })

  it("updates components rendered under the provider", () => {
    render(
      <DiffusionTraceProvider trace={maskedRemaskTrace} initialFrame={2}>
        <Probe />
      </DiffusionTraceProvider>
    )
    expect(screen.getByRole("status")).toHaveTextContent("0")
  })

  it("exposes provenance", () => {
    const { result } = renderHook(() => useTraceProvenance(), { wrapper })
    expect(result.current.mode).toBe("illustrative")
  })
})
