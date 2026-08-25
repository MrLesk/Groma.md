# The Groma Manifesto

Groma exists to keep software architecture understandable, current, and useful
while people and agents change a system. These principles guide product and
contribution decisions. Detailed product documentation starts at the
[documentation index](docs/index.md).

## Recognition first, continuity next

The first scan should produce an architecture a person can recognize well
enough to navigate, correct, and improve. People and coding agents then
curate its meaning in Markdown. Scanners may later report new source
observations, but Groma core must not use them to overwrite that authored
meaning.

## Architecture must outlive Groma

Groma stores architecture information in ordinary Markdown so it remains
readable, useful, and version-controlled without Groma. Prefer durable, local
documents over data that requires a proprietary service, database, or
renderer to understand.

## Store architecture, not diagrams

Groma uses the C4 model to separate architecture into progressively detailed
layers. Diagrams are projections of that layered model. Layout, visual state,
and the needs of one renderer must not become the source of architectural
meaning.

Visual understanding is still part of the core product loop. Architecture
that cannot be navigated cannot be meaningfully planned or reviewed. A
viewer is how people judge whether a scan is recognizable and whether a
plan expresses the result they want. Viewers are plugins. One surface is
not the product.

## The model owns identity

Architecture IDs live in Markdown. A planned element already has the ID it
will keep. Core assigns an ID only when a scan finds something that is not
already in the world. Scanners return evidence, not IDs, and they never
decide that a ghost is built.

## Core owns runtime interpretation

Scanners return source observations to Groma core. Core reconciles those
observations and owns architecture Markdown. For viewing, core reads
observed and planned Markdown and returns one annotated world. A viewer
plugin projects that world; it never reads architecture files or scanner
data directly.

## Human meaning is authoritative

Approved architecture Markdown and its rendered meaning define the system.
Stable conceptual identity matters more than filenames or directory layout.
Preserve explanations of responsibilities and collaborations that a reader
can understand; do not reduce architecture to machine-oriented structure.

The first description of an element may come from an accepted plan or from a
first scan. Once that document exists, core may update only its `code`
frontmatter from later scan results; it never rewrites the Markdown body.

## Code is evidence, not architecture

Source files, imports, directories, and framework conventions may provide
evidence to a scanner, but they do not become architecture merely because
they exist. A component may keep a small Code overview in frontmatter: which
scanner found an exact source file and, when useful, which symbol it
recognized there. This evidence helps explain the component without turning
the architecture into a source inventory. Groma does not require
architecture metadata in application source.

## Keep reality, intent, and history distinct

Groma must distinguish the architecture known to exist from a desired
outcome. Git is the history of how those states change. A plan is not proof
that source exists. `groma accept` applies a ghost only when a scan has
matched it. Scanners cannot infer that a ghost is built. People and agents
do not edit architecture element or revision files by hand. The root
`groma/README.md` is their project profile, not an architecture record.

## Plans describe outcomes, not work

An architecture plan describes new parts, how they relate, and the
requirements that constrain the result. It is not a revision, a stage in a
roadmap, or a list of implementation steps. It does not specify an
implementation stack unless a requirement forces it.

A plan is a fragment. Parents resolve against the architecture that already
exists. A required change to an existing element is a plan that restates
that ID. An explanation of an existing element stays on the observed
document. Task management belongs to a task manager.

## Prefer the minimum sufficient model

Use the fewest concepts, fields, files, and words that produce the real
approved result. Simplicity does not mean vague or toy data: keep concrete
information the result needs, such as an exact source file for a useful Code
reference. Add more structure only when a supported example cannot work
without it.
