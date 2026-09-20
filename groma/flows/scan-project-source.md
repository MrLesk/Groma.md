---
type: Groma Flow
title: Scan project source
groma:
  id: scan-project-source
---

A developer runs groma scan for a project with configured scanners. Groma collects source evidence, reconciles successful results with existing ownership, and writes the updated architecture records. The command reports the scan result; the records can then be inspected and curated.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Developer](../actors/developer.md) | [Command interface](../systems/groma-md/containers/cli/components/src-cli.md) | Run groma scan |
| [Command interface](../systems/groma-md/containers/cli/components/src-cli.md) | [Scan results](../systems/groma-md/containers/cli/components/src-scanner.md) | Start the requested source scan |
| [Scan results](../systems/groma-md/containers/cli/components/src-scanner.md) | [Scanner execution](../systems/groma-md/containers/cli/components/scanner-registry.md) | Collect evidence from the configured scanners |
| [Scan results](../systems/groma-md/containers/cli/components/src-scanner.md) | [Markdown storage](../systems/groma-md/containers/cli/components/src-architecture-reader.md) | After successful analysis, write reconciled source ownership and architecture records |
