# TypeScript/Bun source-observation contract

Revision 03 supports exactly one source shape, named
`groma.typescript-bun/v1`. It is a deliberately small declaration protocol for
a Bun repository, not TypeScript program analysis. The complete supported and
unsupported fixtures live under `fixtures/source-observation/`.

## Supported repository shape

The observer receives a repository root. A supported root has this layout:

```text
package.json
src/
  index.ts
  components/
    <component-id>.ts
```

`package.json` must contain all of these exact markers (other JSON fields are
allowed):

```json
{
  "private": true,
  "type": "module",
  "engines": {
    "bun": ">=1.3.14"
  },
  "scripts": {
    "start": "bun run src/index.ts"
  }
}
```

There is exactly one entry point, `src/index.ts`, and at least one component
module. Component modules are direct children of `src/components/`. No other
`.ts`, `.tsx`, `.mts`, or `.cts` file may occur beneath `src/`. Non-TypeScript
files and directories outside this layout are not source declarations.

### Physical repository confinement

The observer resolves the caller-supplied repository root with `realpath`
exactly once. That resolved directory is the physical repository root for the
entire invocation. A caller may therefore supply one root alias, but resolving
that root is the only symbolic-link traversal permitted.

For the supplied repository snapshot, the observer validates physical paths
before reading `package.json` or source bytes. Starting from the resolved root,
it checks paths without following symbolic links:

- the resolved root, `src`, and `src/components` are real directories;
- `package.json`, `src/index.ts`, and every direct
  `src/components/<component-id>.ts` entry are real regular files;
- every ancestor between a supported file and the resolved root is a real
  directory; and
- every filesystem entry inspected while enumerating `src` is physically
  beneath the resolved root and is not a symbolic link.

“Beneath” is a path-component boundary, not a string-prefix test. The relative
path from the resolved root to a candidate must be empty or must be neither
absolute nor `..`/`../...`. The observer never follows a link at a required
path or encountered while enumerating `src`, including a link whose target
would remain inside the root, and never opens a link target to decide whether
it otherwise looks supported. Missing entries, wrong file kinds, any such
encountered link, or any resolved escape returns the exact
`UnsupportedSourceShapeError` with no partial observation. A link elsewhere
beneath the repository, outside `package.json` and the enumerated `src` tree,
is outside the source shape and is not inspected. Therefore, a static in-scope
link cannot indirectly expose another repository, `groma/plans`, or any other
outside file.

Where the runtime exposes no-follow opens and descriptor metadata, each final
regular file is opened without following a final symbolic link, its type and
identity are checked on the same descriptor used to read its bytes, and a
detected direct final-file swap returns the exact unsupported-shape error.

This v1 contract is for a local, non-adversarial repository. It assumes the
directory topology from the resolved root through `src/components` remains
stable during one observation, from physical validation until all final
descriptor reads complete. It does not claim security against an adversary
concurrently replacing a previously validated ancestor directory. Native
descriptor-relative traversal or equivalent protection against that ancestor
race is an explicit non-goal, not a fallback: static links and escapes, plus
direct final-file swaps detected by the checks above, remain unsupported and
never permit partial extraction. TASK-13 owns change coordination; an in-scope
source change during or after an observation settles into an event that starts
a fresh complete observation rather than patching or reusing the in-flight
result.

The reserved declarations below are type-only TypeScript. They require no
decorator, runtime helper, import, build step, type checker, or project code
execution. The observer reads their literal text and treats all later,
non-reserved TypeScript statements as opaque.

`package.json` and every source file must be strictly decodable UTF-8. A
leading UTF-8 BOM (`EF BB BF`) is unsupported and is not stripped. Source files
use U+000A LF line endings, contain no U+000D CR, U+2028 LINE SEPARATOR, or
U+2029 PARAGRAPH SEPARATOR anywhere, and end with one LF. The reserved
declaration therefore starts at byte zero on physical line 1. Within a reserved
declaration, every keyword, space, indentation level, colon, semicolon, comma,
bracket, and blank line shown below is literal and required. Metavariables
inside angle brackets are the only replaceable text. Their values use JSON
double-quoted string syntax on one physical LF-delimited line. Comments and
extra blank lines are not permitted before or inside a reserved declaration.

