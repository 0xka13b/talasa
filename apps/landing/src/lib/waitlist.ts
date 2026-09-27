import { createServerFn } from "@tanstack/react-start";

/** Minimal slice of the Cloudflare KV binding we actually use. */
interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/** The four solutions, plus a catch-all, offered in the signup form. */
export const WAITLIST_SERVICES = [
  "Vessel Risk Screening",
  "Counterparty & Charter Due Diligence",
  "Port Call & Congestion Intelligence",
  "Fixture & Market Intelligence",
  "Multiple / not sure",
] as const;

const SERVICE_SET = new Set<string>(WAITLIST_SERVICES);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Known disposable / temporary email providers. Not exhaustive (there are
 * thousands), but covers the common ones so the waitlist stays reachable.
 * Matched against the exact domain or any subdomain of it.
 */
const DISPOSABLE_DOMAINS = new Set<string>([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.dev",
  "tempmailo.com",
  "tmpmail.org",
  "tempr.email",
  "tmpmail.net",
  "mytemp.email",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "getnada.com",
  "nada.email",
  "trashmail.com",
  "trashmail.de",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "fakeinbox.com",
  "tempinbox.com",
  "emailondeck.com",
  "mailcatch.com",
  "spamgourmet.com",
  "discard.email",
  "33mail.com",
  "moakt.com",
  "inboxkitten.com",
  "burnermail.io",
  "mailsac.com",
  "spam4.me",
  "fakemail.net",
  "tempmailaddress.com",
  "luxusmail.org",
  "byom.de",
  "anonbox.net",
]);

/** True if the email's domain is a known disposable/temporary provider. */
function isDisposableEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Block subdomains too (e.g. foo.guerrillamail.com).
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export type WaitlistInput = {
  email: string;
  company?: string;
  desk?: string;
  service?: string;
  /** Optional "first vessel you'd screen" — IMO number or vessel name. */
  vessel?: string;
  /** Which localised landing page the request came from ("en", "ru", …). */
  locale?: string;
};

/**
 * Stable identifiers for the rejection reasons, so localised pages can render
 * their own wording instead of the English `message` fallback.
 */
export type WaitlistErrorCode = "invalid_email" | "disposable_email" | "storage_failed";

export type WaitlistResult =
  | { status: "ok" }
  | { status: "already" }
  | { status: "error"; code: WaitlistErrorCode; message: string };

const clamp = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Trim + length-clamp + coerce shape. Full validation happens in the handler. */
function normalize(input: WaitlistInput): WaitlistInput {
  return {
    email: clamp(input?.email, 200).toLowerCase(),
    company: clamp(input?.company, 160),
    desk: clamp(input?.desk, 160),
    service: clamp(input?.service, 80),
    vessel: clamp(input?.vessel, 80),
    locale: clamp(input?.locale, 8),
  };
}

/**
 * The `cloudflare:workers` module only exists in the Workers runtime
 * (production / preview). In `vite dev` (Node) the import throws, so we fall
 * back to logging — the form still works locally.
 */
async function getWaitlistKV(): Promise<KVLike | null> {
  try {
    const mod = await import(/* @vite-ignore */ "cloudflare:workers");
    const env = (mod as { env?: Record<string, unknown> }).env;
    const kv = env?.KV as KVLike | undefined;
    return kv ?? null;
  } catch {
    return null;
  }
}

export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((input: WaitlistInput) => normalize(input))
  .handler(async ({ data }): Promise<WaitlistResult> => {
    if (!data.email || !EMAIL_RE.test(data.email)) {
      return {
        status: "error",
        code: "invalid_email",
        message: "Please enter a valid work email.",
      };
    }

    if (isDisposableEmail(data.email)) {
      return {
        status: "error",
        code: "disposable_email",
        message: "Please use your work email — temporary addresses aren't accepted.",
      };
    }

    const record = {
      email: data.email,
      company: data.company || null,
      desk: data.desk || null,
      service: data.service && SERVICE_SET.has(data.service) ? data.service : null,
      vessel: data.vessel || null,
      locale: data.locale || "en",
      ts: new Date().toISOString(),
    };

    const kv = await getWaitlistKV();
    if (!kv) {
      console.log("[waitlist] (dev / no KV binding) signup:", record);
      return { status: "ok" };
    }

    try {
      const key = `waitlist:${data.email}`;
      const existed = await kv.get(key);
      await kv.put(key, JSON.stringify(record));
      return { status: existed ? "already" : "ok" };
    } catch (error) {
      console.error("[waitlist] KV write failed:", error);
      return {
        status: "error",
        code: "storage_failed",
        message: "Something went wrong saving your request. Please try again.",
      };
    }
  });
