import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { App } from "./App"

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )

describe("App", () => {
  it("renders the overview at /", () => {
    renderAt("/")
    expect(
      screen.getByRole("heading", { name: "dllm-viz" })
    ).toBeInTheDocument()
  })

  it("renders the token canvas demo route", () => {
    renderAt("/components/denoising-token-canvas")
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
  })

  it("renders the commit heatmap demo route", () => {
    renderAt("/components/commit-heatmap")
    expect(
      screen.getByRole("table", { name: "Commit heatmap" })
    ).toBeInTheDocument()
  })

  it("renders the candidate distribution demo route", () => {
    renderAt("/components/candidate-distribution")
    expect(screen.getByText(/candidates for s2/i)).toBeInTheDocument()
  })

  it("renders the block diffusion canvas demo route", () => {
    renderAt("/components/block-diffusion-canvas")
    expect(
      screen.getByRole("group", { name: "Block diffusion canvases" })
    ).toBeInTheDocument()
  })

  it("renders the compare route with a visible sync rule", () => {
    renderAt("/compare")
    expect(screen.getByLabelText("Synchronization rule")).toBeInTheDocument()
  })

  it("renders the diffusion chat demo route with a read-only scripted input", () => {
    renderAt("/components/diffusion-chat")
    expect(screen.getByLabelText("Scripted prompt")).toHaveAttribute("readonly")
    expect(screen.getByText("Scripted demo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled()
  })

  it("send appends the scripted user turn and the generating assistant turn", async () => {
    const user = userEvent.setup()
    renderAt("/components/diffusion-chat")
    await user.click(screen.getByRole("button", { name: "Send" }))
    // The turn autoplays on real timers; pause right away so no 250ms tick
    // fires between the remaining assertions.
    await user.click(screen.getByRole("button", { name: "Pause replay" }))
    expect(
      screen.getByText("Why can diffusion LMs revise their own output?")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("group", { name: "Token canvas" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("reset restores the initial scripted-demo state", async () => {
    const user = userEvent.setup()
    renderAt("/components/diffusion-chat")
    await user.click(screen.getByRole("button", { name: "Send" }))
    // Pause the autoplaying replay so real timers stay quiet (see above).
    await user.click(screen.getByRole("button", { name: "Pause replay" }))
    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(
      screen.queryByRole("group", { name: "Token canvas" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled()
  })
})
