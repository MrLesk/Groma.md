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
      scaffold: async () => ({
        diagnostics: [{ code, message: "Unavailable" }],
        ok: false as const,
      }),
    }),
  });
}

describe("CLI surface", () => {
  test("classifies query availability, stale cursors, and blueprint page bounds", async () => {
    for (const [code, exitCode] of [
      ["graph-query-unavailable", CLI_EXIT.infrastructure],
      ["workspace-capability-failed", CLI_EXIT.infrastructure],
      ["stale-cursor", CLI_EXIT.semantic],
      ["blueprint-export-page-bound-exceeded", CLI_EXIT.semantic],
      ["blueprint-search-page-bound-exceeded", CLI_EXIT.semantic],
      ["blueprint-traverse-page-bound-exceeded", CLI_EXIT.semantic],
    ] as const) {
      const base = context("unused");
      const unavailable = Object.freeze({
        diagnostics: Object.freeze([Object.freeze({ code, message: "Unavailable" })]),
        ok: false as const,
      });
      const operations = Object.freeze({
        exportBlueprint: async () => unavailable,
        listRoots: async () => unavailable,
      });
      const controller = createCliSurfaceController(
        Object.freeze({
          command: Object.freeze({ kind: "blueprint-export", limit: 1 }),
          format: "json",
        }),
        { read: async () => "{}" },
        { stdin: false, stdout: false },
      );
      const session = await controller.surface.start(
        Object.freeze({
          ...base,
          workspace: Object.freeze({
            ...base.workspace,
            requireWorkspace: () =>
              Object.freeze({ ok: true as const, value: operations as never }),
          }),
        }),
      );
      await session.completion;
      expect(controller.result()).toMatchObject({ exitCode, ok: false });
      await session.stop();
    }
  });

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

  test("keeps late package configuration provider failures in the infrastructure class", async () => {
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
    const controller = createCliSurfaceController(
      invocation,
      { read: async () => "{}" },
      { stdin: false, stdout: false },
    );
    const session = await controller.surface.start(
      context("workspace-configuration-provider-failure"),
    );
    await session.completion;

    expect(controller.result()).toMatchObject({ exitCode: CLI_EXIT.infrastructure, ok: false });
    await session.stop();
  });

  test("maps transient migration catalog failures to the infrastructure exit class", async () => {
    const base = context("unused");
    for (const code of [
      "resource-provider-failure",
      "resource-missing",
      "resource-unreadable",
      "resource-unavailable",
      "stale-resource-cursor",
      "migration-resource-provider-failure",
    ]) {
      const unavailable = Object.freeze({
        diagnostics: Object.freeze([Object.freeze({ code, message: "Unavailable" })]),
        ok: false as const,
      });
      const migrationContext: HostSurfaceContext = Object.freeze({
        ...base,
        migrations: Object.freeze({
          apply: async () =>
            Object.freeze({
              diagnostics: unavailable.diagnostics,
              phase: "snapshot" as const,
              status: "provider-failure" as const,
            }),
          preview: async () => unavailable,
          status: async () => unavailable,
        }),
        workspace: Object.freeze({
          ...base.workspace,
          requireWorkspace: () =>
            Object.freeze({ ok: true as const, value: Object.freeze({}) as never }),
        }),
      });

      for (const kind of ["migrate-status", "migrate-preview", "migrate-apply"] as const) {
        const controller = createCliSurfaceController(
          Object.freeze({ command: Object.freeze({ kind }), format: "json" }),
          { read: async () => "{}" },
          { stdin: false, stdout: false },
        );
        const session = await controller.surface.start(migrationContext);
        await session.completion;

        expect(controller.result(), `${code}:${kind}`).toMatchObject({
          exitCode: CLI_EXIT.infrastructure,
          ok: false,
        });
        await session.stop();
      }
    }
  });

  test("classifies scaffold publication failures as infrastructure failures", async () => {
    const invocation: CliInvocation = Object.freeze({
      command: Object.freeze({
        destination: "./plugins/example",
        kind: "package-scaffold",
        name: "example-package",
        pluginId: "example.plugin",
        provides: Object.freeze(["example.capability/v1"]),
      }),
      format: "json",
    });
    const controller = createCliSurfaceController(
      invocation,
      { read: async () => "{}" },
      { stdin: false, stdout: false },
    );
    const session = await controller.surface.start(context("plugin-scaffold-publication-failed"));
    await session.completion;

    expect(controller.result()).toMatchObject({ exitCode: CLI_EXIT.infrastructure, ok: false });
    await session.stop();
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
      "plugin-package-lock-changed",
      "plugin-package-plugin-id-conflict",
      "plugin-package-state-limit-exceeded",
      "plugin-package-state-unavailable",
      "plugin-package-trust-root-unattested",
      "plugin-package-user-state-changed",
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
