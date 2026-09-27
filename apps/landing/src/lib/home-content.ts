/**
 * Single source of truth for the homepage's structured copy.
 *
 * Consumed by both the React page (`routes/index.tsx`) and the markdown
 * representation served to agents (`lib/home-markdown.ts`), so the two never
 * drift. Prose-only headings that carry presentational markup (line breaks,
 * italic spans) stay in the page; everything list-shaped lives here.
 */

import type { FaqItem } from "@/lib/seo";

export type Industry = { name: string; use: string };

/** Industry strip under the hero: who it's for + what they use Talasa for. */
export const INDUSTRIES: readonly Industry[] = [
  {
    name: "Trade finance",
    use: "Screen vessels, owners and counterparties before issuing an LC or releasing payment.",
  },
  {
    name: "Marine insurance",
    use: "Vessel-level risk at quote and renewal, with behavioural change flagged across the book.",
  },
  {
    name: "Commodity trading",
    use: "Pre-fixture screening and a counterparty brief before the cargo moves.",
  },
  {
    name: "Shipbroking",
    use: "Counterparty briefs and a weekly market read you can share with clients.",
  },
  {
    name: "Charter desks",
    use: "See who's really on the other side of the fixture before you sign.",
  },
  {
    name: "Compliance & sanctions",
    use: "Auditable screening across OFAC, EU, UK, UN and 20+ lists with reasoning your auditor can read.",
  },
];

/** The embedded analyst copilot, shown as a platform strip under the solutions. */
export const ASK_AGENT = {
  kicker: "Platform · Ask Agent",
  title: "The analyst's copilot, embedded in every dossier.",
  points: [
    "Works on the live dossier — “Summarise the risk verdict.” “Walk me through the corporate network.” Answered in place.",
    "Structured, sourced output: drivers, tables and citations — not a chat toy.",
    "Accelerates, never replaces: high-stakes calls always reach a person; the agent documents the reasoning.",
  ],
  note: "Uncapped in every demo account",
  /** Condensed from a real in-product exchange on the JIN HUI dossier. */
  sample: {
    subject: "JIN HUI · IMO 9430272",
    question: "Summarise the risk verdict and top drivers.",
    thought: "Reading the dossier — overview · sanctions · ownership · AIS",
    verdict: "Risk verdict: BLOCK · score 100/100",
    answer:
      "The vessel is directly designated on multiple sanctions lists — EU, Switzerland, Ukraine, UK and Canada — for transporting Russian crude in breach of the G7/EU embargo and price-cap regime.",
    drivers: [
      {
        n: "01",
        driver: "Direct sanctions designation",
        detail:
          "The vessel itself — not an affiliated entity — is listed by at least five jurisdictions for Russian-oil transport violations.",
      },
      {
        n: "02",
        driver: "False / disclaimed Syrian flag",
        detail:
          "Syria has disclaimed the registry before the IMO — effectively stateless under UNCLOS.",
      },
      {
        n: "03",
        driver: "Undisclosed ownership & management",
        detail:
          "Registered owner, commercial and ISM manager all unknown — blocks beneficial-ownership screening.",
      },
    ],
  },
} as const;

/** Severity levels mapped to the design system's signal colours. */
export type SignalLevel = "ok" | "warn" | "alert";

export type ReportSignal = { level: SignalLevel; text: string };
export type ReportRow = { label: string; value: string };

/**
 * A sample of the product output for a use case, rendered in the right-hand
 * panel of each solution card. The flagship Vessel Screening card (01) and the
 * Counterparty DD card (02) are real cases taken from the production platform
 * (URSUS, IMO 1110084 · United Fuel Trading UFT Pte). The remaining cards use
 * illustrative samples.
 */
/**
 * Which of the five artifact layouts renders this report. Kept separate from
 * `kind` (a display label) so localised copy can translate the label without
 * changing which card is rendered.
 */
export type ReportLayout = "screening" | "counterparty" | "port" | "alerts" | "market";

export type UseCaseReport = {
  /** Chooses the card layout. */
  layout: ReportLayout;
  /** Small label for the report type, e.g. "Screening verdict". */
  kind: string;
  /** Reference / identifier line, e.g. "IMO 9298595" or "Week 26 · 2026". */
  ref: string;
  /** Primary subject, e.g. a vessel or counterparty name. */
  subject: string;
  /** Secondary descriptor, e.g. "Panama flag · Aframax tanker". */
  context: string;
  /** Headline status badge. */
  verdict: { label: string; level: SignalLevel };
  /** Key/value facts shown under the verdict. */
  rows: readonly ReportRow[];
  /** Ranked findings, each with a severity dot. */
  signals: readonly ReportSignal[];
  /** Closing reassurance line. */
  footnote: string;
  /**
   * Short excerpt of the report's plain-English reasoning, shown only where
   * the narrative itself is the proof (the flagship screening card).
   */
  narrative?: string;
  /**
   * Provenance line for real (non-illustrative) outputs, e.g. the date the
   * screening was actually run. Absent on fictional samples.
   */
  provenance?: string;
};

