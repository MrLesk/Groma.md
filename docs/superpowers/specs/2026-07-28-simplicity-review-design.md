# Simplicity review

After implementation and its focused checks pass, but before specification,
quality, and finalization reviews, run one cold simplicity review.

The reviewer receives the task, the diff, and the repository without
conversation history. They must briefly explain the implemented flow from its
entry point through its work to its result, then answer:

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
