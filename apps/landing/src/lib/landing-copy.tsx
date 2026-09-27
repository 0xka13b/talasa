/**
 * Every string the landing page renders, in one bundle.
 *
 * `components/landing-page.tsx` is purely presentational and takes a
 * `LandingCopy` — so `/` (English) and `/r` (Russian) render the exact same
 * markup from two bundles. The list-shaped English content still lives in
 * `lib/home-content.ts`, which the markdown representation also consumes;
 * this file adds the chrome strings that used to be inline in the page.
 *
 * Headings that carry presentational markup (line breaks, italic spans) are
 * typed as `ReactNode` so a translation can move the emphasis where the
 * target language needs it.
 */

import type { ReactNode } from "react";

import {
  ASK_AGENT,
  ASSURANCE_DISCLAIMER,
  ASSURANCE_ITEMS,
  AUDIENCE,
  FAQ_ITEMS,
  INDUSTRIES,
  USE_CASES,
  type AssuranceItem,
  type AudienceGroup,
  type Industry,
  type SignalLevel,
  type UseCase,
} from "@/lib/home-content";
import { LEGAL_LINKS } from "@/components/legal-layout";
import { WAITLIST_SERVICES, type WaitlistErrorCode } from "@/lib/waitlist";
import type { FaqItem } from "@/lib/seo";

export type AskAgentDriver = { n: string; driver: string; detail: string };

export type AskAgentContent = {
  kicker: string;
  title: string;
  points: readonly string[];
  note: string;
  sample: {
    subject: string;
    question: string;
    thought: string;
    verdict: string;
    answer: string;
    drivers: readonly AskAgentDriver[];
  };
};

export type NavLink = { label: string; href: string };

export type LandingCopy = {
  /** BCP-47 language tag; also tags waitlist submissions with their source page. */
  locale: string;
  skipToContent: string;
  topBar: {
    nav: readonly NavLink[];
    platformLong: string;
    platformShort: string;
    demoLong: string;
    demoShort: string;
  };
  news: { headline: string; cta: string };
  hero: {
    title: ReactNode;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
  };
  industries: { heading: string; items: readonly Industry[] };
  problem: { heading: ReactNode; paragraphs: readonly string[] };
  useCases: { heading: ReactNode; items: readonly UseCase[] };
  /** Labels baked into the five report-card layouts. */
  report: {
    corporateNetwork: string;
    beneficialOwner: string;
    unresolved: string;
    sanctionLinked: string;
    soleVessel: string;
    soleVesselNote: string;
    ismManager: string;
    ismManagerNote: string;
    fromTheReport: string;
    medianWaitTrend: string;
    rateTrend: string;
    severity: Record<SignalLevel, string>;
  };
  askAgent: AskAgentContent & {
    header: string;
    topDrivers: string;
    composerPlaceholder: string;
    composerLabel: string;
    composerSubmitLabel: string;
  };
  audience: { heading: ReactNode; groups: readonly AudienceGroup[] };
  assurance: {
    heading: ReactNode;
    items: readonly AssuranceItem[];
    disclaimer: string;
  };
  faq: { heading: ReactNode; lead: string; items: readonly FaqItem[] };
  cta: {
    heading: ReactNode;
    lead: string;
    fields: {
      email: { label: string; placeholder: string };
      company: { label: string; placeholder: string };
      desk: { label: string; placeholder: string };
      vessel: { label: string; placeholder: string };
      service: { label: string; placeholder: string };
    };
    /** Option values are always the English canon — only the label is localised. */
    services: readonly { value: string; label: string }[];
    submit: string;
    submitting: string;
    note: string;
    errors: { missingEmail: string; unexpected: string } & Record<WaitlistErrorCode, string>;
    success: {
      badgeNew: string;
      badgeAlready: string;
      headlineNew: string;
      headlineAlready: string;
      body: string;
    };
  };
  footer: {
    solutionsTitle: string;
    solutionLinks: readonly NavLink[];
    legalTitle: string;
    legalLinks: readonly { to: string; label: string }[];
    contactTitle: string;
    copyright: string;
    disclaimer: string;
  };
};

