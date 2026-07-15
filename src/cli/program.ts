import path from "node:path";

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
  type CliCommandResult,
  type CliFormat,
  type CliInputSource,
} from "./contracts.ts";
import { GROMA_VERSION, HELP_TEXT } from "./help.ts";
import { parseInvocation } from "./parser.ts";
import { renderCommandResult } from "./render.ts";
import { createCliSurfaceController, type CliInputReader } from "./surface.ts";

export { GROMA_VERSION, HELP_TEXT } from "./help.ts";

export interface ProgramOutput {
  writeError(message: string): void;
  writeOutput(message: string): void;
}

export interface ProgramOptions {
  readonly createRegistry?: (surface: HostSurface) => HostBootstrapRegistry;
  readonly inputReader?: CliInputReader;
  readonly signalSource?: HostSignalSource;
  readonly terminal?: { readonly stdin: boolean; readonly stdout: boolean };
  readonly userDataRoot?: string;
  readonly workspaceRoot?: string;
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
  return diagnostics.some(
    (entry) =>
      [
        "project-plugin-validation-required",
        "plugin-full-user-permissions-trust-required",
        "remote-plugin-package-acquisition-out-of-scope",
        "runtime-plugin-unavailable",
        "workspace-configuration-changed",
        "workspace-configuration-conflict",
        "workspace-configuration-malformed",
        "workspace-discovery-conflict",
      ].includes(entry.code) ||
      entry.code.startsWith("plugin-package-") ||
      entry.code.startsWith("invalid-plugin-package-") ||
      entry.code.startsWith("incompatible-plugin-") ||
      entry.code === "unsupported-plugin-package-manifest-version",
  )
    ? CLI_EXIT.workspace
    : fallback;
}

function emit(value: CliCommandResult, format: CliFormat, output: ProgramOutput): number {
  let emitted = value;
  let rendered = renderCommandResult(emitted, format);
  if (!rendered.ok) {
    emitted = diagnosticResult(
      value.command,
      CLI_EXIT.infrastructure,
      "cli-output-bound-exceeded",
      "The command result exceeds the supported output bound",
    );
    rendered = renderCommandResult(emitted, format);
    if (!rendered.ok) {
      output.writeError("Groma could not render the bounded command result.\n");
      return CLI_EXIT.infrastructure;
    }
  }
  output.writeOutput(rendered.text);
  return emitted.exitCode;
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

  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const controller = createCliSurfaceController(
    invocation,
    options.inputReader ?? defaultInputReader(workspaceRoot),
    options.terminal ?? {
      stdin: process.stdin.isTTY === true,
      stdout: process.stdout.isTTY === true,
    },
  );
  const registry =
    options.createRegistry?.(controller.surface) ??
    createDefaultBootstrapRegistry({
      loadLocalPluginPackages: !invocation.command.kind.startsWith("package-"),
      surface: controller.surface,
      ...(options.userDataRoot === undefined ? {} : { userDataRoot: options.userDataRoot }),
    });
  const hostOutcome = await runHost({
    context: { workspaceRoot },
    registry,
    signalSource: options.signalSource ?? createProcessSignalSource(),
  });
  const command = commandName(invocation.command);
  if (hostOutcome.status === "cancelled") {
    const exitCode = hostOutcome.signal === "SIGTERM" ? 143 : CLI_EXIT.cancelled;
    return emit(
      Object.freeze({ command, exitCode, ok: false, result: hostOutcome }),
      invocation.format,
      output,
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
    );
  }
  const commandResult = controller.result();
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
  );
}
