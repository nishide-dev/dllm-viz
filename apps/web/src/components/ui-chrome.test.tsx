import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

describe("chat chrome bridges", () => {
  it("re-export the official chat components", () => {
    for (const component of [
      Bubble,
      BubbleContent,
      Marker,
      MarkerContent,
      Message,
      MessageContent,
      MessageScroller,
      MessageScrollerContent,
      MessageScrollerItem,
      MessageScrollerProvider,
      MessageScrollerViewport,
    ]) {
      expect(typeof component).toBe("function")
    }
  })

  it("renders a bubble inside the scroller in jsdom", () => {
    render(
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent>
              <MessageScrollerItem>
                <Message align="end">
                  <MessageContent>
                    <Bubble align="end">
                      <BubbleContent>hello</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    )
    expect(screen.getByText("hello")).toBeInTheDocument()
    render(
      <Marker>
        <MarkerContent>status</MarkerContent>
      </Marker>
    )
    expect(screen.getByText("status")).toBeInTheDocument()
  })
})
