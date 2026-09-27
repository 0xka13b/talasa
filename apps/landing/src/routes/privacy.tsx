import { CONTACT_EMAIL, LegalLayout } from "@/components/legal-layout";
import { SITE_URL } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Privacy Policy — Talasa";
const DESCRIPTION =
  "How Talasa Labs collects, uses, shares, and protects personal information across its maritime risk intelligence service and website.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="July 1, 2026"
      intro={
        <p>
          Talasa Labs (“Talasa”, “we”, “us”) builds maritime risk intelligence for banks, insurers,
          traders and brokers. This policy explains what personal information we process, why we
          process it, and the choices and rights you have. It applies to visitors to our website,
          people who join our waitlist, and authorised users of the Talasa platform.
        </p>
      }
    >
      <h2>1. Overview of our service</h2>
      <p>
        Talasa provides decision-support analytics — vessel and counterparty screening, ownership
        and behaviour signals, and dark-fleet alerting — to corporate and institutional customers.
        The platform is designed to inform human review; it does not make automated legal, credit,
        or compliance decisions on your behalf. In this context the individuals whose personal
        information we typically process are customer and prospect contacts, waitlist registrants,
        website visitors, and our own personnel and candidates.
      </p>

      <h2>2. Information we collect</h2>
      <p>We process the following categories of personal information:</p>
      <ul>
        <li>
          <strong>Contact &amp; registration data</strong> — name, work email, company, role, and
          any message you send us when you join the waitlist, request access, or contact us.
        </li>
        <li>
          <strong>Account &amp; usage data</strong> — for authorised platform users: login
          identifiers, searches and screenings run, saved entities, exports, and audit metadata used
          to secure and improve the service.
        </li>
        <li>
          <strong>Technical data</strong> — IP address, device and browser type, and similar
          information collected automatically when you use the site.
        </li>
        <li>
          <strong>Business-partner data</strong> — contact details of vendor and supplier
          representatives we work with.
        </li>
      </ul>
      <p>
        The maritime, corporate-registry, sanctions and open-source datasets that power screening
        relate primarily to vessels, companies and other legal entities. Where such source data
        incidentally contains personal information (for example, a named director or beneficial
        owner), we process it to provide the risk-intelligence service.
      </p>

      <h2>3. How we collect it</h2>
      <p>
        We collect information directly from you (forms, email, account activity), automatically
        through cookies and similar technologies, and from third-party sources such as our
        infrastructure and analytics providers and the public and licensed data sources that feed
        the platform.
      </p>

      <h2>4. How we use it</h2>
      <ul>
        <li>To operate, maintain, secure and improve the service and website.</li>
        <li>To manage the waitlist and provision access to the platform.</li>
        <li>To respond to enquiries and provide customer support.</li>
        <li>To send service and, where permitted, marketing communications.</li>
        <li>To detect, prevent and investigate fraud, abuse and security issues.</li>
        <li>To comply with legal, regulatory and contractual obligations.</li>
      </ul>
      <p>
        We do not use your inputs or outputs to train third-party foundation models. See the{" "}
        <a href="/ai-guide">Talasa AI Guide</a> for how AI features handle your data.
      </p>

      <h2>5. Cookies and similar technologies</h2>
      <p>
        We use strictly necessary cookies to run the site and a limited set of analytics cookies to
        understand usage and improve the product. You can control cookies through your browser
        settings; disabling some cookies may affect how the site works.
      </p>

      <h2>6. Sharing with third parties</h2>
      <p>
        We do not sell personal information. We share it only with service providers acting on our
        behalf under contract — for example cloud hosting, analytics, email delivery, and payment
        processing — and where required to comply with law, enforce our terms, or protect our
        rights, users, or the public. These providers may process data only as instructed by us.
      </p>

      <h2>7. International data transfers</h2>
      <p>
        We may process and store information in countries other than the one in which you are
        located, including in the EU and the United States. Where we transfer personal information
        across borders, we rely on appropriate safeguards such as Standard Contractual Clauses or
        equivalent mechanisms.
      </p>

      <h2>8. How we secure information</h2>
      <p>
        We apply appropriate technical and organisational measures — including access controls,
        encryption in transit, and audit logging — to protect personal information. No method of
        transmission or storage is completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>9. Aggregated and anonymised data</h2>
      <p>
        We may create and use aggregated or de-identified data that no longer identifies you — for
        statistics, benchmarking, and improving the service — including sharing it with customers
        and partners for lawful business purposes.
      </p>

      <h2>10. Your rights and choices</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, delete, or port your
        personal information, to object to or restrict certain processing, and to withdraw consent.
        You can opt out of marketing emails at any time using the unsubscribe link or by contacting
        us. To exercise any right, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        Our site does not respond to “Do Not Track” signals.
      </p>

      <h2>11. Data retention</h2>
      <p>
        We keep personal information only as long as needed for the purposes described here, to
        comply with legal obligations, resolve disputes, and enforce our agreements. Retention
        periods vary by data type and context; when data is no longer needed we delete or anonymise
        it.
      </p>

      <h2>12. Children’s privacy</h2>
      <p>
        The service is intended for business use by professionals and is not directed to children.
        We do not knowingly collect personal information from anyone under 16.
      </p>

      <h2>13. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be posted here with a
        revised “last updated” date, and where required we will provide additional notice.
      </p>

      <h2>14. Contact us</h2>
      <p>
        Questions about this policy or your personal information? Contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
