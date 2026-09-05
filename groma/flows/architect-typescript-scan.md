---
type: Groma Flow
title: 'Architect: TypeScript scan'
groma:
  id: architect-typescript-scan
---

Scan the current TypeScript repository and fold its complete evidence into the authored architecture. Existing ownership stays authoritative while code references and measurements are refreshed.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Human architect][human-architect] | [Commands][commands] | Start TypeScript scan |
| [Commands][commands] | [Scan lifecycle][scan-lifecycle] | Start a complete source scan |
| [Scan lifecycle][scan-lifecycle] | [Scanner modules][scanner-modules] | Load the configured TypeScript scanner |
| [Scan lifecycle][scan-lifecycle] | [TypeScript scanner][typescript-scanner] | Collect TypeScript source evidence |
| [TypeScript scanner][typescript-scanner] | [Git][git] | Find tracked and unignored source files |
| [TypeScript scanner][typescript-scanner] | [Scan observation][scan-observation] | Publish the complete TypeScript observation |
| [Scan lifecycle][scan-lifecycle] | [Scan observation][scan-observation] | Validate the evidence batch |
| [Scan lifecycle][scan-lifecycle] | [Architecture reader][architecture-reader] | Read the existing architecture ownership |
| [Architecture reader][architecture-reader] | [Groma filesystem][groma-filesystem] | Read the selected architecture tree |
| [Scan lifecycle][scan-lifecycle] | [Architecture writer][architecture-writer] | Fold the evidence into architecture Markdown |
| [Architecture writer][architecture-writer] | [Groma filesystem][groma-filesystem] | Save the refreshed architecture records |

[human-architect]: ../actors/human-architect.md
[commands]: ../systems/groma/containers/cli/components/commands.md
[scan-lifecycle]: ../systems/groma/containers/scanner/components/scan-lifecycle.md
[scanner-modules]: ../systems/groma/containers/scanner/components/scanner-modules.md
[typescript-scanner]: ../systems/groma/containers/scanner/components/typescript-scanner.md
[git]: ../externals/git.md
[scan-observation]: ../systems/groma/containers/scanner/components/scan-observation.md
[architecture-reader]: ../systems/groma/containers/core/components/architecture-reader.md
[groma-filesystem]: ../systems/groma/containers/core/components/groma-filesystem.md
[architecture-writer]: ../systems/groma/containers/core/components/architecture-writer.md
