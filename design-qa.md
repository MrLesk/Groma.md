# TASK-165 design QA

- Source visual truth: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-378b10ea-9a0c-496e-9ca8-9a8e2044a8ab.png`
- Implementation: `http://localhost:4872/`
- Full-view screenshot: `/tmp/task-165-content-fit-desktop.png`
- Focused screenshot: `/tmp/task-165-content-fit-corner.png`
- Comparison image: `/tmp/task-165-content-fit-compare.png`
- Viewport: 1280 × 720 CSS pixels at device scale 1
- Pixels: source 1080 × 553; implementation 1280 × 720; focused implementation 1040 × 720. The comparison centres both focused regions on white without changing their proportions.
- State: Groma root map with hierarchy visible, details closed, and the map fitted.

## Full-view comparison

The title plate remains attached to the south-east drafting band and does not overlap architecture. Its east and south anchors, frame weight, grayscale palette, calibration ticks, compass, and pencil are unchanged.

## Focused comparison

The source shows a fixed-width plate with unused horizontal space. The implementation fits the plate to the widest visible project line plus its fixed pencil column and padding. The current short profile therefore produces a compact box. Automated projection evidence covers gradual horizontal growth through an 80-character line and wrapping beyond that cap without moving the east frame.

## Required fidelity surfaces

- Fonts and typography: Existing Groma title, Markdown, and metadata typography is unchanged. Measured SVG text stays inside the fitted content cell.
- Spacing and layout: The plate removes the source's empty east-west span while retaining the south-east anchor, fixed pencil cell, and separation from architecture.
- Colors and tokens: No color or style rule changed; the result remains grayscale.
- Image quality and asset fidelity: The plate remains resolution-independent SVG geometry on the live isometric plane.
- Copy and content: The plate uses the current project profile without adding placeholder text, numbers, or fake blueprint metadata.
- Interaction and accessibility: Activating `Edit project profile` opens the dialog with the name input focused; Cancel closes it. Browser logs are empty.

## Comparison history

1. User review found that the fixed 44%-of-sheet plate left excessive empty width. Result: blocked (P2 visual density).
2. The final capture sizes the plate from its rendered content, caps horizontal growth at 80 characters, and preserves its south-east alignment. Result: passed.

## Residual differences

No actionable P0, P1, or P2 difference remains for this correction. A small sheet can wrap before 80 characters when the sheet itself is narrower; this keeps the title plate inside its frame.

final result: passed

# TASK-169.1 visual QA

## Source and implementation

- Source: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-39c4fafa-e34b-49e0-ad13-d6d3add419a1.png` (702×86), confirmed against the live web task island.
- Terminal: `/tmp/groma-task-169-1-capture.ta11DN/normal-120.svg` and `/tmp/groma-task-169-1-capture.ta11DN/work-120.svg` at 120×36.
- Wide terminal: `/tmp/groma-task-169-1-wide.CmqqZQ/task-156-200.svg` at 200×60.
- Component focus: `/tmp/groma-task-169-1-component2.kIXIdi/task-172-120.svg` at 120×36.
- Comparison: `/tmp/groma-task-169-1-capture.ta11DN/recap-comparison.png`.

## Comparison

The source and terminal recap share the same hierarchy: Backlog identity, workflow counts, and a direct expansion action. The terminal uses one centered reserved row instead of web chips because terminal geometry is fixed and the map cannot be overlaid. It uses the existing TUI palette, typography, and separators.

The recap does not cover map cells. Task markers remain visible in normal mode. Work focus preserves both side panes, highlights touched architecture, and changes only temporary scope and camera. Cross-container tasks use the root map; a task contained by Web viewer opens its component map. Both terminal sizes remain readable with no cropped chrome or overlapping panes.

Result: passed.
