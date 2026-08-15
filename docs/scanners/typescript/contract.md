# TypeScript scanner contract

The TypeScript scanner plugin adapts supported TypeScript source to Groma's
scanner-plugin interface. It returns Groma's shared scan-result model with
no architecture IDs.

There is no approved source shape yet. The plugin will recognize only shapes
documented here from a real example. That example must use ordinary
TypeScript. It must not require Groma-specific types, comments, IDs, or
renames in application source.

Until that example exists, `groma scan` has no TypeScript mapping to apply.
A viewer still shows authored observed Markdown and planned ghosts.

Core owns identity and Markdown. A later scan may refresh `code` frontmatter.
It never rewrites a stable ID or a curated body, and it never turns a
ghost into observed architecture.
