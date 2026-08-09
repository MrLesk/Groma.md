# The Groma Manifesto

Groma exists to keep software architecture understandable, current, and useful while people and agents change a system.
These principles guide product and contribution decisions. Detailed product documentation starts at the
[documentation index](docs/index.md).

## Recognition first, continuity next

The first scan should produce an architecture a person can recognize well enough to navigate, correct, and improve.
People and coding agents then curate its meaning in Markdown. Scanners may later report new source observations, but
Groma core must not use them to overwrite that authored meaning.

## Architecture must outlive Groma

Groma stores architecture information in ordinary Markdown so it remains readable, useful, and version-controlled
without Groma. Prefer durable, local documents over data that requires a proprietary service, database, or renderer to
understand.

## Store architecture, not diagrams

Groma uses the C4 model to separate architecture into progressively detailed layers. Diagrams are projections of that
layered model. Layout, visual state, and the needs of one renderer must not become the source of architectural meaning.

Visual understanding is still part of the core product loop. Architecture that cannot be navigated and compared cannot
be meaningfully planned or reviewed. The viewer is how people judge whether a scan is recognizable and whether a plan
expresses the result they want.

## Core owns runtime interpretation

Scanners return source observations to Groma core. Core reconciles those observations and owns architecture Markdown.
For viewing, core reads observed, missing, and planned Markdown and returns an annotated architecture model. Viewers
render that model; they never read architecture files or scanner data directly.

## Human meaning is authoritative

Approved architecture Markdown and its rendered meaning define the system. Stable conceptual identity matters more than
filenames or directory layout. Preserve explanations of responsibilities and collaborations that a reader can
understand; do not reduce architecture to machine-oriented structure.

Groma core may create the first recognizable description of a component from scanner data. Once that component is
curated, core may update only its `code` frontmatter from later scan results; it never rewrites the Markdown body.

## Code is evidence, not architecture

Source files, imports, directories, and framework conventions may provide evidence to a scanner, but they do not become
architecture merely because they exist. A component may keep a small Code overview in frontmatter: which scanner found
an exact source file and, when useful, which symbol it recognized there. This evidence helps explain the component
without turning the architecture into a source inventory.

## Keep reality, intent, and history distinct

Groma must distinguish the architecture known to exist from a desired architectural outcome. Git is the history of how
those states change. Avoid parallel archives, lifecycle metadata, or comparison state when the model and its history can
provide the answer.

## Plans describe outcomes, not work

An architecture plan describes one independent, final desired architectural outcome for an idea, expansion, or change.
It is not a revision in history, an iteration of another plan, a stage in an ordered roadmap, or a list of implementation
steps. Task management belongs to a task manager; execution orchestration does not belong in the architecture model.

## Prefer the minimum sufficient model

Use the fewest concepts, fields, files, and words that produce the real approved result. Simplicity does not mean vague
or toy data: keep concrete information the result needs, such as an exact source file for a useful Code reference. Add
more structure only when a supported example cannot work without it.
