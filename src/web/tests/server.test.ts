import { describe, expect, test } from "bun:test";

import type { ApplicationOperations } from "../../application/index.ts";
import { WEB_DEFAULT_PORT, serveWebBlueprint } from "../server.ts";

const unreachable = () => {
  throw new Error("The web surface must not reach this operation");
};

const emptyPage = Object.freeze({ generation: 7, hasMore: false, items: Object.freeze([]) });

function stubOperations(overrides: Record<string, unknown> = {}): ApplicationOperations {
  return {
    createComponent: unreachable,
    exportBlueprint: unreachable,
    getComponent: unreachable,
    initialize: unreachable,
    listChildren: async () => Object.freeze({ ok: true as const, value: emptyPage }),
    listComponents: unreachable,
    listRoots: async () => Object.freeze({ ok: true as const, value: emptyPage }),
    mergeComponent: unreachable,
    removeComponent: unreachable,
    reparentComponent: unreachable,
    searchBlueprint: async () => Object.freeze({ ok: true as const, value: emptyPage }),
    traverseBlueprint: unreachable,
    updateComponent: unreachable,
    ...overrides,
  } as unknown as ApplicationOperations;
}

interface RunningServer {
  readonly outcome: Promise<Awaited<ReturnType<typeof serveWebBlueprint>>>;
  readonly stop: () => void;
  readonly url: string;
}

async function startServer(operations: ApplicationOperations): Promise<RunningServer> {
  const control = new AbortController();
  let announce: (url: string) => void = () => undefined;
  const ready = new Promise<string>((resolve) => {
    announce = resolve;
  });
  const outcome = serveWebBlueprint({
    cancellation: control.signal,
    frontend: () =>
      new Response('<div id="root">shell</div>', {
        headers: { "Content-Type": "text/html;charset=utf-8" },
      }),
    onReady: (url) => announce(url),
    operations,
    port: 0,
  });
  void outcome.then((value) => {
    if (!value.ok) announce("");
  });
  const url = await ready;
  if (url === "") throw new Error("The test server did not start");
  return { outcome, stop: () => control.abort(), url };
}

describe("embedded web blueprint server", () => {
  test("default port is the documented groma keypad port", () => {
    expect(WEB_DEFAULT_PORT).toBe(4766);
  });

  test("serves the frontend and bounded reads on the loopback interface only", async () => {
    const seen: unknown[] = [];
    const running = await startServer(
      stubOperations({
        listRoots: async (request: { readonly cursor?: unknown; readonly limit: number }) => {
          seen.push(request);
          return Object.freeze({ ok: true as const, value: emptyPage });
        },
      }),
    );
    expect(running.url.startsWith("http://127.0.0.1:")).toBeTrue();
    const document = await fetch(running.url);
    expect(document.status).toBe(200);
    expect(await document.text()).toContain('<div id="root">');
    const roots = await fetch(`${running.url}api/roots?limit=7&cursor=abc`);
    expect(roots.status).toBe(200);
    expect(roots.headers.get("Cache-Control")).toBe("no-store");
    expect(roots.headers.get("Content-Security-Policy")).toBe("default-src 'none'");
    expect(roots.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await roots.json()).toEqual({ ok: true, value: emptyPage });
    expect(seen).toEqual([{ cursor: "abc", limit: 7 }]);
    running.stop();
    const outcome = await running.outcome;
    expect(outcome.ok).toBeTrue();
    if (outcome.ok) expect(outcome.value.status).toBe("served");
  });

  test("passes children, component, and search requests through shared operations", async () => {
    const calls: string[] = [];
    const running = await startServer(
      stubOperations({
        getComponent: async (request: {
          readonly id: string;
          readonly relationships: { readonly limit: number };
        }) => {
          calls.push(`component:${request.id}:${request.relationships.limit}`);
          return Object.freeze({
            ok: true as const,
            value: Object.freeze({
              evidence: Object.freeze([]),
              generation: 7,
              item: Object.freeze({
                component: Object.freeze({ id: request.id, kind: "component" as const }),
                revision: "sha256:a",
              }),
              relationships: Object.freeze({ ...emptyPage }),
            }),
          });
        },
        listChildren: async (request: { readonly limit: number; readonly parent: string }) => {
          calls.push(`children:${request.parent}:${request.limit}`);
          return Object.freeze({ ok: true as const, value: emptyPage });
        },
        searchBlueprint: async (request: { readonly limit: number; readonly text: string }) => {
          calls.push(`search:${request.text}:${request.limit}`);
          return Object.freeze({ ok: true as const, value: emptyPage });
        },
      }),
    );
    expect((await fetch(`${running.url}api/children?parent=ent_1&limit=5`)).status).toBe(200);
    expect((await fetch(`${running.url}api/component?id=ent_2&limit=9`)).status).toBe(200);
    expect((await fetch(`${running.url}api/search?text=core&limit=3`)).status).toBe(200);
    expect(calls).toEqual(["children:ent_1:5", "component:ent_2:9", "search:core:3"]);
    running.stop();
    await running.outcome;
  });

  test("rejects invalid requests, unknown routes, and non-GET methods with structured errors", async () => {
    const running = await startServer(stubOperations());
    const badLimit = await fetch(`${running.url}api/roots?limit=101`);
    expect(badLimit.status).toBe(400);
    expect(await badLimit.json()).toMatchObject({
      diagnostics: [{ code: "web-invalid-request" }],
      ok: false,
    });
    expect((await fetch(`${running.url}api/roots?limit=0`)).status).toBe(400);
    expect((await fetch(`${running.url}api/roots`)).status).toBe(400);
    expect((await fetch(`${running.url}api/children?limit=5`)).status).toBe(400);
    expect((await fetch(`${running.url}api/component?limit=5`)).status).toBe(400);
    expect((await fetch(`${running.url}api/search?limit=5&text=${"x".repeat(257)}`)).status).toBe(
      400,
    );
    const unknown = await fetch(`${running.url}api/unknown`);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({
      diagnostics: [{ code: "web-unknown-route" }],
      ok: false,
    });
    const mutation = await fetch(`${running.url}api/roots?limit=5`, { method: "POST" });
    expect(mutation.status).toBe(405);
    expect(await mutation.json()).toMatchObject({
      diagnostics: [{ code: "web-method-not-allowed" }],
      ok: false,
    });
    running.stop();
    await running.outcome;
  });

  test("reports a failed read as a structured diagnostic instead of crashing", async () => {
    const running = await startServer(
      stubOperations({
        listRoots: async () => {
          throw new Error("projection unavailable");
        },
      }),
    );
    const failed = await fetch(`${running.url}api/roots?limit=5`);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({
      diagnostics: [{ code: "web-read-failed" }],
      ok: false,
    });
    running.stop();
    await running.outcome;
  });

  test("refuses a port that is already bound with a structured diagnostic", async () => {
    const running = await startServer(stubOperations());
    const control = new AbortController();
    const conflicted = await serveWebBlueprint({
      cancellation: control.signal,
      frontend: () => new Response("unused"),
      operations: stubOperations(),
      port: Number(new URL(running.url).port),
    });
    expect(conflicted.ok).toBeFalse();
    if (!conflicted.ok) expect(conflicted.diagnostic.code).toBe("web-server-unavailable");
    running.stop();
    await running.outcome;
  });
});
