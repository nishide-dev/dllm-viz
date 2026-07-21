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
