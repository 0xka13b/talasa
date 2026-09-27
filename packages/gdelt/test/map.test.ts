import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { toArticle } from "../src/map"
import { artListResponseSchema } from "../src/types"

const here = dirname(fileURLToPath(import.meta.url))
const read = (file: string): unknown =>
  JSON.parse(readFileSync(join(here, "fixtures", file), "utf8"))

describe("article mapping", () => {
  const articles = artListResponseSchema.parse(read("artlist-response.json")).articles.map(toArticle)

  it("maps a real ArtList record", () => {
    expect(articles.length).toBe(5)
    const [first] = articles
    expect(first?.url.startsWith("http")).toBe(true)
    expect((first?.title?.length ?? 0) > 0).toBe(true)
    expect(first?.domain).toBe("bbc.com")
    expect(first?.sourceCountry).toBe("United Kingdom")
    expect(first?.language).toBe("English")
  })

  it("normalises GDELT's YYYYMMDDTHHMMSSZ stamp to ISO 8601", () => {
    expect(articles[0]?.seenDate).toBe("2026-06-16T17:00:00Z")
  })

  it("treats empty strings as absent", () => {
    // bbc record: url_mobile="" -> null; article.wn.com record: socialimage="" -> null
    expect(articles[0]?.mobileUrl).toBeNull()
    expect(articles[1]?.imageUrl).toBeNull()
    // epochtimes record DOES carry an AMP mobile url
    expect(articles[3]?.mobileUrl).toBe("https://www.epochtimes.com/gb/26/6/5/n14782886.htm/amp")
  })
})

describe("empty result set", () => {
  it("parses GDELT's `{}` no-match body into an empty list", () => {
    expect(artListResponseSchema.parse({}).articles).toEqual([])
  })
})
