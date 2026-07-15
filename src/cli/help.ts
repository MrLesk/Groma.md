import { CLI_MAX_PAGE_SIZE } from "./contracts.ts";

export const GROMA_VERSION = "0.0.0";

export const HELP_TEXT = `Groma ${GROMA_VERSION}

Local-first architectural blueprints for humans and AI agents.

Usage:
  groma
  groma --help
  groma --version
  groma [--format plain|json] init
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
  groma [--format plain|json] component reparent <id> --revision <revision> (--parent <parent-id> | --root)
  groma [--format plain|json] component remove <id> --revision <revision>

Create and update input is one bounded UTF-8 JSON application request envelope.
Parent changes for existing components use the explicit reparent command.
Every ordinary read returns exactly one bounded page; page limits are explicit.

Package add accepts local filesystem paths only; remote npm, Git, and URL acquisition is out of scope.
Add and inspect read inert data and never execute package code. Enable is the execution boundary.
Plugins run with your full user permissions. Groma verifies what was installed, not that it is safe.
The explicit --trust-full-user-permissions flag is required before a new exact entry executes.
`;
