# Review Git changes

The revision control starts on **Working tree**. Local edits do not turn on
comparison. Choosing a branch or commit browses that exact snapshot without
comparing it with a parent.

Open the same control and choose **Local changes** to compare HEAD with the
working tree. **Compare with…** selects a base for the viewed commit or working
tree. The editor shows **Base → Target**, with full commit identities, before
**Compare** applies it. Either endpoint can be changed there. Choosing the
working tree from a historical view makes the historical commit the base.

Branches resolve to their exact tips when selected. A branch comparison is
tip to tip, including changes made on the base branch after divergence.
Remote-tracking branches are labelled as locally fetched refs. **Refresh**
rereads metadata and the selected range; select a branch again to resolve a
new tip. **Stop comparing** keeps the target as an ordinary view.
The URL stores the target SHA, base SHA, presentation and optional task scope.
A working-tree URL refers to the repository on this local machine.

## Reading the result

The existing Hierarchy pane becomes a change tree. **Changes** shows target
elements together with removed elements and their required parent context.
**Before** and **After** show the exact snapshot maps. Removed entries remain
selectable in every presentation. Selecting them reads the base architecture
and identifies it as **Before** in Details.

Added elements are blue, edited elements amber, and removed elements red.
Selection keeps the existing highlight outline. No status badge is added to
map components. The right Details pane names the status and explains changes
to code, membership, name, parent or other architecture values. Relationship
changes have their own rows; they do not imply downstream code changes.

**How it is built** lists changed files above ordinary source inspection.
Selecting a changed file opens the shared unified diff with old/new line
numbers, rename paths, counts, and Before/After file readers. Binary files show
their status without fabricated text hunks. **Back** returns to the same
component or task. Files without a stored source owner appear under
**Unmapped files**.

The working-tree comparison includes the net result of staged and unstaged
edits and non-ignored untracked files. A renamed path retains its ownership
on each side. Deleting a file from a surviving component edits that component;
it does not delete the architecture identity. Comparisons require readable,
stored architecture at both commits. Missing or incompatible snapshots are
reported as unavailable, never interpreted as empty architecture.

## Backlog review

**Review changes** in a task's existing Modified files section opens the same
comparison. An active task uses HEAD and the working tree. A completed task
uses its matching task commit and that commit's parent, preserving the task
diff policy. The task's recorded files select the scope.

Selecting a task during an active comparison narrows its files without changing
the endpoints. The scope chip clears that filter. Unchanged recorded files
remain visible in the task details but do not paint their owner as edited.
References alone are work context, not evidence of a Git change. Shared files
retain the Shared indication; it is not an authorship claim. Historical task
review retains task metadata but does not put today's work pins on that map.

## Optional sources

Local Git needs no hosting account or GitHub CLI. **Settings → Plugins →
Revision sources** enables the shipped GitHub adapter and selects a repository
from this checkout's GitHub remotes. With several repositories, the user must
choose; the adapter does not assume origin is the upstream.

The adapter uses an existing GitHub CLI login. It adds GitHub branches and
pull requests to the same selector. PRs propose the current base branch tip
and the PR head, including fork heads. They use the same local comparison
engine. This can differ from GitHub's merge-base-oriented Files changed view.
Only discovery and comparison are supported; there are no PR write actions.
See the [GitHub adapter](../../../plugins/revision-sources/github/README.md).

## Implementation ownership

- `src/history/` reads Git facts, local discovery, snapshots and invalidation.
- `src/comparison/` resolves each file's old/new ownership and compares
  semantic architecture. It never changes the input worlds or Git branches.
- `src/viewers/web/comparison/session.ts` applies complete results and owns
  lazy file reads for those exact versions. Outdated working-tree results
  cannot be reused after invalidation.
- `src/viewers/web/revision/` owns explicit navigation and source selection.
  Its request session prevents old results or live refreshes from overriding
  a newer navigation choice.
- `src/viewers/web/comparison/` paints the existing panes and the separate
  map status input. `src/viewers/web/changes/view.ts` is the shared task/Git
  file reader. Task endpoint policy stays in `src/viewers/source/diff.ts`.
- `packages/revision-source/` defines browser-safe source data.
  `src/revision-sources.ts` registers local Git and the optional adapter.
  The web host accepts injected sources and has no GitHub API knowledge.

Comparison is temporary review state, not a C4 level or an OKF record.
Ordinary Markdown readers still see each version's architecture and source
links. Groma interprets existing identities and ownership across those versions.
The first delivery covers the live web viewer; static exports and the terminal
keep their existing task and source inspection.
