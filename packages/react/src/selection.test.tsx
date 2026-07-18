import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import {
  DiffusionSelectionProvider,
  useOptionalSlotSelection,
  useSlotSelection,
} from "./selection"

const wrapper = ({ children }: { children: ReactNode }) => (
  <DiffusionSelectionProvider>{children}</DiffusionSelectionProvider>
)

describe("DiffusionSelectionProvider", () => {
  it("useSlotSelection throws outside the provider", () => {
    expect(() => renderHook(() => useSlotSelection())).toThrow(
      /DiffusionSelectionProvider/
    )
  })

  it("useOptionalSlotSelection returns null outside the provider", () => {
    const { result } = renderHook(() => useOptionalSlotSelection())
    expect(result.current).toBeNull()
  })

  it("shares selection between consumers", () => {
    const { result } = renderHook(
      () => ({ a: useSlotSelection(), b: useSlotSelection() }),
      { wrapper }
    )
    expect(result.current.a.selectedSlotId).toBeNull()
    act(() => result.current.a.setSelectedSlotId("s3"))
    expect(result.current.b.selectedSlotId).toBe("s3")
    act(() => result.current.b.setSelectedSlotId(null))
    expect(result.current.a.selectedSlotId).toBeNull()
  })

  it("honors defaultSelectedSlotId", () => {
    const { result } = renderHook(() => useSlotSelection(), {
      wrapper: ({ children }) => (
        <DiffusionSelectionProvider defaultSelectedSlotId="s1">
          {children}
        </DiffusionSelectionProvider>
      ),
    })
    expect(result.current.selectedSlotId).toBe("s1")
  })
})
