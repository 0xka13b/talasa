import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { fuzzyResponseSchema, leiRecordResponseSchema } from "../src/types"

const here = dirname(fileURLToPath(import.meta.url))
const load = (name: string) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"))

describe("raw schemas", () => {
  it("parses a full lei-record envelope", () => {
    const rec = leiRecordResponseSchema.parse(load("lei-record.json"))
    expect(rec.data.attributes.entity.legalName.name).toBe("Société Générale Effekten GmbH")
    expect(rec.data.attributes.entity.jurisdiction).toBe("DE")
    expect(rec.data.attributes.bic).toEqual(["SGEFDEFFXXX", "SGEGDEF1XXX"])
  })

  it("tolerates null bic and null headquartersAddress (parent fixture)", () => {
    const rec = leiRecordResponseSchema.parse(load("direct-parent.json"))
    expect(rec.data.attributes.bic).toBeNull()
    expect(rec.data.attributes.entity.headquartersAddress).toBeNull()
    expect(rec.data.attributes.entity.legalForm?.other).toBe("SA")
  })

  it("parses fuzzy completions with nested lei id", () => {
    const fuzzy = fuzzyResponseSchema.parse(load("fuzzycompletions.json"))
    expect(fuzzy.data).toHaveLength(2)
    expect(fuzzy.data[0]?.relationships?.["lei-records"]?.data?.id).toBe("529900W18LQJJN6SJ336")
  })
})
