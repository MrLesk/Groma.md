import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  createDefaultBootstrapRegistry,
  createProcessSignalSource,
  runHost,
  type HostBootstrapRegistry,
  type HostSignalSource,
  type HostSurface,
} from "../host/index.ts";
import {
  CLI_EXIT,
  CLI_MAX_INPUT_BYTES,
  commandName,
  type CliCommand,
  type CliCommandResult,
  type CliFormat,
  type CliInputSource,
  type CliOverviewResult,
} from "./contracts.ts";
import { GROMA_VERSION, HELP_TEXT } from "./help.ts";
import {
  INSTRUCTION_GUIDES,
  INSTRUCTION_GUIDE_KEYS,
  instructionGuide,
  instructionIndexText,
} from "./instructions/index.ts";
import { parseInvocation } from "./parser.ts";
import { renderCommandResult } from "./render.ts";
import { createCliSurfaceController, type CliInputReader } from "./surface.ts";
import { renderBlueprintHtml } from "./blueprint-html.ts";

export { GROMA_VERSION, HELP_TEXT } from "./help.ts";

export interface ProgramOutput {
  writeError(message: string): void;
  writeOutput(message: string): void;
}

export interface ProgramOptions {
  readonly confirm?: (question: string) => Promise<boolean>;
  readonly createRegistry?: (surface: HostSurface) => HostBootstrapRegistry;
  readonly inputReader?: CliInputReader;
  readonly presentBlueprint?: (html: string) => Promise<string>;
  readonly presentWebUrl?: (url: string) => void;
  readonly signalSource?: HostSignalSource;
  readonly terminal?: { readonly stdin: boolean; readonly stdout: boolean };
  readonly userDataRoot?: string;
  readonly workspaceRoot?: string;
}

function systemOpenCommand(target: string): readonly string[] {
  return process.platform === "darwin"
    ? ["/usr/bin/open", target]
    : process.platform === "win32"
      ? ["C:\\Windows\\System32\\cmd.exe", "/c", "start", "", target]
      : ["/usr/bin/xdg-open", target];
}

async function presentBlueprint(html: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "groma-blueprint-"));
  const artifact = path.join(directory, "blueprint.html");
  await writeFile(artifact, html, { encoding: "utf8", mode: 0o600 });
  const command = systemOpenCommand(artifact);
  const opened = Bun.spawn({ cmd: [...command], stderr: "ignore", stdout: "ignore" });
  const exitCode = await new Promise<number | undefined>((resolve) => {
    let complete = false;
    const timeout = setTimeout(() => {
      if (complete) return;
      complete = true;
      opened.kill();
      resolve(undefined);
    }, 5_000);
    void opened.exited.then((code) => {
      if (complete) return;
      complete = true;
      clearTimeout(timeout);
      resolve(code);
    });
  });
  if (exitCode !== 0) throw new Error("Blueprint artifact could not be opened");
  return artifact;
}

