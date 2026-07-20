import type { ApplicationOperations } from "../application/index.ts";

export const WEB_DEFAULT_PORT = 4766;
export const WEB_MIN_PAGE_LIMIT = 1;
export const WEB_MAX_PAGE_LIMIT = 100;
export const WEB_MAX_SEARCH_TEXT = 256;

/** A compiled HTML bundle route value or a test-injected responder. */
export type WebFrontend = Bun.HTMLBundle | ((request: Request) => Response | Promise<Response>);

export interface WebServeOptions {
  readonly cancellation: AbortSignal;
  readonly frontend: WebFrontend;
  readonly onReady?: (url: string) => void;
  readonly operations: ApplicationOperations;
  readonly port: number;
}

export type WebServeOutcome =
  | {
      readonly ok: true;
      readonly value: { readonly port: number; readonly status: "served"; readonly url: string };
    }
  | {
      readonly diagnostic: { readonly code: string; readonly message: string };
      readonly ok: false;
    };

const API_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'",
  "X-Content-Type-Options": "nosniff",
});

function apiJson(body: unknown, status: number): Response {
  return Response.json(body, { headers: API_HEADERS, status });
}

function apiFailure(status: number, code: string, message: string): Response {
  return apiJson({ diagnostics: [{ code, message }], ok: false }, status);
}

function parseLimit(url: URL): number | undefined {
  const raw = url.searchParams.get("limit");
  if (raw === null || !/^\d{1,3}$/.test(raw)) return undefined;
  const limit = Number.parseInt(raw, 10);
  return limit >= WEB_MIN_PAGE_LIMIT && limit <= WEB_MAX_PAGE_LIMIT ? limit : undefined;
}

function pageRequest(url: URL): { readonly cursor?: string; readonly limit: number } | undefined {
  const limit = parseLimit(url);
  if (limit === undefined) return undefined;
  const cursor = url.searchParams.get("cursor");
  return cursor === null ? { limit } : { cursor, limit };
}

type ApiHandler = (url: URL, operations: ApplicationOperations) => Promise<Response>;

const apiRoutes: ReadonlyMap<string, ApiHandler> = new Map<string, ApiHandler>([
  [
    "/api/roots",
    async (url, operations) => {
      const page = pageRequest(url);
      if (page === undefined) {
        return apiFailure(400, "web-invalid-request", "limit must be an integer from 1 to 100");
      }
      return apiJson(await operations.listRoots(page), 200);
    },
  ],
  [
    "/api/children",
    async (url, operations) => {
      const page = pageRequest(url);
      const parent = url.searchParams.get("parent");
      if (page === undefined || parent === null || parent.length === 0) {
        return apiFailure(
          400,
          "web-invalid-request",
          "children requires parent and a limit from 1 to 100",
        );
      }
      return apiJson(await operations.listChildren({ ...page, parent }), 200);
    },
  ],
  [
    "/api/component",
    async (url, operations) => {
      const page = pageRequest(url);
      const id = url.searchParams.get("id");
      if (page === undefined || id === null || id.length === 0) {
        return apiFailure(
          400,
          "web-invalid-request",
          "component requires id and a relationships limit from 1 to 100",
        );
      }
      return apiJson(await operations.getComponent({ id, relationships: page }), 200);
    },
  ],
  [
    // One bounded page of components with their relationships: the canvas needs
    // dependency edges for everything it draws, not one component at a time.
    "/api/connections",
    async (url, operations) => {
      const page = pageRequest(url);
      if (page === undefined) {
        return apiFailure(400, "web-invalid-request", "limit must be an integer from 1 to 100");
      }
      return apiJson(await operations.exportBlueprint(page), 200);
    },
  ],
  [
    "/api/search",
    async (url, operations) => {
      const page = pageRequest(url);
      const text = url.searchParams.get("text");
      if (
        page === undefined ||
        text === null ||
        text.length === 0 ||
        text.length > WEB_MAX_SEARCH_TEXT
      ) {
        return apiFailure(
          400,
          "web-invalid-request",
          "search requires text of 1 to 256 characters and a limit from 1 to 100",
        );
      }
      return apiJson(await operations.searchBlueprint({ ...page, text }), 200);
    },
  ],
]);

async function handleApi(request: Request, operations: ApplicationOperations): Promise<Response> {
  const url = new URL(request.url);
  const handler = apiRoutes.get(url.pathname);
  if (handler === undefined) {
    return apiFailure(404, "web-unknown-route", "The requested route does not exist");
  }
  if (request.method !== "GET") {
    return apiFailure(405, "web-method-not-allowed", "The blueprint API is read-only; use GET");
  }
  try {
    return await handler(url, operations);
  } catch {
    return apiFailure(500, "web-read-failed", "The bounded read could not be completed");
  }
}

/**
 * Serve the embedded web blueprint on the loopback interface until the cancellation
 * signal aborts. The server exposes only bounded GET reads through the shared
 * application operations; it is not a mutation surface.
 */
export async function serveWebBlueprint(options: WebServeOptions): Promise<WebServeOutcome> {
  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({
      development: false,
      hostname: "127.0.0.1",
      port: options.port,
      reusePort: false,
      routes: {
        "/": options.frontend,
        "/api/*": (request: Request) => handleApi(request, options.operations),
      },
      fetch(request: Request): Response {
        const url = new URL(request.url);
        return url.pathname.startsWith("/api/")
          ? apiFailure(404, "web-unknown-route", "The requested route does not exist")
          : apiFailure(404, "web-unknown-route", "Only the embedded blueprint is served here");
      },
    });
  } catch {
    return Object.freeze({
      diagnostic: Object.freeze({
        code: "web-server-unavailable",
        message: `The web server could not bind 127.0.0.1:${options.port}`,
      }),
      ok: false as const,
    });
  }
  const port = server.port ?? options.port;
  const url = `http://127.0.0.1:${port}/`;
  options.onReady?.(url);
  await new Promise<void>((resolve) => {
    if (options.cancellation.aborted) {
      resolve();
      return;
    }
    options.cancellation.addEventListener("abort", () => resolve(), { once: true });
  });
  await server.stop(true);
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({ port, status: "served" as const, url }),
  });
}
