# TASK-221 design QA

## Evidence

- Source visual truth: `/Users/alex/.codex/generated_images/01a05397-d686-7580-90df-3c52b080b1b3/exec-00d9c988-e1da-4d29-8bfb-fc26dad6cdf3.png`
- Normalized source: `/private/tmp/task-221-reference-1280x720.png`
- Search implementation: `/private/tmp/task-221-search-post-fix.png`
- Revision implementation: `/private/tmp/task-221-revision-final.png`
- Viewport: 1280 × 720 CSS pixels
- Source pixels: 1672 × 941, scaled proportionally to 1280 × 720 for comparison
- Implementation pixels: 1280 × 720; browser reported device pixel ratio 2 and returned a CSS-pixel screenshot
- State: light theme, current revision, `view` search query, first result previewed
- Full-view comparison: the normalized source and post-fix implementation were compared together at 1280 × 720.
- Focused comparison: the separately captured revision-open state verifies that revision and search use the same `anchored-popover` and `anchored-option` surfaces. A cropped search comparison was not needed because the search field, five rows, metadata, paths, and footer remain readable in the full-size captures.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation keeps Groma's monospace UI hierarchy, compact metadata, readable result names, and single-line truncation used by the approved mock.
- Spacing and layout rhythm: the search field stays in the header, the five-row menu is anchored to its right edge, and its padding, dividers, radius, shadow, and footer follow the approved compact composition.
- Colors and visual tokens: the implementation uses the existing paper, ink, muted, hover, and green highlight tokens. The selected row and focused field match the mock's restrained green emphasis.
- Image quality and assets: the search and close controls reuse Groma's existing SVG icon system; no raster placeholders or generated substitutes were introduced.
- Copy and content: result names, kinds, origins, ancestor paths, result count, and keyboard actions are present. Current architecture data differs from the mock, as expected; this does not change the component design.
- Shared revision style: the revision menu uses the same anchored surface and option classes while retaining its wider content layout and existing behavior.
- Browser behavior: `/`, Cmd+K, query preview, Arrow navigation, Enter acceptance, Escape restoration, and URL commit were exercised. Preview left the URL unchanged; Escape restored the prior selection and camera exactly. The browser reported no warning or error logs.

## Comparison history

1. Initial comparison found a P2 duplicate clear control from WebKit's native search cancel button and a P2 list-density mismatch with eight results instead of the approved five.
2. The native cancel button was hidden, the shared result limit was reduced to five, and the footer action label was aligned with the mock.
3. The server was restarted and the implementation was recaptured with the same `view` query at 1280 × 720. The field now has one clear control, the menu has five rows, and no actionable P0, P1, or P2 mismatch remains.

## Primary interactions tested

- `/` opens search.
- Cmd+K opens search on macOS.
- Arrow keys preview without committing the URL.
- Enter accepts through existing architecture selection and URL state.
- Escape restores the previous selection, camera, details state, and URL.
- Opening revision shows the shared anchored-popover treatment.

## Five-row result window correction

- Source visual truth: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-deca3bf5-c3f3-495c-9799-25e8603573be.png`
- Implementation screenshot: `/private/tmp/task-221-search-five-results.png`
- Viewport and pixels: both source and implementation are 510 × 366; the browser viewport was set to 510 × 366 CSS pixels for the comparison.
- State: light theme with exactly five ranked results. The source uses `view`; the uncapped implementation uses `viewer details` because it returns exactly five results in the current architecture. The comparison judges result-window size and overflow, not result content.
- Full-view comparison: five complete rows and the footer fit in the anchored menu without a vertical scrollbar. The menu remains inside the short viewport.
- Focused comparison: no crop was needed because the result window, its right edge, all five rows, and the footer are readable at native size in both captures.
- Fonts and typography: the correction does not change the existing monospaced hierarchy, result weights, metadata, truncation, or footer labels.
- Spacing and layout rhythm: each result owns a fixed 50-pixel row and the result viewport owns exactly five rows. The footer stays outside the scrolling region.
- Colors and visual tokens: no tokens or visual states changed.
- Image quality and assets: no assets changed; the existing search and close icons remain resolution-independent.
- Copy and content: the result count now reports every ranked match instead of a five-result cap.
- Interaction and accessibility: a `view` query exposed 46 results. Moving to the sixth result scrolled only the result viewport while the footer remained fixed. Exactly five results measured 250 pixels of client and scroll height, so no scrollbar is needed. Browser warnings and errors were empty.

### Correction comparison history

1. The user capture found a P2 overflow mismatch: five results were the complete result set but still showed a vertical scrollbar.
2. Five was separated into a visible-row count rather than a result cap. The result list now owns overflow, the menu fits five rows plus its footer in the short viewport, and every additional Fuse result remains available by scrolling. The same-size post-fix capture has no scrollbar with exactly five results. Result: passed.

## Interaction corrections

- Footer source: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-0480d6ce-92ee-4f8d-b44c-6ef41704ee23.png`
- Final compact implementation: `/private/tmp/task-221-search-final-510x366.png`
- The source and final implementation were compared together. At 510 × 366, the menu content and client height are both 300 pixels, five result rows occupy 250 pixels, and the footer ends 5 pixels before the inner border. No content is clipped and no vertical scrollbar appears.
- Opening uses the existing chrome motion timing at 182 milliseconds for both the expanding field and anchored menu. Closing uses the matching reverse keyframes. Browser verification confirmed that reduced-motion preference changes the animation to `none` and the transition duration to `0s`.
- Arrow preview was exercised from a committed CLI selection. The first and second results changed only the selected SVG map element while the hierarchy remained on CLI, details continued to show CLI, and the URL stayed `?container=cli`. Enter then selected the previewed Details component in the map and hierarchy, updated details to Details, and committed `?component=web-viewer-details-2`.

