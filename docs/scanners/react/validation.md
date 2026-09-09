# React scanner validation

The approved source is Backlog.md commit
`660cb98206660a43dfd6e52a8038fde50693074a`, archived into a disposable project.
The original working tree is untouched. Its frozen Bun lockfile installs React
19.2.7, `@types/react` 19.2.17, and project TypeScript 7.0.2. The scanner uses
its own TypeScript 6.0.3.

The selected interaction is under `src/web/components/`:

| Evidence | Source |
| --- | --- |
| Invoking operation | `CleanupModal.tsx`, `handleExecuteCleanup`, line 58, UTF-16 offset 1703 |
| Callback invocation | `CleanupModal.tsx`, `onSuccess(result.movedCount)`, line 68, UTF-16 offset 1898 |
| Concrete binding | `TaskList.tsx`, `onSuccess={handleCleanupSuccess}`, line 994, offset 37623 |
| Handler | `TaskList.tsx`, async `handleCleanupSuccess` arrow, line 521, offset 18551 |

The compiler resolves the imported component, destructured prop symbol, and
supplied handler. Root configuration and syntax checks passed. The selected
TSX source has no semantic errors. A separate server MCP source has an existing
`Bun.HTMLBundle` versus string type mismatch under this compiler; the scanner
does not claim whole-project type-check success.

## Executed checks

The actual npm-packed plugin was served by the local artifact registry and
installed by compiled Groma through its ordinary `scanner add` and `scanner
install` commands. Both the pinned Backlog project and independent two-file
fixture completed discovery, readiness, scan, curation, repeated scan, source
edit, failed scan, restored scan, and map export.

The Backlog observation contained 83 TSX files, 25 concrete callback bindings,
and 166 unsupported-binding diagnostics. These counts describe this snapshot,
not general React coverage. The selected files retained one owner with separate
`typescript` and `react` Code references. The repeat scan preserved all 316
architecture documents, including the curated overview and authored reverse
relationship. Removing the callback call in the disposable copy removed its
derived interaction. A syntax error preserved the previous complete map.
After restoration, 507 source and configuration files matched the pinned
commit byte for byte. The selected source SHA-256 is
`738bdb61f8f4e46c1db920ba748d7fdf4d5046cec6c716f9e65c81bd14a858b2`.

The independent concurrent tests cover deterministic observations, original
source positions, evidence absent from TypeScript alone, conditional-handler
and spread abstention, actionable missing prerequisites, conflicts in both
scanner orders, preserved ownership, actual TSX watcher dispatch, and failure
preservation. Four tests passed with 30 assertions. Scoped lint and the
repository TypeScript check passed.

```sh
bun test --timeout 20000 test-bun/react-scanner.test.ts
bunx biome lint plugins/scanners/react/src plugins/scanners/react/build.ts plugins/scanners/react/smoke.ts test-bun/react-scanner.test.ts
bun run typecheck
```

For a fresh disposable project and output directory, the packed consumer
procedure is:

```sh
bun plugins/scanners/react/smoke.ts backlog /path/to/compiled-groma /path/to/prepared-copy /path/to/built-package /path/to/proof
```

Use `fixture` instead of `backlog` for the independent fixture. Each fresh
download proof requires an uncached candidate installation. The procedure
keeps source edits inside the disposable project and restores the selected
source in a `finally` block. It emits the package and binary hashes, command
transcript, and exported map. The tested implementation uses the existing
shared artifact-registry utility; no public registry upload occurs.

## Review and qualification

Cold simplicity review passed without findings. Implementer specification and
quality reviews found no blocking issue in the supported flow. The coordinator
reviewed the exported map: Cleanupmodal retains its curated responsibility,
the derived `onSuccess` interaction points to Tasklist with React evidence,
and the authored reverse relationship remains. Final full-context review passed
without required changes. The serial `bun run check` passed: 110 Node tests and
398 Bun tests passed, with seven existing tooling-dependent skips and no test
failures. Lint reported six pre-existing complexity warnings.

The executed environment is macOS arm64, Bun 1.4.1, and compiled Groma. Public
publication and unexecuted platforms are not qualified by this record.
