/**
 * Markdown representation of the homepage, served to agents that send
 * `Accept: text/markdown`. Built from the same structured copy the React page
 * renders (`lib/home-content.ts`) so the two stay in sync.
 */

import {
  ASK_AGENT,
  ASSURANCE_DISCLAIMER,
  ASSURANCE_ITEMS,
  AUDIENCE,
  FAQ_ITEMS,
  INDUSTRIES,
  USE_CASES,
} from "@/lib/home-content";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";

/** Render the homepage as a single markdown document. */
export function renderHomeMarkdown(): string {
  const lines: string[] = [];

  lines.push(`# ${SITE_TITLE}`);
  lines.push("");
  lines.push("> Know the vessel before the money moves.");
  lines.push("");
  lines.push(SITE_DESCRIPTION);
  lines.push("");
  lines.push(
    "Talasa is maritime risk intelligence, live in production — turning the noise around " +
      "every ship (ownership, behaviour, sanctions exposure, dark-fleet signals, port history) " +
      "into a clear, defensible vessel and sanctions screening decision for the desks that " +
      "carry the risk. Founding access is open.",
  );
  lines.push("");
  lines.push("- **Coverage:** Global fleet");
  lines.push("- **Sanctions lists:** OFAC · EU · UK · UN + 20 more");
  lines.push("- **Sources:** Live AIS · Equasis · MoU registries");
  lines.push("");
  lines.push("Designed for desks in:");
  for (const d of INDUSTRIES) {
    lines.push(`- **${d.name}:** ${d.use}`);
  }
  lines.push("");

  lines.push("## Why this exists");
  lines.push("");
  lines.push("**The risk has moved. Your tooling hasn't.**");
  lines.push("");
  lines.push(
    "Sanctions exposure, shadow fleets and opaque ownership now sit inside everyday trade " +
      "finance, charter and insurance decisions. The cost of being wrong is no longer a slow " +
      "audit finding — it is a fine, a frozen account, a torched relationship.",
  );
  lines.push("");
  lines.push(
    "Data vendors show you risks. Talasa delivers the decision — one clear, defensible " +
      "answer per vessel, fast enough to use before the deal closes, structured enough to hand " +
      "to your auditor.",
  );
  lines.push("");

  lines.push("## Solutions");
  lines.push("");
  for (const uc of USE_CASES) {
    lines.push(`### ${uc.num} · ${uc.title}`);
    lines.push("");
    lines.push(uc.lead);
    lines.push("");
    lines.push(`**Who it's for:** ${uc.buyers.join(", ")}`);
    lines.push("");
    lines.push("**What you get:**");
    for (const outcome of uc.outcomes) lines.push(`- ${outcome}`);
    lines.push("");
    lines.push(`_${uc.promise}_`);
    lines.push("");
  }

  lines.push(`## ${ASK_AGENT.kicker}`);
  lines.push("");
  lines.push(ASK_AGENT.title);
  lines.push("");
  for (const point of ASK_AGENT.points) lines.push(`- ${point}`);
  lines.push("");
  lines.push(`_${ASK_AGENT.note}._`);
  lines.push("");

  lines.push("## Who it's for");
  lines.push("");
  lines.push("Different desks. Same answer.");
  lines.push("");
  for (const group of AUDIENCE) {
    lines.push(`### ${group.who}`);
    lines.push("");
    lines.push(group.headline);
    lines.push("");
    for (const point of group.points) lines.push(`- ${point}`);
    lines.push("");
  }

  lines.push("## How we're building it");
  lines.push("");
  for (const item of ASSURANCE_ITEMS) {
    lines.push(`- **${item.t}** — ${item.d}`);
  }
  lines.push("");
  lines.push(`> ${ASSURANCE_DISCLAIMER}`);
  lines.push("");

  lines.push("## FAQ");
  lines.push("");
  for (const item of FAQ_ITEMS) {
    lines.push(`### ${item.q}`);
    lines.push("");
    lines.push(item.a);
    lines.push("");
  }

  lines.push("## Request a demo");
  lines.push("");
  lines.push("Be first on your fleet. Get founding access.");
  lines.push("");
  lines.push(
    "We're onboarding a small group of founding desks. Tell us what you cover and we'll set " +
      "you up with a demo account — capped reports, uncapped AI agent — and a working session " +
      "on vessels you actually deal with.",
  );
  lines.push("");
  lines.push(`Request a demo at ${SITE_URL}/#contact · NDA on request.`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`© 2026 ${SITE_NAME} Labs · Demos open · Decision support · Human review required`);
  lines.push("");

  return lines.join("\n");
}
