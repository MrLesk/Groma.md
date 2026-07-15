---
id: GROM-24
title: Manage and pin local plugin packages
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 11:46'
labels: []
milestone: m-4
dependencies:
  - GROM-22
  - GROM-23
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - backlog/tasks/grom-24 - Manage-and-pin-local-plugin-packages.md
  - scripts/architecture-boundaries.ts
  - scripts/standalone-compiler.ts
  - scripts/tests/architecture-boundaries.test.ts
  - scripts/verify-binary.ts
  - src/cli/README.md
  - src/cli/contracts.ts
  - src/cli/help.ts
  - src/cli/parser.ts
  - src/cli/program.ts
  - src/cli/surface.ts
  - src/cli/tests/parser.test.ts
  - src/cli/tests/program.test.ts
  - src/cli/tests/surface.test.ts
  - src/core/plugin-runtime.ts
  - src/host/README.md
  - src/host/bootstrap-configuration.ts
  - src/host/contracts.ts
  - src/host/default-bootstrap.ts
  - src/host/index.ts
  - src/host/lifecycle.ts
  - src/host/local-plugin-packages.ts
  - src/host/path-containment.ts
  - src/host/plugin-module-loader.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
  - src/host/tests/local-plugin-packages.test.ts
  - src/host/tests/path-containment.test.ts
  - src/plugin-sdk/README.md
priority: medium
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Support reproducible local plugin packages for the initial package-management delivery while keeping package installation, plugin enablement, runtime loading, and project package management separate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A local package containing one or more plugins can be added, inspected, selectively enabled, disabled, and removed through supported Groma operations
- [x] #2 Blueprint-affecting plugins are declared in canonical configuration and resolved through deterministic exact lock entries
- [x] #3 Personal presentation-only plugins remain local and cannot silently change shared blueprint meaning
- [x] #4 Groma requires explicit trust before executing project-provided plugin code and clearly states that plugins run with the user permissions
- [x] #5 Package operations never modify package-manager files belonging to an observed project
- [x] #6 Remote acquisition remains explicitly out of scope for this delivery
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the now-green mixed-diagnostic, native Windows, trust, exact-lock, and recovery invariants; map the six remaining Codex findings to existing package/bootstrap seams before editing.
2. Defer workspace-contained user-data failure until user resources are actually accessed, and make manifest-drift inspection return its inert modeled snapshot before locked-entry materialization.
3. Reject blueprint YAML/lock selection mismatch before materialization, and enforce one enabled plugin ID across blueprint/personal and lock-first union state before trust or state writes.
4. Validate already-known Host selectors and additional runtime registrations before loading enabled local package code, without changing package-operation availability or runtime order.
5. Classify every post-lock non-committed configuration publication as plugin-package-state-indeterminate with supported lock-first recovery.
6. Add fail-before-import and exact-byte-preservation regressions, run focused/full/target/native-Windows verification, independent spec and quality review, fresh Claude and Codex review, then finalize GROM-24 on the existing PR without merging.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Independent review hardening pass reopened GROM-24 at 4de1b51d7697ff90978463935146b7d16bdf5e45. Context Hunter classification remains L2 because canonical state, filesystem identity, trust, module execution, cross-platform paths, and lock recovery interact.

The first exact-byte implementation used a base64 data URL, but a full 4 MiB compiled smoke exposed Bun resolver NameTooLong failures above roughly 1 KiB. The verified-byte boundary now uses a temporary immutable in-memory blob module URL, revoked after import. Native compiled verification proves the 4 MiB maximum with Bun-compatible TypeScript syntax and a node: built-in import. Relative and bare runtime imports are explicitly unsupported; absolute URL/computed dynamic imports and other full-user-permission effects remain possible outside the exact entry lock.

Independent review findings are closed with adversarial coverage: invalid portable spellings and the 65th declaration preserve exact state bytes; verified entry path swaps still execute only the captured bytes; manifest link/swap/growth races fail closed; permissive and linked trust roots are rejected; Windows cross-volume containment rejects absolute relative() results; concurrent lock changes fail compare-and-swap without overwriting peer state; Git shorthand is rejected in both scopes before user-state work; and symlink-source remove/re-add requires trust again. Existing lock-first recovery remains green.

