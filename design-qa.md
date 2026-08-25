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
