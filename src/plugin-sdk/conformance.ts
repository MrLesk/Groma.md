import {
  failure,
  PluginRuntime,
  success,
  type CapabilityCardinality,
  type Diagnostic,
  type PluginCancellation,
  type PluginRegistration,
  type PluginRuntimeBounds,
  type Result,
  type RunningPluginGraph,
} from "../core/index.ts";

export type PluginConformanceCaseName =
  | "cancellation"
  | "declared-cardinality"
  | "deterministic-results"
  | "lifecycle"
  | "provider-behavior";

export interface PluginConformanceFixtureRequest {
  readonly cancellation: PluginCancellation;
  readonly registrationOrder: "forward" | "reverse";
}

export interface PluginConformanceFixture {
  /** Stable code returned when startup is requested with cancellation already set. */
  readonly cancellationDiagnosticCode: string;
  start(request: PluginConformanceFixtureRequest): Promise<Result<RunningPluginGraph>>;
}

export interface PluginProviderConformanceCheck {
  readonly cardinality: CapabilityCardinality;
  readonly id: string;
  readonly pluginId?: string;
  readonly version: string;
  verify(value: unknown): boolean | Promise<boolean>;
}

export interface PluginConformanceSubject {
  readonly fixture: PluginConformanceFixture;
  readonly providers?: readonly PluginProviderConformanceCheck[];
}

export interface PluginConformanceCaseResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly name: PluginConformanceCaseName;
  readonly ok: boolean;
}

export interface PluginConformanceReport {
  readonly cases: readonly PluginConformanceCaseResult[];
  readonly diagnostics: readonly Diagnostic[];
  readonly ok: boolean;
}

const noCancellation: PluginCancellation = Object.freeze({
  isCancellationRequested: () => false,
});
const cancelled: PluginCancellation = Object.freeze({
  isCancellationRequested: () => true,
});

function diagnostic(
  code: string,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>,
): Diagnostic {
  return Object.freeze(
    details === undefined
      ? { code, message }
      : { code, details: Object.freeze({ ...details }), message },
  );
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function caseResult(
  name: PluginConformanceCaseName,
  diagnostics: readonly Diagnostic[],
): PluginConformanceCaseResult {
  return Object.freeze({
    diagnostics: Object.freeze([...diagnostics]),
    name,
    ok: diagnostics.length === 0,
  });
}

async function startFixture(
  fixture: PluginConformanceFixture,
  registrationOrder: "forward" | "reverse",
  cancellation: PluginCancellation,
): Promise<Result<RunningPluginGraph>> {
  try {
    return await fixture.start(Object.freeze({ cancellation, registrationOrder }));
  } catch {
    return failure(
      diagnostic(
        "plugin-conformance-fixture-failed",
        "Plugin conformance fixture failed before producing a runtime result",
      ),
    );
  }
}

async function cleanup(graphs: readonly RunningPluginGraph[]): Promise<readonly Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (const graph of graphs) {
    try {
      const result = await graph.shutdown();
      if (!result.ok) diagnostics.push(...result.diagnostics);
    } catch {
      diagnostics.push(
        diagnostic(
          "plugin-conformance-cleanup-failed",
          "Plugin conformance cleanup did not complete through the runtime contract",
        ),
      );
    }
  }
  return Object.freeze(diagnostics);
}

async function deterministicResults(
  fixture: PluginConformanceFixture,
): Promise<PluginConformanceCaseResult> {
  const name = "deterministic-results" as const;
  const forward = await startFixture(fixture, "forward", noCancellation);
  const reverse = await startFixture(fixture, "reverse", noCancellation);
  const running = [forward, reverse].flatMap((result) => (result.ok ? [result.value] : []));
  const diagnostics: Diagnostic[] = [
    ...(forward.ok ? [] : forward.diagnostics),
    ...(reverse.ok ? [] : reverse.diagnostics),
  ];
  if (forward.ok && reverse.ok) {
    try {
      if (stable(forward.value.inspect()) !== stable(reverse.value.inspect())) {
        diagnostics.push(
          diagnostic(
            "plugin-conformance-nondeterministic",
            "Equivalent registration sets produced different runtime inspections",
          ),
        );
      }
    } catch {
      diagnostics.push(
        diagnostic(
          "plugin-conformance-inspection-failed",
          "Plugin graph inspection failed during deterministic conformance",
        ),
      );
    }
  }
  diagnostics.push(...(await cleanup(running)));
  return caseResult(name, diagnostics);
}

