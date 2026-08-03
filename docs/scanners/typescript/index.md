# TypeScript scanner

The TypeScript scanner plugin reads repositories that follow the exact
[`groma.scanner.typescript-bun/v1` contract](contract.md). It is a deliberately narrow declaration protocol, not general
TypeScript analysis.

The Groma scanner owns the complete flow: it watches supported files, asks the TypeScript plugin for a fresh scan, and
emits the result as canonical component Markdown.

## Start the scanner

Run the scanner against a supported repository that also contains the Groma architecture scaffold:

```sh
npm run scanner -- --repository /path/to/supported-repository
```

## Watched files

The scanner watches only these events:

```text
package.json
src/index.ts
src/components/*.ts
```

The component glob is non-recursive. After a short quiet period, one settled burst triggers a fresh complete scan and
emitter rebuild. A supported event received during a scan remains pending and settles into a later complete scan. The
scanner does not maintain an incremental graph or infer renames.

The TypeScript plugin produces a transient scan result rather than a second canonical architecture model. The emitter
resolves relationships against that result and hand-authored observed elements, then renders canonical component
Markdown.

## Generated Markdown ownership

The scanner may replace only this owned directory:

```text
groma/observed/systems/groma/containers/scanner/components/
```

The scanner container, hand-authored architecture, other observed components, and every plan remain unchanged. Generated
documents follow the [component Markdown contract](../../../groma/README.md) and include readable source evidence in
their bodies.

## Operational boundaries

The current scanner assumes ordinary stable directories, string filenames on filesystem events, healthy watch handles,
an existing writable owned directory, and successful direct writes. Filename-less events are ignored. It does not
fingerprint them, rebind replaced watch directories, recover watcher topology, stage or roll back output transactions,
or retry after filesystem or emission failure.

The scanner and viewer are separate services. The viewer remains source-blind and reacts only to the resulting Markdown
changes.

The [TypeScript scanner contract](contract.md) is authoritative for the supported repository shape, declarations,
validation, target resolution, errors, and generated output.
