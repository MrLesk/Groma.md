# Blueprint placement: findings and production gates

TASK-324 · isolated research branch · baseline `0e1252c92a90ef87b30d4fb5cfa56e768d436fea`.

## Result and boundary

This experiment implements one end-to-end interaction: choose a bundled saved-card blueprint, copy its inert text, paste into another fixture project, bind existing participants and a host container, preview on Groma’s actual map, and explicitly create an independent fixture draft. The browser persists one complete fixture state in localStorage. It does not write production Groma architecture, call a scanner, establish source matches, or implement a network store.

The actual implementation and automated execution matter more than a polished static picture. `evidence/browser-results.json` records assertions, engine versions and failures; `evidence/checks.json` records repository and focused-check exit codes and the tested source commit. Screenshots are captured at the states reached by `capture.py`, rather than assembled in an illustration tool.

## What the implementation clarified

### 1. Placement is binding, including the parent

The early schema sketch named a new part’s parent without declaring that attachment point. This prototype requires an explicit container role. A new component cannot be previewed until that role resolves to an existing internal container. Groma’s unchanged composer then calculates the placement; no pixel coordinates travel in the blueprint.

Shop can suggest an exact, unique title match. Market deliberately uses a different name and has several component candidates. It leaves Checkout unbound instead of inventing a probability or treating a name as proof of responsibility. Suggestions and chosen bindings are visible before confirmation. In this experiment, roles have exact C4 kinds; arbitrary component-to-container substitutions and many-to-one bindings are unsupported.

### 2. Draft-owned participation is smaller than modifying every current element

The previous proposal suggested changing singular `groma.draft` into a list on current components. That is not necessary to prove overlapping placement. Here, each draft owns its role-to-element bindings and its proposed relationships. The current element remains byte-for-byte unchanged; an inspector derives its draft participation by reading the drafts.

Repeated paste creates two independent local drafts, both of which can bind Checkout. New part IDs are distinct. This supports a smaller production proposal: evaluate draft-owned membership before adding duplicated membership metadata to current elements. The production schema is not changed by this experiment.

### 3. A proposed interaction is not implementation evidence

Every new relationship is concept-linked and belongs to its own draft. Mechanism is unspecified unless the pattern actually requires one; the prototype does not invent `HTTP` or file names. These relationships enter only the active draft’s projected view. Existing current interactions remain untouched.

Creating a draft is not accepting a ghost, matching code, testing requirements, or proving a relationship. Source association and the relationship acceptance policy remain production gates. A design claim should not be erased merely to make a file-level evidence record fit; explicitly specify how intent and evidence relate before integrating them.

### 4. Copy means an independent snapshot

The transported pattern has blueprint-local keys, an outcome, requirements, typed roles, new parts, and relationships. It contains no receiving-project IDs, paths, source references, task IDs, lifecycle acceptance, map coordinates, or scanner results. Import rejects undeclared fields rather than carrying arbitrary repository metadata through.

A placed draft retains the validated original pattern. “Copy original intent” copies that snapshot, not the local implementation. This is intentionally narrower than extracting a reusable blueprint from an edited draft or arbitrary current architecture. There are no linked instances or automatic upstream updates.

### 5. Preview and save are different operations

Preview constructs a new candidate without mutating the input. Cancel leaves no draft. Create validates the bindings again and writes one complete fixture value; storage refusal leaves the in-memory project unchanged. A previously saved change from another tab makes the stale preview fail visibly without deleting its input.

The first implementation could refresh the baseline while keeping stale in-memory project data. A new regression test failed on that version. Placement now reloads one stored snapshot, and commit verifies that its project actually matches the saved snapshot. Browser checks also follow the displayed cancel/re-preview path and verify that the other tab’s draft survives.

This is not a database transaction or a filesystem transaction. The localStorage baseline check detects sequential staleness; it is not a compare-and-swap and does not certify simultaneous-tab writers. Production needs a core-owned validate-and-commit operation against a versioned architecture snapshot. The browser must not simulate that with a chain of `add`/`edit` requests.

### 6. The store can remain a thin discovery layer

One bundled, honestly labeled catalogue entry is enough to test discovery, preview, copying and application. No fake download counts, ratings, verified badges, algorithmic compatibility scores, accounts, publication, purchases or remote search are shown. The same import operation serves catalogue selection and clipboard text.

The result supports validating the local clipboard loop before building public distribution. It does not establish demand, author quality, moderation cost or usability with real maintainers; those need observed use, not more unit tests.

## OKF and C4

A blueprint is supporting architecture knowledge, not a new C4 element or hierarchy level. Its roles bind to current C4 elements; its new parts instantiate components. The blueprint itself never becomes a system box.

