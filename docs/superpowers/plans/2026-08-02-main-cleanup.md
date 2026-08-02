# Main Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve two spike branches as historical evidence, keep Revisions 04 and 05 as concise current intent, and leave no tasks on the active Backlog board.

**Architecture:** Main contains one short investigation index and current plan Markdown only. The full disposable experiments remain reachable through immutable commit IDs on their named branches; Backlog distinguishes delivered work in `completed` from superseded or unimplemented work in `archive`.

**Tech Stack:** Markdown, Git, Backlog.md CLI, existing Groma architecture validator.

## Global Constraints

- Change documentation and Backlog lifecycle state only.
- Do not change production source, tests, package manifests, temporary files, or spike artifacts.
- Keep `groma/plans/04-semantic-zoom-viewer` and `groma/plans/05-tui-viewer` as current product intent.
- Keep `spike/semantic-zoom-renderer-selection` at `54d8fd0` and `spike/groma-tui` at `8b786ed`; neither branch is merge material.
- Use the Backlog CLI for every Backlog task and milestone mutation.
- Move genuinely terminal work to completed history and archive work that is unfinished, superseded, or never implemented.

---

### Task 1: Separate current plans from historical investigations

**Files:**
- Create: `docs/historical-investigations.md`
- Modify: `README.md`
- Modify: `groma/plans/README.md`
- Modify: `groma/plans/04-semantic-zoom-viewer/README.md`
- Modify: `groma/plans/04-semantic-zoom-viewer/systems/groma/containers/viewer/container.md`
- Modify: `groma/plans/04-semantic-zoom-viewer/systems/groma/containers/viewer/components/canvas.md`
- Modify: `groma/plans/05-tui-viewer/README.md`

**Interfaces:**
- Consumes: local Git refs `spike/semantic-zoom-renderer-selection` and `spike/groma-tui`.
- Produces: a root-readable historical index and internally consistent current Revision 04/05 Markdown.

- [ ] **Step 1: Record the baseline excluded-path state**

Run:

```sh
git status --short -- src test e2e package.json package-lock.json bun.lock playwright.config.mjs playwright.semantic-zoom.config.mjs scripts .superpowers .adversarial-tmp groma/experiments
```

Save the output outside the repository for comparison after the cleanup. Do not stage or modify any listed path.

- [ ] **Step 2: Add the historical investigation index**

Create `docs/historical-investigations.md` with:

- a warning that investigations are evidence, not current implementation plans;
- the branch and exact commit for each spike;
- the question, durable conclusions, and never-merge status for each spike;
- `git show 54d8fd0` and `git show 8b786ed` inspection commands; and
- a note that no Git remote is configured, so the references are local.

- [ ] **Step 3: Link the index from the root README**

Add one short “Historical investigations” section after the architecture-format links. Link to `docs/historical-investigations.md`; do not copy the investigation chronology into the README. Keep `groma/plans/README.md` as the concise index naming Revisions 04 and 05.

- [ ] **Step 4: Reduce Revision 04 to current intent**

Keep its Outcome, Approved interaction, current React Flow foundation, final Field Notes design, Replacement boundary, and Deliberately absent sections. Replace withdrawn G6/RGUI history, exhaustive inventory, and benchmark chronology with one short link to `docs/historical-investigations.md` and the immutable spike ref.

- [ ] **Step 5: Correct Revision 04 renderer names**

Set the Viewer technology to `Bun, React, and React Flow.` and the Semantic zoom map technology to `React Flow.` Align the component page with the approved four landmarks and fixed slider breakpoints. No other C4 component meaning changes.

- [ ] **Step 6: Point Revision 05 at its evidence**

Keep the approved `(level, selection)` design and replace the long inline branch explanation with a concise link to `docs/historical-investigations.md`, retaining branch `spike/groma-tui` and commit `8b786ed` as the exact evidence reference.

- [ ] **Step 7: Check documentation scope**

Run:

```sh
git diff --check -- README.md docs/historical-investigations.md groma/plans/04-semantic-zoom-viewer groma/plans/05-tui-viewer
rg -n 'AntV G6|RGUI' groma/plans/04-semantic-zoom-viewer groma/plans/05-tui-viewer
```

Expected: no whitespace errors and no `AntV G6` or `RGUI` occurrence in either current plan.

### Task 2: Clean the active Backlog board

**Files:**
- Move through CLI: `backlog/tasks/*.md`
- Produce through CLI: `backlog/completed/*.md`
- Produce through CLI: `backlog/archive/tasks/*.md`
- Move through CLI: `backlog/milestones/m-3 - revision-05-—-tui-viewer.md`
- Produce through CLI: `backlog/archive/milestones/m-3 - revision-05-—-tui-viewer.md`

