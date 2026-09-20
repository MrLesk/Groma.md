# Git comparison and revision-source plugins

Implementation plan, 19 September 2026. Product rules below are confirmed by
Alex. Implementation choices are recommendations for review. This document
does not authorize implementation or create Backlog tasks.

The separately requested removal of the direct Open PR integration is tracked
in TASK-445. The web app now uses ordinary Git revision browsing; comparison
and the optional GitHub revision source below remain planned work.

## Confirmed product rules

- Opening Groma shows the current working tree with comparison off, including
  when there are uncommitted changes. Existing selection, task, and flow
  emphasis remains independent of comparison.
- The time machine remains ordinary navigation through saved revisions.
  Selecting a commit does not enable comparison or choose its parent.
- Comparison starts through an explicit user action. It compares a selected
  Git state against a specific commit.
- Local changes mean the working tree compared with the latest commit on
  the checked-out branch.
- Branch comparison means the selected branch's latest commit compared with
  the base branch's latest commit. It does not substitute a common ancestor.
- A selected commit can be compared with another selected commit or with the
  current working tree. The user chooses the other side.
- Basic Git is sufficient for the default experience, regardless of hosting.
- GitHub is an optional plugin that contributes branches and pull requests to
  the existing selector. It adds no header control. Groma core does not know
  GitHub API shapes, authentication, URLs, or PR ref conventions.
- The first GitHub delivery covers discovery and comparison. Creating PRs,
  submitting reviews, merging, and other remote write actions are outside it.
- Remove the current Open PR implementation completely, including its header
  control, dialog, PR panel, GitHub reader, server and URL paths, payload fields,
  map highlights, and PR-only tests and documentation. The future GitHub plugin
  contributes choices to the common revision selector.
- During comparison, the map itself distinguishes added, edited, and removed
  architecture through different colors. Do not add change-status labels or
  badges to map components; the Details pane spells out Added, Edited, and
  Removed. Component names and existing task markers remain independent.
- Comparison also exposes file/code diffs in the existing right-hand Details
  pane, which already opens for a component or task, with the
  same interaction quality as Backlog task diffs. Share useful change-review
  behavior between Backlog and Git instead of developing two separate systems.
- A task's existing changes section has an explicit Review changes action.
  It opens the common comparison with that task's versions and recorded files.
  Within an active comparison, focusing a task narrows the displayed changes
  without changing the chosen versions. Clearing task focus restores the full
  comparison.

## Current implementation and ownership

| Existing owner | Relevant behavior | Planned change |
| --- | --- | --- |
| `src/history/revisions.ts` | Reads Git revisions and temporary committed snapshots; history is filtered to architecture-directory changes | Reuse snapshot loading; allow exact commit resolution and history that includes source-only commits |
| `src/viewers/web/revision/` | Navigates between the live map and one historical map | Preserve ordinary navigation; add explicit comparison selection and state |
| `src/viewers/web/map-session.ts` | Owns HTTP reads, live events, snapshots, and work subscriptions | Delegate revision/comparison requests to a focused session; inject source implementations |
| `src/viewers/web/data.ts`, `payload.ts` | Browser delivery boundary | Carry provider-neutral selection and comparison results |
| `src/viewers/source/diff.ts`, `diff-lines.ts` | Task-specific endpoint selection and unified text diffs | Keep task endpoint/file-scope selection separate; share the neutral change result and file-diff projection |
| `src/viewers/web/task-diff/` | Task summary, changed-file rows, source context, unified code diff, and back navigation | Keep the task summary wrapper; extract common change rows, code-diff rendering, and inspection navigation for both entry points |
| `src/work/pins.ts` | Maps task file lists and references to affected elements; displays work and assignees | Preserve work markers; use computed Git changes separately for actual add/edit/remove status |
| `src/viewers/web/map-highlights.ts` | Coordinates selection, component neighbors, task emphasis, and active flows | Give comparison statuses their own paint input; do not represent every change as a selected element |
| `packages/work-source/`, `plugins/work-sources/backlog/` | Shared contract and provider implementation, connected by the host | Follow this dependency direction for revision sources |
| `src/viewers/web/settings/` | Existing Plugins settings entry | Add revision-source setup here |