### Interaction comparison history

1. The footer capture found a P2 spacing mismatch: the keyboard footer touched the popover border. A 5-pixel inner inset now remains at the compact viewport without clipping.
2. Search opening and closing initially changed instantly. Matching forward and reverse motion now use the shared chrome timing and honor reduced motion.
3. Arrow preview initially reused committed architecture selection, which also changed hierarchy and details. Preview now uses the existing map highlight directly; Enter alone calls normal architecture selection. Result: passed.

final result: passed

---

# TASK-227.2 Design QA

## Evidence

- Source visual truth: `/Users/alex/.codex/generated_images/01a058aa-7f3e-7433-bec6-79edc630dd8c/exec-66cce452-5a73-4bc4-8580-0dcbef32fdb4.png`
- Implementation capture: `/private/tmp/groma-welcome-227-2.png`
- Combined comparison: `/private/tmp/groma-design-qa-comparison.png`
- State: Welcome launcher at 110 columns by 30 rows with Advanced commands selected
- Source pixels: 2109 × 745
- Implementation pixels: 1130 × 682 from the full-color terminal SVG capture
- Normalization: the implementation context and table were cropped to 800 × 300; both sides were scaled to 420 pixels high for the combined focused comparison

## Findings

No actionable P0, P1, or P2 differences remain. The implementation places one green trailing chevron after both nested-page labels without changing table geometry, descriptions, selection, or navigation.

- Fonts and typography: both use the existing monospaced terminal typography. The implementation retains terminal-controlled font rendering and selection weight.
- Spacing and layout rhythm: row heights, column widths, borders, and description alignment remain unchanged. The chevrons fit inside the existing command column.
- Colors and visual tokens: the chevrons use the existing Groma green. The captured terminal background differs from the mock because Groma deliberately uses terminal default colors.
- Image quality and asset fidelity: no raster or custom image assets are part of this TUI change. The implementation capture is a full-color SVG converted to PNG for comparison.
- Copy and content: launcher labels and descriptions match the source. The live selection caret remains visible in the implementation and continues blinking as before.

## Interaction Evidence

- Up and Down still select launcher rows.
- Enter still opens Instructions or Advanced commands.
- Advanced commands remains read-only; J/K and PageUp/PageDown scroll complete table rows.
- Enter or Backspace returns to the launcher with Advanced commands selected.
- Focused Advanced and Instructions interaction tests pass with no console surface applicable to the TUI.

## Comparison History

The first comparison found no actionable fidelity difference. No visual fixes or repeat comparison were required.

## Follow-up Polish

None.

final result: passed

---

# TASK-266 Design QA

## Evidence

- Source: `/Users/alex/.codex/generated_images/01a0720f-0723-7a12-9d7c-c1ec990b5af0/exec-94a76b8c-2e44-4822-a7df-2d7bf0ab02b9.png` (1668 × 943).
- Implementation: `/tmp/groma266-component.png`, `/tmp/groma266-component-crop.png`, `/tmp/groma266-relationship-crop.png`, `/tmp/groma266-dark-900.png`.
- Combined source and implementation comparison: `/tmp/groma266-comparison.png`.
- Viewports: 1440 × 1000 and 900 × 800 CSS pixels; details widths 420 and 360 pixels.
- Captures contain the painted browser region at half size within the requested canvas. The combined comparison crops that region and scales it to CSS size. Detail captures are 420 × 914 and 420 × 450 pixels before normalization.
- State: Architecture writer component and its relationship to Git in light mode; incoming Git relationships in dark mode.
- Full-view and focused card comparison were examined together. Live component overview, tabs and additional relationships remain driven by architecture data; the card is the approved design scope.

