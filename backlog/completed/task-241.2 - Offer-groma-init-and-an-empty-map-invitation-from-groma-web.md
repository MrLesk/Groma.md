---
id: TASK-241.2
title: Offer groma init and an empty-map invitation from groma web
status: Done
assignee:
  - '@web-editor'
created_date: '2026-09-02 21:16'
updated_date: '2026-09-03 06:09'
labels:
  - cli
  - web
dependencies: []
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
  - init-command
  - commands
  - render
  - web-server
  - page
  - revision-history
  - groma-filesystem
modified_files:
  - src/empty-world.ts
  - src/init-command.ts
  - src/init-command-ui.ts
  - src/cli.ts
  - test/initialize.test.ts
  - src/viewers/web/chrome/empty.ts
  - src/viewers/web/data.ts
  - src/viewers/web/server.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test/init-ui-helpers.ts
  - test/first-run.test.ts
  - test-bun/web-first-run.test.ts
  - docs/product-model.md
  - docs/viewers/web/index.md
  - src/history/git.ts
  - src/viewers/web/chrome/shortcuts.ts
  - src/groma-filesystem.ts
  - src/viewers/web/revision/view.ts
  - test/fixtures/empty-project
  - src/viewers/web/atoms/escape.ts
parent_task_id: TASK-241
priority: high
type: feature
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today groma web in a repository without a Groma directory dies with a stack trace whose last line says run groma init, and an initialized repository with no elements shows blank ground. When a human runs groma web on a TTY in a repository without Groma, Groma asks with the Clack prompt used by groma init whether to initialize now; Yes runs the init wizard and then opens the map, No exits with one line naming groma init. Without a TTY, Groma prints one sentence naming groma init and exits with a non-zero code. With a Groma directory and no elements, the web page shows an invitation instead of blank ground: the project name, one line saying the map is empty, the two ways forward (build something and let the scan find it, or draft the first system) and the Draft control, since there is nothing to select yet. The invitation leaves when the world gains its first element. The decisions "no Groma directory" and "empty world" are one core seam shared with the terminal twins TASK-239 and TASK-240. The init half needs nothing from the storage slice; the Draft control in the invitation needs the draft verb from TASK-241.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a TTY, groma web in a repository without a Groma directory asks with Clack whether to run groma init; Yes runs the same init wizard as groma init and then opens the browser map; No exits with code 0 and one line naming groma init
- [x] #2 Without a TTY, groma web prints one sentence naming groma init and exits with a non-zero code; neither path prints a stack trace
- [x] #3 With a Groma directory and no architecture elements, the web page shows the invitation with the project name, the empty line, the two ways forward and the Draft control, instead of blank ground
- [x] #4 When a scan or a write yields the first element, the map replaces the invitation without a reload
- [x] #5 The no-Groma and empty-world decisions live once in core and are the same functions groma view uses
- [x] #6 Tests cover the non-TTY path, the TTY prompt through the init UI seam and the empty-state decision with fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core seam: src/empty-world.ts holds isEmptyWorld, the one predicate both viewers use for "nothing to draw"; the no-Groma decision is GromaFileSystem.find inside ensureInitialized, and the sentence for a missing directory lives once as NOT_INITIALIZED in groma-filesystem.ts, shared with GromaFileSystem.open.
2. init-command.ts gains ensureInitialized({ repositoryRoot, interactive, viewer }): ready when the directory exists; without a TTY it prints the sentence through the dependencies error seam and reports missing; on a TTY it asks confirmInit through the InitCommandUi seam, runs the existing wizard on yes with the viewer preset, which skips the scan and viewer questions because the caller scans and opens, and prints one line naming groma init on no. init-command-ui.ts adds the Clack confirmInit prompt; the wizard tail moved into offerFirstScan to stay within the complexity limit.
3. cli.ts: groma web calls ensureInitialized before scanning; declined exits 0, missing or cancelled exit 1, no stack trace. groma view keeps its behaviour for TASK-239 to adopt the same function.
4. Web: page.ts renders the invitation section (project title, empty line, the two ways forward, the Draft form on the live delivery) hidden unless isEmptyWorld; chrome/empty.ts paints it on boot and on every world event so the first element replaces it without a reload; data.ts posts the draft input; server.ts adds POST /draft calling draftElement and publishing the world; the published delivery renders the invitation without the form. history/git.ts answers an empty history for a repository without a commit, which the first run exposed.
5. Tests: test/first-run.test.ts covers the non-TTY exit through the CLI and the TTY paths through the init UI seam (helpers shared in test/init-ui-helpers.ts); test-bun/web-first-run.test.ts copies test/fixtures/empty-project and covers the invitation in the page, POST /draft success and refusal, the hidden invitation once an element exists, and the empty history.
6. Docs: product-model.md and docs/viewers/web/index.md describe the first run. Verify in the browser pane and with tui-test, run bun run check, then the reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: src/first-run.ts holds isEmptyWorld, the one predicate both viewers use for "nothing to draw"; init-command.ts gains ensureInitialized (ready, missing with one stderr sentence, declined with one stdout line naming groma init, or the wizard on yes with the viewer preset that skips the viewer question) and the runInitCommand tail moved into offerFirstScan to stay within the complexity limit; the Clack UI gains confirmInit; groma web passes through ensureInitialized before scanning. Web: page.ts renders the invitation section (project title, empty line, two ways forward, Draft form on the live delivery) hidden unless the world is empty; chrome/empty.ts paints it on boot and every world event and posts the form to POST /draft; data.ts carries draft(); server.ts adds POST /draft calling draftElement and publishing the world. Fake init UI helpers moved to test/init-ui-helpers.ts.

