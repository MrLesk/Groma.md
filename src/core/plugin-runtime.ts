import { observeNativePromise } from "./promise-observation.ts";
import { failure, type Diagnostic, type Result, success } from "./result.ts";
import { inspectExactRecord, inspectIntrinsicArrayLength } from "./runtime.ts";

export const pluginRuntimeApiVersion = "groma.plugin/v1" as const;

export type PluginPhase = 0 | 1;
export type CapabilityCardinality = "multiple" | "single";

export interface PluginCapabilityDeclaration {
  readonly cardinality: CapabilityCardinality;
  readonly id: string;
  readonly version: string;
}

export interface PluginCapabilityRequirement extends PluginCapabilityDeclaration {}

export interface PluginManifest {
  readonly apiVersion: string;
  readonly id: string;
  readonly phase: PluginPhase;
  readonly provides: readonly PluginCapabilityDeclaration[];
  readonly requires: readonly PluginCapabilityRequirement[];
  readonly version: string;
}

export interface PluginCapabilityOutput {
  readonly id: string;
  readonly value: unknown;
  readonly version: string;
}

export interface PluginCapabilityProvider {
  readonly pluginId: string;
  readonly value: unknown;
}

export interface PluginResolvedRequirement {
  readonly cardinality: CapabilityCardinality;
  readonly id: string;
  readonly providers: readonly PluginCapabilityProvider[];
  readonly version: string;
}

export interface PluginCancellation {
  isCancellationRequested(): boolean;
}

export interface PluginStartContext {
  readonly cancellation: PluginCancellation;
  readonly requirements: readonly PluginResolvedRequirement[];
}

export interface PluginStartResult {
  readonly capabilities: readonly PluginCapabilityOutput[];
  readonly stop?: () => Promise<void> | void;
}

export interface PluginRegistration {
  readonly manifest: PluginManifest;
  start(context: PluginStartContext): PluginStartResult | Promise<PluginStartResult>;
}

export interface PluginRuntimeBounds {
  readonly maxCapabilitiesPerPlugin: number;
  readonly maxDiagnostics: number;
  readonly maxPlugins: number;
  readonly maxTokenCharacters: number;
}

export interface ResolvedPluginInspection {
  readonly dependencies: readonly string[];
  readonly id: string;
  readonly phase: PluginPhase;
  readonly provides: readonly PluginCapabilityDeclaration[];
  readonly requires: readonly PluginCapabilityRequirement[];
  readonly version: string;
}

export interface ResolvedPluginGraphInspection {
  readonly apiVersion: typeof pluginRuntimeApiVersion;
  /** Dependency-safe start order, with stable plugin-ID ordering for independent plugins. */
  readonly plugins: readonly ResolvedPluginInspection[];
}

export interface ResolvedPluginGraph {
  inspect(): ResolvedPluginGraphInspection;
}

export type PluginRuntimeState =
  "cancelled" | "cancelling" | "failed" | "running" | "stopped" | "stopping";

export type RunningPluginState = "failed" | "running" | "stopped";

export interface RunningPluginInspection extends ResolvedPluginInspection {
  readonly state: RunningPluginState;
}

export interface RunningPluginGraphInspection {
  readonly apiVersion: typeof pluginRuntimeApiVersion;
  readonly plugins: readonly RunningPluginInspection[];
  readonly state: PluginRuntimeState;
}

export interface PluginShutdownReport {
  readonly state: "cancelled" | "stopped";
  readonly stoppedPluginIds: readonly string[];
}

export interface RunningPluginGraph {
  cancel(): Promise<Result<PluginShutdownReport>>;
  capabilities(id: string, version: string): readonly PluginCapabilityProvider[];
  inspect(): RunningPluginGraphInspection;
  shutdown(): Promise<Result<PluginShutdownReport>>;
}

interface CanonicalPluginRegistration {
  readonly manifest: PluginManifest;
  readonly receiver: object;
  readonly start: PluginRegistration["start"];
}

interface ResolvedPluginRecord {
  readonly dependencies: readonly string[];
  readonly registration: CanonicalPluginRegistration;
}

