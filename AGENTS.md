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

For complex tasks, state the supported boundary before implementing: which inputs and
scenarios the behavior is promised for, and what stays partial or unsupported. Judge
correctness and review findings within that boundary. "Fail closed on ambiguity" means
Groma must not guess identity, bindings, reconciliation, or canonical meaning — it does
not mean proving every possible runtime behavior or resolving arbitrary program
semantics. When scanner syntax is ambiguous, report partial evidence or no claim at
all, rather than expanding into whole-program alias, mutation, or capability analysis.
Broadening the boundary requires an explicit product decision from Alex.

## Brand and Visual Direction

Before designing or implementing any public Groma surface, renderer, visual artifact,
logo use, or presentation styling, read [brand/README.md](brand/README.md) and
[brand/STYLE.md](brand/STYLE.md).

The first visual renderer is a single luminous white architectural-sheet surface with
graphite structure and exact Groma green `#1D9E75` as its restrained surveyed-point
accent. It uses the lowercase `groma.md` identity, recursive technical-drawing
containment, dense but bounded information, and soft neutral depth only where the
style guide permits it. Do not introduce blueprint blue, a dark-mode switch,
dashboard chrome, cartoon styling, or effects on the official marks without a new
explicit product decision from Alex.

The approved mockup in `brand/references/` is a non-normative visual reference. Brand
rules, the written style guide, accessibility, and renderer semantics take precedence
over generated-image details.

## Pull Requests

Create every pull request in **ready-for-review** state, never as a draft. Automated
reviews start only for ready pull requests. If work is not ready for review, keep it
on its branch and do not open the pull request yet.

Every pull request must correspond to an existing Backlog task unless Alex explicitly
authorizes a taskless pull request in the current instruction. Before creating the
pull request, verify the task through the Backlog CLI.

Set the pull request title to exactly `<TASK-ID> - <Task title>`, using the ID and title
reported by `backlog task view`. Do not abbreviate, reword, or omit either part.

Before creating a pull request, run exactly two independent local review agents using
`gpt-5.6-terra` at `xhigh` reasoning effort. Give both agents the complete diff and the
task's supported semantic boundary. Each agent performs one bounded pass and returns
actionable findings; do not create recursive or open-ended review loops.

Also ask Claude once to review the local branch before the pull request is created:

```sh
claude -p "Review the current branch diff against MANIFESTO.md and its Backlog task. Focus on conceptual simplicity, coherence, naming, and how the change will be understood and used."
```

Use Claude primarily as a second perspective on text, naming, conceptual simplicity,
coherence, and how the tool or change will be understood and used. Its broad product
perspective is the value of this deliberately slower review.

Do not rely on Claude as the primary bug or correctness reviewer. Verify bugs and
errors independently through your own code review, tests, static analysis, and CI.
Treat all Claude feedback as review input, not as mandatory instructions, and evaluate
each finding against the task, the manifesto, and the implementation before deciding
whether to act on it. Resolve justified findings from both Terra reviews and Claude,
rerun proportional verification, and only then create the ready-for-review pull request.

Wait for exactly the first Codex bot review started by the ready pull request. Do not tag
`@codex`, request another Codex review, or restart the review cycle manually. A 👀 reaction
means that first review is still in progress; a 👍 reaction means it finished without
findings. If the first review reports findings, inspect them and fix those independently
justified by the task, manifesto, implementation, and available checks. Push the fixes and
wait for green CI, but do not wait for the automatic follow-up Codex review: a new 👀 after
the review-fix push is not a merge blocker. Merge once the first Codex review has been
handled and required CI is green.

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
