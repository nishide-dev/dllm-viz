import { render, screen, within } from "@testing-library/react"
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

/** True for a <p> that renders a flowing-text run of the completion. */
function completionParagraph(_content: string, element: Element | null) {
  return (
    element?.tagName === "P" &&
    (element.textContent ?? "").includes("denoise every position")
  )
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

  it("rejects a turn carrying both text and trace at the type level", () => {
    const valid: ChatTurn = {
      id: "ok",
      role: "assistant",
      trace: chatRemaskTrace,
    }
    // @ts-expect-error text and trace are mutually exclusive on ChatTurn
    const invalid: ChatTurn = {
      id: "bad",
      role: "assistant",
      text: "hi",
      trace: chatRemaskTrace,
    }
    expect(valid.id).toBe("ok")
    expect(invalid.id).toBe("bad")
  })

  it("renders the generating turn as token slots, never as partial text", async () => {
    const user = userEvent.setup()
    render(<DiffusionChat turns={[traceTurn]} />)
    const canvas = screen.getByRole("group", { name: "Token canvas" })
    expect(canvas).toBeInTheDocument()
    // The live token canvas is fenced off from the role="log" region so
    // per-token mutations are not announced (spec §18).
    expect(canvas.closest('[aria-live="off"]')).not.toBeNull()
    expect(
      screen.getAllByRole("button", { name: /masked/ }).length
    ).toBeGreaterThan(0)
    // The completion never appears as accumulated plain text …
    expect(screen.queryByText(COMPLETION_TEXT)).not.toBeInTheDocument()
    // … and the prompt region is hidden inside the bubble.
    expect(
      screen.queryByText(/Why can diffusion LMs revise their own output\?/)
    ).not.toBeInTheDocument()
    // Mid-playback (about half the frames, with the leading tokens already
    // committed) the answer is still a token canvas: no flowing-text
    // paragraph carries any accumulated prefix of the completion.
    const next = screen.getByRole("button", { name: "Next frame" })
    for (let i = 0; i < Math.floor(LAST_FRAME / 2); i++) {
      await user.click(next)
    }
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
    expect(screen.queryByText(completionParagraph)).not.toBeInTheDocument()
  })

  it("pause/resume via the inline toggle changes player status", async () => {
    const user = userEvent.setup()
    render(<DiffusionChat turns={[traceTurn]} />)
    expect(screen.getByText("Replay ready")).toBeInTheDocument()
    // Pause again right after asserting the immediate playing status so the
    // 250ms real-timer tick never races the remaining assertions.
    await user.click(screen.getByRole("button", { name: "Resume replay" }))
    expect(screen.getByText(/Denoising · step \d+\/9/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Pause replay" }))
    expect(screen.getByText("Replay paused")).toBeInTheDocument()
  })

  it("autoPlay starts playback immediately", async () => {
    const user = userEvent.setup()
    render(
      <DiffusionChat
        turns={[
          {
            id: "gen",
            role: "assistant",
            trace: chatRemaskTrace,
            autoPlay: true,
          },
        ]}
      />
    )
    // Assert the immediate playing status, then pause before anything else
    // so the 250ms real-timer tick cannot race the test.
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
    // The fixture's recorded final.text agrees with the frames, so the
    // snapshot-derived settled text equals final.text minus the prompt.
    const promptLength = chatRemaskTrace.prompt?.text.length ?? 0
    expect(chatRemaskTrace.final?.text?.slice(promptLength).trimStart()).toBe(
      COMPLETION_TEXT
    )
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
    expect(screen.getAllByRole("button", { name: /masked/ })).toHaveLength(28)
    await stepToEnd(user)
    // Still in generation view (explicit toggle wins) and no second call.
    expect(onEnd).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "Show final answer" }))
    expect(screen.getByText(COMPLETION_TEXT)).toBeInTheDocument()
  })

  it("refires onGenerationEnd when the same turn swaps to a new trace object", async () => {
    const user = userEvent.setup()
    const onEnd = vi.fn()
    const { rerender } = render(
      <DiffusionChat onGenerationEnd={onEnd} turns={[traceTurn]} />
    )
    await stepToEnd(user)
    expect(onEnd).toHaveBeenCalledTimes(1)
    // Regenerate flow: same turn id, fresh trace object.
    const regenerated: DiffusionTrace = { ...chatRemaskTrace }
    rerender(
      <DiffusionChat
        onGenerationEnd={onEnd}
        turns={[{ id: "gen", role: "assistant", trace: regenerated }]}
      />
    )
    // The new player starts back at frame 0 in the generation view.
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
    await stepToEnd(user)
    expect(onEnd).toHaveBeenCalledTimes(2)
    expect(onEnd).toHaveBeenLastCalledWith("gen")
  })

  it("keeps a turn's frame position when a later turn is appended", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DiffusionChat turns={[traceTurn]} />)
    const next = screen.getByRole("button", { name: "Next frame" })
    for (let i = 0; i < 3; i++) {
      await user.click(next)
    }
    // Frame 3 of the fixture leaves 17 slots masked. Anchor the state so
    // the committed " remasked" token does not match.
    const masked = () => screen.getAllByRole("button", { name: /, masked$/ })
    expect(masked()).toHaveLength(17)
    rerender(
      <DiffusionChat
        turns={[
          traceTurn,
          { id: "after", role: "assistant", text: "Follow-up" },
        ]}
      />
    )
    expect(masked()).toHaveLength(17)
  })

  it("scopes onGenerationEnd to the trace turn that actually ended", async () => {
    const user = userEvent.setup()
    const onEnd = vi.fn()
    render(
      <DiffusionChat
        onGenerationEnd={onEnd}
        turns={[
          { id: "g1", role: "assistant", trace: chatRemaskTrace },
          { id: "g2", role: "assistant", trace: chatRemaskTrace },
        ]}
      />
    )
    const bubbles = screen
      .getAllByRole("group", { name: "Token canvas" })
      .map((canvas) => canvas.closest("[data-slot='bubble']") as HTMLElement)
    expect(bubbles).toHaveLength(2)
    const firstNext = within(bubbles[0]).getByRole("button", {
      name: "Next frame",
    })
    for (let i = 0; i < LAST_FRAME; i++) {
      await user.click(firstNext)
    }
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith("g1")
    // The second turn is still replaying.
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
  })

  it("shows a provenance badge in both generation and settled views", async () => {
    const user = userEvent.setup()
    render(<DiffusionChat turns={[traceTurn]} />)
    expect(screen.getByText("illustrative")).toBeInTheDocument()
    await stepToEnd(user)
    expect(screen.getByText("illustrative")).toBeInTheDocument()
  })

  it("renders a closed zero-frame trace as its settled final text", () => {
    const onEnd = vi.fn()
    const closedTrace: DiffusionTrace = {
      ...chatRemaskTrace,
      traceId: "fixture-chat-remask-closed",
      frames: [],
      checkpoints: [],
    }
    render(
      <DiffusionChat
        onGenerationEnd={onEnd}
        turns={[{ id: "live", role: "assistant", trace: closedTrace }]}
      />
    )
    // final.text minus the echoed prompt, shown without any playback.
    expect(screen.getByText(COMPLETION_TEXT)).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "Token canvas" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Waiting for frames")).not.toBeInTheDocument()
    // A closed trace is ended: the latch fires once on mount.
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith("live")
  })

  it("renders an open zero-frame trace as a waiting canvas without ending", () => {
    const onEnd = vi.fn()
    const { final: _final, ...rest } = chatRemaskTrace
    const openTrace: DiffusionTrace = {
      ...rest,
      traceId: "fixture-chat-remask-open",
      frames: [],
      checkpoints: [],
    }
    render(
      <DiffusionChat
        onGenerationEnd={onEnd}
        turns={[{ id: "live", role: "assistant", trace: openTrace }]}
      />
    )
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
    expect(screen.getByText("Waiting for frames")).toBeInTheDocument()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it("warns once when final.text disagrees with the replayed frames", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const user = userEvent.setup()
      const mismatchTrace: DiffusionTrace = {
        ...chatRemaskTrace,
        traceId: "fixture-chat-remask-mismatch",
        final: {
          text: "A different recorded answer.",
          finishReason: "completed",
        },
      }
      render(
        <DiffusionChat
          turns={[{ id: "gen", role: "assistant", trace: mismatchTrace }]}
        />
      )
      await stepToEnd(user)
      const mismatchWarnings = () =>
        warn.mock.calls.filter(([message]) =>
          String(message).includes("fixture-chat-remask-mismatch")
        )
      expect(mismatchWarnings()).toHaveLength(1)
      // One-shot: revisiting the end does not warn again.
      await user.click(screen.getByRole("button", { name: "Show generation" }))
      await stepToEnd(user)
      expect(mismatchWarnings()).toHaveLength(1)
    } finally {
      warn.mockRestore()
    }
  })

  it("warns in dev when turn ids collide", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    // Silence React's own duplicate-key complaint for this render.
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      render(
        <DiffusionChat
          turns={[
            { id: "dup", role: "user", text: "first" },
            { id: "dup", role: "assistant", text: "second" },
          ]}
        />
      )
      expect(warn).toHaveBeenCalledWith(
        'DiffusionChat: duplicate turn id "dup"'
      )
    } finally {
      warn.mockRestore()
      error.mockRestore()
    }
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
      // Pause promptly so the real-timer tick stays out of the test.
      await user.click(screen.getByRole("button", { name: "Pause replay" }))
    } finally {
      window.matchMedia = original
    }
  })
})
