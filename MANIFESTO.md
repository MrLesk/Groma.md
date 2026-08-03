# The Groma Manifesto

Groma exists to keep software architecture understandable, current, and useful while people and agents change a system.
These principles guide product and contribution decisions. Detailed product documentation starts at the
[documentation index](docs/index.md).

## Architecture must outlive Groma

Groma stores architecture information in ordinary Markdown so it remains readable, useful, and version-controlled
without Groma. Prefer durable, local documents over data that requires a proprietary service, database, or renderer to
understand.

## Store architecture, not diagrams

Groma uses the C4 model to separate architecture into progressively detailed layers. Diagrams are projections of that
layered model. Layout, visual state, and the needs of one renderer must not become the source of architectural meaning.

## Human meaning is authoritative

Approved hand-authored architecture and its rendered meaning define the system. Stable conceptual identity matters more
than filenames or directory layout. Preserve explanations of responsibilities and collaborations that a reader can
understand; do not reduce architecture to machine-oriented structure.

## Code is evidence, not architecture

Source files, imports, directories, and framework conventions may provide evidence to a scanner, but they do not become
architecture merely because they exist. Scanning should reproduce approved architectural meaning rather than
invent it from implementation details.

## Keep reality, intent, and history distinct

Groma must distinguish the architecture known to exist from a desired architectural outcome. Git is the history of how
those states change. Avoid parallel archives, lifecycle metadata, or comparison state when the model and its history can
provide the answer.

## Plans describe outcomes, not work

An architecture plan describes one independent, final desired architectural outcome for an idea, expansion, or change.
It is not a revision in history, an iteration of another plan, a stage in an ordered roadmap, or a list of implementation
steps. Task management belongs to a task manager; execution orchestration does not belong in the architecture model.
