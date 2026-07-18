// Generates schemas/*.schema.json from the canonical Zod schemas (D-012).
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { DiffusionTraceSchema, StreamEventSchema } from "../src/schema/zod.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..")
const outDir = join(root, "schemas")
mkdirSync(outDir, { recursive: true })

const targets = [
  ["trace.schema.json", DiffusionTraceSchema],
  ["stream-event.schema.json", StreamEventSchema],
]
for (const [name, schema] of targets) {
  const json = z.toJSONSchema(schema, { io: "input" })
  writeFileSync(join(outDir, name), `${JSON.stringify(json, null, 2)}\n`)
  console.log(`wrote schemas/${name}`)
}
