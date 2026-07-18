import {
  CLI_MAX_PAGE_SIZE,
  CLI_MAX_SEARCH_CHARACTERS,
  CLI_MAX_TRAVERSAL_DEPTH,
} from "./contracts.ts";

export const GROMA_VERSION = "0.0.0";

export const HELP_TEXT = `Groma ${GROMA_VERSION}

Local-first architectural blueprints for humans and AI agents.

Usage:
  groma
  groma --help
  groma --version
  groma [--format plain|json] init
  groma [--format plain|json] blueprint export --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] blueprint search <text:1-${CLI_MAX_SEARCH_CHARACTERS} raw characters> --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] blueprint traverse <id> --direction incoming|outgoing|both --depth <1-${CLI_MAX_TRAVERSAL_DEPTH}> [--relation-type <type>] --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] migrate status
  groma [--format plain|json] migrate preview
  groma [--format plain|json] migrate apply
  groma [--format plain|json] package scaffold <destination> --name <package-name> --plugin <plugin-id> --provides <capability-id> [--provides <capability-id> ...]
  groma [--format plain|json] package add <local-path> [--personal]
  groma [--format plain|json] package inspect <package-name> [--personal]
  groma [--format plain|json] package enable <package-name> <entry> [--personal] [--trust-full-user-permissions]
  groma [--format plain|json] package disable <package-name> <entry> [--personal]
  groma [--format plain|json] package remove <package-name> [--personal]
  groma [--format plain|json] project add (--input <file|-> | --stdin)
  groma [--format plain|json] project get <project-id>
  groma [--format plain|json] project list
  groma [--format plain|json] project update <project-id> --revision <revision> (--input <file|-> | --stdin)
  groma [--format plain|json] project remove <project-id> --revision <revision>
  groma [--format plain|json] component create (--input <file|-> | --stdin)
  groma [--format plain|json] component get <id> --relationships-limit <1-${CLI_MAX_PAGE_SIZE}> [--relationships-cursor <cursor>]
  groma [--format plain|json] component list --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] component roots --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] component children <parent-id> --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] component update (--input <file|-> | --stdin)
  groma [--format plain|json] component merge <obsolete-id> --into <survivor-id> --revision <obsolete-revision>
  groma [--format plain|json] component reparent <id> --revision <revision> (--parent <parent-id> | --root)
  groma [--format plain|json] component remove <id> --revision <revision>

Component create/update and project add/update input is one bounded UTF-8 JSON request envelope.
Project input contains name, a portable aggregate-workspace-relative source, sorted enabled scanner
records with canonical data-only configuration, and project-source-relative coverage roots. Project
updates and removal require the exact current registration revision. Availability is derived locally;
unavailability and removal never delete prior evidence or mutate observed source content.
Parent changes for existing components use the explicit reparent command.
Merge is the only operation that creates a component alias. It removes the obsolete component,
keeps the survivor identity unchanged, and preserves old references through canonical supersession.
Every ordinary read returns exactly one bounded page; page limits are explicit.
Command results are buffered atomically up to eight MiB and never partially streamed.
Blueprint export, search, and traversal read the disposable projection through shared application
operations. Surface cursors are opaque and never followed implicitly. Every export item includes
one component and all of its outgoing depth-1 relationships; a complete export consumes only its
fingerprint-bound component pages at one generation.
Blueprint search text accepts 1-${CLI_MAX_SEARCH_CHARACTERS} raw characters before normalization.
Blueprint traversal depth accepts the official range 1-${CLI_MAX_TRAVERSAL_DEPTH}.
If an export page exceeds local aggregate bounds, retry with a smaller --limit.
If --limit 1 still fails, one self-contained item exceeds the local export bounds.

Migration status and preview are read-only. Preview lists every canonical resource and the exact
migrator path that would run. Apply is the only migration write boundary and publishes one exact
all-resource catalog batch through a durable transaction; ordinary reads and mutations never migrate implicitly.

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
