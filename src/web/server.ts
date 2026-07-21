import type {
  ApplicationOperations,
  CreateComponentRequest,
  MergeComponentRequest,
  RemoveComponentRequest,
  ReparentComponentRequest,
  UpdateComponentRequest,
} from "../application/index.ts";

export const WEB_DEFAULT_PORT = 4766;
export const WEB_MIN_PAGE_LIMIT = 1;
export const WEB_MAX_PAGE_LIMIT = 100;
export const WEB_MAX_SEARCH_TEXT = 256;
export const WEB_MAX_MUTATION_BODY_BYTES = 256 * 1_024;

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

type ApiReadHandler = (url: URL, operations: ApplicationOperations) => Promise<Response>;
type ApiMutationHandler = (body: unknown, operations: ApplicationOperations) => Promise<unknown>;

const apiReadRoutes: ReadonlyMap<string, ApiReadHandler> = new Map<string, ApiReadHandler>([
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

const apiMutationRoutes: ReadonlyMap<string, ApiMutationHandler> = new Map<
  string,
  ApiMutationHandler
>([
  [
    "/api/component/create",
    (body, operations) => operations.createComponent(body as CreateComponentRequest),
  ],
  [
    "/api/component/update",
    (body, operations) => operations.updateComponent(body as UpdateComponentRequest),
  ],
  [
    "/api/component/move",
    (body, operations) => operations.reparentComponent(body as ReparentComponentRequest),
  ],
  [
    "/api/component/merge",
    (body, operations) => operations.mergeComponent(body as MergeComponentRequest),
  ],
  [
    "/api/component/remove",
    (body, operations) => operations.removeComponent(body as RemoveComponentRequest),
  ],
]);

function requestProtection(
  request: Request,
  listenerAuthority: string,
  mutation: boolean,
): Response | undefined {
  if (request.headers.get("host") !== listenerAuthority) {
    return apiFailure(
      403,
      "web-invalid-host",
      "The request Host does not match the loopback listener",
    );
  }
  const origin = request.headers.get("origin");
  const listenerOrigin = `http://${listenerAuthority}`;
  if (origin !== null && origin !== listenerOrigin) {
    return apiFailure(
      403,
      "web-invalid-origin",
      "The request Origin does not match the loopback listener",
    );
  }
  if (mutation && origin === null) {
    return apiFailure(403, "web-origin-required", "Blueprint mutations require a browser Origin");
  }
  return undefined;
}

async function mutationBody(request: Request): Promise<unknown | Response> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > WEB_MAX_MUTATION_BODY_BYTES)) {
    return apiFailure(
      413,
      "web-request-too-large",
      `Mutation bodies must not exceed ${WEB_MAX_MUTATION_BODY_BYTES} bytes`,
    );
  }
  try {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > WEB_MAX_MUTATION_BODY_BYTES) {
      return apiFailure(
        413,
        "web-request-too-large",
        `Mutation bodies must not exceed ${WEB_MAX_MUTATION_BODY_BYTES} bytes`,
      );
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return apiFailure(400, "web-invalid-json", "Mutation requests require one JSON value");
  }
}

async function handleApi(
  request: Request,
  operations: ApplicationOperations,
  listenerAuthority: string,
): Promise<Response> {
  const url = new URL(request.url);
  const readHandler = apiReadRoutes.get(url.pathname);
  const mutationHandler = apiMutationRoutes.get(url.pathname);
  const protection = requestProtection(request, listenerAuthority, mutationHandler !== undefined);
  if (protection !== undefined) return protection;
  if (readHandler === undefined && mutationHandler === undefined) {
    return apiFailure(404, "web-unknown-route", "The requested route does not exist");
  }
  if (readHandler !== undefined) {
    if (request.method !== "GET") {
      return apiFailure(405, "web-method-not-allowed", "This blueprint route requires GET");
    }
    try {
      return await readHandler(url, operations);
    } catch {
      return apiFailure(500, "web-read-failed", "The bounded read could not be completed");
    }
  }
  if (mutationHandler === undefined) {
    return apiFailure(404, "web-unknown-route", "The requested route does not exist");
  }
  if (request.method !== "POST") {
    return apiFailure(405, "web-method-not-allowed", "This blueprint route requires POST");
  }
  const body = await mutationBody(request);
  if (body instanceof Response) return body;
  try {
    return apiJson(await mutationHandler(body, operations), 200);
  } catch {
    return apiFailure(500, "web-mutation-failed", "The blueprint mutation could not be completed");
  }
}

/**
 * Serve the embedded web blueprint on the loopback interface until the cancellation
 * signal aborts. Reads and mutations use the shared application operations; browser
 * writes require the exact Origin and every API request requires the listener Host.
 */
export async function serveWebBlueprint(options: WebServeOptions): Promise<WebServeOutcome> {
  let server: ReturnType<typeof Bun.serve>;
  let listenerAuthority: string | undefined;
  try {
    server = Bun.serve({
      development: false,
      hostname: "127.0.0.1",
      maxRequestBodySize: WEB_MAX_MUTATION_BODY_BYTES,
      port: options.port,
      reusePort: false,
      routes: {
        "/": options.frontend,
        "/api/*": (request: Request) =>
          listenerAuthority === undefined
            ? apiFailure(503, "web-server-starting", "The loopback listener is starting")
            : handleApi(request, options.operations, listenerAuthority),
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
  listenerAuthority = `127.0.0.1:${port}`;
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