## Findings

No actionable P0/P1/P2 differences remain.

- Typography: existing monospace family, bold wrapping endpoint names, small uppercase roles, readable action and muted kind/technology preserve the reference hierarchy.
- Layout: both views use one bordered card, horizontal source/arrow/destination grid, divided action and technology rows. THIS sits beside the current endpoint name. The list chevron belongs to its clickable action row. Cards fit both supported pane widths without horizontal overflow.
- Colors: existing paper, ink, muted, hairline and hover tokens support light and dark themes.
- Assets: no raster assets are required. The semantic direction arrow and chevron follow existing Groma text controls. The mockup's decorative document icon is omitted under the project's minimum sufficient product rule.
- Content: exact authored action and technology are retained. Component lists preserve peer promotion and relationship details show exact endpoints.

## Interaction evidence

Source and destination names select the expected elements. The list action opens the exact relationship without THIS. The component list shows THIS on source and destination for outgoing and incoming relationships. Edit opens description and technology fields, and Cancel returns to the same relationship. Existing draft/current acceptance and removal tests pass. Browser error logs were empty.

## Comparison history

The first normalized comparison found no actionable P0/P1/P2 difference. No visual correction was required.

## Implementation checklist

- Shared card in both views: verified.
- Directed selection and THIS: verified.
- Light/dark and supported widths: verified.
- Repository checks: passed.

final result: passed

## TASK-266 approved row revision

The approved annotated screenshot `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-450ba4c4-23e0-4b59-8885-af85fa3dde08.png` (390 × 255) moves the description into the arrow and removes technology. The user's final instruction further requests smaller type and dividers instead of cards and lateral padding.

- Final implementation captures: `/tmp/groma266-divider-light.png` (1440 × 1000), `/tmp/groma266-divider-dark.png` (900 × 800).
- Combined focused comparison: `/tmp/groma266-divider-comparison.png`. The source, light standalone relationship and dark incoming list appear together. Browser capture normalization remains as described above. The annotation supplies placement intent; its red markup is not product content.
- Typography: endpoint names are 12px, actions and kinds 10px, role captions 9px. Full names wrap without ellipsis; the center remains readable.
- Layout: three columns use the full reading width, with no enclosing border or inner padding. Only adjacent list rows have dividers. The description sits directly above the center arrow; no duplicate action row remains.
- Tokens and assets: existing light/dark tokens and semantic text arrow remain unchanged; technology is hidden in reading but remains editable.
- Content and behavior: the same endpoint/THIS rules and center-action navigation remain intact. At 900px, each row is 310px wide and all three columns have equal scroll/client widths, confirming no clipped text. Standalone details have no THIS badge.
- Comparison history: these are user-requested revisions to the approved design, not fixes to an unapproved design. The final combined comparison found no actionable P0/P1/P2 issues.
- Reviews: cold simplicity and final full-context complexity reviews passed without material recommendations.

final result: passed

## TASK-266 endpoint centering refinement

Source: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-6b4836d3-7089-4423-844e-7890dd4bcae6.png`. The user requests the middle block centered between content-sized endpoints. Final capture: `/tmp/groma266-flex-dark.png`; combined source/implementation evidence: `/tmp/groma266-flex-comparison.png`. This comparison checks geometry; source light and implementation dark use the already-verified theme tokens.

Flex layout gives the remaining width to the action after sizing the endpoints to their content. At the 900px viewport, both Git list rows measured action center and endpoint-gap center at exactly 680.90625px. Seven component rows with different endpoint widths also had matching action/gap centers and no overflow. The center action still opens relationship details, and source navigation returns to the component. Typography, dividers, THIS and editing remain unchanged. No P0/P1/P2 findings remain. The final isolated repository check passed 104 Node and 301 Bun tests.

final result: passed

## TASK-266 label and arrow spacing

The user requested extra space beside the middle label, two-line wrapping for the example, and text directly above the arrow. Source: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-6569ce6f-18aa-4d45-a3ff-5daf127e52ec.png`. Final light capture: `/tmp/groma266-spacing-light.png`; combined comparison: `/tmp/groma266-spacing-comparison.png` at the 1440 × 1000 viewport using the documented capture normalization.

The action has 12px horizontal padding and its label is capped at 24ch. Both Git examples measure 30px high at a 15px line height: exactly two lines. The arrow begins 2px below the label. Its action center remains equal to the endpoint-gap center. All seven component rows fit the 900px viewport without overflow, and action/endpoint navigation still works. The combined comparison has no actionable P0/P1/P2 findings. The focused change preserves the previously reviewed ownership and behavior. Final isolated repository checks pass 104 Node and 301 Bun tests.

final result: passed
