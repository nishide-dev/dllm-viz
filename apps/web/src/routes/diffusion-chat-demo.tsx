import { useState } from "react"

import { chatRemaskTrace } from "@/lib/dllm-viz-core"
import type { ChatTurn } from "@/registry/default/diffusion-chat/diffusion-chat"
import { DiffusionChat } from "@/registry/default/diffusion-chat/diffusion-chat"

const SCRIPTED_QUESTION = "Why can diffusion LMs revise their own output?"

const INITIAL_TURNS: ChatTurn[] = [
  { id: "t1", role: "user", text: "What is a diffusion language model?" },
  {
    id: "t2",
    role: "assistant",
    text: "A diffusion language model generates text by iteratively denoising a masked sequence: every position is refined in parallel across steps instead of being appended left to right.",
  },
]

export function DiffusionChatDemo() {
  const [turns, setTurns] = useState<ChatTurn[]>(INITIAL_TURNS)
  const [sent, setSent] = useState(false)

  const send = () => {
    setTurns([
      ...INITIAL_TURNS,
      { id: "t3", role: "user", text: SCRIPTED_QUESTION },
      { id: "t4", role: "assistant", trace: chatRemaskTrace, autoPlay: true },
    ])
    setSent(true)
  }

  const reset = () => {
    setTurns(INITIAL_TURNS)
    setSent(false)
  }

  return (
    <div className="flex h-[calc(100svh-6rem)] flex-col gap-4 p-6">
      <div className="flex items-baseline gap-3">
        <h1 className="font-medium text-lg">DiffusionChat</h1>
        <button
          className="text-muted-foreground text-xs underline"
          onClick={reset}
          type="button"
        >
          Reset
        </button>
      </div>
      <DiffusionChat className="min-h-0 flex-1 rounded border" turns={turns} />
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!sent) send()
        }}
      >
        <span className="rounded border px-1.5 py-0.5 text-muted-foreground text-xs">
          Scripted demo
        </span>
        <input
          aria-label="Scripted prompt"
          className="min-w-0 flex-1 rounded border bg-muted px-3 py-2 text-sm"
          readOnly
          value={SCRIPTED_QUESTION}
        />
        <button
          className="rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          disabled={sent}
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  )
}
