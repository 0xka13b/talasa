/**
 * The screening report rendered as a react-pdf <Document>. Mirrors the on-screen
 * tabbed report (overview / vessel / ownership / fleet / relationships) as a
 * single linear, print-ready document for the client. Internal LLM metadata is
 * deliberately omitted.
 */
import {
  eventDetail,
  KIND_COLOR,
  KIND_LABEL,
  locationOneLine,
  mappableEvents,
  shortUtc,
  staticMapUrl,
} from "@/lib/ais-map"
import type { VesselBrief } from "@talasa/shared"
import { entityGraphSchema } from "@talasa/shared"
import { Document, Image, Page, Text, View } from "@react-pdf/renderer"
import { buildRelationships, ROLE_LABEL } from "../build-relationships"
import {
  formatDriver,
  formatHistoryKind,
  formatSanctionCategory,
  formatSanctionsLists,
  formatSanctionsStatus,
  humanizeToken,
  isDirectSanction,
} from "../vessel-labels"
import {
  COLOR,
  Empty,
  Field,
  FieldGrid,
  Footer,
  Para,
  Section,
  styles,
  Table,
  Tags,
  Watermark,
} from "./atoms"
import { formatReportDate, orDash, severityLabel, verdictLabel } from "./format"

const VERDICT_COLOR: Record<VesselBrief["verdict"]["decision"], string> = {
  PROCEED: COLOR.ok,
  CAUTION: COLOR.warn,
  BLOCK: COLOR.danger,
}

const SANCTIONS_COLOR: Record<string, string> = {
  CONFIRMED: COLOR.danger,
  POSSIBLE: COLOR.warn,
  NO_MATCH: COLOR.ok,
}

const SEVERITY_COLOR: Record<string, string> = {
  blocking: COLOR.danger,
  strong: COLOR.warn,
  weak: COLOR.muted,
}

export function VesselBriefDocument({
  brief,
  graph,
}: {
  brief: VesselBrief
  graph: unknown
}) {
  const b = brief
  const id = b.identity
  return (
    <Document
      title={`Vessel Screening Report — IMO ${b.imo}`}
      author="Talasa"
      subject="Maritime Risk Intelligence — Confidential"
    >
      <Page size="A4" style={styles.page}>
        <Watermark />
        <Footer />

        <CoverHeader brief={b} />
        <OverviewSections brief={b} />
        <VesselSection brief={b} />
        {(id.detentionRate || id.parisMou || id.tokyoMou || b.inspections) && (
          <PscSection brief={b} />
        )}
        {b.history && b.history.entries.length > 0 && <HistorySection brief={b} />}
        <OwnershipSection brief={b} />
        <FleetSection brief={b} />
        <AisSection brief={b} />
        <RelationshipsSection graph={graph} />
        <DataCompletenessSection brief={b} />
      </Page>
    </Document>
  )
}

// ---- cover header -----------------------------------------------------------

function CoverHeader({ brief: b }: { brief: VesselBrief }) {
  const id = b.identity
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View>
          <Text
            style={{
              fontFamily: "Helvetica-Bold",
              fontSize: 11,
              letterSpacing: 1.5,
            }}
          >
            TALASA
          </Text>
          <Text
            style={{ fontSize: 7.5, color: COLOR.muted, letterSpacing: 0.5 }}
          >
            Maritime Risk Intelligence
          </Text>
        </View>
        <Text
          style={{
            fontSize: 7.5,
            letterSpacing: 1,
            color: COLOR.danger,
            borderWidth: 0.75,
            borderColor: COLOR.danger,
            borderRadius: 3,
            paddingVertical: 2,
            paddingHorizontal: 5,
          }}
        >
          CONFIDENTIAL
        </Text>
      </View>

      <Text
        style={{ fontFamily: "Helvetica-Bold", fontSize: 18, marginTop: 22 }}
      >
        Vessel Screening Report
      </Text>
      <Text style={{ fontSize: 12, marginTop: 3 }}>
        {orDash(id.name)}{" "}
        <Text style={{ color: COLOR.muted }}>· IMO {orDash(id.imo)}</Text>
      </Text>

      {/* verdict band */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 14,
          borderTopWidth: 0.75,
          borderBottomWidth: 0.75,
          borderColor: COLOR.line,
          paddingVertical: 8,
        }}
      >
        <View
          style={{
            borderWidth: 1,
            borderColor: VERDICT_COLOR[b.verdict.decision],
            borderRadius: 3,
            paddingVertical: 3,
            paddingHorizontal: 8,
            marginRight: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Helvetica-Bold",
              fontSize: 11,
              letterSpacing: 0.5,
              color: VERDICT_COLOR[b.verdict.decision],
            }}
          >
            {verdictLabel(b.verdict.decision).toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 11 }}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            {b.verdict.score}
          </Text>
          <Text style={{ color: COLOR.muted }}> / 100 risk score</Text>
        </Text>
      </View>

      <Text style={{ fontSize: 7.5, color: COLOR.faint, marginTop: 6 }}>
        Generated {formatReportDate(b.generatedAt)} · Report{" "}
        {orDash(b.reportVersion)} · Ref {orDash(b.screeningId)}
      </Text>
    </View>
  )
}

