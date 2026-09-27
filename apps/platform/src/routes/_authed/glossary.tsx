import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { highlightMatches } from "@/lib/highlight-match"
import { IconSearch } from "@tabler/icons-react"
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"

export const Route = createFileRoute("/_authed/glossary")({ component: GlossaryPage })

type Term = { term: string; abbr?: string; def: string }
type Group = { group: string; terms: Term[] }

/**
 * Plain-language definitions for the domain terms that surface across vessel
 * screenings and counterparty due-diligence reports. Keep entries short and
 * concrete — this is a reference an analyst scans, not a textbook.
 */
const GLOSSARY: Group[] = [
  {
    group: "Sanctions & watchlists",
    terms: [
      {
        term: "Person / Entity of Interest",
        abbr: "POI",
        def: "A party flagged as relevant by intelligence or open-source datasets without being formally sanctioned. In our reports it maps to the OpenSanctions “poi” topic — a lead to review, not a designation.",
      },
      {
        term: "Directly sanctioned",
        def: "The party itself appears on a sanctions list (e.g. OFAC SDN, EU, UK HMT, UN). This is the severe, red-flag case.",
      },
      {
        term: "Sanction-linked",
        def: "Connected to a sanctioned entity through ownership, management, or fleet ties — but not itself listed. A softer, amber signal that warrants a closer look.",
      },
      {
        term: "Politically Exposed Person",
        abbr: "PEP",
        def: "Someone who holds or recently held a prominent public office, along with close associates. PEPs carry elevated bribery and corruption risk and trigger enhanced due diligence.",
      },
      {
        term: "OFAC SDN List",
        def: "The US Treasury’s Specially Designated Nationals list — the primary US sanctions register. Assets are blocked and US persons are broadly barred from dealing with anyone on it.",
      },
      {
        term: "Sister vessel",
        def: "Another ship under the same registered owner, manager, or beneficial owner. A sanction or detention on a sister vessel raises risk across the whole fleet.",
      },
    ],
  },
  {
    group: "Vessel identity & ownership",
    terms: [
      {
        term: "IMO number",
        abbr: "IMO",
        def: "A permanent seven-digit identifier assigned to a ship’s hull for life. Unlike name, flag, or owner, it never changes — the anchor for tracking a vessel’s history.",
      },
      {
        term: "Maritime Mobile Service Identity",
        abbr: "MMSI",
        def: "The nine-digit identity a ship broadcasts over AIS radio. It can change when the vessel re-flags, so it’s weaker than the IMO number for continuity.",
      },
      {
        term: "Flag state",
        def: "The country where a ship is registered, whose law governs it. Frequent changes (“flag hopping”), especially to lax registries, can signal an attempt to dodge scrutiny.",
      },
      {
        term: "Deadweight / Gross tonnage",
        abbr: "DWT / GT",
        def: "DWT is the cargo-carrying capacity in tonnes; GT is a volumetric measure of the ship’s overall enclosed size. Together they characterise a vessel’s class and trade.",
      },
      {
        term: "Beneficial owner",
        def: "The ultimate individual or company that controls and profits from an asset, behind any intermediary holding structures. Identifying it is central to due diligence.",
      },
      {
        term: "ISM Manager",
        abbr: "ISM",
        def: "The company responsible for a ship’s day-to-day safe operation under the International Safety Management Code — often distinct from the registered owner.",
      },
      {
        term: "Classification society",
        def: "An independent body (e.g. Lloyd’s Register, DNV) that sets and verifies technical and safety standards for a ship’s hull and machinery.",
      },
      {
        term: "GLEIF / LEI",
        def: "The Global Legal Entity Identifier Foundation issues the LEI — a 20-character code that uniquely identifies a legal entity in financial transactions, used here to resolve corporate ownership.",
      },
    ],
  },
  {
    group: "Port State Control & safety",
    terms: [
      {
        term: "Port State Control",
        abbr: "PSC",
        def: "Inspection of foreign ships in national ports to verify they meet international safety, security, and environmental rules — the front line of enforcement at sea.",
      },
      {
        term: "Detention",
        def: "When a PSC inspection finds deficiencies serious enough that the ship is held in port until they’re fixed. A strong adverse signal about a vessel’s condition or operator.",
      },
      {
        term: "Deficiency",
        def: "A specific fault recorded during a PSC inspection, from minor documentation gaps to safety failures. Repeated or severe deficiencies drive detentions.",
      },
      {
        term: "Memorandum of Understanding",
        abbr: "MoU",
        def: "A regional agreement coordinating Port State Control — e.g. the Paris MoU and Tokyo MoU. Each publishes inspection, detention, and flag-performance data that feeds risk scoring.",
      },
    ],
  },
  {
    group: "Tracking & behaviour",
    terms: [
      {
        term: "Automatic Identification System",
        abbr: "AIS",
        def: "The transponder system by which ships continuously broadcast their identity, position, course, and speed. The backbone of vessel tracking.",
      },
      {
        term: "AIS gap / dark activity",
        def: "A period where a vessel stops transmitting AIS (“going dark”). Legitimate at times, but often used to conceal port calls, transfers, or sanctioned trade.",
      },
      {
        term: "Spoofing",
        def: "Broadcasting false AIS position or identity data to appear elsewhere or as another vessel — a deliberate evasion technique.",
      },
      {
        term: "Loitering",
        def: "A vessel lingering or drifting in one area rather than transiting. In open water it can indicate a rendezvous or ship-to-ship transfer.",
      },
      {
        term: "Ship-to-ship transfer",
        abbr: "STS",
        def: "Cargo moved directly between two vessels at sea instead of at a port. A normal logistics practice that is also used to obscure a cargo’s true origin.",
      },
      {
        term: "Dark / shadow fleet",
        def: "Aging tankers with opaque ownership and insurance that move sanctioned or high-risk cargo while evading oversight. A recurring pattern in these screenings.",
      },
    ],
  },
  {
    group: "Satellite imagery",
    terms: [
      {
        term: "Synthetic Aperture Radar",
        abbr: "SAR",
        def: "Satellite radar imaging: the sensor emits its own microwave pulses and measures the echo, so it works day or night and sees through cloud. Calm water scatters the signal away (dark), while a metal hull reflects it straight back (bright) — which makes SAR the backbone of dark-vessel detection.",
      },
      {
        term: "Sentinel-1",
        def: "The EU Copernicus radar (SAR) satellite mission, ~10 m resolution. Our primary source for checking whether a physical hull was present at a vessel’s reported position when it went dark or loitered for a suspected transfer.",
      },
      {
        term: "Sentinel-2",
        def: "The EU Copernicus optical (camera-like) satellite mission, ~10 m resolution. Daylight- and cloud-dependent, so it isn’t always available — used to visually corroborate a SAR detection (a second hull alongside, a connecting hose, an oil slick).",
      },
      {
        term: "Copernicus Data Space Ecosystem",
        abbr: "CDSE",
        def: "The EU’s free platform serving Sentinel satellite imagery. It is the source of the Sentinel-1 and Sentinel-2 scenes behind the satellite-verification panel.",
      },
      {
        term: "Beam",
        def: "The width of a ship at its widest point. Comparing a vessel’s registered beam against the width of its radar return is how a possible side-by-side transfer is flagged (see “beam anomaly”).",
      },
      {
        term: "Satellite (SAR) verification",
        def: "Cross-checking an AIS event against a contemporaneous satellite pass. For a suspected transfer the verdict ranges from a confirmed second hull alongside (strong), through a single return far wider than the registered beam (“beam anomaly”, weak), to a vessel simply present — or nothing at the reported position, which itself hints at spoofing.",
      },
    ],
  },
]

