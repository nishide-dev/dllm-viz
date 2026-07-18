import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useReducedMotion } from "./reduced-motion"

function mockMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  )
}

describe("useReducedMotion", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns true when the media query matches", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it("returns false when the media query does not match", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it("returns false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it("updates when the media query changes", () => {
    let listener: (() => void) | undefined
    const media = {
      matches: false,
      addEventListener: vi.fn((_event: string, callback: () => void) => {
        listener = callback
      }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(media))
    const { result } = renderHook(() => useReducedMotion())

    act(() => {
      media.matches = true
      listener?.()
    })
    expect(result.current).toBe(true)
  })
})