Backlog already demonstrates the important boundary: the contract contains
common data and lifecycle operations; the plugin owns provider access. Its
watching and task-specific fields are not requirements for revision sources.

## One view model, with comparison optional

Use an exact commit identity or the working tree as the viewed state. Branches
and PRs are ways to discover those states, not additional snapshot kinds.

Conceptual state, not a finalized public TypeScript API:

```ts
type GitState = { kind: 'working-tree' } | { kind: 'commit'; sha: string }

type RevisionView = {
  target: GitState
  comparisonBase?: { sha: string }
}
```

With no `comparisonBase`, render the ordinary target map. With a base, compute
the change from that commit to the target. Keep display labels, branch context,
and the selected comparison presentation outside the identity itself.

| Action | Base | Target | Comparison |
| --- | --- | --- | --- |
| Open Groma | None | Working tree | Off |
| Open a historical commit | None | Selected commit | Off |
| Open another branch for browsing | None | That branch's resolved latest commit | Off |
| Compare local changes | Resolved current HEAD | Working tree | On |
| Compare branches | Resolved base-branch latest commit | Resolved selected-branch latest commit | On |
| Compare viewed commit with another commit | Other selected commit | Viewed commit | On |
| Compare viewed commit with working tree | Viewed commit | Working tree | On |
| Stop comparing | Clear base | Keep target | Off |

Always display comparison direction. When working tree is chosen as the other
side of a historical view, it becomes the target and the historical commit
becomes the base. Do not silently reverse added and removed meanings.

Ordinary navigation clears comparison. Endpoint selection inside the explicit
comparison flow changes that endpoint. Canceling a picker changes neither.
Closing comparison retains the target as an ordinary view; returning to
Working tree is the same existing navigation action.

Resolve mutable branch names to full SHAs when the user applies a comparison.
Keep those commits fixed until an explicit refresh/reselection. Show both names
and resolved hashes in the open selector. Reading a branch must not check it
out, stage files, create a commit, or alter the user's working files.

Reuse `revision=<sha>` for the target and add an explicit base identity for a
comparison. An absent target revision still means Working tree. A copied
working-tree URL refers to local state, not a portable immutable snapshot.
URL restore, reload, and navigation must preserve the distinction between an
ordinary historical view and a comparison.

## One selector, with clear interaction intent

Keep the existing revision control in its current header position. In ordinary
viewing it identifies the working tree or selected commit; branch context,
the checked-out branch, and the latest/selected commit markers belong in its
open menu. An uncommitted-file count is information, not comparison activation.

The menu has ordinary snapshot navigation and one explicit Compare with action.
That action changes the same popover into an endpoint picker. Its heading
identifies the endpoint being selected. Working tree, Latest commit, branches,
and history provide concrete choices; it must not offer an ambiguous generic
Current revision as both the working tree and HEAD.

Local changes can be a shortcut that preselects Working tree and Latest commit.
Branch comparison shows the selected two branch tips. A PR entry proposes its
base/head pair. In each case the same compact comparison editor displays the
direction and applies the selection. There is no GitHub modal, provider toolbar,
or extra header button. Source names are labels in the picker, supplied through
the shared contract.

During comparison, the existing control's label shows both sides. Its popover
contains endpoint editing, Refresh, and Stop comparing. Comparison presentation
controls and the change tree belong to the existing left-hand Hierarchy pane.
Opening a component or task uses the existing right-hand Details pane. Its
changes section opens a file diff in that same pane, using the existing wider
file-reader state and Back navigation. These are different contents of the two
existing panes; there is no additional comparison panel.

Before coding the UI, use one consistent example to review the closed header,
ordinary history menu, comparison picker, added/changed/removed map, and removed
file details. These are states of one flow, not competing design alternatives.

## Local Git comparison

The local Git reader owns repository facts: current branch and HEAD, branch
refs, commit metadata, changed paths, file contents, and commit availability.
The comparison model consumes these facts and two architecture snapshots.

- Commit to commit uses the exact two commit trees. Branch review is a direct
  tip-to-tip diff. No merge-base calculation is hidden in this path.
- Commit to working tree compares the committed contents with current files.
  Include the net result of staged and unstaged edits and non-ignored untracked
  files. The staging area is not a third selectable snapshot in this delivery.
