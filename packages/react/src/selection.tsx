import type { ReactNode } from "react"
import { createContext, useContext, useMemo, useState } from "react"

export interface SlotSelection {
  selectedSlotId: string | null
  setSelectedSlotId: (slotId: string | null) => void
}

const SelectionContext = createContext<SlotSelection | null>(null)

export interface DiffusionSelectionProviderProps {
  defaultSelectedSlotId?: string | null
  children: ReactNode
}

/**
 * Shares a selected token slot between canvas, inspector, heatmap, and
 * distribution components without prop drilling (spec §24 Phase 2
 * "synchronized selection"). Headless: renders no DOM.
 */
export function DiffusionSelectionProvider({
  defaultSelectedSlotId = null,
  children,
}: DiffusionSelectionProviderProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(
    defaultSelectedSlotId
  )
  const value = useMemo(
    () => ({ selectedSlotId, setSelectedSlotId }),
    [selectedSlotId]
  )
  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSlotSelection(): SlotSelection {
  const selection = useContext(SelectionContext)
  if (selection === null) {
    throw new Error(
      "useSlotSelection must be used within a DiffusionSelectionProvider"
    )
  }
  return selection
}

/** Context if present, null otherwise — for components that also accept props. */
export function useOptionalSlotSelection(): SlotSelection | null {
  return useContext(SelectionContext)
}