async function lifecycle(fixture: PluginConformanceFixture): Promise<PluginConformanceCaseResult> {
  const name = "lifecycle" as const;
  const started = await startFixture(fixture, "forward", noCancellation);
  if (!started.ok) return caseResult(name, started.diagnostics);
  const diagnostics: Diagnostic[] = [];
  let needsCleanup = true;
  try {
    const inspection = started.value.inspect();
    const expected = inspection.plugins.map((plugin) => plugin.id).reverse();
    const first = await started.value.shutdown();
    needsCleanup = false;
    const second = await started.value.shutdown();
    if (
      !first.ok ||
      !second.ok ||
      stable(first) !== stable(second) ||
      first.value.state !== "stopped" ||
      stable(first.value.stoppedPluginIds) !== stable(expected) ||
      started.value.inspect().state !== "stopped"
    ) {
      diagnostics.push(
        diagnostic(
          "plugin-conformance-lifecycle-failed",
          "Plugin lifecycle did not stop once in reverse dependency order with an idempotent result",
        ),
      );
      if (!first.ok) diagnostics.push(...first.diagnostics);
      else if (!second.ok) diagnostics.push(...second.diagnostics);
    }
  } catch {
    diagnostics.push(
      diagnostic(
        "plugin-conformance-lifecycle-failed",
        "Plugin lifecycle failed while exercising the public running-graph contract",
      ),
    );
  }
  if (needsCleanup) diagnostics.push(...(await cleanup([started.value])));
  return caseResult(name, diagnostics);
}

async function cancellation(
  fixture: PluginConformanceFixture,
): Promise<PluginConformanceCaseResult> {
  const name = "cancellation" as const;
  const started = await startFixture(fixture, "forward", cancelled);
  if (started.ok) {
    const diagnostics = [
      diagnostic(
        "plugin-conformance-cancellation-failed",
        "Plugin startup succeeded even though cancellation was already requested",
      ),
      ...(await cleanup([started.value])),
    ];
    return caseResult(name, diagnostics);
  }
  return started.diagnostics.length === 1 &&
    started.diagnostics[0]?.code === fixture.cancellationDiagnosticCode
    ? caseResult(name, [])
    : caseResult(name, [
        diagnostic(
          "plugin-conformance-cancellation-failed",
          "Cancelled startup did not return only the fixture's stable cancellation diagnostic",
          {
            actualCodes: started.diagnostics
              .map((item) => item.code)
              .sort(compareCodeUnits)
              .join(","),
            expectedCode: fixture.cancellationDiagnosticCode,
          },
        ),
        ...started.diagnostics.filter((item) => item.code !== fixture.cancellationDiagnosticCode),
      ]);
}

async function declaredCardinality(
  fixture: PluginConformanceFixture,
): Promise<PluginConformanceCaseResult> {
  const name = "declared-cardinality" as const;
  const started = await startFixture(fixture, "forward", noCancellation);
  if (!started.ok) return caseResult(name, started.diagnostics);
  const diagnostics: Diagnostic[] = [];
  try {
    const capabilityDeclarations = new Map<
      string,
      {
        readonly cardinalities: Set<CapabilityCardinality>;
        readonly declarationKeys: string[];
      }
    >();
    const versionDeclarations = new Map<
      string,
      {
        readonly pluginIds: string[];
      }
    >();
    for (const plugin of started.value.inspect().plugins) {
      for (const declaration of plugin.provides) {
        const key = `${declaration.id}\0${declaration.version}`;
        const capability = capabilityDeclarations.get(declaration.id) ?? {
          cardinalities: new Set<CapabilityCardinality>(),
          declarationKeys: [],
        };
        capability.cardinalities.add(declaration.cardinality);
        capability.declarationKeys.push(`${plugin.id}\0${declaration.version}`);
        capabilityDeclarations.set(declaration.id, capability);
        const current = versionDeclarations.get(key) ?? {
          pluginIds: [],
        };
        current.pluginIds.push(plugin.id);
        versionDeclarations.set(key, current);
      }
    }
    const invalidCapabilityIds = new Set<string>();
    for (const [id, declaration] of capabilityDeclarations) {
      const uniqueDeclarations = new Set(declaration.declarationKeys);
      if (
        declaration.cardinalities.size !== 1 ||
        uniqueDeclarations.size !== declaration.declarationKeys.length ||
        (declaration.cardinalities.has("single") && declaration.declarationKeys.length !== 1)
      ) {
        invalidCapabilityIds.add(id);
        diagnostics.push(
          diagnostic(
            "plugin-conformance-cardinality-failed",
            "Plugin manifests disagree about cardinality or contain duplicate provider declarations",
            { capabilityId: id },
          ),
        );
      }
    }
    for (const [key, declaration] of versionDeclarations) {
      const separator = key.indexOf("\0");
      const id = key.slice(0, separator);
      const version = key.slice(separator + 1);
      if (invalidCapabilityIds.has(id)) continue;
      const expected = declaration.pluginIds.sort(compareCodeUnits);
      const actual = started.value
        .capabilities(id, version)
        .map((provider) => provider.pluginId)
        .sort(compareCodeUnits);
      if (stable(actual) !== stable(expected)) {
        diagnostics.push(
          diagnostic(
            "plugin-conformance-cardinality-failed",
            "Runtime provider results do not match the plugin manifests' declared cardinality",
            { capabilityId: id, version },
          ),
        );
      }
    }
  } catch {
    diagnostics.push(
      diagnostic(
        "plugin-conformance-cardinality-failed",
        "Declared provider cardinality could not be inspected through the public contract",
      ),
    );
  }
  diagnostics.push(...(await cleanup([started.value])));
  return caseResult(name, diagnostics);
}