interface ResolvedGraphRecord {
  readonly inspection: ResolvedPluginGraphInspection;
  readonly order: readonly ResolvedPluginRecord[];
}

interface StartedPluginRecord {
  readonly outputs: ReadonlyMap<string, PluginCapabilityOutput>;
  readonly plugin: ResolvedPluginRecord;
  readonly stop?: () => Promise<void> | void;
  state: RunningPluginState;
  stopped: boolean;
}

const defaultPluginRuntimeBounds: PluginRuntimeBounds = Object.freeze({
  maxCapabilitiesPerPlugin: 64,
  maxDiagnostics: 256,
  maxPlugins: 128,
  maxTokenCharacters: 128,
});

const capabilityIdPattern =
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*(?:\/[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*)*\/v[1-9][0-9]*$/;
const pluginIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const exactVersionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const intrinsicReflectApply = Reflect.apply;

const resolvedGraphs = new WeakMap<object, ResolvedGraphRecord>();

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

function diagnosticsKey(value: Diagnostic): string {
  const details = value.details;
  if (details === undefined) return `${value.code}\u0000${value.message}`;
  return `${value.code}\u0000${Object.keys(details)
    .sort()
    .map((key) => `${key}=${String(details[key])}`)
    .join("\u0000")}\u0000${value.message}`;
}

function sortedDiagnostics(values: readonly Diagnostic[], limit: number): readonly Diagnostic[] {
  const sorted = [...values].sort((left, right) =>
    diagnosticsKey(left).localeCompare(diagnosticsKey(right)),
  );
  if (sorted.length <= limit) return Object.freeze(sorted);
  return Object.freeze([
    ...sorted.slice(0, Math.max(0, limit - 1)),
    diagnostic(
      "plugin-diagnostic-limit-exceeded",
      "Plugin resolution produced more diagnostics than the configured bound",
      { maxDiagnostics: limit },
    ),
  ]);
}

function invalidRegistration(reason: string, registrationIndex: number): Diagnostic {
  return diagnostic(
    "invalid-plugin-registration",
    "Plugin registration does not match the exact bounded runtime contract",
    { reason, registrationIndex },
  );
}

function inspectBoundedArray(
  value: unknown,
  maximum: number,
  registrationIndex: number,
  subject: string,
): Result<readonly unknown[]> {
  const inspectedLength = inspectIntrinsicArrayLength(
    value,
    "invalid-plugin-registration",
    subject,
  );
  if (!inspectedLength.ok) {
    return failure(invalidRegistration(`${subject} must be an intrinsic array`, registrationIndex));
  }
  if (inspectedLength.value > maximum) {
    return failure(
      invalidRegistration(`${subject} exceeds its configured item bound`, registrationIndex),
    );
  }
  try {
    const source = value as unknown[];
    const keys = Reflect.ownKeys(source);
    if (keys.length !== inspectedLength.value + 1 || !keys.includes("length")) {
      return failure(
        invalidRegistration(`${subject} must not contain extra properties`, registrationIndex),
      );
    }
    const copied: unknown[] = [];
    for (let index = 0; index < inspectedLength.value; index += 1) {
      if (!keys.includes(String(index))) {
        return failure(invalidRegistration(`${subject} must not be sparse`, registrationIndex));
      }
      const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure(
          invalidRegistration(
            `${subject} items must be enumerable data properties`,
            registrationIndex,
          ),
        );
      }
      copied.push(descriptor.value);
    }
    return success(Object.freeze(copied));
  } catch {
    return failure(invalidRegistration(`${subject} inspection failed`, registrationIndex));
  }
}

function validToken(value: unknown, pattern: RegExp, maximum: number): value is string {
  return typeof value === "string" && value.length <= maximum && pattern.test(value);
}

