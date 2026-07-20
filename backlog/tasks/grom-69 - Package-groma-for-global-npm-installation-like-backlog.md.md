---
id: GROM-69
title: Package groma for global npm installation like backlog.md
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 07:11'
updated_date: '2026-07-20 07:14'
labels:
  - build
  - distribution
milestone: m-4
dependencies:
  - GROM-68
references:
  - ../backlog.md/package.json
  - scripts/package.ts
priority: high
type: feature
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
backlog works out of the box because installing the backlog.md npm package puts a small Node shim on the PATH whose optionalDependencies pull exactly one per-platform package carrying the compiled binary; the shim resolves and spawns it. Groma must ship the same shape under the brand npm name groma.md: a main package with cli.js and resolveBinary.cjs, four per-platform packages matching the existing baseline targets (darwin-arm64, linux-x64, windows-x64, windows-arm64) with os and cpu constraints, all version-pinned together. bun run package assembles and packs everything under dist/npm and proves the flow end to end by installing the packed tarballs globally into a temporary prefix and running the installed groma - no registry, no publishing. Actual npm publish stays a separate explicit step for Alex.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun run package assembles dist/npm with the groma.md main package (cli.js shim, resolveBinary.cjs, README, bin groma, optionalDependencies pinned to the repo version) and one package per baseline target containing only its binary and an os/cpu-constrained package.json, then packs every package into a tarball
- [x] #2 The shim resolves the host platform package, spawns the binary with inherited stdio so arguments, interactive prompts, and Ctrl+C flow through, forwards the exit code, and prints an actionable message naming the supported targets when no platform package matches
- [x] #3 When npm and a host-matching artifact are available, packaging installs the packed main and host platform tarballs globally into a temporary prefix and verifies the installed groma answers --version and prints an instructions guide; the step is skipped with a clear message otherwise
- [x] #4 Unit tests cover the resolver package-name and binary-name mapping for all four targets; bun run check stays green
- [x] #5 DEVELOPMENT.md documents the npm assembly, the tarball verification, and the later explicit publish step; README notes the groma.md package name
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add scripts/npm/cli.cjs and scripts/npm/resolveBinary.cjs, CommonJS Node sources adapted from the published backlog.md shim: platform/arch mapping to groma.md-<platform>-<arch>, windows binary suffix, bun-shim argument cleanup, stdio inherit spawn, exit-code forwarding, and a missing-package message listing the four supported targets.
2. Extend scripts/package.ts after checksum writing: assemble dist/npm/groma.md (cli.js, resolveBinary.cjs, README.md, generated package.json with bin and pinned optionalDependencies) and dist/npm/groma.md-<target> per baseline target (binary plus generated os/cpu package.json), then npm pack each into dist/npm.
3. When Bun.which npm succeeds and the host matched a target, npm install -g into a temporary prefix from the two tarballs and run the installed bin: --version equals the repo version and instructions overview prints; otherwise log the skip.
4. scripts/tests/npm-shim.test.ts covers resolver mappings for all four targets and the windows executable name.
5. Update DEVELOPMENT.md and README; bun run check plus a full bun run package run as evidence.
Supported boundary: assembly and local tarball verification only; npm publish, provenance, CI release workflow, and licensing text remain explicit later decisions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Mirrored the installed backlog.md package byte-for-byte in shape: scripts/npm/cli.cjs (published as cli.js) and resolveBinary.cjs resolve groma.md-<platform>-<arch> via require.resolve and spawn the binary with inherited stdio, exit-code forwarding, signal re-raise, and bun-shim argument cleanup; platform packages carry only the binary plus an os/cpu-constrained package.json; the main groma.md package pins all four as optionalDependencies at the repo version. bun run package assembles and npm-packs everything under dist/npm and, when npm plus a host artifact exist, installs the packed main and host tarballs globally into a temporary prefix and runs the installed groma.
Validation: bun run check green (444 tests incl. resolver mapping tests); full bun run package run compiled and verified all four targets, packed five tarballs, and reported: Verified the packed groma.md global install end to end (0.0.0) — the installed bin answered --version and printed the overview guide from a temp prefix. The shim's missing-platform-package path verified manually (actionable message naming the four targets, exit 1). Publishing remains one explicit npm publish per package (platform packages first), and the repo has no LICENSE file yet — both are Alex's decisions before the first publish.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Groma now ships the exact backlog.md distribution shape: a groma.md npm package whose Node shim resolves one os/cpu-constrained platform package (four baseline targets) carrying the compiled binary, assembled and packed by bun run package and proven end to end by a registry-free global install from the packed tarballs that runs the installed groma. After Alex publishes, npm i -g groma.md (or bun i -g) gives the identical out-of-the-box experience backlog has.
<!-- SECTION:FINAL_SUMMARY:END -->
