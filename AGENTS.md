<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:

- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation
  notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks
  to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so
metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

## IMPORTANT: Point of view

Whenever you are writing documentation or code, think from the pov of someone that is not aware of the current conversation
and needs to understand what you wrote without extra context. Is the code clearly legible, are the docs explaining only
what is relevant without mentioning transitions between approaches that happen during this conversation?

## IMPORTANT: Experimental prototype

Groma is an early experimental prototype used only by its developers. It has no external users and no released data,
storage, CLI, or API contracts that must remain compatible.

Do not preserve previous versions. Do not add backward compatibility, migrations, legacy formats, compatibility adapters,
or deprecation paths unless the current user explicitly requests one. When the product direction changes, replace the old
behavior directly and delete obsolete code, documentation, tests, and prototype data.

It is acceptable to wipe and recreate all Groma-owned prototype state required by the current task instead of migrating
it. This permission applies only to explicitly scoped Groma artifacts and never to unrelated developer files or systems.


## Backlog task scope

As a project-specific override to the overview's general task-creation guidance, create Backlog tasks only when the
requested work includes code changes. Do not create a task for standalone documentation changes or Backlog record
administration, such as relabeling, status corrections, or metadata maintenance. Documentation required to deliver an
in-scope code change may remain part of that code task. Continue to run `backlog instructions overview` for every user
request.

## Backlog change tracking

Update task traceability immediately after each change. Do not wait for tests,
progress notes, or task finalization, and do not batch several changes before
updating the task.

- As soon as you change a repository file for a task, and before changing
  another file, record its repository-relative path in the task's modified-file
  list. `--modified-file` replaces the complete list, so first preserve every
  existing entry, then append the newly changed path with another flag. Use
  `backlog task view TASK-N --plain` first if you do not have the current list.
  Keep one flag per file in the order the files were first changed:

  ```bash
  backlog task edit TASK-N \
    --modified-file <existing-path> \
    --modified-file <new-path>
  ```

  The web map stands the task's pin on the element whose code holds the newest
  recorded file.
- As soon as a change affects a Groma architecture element, add that element's
  exact `id` as a Backlog reference with
  `backlog task edit TASK-N --add-ref <id>`. Do this in the same immediate
  change-tracking loop, not at the end of the task. Do not use file paths as the
  join key. Only an exact element `id` produces a live marker.

## Commit messages

When the user confirms that a task is done, commit that task's files
immediately. Stage only the files this agent changed for that task.
Do not stage files other agents changed, even if they sit nearby.

For work associated with a Backlog task, use the exact task ID and title as the commit subject:

```text
<TASK-ID> - <task title>
```

For example: `TASK-28.3 - Supply annotated architecture through Groma core`.

## Minimum sufficient product

Build the simplest real result that matches the approved example. Prefer the fewest concepts, fields, files, dependencies,
and lines of code or documentation that make the requested observable result work.

Simplicity means minimum sufficient information, not vague placeholders or toy behavior. Keep concrete data the supported
flow actually needs, such as an exact source file when a code reference must be useful, and omit everything the current
result does not require. Add another field, layer, abstraction, rule, or explanation only when the approved example cannot
work without it.

When multiple approaches produce the same result, choose the one that is shortest and easiest to explain. Do not import
complexity from an earlier Groma implementation, a generic architecture, or a hypothetical future requirement.

## File length

A source or test file over 500 lines is a code smell. Split it so each file stays at or under 500 lines.

## Repository checks

Run `bun run check` after changing code. It is the single repository check: Biome lints the supported TypeScript files,
TypeScript checks their types, and the Node and Bun test suites run.

Biome uses its recommended lint rules and reports functions whose cognitive complexity is above 15. Existing complexity
warnings are cleanup targets, not permission to add more. Keep new and changed functions at or below the limit, and prefer
small domain operations over branches nested inside one large function.

Biome formatting and import assist are disabled. Do not use Biome to format files or organize imports.

## Web SVG performance

Keep viewport-sized SVG surfaces that use patterns or filters outside groups transformed by the camera. They must be
siblings of the moving camera group so pan and zoom do not repaint them together with the architecture scene. After
changing Web camera or grid composition, check frame rate while panning at close, fitted, and distant zoom, then run
`bun run check`.

## UI descriptions

Do not add subtitles, helper text, or descriptive copy beneath headings, labels, cards, or settings by default. Prefer
one concise, self-explanatory heading or label. Only add supporting copy when the user explicitly asks for it or when it
is necessary to prevent misunderstanding or error, and never use it to restate the heading.

## Product-first scope

Treat the explicit request and current task as the scope. Background, examples, and product vision help explain that
scope but do not expand it. Only the explicitly requested outcome, task acceptance criteria, project Definition of Done,
a documented contract or named invariant, a reproduced failure in the supported product flow, and an explicitly approved
example authorize implementation.

A request to investigate, explain, review, propose, or design does not authorize implementation or file changes. If
reasonable interpretations would materially change behavior, scope, cost, or complexity, report the difference to the
user/orchestrator and wait for direction.

Before implementing, the task must make this sentence answerable:

> When `<actor>` uses `<entry point>`, Groma shows `<observable result>`,
> matching `<approved example>`.

If the actor, entry point, result, or example cannot be identified, report the ambiguity to the user/orchestrator before
designing a solution.

For architecture, scanner, and rendering work, approved hand-authored Markdown and its rendered view are the semantic
authority. The scanner exists to reproduce that meaning from code. Files, directories, imports, line counts, framework
internals, and containment are evidence; they are not architecture components or collaborations unless the approved
example requires them.

Every new behavior, output, artifact, concept, abstraction, module, dependency, or test must answer:

> Which current user action or visible result requires this to exist?

