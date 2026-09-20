---
type: Groma Flow
title: Install a published scanner
groma:
  id: install-a-published-scanner
---

A developer runs groma scanner add with a published package name. Groma resolves a compatible release from the configured npm-compatible registry, installs it, validates the package, and records the exact selected source in project scanner settings. The scanner is then available for the next scan.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Developer](../actors/developer.md) | [Command interface](../systems/groma-md/containers/cli/components/src-cli.md) | Run groma scanner add with a published package name |
| [Command interface](../systems/groma-md/containers/cli/components/src-cli.md) | [Plugin packages](../systems/groma-md/containers/cli/components/package.md) | Resolve and install the requested scanner |
| [Plugin packages](../systems/groma-md/containers/cli/components/package.md) | [Scanner package registry](../externals/scanner-package-registry.md) | Read compatible releases, then download the selected package and dependencies |
