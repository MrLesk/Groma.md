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

## Commit messages

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
