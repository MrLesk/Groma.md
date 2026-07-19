---
id: GROM-48
title: Package and verify standalone preview artifacts
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:59'
updated_date: '2026-07-19 21:06'
labels: []
milestone: m-3
dependencies:
  - GROM-33
  - GROM-43
  - GROM-45
  - GROM-49
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - DEVELOPMENT.md
priority: high
type: task
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn the already-supported standalone targets into one deterministic local preview package and prove the host-compatible executable completes the public init -> scan -> groma visual loop on a clean held-out TypeScript project. This is packaging and verification only: no benchmark score, installer, updater, publication workflow, network access, or expanded platform promise.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One command builds all four already-supported standalone targets into stable target-specific filenames without serial overwrite and emits a deterministically ordered checksum manifest.
- [x] #2 The matching packaged executable runs directly, without an installed runtime in the child process, through clean init and scan and returns the bounded evidence-grounded hierarchy used by bare groma; the existing presentation composition renders that hierarchy as deterministic self-contained HTML without opening a browser during verification.
- [x] #3 Packaging fails on missing, empty, duplicate, or unsorted artifact outputs and relies on Bun target compilation plus matching-host runtime proof rather than custom executable-format parsers.
- [x] #4 User and contributor documentation explains how to build and inspect the local preview package, states the supported target boundary, and does not claim publication or native runtime proof for cross-compiled targets.
- [x] #5 The release proof reuses existing scanner, presentation, smoke, and target verification paths, replacing the old certification-style matrix with a small end-to-end fixture and no new framework or fallback path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace serial cross-target overwrite with one packaging command that retains stable target-named artifacts and writes a sorted checksum manifest using the existing standalone compiler. 2. Extend compiled smoke to exercise the matching artifact’s interactive bounded overview through PTY/ConPTY, while reusing the existing deterministic HTML presentation fixture. 3. Update CI and concise public/development documentation for the unpublished package and remove stale roadmap claims without changing the timeless manifesto. 4. Run focused and full verification, then use packaged Groma on its own repository to inspect bounded complexity and byte stability. 5. Complete exactly two Terra xhigh reviews and one Claude review before the ready PR, then follow the bounded one-Codex-review merge workflow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the serial target verifier, which repeatedly erased dist and restored a native binary, with one package command that retains four sorted target-named artifacts and writes SHA256SUMS. The matching packaged process now exercises version, help, clean init, scan, component read, and an interactive-terminal JSON overview through Bun PTY; the existing Iteration 1A presentation composition writes and validates deterministic self-contained HTML without launching a browser. No installer, publisher, updater, environment test hook, custom binary parser, or benchmark framework was added. MANIFESTO.md was audited and left unchanged because it contains canonical vision and semantic uses of present/current, not delivery state.

Pre-PR review completed with exactly two independent gpt-5.6-terra xhigh passes and one Claude pass. Both Terra reviewers found the same Windows omission in the packaged PTY overview proof; the platform guard was removed so the native Windows smoke now uses Bun ConPTY, with terminal framing normalized before JSON validation. Claude found no blocking issue; accepted feedback added a 15-second PTY timeout, moved package mechanics below the simple native README build, and documented that packaging intentionally leaves target-named artifacts. Rejected restoring the deleted README roadmap because its claimed next evidence work is already shipped, and rejected a smoke fallback in favor of explicit composition.

Final post-review validation passed: bun run check completed formatting, strict types, architecture boundaries, 412 tests / 2,755 assertions, native standalone smoke, full compiled Iteration 1A workflow, and crash recovery. bun run package retained four non-empty target artifacts plus a sorted SHA256SUMS and exercised the matching packaged executable through init, scan, component read, and PTY overview plus deterministic HTML composition. Final packaged self-dogfood reached generation 140 with 65 observations and a bounded 51-component blueprint; the repeated scan left every canonical byte unchanged.

First PR CI exposed one Windows ConPTY framing sequence outside the narrow handwritten CSI regex. Replaced that regex with Node util.stripVTControlCharacters, keeping the same PTY/ConPTY product proof while deleting custom terminal-sequence parsing. Local typecheck and matching packaged smoke passed; native Windows CI is the authoritative verification.
<!-- SECTION:NOTES:END -->
