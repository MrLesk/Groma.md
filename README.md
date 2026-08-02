# Groma

Groma is a living, Git-native, C4-compatible architecture model compiled from Markdown, continuously reconciled with code, and animated as agents change the system.

Groma stores architecture, not diagrams.

The Markdown must remain useful even if Groma disappears.

The [component Markdown contract](groma/README.md) defines the canonical architecture
format.

The [source-observation contract](groma/source-observation.md) defines the one
TypeScript/Bun source shape supported by source observation.

The [observed architecture](groma/observed/README.md) is the architecture known
to exist, and `groma/plans/` holds one directory per planned feature.

## Groma glossary

The [plan and revision lifecycle](docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md)
is the full contract behind these terms.

| Term | Meaning in Groma |
| --- | --- |
| **Plan** | An independent, mutable description of one desired feature: a directory under `groma/plans/` holding a README and only the element Markdown not yet implemented. It is not a complete architecture, a numbered step, or the successor of another plan. |
| **Observed architecture** | The architecture currently known to exist. Its canonical Markdown lives under `groma/observed/` and may combine hand-authored elements with scanner-generated observations. |
| **Revision** | The immutable architecture state represented by a Git commit, identified by its SHA. Revisions are never stored as directories; a plan may materialize across any number of revisions, and Git history is the only archive. |

Observed architecture and every revision are complete models; a plan is a
partial overlay, not a complete model and not a cumulative step. Groma composes
a selected plan with observed architecture and derives their differences; the
Markdown stores no comparison or lifecycle state.

The numbered directories currently under `groma/plans/` predate this contract:
each is a cumulative complete state, and they remain the shipped viewer's valid
input until they are migrated to scoped feature plans.

## Historical investigations

The [historical investigation index](docs/historical-investigations.md) points
to disposable spike branches that informed current plans but must never be
merged into `main`.

## Validate the Markdown

Install the locked dependencies and validate the observed architecture and
every plan directory:

```sh
bun install --frozen-lockfile
bun run check
```

## Compare a plan with observed architecture

The viewer requires Bun 1.3.14 or newer. Start the read-only comparison with
the default plan directory (`02-live-viewer`), then open
`http://127.0.0.1:3000`:

```sh
npm run viewer
```

At startup the server reads `groma/observed` and one plan directory. It watches
named Markdown file events under `groma/observed` and `groma/plans`, then fully
rereads both models after changes settle. An open browser updates
over a local event stream without restarting the viewer. If a settled edit is
temporarily invalid, the last valid model remains visible with a warning until
a later Markdown change rebuilds successfully; newly connected browsers
receive the same current warning. Extensionless and non-Markdown files, plus
files outside those architecture directories, are not watched.

Choose another plan without changing any Markdown:

```sh
npm run viewer -- --revision plan:03-code-observation
```

## Refresh observed components from supported source

Run the source observation process against a repository that matches
`groma.typescript-bun/v1` and contains the Groma architecture scaffold:

```sh
npm run source:refresh -- --repository /path/to/supported-repository
```

The process watches only `package.json`, `src/index.ts`, and non-recursive
`src/components/*.ts` events. After a short quiet period it performs one fresh
complete observation and replaces only the scanner-owned generated component
directory. A source event received during that run settles into a later complete
refresh. The MVP assumes ordinary stable directories, string filenames on
filesystem events, healthy watch handles, and successful direct writes to the
owned directory. It does not fingerprint filename-less events, rebind replaced
watch directories, stage or roll back output transactions, or provide
filesystem recovery.

This process is separate from the viewer. The viewer never reads or watches
source; it updates through its existing `groma/observed` Markdown watcher.

Elements are matched by stable ID. A plan-only element is a ghost addition, an
observed-only element is a planned removal, and a shared element is modified
when its C4 properties or outgoing relationships differ. Directory names,
Markdown paths, and transient viewer state do not affect this comparison.

Run the interactive browser verification (Playwright starts and stops the local
viewer):

```sh
npx playwright install chromium
npm run test:release-gate
npm run test:viewer:browser
```

`test:release-gate` uses disposable controlled repositories to prove observed
system-to-container-to-component navigation, all four plan comparison states,
and the complete `03-code-observation` materialization story. One exact
planned component moves from ghost to observed, modified, and ghost again as
supported source is added, changed, and removed in the same open source-blind
viewer. An unchanged
source-refresh restart must reproduce byte-identical generated Markdown and an
equivalent C4 graph and projection while manual architecture and every named
plan remain byte-identical.
Its dedicated Playwright configuration starts only disposable viewers on
dynamic ports, so unrelated local services do not block the release gate.

Screenshots and other browser-test artifacts stay outside the repository under
`/tmp/groma-release-gate-playwright-results` for the isolated gate and
`/tmp/groma-playwright-results` for the full browser suite.