// ---- overview ---------------------------------------------------------------

function OverviewSections({ brief: b }: { brief: VesselBrief }) {
  return (
    <View>
      <Section title="Recommendation">
        <View style={styles.callout}>
          <Text>{orDash(b.recommendation)}</Text>
        </View>
      </Section>

      <Section title="Executive summary">
        <Para>{orDash(b.executiveSummary)}</Para>
      </Section>

      <Section title="Sanctions screening">
        <Text style={{ marginBottom: 6 }}>
          Status:{" "}
          <Text
            style={{
              fontFamily: "Helvetica-Bold",
              color: SANCTIONS_COLOR[b.sanctions.status] ?? COLOR.ink,
            }}
          >
            {formatSanctionsStatus(b.sanctions.status)}
          </Text>
        </Text>
        {b.sanctions.matches.length === 0 ? (
          <Empty>No sanctions matches.</Empty>
        ) : (
          <Table
            columns={[
              { header: "Entity", width: 3 },
              { header: "Classification", width: 2.2 },
              { header: "List", width: 3 },
              { header: "Matched on", width: 1.8 },
              { header: "Score", width: 1 },
            ]}
            rows={b.sanctions.matches.map((m) => {
              // Directly sanctioned is the severe (red) case; linked / PEP / POI is a softer note.
              const tint = isDirectSanction(m.category) ? COLOR.danger : COLOR.ink
              const classification = formatSanctionCategory(m.category) || (m.tier === "hit" ? "Hit" : "Review")
              return [
                [m.entity, tint] as [string, string],
                [classification, tint] as [string, string],
                formatSanctionsLists(m.datasets, m.list),
                humanizeToken(m.matchField),
                `${Math.round(m.score * 100)}%`,
              ]
            })}
          />
        )}
        {b.sanctions.narrative ? (
          <Para muted>{b.sanctions.narrative}</Para>
        ) : null}
      </Section>

      <Section title="Predictive assessment">
        <Para>{orDash(b.prediction)}</Para>
        <Tags items={b.verdict.drivers.map(formatDriver)} />
      </Section>

      <Section title="Risk signals">
        {b.signals.length === 0 ? (
          <Empty>None identified.</Empty>
        ) : (
          <View>
            {b.signals.map((s, i) => (
              <View
                key={`${s.kind}-${i}`}
                style={{ flexDirection: "row", marginBottom: 4 }}
                wrap={false}
              >
                <Text
                  style={{
                    width: 62,
                    fontFamily: "Helvetica-Bold",
                    fontSize: 8,
                    color: SEVERITY_COLOR[s.severity] ?? COLOR.muted,
                  }}
                >
                  {severityLabel(s.severity)}
                </Text>
                <Text style={{ flex: 1 }}>{s.detail}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </View>
  )
}

// ---- vessel particulars -----------------------------------------------------

function VesselSection({ brief: b }: { brief: VesselBrief }) {
  const id = b.identity
  return (
    <Section title="Vessel particulars">
      <FieldGrid>
        <Field label="Name" value={orDash(id.name)} />
        <Field label="IMO" value={orDash(id.imo)} />
        <Field label="MMSI" value={orDash(id.mmsi)} />
        <Field label="Call sign" value={orDash(id.callSign)} />
        <Field label="Type" value={orDash(id.type)} />
        <Field
          label="Flag"
          value={
            id.flag ? `${id.flag}${id.riskyFlag ? " (high-risk)" : ""}` : "—"
          }
        />
        <Field label="Class society" value={orDash(id.classSociety)} />
        <Field label="Status" value={orDash(id.status)} />
        <Field
          label="Gross tonnage"
          value={orDash(id.grossTonnage?.toLocaleString())}
        />
        <Field
          label="Deadweight"
          value={orDash(id.deadweight?.toLocaleString())}
        />
        <Field label="Year built" value={orDash(id.yearBuilt)} />
      </FieldGrid>
    </Section>
  )
}

function PscSection({ brief: b }: { brief: VesselBrief }) {
  const id = b.identity
  const insp = b.inspections
  return (
    <Section title="Port State Control & inspections">
      <FieldGrid>
        <Field label="Detention rate" value={orDash(id.detentionRate)} />
        <Field label="Paris MoU" value={orDash(id.parisMou)} />
        <Field label="Tokyo MoU" value={orDash(id.tokyoMou)} />
      </FieldGrid>
      {insp ? (
        <View style={{ marginTop: 8 }}>
          <Text style={{ marginBottom: 6 }}>
            {insp.total} inspection{insp.total === 1 ? "" : "s"} on record
            {insp.detentions > 0 ? (
              <Text style={{ color: COLOR.danger }}>
                {" "}
                · {insp.detentions} detention{insp.detentions === 1 ? "" : "s"}
              </Text>
            ) : null}
            {insp.deficiencies > 0 ? (
              <Text style={{ color: COLOR.muted }}> · {insp.deficiencies} deficiencies</Text>
            ) : null}
          </Text>
          {insp.records.length > 0 ? (
            <Table
              columns={[
                { header: "Authority", width: 2.4 },
                { header: "Port", width: 2.4 },
                { header: "Date", width: 1.6 },
                { header: "Def.", width: 1 },
                { header: "Detained", width: 1.4 },
              ]}
              rows={insp.records.map((r) => [
                orDash(r.authority),
                orDash(r.port),
                orDash(r.date),
                r.deficiencies == null ? "—" : String(r.deficiencies),
                r.detained ? (["Yes", COLOR.danger] as [string, string]) : "No",
              ])}
            />
          ) : null}
        </View>
      ) : null}
    </Section>
  )
}

// ---- ship history -----------------------------------------------------------

function HistorySection({ brief: b }: { brief: VesselBrief }) {
  const h = b.history
  if (!h) return null
  const changed = [
    h.flagChanges > 0 ? `Flag changed ${h.flagChanges}×` : null,
    h.nameChanges > 0 ? `Renamed ${h.nameChanges}×` : null,
  ].filter((s): s is string => s !== null)
  return (
    <Section title="Ship history">
      {changed.length > 0 ? (
        <Text style={{ marginBottom: 6, color: COLOR.warn }}>{changed.join("  ·  ")}</Text>
      ) : null}
      <Table
        columns={[
          { header: "Change", width: 2 },
          { header: "Value", width: 4 },
          { header: "Since", width: 1.6 },
        ]}
        rows={h.entries.map((e) => [
          formatHistoryKind(e.kind),
          orDash(e.value),
          orDash(e.from),
        ])}
      />
    </Section>
  )
}

// ---- ownership --------------------------------------------------------------

function OwnershipSection({ brief: b }: { brief: VesselBrief }) {
  const isOwner = (role: string) => /owner/i.test(role)
  const sorted = [...b.companies].sort(
    (a, c) => Number(isOwner(c.role)) - Number(isOwner(a.role))
  )
  const inferred = b.inferredOwnership ?? null
  const flags = inferred?.flags ?? []
  return (
    <Section title="Ownership">
      {flags.length > 0 ? <UndisclosedOwnershipNote flags={flags} /> : null}
      {sorted.length === 0 && flags.length === 0 ? (
        <Empty>No legal entities found.</Empty>
      ) : sorted.length === 0 ? null : (
        <View>
          {sorted.map((co, i) => (
            <View
              key={`${co.companyImo ?? co.name}-${i}`}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottomWidth: 0.5,
                borderBottomColor: COLOR.lineSoft,
              }}
              wrap={false}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Text
                  style={{ fontFamily: "Helvetica-Bold", lineHeight: 1.35 }}
                >
                  {orDash(co.name)}
                </Text>
                {co.sanctioned ? (
                  <Text
                    style={{
                      color: COLOR.danger,
                      fontFamily: "Helvetica-Bold",
                      fontSize: 8,
                      marginLeft: 6,
                    }}
                  >
                    · SANCTIONED
                  </Text>
                ) : null}
              </View>
              <Text
                style={{
                  color: COLOR.muted,
                  fontSize: 8.5,
                  lineHeight: 1.35,
                  textTransform: "capitalize",
                  marginTop: 1,
                }}
              >
                {co.role}
              </Text>
              {co.address ? (
                <Text
                  style={{
                    color: COLOR.muted,
                    fontSize: 8.5,
                    lineHeight: 1.35,
                    marginTop: 1,
                  }}
                >
                  {co.address}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {inferred && inferred.entities.length > 0 ? (
        <InferredOwnershipTable inferred={inferred} />
      ) : null}
    </Section>
  )
}

/** Amber risk note for undisclosed/unknown registry ownership. */
function UndisclosedOwnershipNote({
  flags,
}: {
  flags: NonNullable<VesselBrief["inferredOwnership"]>["flags"]
}) {
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: COLOR.warn,
        paddingLeft: 10,
        paddingVertical: 2,
        marginBottom: 10,
      }}
      wrap={false}
    >
      <Text style={{ fontFamily: "Helvetica-Bold", color: COLOR.warn }}>
        Undisclosed registry ownership
      </Text>
      <Text style={{ color: COLOR.muted, marginTop: 1 }}>
        The party behind {flags.length === 1 ? "this role is" : "these roles are"}{" "}
        concealed on the registry — a shadow-fleet ownership-obfuscation tactic.
      </Text>
      {flags.map((f, i) => (
        <Text key={`${f.role}-${i}`} style={{ marginTop: 2 }}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{f.role}: </Text>
          <Text style={{ color: COLOR.warn }}>{f.placeholder}</Text>
        </Text>
      ))}
    </View>
  )
}

/**
 * The optional inferred ownership-network table — an investigative hypothesis,
 * clearly disclaimed. It never overrides the registry ownership above.
 */
function InferredOwnershipTable({
  inferred,
}: {
  inferred: NonNullable<VesselBrief["inferredOwnership"]>
}) {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <View style={{ marginTop: 12 }} wrap={false}>
      <Text
        style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5, marginBottom: 2 }}
      >
        Inferred ownership network
      </Text>
      <Text style={{ color: COLOR.muted, fontSize: 8, marginBottom: 6 }}>
        Inferred from sanctions-list evidence per our investigation — a
        hypothesis, not registry-confirmed ownership. The registered
        owner/manager remains undisclosed.
      </Text>
      {inferred.summary ? <Para muted>{inferred.summary}</Para> : null}
      <Table
        columns={[
          { header: "Entity", width: 2.6 },
          { header: "Role as described", width: 2.6 },
          { header: "Signal strength", width: 4.8 },
        ]}
        rows={inferred.entities.map((e) => [
          orDash(e.name),
          orDash(e.role),
          `${cap(e.strength)} — ${e.signal}`,
        ])}
      />
    </View>
  )
}

// ---- sister fleet -----------------------------------------------------------

function FleetSection({ brief: b }: { brief: VesselBrief }) {
  const { fleet } = b
  if (fleet.companies.length === 0 && fleet.sisters.length === 0) {
    return (
      <Section title="Sister fleet">
        <Empty>No sister vessels found.</Empty>
      </Section>
    )
  }
  const sanctionedSisters = fleet.sisters.filter((s) => s.sanctioned).length
  return (
    <Section title="Sister fleet">
      {fleet.companies.length > 0 ? (
        <View style={{ marginBottom: 10 }}>
          <Text
            style={{
              fontFamily: "Helvetica-Bold",
              fontSize: 8.5,
              marginBottom: 4,
            }}
          >
            Fleet operators
          </Text>
          <Table
            columns={[
              { header: "Operator", width: 4 },
              { header: "Vessels", width: 1.4 },
              { header: "Sanctioned", width: 1.4 },
            ]}
            rows={fleet.companies.map((fc) => [
              orDash(fc.name),
              String(fc.vesselCount),
              fc.sanctionedCount > 0
                ? ([String(fc.sanctionedCount), COLOR.danger] as [
                    string,
                    string,
                  ])
                : "0",
            ])}
          />
        </View>
      ) : null}

      {fleet.sisters.length > 0 ? (
        <View>
          <Text
            style={{
              fontFamily: "Helvetica-Bold",
              fontSize: 8.5,
              marginBottom: 4,
            }}
          >
            Sister vessels{" "}
            <Text style={{ color: COLOR.muted, fontFamily: "Helvetica" }}>
              ({sanctionedSisters} of {fleet.sisters.length} screened
              sanctioned)
            </Text>
          </Text>
          <Table
            columns={[
              { header: "Name", width: 3 },
              { header: "IMO", width: 2 },
              { header: "Type", width: 2 },
              { header: "Flag", width: 2 },
              { header: "Status", width: 1.6 },
            ]}
            rows={fleet.sisters.map((s) => {
              const tint = s.sanctioned ? COLOR.danger : COLOR.ink
              return [
                [s.name ?? "Unnamed vessel", tint] as [string, string],
                orDash(s.imo),
                orDash(s.type),
                orDash(s.flag),
                s.sanctioned
                  ? (["Sanctioned", COLOR.danger] as [string, string])
                  : "—",
              ]
            })}
          />
        </View>
      ) : null}

      {fleet.truncated && fleet.note ? <Para muted>{fleet.note}</Para> : null}
    </Section>
  )
}

// ---- AIS behaviour ----------------------------------------------------------

function AisSection({ brief: b }: { brief: VesselBrief }) {
  const ais = b.ais
  if (!ais || !ais.available) {
    return (
      <Section title="AIS behaviour">
        <Empty>No AIS behavioural history was available for the analysed window.</Empty>
      </Section>
    )
  }
  const mapUrl = staticMapUrl(ais.events, { width: 640, height: 320 })
  const points = mappableEvents(ais.events)
  return (
    <Section title="AIS behaviour">
      <Para muted>{ais.summary}</Para>
      {ais.highRiskZoneActivity ? (
        <Para>
          <Text style={{ color: COLOR.danger, fontFamily: "Helvetica-Bold" }}>
            Activity detected in a known high-risk STS zone.
          </Text>
        </Para>
      ) : null}

      {mapUrl && points.length > 0 ? (
        <View style={{ marginTop: 6, marginBottom: 8 }}>
          <Image
            src={mapUrl}
            style={{
              width: "100%",
              height: 230,
              objectFit: "contain",
              borderWidth: 0.75,
              borderColor: COLOR.line,
              borderRadius: 3,
            }}
          />
          <View style={{ flexDirection: "row", marginTop: 5 }}>
            {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => (
              <Text key={k} style={{ fontSize: 7.5, color: KIND_COLOR[k], marginRight: 12 }}>
                ● <Text style={{ color: COLOR.muted }}>{KIND_LABEL[k]}</Text>
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {ais.events.length > 0 ? (
        <Table
          columns={[
            { header: "Type", width: 2 },
            { header: "Location", width: 3 },
            { header: "Window (UTC)", width: 3 },
            { header: "Detail", width: 2.4 },
          ]}
          rows={ais.events.map((e) => {
            const tint = e.highRiskArea ? COLOR.danger : COLOR.ink
            // `locationOneLine` may already include the sea (which is often the
            // same string as `highRiskArea`); only append when it adds something.
            const base = locationOneLine(e)
            const location =
              e.highRiskArea && !base.includes(e.highRiskArea)
                ? `${base} · ${e.highRiskArea}`
                : base
            return [
              [KIND_LABEL[e.kind], KIND_COLOR[e.kind]] as [string, string],
              [location, tint] as [string, string],
              `${shortUtc(e.startUtc)} → ${shortUtc(e.endUtc)}`,
              eventDetail(e) || "—",
            ]
          })}
        />
      ) : (
        <Empty>No behavioural events flagged.</Empty>
      )}
      {ais.truncated ? <Para muted>Some lower-priority events were omitted.</Para> : null}
    </Section>
  )
}

// ---- relationships (textual) ------------------------------------------------

function RelationshipsSection({ graph }: { graph: unknown }) {
  const parsed = entityGraphSchema.safeParse(graph)
  if (!parsed.success || parsed.data.nodes.length === 0) {
    return (
      <Section title="Relationships">
        <Empty>No related entities found.</Empty>
      </Section>
    )
  }
  const model = buildRelationships(parsed.data)
  if (!model.subject || model.groups.length === 0) {
    return (
      <Section title="Relationships">
        <Empty>No related entities found.</Empty>
      </Section>
    )
  }
  const subject = model.subject
  return (
    <Section title="Relationships">
      <Text style={{ marginBottom: 2 }}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{subject.label}</Text>
        {subject.data.imo ? (
          <Text style={{ color: COLOR.muted }}>
            {" "}
            · IMO {String(subject.data.imo)}
          </Text>
        ) : null}
        {subject.sanctioned ? (
          <Text style={{ color: COLOR.danger, fontFamily: "Helvetica-Bold" }}>
            {" "}
            · SANCTIONED
          </Text>
        ) : null}
      </Text>
      {model.sanctionedCount > 0 ? (
        <Text style={{ color: COLOR.danger, fontSize: 8.5, marginBottom: 6 }}>
          {model.sanctionedCount} sanctioned{" "}
          {model.sanctionedCount === 1 ? "entity" : "entities"} in this network
        </Text>
      ) : null}

      {model.groups.map((group) => (
        <View key={group.rel} style={{ marginTop: 6 }} wrap={false}>
          <Text
            style={{
              fontSize: 7.5,
              letterSpacing: 0.5,
              color: COLOR.muted,
              textTransform: "uppercase",
            }}
          >
            {group.label}
          </Text>
          {group.companies.map((company) => {
            const extra = company.roles
              .filter((r) => r !== company.primaryRole)
              .map((r) => ROLE_LABEL[r])
            const fleetNote =
              company.fleetSize > 0
                ? ` — fleet ${company.fleetSize}${company.sanctionedSisters > 0 ? `, ${company.sanctionedSisters} sanctioned` : ""}`
                : ""
            return (
              <Text key={company.node.id} style={{ marginTop: 1.5 }}>
                {company.node.label}
                {company.node.sanctioned ? (
                  <Text
                    style={{
                      color: COLOR.danger,
                      fontFamily: "Helvetica-Bold",
                    }}
                  >
                    {" "}
                    · SANCTIONED
                  </Text>
                ) : null}
                {extra.length > 0 ? (
                  <Text style={{ color: COLOR.muted }}>
                    {" "}
                    ({extra.join(", ")})
                  </Text>
                ) : null}
                <Text style={{ color: COLOR.muted }}>{fleetNote}</Text>
              </Text>
            )
          })}
        </View>
      ))}
    </Section>
  )
}

// ---- data completeness ------------------------------------------------------

function DataCompletenessSection({ brief: b }: { brief: VesselBrief }) {
  const { sourcesOk, gaps } = b.dataCompleteness
  if (sourcesOk.length === 0 && gaps.length === 0) return null
  return (
    <Section title="Data completeness">
      {sourcesOk.length > 0 ? (
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.fieldLabel}>Sources available</Text>
          <Text>{sourcesOk.map(humanizeToken).join(" · ")}</Text>
        </View>
      ) : null}
      {gaps.length > 0 ? (
        <View>
          <Text style={styles.fieldLabel}>Data gaps</Text>
          <Text style={{ color: COLOR.muted }}>
            {gaps.map(humanizeToken).join(" · ")}
          </Text>
        </View>
      ) : null}
    </Section>
  )
}
