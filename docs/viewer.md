# Viewer

The Groma viewer is a read-only, local comparison of observed architecture and one selected plan. It requires Bun 1.3.14
or newer.

## Start the viewer

Start with the default plan directory, `02-live-viewer`, then open `http://127.0.0.1:3000`:

```sh
npm run viewer
```

Select another plan without changing any Markdown:

```sh
npm run viewer -- --revision plan:03-code-scanning
```

## Model and comparison

At startup, the server reads `groma/observed` and the selected plan directory. It composes them according to the
[product model](product-model.md) and displays the derived comparison states. The viewer does not write comparison or
lifecycle state into the Markdown.

## Live updates

The server watches named Markdown file events under `groma/observed` and `groma/plans`. After changes settle, it fully
rereads both models. An open browser updates over a local event stream without restarting the viewer.

If a settled edit is temporarily invalid, the last valid model remains visible with a warning until a later Markdown
change rebuilds successfully. Newly connected browsers receive the same current warning.

Extensionless files, non-Markdown files, and files outside the two architecture directories are not watched.

## Source boundary

The viewer never reads or watches source code and imports no scanner code. Source changes reach it only after the
separate scanner process updates canonical Markdown under `groma/observed`. See [Scanners](scanners/index.md).
