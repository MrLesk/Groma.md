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
  readonly workspaceRoot?: string;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function defaultInputReader(workspaceRoot: string): CliInputReader {
  return Object.freeze({
    async read(source: CliInputSource): Promise<string> {
      if (source.kind === "file") {
        const file = Bun.file(path.resolve(workspaceRoot, source.path));
        if (file.size > CLI_MAX_INPUT_BYTES) throw new Error("input exceeds bound");
        const bytes = await file.bytes();
        if (bytes.byteLength > CLI_MAX_INPUT_BYTES) throw new Error("input exceeds bound");
        return decodeUtf8(bytes);
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      for await (const chunk of Bun.stdin.stream()) {
        total += chunk.byteLength;
        if (total > CLI_MAX_INPUT_BYTES) throw new Error("input exceeds bound");
        chunks.push(chunk.slice());
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return decodeUtf8(bytes);
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
  return diagnostics.some((entry) => entry.code === "workspace-configuration-conflict")
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
    output.writeOutput(HELP_TEXT);
    return CLI_EXIT.success;
  }
  if (invocation.command.kind === "version") {
    output.writeOutput(`${GROMA_VERSION}\n`);
    return CLI_EXIT.success;
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
    createDefaultBootstrapRegistry({ surface: controller.surface });
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
