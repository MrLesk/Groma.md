import {
  standardComponentDisplayText,
  type ApplicationMutationOutcome,
  type ApplicationOperations,
  type ComponentPage,
  type CreateComponentRequest,
  type UpdateComponentRequest,
} from "../application/index.ts";
import {
  defaultProjectRegistrationId,
  type HostSurface,
  type HostSurfaceContext,
  type ProjectRegistrationInput,
} from "../host/index.ts";
import {
  CLI_EXIT,
  commandName,
  type CliCommand,
  type CliCommandResult,
  type CliDiagnostic,
  type CliInputSource,
  type CliInvocation,
  type CliOverviewNode,
  type CliOverviewResult,
} from "./contracts.ts";
import { decodeStructuredInput } from "./input.ts";

const OVERVIEW_CHILD_LIMIT = 10;
const OVERVIEW_MAX_DEPTH = 4;
const OVERVIEW_MAX_NODES = 50;
const OVERVIEW_MAX_QUERIES = 50;
const OVERVIEW_ROOT_LIMIT = 10;

export interface CliInputReader {
  read(source: CliInputSource, cancellation: AbortSignal): Promise<string>;
}

export interface CliSurfaceController {
  readonly result: () => CliCommandResult | undefined;
  readonly surface: HostSurface;
}

function diagnostic(code: string, message: string): CliDiagnostic {
  return Object.freeze({ code, message });
}

function result(
  command: CliCommand,
  exitCode: number,
  ok: boolean,
  value: unknown,
): CliCommandResult {
  return Object.freeze({ command: commandName(command), exitCode, ok, result: value });
}

function failedResult(
  command: CliCommand,
  exitCode: number,
  code: string,
  message: string,
): CliCommandResult {
  return result(
    command,
    exitCode,
    false,
    Object.freeze({ diagnostics: Object.freeze([diagnostic(code, message)]), ok: false }),
  );
}

function diagnosticExit(diagnostics: readonly { readonly code: string }[]): number {
  const codes = diagnostics.map((entry) => entry.code);
  if (codes.includes("scanner-execution-cancelled")) return CLI_EXIT.cancelled;
  if (codes.includes("project-registry-state-indeterminate")) {
    return CLI_EXIT.indeterminate;
  }
  if (
    codes.some(
      (code) =>
        code === "graph-query-unavailable" ||
        code.includes("provider") ||
        code.includes("initialization-failed") ||
        code.includes("recovery") ||
        code.includes("snapshot") ||
        code === "resource-missing" ||
        code === "resource-unreadable" ||
        code === "stale-resource-cursor" ||
        code.includes("resource-unavailable") ||
        code.includes("capability-failed"),
    )
  ) {
    return CLI_EXIT.infrastructure;
  }
  if (
    codes.some(
      (code) =>
        code === "no-workspace" ||
        code.startsWith("project-registry-") ||
        code === "project-revision-conflict" ||
        code.includes("workspace-configuration") ||
        code.includes("workspace-initialization-conflict"),
    )
  ) {
    return CLI_EXIT.workspace;
  }
  return CLI_EXIT.semantic;
}

function applicationResult(
  command: CliCommand,
  value:
    | { readonly diagnostics: readonly { readonly code: string }[]; readonly ok: false }
    | { readonly ok: true; readonly value: unknown },
): CliCommandResult {
  return value.ok
    ? result(command, CLI_EXIT.success, true, value)
    : result(command, diagnosticExit(value.diagnostics), false, value);
}

function mutationResult<T>(
  command: CliCommand,
  value: ApplicationMutationOutcome<T>,
): CliCommandResult {
  switch (value.status) {
    case "committed":
      return result(command, CLI_EXIT.success, true, value);
    case "indeterminate":
      return result(command, CLI_EXIT.indeterminate, false, value);
    case "provider-failure":
      return result(command, CLI_EXIT.infrastructure, false, value);
    default:
      return result(command, CLI_EXIT.semantic, false, value);
  }
}

function workspaceOperations(
  command: CliCommand,
  context: HostSurfaceContext,
): ApplicationOperations | CliCommandResult {
  const available = context.workspace.requireWorkspace();
  return available.ok
    ? available.value
    : result(command, diagnosticExit(available.diagnostics), false, available);
}