function canonicalCapabilityDeclarations(
  value: unknown,
  bounds: PluginRuntimeBounds,
  registrationIndex: number,
  subject: "provides" | "requires",
): Result<readonly PluginCapabilityDeclaration[]> {
  const list = inspectBoundedArray(
    value,
    bounds.maxCapabilitiesPerPlugin,
    registrationIndex,
    `Plugin manifest ${subject}`,
  );
  if (!list.ok) return list;
  const declarations: PluginCapabilityDeclaration[] = [];
  const seen = new Set<string>();
  for (const item of list.value) {
    const inspected = inspectExactRecord(
      item,
      [["cardinality", "id", "version"]],
      "invalid-plugin-registration",
      `Plugin manifest ${subject} item`,
    );
    if (!inspected.ok) {
      return failure(
        invalidRegistration(`${subject} item has an invalid shape`, registrationIndex),
      );
    }
    const cardinality = inspected.value.cardinality;
    const id = inspected.value.id;
    const version = inspected.value.version;
    if (
      (cardinality !== "single" && cardinality !== "multiple") ||
      !validToken(id, capabilityIdPattern, bounds.maxTokenCharacters) ||
      !validToken(version, exactVersionPattern, bounds.maxTokenCharacters)
    ) {
      return failure(invalidRegistration(`${subject} item has invalid values`, registrationIndex));
    }
    const key = `${id}\u0000${version}`;
    if (seen.has(key)) {
      return failure(
        invalidRegistration(`${subject} contains a duplicate capability`, registrationIndex),
      );
    }
    seen.add(key);
    declarations.push(Object.freeze({ cardinality, id, version }));
  }
  return success(
    Object.freeze(
      declarations.sort(
        (left, right) =>
          left.id.localeCompare(right.id) || left.version.localeCompare(right.version),
      ),
    ),
  );
}

function canonicalRegistration(
  value: unknown,
  bounds: PluginRuntimeBounds,
  registrationIndex: number,
): Result<CanonicalPluginRegistration> {
  const registration = inspectExactRecord(
    value,
    [["manifest", "start"]],
    "invalid-plugin-registration",
    "Plugin registration",
  );
  if (!registration.ok || typeof registration.value.start !== "function") {
    return failure(invalidRegistration("registration has an invalid shape", registrationIndex));
  }
  const manifest = inspectExactRecord(
    registration.value.manifest,
    [["apiVersion", "id", "phase", "provides", "requires", "version"]],
    "invalid-plugin-registration",
    "Plugin manifest",
  );
  if (!manifest.ok) {
    return failure(invalidRegistration("manifest has an invalid shape", registrationIndex));
  }
  if (
    typeof manifest.value.apiVersion !== "string" ||
    manifest.value.apiVersion.length > bounds.maxTokenCharacters ||
    !validToken(manifest.value.id, pluginIdPattern, bounds.maxTokenCharacters) ||
    (manifest.value.phase !== 0 && manifest.value.phase !== 1) ||
    !validToken(manifest.value.version, exactVersionPattern, bounds.maxTokenCharacters)
  ) {
    return failure(invalidRegistration("manifest has invalid values", registrationIndex));
  }
  const provides = canonicalCapabilityDeclarations(
    manifest.value.provides,
    bounds,
    registrationIndex,
    "provides",
  );
  if (!provides.ok) return provides;
  const requires = canonicalCapabilityDeclarations(
    manifest.value.requires,
    bounds,
    registrationIndex,
    "requires",
  );
  if (!requires.ok) return requires;
  return success(
    Object.freeze({
      manifest: Object.freeze({
        apiVersion: manifest.value.apiVersion,
        id: manifest.value.id,
        phase: manifest.value.phase,
        provides: provides.value,
        requires: requires.value,
        version: manifest.value.version,
      }),
      receiver: value as object,
      start: registration.value.start as PluginRegistration["start"],
    }),
  );
}

function capabilityKey(id: string, version: string): string {
  return `${id}\u0000${version}`;
}

