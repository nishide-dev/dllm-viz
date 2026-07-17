import { render, screen } from "@testing-library/react"
import { Button } from "@workspace/ui/components/button"
import { describe, expect, it } from "vitest"

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument()
  })

  it("applies variant classes", () => {
    render(<Button variant="outline">Outline</Button>)
    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass(
      "border-border"
    )
  })
})