Verification: browser pane on an initialized empty repository showed the invitation with the project name and form; submitting "Shop" drafted groma/systems/shop/system.md (status draft, identical to the CLI document), the header counted 1 element, the hierarchy listed Shop, and the card disappeared without a reload; no console errors. First browser pass found the card staying visible after the draft because #empty set display: grid over the hidden attribute; fixed with #empty[hidden] { display: none }. tui-test on a TTY without a Groma directory: n + Enter printed "Run groma init when you are ready." and created nothing; Enter ran the wizard (name, folder, settings, scan) without the viewer question. The accepted path then crashed in git history on a repository with no commit yet ("your current branch main does not have any commits yet"), a pre-existing gap the first run exposes; listGitRevisions now answers an empty history when HEAD has no commit, covered by a web first-run test.

Verification, continued: tui-test on a repository with git init and no Groma directory, accepting the offer: the wizard asked project name, folder and first scan, printed "Initialized Groma project: Fresh shop" and then "groma web at http://localhost:4794"; the viewer question was not asked; the server answered /world.json with 200 on a repository without any commit. Full repository check run alone: Biome 18 pre-existing complexity warnings, TypeScript clean, Node 94/94, Bun 221/221. An earlier check that overlapped with my own tui-test servers timed out two watch-based tests; both pass when nothing else runs.

Cold simplicity review (separate agent, no history): no blocking findings, no defect. Applied: the keyboard shortcut handler moved from render.ts into chrome/shortcuts.ts, bringing render.ts back to 495 lines; page.ts reuses the escaped helper exported from revision/view.ts and the form lost an unused id; the not-initialized sentence lives once as NOT_INITIALIZED in groma-filesystem.ts, shared by GromaFileSystem.open and ensureInitialized; the seam module is now src/empty-world.ts holding only isEmptyWorld, which is what it contains; with a preset viewer the wizard skips the scan question too, because groma web scans right after; chrome/empty.ts keeps one guard; the fake init UI defaults every confirm to no; the straight-through test initializes first and asserts no prompt; the duplicate non-TTY seam test and the predicate unit test were dropped; the Bun test copies the new fixture test/fixtures/empty-project and anchors on the section and the escaped title only; product-model.md no longer says groma web never reaches the init reconciliation and points to the browser map doc for the invitation details. Not applied: importing the shared run helper from test/cli-helpers.ts into the Bun test, a pre-existing pattern across test-bun.

