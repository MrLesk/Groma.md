import {
  CLI_MAX_ARGUMENTS,
  CLI_MAX_ARGUMENT_CHARACTERS,
  CLI_MAX_PAGE_SIZE,
  type CliCommand,
  type CliDiagnostic,
  type CliFormat,
  type CliInputSource,
  type CliInvocationResult,
} from "./contracts.ts";

function diagnostic(message: string): CliDiagnostic {
  return Object.freeze({ code: "cli-invalid-invocation", message });
}

function identifier(value: string | undefined): value is string {
  return (
    value !== undefined && value.length > 0 && value.length <= 4_096 && !value.startsWith("--")
  );
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
      if (value.length === 0 || value.length > 2_048) return undefined;
      cursor = value;
      index += 1;
    } else {
      return undefined;
    }
  }
  if (limit === undefined) return undefined;
  return Object.freeze({ ...(cursor === undefined ? {} : { cursor }), limit });
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

function packageScope(args: readonly string[]): "blueprint" | "personal" | undefined {
  if (args.length === 0) return "blueprint";
  return args.length === 1 && args[0] === "--personal" ? "personal" : undefined;
}

function packageCommand(args: readonly string[]): CliCommand | undefined {
  const action = args[0];
  const rest = args.slice(1);
  if (action === "scaffold") {
    const destination = rest[0];
    if (!identifier(destination)) return undefined;
    let name: string | undefined;
    let pluginId: string | undefined;
    const provides: string[] = [];
    for (let index = 1; index < rest.length; index += 2) {
      const option = rest[index];
      const value = rest[index + 1];
      if (!identifier(value)) return undefined;
      if (option === "--name" && name === undefined) name = value;
      else if (option === "--plugin" && pluginId === undefined) pluginId = value;
      else if (option === "--provides") provides.push(value);
      else return undefined;
    }
    return name === undefined || pluginId === undefined || provides.length === 0
      ? undefined
      : Object.freeze({
          destination,
          kind: "package-scaffold",
          name,
          pluginId,
          provides: Object.freeze(provides),
        });
  }
  if (action === "add") {
    const source = rest[0];
    const scope = packageScope(rest.slice(1));
    return identifier(source) && scope !== undefined
      ? Object.freeze({ kind: "package-add", scope, source })
      : undefined;
  }
  if (action === "inspect" || action === "remove") {
    const name = rest[0];
    const scope = packageScope(rest.slice(1));
    return identifier(name) && scope !== undefined
      ? Object.freeze({ kind: `package-${action}` as const, name, scope })
      : undefined;
  }
  if (action === "enable" || action === "disable") {
    const name = rest[0];
    const entry = rest[1];
    if (!identifier(name) || !identifier(entry)) return undefined;
    let scope: "blueprint" | "personal" = "blueprint";
    let trustFullUserPermissions = false;
    for (const option of rest.slice(2)) {
      if (option === "--personal" && scope === "blueprint") scope = "personal";
      else if (
        action === "enable" &&
        option === "--trust-full-user-permissions" &&
        !trustFullUserPermissions
      ) {
        trustFullUserPermissions = true;
      } else return undefined;
    }
    return Object.freeze({
      entry,
      kind: `package-${action}` as const,
      name,
      scope,
      ...(trustFullUserPermissions ? { trustFullUserPermissions: true } : {}),
    });
  }
  return undefined;
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
    commandArgs[0] === "component"
      ? componentCommand(commandArgs.slice(1))
      : commandArgs[0] === "package"
        ? packageCommand(commandArgs.slice(1))
        : undefined;
  if (command === undefined) {
    return failed(format, "The command invocation is invalid; run groma --help for usage");
  }
  return Object.freeze({
    invocation: Object.freeze({ command, format }),
    ok: true as const,
  });
}
