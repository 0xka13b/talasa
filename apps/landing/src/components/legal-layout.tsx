import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Single source of truth for the legal/company links used in footers and nav. */
export const CONTACT_EMAIL = "hello@example.com";

export const LEGAL_LINKS: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Use" },
  { to: "/ai-guide", label: "Talasa AI Guide" },
];

function BrandMark() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-3">
      <span className="hairline grid h-7 w-7 place-items-center bg-card">
        <img
          src="/logo-variant.png"
          alt="Talasa"
          className="h-6 w-6 object-contain"
          decoding="async"
        />
      </span>
      <span className="mono truncate text-sm tracking-widest">TALASA</span>
    </Link>
  );
}

/**
 * Shared chrome + reading layout for the standalone legal / policy pages
 * (Privacy, Terms, AI Guide). Renders semantic HTML from callers; the `prose`
 * wrapper styles headings/lists without depending on @tailwindcss/typography.
 */
export function LegalLayout({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandMark />
          <Link
            to="/"
            className="mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mono mt-3 text-xs uppercase tracking-wider text-muted-foreground">
          Last updated: {lastUpdated}
        </p>
        {intro ? (
          <div className="mt-6 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
            {intro}
          </div>
        ) : null}

        <div
          className={[
            "mt-10 text-sm leading-relaxed text-muted-foreground",
            "[&>*:first-child]:mt-0",
            "[&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
            "[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground",
            "[&_p]:mt-4",
            "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:marker:text-muted-foreground/50",
            "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:opacity-80",
            "[&_strong]:font-medium [&_strong]:text-foreground",
          ].join(" ")}
        >
          {children}
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
          © 2026 Talasa Labs · Demos open
        </span>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="transition hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-foreground">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
