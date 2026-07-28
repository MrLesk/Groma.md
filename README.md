# Groma

Groma is a living, Git-native, C4-compatible architecture model compiled from Markdown, continuously reconciled with code, and animated as agents change the system.

Groma stores architecture, not diagrams.

The Markdown must remain useful even if Groma disappears.

The [component Markdown contract](groma/README.md) defines the canonical architecture
format.

The [source-observation contract](groma/source-observation.md) defines the one
TypeScript/Bun source shape supported by Revision 03.

The [observed architecture](groma/observed/README.md) is the current materialized
revision, and `groma/plans/` contains complete desired revisions.

## Validate the Markdown

Install the locked dependency and validate every observed and planned revision:

```sh
npm ci
npm run check
```

## Compare a plan with observed architecture

The viewer requires Bun 1.3.14 or newer. Start the read-only Revision 02
comparison, then open
`http://127.0.0.1:3000`:

```sh
npm run viewer
```

At startup the server reads `groma/observed` and one complete plan. It watches
Markdown under `groma/observed` and `groma/plans`, then fully rereads both
selected revisions after changes settle. An open browser updates over a local
event stream without restarting the viewer. If a settled edit is temporarily
invalid, the last valid model remains visible with a warning until a later
Markdown change rebuilds successfully; newly connected browsers receive the
same current warning. Extensionless and non-Markdown files, plus files outside
those architecture directories, are not watched.

Choose another plan without changing any Markdown:

```sh
npm run viewer -- --revision plan:03-code-observation
```

## Refresh observed components from supported source

Run the Revision 03 source process against a repository that matches
`groma.typescript-bun/v1` and contains the Groma architecture scaffold:

```sh
npm run source:refresh -- --repository /path/to/supported-repository
```

The process watches only `package.json`, `src/index.ts`, and non-recursive
`src/components/*.ts` events. After a short quiet period it performs one fresh
complete observation and replaces only the scanner-owned generated component
directory. A source event received during that run settles into a later complete
refresh. Invalid settled source is reported by the source process and leaves the
last-good generated Markdown untouched. Filename-less filesystem events are
checked against a fingerprint containing only the supported source paths, so
unrelated changes remain ignored. A failed watch handle or changed watched-directory
topology is terminal: the process closes every watcher, reports that restart is
required, and exits nonzero.

This process is separate from the viewer. The viewer never reads or watches
source; it updates through its existing `groma/observed` Markdown watcher.

Elements are matched by stable ID. A plan-only element is a ghost addition, an
observed-only element is a planned removal, and a shared element is modified
when its C4 properties or outgoing relationships differ. Revision names,
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
and the complete Plan 03 materialization story. One exact planned component
moves from ghost to observed, modified, and ghost again as supported source is
added, changed, and removed in the same open source-blind viewer. An unchanged
source-refresh restart must reproduce byte-identical generated Markdown and an
equivalent C4 graph and projection while manual architecture and every named
plan remain byte-identical.
Its dedicated Playwright configuration starts only disposable viewers on
dynamic ports, so unrelated local services do not block the release gate.

Screenshots and other browser-test artifacts stay outside the repository under
`/tmp/groma-release-gate-playwright-results` for the isolated gate and
`/tmp/groma-playwright-results` for the full browser suite.