async function structuredRequest(
  command: CliCommand,
  source: CliInputSource,
  reader: CliInputReader,
  cancellation: AbortSignal,
): Promise<
  | { readonly ok: false; readonly result: CliCommandResult }
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
> {
  let text: string;
  try {
    text = await reader.read(source, cancellation);
  } catch {
    return Object.freeze({
      ok: false as const,
      result: failedResult(
        command,
        CLI_EXIT.usage,
        "cli-input-unavailable",
        "Structured input could not be read",
      ),
    });
  }
  const decoded = decodeStructuredInput(text);
  return decoded.ok
    ? Object.freeze({ ok: true as const, value: decoded.value })
    : Object.freeze({
        ok: false as const,
        result: result(command, CLI_EXIT.usage, false, {
          diagnostics: Object.freeze([decoded.diagnostic]),
          ok: false,
        }),
      });
}

function projectRegistrationRequest(
  command: CliCommand,
  value: Readonly<Record<string, unknown>>,
):
  | { readonly ok: false; readonly result: CliCommandResult }
  | { readonly ok: true; readonly value: ProjectRegistrationInput } {
  const expected = Object.freeze(["coverage", "name", "scanners", "source"]);
  try {
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expected.length ||
      keys.some((key) => typeof key !== "string" || !expected.includes(key))
    ) {
      throw new TypeError("Project registration input keys are not exact");
    }
    const fields = Object.create(null) as Record<string, unknown>;
    for (const key of expected) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("Project registration input field is not an enumerable value");
      }
      fields[key] = descriptor.value;
    }
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        coverage: fields.coverage as ProjectRegistrationInput["coverage"],
        name: fields.name as string,
        scanners: fields.scanners as ProjectRegistrationInput["scanners"],
        source: fields.source as string,
      }),
    });
  } catch {
    return Object.freeze({
      ok: false as const,
      result: failedResult(
        command,
        CLI_EXIT.usage,
        "cli-invalid-input",
        "Project registration input must contain exactly coverage, name, scanners, and source",
      ),
    });
  }
}

async function overview(
  command: CliCommand,
  context: HostSurfaceContext,
  terminal: { readonly stdin: boolean; readonly stdout: boolean },
): Promise<CliCommandResult> {
  const status = context.workspace.status();
  if (status.state === "missing") {
    const value: CliOverviewResult = Object.freeze({ kind: "workspace-missing" });
    return result(command, CLI_EXIT.success, true, value);
  }
  const operations = workspaceOperations(command, context);
  if (!("listRoots" in operations)) return operations;
  if (!terminal.stdin || !terminal.stdout) {
    const value: CliOverviewResult = Object.freeze({ kind: "help" });
    return result(command, CLI_EXIT.success, true, value);
  }

  let queries = 1;
  const roots = await operations.listRoots({ limit: OVERVIEW_ROOT_LIMIT });
  if (!roots.ok) return applicationResult(command, roots);
  const generation = Number(roots.value.generation);
  const nodes: CliOverviewNode[] = [];
  const truncations: Array<{
    cursor?: string;
    parent?: string;
    reason: "children" | "depth" | "nodes" | "queries" | "roots";
  }> = [];
  const seen = new Set<string>();
  let failed: CliCommandResult | undefined;

  const checkGeneration = (page: ComponentPage): boolean => Number(page.generation) === generation;
  const visit = async (item: ComponentPage["items"][number], depth: number): Promise<void> => {
    if (failed !== undefined) return;
    if (nodes.length >= OVERVIEW_MAX_NODES) {
      if (!truncations.some((entry) => entry.reason === "nodes")) {
        truncations.push({ reason: "nodes" });
      }
      return;
    }
    const id = String(item.component.id);
    if (seen.has(id)) {
      failed = failedResult(
        command,
        CLI_EXIT.infrastructure,
        "cli-overview-inconsistent",
        "The terminal overview changed while it was being read",
      );
      return;
    }
    seen.add(id);
    nodes.push(
      Object.freeze({
        depth,
        displayText: standardComponentDisplayText(item.component),
        id,
        ...(item.component.name === undefined ? {} : { name: item.component.name }),
        revision: item.revision,
        ...(item.component.scale === undefined ? {} : { scale: item.component.scale }),
        ...(item.component.shared === undefined ? {} : { shared: item.component.shared }),
        ...(item.component.type === undefined ? {} : { type: item.component.type }),
      }),
    );
    if (depth >= OVERVIEW_MAX_DEPTH) {
      truncations.push({ parent: id, reason: "depth" });
      return;
    }
    if (queries >= OVERVIEW_MAX_QUERIES) {
      truncations.push({ parent: id, reason: "queries" });
      return;
    }
    queries += 1;
    const children = await operations.listChildren({ limit: OVERVIEW_CHILD_LIMIT, parent: id });
    if (!children.ok) {
      failed = applicationResult(command, children);
      return;
    }
    if (!checkGeneration(children.value)) {
      failed = failedResult(
        command,
        CLI_EXIT.infrastructure,
        "cli-overview-generation-changed",
        "The terminal overview changed while it was being read",
      );
      return;
    }
    for (const child of children.value.items) await visit(child, depth + 1);
    if (children.value.hasMore) {
      truncations.push({
        ...(children.value.nextCursor === undefined
          ? {}
          : { cursor: String(children.value.nextCursor) }),
        parent: id,
        reason: "children",
      });
    }
  };

  for (const root of roots.value.items) await visit(root, 0);
  if (failed !== undefined) return failed;
  if (roots.value.hasMore) {
    truncations.push({
      ...(roots.value.nextCursor === undefined ? {} : { cursor: String(roots.value.nextCursor) }),
      reason: "roots",
    });
  }
  const value: CliOverviewResult = Object.freeze({
    generation,
    kind: "hierarchy",
    nodes: Object.freeze(nodes),
    truncations: Object.freeze(truncations.map((entry) => Object.freeze(entry))),
  });
  return result(command, CLI_EXIT.success, true, value);
}

