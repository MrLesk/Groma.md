import type {
  ApplicationMutationOutcome,
  ApplicationOperations,
  ComponentPage,
  CreateComponentRequest,
  UpdateComponentRequest,
} from "../application/index.ts";
import type { HostSurface, HostSurfaceContext } from "../host/index.ts";
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
  read(source: CliInputSource): Promise<string>;
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
  if (
    codes.some(
      (code) =>
        code.includes("provider") ||
        code.includes("initialization-failed") ||
        code.includes("recovery") ||
        code.includes("snapshot") ||
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
): Promise<
  | { readonly ok: false; readonly result: CliCommandResult }
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
> {
  let text: string;
  try {
    text = await reader.read(source);
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
        id,
        ...(item.component.name === undefined ? {} : { name: item.component.name }),
        revision: item.revision,
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

async function execute(
  invocation: CliInvocation,
  context: HostSurfaceContext,
  reader: CliInputReader,
  terminal: { readonly stdin: boolean; readonly stdout: boolean },
): Promise<CliCommandResult> {
  const command = invocation.command;
  if (command.kind === "overview") return overview(command, context, terminal);
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
  const operations = workspaceOperations(command, context);
  if (!("listRoots" in operations)) return operations;
  switch (command.kind) {
    case "component-create": {
      const request = await structuredRequest(command, command.input, reader);
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
        }),
      );
    case "component-roots":
      return applicationResult(
        command,
        await operations.listRoots({
          ...(command.cursor === undefined ? {} : { cursor: command.cursor }),
          limit: command.limit,
        }),
      );
    case "component-children":
      return applicationResult(
        command,
        await operations.listChildren({
          ...(command.cursor === undefined ? {} : { cursor: command.cursor }),
          limit: command.limit,
          parent: command.parent,
        }),
      );
    case "component-update": {
      const request = await structuredRequest(command, command.input, reader);
      if (!request.ok) return request.result;
      return mutationResult(
        command,
        await operations.updateComponent(request.value as unknown as UpdateComponentRequest),
      );
    }
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
): CliSurfaceController {
  let captured: CliCommandResult | undefined;
  let started = false;
  let stopped = false;
  const surface: HostSurface = Object.freeze({
    start(context: HostSurfaceContext) {
      if (started) throw new Error("CLI surface can start only once");
      started = true;
      const completion = execute(invocation, context, reader, terminal).then(
        (value) => {
          if (!stopped) captured = value;
        },
        () => {
          if (!stopped) {
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
        },
      });
    },
  });
  return Object.freeze({ result: () => captured, surface });
}
