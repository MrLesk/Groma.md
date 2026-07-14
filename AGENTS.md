# Read This First

At the beginning of every conversation, read [MANIFESTO.md](MANIFESTO.md) before
answering or taking action. It is Groma's constitution: its purpose, users, core loop,
source of truth, architectural boundaries, plugin posture, design principles, and
named risks.

All product and architecture decisions must align with the manifesto. If a request
conflicts with it or would materially change one of its principles, surface the
conflict and ask Alex rather than silently proceeding.

Do not edit the manifesto as a side effect of implementation. Changes to it require
an explicit product decision.

## Product Delivery Guardrails

Preserve the shortest end-to-end path to the first useful Groma experience:

```text
groma init -> groma scan -> groma
```

That path must produce a bounded, understandable, locally owned visual blueprint. When
planning work, prefer a complete vertical slice that improves this experience over
finishing generalized infrastructure, extension breadth, or extreme-scale hardening
that the slice does not yet require. Delaying the visible first-run outcome for such
work requires an explicit product decision from Alex.

Keep canonical meaning and presentation separate:

- a component is a canonical architectural entity;
- a node is a disposable visual projection;
- layout, folding, focus, zoom, and theme never enter canonical state;
- renderers consume bounded shared application reads and never create a second
  semantic path;
- visual density belongs to the current main layer, while focus and detail views
  reveal additional components.

Do not weaken scanner blindness, stable identity, reconciliation, deterministic local
state, or fail-closed ambiguity in the name of speed. These invariants are what let the
visual blueprint remain useful after the first scan instead of becoming a stale
diagram.

## Pull Requests

Create every pull request in **ready-for-review** state, never as a draft. Automated
reviews start only for ready pull requests. If work is not ready for review, keep it
on its branch and do not open the pull request yet.

Every pull request must correspond to an existing Backlog task unless Alex explicitly
authorizes a taskless pull request in the current instruction. Before creating the
pull request, verify the task through the Backlog CLI.

Set the pull request title to exactly `<TASK-ID> - <Task title>`, using the ID and title
reported by `backlog task view`. Do not abbreviate, reword, or omit either part.

After creating each pull request, ask Claude to review it and inspect the feedback:

```sh
claude -p "review [MrLesk/Groma.md#<PR-NUMBER>](https://github.com/MrLesk/Groma.md/pull/<PR-NUMBER>)"
```

Use Claude primarily as a second perspective on text, naming, conceptual simplicity,
coherence, and how the tool or change will be understood and used. Its broad product
perspective is the value of this deliberately slower review.

Do not rely on Claude as the primary bug or correctness reviewer. Verify bugs and
errors independently through your own code review, tests, static analysis, and CI.
Treat all Claude feedback as review input, not as mandatory instructions, and evaluate
each finding against the task, the manifesto, and the implementation before deciding
whether to act on it.

Also wait for the Codex bot's automated pull-request review to finish. A 👀 reaction
from the Codex bot means the review is still in progress; a 👍 reaction means it has
finished and accepted the pull request. Do not finalize the task while the Codex review
is still in progress. When it finishes, inspect all review comments and threads and
take action where independently justified. As with Claude, Codex comments are review
input rather than mandatory instructions; verify each finding against the task,
manifesto, implementation, and available checks.

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.47.1 -->

<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Use the detailed guides when needed:

- `backlog instructions task-creation` for creating or splitting tasks
- `backlog instructions task-execution` for planning and implementation workflow
- `backlog instructions task-finalization` for completion and handoff

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
