/**
 * Central SEO config + structured-data helpers for the Talasa landing page.
 * Update SITE_URL here if the canonical domain ever changes.
 */

export const SITE_URL = "https://example.com";
export const SITE_NAME = "Talasa";

/** ~57 chars — brand + primary head terms. */
export const SITE_TITLE = "Talasa — Maritime Risk Intelligence & Vessel Screening";

/** ~160 chars — audience + value + head terms. */
export const SITE_DESCRIPTION =
  "Live vessel risk & sanctions screening for banks, insurers, traders and brokers — ownership, behaviour and dark-fleet signals fused into auditable verdicts.";

export const OG_IMAGE = `${SITE_URL}/og.png`;

/** The Russian landing page. Unlisted: no nav link, no switcher, shared by URL. */
export const RU_LANDING_PATH = "/r";

/**
 * Paths that must never be indexed — unlisted pages shared by direct link only.
 * Matched by `src/server.ts` (X-Robots-Tag) and mirrored by a `robots` meta tag
 * on the route itself. Deliberately absent from robots.txt and sitemap.xml:
 * listing them there would advertise the URLs and stop crawlers from ever
 * reading the noindex directive.
 */
export const UNLISTED_PATHS: ReadonlyArray<string> = [RU_LANDING_PATH];

/** Value sent as both the `robots` meta tag and the `X-Robots-Tag` header. */
export const NOINDEX_DIRECTIVE = "noindex, nofollow, noarchive, nosnippet, noimageindex";

const matchesPath = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** True when the pathname is an unlisted page (exact match or a sub-path). */
export function isUnlistedPath(pathname: string): boolean {
  return UNLISTED_PATHS.some((base) => matchesPath(pathname, base));
}

/** BCP-47 tag for the `<html lang>` attribute of the page being rendered. */
export function langForPath(pathname: string): "en" | "ru" {
  return matchesPath(pathname, RU_LANDING_PATH) ? "ru" : "en";
}

export const SITE_KEYWORDS = [
  "maritime risk intelligence",
  "vessel screening",
  "vessel sanctions screening",
  "sanctions screening",
  "maritime compliance software",
  "dark fleet",
  "shadow fleet",
  "vessel due diligence",
  "counterparty due diligence",
  "ship-to-ship transfer detection",
  "AIS spoofing detection",
  "OFAC EU UK UN sanctions",
  "vessel risk score",
  "maritime AI copilot",
].join(", ");

export type FaqItem = { q: string; a: string };

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

/** Build the full JSON-LD @graph for the homepage. */
export function buildHomeJsonLd(faqItems: ReadonlyArray<FaqItem>) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo-variant.png`,
        description: SITE_DESCRIPTION,
        slogan: "Maritime risk intelligence for the desks that carry the consequences.",
        email: "hello@example.com",
        contactPoint: {
          "@type": "ContactPoint",
          email: "hello@example.com",
          contactType: "sales",
          availableLanguage: "en",
        },
        knowsAbout: [
          "vessel sanctions screening",
          "maritime sanctions compliance",
          "dark fleet detection",
          "shadow fleet",
          "ship-to-ship transfer detection",
          "AIS spoofing",
          "counterparty due diligence",
          "corporate network screening",
          "OFAC, EU, UK and UN sanctions regimes",
        ],
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": ORG_ID },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Maritime Risk & Sanctions Compliance",
        operatingSystem: "Web",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        publisher: { "@id": ORG_ID },
        audience: {
          "@type": "BusinessAudience",
          name: "Banks, insurers, traders, brokers and maritime compliance teams",
        },
        featureList: [
          "Vessel Risk Screening (OFAC, EU, UK, UN and 20+ lists, scored 0–100, incl. dark-fleet & STS behaviour)",
          "Counterparty & Charter Due Diligence (corporate-network screening)",
          "Port Call & Congestion Intelligence",
          "Fixture & Market Intelligence",
          "Ask Agent — embedded analyst AI copilot with sourced output",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

/** Renders a JSON-LD <script>. Safe: the payload is our own structured data. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