function cycleDiagnostics(
  plugins: ReadonlyMap<string, ResolvedPluginRecord>,
): readonly Diagnostic[] {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycles = new Set<string>();

  const visit = (id: string): void => {
    state.set(id, 1);
    stack.push(id);
    const plugin = plugins.get(id);
    for (const dependency of plugin?.dependencies ?? []) {
      const dependencyState = state.get(dependency) ?? 0;
      if (dependencyState === 0) {
        visit(dependency);
      } else if (dependencyState === 1) {
        const start = stack.lastIndexOf(dependency);
        const members = stack.slice(start).sort();
        cycles.add(members.join(","));
      }
    }
    stack.pop();
    state.set(id, 2);
  };

  for (const id of [...plugins.keys()].sort()) {
    if ((state.get(id) ?? 0) === 0) visit(id);
  }
  return Object.freeze(
    [...cycles]
      .sort()
      .map((pluginIds) =>
        diagnostic(
          "plugin-dependency-cycle",
          "Plugin dependencies contain a cycle that must be removed before startup",
          { pluginIds },
        ),
      ),
  );
}

function topologicalOrder(
  plugins: ReadonlyMap<string, ResolvedPluginRecord>,
): readonly ResolvedPluginRecord[] {
  const remaining = new Map<string, Set<string>>();
  for (const [id, plugin] of plugins) remaining.set(id, new Set(plugin.dependencies));
  const ordered: ResolvedPluginRecord[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([id]) => id)
      .sort((left, right) => {
        const leftPhase = plugins.get(left)!.registration.manifest.phase;
        const rightPhase = plugins.get(right)!.registration.manifest.phase;
        return leftPhase - rightPhase || left.localeCompare(right);
      });
    if (ready.length === 0) return Object.freeze([]);
    const next = ready[0]!;
    ordered.push(plugins.get(next)!);
    remaining.delete(next);
    for (const dependencies of remaining.values()) dependencies.delete(next);
  }
  return Object.freeze(ordered);
}

function inspectionFor(plugin: ResolvedPluginRecord): ResolvedPluginInspection {
  const manifest = plugin.registration.manifest;
  return Object.freeze({
    dependencies: plugin.dependencies,
    id: manifest.id,
    phase: manifest.phase,
    provides: manifest.provides,
    requires: manifest.requires,
    version: manifest.version,
  });
}

function canonicalBounds(value?: Partial<PluginRuntimeBounds>): PluginRuntimeBounds {
  const merged = { ...defaultPluginRuntimeBounds, ...value };
  for (const [name, bound] of Object.entries(merged)) {
    if (!Number.isSafeInteger(bound) || bound <= 0) {
      throw new TypeError(`Plugin runtime bound ${name} must be a positive safe integer`);
    }
  }
  return Object.freeze(merged);
}

function observeCallbackResult(
  value: unknown,
): Promise<{ readonly ok: boolean; readonly value?: unknown }> {
  const observed = observeNativePromise(
    value,
    (settled) => ({ ok: true, value: settled }),
    () => ({ ok: false }),
  );
  if (observed.status === "observed") return observed.promise;
  return Promise.resolve(observed.status === "not-native" ? { ok: true, value } : { ok: false });
}

