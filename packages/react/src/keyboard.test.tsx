import { maskedRemaskTrace } from "@dllm-viz/core"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { useDiffusionSnapshot } from "./hooks"
import { useDiffusionKeyboard } from "./keyboard"
import { DiffusionTraceProvider } from "./provider"

interface HarnessProps {
  enabled?: boolean
}

function Harness({ enabled = true }: HarnessProps): ReactElement {
  useDiffusionKeyboard({ enabled })
  const snapshot = useDiffusionSnapshot()
  return (
    <div>
      <output>{snapshot.frameIndex}</output>
      <input aria-label="text" />
    </div>
  )
}

function setup(enabled?: boolean): void {
  render(
    <DiffusionTraceProvider trace={maskedRemaskTrace}>
      <Harness enabled={enabled} />
    </DiffusionTraceProvider>
  )
}

afterEach(cleanup)

describe("useDiffusionKeyboard", () => {
  it("ArrowRight/ArrowLeft step frames", () => {
    setup()
    fireEvent.keyDown(window, { key: "ArrowRight" })
    fireEvent.keyDown(window, { key: "ArrowRight" })
    fireEvent.keyDown(window, { key: "ArrowLeft" })
    expect(screen.getByRole("status")).toHaveTextContent("1")
  })

  it("Home and End jump to first and last frame", () => {
    setup()
    fireEvent.keyDown(window, { key: "End" })
    expect(screen.getByRole("status")).toHaveTextContent("6")
    fireEvent.keyDown(window, { key: "Home" })
    expect(screen.getByRole("status")).toHaveTextContent("0")
  })

  it("Space toggles playback", () => {
    setup()
    fireEvent.keyDown(window, { key: " " })
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("does not steal keys from text inputs (spec §15.2)", () => {
    setup()
    fireEvent.keyDown(screen.getByLabelText("text"), { key: "ArrowRight" })
    expect(screen.getByRole("status")).toHaveTextContent("0")
  })

  it("does nothing when disabled", () => {
    setup(false)
    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(screen.getByRole("status")).toHaveTextContent("0")
  })

  it("Shift+Arrow seeks between canvas boundaries", () => {
    const trace = {
      ...maskedRemaskTrace,
      frames: maskedRemaskTrace.frames.map((frame, index) => {
        if (index === 2) return { ...frame, kind: "canvas-start" as const }
        if (index === 4) return { ...frame, kind: "canvas-commit" as const }
        return frame
      }),
    }
    render(
      <DiffusionTraceProvider trace={trace}>
        <Harness />
      </DiffusionTraceProvider>
    )

    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true })
    expect(screen.getByRole("status")).toHaveTextContent("2")
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true })
    expect(screen.getByRole("status")).toHaveTextContent("4")
    fireEvent.keyDown(window, { key: "ArrowLeft", shiftKey: true })
    expect(screen.getByRole("status")).toHaveTextContent("2")
  })

  it("does not steal keys from other editable elements", () => {
    render(
      <DiffusionTraceProvider trace={maskedRemaskTrace}>
        <EditableHarness />
      </DiffusionTraceProvider>
    )

    const editableElements = [
      screen.getByLabelText("notes"),
      screen.getByLabelText("choice"),
      screen.getByTestId("editable"),
    ]
    for (const element of editableElements) {
      fireEvent.keyDown(element, { key: "ArrowRight" })
    }
    expect(screen.getByRole("status")).toHaveTextContent("0")
  })
})

function EditableHarness(): ReactElement {
  useDiffusionKeyboard()
  const snapshot = useDiffusionSnapshot()
  return (
    <div>
      <output>{snapshot.frameIndex}</output>
      <textarea aria-label="notes" />
      <select aria-label="choice" />
      <div contentEditable data-testid="editable" />
    </div>
  )
}
