# Groma plans

Each directory under `groma/plans/` is one planned feature: an independent,
mutable description of a desired outcome. Per the
[product model](../../docs/product-model.md),
a plan holds a README and only the element Markdown not yet implemented.
Implementing an element moves its file into `groma/observed/`; a plan with no
element Markdown left is complete and its directory disappears. Git history is
the archive, and revisions are commits.

Plans do not build on each other and have no order.

The current product direction is the single [MVP plan](mvp/README.md).
