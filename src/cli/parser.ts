import {
  CLI_MAX_ARGUMENTS,
  CLI_MAX_ARGUMENT_CHARACTERS,
  CLI_MAX_CURSOR_CHARACTERS,
  CLI_MAX_PAGE_SIZE,
  CLI_MAX_SEARCH_CHARACTERS,
  CLI_MAX_TRAVERSAL_DEPTH,
  type CliCommand,
  type CliDiagnostic,
  type CliFormat,
  type CliInputSource,
  type CliInvocationResult,
} from "./contracts.ts";
import { WEB_DEFAULT_PORT } from "../web/server.ts";

function diagnostic(message: string): CliDiagnostic {
  return Object.freeze({ code: "cli-invalid-invocation", message });
}

function identifier(value: string | undefined): value is string {
  return (
    value !== undefined && value.length > 0 && value.length <= 4_096 && !value.startsWith("--")
  );
}

function projectIdentifier(value: string | undefined): value is string {
  return value !== undefined && /^(?:project\.default|project_[0-9a-f]{32})$/.test(value);
}

function projectRevision(value: string | undefined): value is string {
  return value !== undefined && /^sha256:[0-9a-f]{64}$/.test(value);
}

function scannerIdentifier(value: string | undefined): value is string {
  return value !== undefined && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value);
}

function failed(format: CliFormat, message: string): CliInvocationResult {
  return Object.freeze({ diagnostic: diagnostic(message), format, ok: false as const });
}

function inputSource(args: readonly string[]): CliInputSource | undefined {
  if (args.length === 1 && args[0] === "--stdin") return Object.freeze({ kind: "stdin" });
  if (args.length !== 2 || args[0] !== "--input") return undefined;
  const value = args[1];
  if (value === undefined || value.length === 0 || value.length > 4_096) return undefined;
  return value === "-"
    ? Object.freeze({ kind: "stdin" })
    : Object.freeze({ kind: "file", path: value });
}

function page(
  args: readonly string[],
  limitName: "--limit" | "--relationships-limit",
  cursorName: "--cursor" | "--relationships-cursor",
): { readonly cursor?: string; readonly limit: number } | undefined {
  let cursor: string | undefined;
  let limit: number | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === limitName && value !== undefined && limit === undefined) {
      if (!/^[1-9][0-9]*$/.test(value)) return undefined;
      limit = Number(value);
      if (!Number.isSafeInteger(limit) || limit > CLI_MAX_PAGE_SIZE) return undefined;
      index += 1;
    } else if (argument === cursorName && value !== undefined && cursor === undefined) {
      if (value.length === 0 || value.length > CLI_MAX_CURSOR_CHARACTERS) return undefined;
      cursor = value;
      index += 1;
    } else {
      return undefined;
    }
  }
  if (limit === undefined) return undefined;
  return Object.freeze({ ...(cursor === undefined ? {} : { cursor }), limit });
}

function positiveInteger(value: string | undefined, maximum?: number): number | undefined {
  if (value === undefined || !/^[1-9][0-9]*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && (maximum === undefined || parsed <= maximum)
    ? parsed
    : undefined;
}

function blueprintCommand(args: readonly string[]): CliCommand | undefined {
  const action = args[0];
  const rest = args.slice(1);
  if (action === "export") {
    const request = page(rest, "--limit", "--cursor");
    return request === undefined
      ? undefined
      : Object.freeze({ ...request, kind: "blueprint-export" });
  }
  if (action === "search") {
    const text = rest[0];
    if (text === undefined || text.length === 0 || text.length > CLI_MAX_SEARCH_CHARACTERS) {
      return undefined;
    }
    const request = page(rest.slice(1), "--limit", "--cursor");
    return request === undefined
      ? undefined
      : Object.freeze({ ...request, kind: "blueprint-search", text });
  }
  if (action !== "traverse") return undefined;
  const id = rest[0];
  if (!identifier(id)) return undefined;
  let cursor: string | undefined;
  let depth: number | undefined;
  let direction: "incoming" | "outgoing" | "both" | undefined;
  let limit: number | undefined;
  let relationType: string | undefined;
  for (let index = 1; index < rest.length; index += 2) {
    const option = rest[index];
    const value = rest[index + 1];
    if (option === "--cursor" && cursor === undefined) {
      if (value === undefined || value.length === 0 || value.length > CLI_MAX_CURSOR_CHARACTERS) {
        return undefined;
      }
      cursor = value;
    } else if (option === "--depth" && depth === undefined) {
      depth = positiveInteger(value, CLI_MAX_TRAVERSAL_DEPTH);
      if (depth === undefined) return undefined;
    } else if (option === "--direction" && direction === undefined) {
      if (value !== "incoming" && value !== "outgoing" && value !== "both") return undefined;
      direction = value;
    } else if (option === "--limit" && limit === undefined) {
      limit = positiveInteger(value, CLI_MAX_PAGE_SIZE);
      if (limit === undefined) return undefined;
    } else if (option === "--relation-type" && relationType === undefined) {
      if (!identifier(value)) return undefined;
      relationType = value;
    } else {
      return undefined;
    }
  }
  return depth === undefined || direction === undefined || limit === undefined
    ? undefined
    : Object.freeze({
        ...(cursor === undefined ? {} : { cursor }),
        depth,
        direction,
        id,
        kind: "blueprint-traverse",
        limit,
        ...(relationType === undefined ? {} : { relationType }),
      });
}

function reparent(args: readonly string[]): CliCommand | undefined {
  const id = args[0];
  if (!identifier(id)) return undefined;
  let expectedRevision: string | undefined;
  let parent: string | null | undefined;
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--revision" && expectedRevision === undefined) {
      const value = args[index + 1];
      if (!identifier(value)) return undefined;
      expectedRevision = value;
      index += 1;
    } else if (argument === "--parent" && parent === undefined) {
      const value = args[index + 1];
      if (!identifier(value)) return undefined;
      parent = value;
      index += 1;
    } else if (argument === "--root" && parent === undefined) {
      parent = null;
    } else {
      return undefined;
    }
  }
  return expectedRevision === undefined || parent === undefined
    ? undefined
    : Object.freeze({ expectedRevision, id, kind: "component-reparent", parent });
}