- Preserve rename old/new paths from Git and resolve ownership separately on
  each side. A renamed file is not automatically a renamed component.
- Read change summaries first and text hunks when a file is opened. Reuse the
  existing unified-diff presentation. Binary changes have status without
  fabricated text hunks or line counts.
- Read local and remote-tracking branches available in the repository. A
  remote-tracking branch is the locally fetched ref, not a promise of the
  hosting service's current latest commit. Identify its remote in the label.
- Plain working-tree viewing remains live. For working-tree comparison,
  refresh changes and architecture together through the local revision
  session. Reuse source/architecture invalidation and add the Git-state
  invalidation needed for commits and changed files outside scanner coverage.
  A manual Refresh in the selector uses the same path. Do not poll GitHub to
  keep a local working-tree comparison current.
- Commit comparisons ignore working-tree events. A newer request, leaving
  comparison, or changing endpoints invalidates older asynchronous results.
  Apply the map, change list, counts, and selection context together.

History must expose source-only commits for selection. Keep ordinary
time-machine behavior, but remove the assumption that a commit is usable only
if it appears in the architecture-directory log. Validate the selected commit
and load its actual architecture instead of borrowing today's architecture.

The initial supported architecture contract remains stored, readable Groma
snapshots at the compared commits. A source file absent from stored ownership
is reported as unmapped. An unavailable or unreadable architecture snapshot is
reported explicitly and must not be treated as an empty architecture, which
would falsely report mass additions/removals. Historical rescanning is a
separate product decision; it must not be introduced silently here.

## Change meaning and map presentation

Keep file changes, architecture-element changes, and relationship changes
distinct. Match elements using existing architecture IDs and use each side's
exact source ownership.

| State | Rule |
| --- | --- |
| Added element | Its ID exists only in the target architecture |
| Removed element | Its ID exists only in the base architecture |
| Changed element | Its ID exists on both sides and owned code, membership, or meaningful architecture content changed |
| Unchanged element | No direct change in the compared evidence |

Adding or deleting a file within a surviving component marks that component
changed. A surviving empty component is not removed merely because its last
source file was deleted. Title and parent changes retain identity when the ID
is unchanged. Do not infer identity matches from similar names or file paths.

Compare meaningful architecture values, not derived layout coordinates,
serialization order, or camera state. Report the reason for change in details:
code, source membership, name, parent, description, lifecycle, or another
stored architecture property. Compare relationships separately through their
existing endpoint/statement representation. A changed relationship does not
prove a code change in either endpoint or a downstream effect.

Recommended comparison presentation, to validate visually before UI coding:

- The existing left pane becomes a change tree with system/container ancestry,
  component statuses, and separate unmapped files. Counts identify whether
  they count elements or files and do not double-count ancestor summaries.
- The default comparison presentation is Changes: additions, changes, and
  removals are visible together. Before and After are exact snapshot views
  available inside that pane. These controls exist only during comparison.
- Removed elements stay selectable in the change list in every presentation.
  Their details and file removals read the base snapshot. Added elements read
  the target snapshot. Absence on one side never silently redirects source
  inspection without identifying which side is shown.
- Map components communicate comparison status through color, with the
  status words in the Details pane. Selection, draft styling, task markers,
  flow emphasis, and comparison status remain distinct.
- Preserve the current interaction highlight: green in the light/dark themes
  and pale blue-white in Blueprint. The map already uses it for selection,
  task emphasis, and active flows (`atoms/theme.ts`, `iso/style.ts`). Do not
  reuse it to mean added, or pass changed elements through `map.select`.
- Use dedicated change-status tokens shared by map statuses and file badges.
  The proposed palette is blue for added, amber for edited, red for removed,
  and neutral for unchanged. This is a candidate for visual validation, not
  a confirmed palette. Do not copy the code-line diff tokens onto map geometry
  or borrow syntax-highlighting colors. Check all three existing themes.
- Give change status and interaction emphasis separate visual treatments.
  Component treatment: a restrained status tint, while selection keeps its
  existing outline. Do not place Added, Edited, or Removed badges on the map
  components. Selecting a component must leave its change tint visible. The same
  distinction must hold when selecting a changed relationship. Verify these
  combinations in the actual map before accepting the colors or treatment.
