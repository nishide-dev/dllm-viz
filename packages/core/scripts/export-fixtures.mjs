// Exports TS-authored fixtures as JSON for examples/ and the demo app.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  arBaselineTrace,
  blockCanvasTrace,
  confidenceCommitTrace,
  maskedBasicTrace,
  maskedRemaskTrace,
} from "../src/testing/fixtures.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..")
const targets = [
  join(root, "examples/traces"),
  join(root, "apps/web/public/traces"),
]
// The dense performance fixture is intentionally NOT exported: it is
// generated on demand by generatePerformanceTrace (spec §19.3 — bundled
// examples stay under 1 MB; only the generator is committed).
const fixtures = [
  ["masked-basic.json", maskedBasicTrace],
  ["masked-remask.json", maskedRemaskTrace],
  ["block-canvas.json", blockCanvasTrace],
  ["confidence-commit.json", confidenceCommitTrace],
  ["ar-baseline.json", arBaselineTrace],
]
for (const dir of targets) {
  mkdirSync(dir, { recursive: true })
  for (const [name, trace] of fixtures) {
    writeFileSync(join(dir, name), `${JSON.stringify(trace, null, 2)}\n`)
    console.log(`wrote ${join(dir, name)}`)
  }
}
