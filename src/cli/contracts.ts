export const CLI_MAX_ARGUMENTS = 256;
export const CLI_MAX_ARGUMENT_CHARACTERS = 65_536;
export const CLI_MAX_CURSOR_CHARACTERS = 4_096;
export const CLI_MAX_SEARCH_CHARACTERS = 256;
export const CLI_MAX_TRAVERSAL_DEPTH = 16;
export const CLI_MAX_INPUT_BYTES = 1_048_576;
export const CLI_MAX_JSON_DEPTH = 30;
export const CLI_MAX_JSON_VALUES = 10_000;
export const CLI_MAX_PAGE_SIZE = 100;
export const CLI_MAX_RENDERED_BYTES = 8 * 1_048_576;
export const CLI_MAX_RENDERED_VALUES = 200_000;

export const CLI_EXIT = Object.freeze({
  cancelled: 130,
  indeterminate: 6,
  infrastructure: 5,
  semantic: 4,
  success: 0,
  usage: 2,
  workspace: 3,
} as const);

export type CliFormat = "json" | "plain";

export type CliInputSource =
  { readonly kind: "file"; readonly path: string } | { readonly kind: "stdin" };

export type CliCommand =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
  | { readonly kind: "overview" }
  | { readonly kind: "init" }
  | {
      readonly cursor?: string;
      readonly kind: "blueprint-export";
      readonly limit: number;
    }
  | {
      readonly cursor?: string;
      readonly kind: "blueprint-search";
      readonly limit: number;
      readonly text: string;
    }
  | {
      readonly cursor?: string;
      readonly depth: number;
      readonly direction: "incoming" | "outgoing" | "both";
      readonly id: string;
      readonly kind: "blueprint-traverse";
      readonly limit: number;
      readonly relationType?: string;
    }
  | { readonly input: CliInputSource; readonly kind: "component-create" }
  | { readonly input: CliInputSource; readonly kind: "project-add" }
  | { readonly id: string; readonly kind: "project-get" }
  | { readonly kind: "project-list" }
  | {
      readonly expectedRevision: string;
      readonly id: string;
      readonly input: CliInputSource;
      readonly kind: "project-update";
    }
  | {
      readonly expectedRevision: string;
      readonly id: string;
      readonly kind: "project-remove";
    }
  | {
      readonly id: string;
      readonly kind: "component-get";
      readonly relationships: { readonly cursor?: string; readonly limit: number };
    }
  | {
      readonly cursor?: string;
      readonly kind: "component-list" | "component-roots";
      readonly limit: number;
    }
  | {
      readonly cursor?: string;
      readonly kind: "component-children";
      readonly limit: number;
      readonly parent: string;
    }
  | { readonly input: CliInputSource; readonly kind: "component-update" }
  | {
      readonly expectedRevision: string;
      readonly kind: "component-merge";
      readonly obsolete: string;
      readonly survivor: string;
    }
  | {
      readonly expectedRevision: string;
      readonly id: string;
      readonly kind: "component-reparent";
      readonly parent: string | null;
    }
  | {
      readonly expectedRevision: string;
      readonly id: string;
      readonly kind: "component-remove";
    };

export interface CliDiagnostic {
  readonly code: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
  readonly message: string;
}

export interface CliCommandResult {
  readonly command: string;
  readonly exitCode: number;
  readonly ok: boolean;
  readonly result: unknown;
}

export interface CliOverviewNode {
  readonly depth: number;
  readonly displayText: string;
  readonly id: string;
  readonly name?: string;
  readonly revision: string;
  readonly type?: string;
}

export type CliOverviewResult =
  | { readonly kind: "help" }
  | { readonly kind: "workspace-missing" }
  | {
      readonly generation: number;
      readonly kind: "hierarchy";
      readonly nodes: readonly CliOverviewNode[];
      readonly truncations: readonly {
        readonly cursor?: string;
        readonly parent?: string;
        readonly reason: "children" | "depth" | "nodes" | "queries" | "roots";
      }[];
    };

export interface CliInvocation {
  readonly command: CliCommand;
  readonly format: CliFormat;
}

export type CliInvocationResult =
  | { readonly diagnostic: CliDiagnostic; readonly format: CliFormat; readonly ok: false }
  | { readonly invocation: CliInvocation; readonly ok: true };

export function commandName(command: CliCommand): string {
  switch (command.kind) {
    case "blueprint-export":
      return "blueprint export";
    case "blueprint-search":
      return "blueprint search";
    case "blueprint-traverse":
      return "blueprint traverse";
    case "component-create":
      return "component create";
    case "component-get":
      return "component get";
    case "component-list":
      return "component list";
    case "component-roots":
      return "component roots";
    case "component-children":
      return "component children";
    case "component-update":
      return "component update";
    case "component-merge":
      return "component merge";
    case "component-reparent":
      return "component reparent";
    case "component-remove":
      return "component remove";
    case "project-add":
      return "project add";
    case "project-get":
      return "project get";
    case "project-list":
      return "project list";
    case "project-update":
      return "project update";
    case "project-remove":
      return "project remove";
    default:
      return command.kind;
  }
}
