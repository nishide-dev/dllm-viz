import { Route, Routes } from "react-router-dom"

import { DenoisingTokenCanvasDemo } from "@/routes/denoising-token-canvas-demo"
import { Home } from "@/routes/home"

export function App() {
  return (
    <Routes>
      <Route element={<Home />} path="/" />
      <Route
        element={<DenoisingTokenCanvasDemo />}
        path="/components/denoising-token-canvas"
      />
    </Routes>
  )
}
