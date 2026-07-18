import { render, screen } from "@testing-library/react"
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
})