async function serveWeb(
  command: Extract<CliCommand, { readonly kind: "web" }>,
  context: HostSurfaceContext,
  onReady: ((url: string) => void) | undefined,
): Promise<CliCommandResult> {
  const status = context.workspace.status();
  if (status.state === "missing") {
    return failedResult(
      command,
      CLI_EXIT.workspace,
      "web-workspace-missing",
      "No Groma workspace exists here; run groma init first",
    );
  }
  const operations = workspaceOperations(command, context);
  if (!("listRoots" in operations)) return operations;
  const [{ webFrontend }, { serveWebBlueprint }] = await Promise.all([
    import("../web/assets.ts"),
    import("../web/server.ts"),
  ]);
  const outcome = await serveWebBlueprint({
    cancellation: context.cancellation,
    frontend: webFrontend,
    ...(onReady === undefined ? {} : { onReady }),
    operations,
    port: command.port,
  });
  return outcome.ok
    ? result(command, CLI_EXIT.success, true, outcome.value)
    : failedResult(
        command,
        CLI_EXIT.infrastructure,
        outcome.diagnostic.code,
        outcome.diagnostic.message,
      );
}

async function execute(
  invocation: CliInvocation,
  context: HostSurfaceContext,
  reader: CliInputReader,
  terminal: { readonly stdin: boolean; readonly stdout: boolean },
  webReady?: (url: string) => void,
  confirmInit?: (question: string) => Promise<boolean>,
): Promise<CliCommandResult> {
  const command = invocation.command;
  if (command.kind === "overview") return overview(command, context, terminal);
  if (command.kind === "web") return serveWeb(command, context, webReady);
  if (command.kind === "init") {
    const initialized = await context.initialization.initialize(Object.freeze({}));
    if (!initialized.ok) return applicationResult(command, initialized);
    const exitCode =
      initialized.value.status === "conflict"
        ? CLI_EXIT.workspace
        : initialized.value.status === "provider-failure"
          ? CLI_EXIT.infrastructure
          : CLI_EXIT.success;
    return result(command, exitCode, exitCode === CLI_EXIT.success, initialized);
  }
  if (command.kind === "scan") {
    if (confirmInit !== undefined && context.workspace.status().state === "missing") {
      const accepted = await confirmInit(
        "No groma workspace exists here. Create it with groma init and continue the scan? [y/N] ",
      );
      if (accepted) {
        const initialized = await context.initialization.initialize(Object.freeze({}));
        if (!initialized.ok) return applicationResult(command, initialized);
        if (initialized.value.status !== "initialized") {
          return result(
            command,
            initialized.value.status === "already-initialized"
              ? CLI_EXIT.success
              : initialized.value.status === "conflict"
                ? CLI_EXIT.workspace
                : CLI_EXIT.infrastructure,
            false,
            initialized,
          );
        }
        const recovered = await context.workspace.recover();
        if (!recovered.ok) return applicationResult(command, recovered);
      }
      // A declined offer falls through to the unchanged missing-workspace diagnostic.
    }
    const listed = await context.projects.list();
    if (!listed.ok) return applicationResult(command, listed);
    let project;
    if (command.projectId !== undefined) {
      const selected = await context.projects.get({ id: command.projectId });
      if (!selected.ok) return applicationResult(command, selected);
      project = selected.value;
    } else if (listed.value.length === 0) {
      return failedResult(
        command,
        CLI_EXIT.workspace,
        "scan-project-selection-required",
        "No scanned project is registered; run groma init or project add",
      );
    } else if (listed.value.length === 1) {
      project = listed.value[0]!;
    } else {
      return failedResult(
        command,
        CLI_EXIT.workspace,
        "scan-project-selection-required",
        "More than one scanned project is registered; choose one with --project",
      );
    }
    if (
      project.id === defaultProjectRegistrationId &&
      project.scanners.length === 0 &&
      (command.scannerId === undefined || command.scannerId === "official.typescript")
    ) {
      const configured = await context.projects.update({
        coverage: project.coverage,
        expectedRevision: project.revision,
        id: project.id,
        name: project.name,
        scanners: Object.freeze([
          Object.freeze({ configuration: Object.freeze({}), id: "official.typescript" }),
        ]),
        source: project.source,
      });
      if (!configured.ok) return applicationResult(command, configured);
      project = configured.value;
    }
    if (project.availability !== "available") {
      return failedResult(
        command,
        CLI_EXIT.workspace,
        "scan-project-unavailable",
        "The selected scanned project is unavailable",
      );
    }
    let scannerId = command.scannerId;
    if (scannerId === undefined) {
      if (project.scanners.length !== 1) {
        return failedResult(
          command,
          CLI_EXIT.workspace,
          "scan-scanner-selection-required",
          "The selected project does not have exactly one scanner; choose one with --scanner",
        );
      }
      scannerId = project.scanners[0]!.id;
    } else if (!project.scanners.some((scanner) => scanner.id === scannerId)) {
      return failedResult(
        command,
        CLI_EXIT.workspace,
        "scan-scanner-not-configured",
        "The selected scanner is not enabled for this project",
      );
    }
    const started = await context.scanners.start({
      cancellation: context.cancellation,
      projectId: project.id,
      scannerId,
    });
    if (!started.ok) return applicationResult(command, started);
    const report = await started.value.completion;
    const value = Object.freeze({
      diagnostics: report.diagnostics,
      observations: Object.freeze({
        batches: report.batchCount,
        records: report.recordCount,
        signals: report.signalCount,
      }),
      project: Object.freeze({ id: project.id, name: project.name }),
      ...(report.recovery === undefined ? {} : { recovery: report.recovery }),
      scanner: report.scannerId,
      status: report.status,
    });
    const exitCode =
      report.status === "completed"
        ? CLI_EXIT.success
        : report.status === "cancelled"
          ? CLI_EXIT.cancelled
          : report.status === "indeterminate"
            ? CLI_EXIT.indeterminate
            : diagnosticExit(report.diagnostics);
    return result(command, exitCode, exitCode === CLI_EXIT.success, value);
  }
  if (command.kind === "project-add") {
    const request = await structuredRequest(command, command.input, reader, context.cancellation);
    if (!request.ok) return request.result;
    const project = projectRegistrationRequest(command, request.value);
    if (!project.ok) return project.result;
    return applicationResult(command, await context.projects.add(project.value));
  }
  if (command.kind === "project-get") {
    return applicationResult(command, await context.projects.get({ id: command.id }));
  }
  if (command.kind === "project-list") {
    return applicationResult(command, await context.projects.list());
  }
  if (command.kind === "project-update") {
    const request = await structuredRequest(command, command.input, reader, context.cancellation);
    if (!request.ok) return request.result;
    const project = projectRegistrationRequest(command, request.value);
    if (!project.ok) return project.result;
    return applicationResult(
      command,
      await context.projects.update({
        ...project.value,
        expectedRevision: command.expectedRevision,
        id: command.id,
      }),
    );
  }
  if (command.kind === "project-remove") {
    return applicationResult(
      command,
      await context.projects.remove({
        expectedRevision: command.expectedRevision,
        id: command.id,
      }),
    );
  }
  const operations = workspaceOperations(command, context);
  if (!("listRoots" in operations)) return operations;
  switch (command.kind) {
    case "blueprint-export":
      return applicationResult(
        command,
        await operations.exportBlueprint({
          ...(command.cursor === undefined ? {} : { cursor: command.cursor }),
          limit: command.limit,
        }),
      );
    case "blueprint-search":
      return applicationResult(
        command,
        await operations.searchBlueprint({
          ...(command.cursor === undefined ? {} : { cursor: command.cursor }),
          limit: command.limit,
          ...(command.scale === undefined ? {} : { scale: command.scale }),
          ...(command.shared === undefined ? {} : { shared: command.shared }),
          text: command.text,
        }),
      );
    case "blueprint-traverse":
      return applicationResult(
        command,
        await operations.traverseBlueprint({
          ...(command.cursor === undefined ? {} : { cursor: command.cursor }),
          depth: command.depth,
          direction: command.direction,
          id: command.id,
          limit: command.limit,
          ...(command.relationType === undefined ? {} : { relationType: command.relationType }),
        }),
      );
    case "component-create": {
      const request = await structuredRequest(command, command.input, reader, context.cancellation);
      if (!request.ok) return request.result;
      return mutationResult(
        command,
        await operations.createComponent(request.value as unknown as CreateComponentRequest),
      );
    }
    case "component-get":
      return applicationResult(
        command,
        await operations.getComponent({ id: command.id, relationships: command.relationships }),
      );
    case "component-list":
      return applicationResult(
        command,
        await operations.listComponents({
          ...(command.cursor === undefined ? {} : { cursor: command.cursor }),
          limit: command.limit,
          ...(command.scale === undefined ? {} : { scale: command.scale }),
          ...(command.shared === undefined ? {} : { shared: command.shared }),
        }),
      );
    case "component-roots":
      return applicationResult(
        command,
        await operations.listRoots({
          ...(command.cursor === undefined ? {} : { cursor: command.cursor }),
          limit: command.limit,
          ...(command.scale === undefined ? {} : { scale: command.scale }),
          ...(command.shared === undefined ? {} : { shared: command.shared }),
        }),
      );
    case "component-children":
      return applicationResult(
        command,
        await operations.listChildren({
          ...(command.cursor === undefined ? {} : { cursor: command.cursor }),
          limit: command.limit,
          parent: command.parent,
          ...(command.scale === undefined ? {} : { scale: command.scale }),
          ...(command.shared === undefined ? {} : { shared: command.shared }),
        }),
      );
    case "component-update": {
      const request = await structuredRequest(command, command.input, reader, context.cancellation);
      if (!request.ok) return request.result;
      return mutationResult(
        command,
        await operations.updateComponent(request.value as unknown as UpdateComponentRequest),
      );
    }
    case "component-merge":
      return mutationResult(
        command,
        await operations.mergeComponent({
          expectedRevision: command.expectedRevision,
          obsolete: command.obsolete,
          survivor: command.survivor,
        }),
      );
    case "component-reparent":
      return mutationResult(
        command,
        await operations.reparentComponent({
          expectedRevision: command.expectedRevision,
          id: command.id,
          parent: command.parent,
        }),
      );
    case "component-remove":
      return mutationResult(
        command,
        await operations.removeComponent({
          expectedRevision: command.expectedRevision,
          id: command.id,
        }),
      );
    default:
      return failedResult(
        command,
        CLI_EXIT.usage,
        "cli-invalid-invocation",
        "The command cannot be dispatched",
      );
  }
}

