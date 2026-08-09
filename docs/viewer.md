# Viewer

The Groma viewer makes architectural intent visible without adding presentation state to the architecture model. It is
a read-only view of observed architecture, missing architecture, and every plan. Planned additions appear as ghosts and
missing elements remain visible while their deletion intent is resolved.

The viewer is part of the product's core loop, not a presentation step after scanning. It lets a person decide whether
the first scanned architecture is recognizable, improve its meaning, and review later observed or planned changes.

## Model and comparison

The viewer loads `groma/observed`, `groma/missing`, and all plans according to the [product model](product-model.md). It
preserves which plan each desired element belongs to and displays the lifecycle state supplied by each Markdown
location. At Code detail, it shows the scanner, exact file, and optional symbol recorded in component frontmatter.

## Live updates

The server watches named Markdown file events under `groma/observed`, `groma/missing`, and `groma/plans`. After changes
settle, it fully rereads the architecture model. An open browser updates over a local event stream without restarting the
viewer.

If a settled edit is temporarily invalid, the last valid model remains visible with a warning until a later Markdown
change rebuilds successfully. Newly connected browsers receive the same current warning.

Extensionless files, non-Markdown files, and files outside the two architecture directories are not watched.

## Source boundary

The viewer reads architecture Markdown. Scanners send source-derived information to Groma core, which reconciles stable
IDs and persists elements as observed or missing. Plans express intended additions, changes, and restorations. See
[Scanners](scanners/index.md).
