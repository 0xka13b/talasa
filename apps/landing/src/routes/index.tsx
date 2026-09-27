import { LandingPage } from "@/components/landing-page";
import { EN_LANDING_COPY } from "@/lib/landing-copy";
import { FAQ_ITEMS } from "@/lib/home-content";
import {
  buildHomeJsonLd,
  JsonLd,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "keywords", content: SITE_KEYWORDS },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <LandingPage copy={EN_LANDING_COPY} jsonLd={<JsonLd data={buildHomeJsonLd(FAQ_ITEMS)} />} />
  );
}