export function createCliSurfaceController(
  invocation: CliInvocation,
  reader: CliInputReader,
  terminal: { readonly stdin: boolean; readonly stdout: boolean },
  webReady?: (url: string) => void,
  confirmInit?: (question: string) => Promise<boolean>,
): CliSurfaceController {
  let captured: CliCommandResult | undefined;
  let completion: Promise<void> | undefined;
  let started = false;
  let stopped = false;
  /** Long-running commands finish their own result after a stop signal. */
  const longRunning = invocation.command.kind === "scan" || invocation.command.kind === "web";
  const surface: HostSurface = Object.freeze({
    start(context: HostSurfaceContext) {
      if (started) throw new Error("CLI surface can start only once");
      started = true;
      completion = execute(invocation, context, reader, terminal, webReady, confirmInit).then(
        (value) => {
          if (!stopped || longRunning) captured = value;
        },
        () => {
          if (!stopped || longRunning) {
            captured = failedResult(
              invocation.command,
              CLI_EXIT.infrastructure,
              "cli-command-failed",
              "The command could not be completed",
            );
          }
        },
      );
      return Object.freeze({
        completion,
        stop: async () => {
          stopped = true;
          if (longRunning) await completion;
        },
      });
    },
  });
  return Object.freeze({ result: () => captured, surface });
}
