# Blueprint placement research

TASK-324. Based on `main` at `0e1252c92a90ef87b30d4fb5cfa56e768d436fea`.

This is an isolated, functional design prototype, **not a production drafts store**. It uses Groma’s unmodified sheet composer, isometric renderer, camera, palettes and lockup. Two illustrative project fixtures supply architecture; the prototype never reads or writes the repository’s `groma/` documents and never invokes a scanner.

## Run

```sh
bun install --frozen-lockfile
bun research/blueprints/build.ts
python -m http.server 8765 --directory dist/blueprint-research
```

Open `http://localhost:8765`. Choose Shop, copy the blueprint, choose Market, and paste. Market deliberately has a differently named purchasing component, so the binding needs a human choice. Review the parent container and payment-provider bindings, preview, then create the fixture draft. Reload to verify persistence. A second paste creates an independent draft; it can touch the same existing component without rewriting that component.

The built `dist/blueprint-research/index.html` is self-contained. Opening it as a local file also depends on that browser’s storage and clipboard policies; localhost is the supported browser-test path. Clipboard access is a user action. Blueprint text is available for explicit manual copy; the application does not silently download anything.

## Scope

The catalogue contains **one bundled research blueprint**, not remote search results. Creation makes a complete record in one fixture-specific localStorage key. It does not install source code, create production Groma Markdown, accept a ghost, or verify requirements. The retained blueprint snapshot can be copied again, but arbitrary extraction from current architecture is not implemented.

The clipboard encoding is a versioned, bounded, UTF-8 JSON transport. The Inspect Markdown action exports a readable OKF research document; this is not yet a production import/export contract. Participant keys are local to the blueprint. A host-container role is explicit.

## Test and capture

```sh
(cd research/blueprints && ../../node_modules/.bin/biome lint .)
bun test test-bun/blueprint-research.test.ts
bun node_modules/.bin/tsc --noEmit --project research/blueprints/tsconfig.json
bun run check
python -m pip install playwright==1.57.0
python -m playwright install --with-deps chromium firefox webkit
python research/blueprints/capture.py
```

The capture script starts its own localhost server. Chromium exercises native clipboard copy/paste, missing bindings, preview, creation, repeated paste, cancellation, invalid import, sequentially stale save, reload and narrow layout. Firefox and WebKit exercise explicit text import through persistence. Tests load only `test/fixtures/blueprint-research/`. Results and screenshots are written to `evidence/`. Set `BLUEPRINT_TRACK_TASK=TASK-324` while generating committed evidence to record each file through the Backlog CLI immediately.

See [the supported scenario](scenario.feature), [research findings](FINDINGS.md) and [execution evidence](evidence/). The repository’s MIT license applies. No font files are distributed.