export type UseCase = {
  num: string;
  /** Anchor id for deep links (footer nav, llms.txt). */
  id: string;
  tag: string;
  title: string;
  lead: string;
  buyers: readonly string[];
  outcomes: readonly string[];
  promise: string;
  report: UseCaseReport;
};

export const USE_CASES: readonly UseCase[] = [
  {
    num: "01",
    id: "vessel-screening",
    tag: "Flagship",
    title: "Vessel Risk Screening",
    lead: "Search any vessel by name or IMO — scored, defensible go / no-go in minutes.",
    buyers: ["Banks & trade finance", "P&I and hull insurers", "Compliance teams"],
    outcomes: [
      "Score 0–100 with a Block / Caution / Clear decision",
      "Sanctions exposure ranked across OFAC, EU, UK, UN and 20+ lists",
      "One-click PDF export for the audit file",
    ],
    promise: "Clear · Caution · Block.",
    report: {
      layout: "screening",
      kind: "Screening verdict",
      ref: "IMO 1110084",
      subject: "URSUS",
      context: "Malta flag · crude oil tanker",
      verdict: { label: "Block", level: "alert" },
      rows: [
        { label: "Risk score", value: "100 / 100" },
        { label: "Screened against", value: "OFAC · EU · UK · UN · +20 lists" },
      ],
      signals: [
        {
          level: "alert",
          text: "Entity of interest — exporting Russian crude via dark activity and STS transfers",
        },
        {
          level: "alert",
          text: "15 sanctioned sister vessels across the linked fleet of 193 screened",
        },
        {
          level: "warn",
          text: "Registered ownership fully undisclosed — flagged as a risk signal in its own right",
        },
        { level: "warn", text: "STS transfers in high-risk areas near Black Sea export ports" },
        {
          level: "warn",
          text: "AIS dark activity consistent with price-cap evasion since March 2023",
        },
      ],
      footnote: "Full reasoning trail attached · one-click PDF export",
      narrative:
        "Entity of interest under the G7 / EU price-cap regime: since March 2023 the tanker has exported Russian crude using deceptive, high-risk practices — dark activity and STS transfers near Black Sea ports. Ownership is fully undisclosed and 15 sister vessels are tied to sanctions. Recommendation: block.",
      provenance: "Real screening · production platform · run 11 Jul 2026",
    },
  },
  {
    num: "02",
    id: "counterparty-dd",
    tag: "Counterparty",
    title: "Counterparty & Charter Due Diligence",
    lead: "We screen the network, not just the name — know who's really on the other side before you sign.",
    buyers: ["Brokers", "Operators", "Charter desks"],
    outcomes: [
      "Scored Accept / Review / Reject decision in minutes",
      "Shared-vessel corporate network and shell patterns exposed",
      "Declares what it could not find — unresolved ownership is a risk driver",
    ],
    promise: "Shorter sales cycle. Fewer surprises.",
    report: {
      layout: "counterparty",
      kind: "Counterparty brief",
      ref: "IMO 6413394",
      subject: "United Fuel Trading UFT Pte",
      context: "Sole-vessel owner · shell pattern",
      verdict: { label: "Reject", level: "alert" },
      rows: [
        { label: "Risk score", value: "70 / 100" },
        { label: "Beneficial owner", value: "Unresolved" },
      ],
      signals: [
        {
          level: "alert",
          text: "Sole vessel AURA MARIS directly designated on 5+ sanctions lists",
        },
        {
          level: "warn",
          text: "Company classified sanction-linked through its vessel designation",
        },
        {
          level: "warn",
          text: "ISM manager flagged as a person of interest · same-address pattern",
        },
        {
          level: "warn",
          text: "Beneficial ownership unresolved — declared as a risk driver in its own right",
        },
      ],
      footnote: "Declares what it could not find · written rationale attached",
      provenance: "Real case · production platform · run 11 Jul 2026",
    },
  },
  {
    num: "03",
    id: "port-intelligence",
    tag: "Operations",
    title: "Port Call & Congestion Intelligence",
    lead: "A daily read on where the cargo really is, and what that means for your voyage.",
    buyers: ["Operators", "Traders", "Voyage planners"],
    outcomes: [
      "Daily port briefings",
      "Anomalies and congestion flagged",
      "Trend-aware waiting times",
    ],
    promise: "Plan with reality, not the schedule.",
    report: {
      layout: "port",
      kind: "Port briefing",
      ref: "Fujairah · 28 Jun 2026",
      subject: "Fujairah Anchorage",
      context: "Daily brief · crude + products",
      verdict: { label: "Congestion: elevated", level: "warn" },
      rows: [
        { label: "Vessels waiting", value: "47 · +9 d/d" },
        { label: "Median wait", value: "3.2 days" },
      ],
      signals: [
        { level: "warn", text: "STS cluster forming — 6 tankers, 12nm offshore" },
        { level: "warn", text: "Wait time +38% vs 30-day trend" },
        { level: "ok", text: "Berth productivity within normal range" },
      ],
      footnote: "Updated daily · anomalies flagged automatically",
    },
  },
  {
    num: "04",
    id: "market-brief",
    tag: "Market",
    title: "Fixture & Market Intelligence",
    lead: "A weekly read of who is moving what, where — and where demand is shifting.",
    buyers: ["Brokers", "Charter desks", "Trading analysts"],
    outcomes: ["Weekly brief by segment", "Tonnage demand signals", "Movements you can act on"],
    promise: "From raw movement to a market view.",
    report: {
      layout: "market",
      kind: "Market brief",
      ref: "Week 26 · 2026",
      subject: "Tanker segment",
      context: "Weekly read · dirty + clean",
      verdict: { label: "VLCC rates firming", level: "ok" },
      rows: [
        { label: "TD3C", value: "WS 58 · +6" },
        { label: "Tonnage", value: "Tightening" },
      ],
      signals: [
        { level: "ok", text: "MEG→East demand up week-on-week" },
        { level: "warn", text: "Suez disruption reshaping clean flows" },
        { level: "ok", text: "Aframax Atlantic firm on tight lists" },
      ],
      footnote: "Movements you can act on · by segment",
    },
  },
];

