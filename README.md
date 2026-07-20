<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/lockup-dark.svg">
  <img src="brand/lockup.svg" alt="groma.md" width="300">
</picture>

# Groma

Groma keeps a living map of your system's architecture inside your repo: meaning in plain
Markdown files you can read and review, and scanner evidence in deterministic JSON.

The map records two kinds of truth side by side and never confuses them:

- **Intent** — what a person or AI agent said each part of the system is _for_.
- **Evidence** — what a scanner actually found in the code.

Scans refresh the evidence. Your intent is never overwritten by a scan, a rename, or a
failure. Humans and AI agents use the same commands and see the same model. Everything
stays local: no server, no account, no upload.

_(A groma was the Roman surveyor's instrument used to lay out cities and roads — a tool
for projecting a plan onto the ground.)_

## The goal

The target three-command loop takes you from an unfamiliar codebase to a map you can understand:

```sh
groma init   # create the groma/ workspace inside your repo
groma scan   # take one careful look at the code and record what is really there
groma        # open a bounded visual blueprint
```

The three commands now work as one local loop. Groma is built in public, and the list below says
exactly what is real now.

## What works today

- `groma init` creates the workspace in any project.
- You build the map by hand (or an agent does): `component create`, `update`, `merge`,
  `reparent`, `remove`, plus relationships between components.
- You explore the map from the terminal: `component roots`, `component children`,
  `blueprint search`, `blueprint traverse`, and a complete paged `blueprint export`.
- `groma scan` selects the initialized project and built-in TypeScript/Bun scanner,
  records bounded evidence, and reconciles it without overwriting curated intent.
- Bare `groma` opens a deterministic self-contained local HTML blueprint from the bounded current
  hierarchy, with recursive folding, focus, and component detail.
- `groma web` serves an interactive web blueprint embedded in the same binary, on your machine
  only (127.0.0.1), reading the blueprint through the same bounded operations as the CLI.
- `groma instructions` prints built-in working guides for humans and AI agents, before any
  workspace exists.
- `project add` registers additional codebases and scanner coverage explicitly.
- Meaning is stored as deterministic, reviewable Markdown and scanner evidence as bounded,
  deterministic JSON under `groma/`; the whole tool ships as one compiled executable.

## The rules Groma refuses to break

These are the promises that keep the map trustworthy after the first scan:

- **Scanners are blind.** A scanner reads code and reports what it sees. It never sees
  the existing map, so it can never "helpfully" reorganize your architecture.
- **Meaning survives evidence.** A failed or partial scan can never erase what people
  wrote. Missing evidence is not proof that a part is gone.
- **When unsure, stop.** Groma never guesses identity. If it cannot tell whether two
  things are the same component, it asks instead of merging them.
- **Stable IDs, not names.** Components keep their identity through renames, moves, and
  refactors. Paths and names are labels, not identity.
- **One semantic path.** CLI, web, and plugins all go through the same operations and
  validation. There are no secret side doors for agents.
- **Local first.** Your architecture lives in your repo, readable without Groma, with
  Git as its history.

## Where to read more

| Document                                                             | What it answers                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| [MANIFESTO.md](MANIFESTO.md)                                         | Why Groma exists, and the principles that govern decisions |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                   | How the pieces fit together, and where work stands         |
| [DEVELOPMENT.md](DEVELOPMENT.md)                                     | How to build, test, and contribute                         |
| [docs/component-model-examples.md](docs/component-model-examples.md) | A worked example of modeling a real system                 |
| [docs/interface-glossary.md](docs/interface-glossary.md)             | The plain words Groma uses on its surfaces                 |
| [AGENTS.md](AGENTS.md)                                               | Ground rules for AI agents working in this repo            |
| [SUCCESS.md](SUCCESS.md)                                             | The product north star                                     |
| [`groma/`](groma/)                                                   | Groma's own canonical blueprint (edit via the CLI only)    |

## Build it yourself

```sh
bun ci                # install dependencies
bun run build         # compile the single-file executable to dist/groma
./dist/groma          # open the bounded local visual blueprint
bun run install:local # put the compiled groma command on your PATH
```

After `bun run install:local`, `groma`, `groma scan`, and `groma web` work from any
directory, exactly like the compiled binary in `dist/`.

To create the unpublished four-target preview package, run `bun run package`. It writes
target-specific executables and a sorted `dist/SHA256SUMS` manifest, exercises the matching
host artifact through Groma's compiled black-box workflow, and assembles the future
`groma.md` npm packages (a shim plus one binary package per platform, the same shape
backlog.md installs from) under `dist/npm`, verified by a local global install from the
packed tarballs. The `groma.md` package is not published yet. Cross-compiled artifacts are packaging
proofs only; native runtime behavior is claimed only on a matching host.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full toolchain and verification gates.
