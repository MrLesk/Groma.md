# Groma plans

Each directory under `groma/plans/` is one fragment of desired architecture.
Groma creates and updates these files. Per the
[product model](../../docs/product-model.md), a plan README declares one
immutable plan ID. The directory holds only element Markdown that is not yet
accepted.

A plan may name an observed parent. A required change restates an observed
ID so the same box shows work still to do. Two plans must not claim the same
element ID.

Plans describe outcomes and requirements, not an implementation stack.
Explanations of an existing element stay on the observed document; Groma
does not put those in a plan.

`groma accept <id>` applies that ghost only when a scan has matched it. No
match: the command fails. A plan with no element Markdown left is complete.
Its README remains as the plan record.

The current product direction is the single [MVP plan](mvp/README.md).
