# Development

Read [MANIFESTO.md](MANIFESTO.md) and [ARCHITECTURE.md](ARCHITECTURE.md) before changing product or
architecture behavior. Keep the next change on the shortest useful path:

```text
groma init -> groma scan -> groma
```

## Requirements

- Bun 1.3.14
- TypeScript 7.0.2

Install the pinned dependencies with `bun ci`.

## Commands

```sh
bun run dev               # run the source CLI
bun run build             # build the native executable
bun run smoke             # verify the native executable starts
bun run typecheck         # TypeScript without emit
bun run test              # focused unit and integration tests
bun run check:boundaries  # enforce layer dependency direction
bun run check:targets     # cross-compile and smoke compatible targets
bun run verify:1a         # compiled CLI end-to-end fixture
bun run check             # formatting, types, boundaries, tests, compiled fixtures
```

## Change shape

Prefer a complete vertical slice over generalized infrastructure. A useful change should remove or
avoid concepts whenever possible, keep canonical meaning in Core/Application, and leave adapters and
renderers replaceable.

For scanner changes, state the supported syntax boundary. Ambiguous syntax must produce partial
evidence or no claim. Do not broaden the scanner into whole-program analysis to satisfy a fixture.

For persistence changes, preserve readable deterministic canonical files, stable IDs, exact schema
validation, and atomic publication. A failed or indeterminate write must not be reported as success.

For projection or renderer changes, prove that the output is bounded and reconstructable. Visual
state must not enter canonical records.

## Tests

Tests should demonstrate public contracts and high-risk seams rather than restate private branches.
The preferred stack is:

1. focused Core/model contract tests;
2. a small number of Host/Persistence composition tests;
3. compiled end-to-end fixtures for the public CLI path.

Add a matrix only when the product promises the matrix. Avoid certification harnesses, frozen
repository snapshots, hostile same-process JavaScript simulations, or duplicated proof suites unless
a real supported boundary requires them.

`bun run check:targets` builds each declared artifact, verifies it is non-empty, runs native smoke,
and exercises the compiled iteration workflow on host-compatible targets. It deliberately does not
parse executable formats itself.

## Pull requests

Use Backlog.md for task planning and completion. Every PR must map to one task and use the exact title
`<TASK-ID> - <Task title>`. Run `bun run check` before publishing. Repository instructions require a
ready-for-review PR, one Claude review, the automatic Codex review, and green CI before merge.
