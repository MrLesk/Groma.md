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

function mutate(running: RunningServer, route: string, body: unknown): Promise<Response> {
  return fetch(`${running.url}api/component/${route}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(running.url).origin,
    },
    method: "POST",
  });
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

  test("maps each mutation route directly onto its shared application operation", async () => {
    const calls: { readonly operation: string; readonly request: unknown }[] = [];
    const committed = (operation: string, request: unknown) => {
      calls.push({ operation, request });
      return Object.freeze({
        affected: Object.freeze({
          components: Object.freeze([]),
          relationships: Object.freeze([]),
        }),
        generation: 8,
        revisions: Object.freeze([]),
        status: "committed" as const,
        value: operation,
      });
    };
    const running = await startServer(
      stubOperations({
        createComponent: async (request: unknown) => committed("create", request),
        mergeComponent: async (request: unknown) => committed("merge", request),
        removeComponent: async (request: unknown) => committed("remove", request),
        reparentComponent: async (request: unknown) => committed("move", request),
        updateComponent: async (request: unknown) => committed("update", request),
      }),
    );
    const requests = [
      ["create", { component: { id: "ent_create" } }],
      ["update", { expectedRevision: "sha256:update", id: "ent_update", patch: { scale: "part" } }],
      ["move", { expectedRevision: "sha256:move", id: "ent_move", parent: null }],
      [
        "merge",
        { expectedRevision: "sha256:merge", obsolete: "ent_obsolete", survivor: "ent_survivor" },
      ],
      ["remove", { expectedRevision: "sha256:remove", id: "ent_remove" }],
    ] as const;
    for (const [route, request] of requests) {
      const response = await mutate(running, route, request);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: "committed", value: route });
    }
    expect(calls).toEqual(requests.map(([operation, request]) => ({ operation, request })));
    running.stop();
    await running.outcome;
  });

  test("preserves revision conflicts and named remove and merge blockers", async () => {
    const rejected = (code: string, message: string) =>
      Object.freeze({
        diagnostics: Object.freeze([Object.freeze({ code, message })]),
        status: "validation-rejected" as const,
      });
    const running = await startServer(
      stubOperations({
        mergeComponent: async () =>
          rejected("component-alias-cycle", "A merge cannot supersede a component through itself"),
        removeComponent: async () =>
          rejected(
            "component-has-children",
            "Component children must be explicitly reparented or removed first",
          ),
        updateComponent: async () =>
          Object.freeze({
            diagnostics: Object.freeze([
              Object.freeze({
                code: "content-revision-conflict",
                message: "Component content revision does not match the expected value",
              }),
            ]),
            status: "conflict" as const,
          }),
      }),
    );
    expect(
      await (
        await mutate(running, "update", {
          expectedRevision: "sha256:stale",
          id: "ent_update",
          patch: { name: "Stale" },
        })
      ).json(),
    ).toMatchObject({ diagnostics: [{ code: "content-revision-conflict" }], status: "conflict" });
    expect(
      await (
        await mutate(running, "merge", {
          expectedRevision: "sha256:merge",
          obsolete: "ent_obsolete",
          survivor: "ent_survivor",
        })
      ).json(),
    ).toMatchObject({
      diagnostics: [
        { code: "component-alias-cycle", message: expect.stringContaining("through itself") },
      ],
      status: "validation-rejected",
    });
    expect(
      await (
        await mutate(running, "remove", {
          expectedRevision: "sha256:remove",
          id: "ent_remove",
        })
      ).json(),
    ).toMatchObject({
      diagnostics: [
        { code: "component-has-children", message: expect.stringContaining("reparented") },
      ],
      status: "validation-rejected",
    });
    running.stop();
    await running.outcome;
  });

  test("rejects cross-origin and DNS-rebinding API requests", async () => {
    const running = await startServer(stubOperations());
    const hostileOrigin = await fetch(`${running.url}api/roots?limit=5`, {
      headers: { Origin: "https://attacker.example" },
    });
    expect(hostileOrigin.status).toBe(403);
    expect(await hostileOrigin.json()).toMatchObject({
      diagnostics: [{ code: "web-invalid-origin" }],
      ok: false,
    });
    const hostileHost = await fetch(`${running.url}api/roots?limit=5`, {
      headers: { Host: "attacker.example" },
    });
    expect(hostileHost.status).toBe(403);
    expect(await hostileHost.json()).toMatchObject({
      diagnostics: [{ code: "web-invalid-host" }],
      ok: false,
    });
    const missingOrigin = await fetch(`${running.url}api/component/remove`, {
      body: JSON.stringify({ expectedRevision: "sha256:a", id: "ent_remove" }),
      method: "POST",
    });
    expect(missingOrigin.status).toBe(403);
    expect(await missingOrigin.json()).toMatchObject({
      diagnostics: [{ code: "web-origin-required" }],
      ok: false,
    });
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
    const wrongMutationMethod = await fetch(`${running.url}api/component/remove`, {
      headers: { Origin: new URL(running.url).origin },
    });
    expect(wrongMutationMethod.status).toBe(405);
    const malformed = await fetch(`${running.url}api/component/create`, {
      body: "not-json",
      headers: { Origin: new URL(running.url).origin },
      method: "POST",
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      diagnostics: [{ code: "web-invalid-json" }],
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
