# TypeScript scanner

The TypeScript scanner plugin implements Groma's scanner-plugin interface for TypeScript projects. It adapts TypeScript
and ecosystem-specific source evidence into Groma's shared scan-result model for Groma core.

The plugin receives a project root and discovers the project's own organization. TypeScript configuration, package
metadata, framework conventions, declarations, imports, and calls provide evidence for architectural interpretation.

The surrounding scanner owns source watching. Groma core evaluates the transient result and decides what becomes
observed or missing architecture. This keeps source interpretation inside the plugin and persistence decisions inside
the core domain.

The [TypeScript scanner contract](contract.md) defines the intended project compatibility, architectural interpretation,
shared-interface boundary, and core handoff.
