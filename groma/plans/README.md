# Groma plans

Each directory under `groma/plans/` is one planned feature: an independent,
mutable description of a desired outcome. Per the
[manifesto](../../MANIFESTO.md),
a plan holds a README and only the element Markdown not yet implemented.
Implementing an element moves its file into `groma/observed/`; a plan with no
element Markdown left is complete and its directory disappears. Git history is
the archive, and revisions are commits.

Plans do not build on each other and have no order.

## Transition

The numbered directories below predate the lifecycle contract. Each is a
cumulative complete architecture state, not a scoped feature plan. They remain
the shipped viewer's valid input until implemented architecture is materialized
into `groma/observed/` and the open work is rewritten as scoped plans.

- `01-markdown-foundation` defines the repository-owned Markdown model.
- `02-live-viewer` adds the local visual viewer and Markdown file watching.
- `03-code-observation` adds source observation that produces the same Markdown.
- `04-semantic-zoom-viewer` rebuilds the viewer as one global, zoomable C4 map.
- `05-tui-viewer` adds a keyboard-driven terminal viewer of the same map.