- Code hunks keep their ordinary added/removed line treatment. An edited file
  can contain both added and removed lines; in the light/dark themes these
  remain green and red. File/component status is separate from the code-line
  convention. There is no third kind of edited code line.
- Use a temporary comparison presentation that contains removed elements and
  required parent context. Preserve the immutable base/target worlds. Keep
  one identity per element, use target containment for surviving elements,
  and show previous containment in details for a move.
- Keep camera and common-element placement stable within the comparison
  where the layout allows it. Prove the added/removed/moved example before
  committing to a layout algorithm. Do not change the ordinary map's layout
  contract to make the comparison view work.

## Shared changes with Backlog

Use one internal change result, provisionally called `ChangeSet`, for the
resolved base/target, file changes, ownership on both sides, and architecture
changes. It is temporary application data, not a stored record or new plugin
family. File hunks can still load on demand through this result's exact
endpoints. Task and Git entry points choose the input; the shared comparison
and presentation code owns the meaning of the result.

| Entry point | Chooses the compared versions | Chooses the file scope |
| --- | --- | --- |
| Explicit Git comparison | User-selected commit and commit/working tree | All changes between those versions |
| GitHub branch/PR selection | Plugin resolves the user's selection to exact commits | Same complete Git diff as local comparison |
| Active Backlog task changes | Preserve the existing current-HEAD to working-tree task rule | Task's recorded modified files |
| Completed Backlog task changes | Preserve the existing matching-task-commit and parent rule | Task's recorded modified files |

The completed-task rule is an existing task adapter policy. It does not make
ordinary time-machine selection compare with a parent. The Backlog plugin
continues to supply work records through `WorkSource`; it does not acquire Git
or architecture responsibilities. The GitHub source similarly supplies
revision choices, not change painting or task data.

The shared inspection flow is:

1. Open a change review from a comparison or a task's changes section.
2. See component statuses on the map and the same statuses in the change tree.
3. Select a component to see its changed files in the existing right-hand
   Details pane.
4. Select a file to read the common unified diff, old/new line numbers, paths,
   counts, and exact before/after context.
5. Go Back to the same component/task and preserve selection and scroll.

Use the existing task diff viewer as the starting implementation. Extract its
file rows, hunk rendering, source-context display, and drill-down behavior into
small shared view functions. Task title, status, checklist, description, and
comments remain in the task wrapper. A Git comparison supplies its range and
summary around the same change view. Neither wrapper invents its own status
colors, file classification, or map-change calculation.

Confirmed interaction for bringing task changes onto the map: an explicit
Review changes action inside the task's existing changes section opens the
shared review with the task's endpoints and file scope. Show those endpoints
in the same revision control. For a completed task, this opens its historical
target map; do not paint an old commit's additions/removals onto today's map
as though the current map were that commit. Keep the selected task's metadata
in the review wrapper, independently of the historical architecture world;
this does not imply showing today's task pins throughout that historical map.
Ordinary task selection and pins remain available without changing the
revision or enabling Git comparison.

When a Git comparison is already active, focusing a task means focusing the
intersection of that comparison's changed paths and the task's modified-file
list. Keep the comparison endpoints fixed and identify the task scope in the
existing right-hand Details pane. Clearing the task focus returns to the full comparison.
Do not stack a second task-specific comparison over the first one. Opening
the task's own historical changes is a separate explicit action.

Keep evidence and work association honest:

- A task reference or planned change can place a work marker without proving
  that the component's code changed. It must not create an edited status.
- A recorded task file can be unchanged between the chosen versions. Keep
  that fact visible in task context and do not color its owner as edited.
- Active tasks can share modified files. Preserve the existing Shared
  indication. A path association cannot prove which task or person authored
  individual lines, so do not label the entire patch as exclusively theirs.
- A task file scope selects known file changes. References alone do not
  attribute unrelated architecture or relationship edits to that task. Keep
  those as contextual work links unless its recorded changes establish them.
- A removed file maps through its previous owner. Removed component details
  and hunks remain available from the base, through the same inspection path.
- Work-pin/assignee colors describe work identity. Add/edit/remove colors
  describe a Git change. One must not overwrite the other.

