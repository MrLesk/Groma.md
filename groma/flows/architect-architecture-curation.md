---
type: Groma Flow
title: 'Architect: architecture curation'
groma:
  id: architect-architecture-curation
---

Give scanned evidence an architectural meaning through the command line. The curation operation validates the requested structural change and saves the resulting authored records.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Human architect][human-architect] | [Commands][commands] | Start architecture curation |
| [Commands][commands] | [Observed curation][observed-curation] | Submit a structural curation command |
| [Observed curation][observed-curation] | [Architecture model][architecture-model] | Validate ownership and the requested change |
| [Observed curation][observed-curation] | [Architecture writer][architecture-writer] | Write the validated architecture changes |
| [Architecture writer][architecture-writer] | [Groma filesystem][groma-filesystem] | Save the changed architecture records |

[human-architect]: ../actors/human-architect.md
[commands]: ../systems/groma/containers/cli/components/commands.md
[observed-curation]: ../systems/groma/containers/cli/components/observed-curation.md
[architecture-model]: ../systems/groma/containers/core/components/architecture-model.md
[architecture-writer]: ../systems/groma/containers/core/components/architecture-writer.md
[groma-filesystem]: ../systems/groma/containers/core/components/groma-filesystem.md