Final validation: focused Host/CLI tests passed; bun run check passed format, strict typecheck, architecture boundaries, 535 tests / 0 failures, native compiled-binary package workflow at the exact 4 MiB entry bound, and Iteration 1A crash recovery. bun run check:targets passed for macOS arm64, Linux x64, Windows x64, and Windows arm64. backlog doctor reported no duplicate task IDs, and git diff --check passed.

Closure review reopened GROM-24 at ea5c09a684cfd0b10e66b606dfa96b53b80623e7. The remaining P1 is Windows trust-root attestation: POSIX uid/mode checks do not attest Windows ACL ownership. The bounded delivery will fail closed instead of parsing localized shell output or treating Windows mode bits as ACL evidence.

Windows trust follow-up: the local package manager now snapshots a Host-owned POSIX/Windows trust-root platform input. POSIX keeps real-directory, current-owner, and exact 0700 checks. Windows does not read or write persisted plugin trust and refuses enabled local-plugin execution with plugin-package-trust-root-unattested until a bounded owner/ACL attestor exists. Fresh Windows startup remains available only when no enabled blueprint plugin and no plugin user-data root exists; it starts without personal local plugins. No POSIX mode heuristic or localized shell-output parser was introduced.

The deterministic regression creates and persists a valid exact grant under the POSIX path, then injects the Windows platform over that same workspace and proves the persisted grant cannot authorize execution (zero imports and the stable diagnostic). It also proves a fresh Windows workspace starts without creating a trust root. The Host lifecycle canonicalizes the diagnostic. Final validation: focused Host tests passed 73 tests / 0 failures; bun run check passed format, strict typecheck, architecture boundaries, 537 tests / 0 failures, native 4 MiB compiled plugin execution, and Iteration 1A crash recovery; bun run check:targets passed macOS arm64, Linux x64, Windows x64, and Windows arm64; backlog doctor and git diff --check passed.

Claude closure review identified two actionable security-state gaps on PR #25: inert blueprint removal was blocked forever in a fresh unattested Windows workspace, and exact trust grants accumulated obsolete hashes for one logical package entry. GROM-24 is reopened on the existing branch for bounded corrections and regressions.

Implemented the two closure corrections. Windows blueprint remove now uses the same conservative absent-root probe as fresh startup: existing or unclassifiable roots retain plugin-package-trust-root-unattested, while a proven-absent root permits inert declaration cleanup without trust-state access. Explicit new exact-byte trust now replaces prior grants for the same logical package-entry subject. Focused Host coverage passes 14 tests / 0 failures, including exact cleanup, unchanged bytes on existing-root refusal, repeated re-trust with one canonical bounded grant, and failed byte reversion before import.

Final closure validation passed on the exact follow-up diff: focused local-package coverage passed 15 tests / 0 failures; bun run check passed formatting, strict typecheck, architecture boundaries, 539 tests / 0 failures, native compiled package workflow, and Iteration 1A crash recovery; bun run check:targets passed macOS arm64, Linux x64, Windows x64, and Windows arm64; backlog doctor and git diff --check passed.

Final quality review found that pre-fix or seeded canonical state could retain multiple exact hashes for one logical trust subject. GROM-24 is reopened at ba82da2097e69fba93a3fde9b477c7aebb80cbc4 to reject that ambiguity at the parser boundary before authorization.

Implemented subject-level uniqueness in parseTrust after deterministic full-key ordering. Exact duplicate rejection is subsumed. Added a seeded canonical user-state regression with one current matching grant plus an alternate hash for the same subject; loadEnabled and enable both return plugin-package-user-state-malformed, perform zero imports, and preserve exact state bytes. Normal one-grant and repeated re-trust coverage remains green at 16 focused tests / 0 failures.