Map and panel must consume the same applied change result and scoped
projection. Loading a newer task list, diff, or working-tree generation must
not leave the map showing one range while the Details pane shows another.
Only one change review owns the map's change-status layer at a time.

## Revision-source contract and dependency boundary

Add a small shared contract in `packages/revision-source/`. The concrete user
need for the contract is to put local branches and GitHub branches/PRs into the
same selector without putting provider logic into comparison or rendering.

A source needs only these operations for this delivery:

| Operation | Result and reason |
| --- | --- |
| Read readiness | Whether this source can be used, plus a source-owned setup/error message |
| List supported collections | Branches and, where supported, review requests; provider labels stay with the source |
| List entries | Small display records with opaque source IDs, search input, and paging where needed |
| Resolve an entry | An exact target commit and, for a review request, a proposed exact base commit; required Git objects are available locally before success |

Resolve is explicit because selecting a remote entry may need network access
and Git object acquisition. Listing entries must not fetch every branch's
objects. Source entry IDs and paging tokens are opaque to the consumer.

A branch resolves to one commit. A PR resolves to a proposed pair, which the
comparison UI displays before application. The user can replace either commit.
The plugin never returns architecture highlights or a provider-calculated file
diff; Groma's same comparison path computes those results.

Use a built-in local Git source in `src/history/`, using the existing Git
reader. Add an optional `plugins/revision-sources/github/` package. The
application composition point registers sources and passes them into the web
host, like injected work sources. Core comparison, payloads, and the selector
must not import that GitHub package or branch on the string `github`.

GitHub-specific code may exist in the adapter and the application registration
that connects it. Credentials, URL parsing, host/repository selection, API
pagination, and PR refs belong to the adapter. The host renders common source
data and source readiness states.

Recommend shipping the adapter with Groma and making it opt-in, following the
embedded Backlog delivery pattern. This does not require a plugin marketplace,
a new executable plugin loader, or scanner installation changes.

## GitHub delivery as its own workstream

### Setup and repository selection

- Enable GitHub in existing Settings > Plugins. Local Git stays enabled and
  usable with no GitHub plugin, no `gh`, and no network.
- Recommend reusing the authenticated GitHub CLI for the first adapter.
  Only this plugin requires `gh`; no OAuth application or token form is needed
  in Groma. Setup reports a missing CLI or sign-in requirement in plugin settings.
- Select the repository from this checkout's GitHub remotes. Show repository
  identity clearly and let the user select when several relevant remotes exist;
  do not assume `origin` is the intended upstream.
- Store non-secret source enablement per local repository, using a small
  source configuration owned by the delivery layer. A Git-local configuration
  entry is the recommended first storage location. Keep credentials in `gh`;
  do not add provider configuration to architecture Markdown or scanner config.
- Validate one GitHub host and repository flow first. Additional host support
  needs its own declared validation; no claims of broad enterprise support.

### Branch and pull-request discovery

- Add source-labelled GitHub branches and Pull requests inside the existing
  picker. Distinguish a local branch, a remote-tracking branch, and a live
  provider branch even when their short names match.
- Branch entries need a name and commit identity. PR entries need number,
  title, state/draft marker, head/base branch context, and a link to the PR.
  Do not collect comments, reviews, checks, or avatars for this flow.
- Start with open PRs and provide an explicit state filter for closed/merged
  review discovery. Fetch pages on demand and expose whether more entries
  remain. Search must not silently mean only the first fetched page.
- Use the GitHub API's search where appropriate for PR lookup. Branch-name
  search must account for the branch endpoint's pagination; specify and test
  how complete results are obtained before calling the search complete.
- Refresh source metadata when requested. An active comparison keeps its
  resolved commits until the user applies a refreshed selection.

### Resolve and load the comparison

1. Read the chosen PR's head commit and base branch identity.
2. Resolve the base branch's latest commit, following the confirmed tip-to-tip
   rule. Do not substitute the merge base, a synthetic merge commit, or assume
   that a cached PR record still describes the latest branch state.
3. Fetch only missing selected commits into Groma-owned Git refs, including
   the documented PR head ref for fork PRs. Fetch does not switch branches or
   change the user's index/working tree or their existing branch refs.
