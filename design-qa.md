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


---

# TASK-446 startup design QA

## Findings and approved decisions

No actionable P0, P1, or P2 differences remain.

The three roles are complementary: project setup, first-scan progress, and regular
loading. Alex's final decision is to keep a card around all three. The regular
loader has a compact card and left-aligned status.

## Source visual truth

All source boards are 2048 × 768 pixels:

- Setup: first panel of `/Users/alex/.codex/generated_images/01a0bb7b-4651-7980-b6a4-f5769319e8fd/exec-4cc2ad43-67bc-4c92-9e64-117877b7b182.png`.
- First-scan steps: middle panel of `/Users/alex/.codex/generated_images/01a0bb7b-4651-7980-b6a4-f5769319e8fd/exec-4886d9ce-09f8-4a7c-8a1f-9a9f83ec6ca4.png`, enclosed in the shared card after Alex's correction.
- Regular loading: last panel of `/Users/alex/.codex/generated_images/01a0bb7b-4651-7980-b6a4-f5769319e8fd/exec-db8e8d87-cb45-4934-a99a-822ef9dc3c1d.png`, with the status aligned left.
- Card correction: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-a5cc9376-0373-4d13-8bad-308de6e9b170.png` and Alex's confirmation that the card is nicer.

## Browser evidence

Capture directory:
`/Users/alex/.codex/visualizations/2026/09/19/01a0bb7b-4651-7980-b6a4-f5769319e8fd/startup/`

| Screenshot | CSS viewport and image pixels | State |
| --- | --- | --- |
| 01-setup-desktop.png | 800 × 640 | Dark setup, project name focused |
| 02-setup-narrow.png | 375 × 812 | Dark setup, alternate folder selected |
| 06-first-scan-card-desktop.png | 800 × 640 | Dark first scan, two completed milestones, scan active |
| 07-first-scan-card-narrow.png | 375 × 812 | Same first-scan state |
| 08-regular-loading-desktop.png | 1280 × 720 | Dark regular loading, scan active |
| 09-regular-loading-narrow.png | 375 × 812 | Same regular-loading state |
| 10-regular-loading-light.png | 375 × 812 | Light regular loading, reduced motion |

Screenshots were captured from the real web server with isolated temporary
projects. The browser reported devicePixelRatio 1, and image dimensions match
CSS dimensions. There is no density downsampling.

The source images are presentation boards, not literal browser viewports.
Comparison used the relevant panel's content region, excluded board titles and
captions, and judged proportional composition rather than treating the full
2048-pixel board as one screen. The setup and first-scan source/current images
were opened together in one comparison input; the regular source/current images
were opened together in another. The final card correction was compared again
with the card reference and final first-scan capture together. These are grouped
comparison inputs, not an exported side-by-side contact sheet.

The form labels, step indicators, logo, divider, and status strip are readable
at the captured resolution, so separate enlarged crops were not needed.

## Required fidelity surfaces

- **Fonts and typography:** native Groma monospace stack, 24px main headings,
  14px form/progress text, and 18px regular status. At narrow width the first-scan
  heading wraps naturally and the regular status uses 16px. Existing font and
  antialiasing differences from generated lettering are expected.
- **Spacing and layout:** setup and first scan share a 520px maximum card width;
  regular loading uses 560px with much less height. The header, navigation,
  field spacing, and connected milestones preserve the approved hierarchy.
  Both 375px loading views and setup fit without horizontal overflow.
- **Colors and tokens:** existing paper, ink, muted, hairline, and green accent
  tokens support dark and light themes. Completed connector lines now use
  green; pending lines remain neutral. Button/checkmark contrast uses the
  existing on-colour token instead of reproducing generated-image lighting.
- **Image quality and assets:** the existing Groma SVG lockup stays sharp.
  Native form controls, the existing CSS grid/spinner treatment, and the
  established checkmark convention are retained. No new raster asset or icon
  dependency is needed for these functional screens.
- **Copy and content:** the project name and running version are real data.
  “Scanner setup complete” avoids claiming installation when no package was
  added. The active label comes from the running operation; no fake percentage,
  elapsed-time sequence, or decorative subtitle is shown.

## Comparison history

1. Initial captures exposed a P2 completed-connector mismatch: selector
   specificity kept completed lines grey. The selector now applies the green
   completion token.
2. Alex identified the missing first-scan card as an unwanted interpretation of
   the open-canvas mockup and confirmed cards for all three screens. The
   first-scan override that removed the card was deleted.
3. Final captures 06 and 07 show the restored card and green completed
   connectors at desktop and narrow widths. The paired final comparison found
   no actionable P0/P1/P2 mismatch.
4. The regular-loader captures confirm the requested left alignment. Its shorter
   card is intentional, since it has neither form fields nor a setup checklist.

## Interaction and accessibility evidence

- Project name entry and both folder radio options work; Continue reaches
  scanner selection, and Scan project reaches first-scan progress.
- A controlled real scanner remains active until released. Releasing it opens
  the populated map for both the first-run and initialized-project paths.
- Status updates are announced through a polite live region outside the busy
  card. Pending and completed states have text as well as visual marks.
- Reduced-motion emulation reports animation-name none. Light-theme capture
  remains readable. Temporary viewport and media overrides were reset.
- Browser error logs were empty after the verified first-run and regular flows.
- The preview harness initially timed out its artificial scan gate and had an
  incomplete temporary project profile. Those harness issues were corrected;
  the successful flows were checked again. They required no product fallback.
- Nine focused lifecycle/source-watch/exclusion tests pass. The excluded-source
  regression failed before moving the scan callback to actual scanner
  invocation and passes after the fix.
- Final `bun run check` passes: 16 Node tests, 611 Bun tests, 36 configured skips.
  The remaining complexity warning is in unchanged `test-bun/iso-map.test.ts`.

## Implementation checklist

- Three card screens and left-aligned regular status: verified.
- Operation-driven phases and skipped-operation behavior: verified.
- Setup and both loading-to-map paths: verified.
- Dark/light, narrow width, reduced motion, and browser errors: verified.
- Documentation and repository checks: complete.

No follow-up visual polish is required. Installing a downloaded scanner package
was not repeated during visual QA; its existing selection/install operation is
unchanged.

final result: passed


---

# TASK-449 empty-project welcome design QA

## Findings

No actionable P0/P1/P2 difference remains in the requested empty-project screen.
The old failure-style message is replaced by “Your map starts here”, one concise
next step, and a live “Set up scanners” action inside the approved card frame.

## Evidence and comparison

- Source screenshot: `/var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-e44da597-147f-4963-92b1-218ed9fe2798.png`.
- Final implementation: `/Users/alex/.codex/visualizations/2026/09/19/01a0bb7b-4651-7980-b6a4-f5769319e8fd/empty-map/07-empty-final.png`.
- Both source and final screenshot: 621 × 387 pixels. Browser viewport:
  621 × 387 CSS pixels; devicePixelRatio 1. No density resampling.
- State: empty initialized project, dark theme, map chrome hidden to match the
  supplied content crop. Map camera position differs from the source; the card,
  typography, and grid treatment are the comparison scope.
- Source and final implementation were opened together in the same comparison
  input. This is a grouped comparison, not an exported contact sheet.
- The card and controls are readable at native capture size, so no separate
  enlarged region was necessary.
- Supporting captures in the same `empty-map` directory:
  `02-empty-narrow.png` and `03-empty-light.png` at 375 × 667;
  `04-empty-panels.png` at 900 × 700; and
  `06-published-empty.png` at 900 × 700.

## Required fidelity surfaces

- **Typography:** existing Groma monospace family, 24px heading, 14px next-step
  text, and 12px project label. The short heading fits at 375px and the next step
  wraps cleanly without italic technical copy.
- **Spacing and layout:** 440px maximum width, 32px desktop padding, 16px radius,
  and a full-width action match the approved startup cards. At 375px the card is
  343px wide with no horizontal overflow. At the supported 900px map width, the
  welcome begins at x=370 while the hierarchy ends at x=292; neither overlaps.
- **Colors and tokens:** existing paper, ink, muted, hairline, green accent, and
  on-colour tokens provide the same dark/light behavior as startup.
- **Assets:** the existing map grid and architecture drawing remain unchanged.
  This copy/control improvement needs no new image or icon asset.
- **Copy:** the welcome treats an empty project as a normal starting point.
  It does not claim a scanner failed or promise that scanning has already run.

## Interaction and correction history

1. Initial paired comparison showed the intended calmer card with no blocking
   visual mismatch. A later selector adjustment limited the new positioning to
   the welcome, retaining the compact notice's existing placement. The final
   paired capture confirms the welcome is unchanged.
2. The live button opens the existing Plugins dialog. With no code present,
   scanner settings correctly report that no source project was detected.
   Closing settings returns focus to the welcome button.
3. The new entry point exposed a P2 keyboard-focus defect: after a component
   arrived while settings was open, the welcome disappeared and closing the
   dialog left focus on BODY.
4. The existing dialog's opener-visibility check now includes hidden ancestors.
   Repeating the same flow returns focus to `settings-toggle`; with the welcome
   still present, focus returns to `empty-scanners`. This corrects focus handling
   without adding a new navigation path.
5. Adding a system switches to the existing compact notice; dismissal still
   works. Adding the first component hides the notice on the live update.
   Selecting an empty historical revision hides it as before.
6. Static export keeps the welcome but does not enable or display a scanner
   configuration button. Browser error logs were empty.

The compact no-components notice can be covered by existing map panels at narrow
desktop widths when both side panels are open. Its original positioning and
layer order already have this limitation; the welcome change does not extend to
redesigning that existing notice.

## Verification and review

`bun run check` passed after the final code change: 16 Node tests and 611 Bun
tests, with 36 configured skips. No new decorative UI/content tests were added.
The browser checks cover the new action and the reproduced focus failure.
Task-scoped whitespace checks pass.

The implementer's specification and quality reviews confirm that the empty-state
controller owns its presentation and visibility, the settings controller owns
opening Plugins, and the shared dialog owns focus restoration. There are no new
modules, dependencies, architecture concepts, or stored fields.

## Implementation checklist

- Welcoming empty-project card: verified.
- Live settings action and focus restoration: verified.
- Published, historical, compact, and populated states: verified.
- Light/dark and supported layout sizes: verified.
- Documentation and repository check: complete.

final result: passed