Final uniqueness validation passed on the exact follow-up diff: focused local-package coverage passed 16 tests / 0 failures; bun run check passed formatting, strict typecheck, architecture boundaries, 540 tests / 0 failures, native compiled package workflow, and Iteration 1A crash recovery; bun run check:targets passed macOS arm64, Linux x64, Windows x64, and Windows arm64; backlog doctor and git diff --check passed.

Consolidated external review reopened GROM-24 at f2c3270819c8fbcdf9aad40e46825812bf184663 for bounded bootstrap, recovery, lifecycle, CLI, persistence, capacity, Windows-smoke, and parser-containment corrections. Context Hunter classification is L2 because canonical bytes, fail-closed trust, runtime capacity, lifecycle containment, and CLI contracts interact. Independent compiler verification on Bun 1.3.14 confirmed the existing split argv form --allow-unresolved followed by an empty string is documented and equivalent to --allow-unresolved= for the Blob import, native build, and all four targets; it remains unchanged as non-actionable.

Consolidated closure implementation completed. Bootstrap rechecks now require a fully empty configuration; replacement-parser package state crosses proxy/accessor-safe Host inspection; configured-only package enablement can be disabled and removed without source or import; lock and user-state access failures are stable and lifecycle containment preserves all known canonical diagnostics. CLI exit contracts now retain indeterminate package writes as exit 6 and classify local package/trust configuration failures consistently. Enable and startup enforce one Host-derived local registration budget across configuration, exact lock, and personal state before import, including lock-first interruption states. Windows native smoke covers inert management plus unattested enable with no evaluation or user-root mutation; POSIX retains the exact 4 MiB positive execution proof. Independent Bun 1.3.14 verification confirmed the unchanged split empty --allow-unresolved argument on native and all four targets. An independent closure-diff review found two actionable edge cases (Windows exit mismatch and lock-first capacity undercount); both were corrected and the reviewer confirmed no remaining actionable findings. Final validation passed: bun run check (552 tests, strict typecheck, boundaries, native compiled workflow, crash recovery), bun run check:targets (macOS arm64, Linux x64, Windows x64, Windows arm64), focused package/CLI/lifecycle suites, Backlog doctor, and git diff --check.

Post-push Claude review was run first by URL (blocked from reading by Claude sandbox permissions) and then against the exact streamed closure commit. One actionable contract gap was accepted: package-command capacity failures were not yet mapped to the workspace exit class. Two low-cost test/verification hardenings were also accepted: a benign replacement-parser positive control and deterministic child termination/reaping on smoke-output overflow. The claim that startup capacity lacked classification was rejected because hostExit already covers plugin-package-*; the hardcoded .groma native-smoke assertion remains the explicit current Host default and intentionally covers mutation across the complete inert-management sequence.

Claude follow-up actions completed: package enable now maps enabled-capacity and stable user-state configuration diagnostics to workspace exit 3, with both surface and startup program coverage; replacement-parser containment has a benign positive control; bounded smoke capture terminates and reaps the child on read failure. Final post-Claude validation passed unchanged at 552 repository tests plus strict types, architecture boundaries, native compiled 4 MiB package execution, crash recovery, and all four target builds.

Exact-head adversarial review reopened GROM-24 at bedd00ccdb0b5e71e2f36a8381c3517a7be630fc. Two P1s remain: mixed bootstrap diagnostics must give infrastructure precedence at the Host/CLI boundary, and the fail-closed Windows native smoke must run on an actual Windows CI runner rather than being cross-compiled with --skip-run on Ubuntu. Context Hunter classification is L2 because these changes affect a public exit contract and CI platform execution, but both fit existing seams without changing package semantics.