export const EN_LANDING_COPY: LandingCopy = {
  locale: "en",
  skipToContent: "Skip to content",
  topBar: {
    nav: [
      { label: "Solutions", href: "#solutions" },
      { label: "Who it's for", href: "#audience" },
      { label: "Why Talasa", href: "#why" },
      { label: "FAQ", href: "#faq" },
      { label: "Contact", href: "#contact" },
    ],
    platformLong: "Go to platform",
    platformShort: "Platform",
    demoLong: "Request demo",
    demoShort: "Demo",
  },
  news: {
    headline: "Shadow-fleet designations keep expanding across OFAC, EU & UK",
    cta: "See a real screening",
  },
  hero: {
    title: (
      <>
        Know the vessel
        <br />
        <span className="text-muted-foreground">
          <span className="text-foreground italic">before</span> the money moves
        </span>
      </>
    ),
    lead: "Maritime risk intelligence for the desks that carry the risk — turning ownership, behaviour, sanctions exposure and dark-fleet signals into a clear, defensible vessel screening decision. The platform is live — founding access is open.",
    primaryCta: "Request a demo",
    secondaryCta: "Explore",
  },
  industries: { heading: "Designed for desks in", items: INDUSTRIES },
  problem: {
    heading: (
      <>
        The risk has moved.
        <br />
        <span className="text-muted-foreground">Your tooling hasn't.</span>
      </>
    ),
    paragraphs: [
      'Sanctions exposure, shadow fleets and opaque ownership now sit inside everyday trade finance, charter and insurance decisions. A "clean" counterparty can pass a name screen while its only asset is a directly sanctioned tanker. The cost of being wrong is no longer a slow audit finding — it is a fine, a frozen account, a torched relationship.',
      "Data vendors show you risks. Talasa delivers the decision — one clear, defensible answer per vessel, fast enough to use before the deal closes, structured enough to hand to your auditor.",
    ],
  },
  useCases: {
    heading: (
      <>
        Five answers,
        <br />
        <span className="text-muted-foreground">one platform.</span>
      </>
    ),
    items: USE_CASES,
  },
  report: {
    corporateNetwork: "Corporate network",
    beneficialOwner: "Beneficial owner",
    unresolved: "· unresolved",
    sanctionLinked: " · sanction-linked",
    soleVessel: "Sole vessel — AURA MARIS",
    soleVesselNote: " · designated on 5+ lists",
    ismManager: "ISM manager — Astute Maritime",
    ismManagerNote: " · person of interest",
    fromTheReport: "From the report",
    medianWaitTrend: "Median wait · 14 days",
    rateTrend: "TD3C · 10 weeks",
    severity: { alert: "HIGH", warn: "MED", ok: "LOW" },
  },
  askAgent: {
    ...ASK_AGENT,
    header: "Ask Agent · live dossier",
    topDrivers: "Top risk drivers",
    composerPlaceholder: "Ask about this subject…",
    composerLabel: "Ask the agent about this subject (opens the demo request form)",
    composerSubmitLabel: "Send — request a demo to ask the agent",
  },
  audience: {
    heading: (
      <>
        Different desks. <span className="text-muted-foreground">Same answer.</span>
      </>
    ),
    groups: AUDIENCE,
  },
  assurance: {
    heading: (
      <>
        Built to be trusted.{" "}
        <span className="text-muted-foreground">By the desks that carry the consequences.</span>
      </>
    ),
    items: ASSURANCE_ITEMS,
    disclaimer: ASSURANCE_DISCLAIMER,
  },
  faq: {
    heading: (
      <>
        Maritime risk,
        <br />
        <span className="text-muted-foreground">in plain English.</span>
      </>
    ),
    lead: "The questions desks ask before they screen a vessel, run counterparty due diligence, or act on a dark-fleet alert.",
    items: FAQ_ITEMS,
  },
  cta: {
    heading: (
      <>
        Be first on your fleet.
        <br />
        <span className="text-muted-foreground">Get founding access.</span>
      </>
    ),
    lead: "We're onboarding a small group of founding desks. Tell us what you cover and we'll set you up with a demo account — capped reports, uncapped AI agent — and a working session on vessels you actually deal with.",
    fields: {
      email: { label: "Work email", placeholder: "risk@yourdesk.com" },
      company: { label: "Company", placeholder: "Your firm" },
      desk: { label: "Desk / role", placeholder: "Trade finance, P&I, charter, …" },
      vessel: {
        label: "First vessel you'd screen — we'll run it in your session",
        placeholder: "IMO or name (optional)",
      },
      service: { label: "Most interested in", placeholder: "Select a solution…" },
    },
    services: WAITLIST_SERVICES.map((s) => ({ value: s, label: s })),
    submit: "Request a demo",
    submitting: "Sending…",
    note: "We'll reach out as we open access · NDA on request",
    errors: {
      missingEmail: "Please enter your work email.",
      unexpected: "Something went wrong. Please try again in a moment.",
      invalid_email: "Please enter a valid work email.",
      disposable_email: "Please use your work email — temporary addresses aren't accepted.",
      storage_failed: "Something went wrong saving your request. Please try again.",
    },
    success: {
      badgeNew: "Request received",
      badgeAlready: "Request already in",
      headlineNew: "Thanks — your Talasa demo request is in.",
      headlineAlready: "You've already requested a demo — we have your request on file.",
      body: "We'll reach out from access@example.com as we open founding access. NDA available on request.",
    },
  },
  footer: {
    solutionsTitle: "Solutions",
    solutionLinks: [
      { label: "Vessel Screening", href: "#vessel-screening" },
      { label: "Counterparty DD", href: "#counterparty-dd" },
      { label: "Port Intelligence", href: "#port-intelligence" },
      { label: "Market Brief", href: "#market-brief" },
    ],
    legalTitle: "Legal",
    legalLinks: LEGAL_LINKS,
    contactTitle: "Contact",
    copyright: "© 2026 Talasa Labs · Demos open",
    disclaimer: "Decision support · Human review required",
  },
};
