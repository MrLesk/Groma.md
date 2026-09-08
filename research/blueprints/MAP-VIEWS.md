# Isometric, 2D and Layers in the blueprint editor

TASK-325 extends the isolated blueprint research editor. It does not change production `groma web`, the architecture contract, scanner behavior or the hidden production editing gestures.

## Decision

Treat 2D as an additional editing surface, not a replacement editor or a second layout. Isometric remains the initial view. The person can deliberately choose a flat plan while binding and inspecting a blueprint, then use Isometric for spatial context or Layers to inspect C4 boundaries. These expected usability benefits are design reasoning; they have not been established by a human usability study.

The compact control is labeled **Iso / 2D / Layers**. Layers is a meaningful name; F2 remains its shortcut, rather than becoming the name of a fourth architecture concept. F2 enters Layers and then returns to the last nested view, including its camera. Choosing Iso or 2D directly also leaves Layers.

## What changes and what does not

All three views consume one composed architectural sheet with the same identities, containment rectangles and routed relationships. 2D presents the full footprint once, removes walls and floor terraces, and uses horizontal text and an axis-aligned grid. Existing code references remain available in the inspector. It does not copy coordinates or presentation settings into a blueprint.

The full footprint is retained rather than laying out a new diagram for 2D. This avoids spatial reordering when switching. It also retains some spacing originally reserved for isometric towers; this version favors correspondence over maximum 2D density.

Mode controls live outside the inspector repaint boundary. Switching views does not replace input elements, clear bindings, save a draft, accept a part or change the selected responsibility. Inspecting a current participant during a preview keeps the proposed context on the map and permits returning to that same preview.

Each view remembers its camera during the browser session. First entry fits the sheet; later switches restore zoom and pan, and Layers retains its orbit. A structural scene change such as adding preview parts refits the new scene. A resize retains the world point at the viewport center. Reload starts in Isometric; view preferences are not persisted or encoded in shared URLs in this prototype.

## Interaction

The segmented selector uses native radio inputs: Tab enters the group and arrow keys change the selected view. Labels and icons remain visible. F2 is ignored in text/select editors and open dialogs, and held-key repeats do not toggle repeatedly. Switching through the visible controls still preserves typed inspector input.

Dragging pans Isometric and 2D. Dragging Layers orbits; Shift-drag pans. This uses the existing pointer and orbit calculations rather than replacing their semantics. Wheel and modifier-wheel follow the existing camera policy. Fit and zoom buttons work in each mode, arrow keys pan a focused map, and Layers also exposes rotation buttons. View changes are immediate; no new animation is imposed on reduced-motion users.

This does not add arbitrary component repositioning, drag-to-create, or drag-to-connect to the research prototype. Those production gestures remain unchanged and hidden where they were already hidden. When those editing operations are integrated, they should resolve semantic targets independently of the projection, not become 2D-only features.

## Boundaries

A camera choice is neither an OKF knowledge concept nor a C4 containment level. It requires no change to architecture Markdown. Current and planned relationship meanings and draft lifecycle remain the same in every view. The existing draft storage is still fixture-only browser localStorage; the production writer integration described in FINDINGS.md remains outstanding.

The geometry tests verify original-sheet immutability, identity/containment/route retention, flat footprints, source-file union, orthogonal routes, endpoints reaching their participants, and exact preservation of the existing isometric projector input. Browser tests exercise actual controls in Chromium, Firefox and WebKit during binding, preview, selection and creation. They test radio keyboard navigation, camera restoration, pointer pan/orbit, dirty input and narrow hit targets. These are not a claim of full accessibility conformity, physical iPhone testing or general drag-and-drop editing support.

## Verified result

The tested application is commit `2dc60097831a5a1595b52ef459cb19557a13add1`. [GitHub Actions run 34224386965](https://github.com/MrLesk/Groma.md/actions/runs/34224386965) passed every verification stage. Subsequent report/task commits do not change that application.

| Check | Result |
| --- | --- |
| Dedicated research lint and TypeScript project | Passed |
| Combined blueprint and map domain suite | 43 tests passed; 135 assertions; includes 13 new map tests |
| Full `bun run check` | Passed: 110 Node tests and 398 Bun tests |
| Browser checks | 117 assertions passed across Chromium, Firefox and WebKit |
| Captures | 15 actual screens: 9 refreshed blueprint screens and 6 new map-view screens |

The 43 domain tests are included in the 398 Bun tests; these counts are not additive. The new map flow contributes 27 assertions per engine (81 total). It includes preserved input nodes and values, binding/preview/selection state, F2 round trips, per-view cameras, native radio keyboard use, pan/orbit gestures, and narrow controls. The existing 36 blueprint assertions were also rerun. The recorded browsers were Chromium 143.0.7499.4, Firefox 144.0.2 and WebKit 26.0. Headless WebKit is not physical-device Safari certification.

The machine-readable [checks](evidence/checks.json), [browser outcomes](evidence/browser-results.json), [domain log](evidence/domain-tests.log) and [repository log](evidence/repository-check.log) retain the exact source, commands and results. The self-contained HTML SHA-256 is `b0593155b6e2143ca5dc36c6608c19421d251826248c8580f5bf5da45c1fc3b8`.

[2D preview](evidence/10-plan-preview-light.png) · [Isometric preview](evidence/11-iso-preview-light.png) · [Layers preview](evidence/12-layers-preview-light.png) · [Current inspector inside a preview](evidence/13-selected-plan-dark.png) · [Mobile inspector](evidence/14-mobile-plan-inspector.png) · [Mobile map](evidence/15-mobile-plan-map.png)

![2D placement preview](evidence/10-plan-preview-light.png)

## Reproduce

```sh
bun install --frozen-lockfile
bun research/blueprints/build.ts
python3 -m http.server 8765 --directory dist/blueprint-research
```

Open the served page, choose Use blueprint, then Preview. Switch among the three views without saving. Zoom or pan in 2D, press F2 twice and check that it returns to the same position. Select a current footprint, switch views, and use Back to return to the unsaved preview.

`python research/blueprints/verify.py` runs the dedicated checks, full repository check and three-engine browser capture. The actual tested commit, exit codes and build hash are in `evidence/checks.json`; individual browser outcomes are in `evidence/browser-results.json`.

## Captures

The follow-up browser flow captures `10-plan-preview-light.png`, `11-iso-preview-light.png`, `12-layers-preview-light.png`, `13-selected-plan-dark.png`, `14-mobile-plan-inspector.png` and `15-mobile-plan-map.png` under `evidence/`. Captures are created by operating the prototype, not drawing replacement mockups. The original RESULTS.md describes the earlier blueprint-only study at its explicitly named commit; this file describes the map-view follow-up.

## Visual-review correction

The first successful browser run preserved preview geometry during current-component inspection but still labeled the map Current architecture. The map context now uses the same retained work mode as the visible draft; the inspector independently identifies the selected current component. This avoids presenting unsaved planned geometry as current architecture. The follow-up run recaptures that actual state rather than adding a test of exact decorative wording.

## Design references

[W3C radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) informs the mutually exclusive native selector. [W3C dragging movements guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) supports keeping click/keyboard alternatives rather than treating a 2D projection as a substitute for accessible interaction. The implementation reuses Groma's [projection](../../src/viewers/web/iso/project.ts), [pointer gestures](../../src/viewers/web/iso/pointer.ts), [orbit calculations](../../src/viewers/web/layers/orbit.ts) and [C4/OKF contract](../../docs/component-markdown.md).
