# Groma

Groma is a living, Git-native, C4-compatible architecture model compiled from Markdown, continuously reconciled with code, and animated as agents change the system.

Groma stores architecture, not diagrams.

The Markdown must remain useful even if Groma disappears.

The [component Markdown contract](groma/README.md) defines the canonical architecture
format.

The [observed architecture](groma/observed/README.md) is the current materialized
revision, and `groma/plans/` contains complete desired revisions.

## Validate the Markdown

Install the locked dependency and validate every observed and planned revision:

```sh
npm ci
npm run check
```

## Open the local viewer

Start the read-only Revision 02 viewer with Bun, then open
`http://127.0.0.1:3000`:

```sh
npm run viewer
```

The server loads one revision at startup. Choose another complete revision without
changing any Markdown:

```sh
npm run viewer -- --revision observed
npm run viewer -- --revision plan:03-code-observation
```
