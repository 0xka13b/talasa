/**
 * The landing page, rendered from a `LandingCopy` bundle.
 *
 * There is one copy of this markup; `/` passes the English bundle and `/r`
 * passes the Russian one. Nothing here should hardcode user-visible text —
 * if a new string is needed, add it to `LandingCopy` so both locales carry it.
 */

import { joinWaitlist, type WaitlistResult } from "@/lib/waitlist";
import type { LandingCopy } from "@/lib/landing-copy";
import type { SignalLevel, UseCase, UseCaseReport } from "@/lib/home-content";
import { CONTACT_EMAIL } from "@/components/legal-layout";
import { Link } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

const CopyContext = createContext<LandingCopy | null>(null);

function useCopy(): LandingCopy {
  const copy = useContext(CopyContext);
  if (!copy) throw new Error("useCopy must be used inside <LandingPage>");
  return copy;
}

export function LandingPage({ copy, jsonLd }: { copy: LandingCopy; jsonLd?: ReactNode }) {
  return (
    <CopyContext.Provider value={copy}>
      <div className="min-h-screen text-foreground">
        {jsonLd}
        <a
          href="#main"
          className="mono sr-only rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]"
        >
          {copy.skipToContent}
        </a>
        <TopBar />
        <main id="main">
          <NewsStrip />
          <Hero />
          <Logos />
          <Problem />
          <UseCases />
          <Outcomes />
          <Assurance />
          <Faq />
          <CTA />
        </main>
        <Footer />
      </div>
    </CopyContext.Provider>
  );
}

/* ---------------- Top bar ---------------- */

function TopBar() {
  const { topBar } = useCopy();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="mono truncate text-sm tracking-widest">TALASA</span>
        </div>
        <nav className="hidden items-center gap-8 text-xs uppercase tracking-wider text-muted-foreground md:flex">
          {topBar.nav.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://app.example.com"
            className="mono hairline rounded-sm bg-card px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground transition hover:bg-accent sm:text-xs"
          >
            <span className="hidden sm:inline">{topBar.platformLong}</span>
            <span className="sm:hidden">{topBar.platformShort}</span>
          </a>
          <a
            href="#contact"
            className="mono hairline rounded-sm bg-primary px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground transition hover:opacity-90 sm:text-xs"
          >
            <span className="hidden sm:inline">{topBar.demoLong}</span>
            <span className="sm:hidden">{topBar.demoShort}</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="hairline grid h-7 w-7 place-items-center bg-card">
      <img
        src="/logo-variant.png"
        alt="Talasa"
        className="h-6 w-6 object-contain"
        decoding="async"
      />
    </div>
  );
}

/* ---------------- Topical strip ---------------- */