export type AudienceGroup = {
  who: string;
  headline: string;
  points: readonly string[];
};

export const AUDIENCE: readonly AudienceGroup[] = [
  {
    who: "Banks & trade finance",
    headline: "Approve good trade. Decline the rest with a clean paper trail.",
    points: [
      "Sanctions and ownership exposure surfaced up front",
      "Defensible reasoning for every decision",
      "Faster turnaround on transaction review",
    ],
  },
  {
    who: "Insurers",
    headline: "Underwrite the fleet you actually have on cover.",
    points: [
      "Vessel-level risk profile at quote and renewal",
      "Behavioural change detection across the book",
      "Evidence trail when a claim turns into a dispute",
    ],
  },
  {
    who: "Traders & operators",
    headline: "Don't move cargo on a ship you wouldn't shake hands with.",
    points: [
      "Pre-fixture screening in seconds",
      "Counterparty brief before you sign",
      "Port and voyage reality, not the schedule",
    ],
  },
  {
    who: "Brokers & charter desks",
    headline: "Bring intelligence to the table your clients can't get elsewhere.",
    points: [
      "Counterparty briefs you can share",
      "Weekly market view by segment",
      "A reason for the client to call you first",
    ],
  },
];

export type AssuranceItem = { t: string; d: string };

export const ASSURANCE_ITEMS: readonly AssuranceItem[] = [
  {
    t: "Defensible by design",
    d: "Every answer comes with the reasoning behind it — written in plain English your auditor and your front office can both read.",
  },
  {
    t: "Built around human review",
    d: "High-stakes calls always reach a person. Talasa accelerates the analyst — it doesn't replace them.",
  },
  {
    t: "Discreet by default",
    d: "Early access, allowlisted desks, NDA on request. We treat your watchlist the way you treat it.",
  },
];

export const ASSURANCE_DISCLAIMER =
  "Talasa produces decision-support intelligence. It does not constitute legal sanctions advice. Final compliance decisions remain with the regulated entity.";

/** Targets the informational "what is…" queries; also powers FAQPage schema. */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    q: "What is vessel sanctions screening?",
    a: "Vessel sanctions screening checks a ship, its owners and counterparties against OFAC, EU, UK, UN and 20+ further sanctions lists, then layers in behavioural risk — ownership changes, AIS gaps, ship-to-ship transfers — to produce a defensible go/no-go decision before you finance, insure or charter the vessel.",
  },
  {
    q: "Is Talasa live today?",
    a: "Yes. The platform is live in production with real sanctions data (20+ source lists with live-dated matches), live AIS feeds and real dark-fleet cases. Founding desks get a demo account — capped reports, an uncapped AI agent — before converting to paid founding access.",
  },
  {
    q: "What is the Ask Agent copilot?",
    a: "Ask Agent is an embedded AI copilot that reads the full vessel or counterparty dossier and answers analyst questions in place, with structured, sourced output — drivers, tables and citations. It is human-in-the-loop by design: it accelerates the analyst and documents the reasoning, it does not replace them.",
  },
  {
    q: "What is the dark fleet (shadow fleet)?",
    a: "The dark fleet — also called the shadow fleet — is the group of tankers and cargo vessels that evade sanctions through tactics like AIS spoofing, frequent identity changes and ship-to-ship transfers. Talasa surfaces these behaviours as ranked, plain-English alerts.",
  },
  {
    q: "Who is Talasa for?",
    a: "Talasa is built for the desks that carry maritime risk: banks and trade finance, P&I and hull insurers, commodity traders, shipbrokers, charter desks, and sanctions and compliance teams.",
  },
  {
    q: "How is Talasa different from AIS vessel-tracking tools?",
    a: "AIS trackers tell you where a ship is. Talasa tells you whether to do business with it — turning ownership, behaviour, sanctions exposure and port history into one clear, auditable verdict per vessel.",
  },
  {
    q: "Does Talasa replace my compliance team?",
    a: "No. Talasa is decision-support intelligence that accelerates analysts and documents the reasoning. High-stakes calls still reach a person, and final compliance decisions remain with the regulated entity.",
  },
];