Browser check after the extraction: dispatched key events on the live page zoomed to 125 percent on plus, fitted back on 0, toggled the chrome on F1 and back, with no console errors, and the invitation stays hidden once the world has an element.

groma view now passes through the same ensureInitialized door as groma web, with the prompt only when a terminal is interactive and neither --plain nor a record target was asked for; groma view --plain and groma view <id> without a Groma directory print the one sentence and exit 1 (test/first-run.test.ts). This makes AC5 literally true and covers the init offer TASK-239 describes; its terminal empty state (TASK-240) stays with the TASK-238 agent.

Specification review: AC1 tui-test on a TTY without Groma showed the Clack question; Enter ran the wizard (name, folder) and then groma web printed its URL and answered /world.json, n + Enter printed "Run groma init when you are ready." and created nothing, and test/first-run.test.ts proves declined, accepted and cancelled through the init UI seam. AC2 test/first-run.test.ts spawns groma web without a Groma directory and without a TTY: exit 1, one stderr line naming groma init, no stack frame. AC3 test-bun/web-first-run.test.ts and the browser pane: the section renders unhidden with the escaped project title, the empty line, the two ways forward and the form on the live page; the published delivery renders it without the form. AC4 the browser pane showed the card gone and the drafted Shop island painted after submitting, with no reload and no console errors; the Bun test shows the section hidden once an element exists. AC5 isEmptyWorld lives once in src/empty-world.ts and ensureInitialized once in init-command.ts; groma web and groma view both call ensureInitialized, and the page uses isEmptyWorld on the server and in the browser. AC6 Node tests cover the non-TTY CLI exit and every TTY outcome through the seam; the Bun tests copy test/fixtures/empty-project for the empty-state decision, the draft round trip, the refusal and the empty history.

Quality review: no reproducible defect in the supported flow after the hidden-rule and empty-history fixes; ownership is clear (door in init-command, predicate in empty-world, invitation in chrome/empty, route in server); every new behaviour and refusal has a test; render.ts is back under 500 lines and the new functions stay under the complexity limit.

Full-context complexity review (separate agent): one minor defect at the edge of AC3 and AC4, fixed: the invitation and its form were painted for a selected historical revision whose tree was empty; the page now hides the section whenever a revision is selected, on the server and in the browser, covered by the Bun test. Also applied from that review: the wizard preset is now opensViewer: true instead of a viewer name that only signalled its own presence; Ctrl+C at the offer prints the same "Initialization cancelled." line as the wizard; the HTML escape helper lives in atoms/escape.ts and revision/view.ts and page.ts share it. Material recommendations for the owner, not applied: decide whether a git repository is a declared supported assumption for groma web and groma view (today an initialized directory that is not a git repository still dies with a stack trace from the TypeScript scanner, pre-existing and outside this task); when the next verb lands, replace the per-verb server handlers with one POST /<verb> dispatch over the core writers. Noted, not applied: a malformed POST /draft body answers 400 with a TypeError text instead of the CLI sentence; unreachable from the form.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma web and groma view now pass through one door, ensureInitialized in init-command.ts: with a Groma directory nothing changes; without one, a TTY gets the Clack question "Groma is not initialized here. Initialize now?" (yes runs the init wizard for identity and storage and the command scans and opens, no prints one line naming groma init and exits 0), and a non-TTY prints the one NOT_INITIALIZED sentence shared with GromaFileSystem.open and exits 1, never with a stack trace. While the world has no elements the browser map shows an invitation with the project name, the empty line, the two ways forward and a Draft form that posts the same input as groma draft system to the new POST /draft route; the first element replaces it without a reload, and a selected historical revision never shows it. A repository without a commit yet serves an empty history instead of crashing. Verified with the browser pane (invitation, draft round trip, card gone, shortcuts intact, no console errors), tui-test on a real TTY (decline, accept through to a live server), Node and Bun tests for every path, and bun run check (Node 93/93, Bun 221/221, TypeScript clean, only pre-existing Biome warnings).
<!-- SECTION:FINAL_SUMMARY:END -->
