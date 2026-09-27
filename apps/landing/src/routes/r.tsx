/**
 * Russian landing page — unlisted by design.
 *
 * There is no link to this route from anywhere on the site and no language
 * switcher: the URL is shared directly. Keep it that way, and keep it out of
 * `sitemap.xml`, `llms.txt` and the footer nav.
 *
 * De-indexing is belt-and-braces:
 *   - the `robots` meta below overrides the root route's `index, follow`
 *     (TanStack's head merge lets the deepest match win per meta name)
 *   - `src/server.ts` sends `X-Robots-Tag` on the response, which also covers
 *     crawlers that never execute or parse the document
 * No canonical, no keywords and no JSON-LD here — nothing that invites indexing.
 */

import { LandingPage } from "@/components/landing-page";
import { RU_LANDING_COPY } from "@/lib/landing-copy-ru";
import { NOINDEX_DIRECTIVE, SITE_URL } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

const RU_TITLE = "Talasa — морская риск-аналитика и скрининг судов";

const RU_DESCRIPTION =
  "Скрининг судов и санкционных рисков для банков, страховщиков, трейдеров и брокеров: собственность, поведение и сигналы теневого флота — в одном обоснованном вердикте.";

export const Route = createFileRoute("/r")({
  head: () => ({
    meta: [
      { title: RU_TITLE },
      { name: "description", content: RU_DESCRIPTION },
      { name: "robots", content: NOINDEX_DIRECTIVE },
      { name: "googlebot", content: NOINDEX_DIRECTIVE },
      // Link previews (messengers, mail clients) still resolve — they don't index.
      { property: "og:locale", content: "ru_RU" },
      { property: "og:url", content: `${SITE_URL}/r` },
      { property: "og:title", content: RU_TITLE },
      { property: "og:description", content: RU_DESCRIPTION },
      { name: "twitter:title", content: RU_TITLE },
      { name: "twitter:description", content: RU_DESCRIPTION },
    ],
  }),
  component: LandingRu,
});

function LandingRu() {
  return <LandingPage copy={RU_LANDING_COPY} />;
}
