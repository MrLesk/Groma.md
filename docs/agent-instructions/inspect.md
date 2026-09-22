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
| `groma scan` | none | Scans the repository and updates the stored architecture. Prints `ok` and a summary, not the architecture. While no element has a description or an overview, a single scan ends with `First scan. Ask your coding agent to curate this architecture.` |
| `groma view --plain` | none | Prints the actors, systems, and external systems, the relationships between them, and the flow and draft indexes. Does not scan. |
| `groma view <id> --plain` | an element ID | Prints that element, its direct children, and the relationships that cross its boundary, split into incoming and outgoing. Run it on a child ID to go one C4 level deeper. Does not scan. |
| `groma view <target>` | an element ID: actor, external system, system, container, or component | Without `--plain`, prints that complete Markdown record, including its Code references. Does not scan. |
| | a flow ID | Prints the flow record with its steps. |
| | a draft ID | Prints the draft's outcome and the elements it touches. |
| | an exact repository-relative source file | Prints the owning component's ID, kind, title, and parent, the file connections of map relationships split into incoming and outgoing, and the command for the owner's complete record. Rows between files of one component are not listed; `groma view <owner-id> --plain` lists relationships that name the owner element. |
| `groma scanner list` | none | Lists the configured scanners and whether each is ready. |
| `groma lint` | none | Pages possible duplicate logic from fresh scanner evidence. Findings are review questions: they are not relationships and do not merge components. |

A relationship line reads `source -> target | description | technology`, with
a trailing `| draft` on a draft relationship. The overview lifts each end to
its actor or system; a drill-down names the stored endpoints, which can sit
below the listed children.

`groma view <target>` accepts only the targets above. `project`, `relation`,
and group addresses are `groma edit` targets, not `groma view` targets.

A target with no record exits non-zero and prints one reason, which separates a
mistyped name from a coverage gap:

| Reason | Meaning |
| --- | --- |
| `unknown target: <target>; not a repository file` | Neither a stored ID nor a tracked, unignored repository file: usually a typo. |
| `no owner: <file>; excluded by scanners.json pattern <pattern>` | That configured pattern hides the file from every scanner. |
| `no owner: <file>; no enabled scanner reads it` | No enabled scanner selects the file for analysis, so no scan can own it. |
| `no owner: <file>; read by <scanners> and waiting for a scan, so run groma scan` | Those scanners select the file, and no scan has given it an owner since it appeared or was detached. |
| `no owner: <file>; <scanner> could not list its sources: <error>` | That scanner's listing failed, so it may or may not read the file; its error's first line follows. When other scanners read the file, it follows the waiting-for-a-scan reason. |

On a terminal, `groma view` without a target and `groma web` scan and open
interactive maps for a human.

## Paging

A plain list prints one page of 50 items and ends with the printed range, the
total, and the exact command for the following items. Complete output has no
footer.

| Option | Effect |
| --- | --- |
| `--max-count <n>` | print at most n items, as in `git log` |
| `--skip <n>` | leave out the first n items |
| `--count` | print only the number of items, as in `grep -c` |

`groma view --plain`, `groma view <id> --plain`, `groma view <draft-id>`,
`groma view <source-file>`, `groma lint`, `groma scanner discover`, and
`groma scanner list` page their items. A `groma view` page repeats the element,
owner, or draft it describes; consecutive pages, read in order, print the
complete answer once. `groma scan` is not paged: its report counts
findings and names `groma lint`. The complete Markdown record of
`groma view <id>` and every `--json` result stay whole.

## Scanner coverage

Each scanner reads only its own languages from Git's tracked and unignored
untracked files, and applies its own default exclusions. Files that no enabled
scanner covers are not inspected. Do not assume an uncovered file was read, and
do not create a component for it by hand. Report the coverage gap to the human.
