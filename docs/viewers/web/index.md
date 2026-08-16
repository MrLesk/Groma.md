# Web viewer

The web plugin shows Groma's world in a browser. `groma web` starts it.
It does not scan.

This page is the browser surface. The shared viewer rules live in
[Viewers](../index.md).

## What it shows

The whole world is one map. 3D is the default city view. 2D is the
top-down plan. Parents with children render as plates; children sit on
them; leaves render as prisms. Each C4 kind is visually distinct. Sibling
groups are neighborhood zones. Planned items are ghosts with dashed
edges. Routes follow the laid-out paths. Names sit on the top face.

The map never reads architecture Markdown or calculates layout. It
projects the world Core already has.

## What you can do

The first view fits the whole map. Scrolling zooms. Dragging pans. The
2D and 3D buttons switch the two fixed views and re-fit the camera.