Inspect Markdown renders `type: Groma Blueprint`, standard title and ordinary Markdown prose/tables for the outcome, requirements, roles, parts and interactions. Groma-specific format/release metadata stays under `groma`. A plain Markdown reader can understand the intended change. Groma interprets role keys, C4-kind constraints, parent attachment, local identities and draft lifecycle.

The bounded JSON clipboard envelope is an internal research transport, not an approved replacement for Groma’s OKF storage. Production must choose and test one canonical readable package before freezing an interchange format. This prototype neither imports generic OKF bundles nor migrates historical formats.

## Safety and scope

“Inert” does not mean trustworthy. This prototype rejects unknown executable/source fields, limits input size and renders imported text through escaping. It does not execute hooks, generate source, fetch external resources, or ask an agent to implement imported instructions. There is no security certification.

Before public distribution, review hostile text and link handling, oversized/decompression payloads if compression is introduced, publication leaks in prose, licensing/attribution, impersonation, and prompt injection when agents read downloaded requirements. Store authors are not authorities over repository or agent instructions. A future extraction preview must explicitly review prose and attachments as well as removing structured source fields.

The local UI distinguishes fixture draft storage from current Groma edits. It preserves the original Groma palettes, lockup, sheet composition, painter and camera; the catalogue/inspector shell is research code. There is no implementation of arbitrary diagram drawing, general parameters, a template language, undo history, accounts, dependency upgrades, private registries, payments, or collections.

## Validation and review

Focused domain tests cover portable text, Unicode, invalid keys/parents/endpoints, bounded inputs, ambiguous binding, immutable preview, source/identity preservation, fresh IDs, independent repeats, snapshot copying, save refusal, sequential stale preview and projection immutability. Browser tests cover the live controls, actual Chromium clipboard, reload, cancellation, invalid paste, overlap and narrow layout. Firefox and WebKit test explicit text import through save/reload. WebKit automation is not physical Safari testing.

Repository checks remain unchanged. The dedicated research TypeScript project and nested Biome configuration check files outside the production entry graph. Test data is under `test/fixtures/blueprint-research/`; no live project architecture is loaded. Automated browser assertions test state and supported interactions, not decorative text. Captures are visual evidence for review, not screenshot-diff tests.

The implementer reviewed scope, identity allocation, state transitions and copy/commit boundaries. The model, binding logic and renderer adapter are separate and small. Existing Groma renderer modules are imported rather than copied or forked. There was no independent-agent review or human usability study; do not describe this prototype as production-approved.

## Next production gate

Approve one hand-authored target example of the same placement in ordinary Groma Markdown. Specify where a draft owns role bindings and concept-level planned relationships, without rewriting current explanations. Then implement one core preview/commit operation with a real atomicity/version boundary and tests that reload its written architecture through the existing reader. Only after that should the main viewer expose this placement flow.

The following gates are ordered, not implemented commitments:

| Gate | User-visible proof |
| --- | --- |
| Model | A copied blueprint creates one readable local draft with correctly bound existing parts and valid new-part parentage. |
| Core write | Failed validation or concurrent change cannot publish a partial architecture; reload matches the confirmed preview. |
| Viewer | Native/manual paste, binding, preview, cancel, create, and reopening the saved draft work in the actual live viewer. |
| Extraction | Export from a reviewed draft removes local identities/evidence and exposes prose for publication review. |
| Discovery | A small curated catalogue distributes exact licensed snapshots through the same importer; no account required for offline use. |
| Broader patterns | Add another C4 level, parameters or external declaration only with an approved example that requires it. |

## Primary references

Repository contracts: [architecture Markdown](../../docs/component-markdown.md), [product model](../../docs/product-model.md), [web viewer](../../docs/viewers/web/index.md), and [repository instructions](../../AGENTS.md). These explain current behavior, not the research format.

External design precedents: [Factorio blueprints](https://wiki.factorio.com/Blueprint), [blueprint library](https://wiki.factorio.com/Blueprint_library), [C4 components](https://c4model.com/abstractions/components), [OKF 0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md). Tooling references: [Playwright Python browser installation](https://playwright.dev/python/docs/browsers), [Biome nested project configuration](https://biomejs.dev/guides/big-projects/).

## Visual-review correction

The first captured narrow layout showed persistent save feedback covering the footer actions, despite a passing viewport-bounds assertion. The redundant save message was removed. Copy feedback now occupies an ordinary inspector row rather than overlaying the controls, and a repaint dismisses the old feedback. Browser validation now hit-tests the action buttons while that message is present. This checks the observable ability to act rather than decorative placement.

The follow-up browser run also exposed delayed clipboard feedback arriving after a repaint. Copy completion now checks the view generation before announcing. The mobile check explicitly waits for feedback to appear before hit-testing, so a hidden message cannot produce a vacuous pass.
