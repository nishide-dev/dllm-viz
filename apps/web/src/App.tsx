import { Route, Routes } from "react-router-dom"

import { SiteLayout } from "@/components/site-nav"
import { BlockDiffusionCanvasDemo } from "@/routes/block-diffusion-canvas-demo"
import { CandidateDistributionDemo } from "@/routes/candidate-distribution-demo"
import { CommitHeatmapDemo } from "@/routes/commit-heatmap-demo"
import { Compare } from "@/routes/compare"
import { DenoisingTokenCanvasDemo } from "@/routes/denoising-token-canvas-demo"
import { Home } from "@/routes/home"

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route element={<Home />} path="/" />
        <Route
          element={<DenoisingTokenCanvasDemo />}
          path="/components/denoising-token-canvas"
        />
        <Route
          element={<CommitHeatmapDemo />}
          path="/components/commit-heatmap"
        />
        <Route
          element={<CandidateDistributionDemo />}
          path="/components/candidate-distribution"
        />
        <Route
          element={<BlockDiffusionCanvasDemo />}
          path="/components/block-diffusion-canvas"
        />
        <Route element={<Compare />} path="/compare" />
      </Route>
    </Routes>
  )
}
