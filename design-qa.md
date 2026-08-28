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

# TASK-201 design QA

- Source visual truth: `/Users/alex/.codex/generated_images/01a044c0-eefb-76d0-92a6-b8cec7745b44/exec-0704e970-de85-4e17-aace-85e81336b3d7.png`
- Desktop implementation: `/tmp/task-201-matched-open.png`
- Narrow implementation: `/tmp/task-201-narrow-open.png`
- Full-view comparison: `/tmp/task-201-final-comparison.png`
- Viewports: 1280 × 720 and 520 × 720 CSS pixels at device scale 1
- Pixels and density: source 1709 × 920, normalized to 1337 × 720 without changing its proportions; desktop implementation 1280 × 720; narrow browser capture 509 × 705 from the 520 × 720 viewport.
- State: current revision, dark theme, boxed project pencil active; the desktop comparison uses a 931% close-up with hierarchy and details collapsed.

## Findings

No actionable P0, P1, or P2 difference remains. The implementation preserves the mock's upright editor, boxed isometric pencil, visible attachment to the title plate, bounded text surface, and green Save treatment while retaining Groma's existing name field and Write/Preview modes.

## Full-view comparison

The normalized side-by-side image shows the same composition: a compact south-east title plate, a bordered pencil control in its lower corner, and a dark upright editor beside it. The implementation uses a short straight connector instead of the mock's elbow because it joins the nearest points of the real dialog and live SVG cell at any camera position.

## Focused comparison

The final desktop capture keeps the pencil box and connector readable at the same approximate title-plate scale as the source. The narrow capture is the focused responsive evidence: the dialog remains between x=16 and x=506 inside a 520-pixel viewport, and its text surface remains fully visible.

## Required fidelity surfaces

- Fonts and typography: The editor and plate reuse Groma's monospaced interface and existing title hierarchy. The retained Name and Write/Preview controls use the established product typography.
- Spacing and layout: The desktop dialog is 480 × 431 CSS pixels and sits beside the active edit cell. The narrow dialog stays inside the viewport. Long text does not change the plate after its three-line preview cap.
- Colors and tokens: The dialog, border, connector, pencil, and map use existing theme tokens. Save uses Groma's existing green accent instead of a new color.
- Image quality and asset fidelity: The live SVG title plate and existing pencil remain resolution-independent at every camera scale; no raster replacement or placeholder asset was added.
- Copy and content: The editor shows the real project name and description. The Name field and Markdown modes intentionally remain because they are existing supported behavior not represented in the conceptual mock.
- Interaction and accessibility: The SVG control remains a keyboard-focusable button. A 4,189-character description produced Write scrollHeight 2160/clientHeight 200 and Preview scrollHeight 1859/clientHeight 200. Cancel closed without persistence. The live save/publication path passes its focused test, and browser warnings/errors were empty.

## Comparison history

1. The first browser capture placed the connector outside the viewport because its coordinates were interpreted relative to the dialog. This was a P2 anchoring failure.
2. The connector was changed to dialog-relative coordinates. The post-fix desktop comparison shows it joining the boxed pencil to the editor, and the compacted dialog leaves the attachment visible. Result: passed.

## Follow-up polish

The mock uses an elbow connector while the implementation uses the shortest straight segment between the live elements. This is an acceptable P3 difference because the straight segment stays correct as the camera and viewport change without another connector concept.

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

# TASK-199 design QA

- Source visual truth: `/Users/alex/.codex/generated_images/01a044d2-ddf7-77a3-98d5-a8fc59588b03/exec-d98b3f65-67bf-4b65-bfd1-4a5ad42df299.png`
- Implementation screenshots: `/tmp/task-199-light-v4.png`, `/tmp/task-199-dark-v4.png`, and `/tmp/task-199-blueprint-v4.png`
- Full-view comparison: `/tmp/task-199-comparison-v4.png`
- Viewport: 1280 × 720 CSS pixels
- Pixels and density: source 1672 × 941, normalized to 1280 × 720; implementation screenshots are 1280 × 720.
- State: current revision, Details component selected, exact Code file open in the details pane, light theme for the reference comparison.

## Findings

No actionable P0, P1, or P2 difference remains. The implementation keeps the approved inspector drill-down composition while using Groma's existing details pane, typography, spacing, borders, and controls.

## Full-view comparison

The selected component stays visible on the architecture map while the details pane becomes a read-only source viewer. Back, component context, and line count share one compact header row; the exact file path sits above line-numbered source. Source mode expands the pane to 640 pixels, leaving the map visible while giving 627 content pixels to the code surface.

## Focused comparison

A separate crop was not needed because the full 1280 × 720 comparison keeps the complete source header and 25 readable code lines at native size. The three final theme screenshots provide focused color evidence without changing layout or content.

## Required fidelity surfaces

- Fonts and typography: The implementation reuses Groma's monospaced interface type. File identity is bold, metadata stays small and tracked, and code remains readable at the existing inspector density without wrapping.
- Spacing and layout: At 1280 × 720 the 640-pixel source pane has room for the measured 594 pixels needed by 80 monospaced characters, line numbers, and padding. The body remains exactly 1280 pixels wide; only lines beyond the supported 80-character width scroll inside the pane.
- Colors and tokens: Light uses restrained violet, blue, green, and orange syntax colors. Dark uses bright pink, yellow, green, orange, and blue. Blueprint uses yellow underlined keywords with cyan, lilac, pink, and white accents. Each palette uses theme-owned tokens.
- Image quality and asset fidelity: The target contains no raster imagery or non-standard icon asset. The implementation preserves the live vector architecture scene and does not add replacement art.
- Copy and content: Back, Component, exact file path, and line count match the approved information hierarchy. Source content is the real selected file from the active revision.
- Interaction and accessibility: Exact Code files are buttons with descriptive accessible names. Back uses the shared standalone button atom, includes the reference's decorative left arrow, and matches the platform controls at 32 pixels high. Direct URL reload restored 424 source lines; Back cleared only the file state and returned to How it's built. Hierarchy, details, source, revision, and work surfaces inherit the same compact scrollbar rule.

## Comparison history

1. The first capture placed Back and line count above a second component-context row. This was a P2 density mismatch against the approved compact header.
2. The source header was collapsed to one row. The next review found a P2 platform-consistency problem: Back still looked unlike other buttons, the pane was too narrow for useful source, and scroll surfaces could still fall back to browser-default or local scrollbar styles.
3. Back now consumes the shared chrome button, source mode expands only the details column to 640 pixels, and one global compact scrollbar atom replaces local variants.
4. The final review found the Back arrow missing and its 34-pixel box taller than the 32-pixel platform controls. The corrected button adds the decorative arrow and uses an exact 32-pixel border-box height. `/tmp/task-199-comparison-v4.png` confirms the final control and width across the full view.

final result: passed
