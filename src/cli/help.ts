import {
  CLI_MAX_PAGE_SIZE,
  CLI_MAX_SEARCH_CHARACTERS,
  CLI_MAX_TRAVERSAL_DEPTH,
} from "./contracts.ts";

export const GROMA_VERSION = "0.0.0";

export const HELP_TEXT = `Groma ${GROMA_VERSION}

Local-first architectural blueprints for humans and AI agents.

Run bare groma in an interactive terminal to open the bounded local visual blueprint.
In an interactive terminal, use groma --format json to read the same bounded hierarchy without
opening an artifact.

Usage:
  groma
  groma --help
  groma --version
  groma [--format plain|json] init
  groma [--format plain|json] instructions [overview|scanning|curation|reading]
  groma [--format plain|json] export [--output <file>]
  groma [--format plain|json] web [--port <0-65535>]
  groma [--format plain|json] scan [--project <project-id>] [--scanner <scanner-id>]
  groma [--format plain|json] scan (--input <file|-> | --stdin)
  groma [--format plain|json] blueprint export --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] blueprint search <text:1-${CLI_MAX_SEARCH_CHARACTERS} raw characters> --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>] [--scale system|domain|part|element] [--shared true|false]
  groma [--format plain|json] blueprint traverse <id> --direction incoming|outgoing|both --depth <1-${CLI_MAX_TRAVERSAL_DEPTH}> [--relation-type <type>] --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>]
  groma [--format plain|json] project add (--input <file|-> | --stdin)
  groma [--format plain|json] project get <project-id>
  groma [--format plain|json] project list
  groma [--format plain|json] project update <project-id> --revision <revision> (--input <file|-> | --stdin)
  groma [--format plain|json] project remove <project-id> --revision <revision>
  groma [--format plain|json] component create (--input <file|-> | --stdin)
  groma [--format plain|json] component get <id> --relationships-limit <1-${CLI_MAX_PAGE_SIZE}> [--relationships-cursor <cursor>]
  groma [--format plain|json] component list --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>] [--scale system|domain|part|element] [--shared true|false]
  groma [--format plain|json] component roots --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>] [--scale system|domain|part|element] [--shared true|false]
  groma [--format plain|json] component children <parent-id> --limit <1-${CLI_MAX_PAGE_SIZE}> [--cursor <cursor>] [--scale system|domain|part|element] [--shared true|false]
  groma [--format plain|json] component update (--input <file|-> | --stdin)
  groma [--format plain|json] component merge <obsolete-id> --into <survivor-id> --revision <obsolete-revision>
  groma [--format plain|json] component reparent <id> --revision <revision> (--parent <parent-id> | --root)
  groma [--format plain|json] component remove <id> --revision <revision>

Instructions prints the built-in working guides for humans and agents; it needs no workspace.
Export writes blueprint.html by default: one deterministic, self-contained, read-only snapshot
using the embedded web client and a finite sequence of shared bounded reads. The file opens without
Groma or a server, makes no network requests, and contains no canonical mutation affordances.
Web serves the embedded interactive blueprint on 127.0.0.1 only (default port 4766, 0 for an
ephemeral port) until Ctrl+C. It exposes bounded reads and component create, update, move, merge,
and remove through the same shared application operations as the CLI. Mutation requests use POST
under /api/component, require the exact loopback Origin and Host, and remain revision-checked.
The web surface makes no request beyond the local listener.
In a plain-format interactive terminal, web and scan offer to run groma init first when no
workspace exists yet.
Component create/update and project add/update input is one bounded UTF-8 JSON request envelope.
Scan uses the only registered project and scanner when selection is unambiguous. The initialized
default project is configured for the built-in TypeScript/Bun scanner before its first scan.
Scan input accepts one complete groma.observation/v1 JSON snapshot whose project, scanner, and
coverage exactly match local registration, then uses the same atomic reconciliation path.
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
Component list, roots, children, and blueprint search accept the same optional exact scale and shared filters.
Blueprint traversal depth accepts the official range 1-${CLI_MAX_TRAVERSAL_DEPTH}.
If an export page exceeds local aggregate bounds, retry with a smaller --limit.
If --limit 1 still fails, one self-contained item exceeds the local export bounds.

`;
