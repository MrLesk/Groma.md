---
id: GROM-65
title: Ship built-in groma instructions guides
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 06:06'
updated_date: '2026-07-20 06:10'
labels:
  - cli
  - docs
milestone: m-4
dependencies: []
references:
  - ../backlog.md/src/commands/instructions.ts
  - docs/interface-glossary.md
priority: high
type: feature
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md ships its agent workflow guidance inside the binary: markdown guides embedded as text imports, listed and printed by backlog instructions [guide]. Groma should carry the same self-describing capability so a human or agent in any repo can learn the working loop from the tool itself, without this repository's docs. Add groma instructions with a bounded set of embedded guides written in the interface-glossary vocabulary: overview (what Groma is, intent versus evidence, the init-scan-view loop), scanning (projects, scanners, rescans, why evidence never erases intent), curation (component create, update, move, merge, remove, revisions, fail-closed rules), and reading (bounded pages, cursors, export, search, traverse, component detail, web). The command is static content and must work before any workspace exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma instructions prints a bounded index of the available guides with one-line descriptions, and groma instructions <guide> prints the embedded markdown; an unknown guide fails with a structured diagnostic listing valid guides
- [x] #2 The command works with no workspace present and never composes the host; --format json returns the structured index or guide envelope
- [x] #3 Four guides ship embedded in the compiled binary via text imports: overview, scanning, curation, and reading, written in interface-glossary surface words and each stating the bounded-read and intent-preservation rules that apply
- [x] #4 Help text documents the command; renderer and parser tests cover index, guide, unknown-guide, and json shapes; the compiled smoke proves groma instructions overview works from the binary in an empty directory
- [x] #5 README mentions that the CLI carries built-in instructions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/cli/markdown-modules.d.ts declaring *.md text-import modules (mirrors Backlog.md src/types/markdown.d.ts) and confirm the boundary checker parses import attributes.
2. Write the four guides under src/cli/instructions/ in glossary vocabulary, sized as bounded pages: overview.md, scanning.md, curation.md, reading.md; embed them through src/cli/instructions/index.ts with text imports and a typed guide registry (key, title, description, markdown).
3. Extend contracts and parser with instructions [guide]; dispatch it in program.ts before host composition like help and version, so it needs no workspace; plain prints the index or raw markdown, json returns the structured envelope; unknown guides return a usage diagnostic listing valid keys.
4. Update help text and README; extend verify-binary with a compiled groma instructions overview check in an empty directory.
5. Tests: parser shapes, index and guide rendering, unknown guide, json envelope; bun run check.
Supported boundary: static embedded content only; no per-workspace customization or templating.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Guides live as markdown under src/cli/instructions/ embedded via Bun text imports (with { type: 'text' }), typed by a new *.md module declaration mirroring Backlog.md's src/types/markdown.d.ts; the boundary checker parses the import attributes without changes. The command dispatches in program.ts before host composition like help and version, so it works in any directory with no workspace; plain prints the index or raw markdown, json returns instructions-index or instructions-guide envelopes; unknown guides fail with cli-unknown-instruction-guide listing the valid keys. Validation: bun run check green (431 tests) including a new compiled smoke that runs groma instructions overview from the binary in an empty directory; interactive check of the compiled index output.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma instructions ships four embedded guides (overview, scanning, curation, reading) written in the interface-glossary vocabulary, printable as an index or full markdown from the compiled binary in any directory before any workspace exists, with structured json envelopes and a compiled-smoke gate. Mechanism mirrors Backlog.md's instructions command.
<!-- SECTION:FINAL_SUMMARY:END -->