## Entry-point declaration

The first statement in `src/index.ts` is exactly one type-literal declaration
with this shape:

```ts
export type GromaEntryPoint = {
  componentId: "<component-id>";
};
```

`componentId` is the exact stable ID of the component that owns the entry
point. It must name one component module in the same repository. The entry
point's evidence range is lines 1–3, the whole `GromaEntryPoint` declaration.
After line 3, a file may contain arbitrary TypeScript text, but it must not
contain another `GromaEntryPoint`, `GromaComponent`, or
`GromaRelationships` identifier.

## Component boundary

Every `src/components/<component-id>.ts` begins with exactly one
`GromaComponent` declaration followed by exactly one
`GromaRelationships` declaration:

```ts
export type GromaComponent = {
  id: "<component-id>";
  name: "<readable name>";
  description: "<readable responsibility>";
  technology: "<readable technology>";
};

export type GromaRelationships = [
  {
    sourceId: "<component-id>";
    targetId: "<target-id>";
    description: "<readable intent>";
    technology: "<readable mechanism>";
  },
];
```

The `GromaComponent` declaration defines one C4 component boundary. Its `id`
must equal the module's filename and is emitted unchanged. `name`,
`description`, and `technology` use the readable-text rules below.
An empty relationship tuple, `export type GromaRelationships = [];`, is valid.
Otherwise each tuple item has exactly the four shown fields in the shown order.
Its `sourceId` must equal the enclosing component ID. `targetId` is emitted
unchanged and may name a component or another existing C4 element.

The component declaration occupies lines 1–6. Line 7 is empty. For an empty
tuple, line 8 is the complete `GromaRelationships` declaration. For a
non-empty tuple, line 8 is `export type GromaRelationships = [`, each item is
six consecutive lines in the exact shown form (including its trailing comma),
and `];` immediately follows the last item. No blank or comment line may occur
inside the tuple. After that declaration, a file may contain arbitrary
TypeScript text, but it must not contain another `GromaComponent`,
`GromaRelationships`, or `GromaEntryPoint` identifier. Any CRLF input,
different trivia, omitted or additional field, reordered field, alternate
quote, optional punctuation, or duplicate reserved identifier is outside v1.

### Readable text values

The observer JSON-decodes every component `name`, `description`, and
`technology`, plus every relationship `description` and `technology`, before
validation. Each decoded value must:

- contain one or more code points;
- contain only printable ASCII U+0020–U+007E; and
- start and end with U+0021–U+007E, so whitespace-only values and leading or
  trailing spaces are rejected.

Internal U+0020 spaces are allowed. Every control, line break, non-ASCII code
point, unpaired surrogate, format control, private-use value, and unassigned
value is outside v1. JSON escapes do not bypass validation: `"\u0041"` decodes
to supported `A`, while values such as `"\n"`, `"\t"`, `"\u0000"`,
`"\u0085"`, `"\u200b"`, `"\u2028"`, `"\u2029"`, and `"\ufeff"` decode
to unsupported text. Markdown punctuation, including `|`, `\`, `` ` ``, `*`,
`_`, `[`, `]`, `(`, `)`, `<`, and `>`, is printable ASCII and is allowed
because emission escapes it deterministically.

Every component ID, entry-point `componentId`, relationship `sourceId`, and
relationship `targetId` uses the canonical stable C4 ID syntax:

```regex
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

IDs are declaration-supplied. The observer never derives an ID from a symbol,
filename change, plan, or previous observation, and never infers a rename.
Component IDs are unique within one observation. Relationship targets need
only satisfy the ID syntax during observation: the source observer does not
read architecture Markdown and does not decide whether an external target
exists.

## Source ranges and transient observation

A source range is repository-relative POSIX text in the form
`<path>:<start-line>-<end-line>`. Lines are one-based and both endpoints are
inclusive. A component range covers its complete `GromaComponent` declaration;
a relationship range covers its complete tuple item; and an entry-point range
covers its complete `GromaEntryPoint` declaration.

The observer returns a transient `groma.typescript-bun/v1` observation record,
not Markdown and not a second architecture model. It contains the fixed
`containerId` `scanner`, entry points, components, outgoing relationships, and
the source range for each declaration. Components are ordered by ID;
relationships are ordered by `(sourceId, targetId, sourceRange)`; entry points
are ordered by source range. Every comparison is lexicographic over the UTF-8
bytes of each field: compare the first differing unsigned byte, with a shorter
prefix ordered first. Locale collation is never used. The supported fixture's exact record is
`fixtures/source-observation/supported.expected.json`.

The fixture declares the exact plan-03 component IDs `markdown-emitter`,
`source-watcher`, and `typescript-observer`. It also demonstrates relationships
whose source and target IDs are supplied literally, an exact empty
`GromaRelationships` tuple, and readable text containing Markdown punctuation.
The observer does not read `groma/observed` or `groma/plans` to create or
reconcile that record.

## Relationship target resolution

Target resolution belongs to Markdown emission, not source observation. For a
relationship `targetId`, the emitter builds one revision-local index from:

1. the complete transient observation set, where each component's generated
   path is `<owned-components-directory>/<id>.md` and its readable name is the
   declared `name`; and
2. canonical element documents beneath `groma/observed` but outside the owned
   components directory, where the frontmatter `id`, level-one heading, and
   document path supply the target ID, readable name, and link destination.

Exactly one indexed element must own each target ID. The emitter computes a
relative Markdown link from the generated source document to that target. A
missing target or an ID present in both index sources rejects the complete
emission before any file is written or replaced. The previous generated
subtree remains unchanged. The emitter never consults `groma/plans` for target
names, paths, or existence.

## Unsupported direct input

Direct invocation is all-or-nothing. Its promise rejects with one error object
for any root that does not meet every rule above:

```text
name: UnsupportedSourceShapeError
code: GROMA_UNSUPPORTED_SOURCE_SHAPE
message: Repository does not match groma.typescript-bun/v1.
```

The observer returns no partial components, relationships, entry points, or
fallback extraction with that error. Missing or mismatched package markers,
unsupported source paths or extensions, absent or malformed reserved
declarations, duplicate IDs, filename/ID mismatches, unresolved entry-point
component IDs, and invalid relationship IDs are all the same unsupported
shape. No other observer error name, code, or message represents an unsupported
root. `fixtures/source-observation/unsupported/` is a Bun-shaped project
with ordinary TypeScript classes but no reserved declarations; invoking the
observer directly on it must return the exact error above rather than infer a
component from its class.

## Filesystem-watch scope

The source watcher admits events only for these repository-relative paths:

```text
package.json
src/index.ts
src/components/*.ts
```

The glob is non-recursive. Create, modify, and remove events inside this exact
set settle into one fresh complete observation. Every other path—including
`bun.lock`, `src/components/**` below the first level, other `src/**` files,
`groma/**`, tests, documentation, and editor metadata—is ignored before the
observer is invoked. An ignored event is not an unsupported-shape error and
does not refresh generated Markdown. Direct invocation remains free to reject
a root that contains an unsupported shape; the watch filter and direct input
validation are separate boundaries.

The standalone source-refresh process applies one short settle debounce to this
exact scope. Each settled burst runs a fresh complete observation followed by
one complete emitter replacement; it does not mutate an incremental graph,
infer renames, or retry with a partial observation. If another admitted event
arrives during a run, that event remains pending and causes a subsequent full
refresh only after its own quiet period. Observer or emitter failure is visible
on the source process, does not partially replace Markdown, and retains the
last-good generated subtree for a later valid event.

When the filesystem omits an event filename, the source process compares a
fingerprint of only the supported paths above. It refreshes if that bounded
snapshot changed and ignores the event otherwise. A temporary fingerprint read
failure is reported and settles into a normal full observation while the
last-good subtree and watcher remain available for recovery. A watch-handle
failure is terminal rather than leaving a partially blind process: all watch
handles and pending work close, the failure is reported, and the process exits
nonzero.

The source-refresh process and architecture viewer are separate services. The
viewer imports no source-observation code and continues to read and watch only
canonical Markdown beneath `groma/observed` and `groma/plans`.

## Generated Markdown ownership

The named observed parent is the hand-authored `scanner` container at
`groma/observed/systems/groma/containers/scanner/container.md`. Exactly one
directory is scanner/emitter-owned:

```text
groma/observed/systems/groma/containers/scanner/components/
```

A complete refresh may replace the contents of that directory and no other
path. Generated component filenames are `<component-id>.md` and their
frontmatter remains the canonical four-field contract: `id`, `kind:
component`, and `parent: scanner` (with no `external` field). The container
document itself, every person and system, every other container, every
component outside this exact directory, all revision indexes, and all
`groma/plans/**` files must remain byte-identical.

Generated component documents use the existing canonical Markdown model. They
add readable evidence only in the body:

```markdown
## Source evidence

- Component: `src/components/source-watcher.ts:1-6`
- Entry point: `src/index.ts:1-3`
- Relationship to `typescript-observer`: `src/components/source-watcher.ts:9-14`
```

There is no `claim`, lifecycle, confidence, source, or range frontmatter.
Evidence is not stored in a sidecar or alternate model.

### Deterministic Markdown escaping

Before placing any readable text in a heading, prose paragraph, technology
section, relationship link label, or relationship table cell, the emitter
applies one `escapeMarkdownText` operation. It iterates Unicode scalars without
normalizing them (v1 readable inputs are printable ASCII). For every ASCII
punctuation scalar in `U+0021–U+002F`,
`U+003A–U+0040`, `U+005B–U+0060`, or `U+007B–U+007E`, it emits U+005C
backslash followed by that scalar. Every other scalar is emitted unchanged.
Escaping is performed once, left-to-right, on the decoded value; inserted
backslashes are not processed again.

This rule makes a source `|` become `\|`, a source `\` become `\\`, and
Markdown delimiters such as `` ` ``, `*`, `_`, `[`, and `]` become escaped
literal text. The same operation is used in GFM table cells, so a declared pipe
cannot create a column and a declared backslash cannot consume the pipe escape.
Static Markdown syntax—heading markers, table separators, link destinations,
and evidence code-span delimiters—is not passed through this operation.

For example, the supported fixture's decoded values and emitted text include:

```text
name input:       Markdown | emitter \ [safe]
heading output:  # Markdown \| emitter \\ \[safe\]

description input:  Writes *bounded* observations _without_ ambiguity.
prose output:       Writes \*bounded\* observations \_without\_ ambiguity\.
```

`fixtures/source-observation/supported.expected-markdown-text.json` is the
deterministic escaping oracle for both component prose and a relationship table
row. Applying the readable-text validation or escaping rules differently is
outside this contract.

## Read-only and non-goals

Observation opens only `package.json`, `src/index.ts`, and direct
`src/components/*.ts` declaration files for reading. It never imports,
evaluates, transpiles, type-checks, or executes project code and never runs a
package script. It never reads a plan or uses plan contents to choose IDs.

This contract does not define plugins, a framework catalog, confidence scores,
rename reconciliation, automatic plan promotion, generalized AST semantics,
call-graph inference, native descriptor-relative ancestor traversal, security
against adversarial concurrent directory-topology replacement, or
partial/fallback extraction.