function remove(args: readonly string[]): CliCommand | undefined {
  if (args.length !== 3 || args[1] !== "--revision") return undefined;
  const id = args[0];
  const expectedRevision = args[2];
  if (
    !identifier(id) ||
    expectedRevision === undefined ||
    expectedRevision.length === 0 ||
    expectedRevision.length > 4_096
  ) {
    return undefined;
  }
  return Object.freeze({ expectedRevision, id, kind: "component-remove" });
}

function merge(args: readonly string[]): CliCommand | undefined {
  const obsolete = args[0];
  if (!identifier(obsolete)) return undefined;
  let expectedRevision: string | undefined;
  let survivor: string | undefined;
  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if (!identifier(value)) return undefined;
    if (option === "--into" && survivor === undefined) survivor = value;
    else if (option === "--revision" && expectedRevision === undefined) expectedRevision = value;
    else return undefined;
    index += 1;
  }
  return expectedRevision === undefined || survivor === undefined
    ? undefined
    : Object.freeze({ expectedRevision, kind: "component-merge", obsolete, survivor });
}

function componentCommand(args: readonly string[]): CliCommand | undefined {
  const action = args[0];
  const rest = args.slice(1);
  if (action === "create" || action === "update") {
    const input = inputSource(rest);
    return input === undefined
      ? undefined
      : Object.freeze({ input, kind: `component-${action}` as const });
  }
  if (action === "get") {
    const id = rest[0];
    if (!identifier(id)) return undefined;
    const relationships = page(rest.slice(1), "--relationships-limit", "--relationships-cursor");
    return relationships === undefined
      ? undefined
      : Object.freeze({ id, kind: "component-get", relationships });
  }
  if (action === "list" || action === "roots") {
    const request = page(rest, "--limit", "--cursor");
    return request === undefined
      ? undefined
      : Object.freeze({ ...request, kind: `component-${action}` as const });
  }
  if (action === "children") {
    const parent = rest[0];
    if (!identifier(parent)) return undefined;
    const request = page(rest.slice(1), "--limit", "--cursor");
    return request === undefined
      ? undefined
      : Object.freeze({ ...request, kind: "component-children", parent });
  }
  if (action === "reparent") return reparent(rest);
  if (action === "merge") return merge(rest);
  if (action === "remove") return remove(rest);
  return undefined;
}

