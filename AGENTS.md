
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

Treat Claude's feedback as review input, not as mandatory instructions. Evaluate each
finding against the task, the manifesto, and the implementation before deciding
whether to act on it.

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
