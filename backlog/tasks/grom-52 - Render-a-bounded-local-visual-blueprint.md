---
id: GROM-52
title: Render a bounded local visual blueprint
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 20:37'
updated_date: '2026-07-19 17:56'
labels:
  - visualization
  - first-run
  - projection
milestone: m-3
dependencies:
  - GROM-30
  - GROM-43
  - GROM-51
  - GROM-54
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - brand/README.md
  - brand/STYLE.md
priority: high
type: feature
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete the shortest first-use loop by turning bare groma into one bounded, deterministic, self-contained local HTML blueprint. Reuse the existing generation-locked overview read and its display fallback directly; the CLI owns temporary artifact presentation. This first visual proves recursive containment, focus/detail, folding, brand direction, and local-only behavior without a server, React application, generalized evidence queries, or persisted view state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In an initialized workspace, bare groma in an interactive terminal renders the existing bounded current overview as a self-contained local HTML artifact and opens it through the platform adapter
- [x] #2 The artifact preserves recursive containment, label-to-name-to-stable-ID display fallback, concise component detail, view-local focus and folding, and explicit bounded truncation without creating canonical nodes or identities
- [x] #3 Rendering one overview generation is byte-deterministic and performs no canonical write, project-code execution, network request, upload, or persistence of layout, focus, folding, zoom, or theme
- [x] #4 The renderer follows the approved single architectural-sheet direction: warm white drafting surface, graphite hierarchy, exact #1D9E75 surveyed-point accent, lowercase groma.md identity, technical-sheet density, and no dashboard chrome, theme switch, gradients, or modified official marks
- [x] #5 Noninteractive bare output remains deterministic and side-effect free, while missing workspaces retain clear init guidance and artifact presentation failures return a bounded nonzero diagnostic
- [x] #6 Focused renderer/program tests and a compiled fixture prove artifact content, bounded node counts, deterministic bytes, presentation behavior, and unchanged canonical workspace bytes; Groma renders its own self-scan for visual inspection
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the existing bounded overview read unchanged as the renderer input and add one pure deterministic HTML renderer in the CLI boundary. 2. Add a small injectable artifact presenter in the program adapter; production writes a temporary HTML file and opens it with a bounded platform command, while noninteractive output remains unchanged. 3. Implement recursive technical-sheet containment, native view-local folding, selected focus/detail, reason-aware truncation notation, and canonical brand styling using embedded CSS/JS only. 4. Add focused pure-renderer and program tests plus a compiled PTY artifact fixture without adding a server or browser framework. 5. Render Groma's 65-record self-scan, prove the repeat scan byte-stable, run the full gate, and complete the bounded review workflow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 public surface. Supported semantic boundary: one generation-locked hierarchy already bounded to 50 nodes, 10 roots, depth 4, and 50 queries. Partial by design: relationships and evidence/binding/provenance inspection remain later work because GROM-42 is not required for the first useful picture. Artifact presentation is local and temporary; canonical state is read-only.

Implemented a pure bounded HTML renderer and injectable temporary-file presenter for interactive bare groma. Compiled self-dogfood scan recorded 65 observations, then repeated byte-identically. Verification: bun run check passed with 402 tests; the compiled PTY fixture intercepts the platform opener, reads two generated artifacts, proves byte equality, hierarchy/truncation content, and unchanged canonical bytes. Direct compiled self-run opened generation 112 with 27 nodes. In-app file URL inspection was unavailable because the browser security policy blocks file:// navigation; no bypass was attempted.

Pre-PR review completed exactly once by two independent Terra xhigh agents and Claude. Accepted findings: truthful reason-aware truncation, visible/semantic selected state, canonical lockup markup, bounded platform-opener wait, and documented bare JSON read. Rejected as out of scope or counter to the accepted boundary: a headless text fallback, temp-artifact sweeper, and a new DOM/browser dependency. Post-fix bun run check passed with 402 tests and 2642 expectations; compiled verification remained green.
<!-- SECTION:NOTES:END -->