Exact-head P1 closure completed. Host startup now returns workspace exit 3 only when every preserved canonical diagnostic is workspace-class; any mixed, unknown, or infrastructure diagnostic retains the infrastructure fallback. The program regression proves the original workspace-configuration-provider-failure plus plugin-package-lock-unavailable pair and four additional canonical infrastructure classes, while workspace-only and single-diagnostic contracts remain green. The existing Ubuntu four-target job remains unchanged, and a bounded windows-2025 job now installs Bun 1.3.14 and locked dependencies, builds the native executable, and runs the real platform-aware smoke verifier. DEVELOPMENT.md documents the three-job model. Final repeated validation passed: focused CLI 21 tests / 230 expectations, bun run check with 553 tests plus strict types, boundaries, native compiled smoke and Iteration 1A recovery, bun run check:targets across macOS arm64, Linux x64, Windows x64, and Windows arm64, local workflow YAML parsing, and git diff --check. Independent spec review passed; independent quality review found incomplete mixed precedence, the finding was corrected, and re-review passed with no remaining actionable findings.

Native Windows CI exposed a real portability defect at ccea617714e07f8a49d553af24cd467e206b6311: the native executable built successfully, but package add ./local-package exited 4 with invalid-local-plugin-package-source before reaching the trust assertion (run 29408186655, job 87328673345). GROM-24 is reopened to fix canonical Windows local-path containment without weakening or skipping the smoke. Context Hunter remains L2 because the correction sits on a security-sensitive filesystem containment boundary.

Windows path diagnosis completed. Bun 1.3.14 node:fs realpathSync uses the Node-compatible alias-preserving Windows walk, while node:fs/promises.realpath uses the native binding; under the GitHub runner temp path this left the workspace as RUNNER~1 while the package became runneradmin, so the mandatory post-realpath containment check correctly failed closed. The workspace root now uses realpathSync.native, matching package, entry, and attested user-root canonicalization without stripping aliases or weakening symlink, junction, or cross-volume rejection. Deterministic path tests cover 8.3 long/short and extended namespace mismatch as fail-closed, with equal canonical long paths accepted. Local validation passed: 44 focused path/package/CLI tests, bun run check with 554 tests plus strict types, boundaries, native compiled smoke and Iteration 1A recovery, bun run check:targets for all four artifacts, and git diff --check. Independent diagnosis, spec review, and quality review all confirmed the fix and found no remaining actionable issues. Native Windows CI remains required before final closure.

Consolidated Codex thread audit reopened GROM-24 at 665c63fa63f280f33822b508e986ab4d76707b22 after all three CI jobs passed. Six relevant findings remain on the same package/bootstrap delivery: home-rooted workspace startup, honest manifest-drift inspection, pre-enable YAML/lock mismatch rejection, enabled plugin-ID uniqueness across all package state, fail-before-import Host selector validation, and indeterminate classification after lock-first partial publication. Context Hunter is raised to L3 because canonical bytes, trust-state placement, module execution order, cross-scope runtime identity, and transaction recovery interact. The correction remains one Backlog task and one PR; the proven empty Bun argv claim remains non-actionable.

Six-finding hardening implementation completed on the existing PR. Home-contained user state is deferred for empty startup but rejected before personal/trust access using prospective canonical containment, including symlink ancestors without directory creation. Inspect now reports any valid changed manifest as inert manifest-drift before locked-entry resolution, while exact-manifest entry drift remains entry-drift. Blueprint enable rejects YAML/lock selection mismatch before package access. Enabled runtime plugin IDs are unique across the complete blueprint-lock and personal-state union, with startup rejection before imports and stable lifecycle/CLI mapping. Host selector validation now precedes enabled local-package loading. Every post-lock configuration publication failure remains plugin-package-state-indeterminate through coordination-release failure and maps to CLI exit 6; lock-first disable recovery remains supported. Static remote/source diagnostics retain precedence over contained-root state failures.

Independent spec review found and closed valid manifest name/version drift during inspect; re-review passed. Independent quality review found and closed coordination-release masking, static remote-source precedence, and alias-containment coverage; re-review passed. Final reviewed-diff validation passed bun run check with 565 tests, strict typecheck, architecture boundaries, native compiled package smoke, and Iteration 1A crash recovery; bun run check:targets passed macOS arm64, Linux x64, Windows x64, and Windows arm64; Backlog doctor and git diff --check passed. Native Windows CI and fresh Claude/Codex review remain required after push.
<!-- SECTION:NOTES:END -->
