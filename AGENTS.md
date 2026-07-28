
<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

## Groma delivery boundaries

Groma is moving toward a model that is detached from the filesystem. Treat the
current filesystem integration as temporary delivery plumbing, not as a
foundation to generalize or harden for hypothetical futures.

Before implementing any of the following, stop and report the proposal to the
current orchestrator for explicit approval:

- backward compatibility, migrations, or legacy behavior;
- handling for an edge case not required by an acceptance criterion or a
  reproduced failure in the supported product flow;
- fallback, retry, recovery, or degraded-mode behavior;
- filesystem or security hardening beyond the declared supported assumptions;
- an abstraction or extension point justified only by possible future needs.

The report must identify the triggering evidence, the authority that makes the
work in scope, the smallest proposed behavior, and the cost of leaving it
unsupported. Tests for unapproved behavior count as implementation and require
the same approval.

Review findings may block completion only when they cite an unmet acceptance
criterion, an unmet Definition of Done item, or a reproducible failure in the
declared supported product flow. Otherwise record them as non-blocking
follow-ups.

The first specification and quality reviews may inspect the complete change.
Any re-review is limited to the previously reported findings and regressions
caused by their fixes. Newly noticed non-critical improvements are follow-ups.

Stop work when the supported product flow passes, the task acceptance criteria
and Definition of Done are satisfied with evidence, and no authority-backed
blocking finding remains.

## Simplicity review

After implementation and its focused checks pass, but before specification,
quality, and finalization reviews, run one cold simplicity review.

Give the reviewer the task, the diff, and the repository without conversation
history. The reviewer must briefly explain the implemented flow from its entry
point through its work to its result, then answer:

1. Is this the simplest implementation that satisfies the acceptance criteria?
2. What code, concepts, indirection, or tests can be deleted or collapsed?
3. Can someone unfamiliar with the codebase quickly understand the flow?

Findings may recommend deletion, consolidation, naming improvements, or
clarification within the accepted scope. They may not introduce behavior,
requirements, edge cases, compatibility, fallback, recovery, hardening, or
future abstractions.

The implementer applies accepted simplifications and reruns focused checks.
There may be at most one targeted re-review, limited to the original simplicity
findings and regressions caused by their fixes. The normal specification and
quality reviews follow only after this gate passes.
