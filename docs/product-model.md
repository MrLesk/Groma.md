# Product model

Groma stores a C4-compatible architecture model in Markdown. This document defines how observed architecture, plans,
and revisions relate to one another. The [component Markdown contract](../groma/README.md) defines the exact document
format.

## Observed architecture

Observed architecture is the architecture currently known to exist. Its canonical Markdown lives under
`groma/observed/` and may combine hand-authored elements with scanner-generated elements. It is the only authored
complete state.

## Plans

A plan is an independent, mutable description of one desired feature. It lives under `groma/plans/<feature>/` and
contains a README plus only the element Markdown not yet implemented. Element paths mirror their eventual location under
observed architecture.

A plan is a partial overlay, not a complete architecture, a numbered step, or the successor of another plan. Plans do
not build on one another and have no order. Groma composes one selected plan with observed architecture to produce a
complete model.

The numbered directories currently under `groma/plans/` predate this contract. Each is a cumulative complete state and
remains a valid input to the shipped viewer until it is migrated to a scoped feature plan.

## Revisions

A revision is the immutable architecture state represented by a Git commit and identified by its SHA. Revisions are not
stored as directories. A plan may materialize across any number of revisions. Git history is the only archive, and Groma
records no plan-to-revision mapping.

## Implementation lifecycle

Implementing a planned element moves its Markdown into observed architecture:

```text
groma/plans/<feature>/<element>.md
                ↓ implemented
groma/observed/<element>.md
```

A planned change to an existing element is its desired version at the same relative path. Implementing that change
replaces the observed file and removes the planned file in the same commit.

The plan drains as implementation lands, so its remaining content shows its progress. When no element Markdown remains,
the plan is complete and its README and directory are deleted. The README does not move into observed architecture.
There is no archive directory, status field, lock file, or lifecycle metadata.

## Comparison

Groma matches elements by stable ID and derives comparison state rather than storing it in Markdown:

- an element present only in the plan is a ghost addition;
- an element present only in observed architecture is a planned removal;
- a shared element is modified when its C4 properties or outgoing relationships differ; and
- a shared element with no such differences is unchanged.

Directory names, Markdown paths, and transient viewer state do not affect the comparison.

Observed elements provide the implemented foundation. Remaining plan elements provide desired additions and changes.
Moving through Git revisions shows planned Markdown materializing into observed architecture.

Planned removal syntax, concurrent plans changing the same element, and non-Git revision providers remain deliberately
undefined until an approved example requires them.
