// Generates registry/default/lib/* from packages/core and packages/react
// sources, and regenerates registry.json (spec D-011, §16.4).
// Run: pnpm registry:build
import {
  cpSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, "")
const libDir = join(root, "registry/default/lib")

rmSync(libDir, { recursive: true, force: true })

function copyPackage(pkg, destName, rewrite) {
  const src = join(root, "packages", pkg, "src")
  const dest = join(libDir, destName)
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => !p.includes(".test.") && !p.endsWith("setup.ts"),
  })
  rmSync(join(dest, "test"), { recursive: true, force: true })
  for (const file of walk(dest)) {
    let text = readFileSync(file, "utf8")
    if (rewrite) text = rewrite(text, file)
    writeFileSync(file, text)
  }
  return [...walk(dest)].map((f) => relative(root, f))
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

const coreFiles = copyPackage("core", "dllm-viz-core")
const reactFiles = copyPackage("react", "dllm-viz-react", (text, file) => {
  // Installed users import the sibling lib item instead of the npm package.
  const depth = relative(join(libDir, "dllm-viz-react"), dirname(file))
  const up = depth === "" ? ".." : "../.."
  return text.replaceAll('"@dllm-viz/core"', `"${up}/dllm-viz-core"`)
})

const libItem = (name, title, description, files, extra = {}) => ({
  name,
  type: "registry:lib",
  title,
  description,
  files: files.map((path) => ({
    path,
    type: "registry:lib",
    target: path.replace("registry/default/lib/", "lib/"),
  })),
  ...extra,
})

// Cross-item deps must use the <owner>/<repo>/<item> form: bare names are
// resolved against the official shadcn registry, not this repository.
const REPO = "nishide-dev/dllm-viz"

const componentItem = (name, title, description, extra = {}) => ({
  name,
  type: "registry:ui",
  title,
  description,
  registryDependencies: [`${REPO}/dllm-viz-core`, `${REPO}/dllm-viz-react`],
  files: [
    {
      path: `registry/default/${name}/${name}.tsx`,
      type: "registry:component",
    },
  ],
  ...extra,
})

const registry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "dllm-viz",
  homepage: "https://github.com/nishide-dev/dllm-viz",
  items: [
    libItem(
      "dllm-viz-core",
      "dLLM Viz Core",
      "Trace schema 0.1, validation, codecs, and deterministic playback engine.",
      coreFiles,
      { dependencies: ["zod"] }
    ),
    libItem(
      "dllm-viz-react",
      "dLLM Viz React",
      "Headless provider and hooks for diffusion trace playback.",
      reactFiles,
      { dependencies: ["react"] }
    ),
    componentItem(
      "denoising-token-canvas",
      "Denoising Token Canvas",
      "Trace-faithful token canvas for diffusion language model denoising."
    ),
    componentItem(
      "diffusion-step-controls",
      "Diffusion Step Controls",
      "Deterministic playback controls with keyboard support.",
      { dependencies: ["lucide-react"] }
    ),
    componentItem(
      "trace-inspector",
      "Trace Inspector",
      "Exact slot/frame data with provenance labels."
    ),
  ],
}

writeFileSync(
  join(root, "registry.json"),
  `${JSON.stringify(registry, null, 2)}\n`
)
console.log(
  `wrote registry.json (${registry.items.length} items, ${
    coreFiles.length + reactFiles.length
  } lib files)`
)
