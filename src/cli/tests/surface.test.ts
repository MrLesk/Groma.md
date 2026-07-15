import { describe, expect, test } from "bun:test";

import type { HostSurfaceContext } from "../../host/index.ts";
import { CLI_EXIT, type CliInvocation } from "../contracts.ts";
import { createCliSurfaceController } from "../surface.ts";

function context(code: string): HostSurfaceContext {
  const unavailable = Object.freeze({
    diagnostics: Object.freeze([Object.freeze({ code, message: "Unavailable" })]),
    ok: false as const,
  });
  return Object.freeze({
    cancellation: new AbortController().signal,
    initialization: Object.freeze({ initialize: async () => unavailable }),
    recovery: Object.freeze({ status: "not-required" as const }),
    workspace: Object.freeze({
      initialize: async () => ({
        diagnostics: unavailable.diagnostics,
        status: "provider-failure" as const,
      }),
      recover: async () => unavailable,
      requireWorkspace: () => unavailable,
      status: () => ({ state: "configured" as const }),
    }),
    packages: Object.freeze({
      add: async () => ({
        diagnostics: [{ code, message: "Unavailable" }],
        ok: false as const,
      }),
      disable: async () => ({
        diagnostics: [{ code, message: "Unavailable" }],
        ok: false as const,
      }),
      enable: async () => ({
        diagnostics: [{ code, message: "Unavailable" }],
        ok: false as const,
      }),
      inspect: async () => ({
        diagnostics: [{ code, message: "Unavailable" }],
        ok: false as const,
      }),
      remove: async () => ({
        diagnostics: [{ code, message: "Unavailable" }],
        ok: false as const,
      }),
    }),
  });
}

describe("CLI surface", () => {
  test("distinguishes provider infrastructure from workspace conflicts", async () => {
    const invocation: CliInvocation = Object.freeze({
      command: Object.freeze({ kind: "component-roots", limit: 1 }),
      format: "json",
    });

    for (const [code, exitCode] of [
      ["workspace-configuration-provider-failure", CLI_EXIT.infrastructure],
      ["workspace-configuration-conflict", CLI_EXIT.workspace],
    ] as const) {
      const controller = createCliSurfaceController(
        invocation,
        { read: async () => "{}" },
        { stdin: false, stdout: false },
      );
      const session = await controller.surface.start(context(code));
      await session.completion;

      expect(controller.result()).toMatchObject({ exitCode, ok: false });
      await session.stop();
    }
  });

  test("classifies local package configuration failures as workspace failures", async () => {
    const invocation: CliInvocation = Object.freeze({
      command: Object.freeze({
        entry: "./plugins/entry.js",
        kind: "package-enable",
        name: "example",
        scope: "blueprint",
        trustFullUserPermissions: true,
      }),
      format: "json",
    });
    for (const code of [
      "plugin-package-enabled-limit-exceeded",
      "plugin-package-trust-root-unattested",
      "plugin-package-user-state-unavailable",
    ]) {
      const controller = createCliSurfaceController(
        invocation,
        { read: async () => "{}" },
        { stdin: false, stdout: false },
      );
      const session = await controller.surface.start(context(code));
      await session.completion;

      expect(controller.result(), code).toMatchObject({
        exitCode: CLI_EXIT.workspace,
        ok: false,
      });
      await session.stop();
    }
  });
});
