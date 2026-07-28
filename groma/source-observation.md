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

The reserved declarations below are type-only TypeScript. They require no
decorator, runtime helper, import, build step, type checker, or project code
execution. The observer reads their literal text and treats all later,
non-reserved TypeScript statements as opaque.

Source files are UTF-8 text with LF line endings and a final LF. The reserved
declaration starts on line 1. Within a reserved declaration, every keyword,
space, indentation level, colon, semicolon, comma, bracket, and blank line
shown below is literal and required. Metavariables inside angle brackets are
the only replaceable text. Their values use JSON double-quoted string syntax
on one physical line. Comments and extra blank lines are not permitted before
or inside a reserved declaration.

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
`description`, and `technology` are non-empty JSON string literals on one line.
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
are ordered by source range. The supported fixture's exact record is
`fixtures/source-observation/supported.expected.json`.

The fixture declares the exact plan-03 component IDs `markdown-emitter`,
`source-watcher`, and `typescript-observer`. It also demonstrates relationships
whose source and target IDs are supplied literally. The observer does not read
`groma/observed` or `groma/plans` to create or reconcile that record.

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

## Read-only and non-goals

Observation opens only `package.json`, `src/index.ts`, and direct
`src/components/*.ts` declaration files for reading. It never imports,
evaluates, transpiles, type-checks, or executes project code and never runs a
package script. It never reads a plan or uses plan contents to choose IDs.

This contract does not define plugins, a framework catalog, confidence scores,
rename reconciliation, automatic plan promotion, generalized AST semantics,
call-graph inference, or partial/fallback extraction.
