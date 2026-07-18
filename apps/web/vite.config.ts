/// <reference types="vitest/config" />
import { createRequire } from "node:module"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Registry sources live outside apps/web, so pnpm's per-directory
// node_modules resolution can't find react from there. Pin the exact
// react runtime paths that apps/web resolves to.
const require = createRequire(import.meta.url)

// https://vite.dev/config/
export default defineConfig({
  // Sub-path deployments (GitHub Pages) set VITE_BASE_PATH=/dllm-viz/.
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@/registry",
        replacement: path.resolve(__dirname, "../../registry"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: require.resolve("react/jsx-dev-runtime"),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: require.resolve("react/jsx-runtime"),
      },
      {
        find: /^lucide-react$/,
        replacement: require.resolve("lucide-react"),
      },
      { find: /^react-dom$/, replacement: require.resolve("react-dom") },
      { find: /^react$/, replacement: require.resolve("react") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
})
