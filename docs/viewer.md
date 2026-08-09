# Viewer

The Groma terminal viewer makes architectural intent visible without adding presentation state to the architecture
model. It is a read-only OpenTUI projection of the model returned by Groma core. Core combines observed architecture,
missing architecture, and every plan, and adds their runtime origin annotations.

The viewer is part of the product loop. It lets a person judge whether scanned architecture is recognizable, improve its
meaning, and review the intended result before implementation.

Run it from the architecture repository with `groma view`.

## One fixed world

System Context, Containers, and Components are three semantic zoom levels over one geometry. The compact footer calls
the first level `context`. Groma positions every component, sizes each container around its components, sizes each
system around its containers, and places people and external systems around the internal systems. It computes that world
when the architecture changes and reuses it at every level.

Changing level, moving the selection, opening details, or resizing the terminal never lays out the architecture again.
An unchanged architecture therefore keeps the same geometry. A changed architecture may produce a new deterministic
best fit.

Relationships are directed arrows. The current level changes which elements and relationships are emphasized, not where
anything is positioned. Which relationships are most useful at each level is tuned against the MVP while implementing
the viewer; the MVP does not prescribe aggregation rules before the result can be inspected. Observed items use a solid
border and a terminal-theme-derived background tint. Planned and missing items use distinct theme colors and dotted
borders. Items display their `observed`, `planned`, or `missing` annotations as compact chips.

## Navigation

The viewer starts at System Context with the first internal system in stable-ID order selected. The selected system or
container defines what the viewer enters.

`+` enters the selected system or container without opening details. A selected system reveals only its containers; a
selected container reveals only its components. `-` returns to the selected item's parent and the higher semantic level.
Either key is a no-op when there is no applicable child or parent. Enter performs the same inward transition as `+` and
also opens details. Esc never changes semantic level.

Arrow keys select the nearest element in the pressed direction at the current level, including an element inside another
parent. If none exists, selection moves to the nearest element in that direction at a higher level and the viewer zooms
out. An element's own ancestors are not directional targets, and arrows never descend.

The footer shows `- context | containers | components +` with the current level emphasized. `z` moves focus to this
control; pressing `z` again restores the previously selected architecture item.

Enter opens the selected person, system, container, or component in a right-side detail panel. The panel overlays the
world. The camera reframes the selected item's direct children into the remaining visible area without moving their world
coordinates, and components from sibling containers are not shown. `f` toggles the panel between side and full-screen;
full-screen details hide the world. Esc closes details, and Esc with no detail panel open exits Groma. Component details
include the scanner, exact file, and optional symbol from `code` frontmatter.

## Source boundary

The viewer requests its complete annotated model and fixed-world ELK objects from Groma core. It never reads architecture
Markdown, walks architecture directories, or calculates layout. Scanners return source-derived data to core; they do
not write Markdown or control the viewer. Core owns reconciliation, persistence, annotations, layout, and the viewer
model according to the [product model](product-model.md).