Availability, implementation convenience, completeness, convention, best practice, future flexibility, large scale,
generic support, production safety, compatibility, and possible edge cases are not sufficient answers.

Implement one approved revision and one supported example at a time. Do not generalize to another repository, language,
framework, scale, or delivery model until the current result has been used and approved by a human.

A task is not complete merely because its tests pass. Someone unfamiliar with the implementation must be able to explain
the path from entry point through responsibilities and state to the result, and understand why each visible concept
exists.

## Groma delivery boundaries

Groma is moving toward a model that is detached from the filesystem. Treat the current filesystem integration as
temporary delivery plumbing, not as a foundation to generalize or harden for hypothetical futures.

Before implementing any of the following, stop and report the proposal to the current user/orchestrator for explicit
approval:

- backward compatibility, migrations, or legacy behavior;
- handling for an edge case not required by an acceptance criterion or a reproduced failure in the supported product
  flow;
- fallback, retry, recovery, or degraded-mode behavior;
- filesystem or security hardening beyond the declared supported assumptions;
- an abstraction or extension point justified only by possible future needs.

The report must identify the triggering evidence, the authority that makes the work in scope, the smallest proposed
behavior, and the cost of leaving it unsupported. Tests for unapproved behavior count as implementation and require the
same approval.

Review findings may block completion only when they cite an unmet acceptance criterion, an unmet Definition of Done
item, or a reproducible failure in the declared supported product flow. Otherwise record them as non-blocking
follow-ups.

The first specification and quality reviews may inspect the complete change. Any re-review is limited to the previously
reported findings and regressions caused by their fixes. Newly noticed non-critical improvements are follow-ups.

Stop work when the supported product flow passes, the task acceptance criteria and Definition of Done are satisfied with
evidence, and no authority-backed blocking finding remains.

## Simplicity review

After implementation and its focused checks pass, but before specification, quality, and finalization reviews, run one
cold simplicity review.

Give the reviewer the task, the diff, and the repository without conversation history. The reviewer must briefly explain
the implemented flow from its entry point through its work to its result, then answer:

1. Is this the simplest implementation that satisfies the acceptance criteria?
2. What code, concepts, indirection, or tests can be deleted or collapsed?
3. Can someone unfamiliar with the codebase quickly understand the flow?

Findings may recommend deletion, consolidation, naming improvements, or clarification within the accepted scope. They
may not introduce behavior, requirements, edge cases, compatibility, fallback, recovery, hardening, or future
abstractions.

The implementer applies accepted simplifications and reruns focused checks. There may be at most one targeted re-review,
limited to the original simplicity findings and regressions caused by their fixes. The normal specification and quality
reviews follow only after this gate passes.

## Tests

Test business logic, not UI or content. Cover navigation state, projection and layout invariants, camera rules, world
immutability, and lifecycle. Do not assert decorative details: exact frame strings, hint text, border glyphs, colors, or
prose from the architecture Markdown. Never write a test that only restates its input, such as checking that an element
named A renders the word A; assert the behavior that produced it, such as "the details pane shows the selected element".

Automated tests load architecture only from `test/fixtures/`, never from the live `groma/` tree. A fixture is a
minimum world that exhibits the rule under test: kinds, parentage, relationship direction, promotion, inset, camera.
Do not photocopy this repository's observed architecture. Do not assert product names, descriptions, file layout,
or that a particular person uses a particular system or container. If the fixture already says A uses B, do not
write a test whose only claim is that A uses B.

Tests must be parallel-safe and run concurrently (`test.concurrent` under `bun:test`). Each test owns its renderer,
fixtures, and temp directories; nothing is shared between tests. When a test needs a text anchor to observe behavior,
prefer one minimal anchor over exhaustive content matching.

## TUI map

The TUI world is a map inside fixed chrome: a one-row header, a
hierarchy pane, the map pane, a details pane, and a one-row footer,
with one blank row above the header and below the footer.
Panes reserve width; they never overlay the map. The world layout
never changes; only the camera viewport does. The map uses one fixed,
readable scale. A larger terminal reveals more canvas; there is no
geometric zoom or fit-all view.

- The details pane always shows the current selection.
- The root map shows actors, systems, containers, collapsed groups and
  external systems. It does not show component cards.
- Enter opens only a container, showing that container, its groups and
  components. Backspace returns to root. Arrows never change scope.
- Arrowing selects the nearest visible peer in its direction. The camera
  pans only enough to keep that selection visible.
- Cards, routes, and relationship labels stay on the same cells while
  the selection stays on screen.

Drive `groma view` with `tui-test`. Read the terminal, send keys, and
capture a screenshot.
Compare frames after arrows between visible items. If a card or label
jumped, the map moved. Do not wait for a human screenshot.

```bash
GROMA_TUI_SESSION="groma-view-$$"
GROMA_TUI_ARTIFACTS=$(mktemp -d /tmp/groma-tui-test.XXXXXX)
trap 'tui-test close --session "$GROMA_TUI_SESSION" >/dev/null 2>&1 || true' EXIT
tui-test run --session "$GROMA_TUI_SESSION" --cols 120 --rows 36 --cwd "$PWD" bun src/cli.ts view
tui-test wait idle --session "$GROMA_TUI_SESSION" --timeout 10000
tui-test text --session "$GROMA_TUI_SESSION"
tui-test press --session "$GROMA_TUI_SESSION" Enter
tui-test wait idle --session "$GROMA_TUI_SESSION" --timeout 10000
tui-test screenshot --session "$GROMA_TUI_SESSION" "$GROMA_TUI_ARTIFACTS/frame.svg"
tui-test close --session "$GROMA_TUI_SESSION"
trap - EXIT
```

Look at the root view, details, a container, and a large size such as 200x60.
