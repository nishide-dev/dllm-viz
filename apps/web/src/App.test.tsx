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
})
