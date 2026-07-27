---
id: TASK-4
title: Read architecture Markdown with Comark
status: To Do
assignee: []
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-1
dependencies:
  - TASK-3
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://github.com/comarkdown/comark'
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 01 establishes Groma architecture as readable component Markdown under groma/observed and complete desired snapshots under groma/plans/<revision>. Build the first runtime reader with Comark, the required TypeScript Markdown engine published as the comark npm package. Comark parses CommonMark/GFM, YAML frontmatter, and optional plain-text component syntax into a serializable AST. Use its parse API as the only Markdown parser and preserve Markdown as the only stored source; the reader must not create a second canonical JSON or graph file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every component document under groma/observed and groma/plans is parsed through the comark npm package
- [ ] #2 Each plan README is returned as revision context and is not treated as a C4 element
- [ ] #3 A parse failure stops that revision load and reports the exact repository-relative filename
- [ ] #4 The reader returns Comark-derived serializable data containing document nodes, frontmatter, revision identity, and source filename, with no renderer state
- [ ] #5 No second Markdown parser or persisted model format is introduced
<!-- AC:END -->