function GlossaryPage() {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GLOSSARY
    return GLOSSARY.map((g) => ({
      ...g,
      terms: g.terms.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.abbr?.toLowerCase().includes(q) ||
          t.def.toLowerCase().includes(q)
      ),
    })).filter((g) => g.terms.length > 0)
  }, [query])

  const q = query.trim()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-2">
      <div className="sticky -top-6 z-10 -mx-6 -mt-6 flex flex-col gap-4 bg-background px-6 pt-6 pb-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Glossary</h1>
          <p className="text-base text-muted-foreground">
            Plain-language definitions for the maritime, sanctions, and due-diligence terms
            that appear across your screenings.
          </p>
        </div>

        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms…"
            className="h-10 pl-9 text-base"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-base text-muted-foreground">No terms match “{query}”.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {filtered.map((group) => (
            <Card key={group.group}>
              <CardHeader>
                <CardTitle className="text-lg">{group.group}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col divide-y divide-border">
                  {group.terms.map((t) => (
                    <div key={t.term} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
                      <dt className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-medium">{highlightMatches(t.term, q)}</span>
                        {t.abbr && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {highlightMatches(t.abbr, q)}
                          </span>
                        )}
                      </dt>
                      <dd className="text-sm leading-relaxed text-muted-foreground">
                        {highlightMatches(t.def, q)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