/** One-line enforcement-news hook pointing at the real screening sample. */
function NewsStrip() {
  const { news } = useCopy();
  return (
    <div className="border-b border-border bg-card/60">
      <div className="mono mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 py-2.5 text-[10px] uppercase tracking-[0.15em]">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-warn" aria-hidden="true" />
          {news.headline}
        </span>
        <a href="#solutions" className="text-foreground underline-offset-4 hover:underline">
          {news.cta} <span aria-hidden>→</span>
        </a>
      </div>
    </div>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  const { hero } = useCopy();
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Dotted world map backdrop — monochrome, masked to fade into the page. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img
          src="/map.svg"
          alt=""
          decoding="async"
          loading="lazy"
          className="absolute left-1/2 top-1/2 w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.35] [mask-image:radial-gradient(ellipse_70%_75%_at_50%_50%,black,transparent_75%)] md:w-[115%]"
        />
        {/* Left vignette so the headline stays legible over the map. */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-20 md:pt-36 md:pb-28">
        <h1 className="max-w-5xl text-balance text-5xl font-light leading-[1.02] tracking-tight md:text-[5.5rem]">
          {hero.title}
        </h1>

        <p className="mt-8 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          {hero.lead}
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <a
            href="#contact"
            className="group mono hairline inline-flex items-center gap-3 rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground transition hover:opacity-90"
          >
            {hero.primaryCta}{" "}
            <span
              aria-hidden
              className="transition-transform duration-200 ease-out group-hover:translate-x-1"
            >
              →
            </span>
          </a>
          <a
            href="#solutions"
            className="mono hairline inline-flex items-center gap-3 rounded-sm bg-card px-6 py-3 text-xs uppercase tracking-[0.2em] text-foreground transition hover:bg-accent"
          >
            {hero.secondaryCta}
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Logos / industries strip ---------------- */

function Logos() {
  const { industries } = useCopy();
  return (
    <section className="border-b border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-6 py-14 md:py-16">
        <h2 className="mb-12 text-4xl font-light leading-tight tracking-tight md:text-5xl">
          {industries.heading}
        </h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3">
          {industries.items.map((d) => (
            <li key={d.name} className="bg-background py-6 pr-6 transition-colors hover:bg-card">
              <div className="text-sm text-foreground">{d.name}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{d.use}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- Problem ---------------- */

function Problem() {
  const { problem } = useCopy();
  return (
    <section id="why" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <h2 className="text-4xl font-light leading-tight tracking-tight md:text-5xl">
              {problem.heading}
            </h2>
          </div>
          <div className="md:col-span-6 space-y-6 text-base text-muted-foreground md:text-lg">
            {problem.paragraphs.map((p, i) => (
              // The closing paragraph is the payoff line — rendered at full contrast.
              <p key={p} className={i === problem.paragraphs.length - 1 ? "text-foreground" : ""}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Use cases ---------------- */

function UseCases() {
  const { useCases } = useCopy();
  return (
    <section id="solutions" className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <h2 className="text-balance text-4xl font-light leading-tight tracking-tight md:text-5xl">
          {useCases.heading}
        </h2>
        <div className="mt-16 space-y-24 md:mt-20 md:space-y-32">
          {useCases.items.map((uc) => (
            <UseCaseRow key={uc.num} uc={uc} />
          ))}
        </div>
        <AskAgent />
      </div>
    </section>
  );
}

/** Platform strip: the embedded analyst copilot, with a sample exchange. */
function AskAgent() {
  const { askAgent } = useCopy();
  return (
    <div className="hairline mt-24 grid gap-10 bg-card/40 p-8 md:mt-32 md:grid-cols-2 md:gap-12 md:p-10">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {askAgent.kicker}
        </div>
        <h3 className="mt-4 text-balance text-2xl font-light leading-snug tracking-tight md:text-3xl">
          {askAgent.title}
        </h3>
        <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
          {askAgent.points.map((p) => (
            <li key={p} className="flex gap-3">
              <span className="mono leading-5 text-foreground" aria-hidden="true">
                ›
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mono mt-6 text-[10px] uppercase tracking-wider text-muted-foreground">
          {askAgent.note}
        </p>
      </div>
      <div className="hairline flex flex-col bg-background">
        <div className="mono flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-ok" aria-hidden="true" />
            {askAgent.header}
          </span>
          <span>{askAgent.sample.subject}</span>
        </div>
        <div className="mono flex-1 space-y-4 px-4 py-5 text-xs leading-relaxed">
          <div className="flex gap-2.5">
            <span className="shrink-0 text-muted-foreground" aria-hidden="true">
              ›
            </span>
            <span className="text-foreground">{askAgent.sample.question}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {askAgent.sample.thought}
          </div>
          <div className="border-t border-border pt-4">
            <div className="text-signal-alert">{askAgent.sample.verdict}</div>
            <p className="mt-2 text-foreground/85">{askAgent.sample.answer}</p>
          </div>
          <div className="border-t border-border pt-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {askAgent.topDrivers}
            </div>
            <ul className="mt-2.5 space-y-2.5">
              {askAgent.sample.drivers.map((d) => (
                <li key={d.n} className="flex gap-3">
                  <span className="shrink-0 text-muted-foreground">{d.n}</span>
                  <span>
                    <span className="text-foreground">{d.driver}</span>{" "}
                    <span className="text-muted-foreground">— {d.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Composer is a teaser: asking routes to the demo request form. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            document.getElementById("contact")?.scrollIntoView();
            document
              .querySelector<HTMLInputElement>('input[name="email"]')
              ?.focus({ preventScroll: true });
          }}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            name="agent-question"
            autoComplete="off"
            placeholder={askAgent.composerPlaceholder}
            aria-label={askAgent.composerLabel}
            className="mono h-9 w-full flex-1 rounded-sm bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            aria-label={askAgent.composerSubmitLabel}
            className="hairline grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground transition hover:opacity-90"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function UseCaseRow({ uc }: { uc: UseCase }) {
  return (
    <article id={uc.id} className="grid gap-10 md:grid-cols-12 md:gap-12">
      <div className="md:col-span-6">
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {uc.tag}
        </div>
        <h3 className="mt-6 text-balance text-3xl font-light leading-[1.1] tracking-tight md:text-4xl">
          {uc.title}
        </h3>
        <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">{uc.lead}</p>
      </div>
      <div className="md:col-span-6">
        <ReportCard uc={uc} />
      </div>
    </article>
  );
}

const SIGNAL_DOT: Record<SignalLevel, string> = {
  ok: "bg-signal-ok",
  warn: "bg-signal-warn",
  alert: "bg-signal-alert",
};

const SIGNAL_TEXT: Record<SignalLevel, string> = {
  ok: "text-signal-ok",
  warn: "text-signal-warn",
  alert: "text-signal-alert",
};

/**
 * Each solution renders its own artifact — five distinct document types
 * (screening dossier, ownership brief, ops dashboard, live feed, market note)
 * so the sample output shows the product's actual range, not one template.
 */
function ReportCard({ uc }: { uc: UseCase }) {
  switch (uc.report.layout) {
    case "screening":
      return <ScreeningReport r={uc.report} />;
    case "counterparty":
      return <CounterpartyReport r={uc.report} />;
    case "port":
      return <PortReport r={uc.report} />;
    case "alerts":
      return <AlertsReport r={uc.report} />;
    default:
      return <MarketReport r={uc.report} />;
  }
}

function ReportHeader({ icon, kind, refLine }: { icon: ReactNode; kind: string; refLine: string }) {
  return (
    <header className="mono flex items-center justify-between gap-3 border-b border-border px-5 py-3 text-[10px] uppercase tracking-wider">
      <span className="flex items-center gap-2 text-foreground">
        {icon}
        {kind}
      </span>
      <span className="text-muted-foreground">{refLine}</span>
    </header>
  );
}

/** Fires once when the element scrolls into view; default state stays visible. */
function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** 01 — Screening dossier: stamped verdict, segmented risk meter, numbered findings. */
function ScreeningReport({ r }: { r: UseCaseReport }) {
  const { report } = useCopy();
  const score = Number.parseInt(r.rows[0]?.value ?? "0", 10);
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`hairline flex h-full flex-col bg-card/40 ${inView ? "report-live" : ""}`}
    >
      <ReportHeader
        kind={r.kind}
        refLine={r.ref}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z" />
            <path d="M9 12h6M12 9v6" />
          </svg>
        }
      />

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 pt-5">
        <div>
          <div className="text-2xl font-light leading-none tracking-tight text-foreground">
            {r.subject}
          </div>
          <div className="mono mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            {r.context}
          </div>
          {r.provenance && (
            <div className="mono mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-signal-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-ok" aria-hidden="true" />
              {r.provenance}
            </div>
          )}
        </div>
        <div className="report-stamp mono -rotate-2 border-2 border-signal-alert px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-signal-alert">
          {r.verdict.label}
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className="mono flex items-baseline justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{r.rows[0]?.label}</span>
          <span className="text-signal-alert">{r.rows[0]?.value}</span>
        </div>
        <div className="mt-2 flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className={`report-seg h-1.5 flex-1 ${i < Math.round(score / 5) ? "bg-signal-alert" : "bg-border"}`}
              style={{ "--seg-i": i } as CSSProperties}
            />
          ))}
        </div>
        <div className="mono mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          {r.rows[1]?.label} · {r.rows[1]?.value}
        </div>
      </div>

      <ol className="mt-5 flex-1 space-y-2.5 border-t border-border px-5 py-5 text-sm">
        {r.signals.map((s, i) => (
          <li key={s.text} className="flex gap-3">
            <span className={`mono shrink-0 text-[10px] leading-6 ${SIGNAL_TEXT[s.level]}`}>
              F{String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-foreground/90">{s.text}</span>
          </li>
        ))}
      </ol>

      {r.narrative && (
        <div className="border-t border-border px-5 py-4">
          <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {report.fromTheReport}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">“{r.narrative}”</p>
        </div>
      )}

      <footer className="mono border-t border-border px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        {r.footnote}
      </footer>
    </div>
  );
}

/** 02 — Counterparty brief: ownership chain traced as a terminal tree. */
function CounterpartyReport({ r }: { r: UseCaseReport }) {
  const { report } = useCopy();
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`hairline flex h-full flex-col bg-card/40 ${inView ? "report-live" : ""}`}
    >
      <ReportHeader
        kind={r.kind}
        refLine={r.ref}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <path d="M12 7v4m0 0l-5.5 6.5M12 11l5.5 6.5" />
          </svg>
        }
      />

      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="text-2xl font-light leading-none tracking-tight text-foreground">
            {r.subject}
          </div>
          <span className="flex flex-col items-end gap-1">
            <span
              className={`mono inline-flex items-center gap-2 text-[11px] uppercase tracking-wider ${SIGNAL_TEXT[r.verdict.level]}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${SIGNAL_DOT[r.verdict.level]}`} />
              {r.verdict.label}
            </span>
            <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {r.rows[0]?.label} {r.rows[0]?.value}
            </span>
          </span>
        </div>
        <div className="mono mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {r.context}
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {report.corporateNetwork}
        </div>
        <div className="mono mt-3 space-y-1.5 text-xs leading-5 text-foreground/90">
          <div
            className="report-row flex items-center gap-2.5"
            style={{ "--row-i": 0 } as CSSProperties}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-warn" />
            {report.beneficialOwner}
            <span className="text-signal-warn">{report.unresolved}</span>
          </div>
          <div className="report-row pl-4" style={{ "--row-i": 1 } as CSSProperties}>
            <span className="text-muted-foreground">└</span>{" "}
            <span className="text-foreground">{r.subject}</span>
            <span className="text-muted-foreground">{report.sanctionLinked}</span>
          </div>
          <div className="report-row pl-8" style={{ "--row-i": 2 } as CSSProperties}>
            <span className="text-muted-foreground">├</span> {report.soleVessel}
            <span className="text-signal-alert">{report.soleVesselNote}</span>
          </div>
          <div className="report-row pl-8" style={{ "--row-i": 3 } as CSSProperties}>
            <span className="text-muted-foreground">└</span> {report.ismManager}
            <span className="text-signal-warn">{report.ismManagerNote}</span>
          </div>
        </div>
      </div>

      <ul className="mt-5 flex-1 space-y-2.5 border-t border-border px-5 py-5 text-sm">
        {r.signals.map((s, i) => (
          <li
            key={s.text}
            className="report-row flex gap-3"
            style={{ "--row-i": 4 + i } as CSSProperties}
          >
            <span className={`mono shrink-0 leading-6 ${SIGNAL_TEXT[s.level]}`}>
              {s.level === "ok" ? "✓" : "!"}
            </span>
            <span className="text-foreground/90">{s.text}</span>
          </li>
        ))}
      </ul>

      <footer className="mono border-t border-border px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        {r.footnote}
      </footer>
    </div>
  );
}

/** Illustrative 14-day median-wait trend behind the Fujairah sample numbers. */
const PORT_WAIT_TREND = [2.1, 2.0, 2.3, 2.2, 2.4, 2.3, 2.6, 2.5, 2.7, 2.6, 2.9, 3.0, 3.1, 3.2];

/** 03 — Port briefing: numbers-forward ops dashboard with a wait-time trend. */
function PortReport({ r }: { r: UseCaseReport }) {
  const { report } = useCopy();
  const low = Math.min(...PORT_WAIT_TREND);
  const peak = Math.max(...PORT_WAIT_TREND);
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`hairline flex h-full flex-col bg-card/40 ${inView ? "report-live" : ""}`}
    >
      <ReportHeader
        kind={r.kind}
        refLine={r.ref}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="5" r="2.5" />
            <path d="M12 7.5V21M12 21c-4.5 0-8-3.5-8.5-7M12 21c4.5 0 8-3.5 8.5-7" />
            <path d="M8.5 10.5h7" />
          </svg>
        }
      />

      <div className="px-5 pt-5">
        <div className="text-2xl font-light leading-none tracking-tight text-foreground">
          {r.subject}
        </div>
        <div className="mono mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {r.context}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 border-y border-border">
        {r.rows.map((row, i) => {
          const [big, ...rest] = row.value.split(" · ");
          return (
            <div
              key={row.label}
              className={`report-stat px-5 py-4 ${i === 0 ? "border-r border-border" : ""}`}
              style={{ "--row-i": i } as CSSProperties}
            >
              <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {row.label}
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-light tracking-tight text-foreground">{big}</span>
                {rest.length > 0 && (
                  <span className="mono text-[11px] text-signal-warn">{rest.join(" · ")}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 pt-5">
        <div className="mono flex items-baseline justify-between text-[10px] uppercase tracking-wider">
          <span className="text-muted-foreground">{report.medianWaitTrend}</span>
          <span className={SIGNAL_TEXT[r.verdict.level]}>{r.verdict.label}</span>
        </div>
        <div className="mt-3 flex h-14 items-end gap-1" aria-hidden="true">
          {PORT_WAIT_TREND.map((v, i) => (
            <span
              key={i}
              className={`report-bar flex-1 ${i === PORT_WAIT_TREND.length - 1 ? "bg-signal-warn" : "bg-border"}`}
              style={
                {
                  height: `${20 + ((v - low) / (peak - low)) * 80}%`,
                  "--bar-i": i,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <ul className="mt-5 flex-1 space-y-2.5 border-t border-border px-5 py-5 text-sm">
        {r.signals.map((s, i) => (
          <li
            key={s.text}
            className="report-note flex gap-3"
            style={{ "--row-i": i } as CSSProperties}
          >
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SIGNAL_DOT[s.level]}`} />
            <span className="text-foreground/90">{s.text}</span>
          </li>
        ))}
      </ul>

      <footer className="mono border-t border-border px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        {r.footnote}
      </footer>
    </div>
  );
}

/** Illustrative receipt times for the last-24h alert feed, latest first. */
const ALERT_TIMES = ["14:05", "11:20", "06:47", "03:12"];

/** 04 — Alert stream: live terminal feed with timestamps and severity tags. */
function AlertsReport({ r }: { r: UseCaseReport }) {
  const { report } = useCopy();
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`hairline flex h-full flex-col bg-background ${inView ? "report-live" : ""}`}
    >
      <ReportHeader
        kind={r.kind}
        refLine={r.ref}
        icon={
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-alert opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-alert" />
          </span>
        }
      />

      <div className="mono flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border px-5 py-4">
        <div>
          <div className="text-lg text-foreground">{r.subject}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {r.context}
          </div>
        </div>
        <span className={`text-[11px] uppercase tracking-wider ${SIGNAL_TEXT[r.verdict.level]}`}>
          {r.verdict.label}
        </span>
      </div>

      <ul className="mono flex-1 divide-y divide-border/60 text-xs">
        {r.signals.map((s, i) => (
          <li
            key={s.text}
            className="report-feed flex items-start gap-3 px-5 py-3 leading-5"
            style={{ "--row-i": i } as CSSProperties}
          >
            <span className="shrink-0 text-muted-foreground">{ALERT_TIMES[i]}</span>
            <span className={`w-9 shrink-0 ${SIGNAL_TEXT[s.level]}`}>
              {report.severity[s.level]}
            </span>
            <span className="text-foreground/90">{s.text}</span>
          </li>
        ))}
      </ul>

      <footer className="mono flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          {r.rows[0]?.label} · {r.rows[0]?.value}
        </span>
        <span>{r.rows[1]?.value}</span>
      </footer>
    </div>
  );
}

/** Illustrative 10-week TD3C worldscale readings behind the weekly sample. */
const TD3C_TREND = [44, 46, 45, 48, 47, 50, 52, 51, 54, 58];

/** 05 — Market brief: rate sparkline, index table, direction-tagged reads. */
function MarketReport({ r }: { r: UseCaseReport }) {
  const { report } = useCopy();
  const min = Math.min(...TD3C_TREND);
  const max = Math.max(...TD3C_TREND);
  const points = TD3C_TREND.map((v, i) => {
    const x = (i * 100) / (TD3C_TREND.length - 1);
    const y = 30 - ((v - min) / (max - min)) * 26;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`hairline flex h-full flex-col bg-card/40 ${inView ? "report-live" : ""}`}
    >
      <ReportHeader
        kind={r.kind}
        refLine={r.ref}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M15 7h6v6" />
          </svg>
        }
      />

      <div className="px-5 pt-5">
        <div className="text-2xl font-light leading-none tracking-tight text-foreground">
          {r.subject}
        </div>
        <div className="mono mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {r.context}
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="mono flex items-baseline justify-between text-[10px] uppercase tracking-wider">
          <span className="text-muted-foreground">{report.rateTrend}</span>
          <span className={SIGNAL_TEXT[r.verdict.level]}>{r.verdict.label}</span>
        </div>
        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          className="report-line mt-3 h-14 w-full"
          aria-hidden="true"
        >
          <polyline
            points={points}
            fill="none"
            className="stroke-signal-ok"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="mono mt-5 grid grid-cols-2 border-y border-border text-xs">
        {r.rows.map((row, i) => (
          <div
            key={row.label}
            className={`report-stat px-5 py-3 ${i === 0 ? "border-r border-border" : ""}`}
            style={{ "--row-i": i } as CSSProperties}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {row.label}
            </div>
            <div className="mt-1 text-sm text-foreground">{row.value}</div>
          </div>
        ))}
      </div>

      <ul className="flex-1 space-y-2.5 px-5 py-5 text-sm">
        {r.signals.map((s, i) => (
          <li
            key={s.text}
            className="report-read flex gap-3"
            style={{ "--row-i": i } as CSSProperties}
          >
            <span className={`mono shrink-0 leading-6 ${SIGNAL_TEXT[s.level]}`} aria-hidden="true">
              {s.level === "warn" ? "▼" : "▲"}
            </span>
            <span className="text-foreground/90">{s.text}</span>
          </li>
        ))}
      </ul>

      <footer className="mono border-t border-border px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        {r.footnote}
      </footer>
    </div>
  );
}

/* ---------------- Outcomes / Audience ---------------- */

function Outcomes() {
  const { audience } = useCopy();
  return (
    <section id="audience" className="border-b border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <h2 className="max-w-3xl text-balance text-4xl font-light leading-tight tracking-tight md:text-5xl">
          {audience.heading}
        </h2>
        <div className="mt-14 grid md:grid-cols-2">
          {audience.groups.map((g) => (
            <div key={g.who} className="bg-background p-8 md:p-10 md:odd:pl-0">
              <div className="mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {g.who}
              </div>
              <h3 className="mt-4 text-2xl font-light leading-snug tracking-tight md:text-3xl">
                {g.headline}
              </h3>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {g.points.map((p) => (
                  <li key={p} className="flex gap-3">
                    <span className="mono leading-5 text-foreground" aria-hidden="true">
                      ›
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Assurance ---------------- */

function Assurance() {
  const { assurance } = useCopy();
  return (
    <section id="trust" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="max-w-3xl text-balance text-4xl font-light leading-tight tracking-tight md:text-5xl">
          {assurance.heading}
        </h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-12">
          {assurance.items.map((it) => (
            <div key={it.t}>
              <h3 className="text-lg text-foreground">{it.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-14 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {assurance.disclaimer}
        </p>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function Faq() {
  const { faq } = useCopy();
  return (
    <section id="faq" className="border-b border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <h2 className="text-balance text-4xl font-light leading-tight tracking-tight md:text-5xl">
              {faq.heading}
            </h2>
            <p className="mt-6 max-w-md text-muted-foreground">{faq.lead}</p>
          </div>
          <dl className="md:col-span-7">
            {faq.items.map((item) => (
              <div key={item.q} className="py-6 first:pt-0">
                <dt className="text-lg font-light leading-snug tracking-tight text-foreground">
                  {item.q}
                </dt>
                <dd className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ---------------- CTA ---------------- */

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; already: boolean }
  | { kind: "error"; message: string };

function CTA() {
  const copy = useCopy();
  const { cta } = copy;
  const [state, setState] = useState<FormState>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!email) {
      setState({ kind: "error", message: cta.errors.missingEmail });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const result: WaitlistResult = await joinWaitlist({
        data: {
          email,
          company: String(form.get("company") ?? "").trim(),
          desk: String(form.get("desk") ?? "").trim(),
          service: String(form.get("service") ?? "").trim(),
          vessel: String(form.get("vessel") ?? "").trim(),
          locale: copy.locale,
        },
      });

      if (result.status === "error") {
        // Prefer the locale's wording; fall back to the server's English text.
        setState({ kind: "error", message: cta.errors[result.code] ?? result.message });
      } else {
        setState({ kind: "success", already: result.status === "already" });
      }
    } catch {
      setState({ kind: "error", message: cta.errors.unexpected });
    }
  }

  return (
    <section id="contact" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <h2 className="text-balance text-4xl font-light leading-tight tracking-tight md:text-6xl">
              {cta.heading}
            </h2>
            <p className="mt-6 max-w-xl text-muted-foreground md:text-lg">{cta.lead}</p>
          </div>
          <div className="md:col-span-5">
            {state.kind === "success" ? (
              <WaitlistSuccess already={state.already} />
            ) : (
              <form onSubmit={onSubmit} className="hairline space-y-3 bg-card p-6">
                <Field
                  name="email"
                  label={cta.fields.email.label}
                  type="email"
                  placeholder={cta.fields.email.placeholder}
                  required
                  invalid={state.kind === "error"}
                  describedById={state.kind === "error" ? "waitlist-error" : undefined}
                />
                <Field
                  name="company"
                  label={cta.fields.company.label}
                  placeholder={cta.fields.company.placeholder}
                />
                <Field
                  name="desk"
                  label={cta.fields.desk.label}
                  placeholder={cta.fields.desk.placeholder}
                />
                <Field
                  name="vessel"
                  label={cta.fields.vessel.label}
                  placeholder={cta.fields.vessel.placeholder}
                />
                <label className="block">
                  <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {cta.fields.service.label}
                  </span>
                  <select
                    name="service"
                    defaultValue=""
                    className="mono mt-2 w-full border-b border-border bg-transparent py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
                  >
                    <option value="" className="bg-card text-foreground">
                      {cta.fields.service.placeholder}
                    </option>
                    {cta.services.map((s) => (
                      <option key={s.value} value={s.value} className="bg-card text-foreground">
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                {state.kind === "error" && (
                  <p
                    id="waitlist-error"
                    role="alert"
                    className="mono pt-1 text-[10px] uppercase tracking-wider text-signal-alert"
                  >
                    {state.message}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={state.kind === "submitting"}
                  className="mono mt-2 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {state.kind === "submitting" ? cta.submitting : cta.submit}{" "}
                  <span aria-hidden>›</span>
                </button>
                <p className="mono pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {cta.note}
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required = false,
  invalid = false,
  describedById,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  describedById?: string;
}) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        className="mono mt-2 w-full border-b border-border bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none aria-[invalid=true]:border-signal-alert"
      />
    </label>
  );
}

function WaitlistSuccess({ already }: { already: boolean }) {
  const { success } = useCopy().cta;
  const ref = useRef<HTMLDivElement>(null);
  // Move focus to the confirmation so screen-reader and keyboard users are told
  // the submission succeeded (the form they were in has been removed).
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="hairline bg-card p-6 outline-none">
      <div className="mono inline-flex h-6 items-center gap-2 rounded-sm border border-border px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="h-1.5 w-1.5 bg-signal-ok" />{" "}
        {already ? success.badgeAlready : success.badgeNew}
      </div>
      <p className="mt-5 text-lg font-light leading-snug tracking-tight text-foreground">
        {already ? success.headlineAlready : success.headlineNew}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">{success.body}</p>
    </div>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  const { footer } = useCopy();
  return (
    <footer className="relative overflow-hidden border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 pt-20">
        <div className="grid gap-12 md:grid-cols-12">
          <FooterNav
            title={footer.solutionsTitle}
            className="md:col-span-6"
            grid
            links={footer.solutionLinks}
          />

          <div className="md:col-span-3">
            <div className="mono mb-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {footer.legalTitle}
            </div>
            <ul className="space-y-2 text-sm">
              {footer.legalLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-foreground/80 transition hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="mono mb-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {footer.contactTitle}
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="break-all text-foreground/80 transition hover:text-foreground"
                >
                  {CONTACT_EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mono mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border py-6 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{footer.copyright}</span>
          <span>{footer.disclaimer}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterNav({
  title,
  links,
  className = "md:col-span-2",
  grid = false,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
  className?: string;
  grid?: boolean;
}) {
  return (
    <div className={className}>
      <div className="mono mb-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {title}
      </div>
      <ul className={grid ? "grid grid-cols-2 gap-x-8 gap-y-2 text-sm" : "space-y-2 text-sm"}>
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="text-foreground/80 transition hover:text-foreground">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
