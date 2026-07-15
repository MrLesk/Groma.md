import { describe, expect, test } from "bun:test";

import {
  PluginRuntime,
  pluginRuntimeApiVersion,
  type CapabilityCardinality,
  type PluginCapabilityDeclaration,
  type PluginPhase,
  type PluginRegistration,
  type PluginStartContext,
  type PluginStartResult,
  type RunningPluginGraph,
} from "../index.ts";

const capability = (
  id: string,
  cardinality: CapabilityCardinality = "single",
  version = "1.0.0",
): PluginCapabilityDeclaration => ({ cardinality, id, version });

interface RegistrationOptions {
  readonly apiVersion?: string;
  readonly id: string;
  readonly phase?: PluginPhase;
  readonly provides?: readonly PluginCapabilityDeclaration[];
  readonly requires?: readonly PluginCapabilityDeclaration[];
  readonly start?: (context: PluginStartContext) => PluginStartResult | Promise<PluginStartResult>;
  readonly version?: string;
}

function registration(options: RegistrationOptions): PluginRegistration {
  const provides = options.provides ?? [];
  return {
    manifest: {
      apiVersion: options.apiVersion ?? pluginRuntimeApiVersion,
      id: options.id,
      phase: options.phase ?? 1,
      provides,
      requires: options.requires ?? [],
      version: options.version ?? "1.0.0",
    },
    start:
      options.start ??
      (() => ({
        capabilities: provides.map((provided) => ({
          id: provided.id,
          value: Object.freeze({ provider: options.id }),
          version: provided.version,
        })),
      })),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function diagnosticProjection(value: ReturnType<PluginRuntime["resolve"]>) {
  return value.ok
    ? []
    : value.diagnostics.map((item) => ({ code: item.code, details: item.details }));
}

describe("phased plugin resolver", () => {
  test("resolves both phases into one deterministic dependency-safe graph", () => {
    const runtime = new PluginRuntime();
    const resources = capability("groma.resources/v1");
    const model = capability("groma.model/v1");
    const operations = capability("groma.operations/v1");
    const plugins = [
      registration({
        id: "official.application",
        provides: [operations],
        requires: [resources, model],
      }),
      registration({ id: "official.model", provides: [model] }),
      registration({ id: "official.resources", phase: 0, provides: [resources] }),
    ];

    const forward = runtime.resolve(plugins);
    const reverse = runtime.resolve([...plugins].reverse());

    expect(forward.ok).toBeTrue();
    expect(reverse.ok).toBeTrue();
    if (!forward.ok || !reverse.ok) return;
    expect(forward.value.inspect()).toEqual(reverse.value.inspect());
    expect(forward.value.inspect()).toEqual({
      apiVersion: pluginRuntimeApiVersion,
      plugins: [
        {
          dependencies: [],
          id: "official.resources",
          phase: 0,
          provides: [resources],
          requires: [],
          version: "1.0.0",
        },
        {
          dependencies: [],
          id: "official.model",
          phase: 1,
          provides: [model],
          requires: [],
          version: "1.0.0",
        },
        {
          dependencies: ["official.model", "official.resources"],
          id: "official.application",
          phase: 1,
          provides: [operations],
          requires: [model, resources],
          version: "1.0.0",
        },
      ],
    });
  });

  test("reports missing, API, capability-version, cardinality, and phase failures before start", () => {
    let starts = 0;
    const runtime = new PluginRuntime();
    const single = capability("groma.single/v1");
    const multiple = capability("groma.multiple/v1", "multiple");
    const result = runtime.resolve([
      registration({ apiVersion: "groma.plugin/v2", id: "bad.api" }),
      registration({ id: "phase.one", phase: 1, provides: [single, multiple] }),
      registration({
        id: "phase.zero",
        phase: 0,
        requires: [
          capability("groma.missing/v1"),
          capability("groma.single/v1", "single", "2.0.0"),
          capability("groma.multiple/v1", "single"),
          single,
        ],
        start: () => {
          starts += 1;
          return { capabilities: [] };
        },
      }),
    ]);

    expect(result.ok).toBeFalse();
    expect(diagnosticProjection(result)).toEqual([
      {
        code: "incompatible-capability-version",
        details: {
          availableVersions: "1.0.0",
          capabilityId: "groma.single/v1",
          pluginId: "phase.zero",
          requiredVersion: "2.0.0",
        },
      },
      {
        code: "incompatible-plugin-api-version",
        details: {
          actualVersion: "groma.plugin/v2",
          expectedVersion: pluginRuntimeApiVersion,
          pluginId: "bad.api",
        },
      },
      {
        code: "invalid-capability-cardinality",
        details: { capabilityId: "groma.multiple/v1", pluginId: "phase.zero" },
      },
      {
        code: "missing-capability-provider",
        details: {
          capabilityId: "groma.missing/v1",
          pluginId: "phase.zero",
          requiredVersion: "1.0.0",
        },
      },
      {
        code: "plugin-phase-inversion",
        details: {
          capabilityId: "groma.single/v1",
          pluginId: "phase.zero",
          providerPluginId: "phase.one",
        },
      },
    ]);
    expect(starts).toBe(0);
  });

  test("rejects single-provider collisions, provider cardinality disagreement, and cycles", () => {
    const runtime = new PluginRuntime();
    const collision = capability("groma.collision/v1");
    const cardinalitySingle = capability("groma.cardinality/v1");
    const cardinalityMultiple = capability("groma.cardinality/v1", "multiple");
    const left = capability("groma.left/v1");
    const right = capability("groma.right/v1");

    const result = runtime.resolve([
      registration({ id: "collision.a", provides: [collision] }),
      registration({ id: "collision.b", provides: [collision] }),
      registration({ id: "cardinality.a", provides: [cardinalitySingle] }),
      registration({ id: "cardinality.b", provides: [cardinalityMultiple] }),
      registration({ id: "cycle.left", provides: [left], requires: [right] }),
      registration({ id: "cycle.right", provides: [right], requires: [left] }),
    ]);

    expect(result.ok).toBeFalse();
    expect(diagnosticProjection(result)).toEqual([
      {
        code: "capability-provider-collision",
        details: {
          capabilityId: "groma.cardinality/v1",
          providerPluginIds: "cardinality.a,cardinality.b",
        },
      },
      {
        code: "capability-provider-collision",
        details: {
          capabilityId: "groma.collision/v1",
          providerPluginIds: "collision.a,collision.b",
        },
      },
      {
        code: "invalid-capability-cardinality",
        details: { capabilityId: "groma.cardinality/v1" },
      },
      {
        code: "plugin-dependency-cycle",
        details: { pluginIds: "cycle.left,cycle.right" },
      },
    ]);
  });

  test("orders diagnostics identically across registration order", () => {
    const runtime = new PluginRuntime();
    const plugins = [
      registration({ id: "zeta", requires: [capability("groma.zeta/v1")] }),
      registration({ id: "alpha", requires: [capability("groma.alpha/v1")] }),
    ];

    expect(diagnosticProjection(runtime.resolve(plugins))).toEqual(
      diagnosticProjection(runtime.resolve([...plugins].reverse())),
    );
  });

  test("excludes every duplicate ID without first-registration-wins behavior", () => {
    const runtime = new PluginRuntime();
    const providedOnlyByDuplicate = capability("groma.duplicate-only/v1");
    const starts: string[] = [];
    const duplicates = [
      registration({
        id: "duplicate.plugin",
        provides: [providedOnlyByDuplicate],
        start: () => {
          starts.push("provider");
          return {
            capabilities: [
              {
                id: providedOnlyByDuplicate.id,
                value: {},
                version: providedOnlyByDuplicate.version,
              },
            ],
          };
        },
      }),
      registration({
        id: "duplicate.plugin",
        requires: [capability("groma.unavailable/v1")],
        start: () => {
          starts.push("consumer");
          return { capabilities: [] };
        },
      }),
    ];
    const consumer = registration({
      id: "ordinary.consumer",
      requires: [providedOnlyByDuplicate],
    });

    const forward = runtime.resolve([...duplicates, consumer]);
    const reverse = runtime.resolve([[...duplicates].reverse(), [consumer]].flat());

    expect(diagnosticProjection(forward)).toEqual(diagnosticProjection(reverse));
    expect(diagnosticProjection(forward)).toEqual([
      {
        code: "duplicate-plugin-registration",
        details: { pluginId: "duplicate.plugin", registrationCount: 2 },
      },
      {
        code: "missing-capability-provider",
        details: {
          capabilityId: "groma.duplicate-only/v1",
          pluginId: "ordinary.consumer",
          requiredVersion: "1.0.0",
        },
      },
    ]);
    expect(starts).toEqual([]);
  });

  test("uses code-unit ordering and rejects non-ASCII identity tokens", async () => {
    const runtime = new PluginRuntime();
    const multiple = capability("groma.code-unit/v1", "multiple");
    const observedProviders: string[] = [];
    const plugins = [
      registration({
        id: "provider.a.z",
        provides: [multiple],
        start: () => ({
          capabilities: [{ id: multiple.id, value: "dot", version: multiple.version }],
        }),
      }),
      registration({
        id: "provider.a-z",
        provides: [multiple],
        start: () => ({
          capabilities: [{ id: multiple.id, value: "hyphen", version: multiple.version }],
        }),
      }),
      registration({
        id: "consumer",
        requires: [multiple],
        start: (context) => {
          observedProviders.push(
            ...(context.requirements[0]?.providers.map((provider) => provider.pluginId) ?? []),
          );
          return { capabilities: [] };
        },
      }),
    ];
    const forward = runtime.resolve(plugins);
    const reverse = runtime.resolve([...plugins].reverse());
    expect(forward.ok).toBeTrue();
    expect(reverse.ok).toBeTrue();
    if (!forward.ok || !reverse.ok) return;
    expect(forward.value.inspect()).toEqual(reverse.value.inspect());
    expect(forward.value.inspect().plugins.map((plugin) => plugin.id)).toEqual([
      "provider.a-z",
      "provider.a.z",
      "consumer",
    ]);
    expect((await runtime.start(forward.value)).ok).toBeTrue();
    expect(observedProviders).toEqual(["provider.a-z", "provider.a.z"]);

    expect(runtime.resolve([registration({ id: "plugin.é" })])).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-registration" }],
      ok: false,
    });
    const incompatible = runtime.resolve([
      registration({
        id: "version.ten",
        provides: [capability("groma.version-order/v1", "multiple", "10.0.0")],
      }),
      registration({
        id: "version.two",
        provides: [capability("groma.version-order/v1", "multiple", "2.0.0")],
      }),
      registration({
        id: "version.consumer",
        requires: [capability("groma.version-order/v1", "multiple", "3.0.0")],
      }),
    ]);
    expect(diagnosticProjection(incompatible)).toEqual([
      {
        code: "incompatible-capability-version",
        details: {
          availableVersions: "10.0.0,2.0.0",
          capabilityId: "groma.version-order/v1",
          pluginId: "version.consumer",
          requiredVersion: "3.0.0",
        },
      },
    ]);
  });

  test("exact-validates registrations and enforces collection bounds before start", () => {
    let starts = 0;
    const runtime = new PluginRuntime({ maxPlugins: 1 });
    const extraField = {
      ...registration({
        id: "invalid.registration",
        start: () => {
          starts += 1;
          return { capabilities: [] };
        },
      }),
      privatePath: "/private/plugin",
    };
    const malformedVersion = registration({ id: "invalid.version", version: "1.0" });

    expect(runtime.resolve([extraField])).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-registration" }],
      ok: false,
    });
    expect(new PluginRuntime().resolve([malformedVersion])).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-registration" }],
      ok: false,
    });
    expect(
      runtime.resolve([
        registration({ id: "bounded.alpha" }),
        registration({ id: "bounded.beta" }),
      ]),
    ).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-registration" }],
      ok: false,
    });
    expect(starts).toBe(0);
  });
});

