import { CONTACT_EMAIL, LegalLayout } from "@/components/legal-layout";
import { SITE_URL } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Terms of Use — Talasa";
const DESCRIPTION =
  "The terms governing your use of the Talasa website and maritime risk intelligence service, including acceptable use, disclaimers, and limitation of liability.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Use"
      lastUpdated="July 1, 2026"
      intro={
        <p>
          These Terms of Use (“Terms”) govern your access to and use of the Talasa website and the
          Talasa maritime risk intelligence service (together, the “Service”) provided by Talasa
          Labs (“Talasa”, “we”, “us”). By accessing the Service you agree to these Terms and to our{" "}
          <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the Service.
        </p>
      }
    >
      <h2>1. Acceptance</h2>
      <p>
        By accessing or using the Service — including joining the waitlist, creating an account, or
        using any Talasa output — you accept these Terms on behalf of yourself and any organisation
        you represent, and you confirm you are authorised to do so.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        The Service is intended for business and professional use by individuals who are at least 18
        years old and legally able to enter into a contract. It is not offered where prohibited by
        applicable law or sanctions.
      </p>

      <h2>3. The service and pre-launch status</h2>
      <p>
        Talasa is currently offered on a limited, pre-launch and waitlist basis. Features may
        change, be added, or be withdrawn, and access may be invitation-only. Any commercial use is
        additionally governed by a separate written subscription or order agreement, which prevails
        over these Terms to the extent of any conflict.
      </p>

      <h2>4. Licence and acceptable use</h2>
      <p>
        Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable
        licence to access the Service for your internal business purposes. You agree not to:
      </p>
      <ul>
        <li>
          copy, resell, sublicense, or redistribute the Service or its output except as expressly
          permitted;
        </li>
        <li>
          reverse engineer, scrape, or attempt to extract the underlying data or models except as
          allowed by law;
        </li>
        <li>use the Service to build or train a competing product or dataset;</li>
        <li>
          upload unlawful, infringing, or malicious content, or attempt to breach security or access
          controls;
        </li>
        <li>
          use the Service in violation of applicable sanctions, export-control, data-protection, or
          other laws.
        </li>
      </ul>

      <h2>5. Intellectual property</h2>
      <p>
        The Service, including all software, data compilations, analytics, text, and design, is
        owned by Talasa or its licensors and is protected by intellectual-property laws. We retain
        all rights not expressly granted. If you provide feedback or suggestions, you grant us a
        perpetual, worldwide, royalty-free licence to use them without restriction.
      </p>

      <h2>6. Third-party sources and links</h2>
      <p>
        The Service draws on public, licensed, and open-source data and may link to third-party
        sites. We are not responsible for the content, accuracy, or privacy practices of third
        parties, and links do not imply endorsement.
      </p>

      <h2>7. Decision-support disclaimer</h2>
      <p>
        Talasa is a decision-support tool. Its outputs — risk scores, screenings, ownership chains,
        alerts, and summaries — are intended to assist, not replace, human judgement and require
        independent review. You are solely responsible for any go/no-go, compliance, credit,
        underwriting, or commercial decision you make, and for meeting your own legal and regulatory
        obligations. Nothing in the Service constitutes legal, financial, or compliance advice.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        The Service is provided “as is” and “as available”, without warranties of any kind, whether
        express or implied, including merchantability, fitness for a particular purpose,
        non-infringement, and accuracy or completeness of data. We do not warrant that the Service
        will be uninterrupted, error-free, or that outputs are free of inaccuracies or omissions.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Talasa and its suppliers will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or for any loss of
        profits, revenue, data, or goodwill, arising from or related to your use of (or inability to
        use) the Service. Our total aggregate liability for all claims relating to the Service will
        not exceed the amounts you paid us for the Service in the twelve months preceding the claim,
        or, where the Service is provided free of charge, one hundred (100) US dollars.
      </p>

      <h2>10. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Talasa and its personnel from any claims, losses,
        and expenses (including reasonable legal fees) arising out of your use of the Service, your
        content, or your breach of these Terms or of applicable law.
      </p>

      <h2>11. Termination</h2>
      <p>
        We may suspend or terminate your access to the Service at any time, including for breach of
        these Terms. Provisions that by their nature should survive termination — including
        intellectual property, disclaimers, limitation of liability, and indemnification — will
        survive.
      </p>

      <h2>12. Changes to the terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be posted here with a
        revised “last updated” date, and your continued use of the Service after changes take effect
        constitutes acceptance.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which Talasa Labs is
        established, without regard to conflict-of-law principles, and the courts of that
        jurisdiction will have exclusive jurisdiction over any dispute, subject to any mandatory
        rights you have under local law.
      </p>

      <h2>14. Contact us</h2>
      <p>
        Questions about these Terms? Contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