function projectCommand(args: readonly string[]): CliCommand | undefined {
  const action = args[0];
  const rest = args.slice(1);
  if (action === "add") {
    const input = inputSource(rest);
    return input === undefined ? undefined : Object.freeze({ input, kind: "project-add" });
  }
  if (action === "list" && rest.length === 0) {
    return Object.freeze({ kind: "project-list" });
  }
  if (action === "get" && rest.length === 1 && projectIdentifier(rest[0])) {
    return Object.freeze({ id: rest[0], kind: "project-get" });
  }
  if (action === "remove") {
    if (rest.length !== 3 || rest[1] !== "--revision" || !projectIdentifier(rest[0]))
      return undefined;
    const expectedRevision = rest[2];
    return projectRevision(expectedRevision)
      ? Object.freeze({ expectedRevision, id: rest[0], kind: "project-remove" })
      : undefined;
  }
  if (action !== "update") return undefined;
  const id = rest[0];
  if (!projectIdentifier(id)) return undefined;
  let expectedRevision: string | undefined;
  let input: CliInputSource | undefined;
  for (let index = 1; index < rest.length; index += 1) {
    if (rest[index] === "--revision" && expectedRevision === undefined) {
      const value = rest[index + 1];
      if (!projectRevision(value)) return undefined;
      expectedRevision = value;
      index += 1;
    } else if (rest[index] === "--stdin" && input === undefined) {
      input = Object.freeze({ kind: "stdin" });
    } else if (rest[index] === "--input" && input === undefined) {
      const value = rest[index + 1];
      if (value === undefined || value.length === 0 || value.length > 4_096) return undefined;
      input =
        value === "-"
          ? Object.freeze({ kind: "stdin" })
          : Object.freeze({ kind: "file", path: value });
      index += 1;
    } else {
      return undefined;
    }
  }
  return expectedRevision === undefined || input === undefined
    ? undefined
    : Object.freeze({ expectedRevision, id, input, kind: "project-update" });
}

function webCommand(args: readonly string[]): CliCommand | undefined {
  let port: number | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (
      option === "--port" &&
      port === undefined &&
      value !== undefined &&
      /^(?:0|[1-9][0-9]{0,4})$/.test(value)
    ) {
      const parsed = Number(value);
      if (parsed > 65_535) return undefined;
      port = parsed;
    } else {
      return undefined;
    }
  }
  return Object.freeze({ kind: "web" as const, port: port ?? WEB_DEFAULT_PORT });
}

function scanCommand(args: readonly string[]): CliCommand | undefined {
  let projectId: string | undefined;
  let scannerId: string | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (option === "--project" && projectId === undefined && projectIdentifier(value)) {
      projectId = value;
    } else if (option === "--scanner" && scannerId === undefined && scannerIdentifier(value)) {
      scannerId = value;
    } else {
      return undefined;
    }
  }
  return Object.freeze({
    kind: "scan" as const,
    ...(projectId === undefined ? {} : { projectId }),
    ...(scannerId === undefined ? {} : { scannerId }),
  });
}

export function parseInvocation(args: readonly string[]): CliInvocationResult {
  const boundedFailureFormat: CliFormat =
    (args[0] === "--format" && args[1] === "json") || args[0] === "--format=json"
      ? "json"
      : "plain";
  if (
    args.length > CLI_MAX_ARGUMENTS ||
    args.reduce((total, argument) => total + argument.length, 0) > CLI_MAX_ARGUMENT_CHARACTERS
  ) {
    return failed(boundedFailureFormat, "Command arguments exceed the supported bound");
  }

  let format: CliFormat = "plain";
  let index = 0;
  if (args[index] === "--format") {
    const value = args[index + 1];
    if (value !== "plain" && value !== "json") {
      return failed(format, "--format must be plain or json");
    }
    format = value;
    index += 2;
  } else if (args[index]?.startsWith("--format=")) {
    const value = args[index]!.slice("--format=".length);
    if (value !== "plain" && value !== "json") {
      return failed(format, "--format must be plain or json");
    }
    format = value;
    index += 1;
  }

  const commandArgs = args.slice(index);
  if (commandArgs.length === 0) {
    return Object.freeze({
      invocation: Object.freeze({ command: Object.freeze({ kind: "overview" }), format }),
      ok: true as const,
    });
  }
  if (commandArgs.length === 1 && (commandArgs[0] === "--help" || commandArgs[0] === "-h")) {
    return Object.freeze({
      invocation: Object.freeze({ command: Object.freeze({ kind: "help" }), format }),
      ok: true as const,
    });
  }
  if (commandArgs.length === 1 && (commandArgs[0] === "--version" || commandArgs[0] === "-V")) {
    return Object.freeze({
      invocation: Object.freeze({ command: Object.freeze({ kind: "version" }), format }),
      ok: true as const,
    });
  }
  if (commandArgs.length === 1 && commandArgs[0] === "init") {
    return Object.freeze({
      invocation: Object.freeze({ command: Object.freeze({ kind: "init" }), format }),
      ok: true as const,
    });
  }
  const command =
    commandArgs[0] === "scan"
      ? scanCommand(commandArgs.slice(1))
      : commandArgs[0] === "web"
        ? webCommand(commandArgs.slice(1))
        : commandArgs[0] === "blueprint"
          ? blueprintCommand(commandArgs.slice(1))
          : commandArgs[0] === "component"
            ? componentCommand(commandArgs.slice(1))
            : commandArgs[0] === "project"
              ? projectCommand(commandArgs.slice(1))
              : undefined;
  if (command === undefined) {
    return failed(format, "The command invocation is invalid; run groma --help for usage");
  }
  return Object.freeze({
    invocation: Object.freeze({ command, format }),
    ok: true as const,
  });
}