describe("plugin lifecycle", () => {
  test("delivers every multiple provider in stable order and cleans dependents first", async () => {
    const runtime = new PluginRuntime();
    const events: string[] = [];
    const scanner = capability("groma.scanner/v1", "multiple");
    const service = capability("groma.service/v1");
    const plugins = [
      registration({
        id: "scanner.zeta",
        provides: [scanner],
        start: () => {
          events.push("start:scanner.zeta");
          return {
            capabilities: [{ id: scanner.id, value: "zeta", version: scanner.version }],
            stop: async () => {
              events.push("stop:scanner.zeta");
            },
          };
        },
      }),
      registration({
        id: "consumer",
        provides: [service],
        requires: [scanner],
        start: (context) => {
          events.push("start:consumer");
          expect(context.requirements[0]?.providers).toEqual([
            { pluginId: "scanner.alpha", value: "alpha" },
            { pluginId: "scanner.zeta", value: "zeta" },
          ]);
          return {
            capabilities: [{ id: service.id, value: "service", version: service.version }],
            stop: () => {
              events.push("stop:consumer");
            },
          };
        },
      }),
      registration({
        id: "scanner.alpha",
        provides: [scanner],
        start: () => {
          events.push("start:scanner.alpha");
          return {
            capabilities: [{ id: scanner.id, value: "alpha", version: scanner.version }],
            stop: () => {
              events.push("stop:scanner.alpha");
            },
          };
        },
      }),
    ];
    const resolved = runtime.resolve(plugins);
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) return;

    const running = await runtime.start(resolved.value);
    expect(running.ok).toBeTrue();
    if (!running.ok) return;
    expect(running.value.capabilities(scanner.id, scanner.version)).toEqual([
      { pluginId: "scanner.alpha", value: "alpha" },
      { pluginId: "scanner.zeta", value: "zeta" },
    ]);
    expect(events).toEqual(["start:scanner.alpha", "start:scanner.zeta", "start:consumer"]);

    expect(await running.value.shutdown()).toEqual({
      ok: true,
      value: {
        state: "stopped",
        stoppedPluginIds: ["consumer", "scanner.zeta", "scanner.alpha"],
      },
    });
    expect(events).toEqual([
      "start:scanner.alpha",
      "start:scanner.zeta",
      "start:consumer",
      "stop:consumer",
      "stop:scanner.zeta",
      "stop:scanner.alpha",
    ]);
  });

  test("rolls back a start failure in reverse dependency order", async () => {
    const runtime = new PluginRuntime();
    const events: string[] = [];
    const base = capability("groma.base/v1");
    const middle = capability("groma.middle/v1");
    const resolved = runtime.resolve([
      registration({
        id: "base",
        provides: [base],
        start: () => {
          events.push("start:base");
          return {
            capabilities: [{ id: base.id, value: {}, version: base.version }],
            stop: () => {
              events.push("stop:base");
            },
          };
        },
      }),
      registration({
        id: "middle",
        provides: [middle],
        requires: [base],
        start: () => {
          events.push("start:middle");
          return {
            capabilities: [{ id: middle.id, value: {}, version: middle.version }],
            stop: () => {
              events.push("stop:middle");
            },
          };
        },
      }),
      registration({
        id: "top",
        requires: [middle],
        start: () => {
          events.push("start:top");
          throw new Error("private failure");
        },
      }),
    ]);
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) return;

    const started = await runtime.start(resolved.value);

    expect(started).toEqual({
      diagnostics: [
        {
          code: "plugin-start-failed",
          details: { pluginId: "top" },
          message: "Plugin start callback failed",
        },
      ],
      ok: false,
    });
    expect(events).toEqual(["start:base", "start:middle", "start:top", "stop:middle", "stop:base"]);
  });

  test("rolls back malformed capability outputs without starting dependents", async () => {
    const runtime = new PluginRuntime();
    const events: string[] = [];
    const base = capability("groma.base/v1");
    const dependent = capability("groma.dependent/v1");
    const resolved = runtime.resolve([
      registration({
        id: "base",
        provides: [base],
        start: () => ({
          capabilities: [{ id: base.id, value: {}, version: base.version }],
          stop: () => {
            events.push("stop:base");
          },
        }),
      }),
      registration({
        id: "malformed",
        provides: [dependent],
        requires: [base],
        start: () => ({ capabilities: [] }),
      }),
      registration({
        id: "never",
        requires: [dependent],
        start: () => {
          events.push("start:never");
          return { capabilities: [] };
        },
      }),
    ]);
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) return;

    expect(await runtime.start(resolved.value)).toMatchObject({
      diagnostics: [{ code: "invalid-plugin-start-result", details: { pluginId: "malformed" } }],
      ok: false,
    });
    expect(events).toEqual(["stop:base"]);
  });

  test("contains cancellation during startup and cancels a running graph", async () => {
    const runtime = new PluginRuntime();
    const events: string[] = [];
    let requested = false;
    const first = capability("groma.first/v1");
    const second = capability("groma.second/v1");
    const resolved = runtime.resolve([
      registration({
        id: "first",
        provides: [first],
        start: () => {
          events.push("start:first");
          requested = true;
          return {
            capabilities: [{ id: first.id, value: {}, version: first.version }],
            stop: () => {
              events.push("stop:first");
            },
          };
        },
      }),
      registration({ id: "second", provides: [second], requires: [first] }),
    ]);
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) return;

    const cancelledStart = await runtime.start(resolved.value, {
      isCancellationRequested: () => requested,
    });
    expect(cancelledStart).toMatchObject({
      diagnostics: [{ code: "plugin-start-cancelled", details: { pluginId: "first" } }],
      ok: false,
    });
    expect(events).toEqual(["start:first", "stop:first"]);

    requested = false;
    events.length = 0;
    const running = await runtime.start(resolved.value, {
      isCancellationRequested: () => false,
    });
    expect(running.ok).toBeTrue();
    if (!running.ok) return;
    expect(await running.value.cancel()).toMatchObject({
      ok: true,
      value: { state: "cancelled", stoppedPluginIds: ["second", "first"] },
    });
    expect(running.value.inspect().state).toBe("cancelled");
  });

  test("contains stop failures and invokes every cleanup exactly once", async () => {
    const runtime = new PluginRuntime();
    const counts = new Map<string, number>();
    const base = capability("groma.base/v1");
    const resolved = runtime.resolve([
      registration({
        id: "base",
        provides: [base],
        start: () => ({
          capabilities: [{ id: base.id, value: {}, version: base.version }],
          stop: () => {
            counts.set("base", (counts.get("base") ?? 0) + 1);
          },
        }),
      }),
      registration({
        id: "dependent",
        requires: [base],
        start: () => ({
          capabilities: [],
          stop: async () => {
            counts.set("dependent", (counts.get("dependent") ?? 0) + 1);
            throw new Error("private cleanup failure");
          },
        }),
      }),
    ]);
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) return;
    const running = await runtime.start(resolved.value);
    expect(running.ok).toBeTrue();
    if (!running.ok) return;

    const first = running.value.shutdown();
    const second = running.value.shutdown();
    expect(second).toBe(first);
    expect(await first).toEqual({
      diagnostics: [
        {
          code: "plugin-stop-failed",
          details: { pluginId: "dependent" },
          message: "Plugin cleanup failed",
        },
      ],
      ok: false,
    });
    expect(counts).toEqual(
      new Map([
        ["dependent", 1],
        ["base", 1],
      ]),
    );
    expect(running.value.inspect()).toMatchObject({
      plugins: [
        { id: "base", state: "stopped" },
        { id: "dependent", state: "failed" },
      ],
      state: "failed",
    });
  });

  test("reserves one cleanup Promise and first reason before reentrant stop callbacks", async () => {
    const runtime = new PluginRuntime();
    const events: string[] = [];
    const releaseDependent = deferred<void>();
    const base = capability("groma.reentrant-base/v1");
    let graph!: RunningPluginGraph;
    let reentrantCancel: Promise<unknown> | undefined;
    let reentrantShutdown: Promise<unknown> | undefined;
    const resolved = runtime.resolve([
      registration({
        id: "base",
        provides: [base],
        start: () => ({
          capabilities: [{ id: base.id, value: {}, version: base.version }],
          stop: () => {
            events.push("base:stop");
          },
        }),
      }),
      registration({
        id: "dependent",
        requires: [base],
        start: () => ({
          capabilities: [],
          stop: () => {
            events.push("dependent:stop:start");
            reentrantCancel = graph.cancel();
            reentrantShutdown = graph.shutdown();
            return releaseDependent.promise.then(() => {
              events.push("dependent:stop:end");
            });
          },
        }),
      }),
    ]);
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) return;
    const started = await runtime.start(resolved.value);
    expect(started.ok).toBeTrue();
    if (!started.ok) return;
    graph = started.value;

    const first = graph.shutdown();
    expect(reentrantCancel).toBe(first);
    expect(reentrantShutdown).toBe(first);
    expect(events).toEqual(["dependent:stop:start"]);
    releaseDependent.resolve();

    expect(await first).toEqual({
      ok: true,
      value: { state: "stopped", stoppedPluginIds: ["dependent", "base"] },
    });
    expect(events).toEqual(["dependent:stop:start", "dependent:stop:end", "base:stop"]);
    expect(await graph.cancel()).toEqual({
      ok: true,
      value: { state: "stopped", stoppedPluginIds: ["dependent", "base"] },
    });
  });
});