async function providerBehavior(
  subject: PluginConformanceSubject,
): Promise<PluginConformanceCaseResult> {
  const name = "provider-behavior" as const;
  const started = await startFixture(subject.fixture, "forward", noCancellation);
  if (!started.ok) return caseResult(name, started.diagnostics);
  const diagnostics: Diagnostic[] = [];
  for (const check of subject.providers ?? []) {
    let providers;
    try {
      providers = started.value.capabilities(check.id, check.version);
    } catch {
      diagnostics.push(
        diagnostic(
          "plugin-provider-conformance-failed",
          "Provider lookup failed during capability-specific conformance",
          { capabilityId: check.id },
        ),
      );
      continue;
    }
    const selected =
      check.pluginId === undefined
        ? providers
        : providers.filter((provider) => provider.pluginId === check.pluginId);
    if (selected.length === 0 || (check.cardinality === "single" && selected.length !== 1)) {
      diagnostics.push(
        diagnostic(
          "plugin-provider-conformance-failed",
          "Provider selection does not match the capability-specific conformance declaration",
          { capabilityId: check.id, version: check.version },
        ),
      );
      continue;
    }
    for (const provider of selected) {
      let conforms = false;
      try {
        conforms = (await check.verify(provider.value)) === true;
      } catch {
        conforms = false;
      }
      if (!conforms) {
        diagnostics.push(
          diagnostic(
            "plugin-provider-conformance-failed",
            "Provider failed its capability-specific conformance check",
            { capabilityId: check.id, pluginId: provider.pluginId, version: check.version },
          ),
        );
      }
    }
  }
  diagnostics.push(...(await cleanup([started.value])));
  return caseResult(name, diagnostics);
}

/**
 * Create the standard fixture for a plugin or plugin set. Every case gets a new
 * runtime and a fresh registration set, so a conformance run cannot reuse provider
 * state from another case.
 */
export function createPluginRuntimeConformanceFixture(
  registrations: () => readonly PluginRegistration[],
  bounds?: Partial<PluginRuntimeBounds>,
): PluginConformanceFixture {
  const runtimeBounds = bounds === undefined ? undefined : Object.freeze({ ...bounds });
  return Object.freeze({
    cancellationDiagnosticCode: "plugin-start-cancelled",
    start: async (request: PluginConformanceFixtureRequest) => {
      let provided: readonly PluginRegistration[];
      try {
        provided = registrations();
      } catch {
        return failure(
          diagnostic(
            "plugin-conformance-fixture-failed",
            "Plugin registration factory failed during conformance",
          ),
        );
      }
      const ordered =
        request.registrationOrder === "reverse" ? [...provided].reverse() : [...provided];
      const runtime = new PluginRuntime(runtimeBounds);
      const resolved = runtime.resolve(ordered);
      return resolved.ok ? runtime.start(resolved.value, request.cancellation) : resolved;
    },
  });
}

/** Run every public conformance case without depending on a particular test runner. */
export async function runPluginConformanceSuite(
  subject: PluginConformanceSubject,
): Promise<PluginConformanceReport> {
  const cases = Object.freeze([
    await deterministicResults(subject.fixture),
    await lifecycle(subject.fixture),
    await cancellation(subject.fixture),
    await declaredCardinality(subject.fixture),
    await providerBehavior(subject),
  ]);
  const diagnostics = Object.freeze(cases.flatMap((item) => item.diagnostics));
  return Object.freeze({ cases, diagnostics, ok: diagnostics.length === 0 });
}