4. Verify the acquired objects match the resolved SHAs. If the source changed
   while resolving, report that the selection needs refreshing instead of
   quietly comparing different commits.
5. Return the common resolved pair. The same local comparison path loads
   architecture, reads the Git diff, maps ownership, and renders the result.

This result can differ from GitHub's Files changed page because Groma uses the
explicit tip-to-tip rule. The picker/details must identify its exact base and
target. Do not call it an identical reproduction of GitHub's PR diff.

Avoid the GitHub PR-files endpoint as the comparison's source of truth: it can
describe a different base and has provider-specific completeness limits.

### Operational behavior required for discovery

- Account for authenticated private-repository reads as well as public repos.
- Represent sign-in, permission, network, rate-limit, and unavailable-ref
  failures in the affected source/picker. Local Git and the existing map stay
  available; a failed selection never replaces them with a partial comparison.
- Respect pagination and do not report partial lists as complete. Keep opaque
  source IDs stable across pages and distinguish fork repositories.
- Provide explicit Refresh; do not add background polling, webhooks,
  automatic retries, or PR write actions to this delivery.
- Stop in-flight source work when its session closes and ignore outdated
  responses after the user changes selection. Define cleanup for Groma-owned
  temporary refs without touching user refs.
- Check packaged CLI delivery as well as execution from source. Include the
  new workspace package and browser-safe common types in the build boundary.

## Delivery sequence and acceptance gates

These are planned implementation slices, not existing Backlog task IDs. Create
and connect their Backlog tasks when implementation is requested.

| Slice | Deliverable | Acceptance gate |
| --- | --- | --- |
| 1. State and visual flow | One connected flow for ordinary working tree, ordinary history, and explicit comparison; shared state model | Human can distinguish viewing from comparing and identify both endpoints without an extra header control |
| 2. Local comparison | Exact commit resolution, all relevant history, working-tree/commit diffs, local branch source | Dirty default and time machine stay plain; each explicit local comparison has the requested endpoints |
| 3. Shared change projection and UI | Common change result, ownership on both sides, map status palette, change tree, shared file-diff inspector, and Backlog task scope | One hand-authored example shows addition, modification, removal, and unmapped files; Git and task review produce the same status/diff for the same endpoints and files |
| 4. Shared source integration | Public contract, host injection, settings and generic picker collections | Local source and an in-memory test source use the same interface; consumer code needs no provider-specific condition |
| 5. GitHub setup and branches | Optional adapter, CLI readiness, repository choice, paginated branch discovery, exact commit acquisition | A GitHub branch opens through the existing picker; disabling the adapter restores basic-only discovery |
| 6. GitHub PR discovery | PR list/search/state, fork head acquisition, base-tip resolution, common comparison application | A real supported PR and a fork PR reach the same comparison engine with verified SHAs |
| 7. Finish and verify | Check the provider boundary, update docs, validate source and compiled delivery | No separate PR UI or GitHub-specific comparison path exists in core; ordinary browsing and Backlog behavior still work |

Give slice 3 a stable typed data boundary before changing rendering. Slices 5
and 6 are substantial provider work, not a small addition to the local feature.
Build and obtain feedback on the local example before expanding provider work.
Within slice 3, first extract the existing task diff view with its behavior
preserved, then connect Git comparison, then add task-scoped map review. This
order makes sharing observable and avoids a second temporary diff viewer.

Final module placement should remain small: existing `src/history/` for Git
facts/snapshots; a focused comparison domain for pure change projection;
`src/viewers/web/revision/` for view state and selection; comparison presentation
beside it; the shared source package and GitHub adapter. Split responsibilities
out of `render.ts` and `map-session.ts` rather than making those entry points
own the entire feature. Keep source/test files at or below 500 lines.

Remove the old GitHub implementation directly when its replacement works.
Do not add compatibility adapters, legacy URL handling, or migrations.

## Verification

Automated architecture examples must come from minimal `test/fixtures/`
worlds, with each concurrent test owning its temporary Git repository. Test
behavior and invariants, not exact labels, colors, prose, or screenshot pixels.

Required cases:

1. Clean and dirty default working tree: no comparison state or comparison paint.
2. Historical selection: exact ordinary snapshot, no implicit parent comparison.
3. Explicit base selection and exit: correct direction, URL restore, and no
   stale response reactivating comparison after exit.
4. Working tree against current HEAD and an older commit, including net staged/
   unstaged edits, untracked additions, and removals; user Git state is unchanged.
5. Branches whose base advanced after divergence: the result uses the actual
   selected tips, with evidence that a merge-base implementation would differ.
6. A source-only commit selectable despite unchanged architecture Markdown.
7. Added file in an existing component versus an added component; removed
   file versus removed component; rename ownership on both sides; unmapped files.
8. Architecture-only and relationship-only changes, stable IDs across a move,
   and immutable input worlds; removed details remain readable from the base.
9. Local source available with GitHub disabled/unready; a test source's entries
   and failures render through the same state/data boundary without GitHub rules.
10. GitHub recorded-response/command tests for paging, state/search behavior,
    repository identity, fork refs, exact SHAs, and authentication failures.
    No network or real credentials in the normal automated suite.
11. Relevant live-update lifecycle: a working-tree change recomputes one coherent
    comparison; committed targets stay fixed; session close releases owned work.
12. Equivalent task/Git inputs yield the same file statuses, ownership, hunks,
    and map projection; task filtering changes scope without changing endpoints.
13. Task references, unchanged recorded files, and shared files do not become
    false code-change or exclusive-authorship claims. Work markers stay separate.
14. A completed task's explicit map review uses its historical target and base;
    ordinary task selection does not silently change time-machine state.
15. Component-to-file-to-diff navigation preserves context and returns correctly
    from either task or Git review; a scope change updates map and panel together.

Manually inspect the connected UI flow in the browser using the same example,
then a real GitHub branch/PR. Verify keyboard selection, cancellation, focus,
long branch names, and that comparison status remains distinct from drafts and
selection. Inspect the same change through a task and a Git comparison, including
its map color, file badge, removed source, shared-file indication, and Back
behavior. Reuse the existing source/diff details panel and camera behavior.

Run focused checks, then `bun run check` after each complete code slice.
Observe the existing SVG camera/pattern invariant when adding status paint;
measure frame rate only if a regression is suspected. For substantial changes,
follow the required cold simplicity review, implementer's specification and
quality reviews, and final full-context complexity review. Record each changed
file and affected architecture ID immediately under its implementation task.

## OKF, C4, and supported delivery

Comparison is supporting review state. It is neither a C4 element nor a new
OKF concept. Ordinary Markdown/OKF readers still see the architecture, source
links, and relationships for each committed version. Groma interprets existing
IDs, ownership, and the two states to produce a temporary comparison.
The shared change result also supports task review without turning a Backlog
task, Git branch, or PR into a C4 element. Task references remain work context;
they do not alter the architecture's stored ownership or relationships.

Revision sources belong to the application's integration boundary. They do
not own architecture, scanning, containment, layout, or stored knowledge.
This separation works across programming languages and Git hosts because
Git supplies versions and paths while Groma's architecture supplies ownership.
The GitHub adapter supplies discovery and commit access only.

The first delivery targets the live web viewer. TUI comparison, published
comparison reports, historical scanning, and additional providers are separate
scope decisions. Preserve their current supported behavior during refactoring.

## Reference checks

The repository's authority remains [the architecture Markdown contract](component-markdown.md),
[product model](product-model.md), and [viewer integration contract](viewers/creating-a-plugin.md).

Git supports direct comparison of two commits and comparison of a commit with
the working tree; untracked-file discovery is a separate status concern.
See [git diff](https://git-scm.com/docs/git-diff) and
[git status](https://git-scm.com/docs/git-status).

GitHub provides paginated branch and pull-request metadata. The adapter should
normalize these records before returning them to the application. See
[branches](https://docs.github.com/en/rest/branches/branches#list-branches) and
[pull requests](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests).

The proposed authentication/acquisition choices use
[GitHub CLI authentication status](https://cli.github.com/manual/gh_auth_status),
[authenticated API calls](https://cli.github.com/manual/gh_api),
[documented PR head refs](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/checking-out-pull-requests-locally),
and [Git fetch](https://git-scm.com/docs/git-fetch).