function canonicalStartResult(
  value: unknown,
  plugin: ResolvedPluginRecord,
): Result<{
  readonly outputs: ReadonlyMap<string, PluginCapabilityOutput>;
  readonly stop?: () => Promise<void> | void;
}> {
  const pluginId = plugin.registration.manifest.id;
  const result = inspectExactRecord(
    value,
    [["capabilities"], ["capabilities", "stop"]],
    "invalid-plugin-start-result",
    "Plugin start result",
  );
  if (
    !result.ok ||
    (Object.hasOwn(result.value, "stop") && typeof result.value.stop !== "function")
  ) {
    return failure(
      diagnostic(
        "invalid-plugin-start-result",
        "Plugin start returned a malformed lifecycle result",
        { pluginId },
      ),
    );
  }
  const outputs = inspectBoundedArray(
    result.value.capabilities,
    plugin.registration.manifest.provides.length,
    0,
    "Plugin start capabilities",
  );
  if (!outputs.ok || outputs.value.length !== plugin.registration.manifest.provides.length) {
    return failure(
      diagnostic(
        "invalid-plugin-start-result",
        "Plugin start did not return every declared capability exactly once",
        { pluginId },
      ),
    );
  }
  const expected = new Map(
    plugin.registration.manifest.provides.map((provided) => [
      capabilityKey(provided.id, provided.version),
      provided,
    ]),
  );
  const canonical = new Map<string, PluginCapabilityOutput>();
  for (const item of outputs.value) {
    const output = inspectExactRecord(
      item,
      [["id", "value", "version"]],
      "invalid-plugin-start-result",
      "Plugin capability output",
    );
    if (
      !output.ok ||
      typeof output.value.id !== "string" ||
      typeof output.value.version !== "string" ||
      output.value.value === undefined
    ) {
      return failure(
        diagnostic(
          "invalid-plugin-start-result",
          "Plugin start returned a malformed capability output",
          { pluginId },
        ),
      );
    }
    const key = capabilityKey(output.value.id, output.value.version);
    if (!expected.has(key) || canonical.has(key)) {
      return failure(
        diagnostic(
          "invalid-plugin-start-result",
          "Plugin start returned an undeclared or duplicate capability",
          { capabilityId: output.value.id, pluginId },
        ),
      );
    }
    canonical.set(
      key,
      Object.freeze({
        id: output.value.id,
        value: output.value.value,
        version: output.value.version,
      }),
    );
  }
  const receiver = value as object;
  const stop = result.value.stop;
  return success(
    Object.freeze({
      outputs: canonical,
      ...(typeof stop === "function"
        ? {
            stop: () => intrinsicReflectApply(stop, receiver, []) as Promise<void> | void,
          }
        : {}),
    }),
  );
}

async function invokeStop(plugin: StartedPluginRecord): Promise<Diagnostic | undefined> {
  if (plugin.stopped) return undefined;
  plugin.stopped = true;
  if (plugin.stop === undefined) {
    plugin.state = "stopped";
    return undefined;
  }
  let raw: unknown;
  try {
    raw = plugin.stop();
  } catch {
    plugin.state = "failed";
    return diagnostic("plugin-stop-failed", "Plugin cleanup failed", {
      pluginId: plugin.plugin.registration.manifest.id,
    });
  }
  const observed = await observeCallbackResult(raw);
  if (!observed.ok || observed.value !== undefined) {
    plugin.state = "failed";
    return diagnostic("plugin-stop-failed", "Plugin cleanup failed", {
      pluginId: plugin.plugin.registration.manifest.id,
    });
  }
  plugin.state = "stopped";
  return undefined;
}

async function cleanupStarted(
  plugins: readonly StartedPluginRecord[],
): Promise<readonly Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (let index = plugins.length - 1; index >= 0; index -= 1) {
    const stopped = await invokeStop(plugins[index]!);
    if (stopped !== undefined) diagnostics.push(stopped);
  }
  return Object.freeze(diagnostics);
}

function canonicalCancellation(value: unknown): Result<PluginCancellation> {
  const inspected = inspectExactRecord(
    value,
    [["isCancellationRequested"]],
    "invalid-plugin-cancellation",
    "Plugin cancellation",
  );
  if (!inspected.ok || typeof inspected.value.isCancellationRequested !== "function") {
    return failure(
      diagnostic(
        "invalid-plugin-cancellation",
        "Plugin cancellation does not match the runtime contract",
      ),
    );
  }
  const receiver = value as object;
  const isCancellationRequested = inspected.value.isCancellationRequested;
  return success(
    Object.freeze({
      isCancellationRequested: () => {
        const requested = intrinsicReflectApply(isCancellationRequested, receiver, []);
        if (requested !== true && requested !== false) {
          throw new TypeError("Plugin cancellation must return a boolean");
        }
        return requested;
      },
    }),
  );
}

function cancellationRequested(value: PluginCancellation): Result<boolean> {
  try {
    return success(value.isCancellationRequested());
  } catch {
    return failure(
      diagnostic(
        "invalid-plugin-cancellation",
        "Plugin cancellation failed while checking runtime state",
      ),
    );
  }
}

