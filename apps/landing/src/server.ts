import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { renderHomeMarkdown } from "./lib/home-markdown";
import { isUnlistedPath, NOINDEX_DIRECTIVE, SITE_URL } from "./lib/seo";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

/**
 * RFC 8288 Link headers advertised on the homepage so agents can discover
 * related representations and resources without scraping the HTML.
 * Every target must be a resource that actually exists.
 */
const HOMEPAGE_LINK_HEADER = [
  `<${SITE_URL}/>; rel="canonical"`,
  `<${SITE_URL}/>; rel="alternate"; type="text/markdown"`,
  `<${SITE_URL}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
].join(", ");

function isHomepageRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return new URL(request.url).pathname === "/";
}

/** Whether the client explicitly asked for a markdown representation. */
function wantsMarkdown(request: Request): boolean {
  return (request.headers.get("accept") ?? "").toLowerCase().includes("text/markdown");
}

/** Serve the homepage as markdown when an agent requests it (HTML stays the browser default). */
function markdownHomepageResponse(): Response {
  const markdown = renderHomeMarkdown();
  return new Response(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      // Rough token estimate (~4 chars/token) to help agents budget context.
      "x-markdown-tokens": String(Math.ceil(markdown.length / 4)),
      "cache-control": "public, max-age=3600",
      link: HOMEPAGE_LINK_HEADER,
      vary: "Accept",
    },
  });
}

/**
 * Send `X-Robots-Tag` on unlisted pages (e.g. the Russian `/r` landing).
 * The route also emits a `robots` meta tag; the header additionally covers
 * crawlers that never parse the document, and any non-HTML response.
 */
function withNoindexHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", NOINDEX_DIRECTIVE);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Add discovery Link headers + Vary to a homepage HTML response without disturbing its body. */
function withHomepageHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append("link", HOMEPAGE_LINK_HEADER);
  // The representation depends on Accept (HTML vs. markdown), so caches must vary on it.
  headers.append("vary", "Accept");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const homepage = isHomepageRequest(request);

      // Agent content negotiation: serve markdown without ever touching SSR.
      if (homepage && wantsMarkdown(request)) {
        return markdownHomepageResponse();
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);

      // Advertise discovery links only on a successful homepage HTML response.
      if (homepage && normalized.status < 400) {
        return withHomepageHeaders(normalized);
      }
      if (isUnlistedPath(new URL(request.url).pathname)) {
        return withNoindexHeaders(normalized);
      }
      return normalized;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