async function defaultConfirm(question: string): Promise<boolean> {
  process.stderr.write(question);
  const reader = Bun.stdin.stream().getReader();
  try {
    const item = await reader.read();
    const answer =
      item.value === undefined ? "" : new TextDecoder().decode(item.value).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } catch {
    return false;
  } finally {
    reader.releaseLock();
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function readBoundedStream(
  stream: ReadableStream<Uint8Array>,
  cancellation: AbortSignal,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let cancellationPromise: Promise<void> | undefined;
  const cancel = () => {
    if (cancellationPromise !== undefined) return;
    try {
      cancellationPromise = reader.cancel().then(
        () => undefined,
        () => undefined,
      );
    } catch {
      cancellationPromise = Promise.resolve();
    }
  };
  cancellation.addEventListener("abort", cancel, { once: true });
  try {
    if (cancellation.aborted) {
      cancel();
      throw new Error("input cancelled");
    }
    while (true) {
      const item = await reader.read();
      if (cancellation.aborted) throw new Error("input cancelled");
      if (item.done) break;
      total += item.value.byteLength;
      if (total > CLI_MAX_INPUT_BYTES) throw new Error("input exceeds bound");
      chunks.push(item.value.slice());
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return decodeUtf8(bytes);
  } catch (error) {
    cancel();
    throw error;
  } finally {
    cancellation.removeEventListener("abort", cancel);
    if (cancellationPromise !== undefined) await cancellationPromise;
    reader.releaseLock();
  }
}

function defaultInputReader(workspaceRoot: string): CliInputReader {
  return Object.freeze({
    read(source: CliInputSource, cancellation: AbortSignal): Promise<string> {
      const stream =
        source.kind === "file"
          ? Bun.file(path.resolve(workspaceRoot, source.path)).stream()
          : Bun.stdin.stream();
      return readBoundedStream(stream, cancellation);
    },
  });
}

function diagnosticResult(
  command: string,
  exitCode: number,
  code: string,
  message: string,
): CliCommandResult {
  return Object.freeze({
    command,
    exitCode,
    ok: false,
    result: Object.freeze({
      diagnostics: Object.freeze([Object.freeze({ code, message })]),
      ok: false,
    }),
  });
}

function hostExit(diagnostics: readonly { readonly code: string }[], fallback: number): number {
  return diagnostics.length > 0 &&
    diagnostics.every((entry) =>
      [
        "runtime-plugin-unavailable",
        "workspace-configuration-changed",
        "workspace-configuration-conflict",
        "workspace-configuration-malformed",
        "workspace-discovery-conflict",
      ].includes(entry.code),
    )
    ? CLI_EXIT.workspace
    : fallback;
}

function emit(
  value: CliCommandResult,
  format: CliFormat,
  output: ProgramOutput,
  color = false,
): number {
  let emitted = value;
  let rendered = renderCommandResult(emitted, format, { color });
  if (!rendered.ok) {
    emitted = diagnosticResult(
      value.command,
      CLI_EXIT.infrastructure,
      "cli-output-bound-exceeded",
      "The command result exceeds the supported output bound",
    );
    rendered = renderCommandResult(emitted, format, { color });
    if (!rendered.ok) {
      output.writeError("Groma could not render the bounded command result.\n");
      return CLI_EXIT.infrastructure;
    }
  }
  output.writeOutput(rendered.text);
  return emitted.exitCode;
}

function isRegistryManagementCommand(command: CliCommand): boolean {
  switch (command.kind) {
    case "project-add":
    case "project-get":
    case "project-list":
    case "project-remove":
    case "project-update":
      return true;
    default:
      return false;
  }
}

export async function runProgram(
  args: readonly string[],
  output: ProgramOutput,
  options: ProgramOptions = {},
): Promise<number> {
  const parsed = parseInvocation(args);
  if (!parsed.ok) {
    return emit(
      diagnosticResult(
        "invocation",
        CLI_EXIT.usage,
        parsed.diagnostic.code,
        parsed.diagnostic.message,
      ),
      parsed.format,
      output,
    );
  }
  const invocation = parsed.invocation;
  if (invocation.command.kind === "help") {
    if (invocation.format === "plain") {
      output.writeOutput(HELP_TEXT);
      return CLI_EXIT.success;
    }
    return emit(
      Object.freeze({
        command: "help",
        exitCode: CLI_EXIT.success,
        ok: true,
        result: Object.freeze({ usage: HELP_TEXT }),
      }),
      invocation.format,
      output,
    );
  }
  if (invocation.command.kind === "version") {
    if (invocation.format === "plain") {
      output.writeOutput(`${GROMA_VERSION}\n`);
      return CLI_EXIT.success;
    }
    return emit(
      Object.freeze({
        command: "version",
        exitCode: CLI_EXIT.success,
        ok: true,
        result: Object.freeze({ version: GROMA_VERSION }),
      }),
      invocation.format,
      output,
    );
  }
  if (invocation.command.kind === "instructions") {
    const requested = invocation.command.guide;
    const guide = requested === undefined ? undefined : instructionGuide(requested);
    if (requested !== undefined && guide === undefined) {
      return emit(
        diagnosticResult(
          "instructions",
          CLI_EXIT.usage,
          "cli-unknown-instruction-guide",
          `Unknown instruction guide; valid guides: ${INSTRUCTION_GUIDE_KEYS.join(", ")}`,
        ),
        invocation.format,
        output,
      );
    }
    if (invocation.format === "plain") {
      output.writeOutput(guide === undefined ? instructionIndexText() : `${guide.markdown}\n`);
      return CLI_EXIT.success;
    }
    return emit(
      Object.freeze({
        command: "instructions",
        exitCode: CLI_EXIT.success,
        ok: true,
        result:
          guide === undefined
            ? Object.freeze({
                guides: INSTRUCTION_GUIDES.map((entry) =>
                  Object.freeze({
                    description: entry.description,
                    key: entry.key,
                    title: entry.title,
                  }),
                ),
                kind: "instructions-index",
              })
            : Object.freeze({
                guide: Object.freeze({
                  description: guide.description,
                  key: guide.key,
                  markdown: guide.markdown,
                  title: guide.title,
                }),
                kind: "instructions-guide",
              }),
      }),
      invocation.format,
      output,
    );
  }

  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const terminal = options.terminal ?? {
    stdin: process.stdin.isTTY === true,
    stdout: process.stdout.isTTY === true,
  };
  const color =
    invocation.format === "plain" && terminal.stdout && process.env.NO_COLOR === undefined;
  const webReady =
    options.presentWebUrl ??
    ((url: string) => {
      if (invocation.format === "plain") {
        output.writeOutput(`Serving the current blueprint at ${url}\nPress Ctrl+C to stop.\n`);
      }
      if (terminal.stdin && terminal.stdout) {
        Bun.spawn({ cmd: [...systemOpenCommand(url)], stderr: "ignore", stdout: "ignore" });
      }
    });
  const confirmInit =
    invocation.format === "plain" && terminal.stdin && terminal.stdout
      ? (options.confirm ?? defaultConfirm)
      : undefined;
  const controller = createCliSurfaceController(
    invocation,
    options.inputReader ?? defaultInputReader(workspaceRoot),
    terminal,
    webReady,
    confirmInit,
  );
  const managementCommand = isRegistryManagementCommand(invocation.command);
  const registry =
    options.createRegistry?.(controller.surface) ??
    createDefaultBootstrapRegistry({ surface: controller.surface });
  const hostOutcome = await runHost({
    context: { workspaceRoot },
    recoveryPolicy: managementCommand ? "management-not-required" : "semantic-required",
    registry,
    signalSource: options.signalSource ?? createProcessSignalSource(),
  });
  const command = commandName(invocation.command);
  if (hostOutcome.status === "cancelled") {
    const scanResult =
      invocation.command.kind === "scan" || invocation.command.kind === "web"
        ? controller.result()
        : undefined;
    if (scanResult !== undefined) return emit(scanResult, invocation.format, output, color);
    const exitCode = hostOutcome.signal === "SIGTERM" ? 143 : CLI_EXIT.cancelled;
    return emit(
      Object.freeze({ command, exitCode, ok: false, result: hostOutcome }),
      invocation.format,
      output,
      color,
    );
  }
  if (hostOutcome.status === "startup-failure" || hostOutcome.status === "surface-failure") {
    return emit(
      Object.freeze({
        command,
        exitCode: hostExit(hostOutcome.diagnostics, CLI_EXIT.infrastructure),
        ok: false,
        result: hostOutcome,
      }),
      invocation.format,
      output,
      color,
    );
  }
  let commandResult = controller.result();
  if (
    invocation.command.kind === "overview" &&
    invocation.format === "plain" &&
    commandResult?.ok === true &&
    typeof commandResult.result === "object" &&
    commandResult.result !== null &&
    (commandResult.result as { readonly kind?: unknown }).kind === "hierarchy"
  ) {
    const rendered = renderBlueprintHtml(
      commandResult.result as Extract<CliOverviewResult, { readonly kind: "hierarchy" }>,
    );
    if (!rendered.ok) {
      commandResult = diagnosticResult(
        command,
        CLI_EXIT.infrastructure,
        "cli-blueprint-artifact-bound-exceeded",
        "The bounded visual blueprint exceeds the local artifact limit",
      );
    } else {
      try {
        const artifact = await (options.presentBlueprint ?? presentBlueprint)(rendered.html);
        commandResult = Object.freeze({
          command,
          exitCode: CLI_EXIT.success,
          ok: true,
          result: Object.freeze({
            artifact,
            generation: (commandResult.result as { readonly generation: number }).generation,
            nodeCount: (commandResult.result as { readonly nodes: readonly unknown[] }).nodes
              .length,
            status: "opened",
          }),
        });
      } catch {
        commandResult = diagnosticResult(
          command,
          CLI_EXIT.infrastructure,
          "cli-blueprint-artifact-unavailable",
          "The local visual blueprint could not be opened",
        );
      }
    }
  }
  return emit(
    commandResult ??
      diagnosticResult(
        command,
        CLI_EXIT.infrastructure,
        "cli-result-unavailable",
        "The host completed without a command result",
      ),
    invocation.format,
    output,
    color,
  );
}