function runningGraph(
  graph: ResolvedGraphRecord,
  started: readonly StartedPluginRecord[],
): RunningPluginGraph {
  let state: PluginRuntimeState = "running";
  let cleanup: Promise<Result<PluginShutdownReport>> | undefined;
  const providers = new Map<string, PluginCapabilityProvider[]>();
  for (const plugin of started) {
    for (const [key, output] of plugin.outputs) {
      const current = providers.get(key) ?? [];
      current.push(
        Object.freeze({ pluginId: plugin.plugin.registration.manifest.id, value: output.value }),
      );
      providers.set(key, current);
    }
  }
  for (const values of providers.values()) {
    values.sort((left, right) => left.pluginId.localeCompare(right.pluginId));
    Object.freeze(values);
  }

  const inspect = (): RunningPluginGraphInspection =>
    Object.freeze({
      apiVersion: pluginRuntimeApiVersion,
      plugins: Object.freeze(
        started.map((plugin) =>
          Object.freeze({ ...inspectionFor(plugin.plugin), state: plugin.state }),
        ),
      ),
      state,
    });

  const stop = (reason: "cancelled" | "stopped"): Promise<Result<PluginShutdownReport>> => {
    if (cleanup !== undefined) return cleanup;
    state = reason === "cancelled" ? "cancelling" : "stopping";
    cleanup = (async () => {
      const diagnostics = await cleanupStarted(started);
      if (diagnostics.length > 0) {
        state = "failed";
        return failure<PluginShutdownReport>(...diagnostics);
      }
      state = reason;
      return success(
        Object.freeze({
          state: reason,
          stoppedPluginIds: Object.freeze(
            [...started].reverse().map((plugin) => plugin.plugin.registration.manifest.id),
          ),
        }),
      );
    })();
    return cleanup;
  };

  return Object.freeze({
    cancel: () => stop("cancelled"),
    capabilities: (id: string, version: string) => {
      if (!capabilityIdPattern.test(id) || !exactVersionPattern.test(version)) {
        return Object.freeze([]);
      }
      return providers.get(capabilityKey(id, version)) ?? Object.freeze([]);
    },
    inspect,
    shutdown: () => stop("stopped"),
  });
}

export class PluginRuntime {
  readonly #bounds: PluginRuntimeBounds;

  constructor(bounds?: Partial<PluginRuntimeBounds>) {
    this.#bounds = canonicalBounds(bounds);
  }

