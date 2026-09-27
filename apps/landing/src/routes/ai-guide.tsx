import { CONTACT_EMAIL, LegalLayout } from "@/components/legal-layout";
import { SITE_URL } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Talasa AI Guide — Using Generative AI in Talasa";
const DESCRIPTION =
  "How Talasa uses generative AI in its maritime risk intelligence — capabilities, accuracy and limitations, human oversight, acceptable use, and how your data is handled.";

export const Route = createFileRoute("/ai-guide")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/ai-guide` }],
  }),
  component: AiGuidePage,
});

function AiGuidePage() {
  return (
    <LegalLayout
      title="Talasa AI Guide"
      lastUpdated="July 1, 2026"
      intro={
        <p>
          Talasa uses generative AI to help you screen vessels and counterparties, surface risk
          signals, and turn raw maritime data into readable analysis faster. This guide explains
          what our AI features do, where their limits are, and what we expect from you when you rely
          on them. It supplements our <a href="/terms">Terms of Use</a> and{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      }
    >
      <h2>1. Overview and purpose</h2>
      <p>
        Some Talasa features are powered by large language models and related AI systems, run
        through established providers. These systems operate over Talasa’s own data and domain
        knowledge, licensed and open-source intelligence (OSINT), and — where you provide them —
        your own inputs, to generate summaries, explanations, and suggested next steps. AI is one
        input into a workflow that is designed around human review.
      </p>

      <h2>2. How Talasa uses AI</h2>
      <ul>
        <li>
          <strong>Risk summaries</strong> — plain-language explanations of why a vessel or
          counterparty was flagged, drawing on ownership, behaviour, and sanctions signals.
        </li>
        <li>
          <strong>Adverse-media &amp; screening support</strong> — surfacing and summarising
          relevant negative news and source material.
        </li>
        <li>
          <strong>Drafting assistance</strong> — helping draft briefs, notes, and communications you
          can review and edit.
        </li>
        <li>
          <strong>Guided analysis</strong> — multi-step reasoning that helps assemble ownership
          chains and connect related entities.
        </li>
      </ul>

      <h2>3. Accuracy and limitations</h2>
      <p>
        AI outputs can vary in quality and may contain inaccuracies, omissions, or outdated
        information, and can occasionally present incorrect statements with apparent confidence
        (“hallucinations”). Outputs should be treated as general reference material to be verified —
        not as definitive facts, legal or compliance advice, or a substitute for professional
        judgement.
      </p>

      <h2>4. Human oversight and your responsibilities</h2>
      <p>
        Talasa is decision-support software: a human must remain in the loop. Before you act on any
        AI-assisted output, you are responsible for:
      </p>
      <ul>
        <li>independently verifying material facts against primary sources;</li>
        <li>applying your own professional and regulatory judgement;</li>
        <li>ensuring your use is lawful, ethical, and appropriate to the decision at stake;</li>
        <li>owning the final go/no-go, compliance, credit, or commercial decision.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>When using Talasa AI features, you must not:</p>
      <ul>
        <li>submit content that infringes intellectual-property or privacy rights;</li>
        <li>upload malicious content or attempt to bypass safety controls or guardrails;</li>
        <li>enter sensitive personal data that is not necessary for your legitimate use;</li>
        <li>use outputs to unlawfully discriminate, harass, or cause harm;</li>
        <li>present AI-generated output as independently verified where it is not.</li>
      </ul>

      <h2>6. How your data is handled</h2>
      <p>
        We do not use your inputs or outputs to train third-party foundation models, and our AI
        providers are contractually restricted from using your inputs or outputs to train their
        models. Your data is processed to deliver the feature you requested and is handled in line
        with our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>7. Language and liability</h2>
      <p>
        AI output — including any non-English translations — may contain errors. To the extent
        permitted by law, Talasa is not liable for the accuracy of AI output or for decisions made
        in reliance on it. See our <a href="/terms">Terms of Use</a> for full details.
      </p>

      <h2>8. Contact us</h2>
      <p>
        Questions about how Talasa uses AI? Contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
