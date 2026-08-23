# Design QA: TASK-154

final result: passed

## Evidence

- Visual source: `/Users/alex/.codex/generated_images/01a02fc9-4d85-7fd3-aca8-437064a0cf0b/exec-17e57a7b-6f86-4027-82f8-3023bfe4cb1d.png` (approved option 1), with `/Users/alex/.codex/generated_images/01a02fc9-4d85-7fd3-aca8-437064a0cf0b/exec-4ec42335-782e-4f82-b776-cdcb8e128a88.png` and `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-cba7f1a6-1b83-4f7a-b074-0a79840cc3c5.png` for the wider inspector and hierarchy lines.
- Primary implementation: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/groma-web-chrome-audit/16-floating-live-work-aligned.png`.
- Additional states: `13-floating-task.png`, `17-floating-dark.png`, `19-floating-help.png`, `20-camera-invariant-empty.png`, `21-details-close.png`, and `22-boxed-toggle.png` in the same audit directory.
- Direct comparison: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/groma-web-chrome-audit/16-floating-option1-comparison.png`.
- Viewport: 1280 x 720 CSS pixels at density 1. The source was proportionally resized and centre-cropped to the same size for comparison.

## Findings

No actionable P0, P1, or P2 differences remain.

- Layout: the isometric grid measures 1280 x 720 and continues below the inset header and sidebars. The fitted architecture remains inside the clear centre between the 280px hierarchy and 409.6px inspector.
- Frost: the header and unchanged Live work surface both compute to `color(srgb 1 1 1 / 0.35)` in the light theme. The sidebars use the same 35%-paper rule and remain readable in both themes.
- Controls: Fit, its four-corner icon, zoom out, readout, zoom in, Help, and the icon-labelled theme action share one stable header group. No camera controls remain on the map.
- Selection: the inspector has a visible X, closes with empty selection, keeps its width between concrete selections, and returns focus to the map. The task-focused camera shows more context at 304% compared with 372% before the margin change.
- Integration: the open Live work surface is constrained to the same clear centre as the camera and does not sit under either sidebar. Its component and visual styling are unchanged.
- Hierarchy: the approved boxed double-chevron, collapsed rail, and quiet terminating branch lines remain legible over the full-screen grid.
- Accessibility: hidden panel content is inert and `aria-hidden`, focus styles remain visible, and shell transitions stop under `prefers-reduced-motion`.

## Comparison History

1. The first implementation kept the grid inside the centre pane, used 82%-paper chrome, placed zoom over the map, and omitted Fit and theme icons.
2. User review reopened acceptance and required a full-screen grid, 35%-paper floating chrome, header-owned camera controls with icons, and a wider task-focus view.
3. The revised browser pass exposed Help over dense inspector copy and Live work centred under the floating sidebars. Help now opens in the clear map area with a stronger reading surface, and shell CSS constrains the unchanged task bar to the clear centre.
4. The final side-by-side comparison shows the approved full-screen grid and floating relationships. Differences in map size follow the explicitly wider inspector and are intentional.
5. Final user review added the missing inspector X and required floating panels to stop controlling the camera. The measured SVG transform remains `translate(588.21px, 267.4px) scale(0.0986)` through hierarchy collapse and inspector close.

## Browser Verification

- Page identity and meaningful DOM passed at `http://localhost:4747`.
- Tested full fit, zoom, task selection, empty selection through Escape, hierarchy collapse/restore, Help, open Live work, and light/dark theme switching.
- Fit returned the readout to 100%; task focus changed from the previous 372% to 304% with all highlighted task context inside the clear area.
- Hierarchy collapse and inspector close leave the exact camera transform unchanged. The close action makes details inert and moves focus to the architecture map.
- Browser console warnings and errors: none.
- Full project check: 93 Node tests and 176 viewer tests passed.

## Implementation Checklist

- [x] Full-screen grid and 35%-paper floating shell match the approved direction.
- [x] Fit/zoom and icon-labelled theme control live in the header; Help remains beside Theme.
- [x] Wider selection-owned inspector, visible X, camera-invariant pane actions, hierarchy lines, task context, and unchanged Live work behavior are verified.
- [x] Light, dark, long-task, collapsed, empty, Help, Fit, and Live work states are verified.
