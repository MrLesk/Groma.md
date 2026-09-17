# Inspecting a scan

A scan reports evidence: source files, symbols, source roots, and inferred
placement. Its first result is not the finished architecture. Run the scan and
read the result before proposing components, then read enough source to
identify responsibilities, collaborations, and reasons to change. Directories,
imports, and projects are evidence, not architecture.

When a human asks only to inspect or explain a scan, stop after reading. Do not
add descriptions, actors, flows, groups, or relationship rows.

## Commands

| Command | Target | Result |
| --- | --- | --- |
| `groma scan` | none | Scans the repository and updates the stored architecture. Prints `ok` and a summary, not the architecture. |
| `groma view --plain` | none | Prints the actors, systems, and external systems, the relationships between them, and the flow and draft indexes. Does not scan. |
| `groma view <id> --plain` | an element ID | Prints that element, its direct children, and the relationships that cross its boundary, split into incoming and outgoing. Run it on a child ID to go one C4 level deeper. Does not scan. |
| `groma view <target>` | an element ID: actor, external system, system, container, or component | Without `--plain`, prints that complete Markdown record, including its Code references. Does not scan. |
| | a flow ID | Prints the flow record with its steps. |
| | a draft ID | Prints the draft's outcome and the elements it touches. |
| | an exact repository-relative source file | Prints the record of the component that owns the file. |
| `groma scanner list` | none | Lists the configured scanners and whether each is ready. |
| `groma lint` | none | Reports possible duplicate logic from fresh scanner evidence. Findings are review questions: they are not relationships and do not merge components. |

A relationship line reads `source -> target | description | technology`, with
a trailing `| draft` on a draft relationship. The overview lifts each end to
its actor or system; a drill-down names the stored endpoints, which can sit
below the listed children.

`groma view <target>` accepts only the targets above. `project`, `relation`,
and group addresses are `groma edit` targets, not `groma view` targets.
On a terminal, `groma view` without a target and `groma web` scan and open
interactive maps for a human.

## Scanner coverage

Each scanner reads only its own languages from Git's tracked and unignored
untracked files, and applies its own default exclusions. Files that no enabled
scanner covers are not inspected. Do not assume an uncovered file was read, and
do not create a component for it by hand. Report the coverage gap to the human.
