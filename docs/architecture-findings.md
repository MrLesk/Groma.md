# Architecture findings

## CLI check

Run `groma lint` to check for architecture issues. The first rule reports possible
duplicate logic, with operation names and source file:line locations. It uses
current evidence from configured, installed scanners and respects project
exclusions. It does not write architecture records or change scanner selections.

The command exits with code 1 when it finds issues or a scanner fails, and 0
otherwise. An empty result applies only to the available scanner evidence;
it does not mean that every source file was checked. Run `groma scanner list`
to see which scanners are installed.

## Review findings

Architecture findings are review questions about implementations, not map
collaborations. They do not become C4 elements, containment, or relationship
rows. An ordinary Markdown reader of the architecture tree never sees them.
Groma interprets scanner facts after a scan and shows copies next to the
operations they concern: under Code in How it's built, and in the scan listing.
Exact copies list the other operations by name and file:line; similar copies add
that they are not identical. Token bags stay off the listing. What it does does not dump findings.

The web toolbar's review icon opens **Project review**, showing **Potential duplicates**
across the project. The neutral icon has a dot when findings are available.
Plugin management lives separately in **Settings → Plugins**. Project review filters groups by
component and match type; a component filter retains copies owned elsewhere.
The filters sit beside the section heading. Click a group to expand its source
comparison directly below the row. Click it again to collapse it. Opening another
group closes the previous comparison. Choose two occurrences to compare their
source ranges. The dialog has no enlarge control.
Highlighted lines show textual differences, not a new similarity judgment.
Each owned occurrence can open its source or select its component on the map.
Closing the popup restores the underlying inspector and cancels pending
source comparisons. New world payloads replace
the findings and cancel pending comparisons. Views without findings say that
none are available; they do not claim that every project source was compared.

## Ownership

```text
source → scanner tokens (temporary) → core comparison → findings on the annotated world
```

Scanners report source ranges and binding-normalized tokens for named
operations. They do not decide that duplication is a problem. Core fingerprints those
tokens, groups exact clones and near-duplicates, maps each instance to its
component owner, and lists concrete token differences. Fingerprints stay in
memory for the current process. A scan never writes suspected duplication as
an architecture relationship or merges components.

## What the first rule claims

Local names are slots that follow declarations, including nested scopes.
Operators, literals, property names, and unresolved identifiers remain. Two
bodies that match after that normalization are **structurally duplicated
logic**. Near-matches add the tokens that are not shared. Neither claim
proves that the operations implement one business rule or that they should
share an implementation.

## Compared operations

A scanner attaches a source range and body tokens only to a **named
operation**: a function, method, or constructor declared with its own name,
or a function assigned to a named variable or written as a property value of
an object literal, except in the argument case below. Core compares only
operations that carry tokens. A scanner attaches none to:

- module and other initializer code;
- **anonymous callbacks**: lambdas, closures, and function expressions without
  a declared name, and functions written as property values of an object, map,
  or dictionary literal passed directly as an argument of a function call, a
  constructor call, or a decorator, such as `subscribe({ next: ..., error: ... })`.

The covered languages are
[TypeScript](scanners/typescript/index.md#compared-operations),
[Vue](scanners/vue/index.md#compared-operations),
[Java](scanners/java/index.md#compared-operations),
[C#](scanners/dotnet-csharp/index.md#compared-operations),
[Go](scanners/go/index.md#compared-operations),
[Rust](scanners/rust/index.md#compared-operations),
[Python](scanners/python/index.md#compared-operations) and
[PHP](scanners/php/index.md#compared-operations). Each page lists the operations
its scanner compares and its own exceptions, including whether a function
literal assigned to a name is compared: TypeScript, Go and Vue compare those,
while Java, C#, Rust, Python and PHP treat every closure and lambda as an
anonymous callback.

Core applies both minimum body sizes, counted in binding-normalized tokens, so
scanners report every named body regardless of its size:

- **Identical copies** need at least 8 tokens in each body.
- **Near-duplicates** need at least 24 tokens in each body. In smaller bodies,
  one or two changed tokens, such as `up` and `down`, still pass the similarity
  ratio, so mirrored operations would be reported as shared logic.

Test files already excluded by the TypeScript scanner are not compared.

## OKF and C4

A finding is supporting knowledge about existing components. OKF readers
understand the architecture without it. C4 still owns actors, systems,
containers, components, and relationships. Groma owns the comparison and the
viewer presentation.