**Interfaces:**
- Consumes: current Backlog task status as the authority for completed versus archived disposition.
- Produces: an empty active task board with preserved completed and archived history.

- [ ] **Step 1: Capture current task status**

Run:

```sh
backlog task list --status Done --plain
backlog task list --status 'To Do' --plain
backlog task list --status 'In Progress' --plain
```

Use this output rather than filename assumptions when deciding `complete` versus `archive`.

- [ ] **Step 2: Move terminal tasks to completed history**

For every task currently in `Done`, run the exact terminal-task list captured
above:

```sh
for cleanup_task in \
  TASK-1 TASK-2 TASK-3 TASK-4 TASK-5 TASK-6 TASK-7 TASK-8 \
  TASK-9 TASK-10 TASK-11 TASK-12 TASK-13 TASK-14 TASK-15 TASK-16 \
  TASK-17.1 TASK-17.3 TASK-17.4 TASK-17.5 TASK-17.5.1 TASK-17.5.2 \
  TASK-17.5.3 TASK-17.5.3.1 TASK-17.5.4 TASK-17.5.5 TASK-17.5.6 \
  TASK-17.5.7 TASK-17.5.8 TASK-17.6
do
  backlog task complete "$cleanup_task"
done
```

This includes delivered TASK-1 through TASK-16 and completed TASK-17 spike subtasks. Do not archive terminal work.

- [ ] **Step 3: Archive superseded semantic-zoom work leaf-first**

Archive TASK-17.2 and TASK-17.7 before TASK-17:

```sh
backlog task archive TASK-17.2
backlog task archive TASK-17.7
backlog task archive TASK-17
```

- [ ] **Step 4: Archive unimplemented TUI work leaf-first**

Run:

```sh
backlog task archive TASK-18.1
backlog task archive TASK-18.2
backlog task archive TASK-18.3
backlog task archive TASK-18.4
backlog task archive TASK-18
backlog milestone archive m-3
```

- [ ] **Step 5: Keep TASK-19 active until verification**

Do not finish TASK-19 yet. It remains the only active task until all acceptance criteria have objective evidence.

### Task 3: Verify, finalize, and commit the cleanup

**Files:**
- Update through CLI: `backlog/tasks/task-19 - Clean-main-while-preserving-historical-spike-investigations.md`
- Produce through CLI: `backlog/completed/task-19 - Clean-main-while-preserving-historical-spike-investigations.md`
- Commit: documentation and Backlog lifecycle moves from Tasks 1–3 only.

**Interfaces:**
- Consumes: documentation from Task 1 and Backlog disposition from Task 2.
- Produces: verified cleanup commit and an empty active Backlog board.

- [ ] **Step 1: Verify historical refs and snapshot contents**

Run:

```sh
test "$(git rev-parse spike/semantic-zoom-renderer-selection)" = 54d8fd05b2f7798582456622f14b45c0def8dbff
test "$(git rev-parse spike/groma-tui)" = 8b786ed5ac8ad1a5bd2414c9b424511c851e985a
git cat-file -e 54d8fd0^{commit}
git cat-file -e 8b786ed^{commit}
```

Expected: all commands exit zero.

- [ ] **Step 2: Validate current architecture Markdown**

Run:

```sh
bun run validate:architecture
```

Expected: observed and all planned revisions validate.

- [ ] **Step 3: Prove excluded paths are unchanged by this cleanup**

Compare the current excluded-path `git status --short` output with the baseline captured in Task 1. They must be byte-identical. Inspect `git diff --name-status 7000282..HEAD` only after the cleanup commit; it must contain no production source, test, package-manifest, temporary, experiment, or spike path.

- [ ] **Step 4: Finalize TASK-19 with Backlog guidance**

Read `backlog instructions task-finalization`, record verification in Implementation Notes, check only evidenced acceptance criteria and Definition of Done items, add a concise Final Summary, set TASK-19 to `Done`, then run:

```sh
backlog task complete TASK-19
```

- [ ] **Step 5: Verify the active board is empty**

Run:

```sh
backlog task list --status 'To Do' --plain
backlog task list --status 'In Progress' --plain
backlog task list --status Done --plain
```

Expected: no active tasks in any status.

- [ ] **Step 6: Commit only the approved cleanup**

Stage the documentation paths and Backlog moves explicitly. Review `git diff --cached --name-status`, then commit:

```sh
git commit -m 'Document historical spikes and clean active backlog'
```

- [ ] **Step 7: Verify the final commit scope**

Run:

```sh
git show --stat --oneline HEAD
git diff --name-only 7000282..HEAD -- src test e2e package.json package-lock.json bun.lock playwright.config.mjs playwright.semantic-zoom.config.mjs scripts .superpowers .adversarial-tmp groma/experiments
```

Expected: the commit contains only approved documentation and Backlog lifecycle paths, and the second command prints nothing.
