# Create a scanner

Copy this directory outside the Groma repository. It contains a scanner package
and a small project under `project/`. The scanner inventories direct `.js` files
under `src/`; it does not parse JavaScript or claim to discover collaborations.
Groma interprets its observations and owns architecture Markdown.

The example imports the published `@groma/scanner@0.1.0` contract.
Do not publish the example's placeholder name.

```sh
cd my-scanner
bun install --ignore-scripts
bun run build
cd project
git init
groma init "Scanner example" --directory groma
groma scanner add ..
groma scan
```

Groma records the plugin's local path. Run the commands in `project/`; the plugin
lives one directory above it. Run `groma view --plain` to inspect the resulting
architecture. The two source files should be inventoried without an inferred
relationship between them: the example has not supplied call evidence.

To try a change, extend the filter in `index.ts` to accept `.mjs` files too:
`entry.name.endsWith('.js') || entry.name.endsWith('.mjs')`. Add `src/*.mjs` to
`watch.include` as well. Run `bun run build` in the plugin folder, then
`groma scan` again in the project. The supplied `extra.mjs` now enters the map
without reinstalling the plugin. To observe a source inventory change, add a `.js` file
under `project/src` and rerun the scan. Restart an existing watch session after
changing plugin implementation; source watches do not reload plugin code.

Before sharing, choose your own package name and scanner ID, keep the manifest
ID and exported ID equal, and update the package description and version. List
runtime dependencies in `dependencies`. Include entry files and required runtime
assets in the package; do not depend on installation scripts or internal Groma
source paths. Bundle executable imports into the entry with `bun run build`; Groma loads the
result from `dist/index.js`. Include that output when sharing through npm or Git.

You can prepare a tarball locally with `bun pm pack`. After publication under
your own npm name, users run `groma scanner add <package>@<exact-version>`.
Publishing is performed separately with your npm account. Groma does not require
your package to appear in the official catalog before installing it.

The optional discovery metadata describes a marker file in this example.
It does not create an automatic recommendation for an unlisted package, and it
is separate from the source watch patterns. A supported version cannot be
inferred from a marker file alone.

The project is a teaching fixture for manual use. It is not an automated package
qualification suite or a complete JavaScript scanner.