  resolve(registrations: unknown): Result<ResolvedPluginGraph> {
    const list = inspectBoundedArray(
      registrations,
      this.#bounds.maxPlugins,
      0,
      "Plugin registrations",
    );
    if (!list.ok) return failure(...list.diagnostics);

    const canonical: CanonicalPluginRegistration[] = [];
    const diagnostics: Diagnostic[] = [];
    for (let index = 0; index < list.value.length; index += 1) {
      const registration = canonicalRegistration(list.value[index], this.#bounds, index);
      if (!registration.ok) {
        diagnostics.push(...registration.diagnostics);
      } else {
        canonical.push(registration.value);
      }
    }
    canonical.sort((left, right) => left.manifest.id.localeCompare(right.manifest.id));

    const byId = new Map<string, ResolvedPluginRecord>();
    for (const registration of canonical) {
      if (registration.manifest.apiVersion !== pluginRuntimeApiVersion) {
        diagnostics.push(
          diagnostic(
            "incompatible-plugin-api-version",
            "Plugin API version is incompatible with this runtime",
            {
              actualVersion: registration.manifest.apiVersion,
              expectedVersion: pluginRuntimeApiVersion,
              pluginId: registration.manifest.id,
            },
          ),
        );
      }
      if (byId.has(registration.manifest.id)) {
        diagnostics.push(
          diagnostic("duplicate-plugin-registration", "Plugin IDs must be unique", {
            pluginId: registration.manifest.id,
          }),
        );
      } else {
        byId.set(
          registration.manifest.id,
          Object.freeze({ dependencies: Object.freeze([]), registration }),
        );
      }
    }

    const providersById = new Map<
      string,
      { readonly declaration: PluginCapabilityDeclaration; readonly pluginId: string }[]
    >();
    for (const plugin of byId.values()) {
      for (const declaration of plugin.registration.manifest.provides) {
        const current = providersById.get(declaration.id) ?? [];
        current.push({ declaration, pluginId: plugin.registration.manifest.id });
        providersById.set(declaration.id, current);
      }
    }
    for (const [id, providers] of providersById) {
      providers.sort(
        (left, right) =>
          left.pluginId.localeCompare(right.pluginId) ||
          left.declaration.version.localeCompare(right.declaration.version),
      );
      const cardinalities = new Set(providers.map((provider) => provider.declaration.cardinality));
      if (cardinalities.size > 1) {
        diagnostics.push(
          diagnostic(
            "invalid-capability-cardinality",
            "Capability providers disagree about provider cardinality",
            { capabilityId: id },
          ),
        );
      }
      if (
        providers.some((provider) => provider.declaration.cardinality === "single") &&
        providers.length > 1
      ) {
        diagnostics.push(
          diagnostic(
            "capability-provider-collision",
            "A single-provider capability has more than one registered provider",
            {
              capabilityId: id,
              providerPluginIds: providers.map((item) => item.pluginId).join(","),
            },
          ),
        );
      }
    }

    const dependencies = new Map<string, Set<string>>();
    for (const id of byId.keys()) dependencies.set(id, new Set());
    for (const plugin of byId.values()) {
      const manifest = plugin.registration.manifest;
      for (const requirement of manifest.requires) {
        const available = providersById.get(requirement.id) ?? [];
        if (available.length === 0) {
          diagnostics.push(
            diagnostic(
              "missing-capability-provider",
              "A required capability has no registered provider",
              {
                capabilityId: requirement.id,
                pluginId: manifest.id,
                requiredVersion: requirement.version,
              },
            ),
          );
          continue;
        }
        const compatible = available.filter(
          (provider) => provider.declaration.version === requirement.version,
        );
        if (compatible.length === 0) {
          diagnostics.push(
            diagnostic(
              "incompatible-capability-version",
              "No provider supplies the exact required capability version",
              {
                availableVersions: [...new Set(available.map((item) => item.declaration.version))]
                  .sort()
                  .join(","),
                capabilityId: requirement.id,
                pluginId: manifest.id,
                requiredVersion: requirement.version,
              },
            ),
          );
          continue;
        }
        if (
          compatible.some(
            (provider) => provider.declaration.cardinality !== requirement.cardinality,
          )
        ) {
          diagnostics.push(
            diagnostic(
              "invalid-capability-cardinality",
              "Capability requirement cardinality does not match its providers",
              { capabilityId: requirement.id, pluginId: manifest.id },
            ),
          );
          continue;
        }
        for (const provider of compatible) {
          const providerPlugin = byId.get(provider.pluginId)!;
          if (manifest.phase === 0 && providerPlugin.registration.manifest.phase === 1) {
            diagnostics.push(
              diagnostic(
                "plugin-phase-inversion",
                "A Phase 0 plugin cannot depend on a Phase 1 provider",
                {
                  capabilityId: requirement.id,
                  pluginId: manifest.id,
                  providerPluginId: provider.pluginId,
                },
              ),
            );
          }
          dependencies.get(manifest.id)!.add(provider.pluginId);
        }
      }
    }

    const resolvedById = new Map<string, ResolvedPluginRecord>();
    for (const [id, plugin] of byId) {
      resolvedById.set(
        id,
        Object.freeze({
          dependencies: Object.freeze([...(dependencies.get(id) ?? [])].sort()),
          registration: plugin.registration,
        }),
      );
    }
    diagnostics.push(...cycleDiagnostics(resolvedById));
    if (diagnostics.length > 0) {
      return failure(...sortedDiagnostics(diagnostics, this.#bounds.maxDiagnostics));
    }

    const order = topologicalOrder(resolvedById);
    const inspection = Object.freeze({
      apiVersion: pluginRuntimeApiVersion,
      plugins: Object.freeze(order.map(inspectionFor)),
    });
    const graph = Object.freeze({ inspect: () => inspection });
    resolvedGraphs.set(graph, Object.freeze({ inspection, order }));
    return success(graph);
  }

  async start(
    graph: ResolvedPluginGraph,
    cancellation: PluginCancellation = Object.freeze({ isCancellationRequested: () => false }),
  ): Promise<Result<RunningPluginGraph>> {
    const resolved = resolvedGraphs.get(graph as object);
    if (resolved === undefined) {
      return failure(
        diagnostic(
          "invalid-resolved-plugin-graph",
          "Plugin startup requires a graph resolved by this runtime contract",
        ),
      );
    }
    const containedCancellation = canonicalCancellation(cancellation);
    if (!containedCancellation.ok) return containedCancellation;
    const started: StartedPluginRecord[] = [];
    const available = new Map<string, PluginCapabilityProvider[]>();

    for (const plugin of resolved.order) {
      const requested = cancellationRequested(containedCancellation.value);
      if (!requested.ok || requested.value) {
        const cleanup = await cleanupStarted(started);
        return failure(
          ...(requested.ok
            ? [
                diagnostic(
                  "plugin-start-cancelled",
                  "Plugin startup was cancelled before the graph became running",
                  { pluginId: plugin.registration.manifest.id },
                ),
              ]
            : requested.diagnostics),
          ...cleanup,
        );
      }
      const requirements = Object.freeze(
        plugin.registration.manifest.requires.map((requirement) =>
          Object.freeze({
            cardinality: requirement.cardinality,
            id: requirement.id,
            providers: Object.freeze([
              ...(available.get(capabilityKey(requirement.id, requirement.version)) ?? []),
            ]),
            version: requirement.version,
          }),
        ),
      );
      const context = Object.freeze({
        cancellation: containedCancellation.value,
        requirements,
      });
      let raw: unknown;
      try {
        raw = intrinsicReflectApply(plugin.registration.start, plugin.registration.receiver, [
          context,
        ]);
      } catch {
        const cleanup = await cleanupStarted(started);
        return failure(
          diagnostic("plugin-start-failed", "Plugin start callback failed", {
            pluginId: plugin.registration.manifest.id,
          }),
          ...cleanup,
        );
      }
      const observed = await observeCallbackResult(raw);
      if (!observed.ok) {
        const cleanup = await cleanupStarted(started);
        return failure(
          diagnostic("plugin-start-failed", "Plugin start callback failed", {
            pluginId: plugin.registration.manifest.id,
          }),
          ...cleanup,
        );
      }
      const result = canonicalStartResult(observed.value, plugin);
      if (!result.ok) {
        const cleanup = await cleanupStarted(started);
        return failure(...result.diagnostics, ...cleanup);
      }
      const startedPlugin: StartedPluginRecord = {
        outputs: result.value.outputs,
        plugin,
        ...(result.value.stop === undefined ? {} : { stop: result.value.stop }),
        state: "running",
        stopped: false,
      };
      started.push(startedPlugin);
      for (const [key, output] of result.value.outputs) {
        const providers = available.get(key) ?? [];
        providers.push(
          Object.freeze({
            pluginId: plugin.registration.manifest.id,
            value: output.value,
          }),
        );
        providers.sort((left, right) => left.pluginId.localeCompare(right.pluginId));
        available.set(key, providers);
      }
      const after = cancellationRequested(containedCancellation.value);
      if (!after.ok || after.value) {
        const cleanup = await cleanupStarted(started);
        return failure(
          ...(after.ok
            ? [
                diagnostic(
                  "plugin-start-cancelled",
                  "Plugin startup was cancelled before the graph became running",
                  { pluginId: plugin.registration.manifest.id },
                ),
              ]
            : after.diagnostics),
          ...cleanup,
        );
      }
    }
    return success(runningGraph(resolved, Object.freeze(started)));
  }
}
