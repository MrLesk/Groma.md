import { CLI_MAX_PAGE_SIZE } from "./contracts.ts";

export const GROMA_VERSION = "0.0.0";

export const HELP_TEXT = `Groma ${GROMA_VERSION}

Local-first architectural blueprints for humans and AI agents.

Usage:
  groma
  groma --help
  groma --version
  groma [--format plain|json] init
  groma [--format plain|json] package scaffold <destination> --name <package-name> --plugin <plugin-id> --provides <capability-id> [--provides <capability-id> ...]
  groma [--format plain|json] package add <local-path> [--personal]
  groma [--format plain|json] package inspect <package-name> [--personal]
  groma [--format plain|json] package enable <package-name> <entry> [--personal] [--trust-full-user-permissions]
  groma [--format plain|json] package disable <package-name> <entry> [--personal]
  groma [--format plain|json] package remove <package-name> [--personal]
  groma [--format plain|json] component create (--input <file|-> | --stdin)
  groma [--format plain|json] component get <id> --relationships-limit <1-${CLI_MAX_PAGE_SIZE}> [--relationships-cursor <cursor>]
  groma [--format plain|json] component list --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] component roots --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] component children <parent-id> --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] component update (--input <file|-> | --stdin)
  groma [--format plain|json] component merge <obsolete-id> --into <survivor-id> --revision <obsolete-revision>
  groma [--format plain|json] component reparent <id> --revision <revision> (--parent <parent-id> | --root)
  groma [--format plain|json] component remove <id> --revision <revision>

Create and update input is one bounded UTF-8 JSON application request envelope.
Parent changes for existing components use the explicit reparent command.
Merge is the only operation that creates a component alias. It removes the obsolete component,
keeps the survivor identity unchanged, and preserves old references through canonical supersession.
Every ordinary read returns exactly one bounded page; page limits are explicit.

Package add accepts local filesystem paths only; remote npm, Git, and URL acquisition is out of scope.
Package scaffold creates one minimal Phase 1 plugin and a public conformance-test starting point.
Its destination must be a portable workspace-contained ./ path reusable by package add.
Every --provides value becomes one single-provider capability at version 1.0.0.
The generated test requires the public groma package in the authoring workspace.
Add and inspect read inert data and never execute package code. Enable is the execution boundary.
Plugins run with your full user permissions. Groma verifies what was installed, not that it is safe.
The explicit --trust-full-user-permissions flag is required before a new exact entry executes.
Local plugin IDs cannot use the Host-reserved official.* namespace.
Disable retains unchanged exact-byte trust; remove revokes the package's grants.
`;
