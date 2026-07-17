// Exports TS-authored fixtures as JSON for examples/ and the demo app.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { maskedBasicTrace, maskedRemaskTrace } from "../src/testing/fixtures.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..")
const targets = [
  join(root, "examples/traces"),
  join(root, "apps/web/public/traces"),
]
const fixtures = [
  ["masked-basic.json", maskedBasicTrace],
  ["masked-remask.json", maskedRemaskTrace],
]
for (const dir of targets) {
  mkdirSync(dir, { recursive: true })
  for (const [name, trace] of fixtures) {
    writeFileSync(join(dir, name), `${JSON.stringify(trace, null, 2)}\n`)
    console.log(`wrote ${join(dir, name)}`)
  }
}
