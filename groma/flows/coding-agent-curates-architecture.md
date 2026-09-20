---
type: Groma Flow
title: Coding agent curates architecture
groma:
  id: coding-agent-curates-architecture
---

An AI assistant uses Groma while carrying out a developer request. After inspecting the source and current architecture, it submits an explicit overview edit through the CLI. Groma validates and writes the record, then reports the result to the assistant. The assistant owns the reasoning; Groma owns validation and persistence of the requested change.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Coding agent](../actors/coding-agent.md) | [Command interface](../systems/groma-md/containers/cli/components/src-cli.md) | Submit an evidence-based groma edit for an existing element |
| [Command interface](../systems/groma-md/containers/cli/components/src-cli.md) | [Architecture changes](../systems/groma-md/containers/cli/components/src-authoring.md) | Dispatch the requested architecture edit |
| [Architecture changes](../systems/groma-md/containers/cli/components/src-authoring.md) | [Markdown storage](../systems/groma-md/containers/cli/components/src-architecture-reader.md) | Persist the validated explanation in Markdown |
