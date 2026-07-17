---
schema: groma/v0.1
id: ent_8b3e9cd7aa686d68360c8bf0da2b1b3c
kind: component
name: Markdown Intent Store
type: component
parent: ent_3c633e11bc0b24c292af7177e8db27bb
inputs:
  - id: itm_3aacf4446bb13eb1cf06de42ddf75804
    name: declared relations
  - id: itm_8b1c32636081bb0fcd92f097b4963164
    name: structural parent references
  - id: itm_a515924b9a3ea0012536aad8a9fa4fcb
    name: Components
  - id: itm_ba2dd9571758ffd9e98561a07430f7a4
    name: model extensions
  - id: itm_cf6196b658f086ba10cbe7ac9dbc0326
    name: embedded interface items
outputs:
  - id: itm_58b0b47af2b1998248273c4d0b46f636
    name: Versioned intent documents
  - id: itm_5cfd618a946f1a72c8a5f7147d634e62
    name: parsed semantic entities
  - id: itm_ffe949f5eb5a23aba74921e8381441c4
    name: content revisions
actions:
  - id: itm_2ceda1e4ebb439f46a3255fd2d326175
    name: Load and serialize intent
  - id: itm_766135bc07723d8dfeb41a858446726d
    name: shard by stable identity
  - id: itm_881e4e2cec101697259dbd9dfed4a7e1
    name: preserve unknown extensions
  - id: itm_ff2dca48c1925c1cdfdafce901f18e2c
    name: diagnose malformed or conflicted documents
relationships:
  - id: rel_756e7226bc3ba2488c68fa079ca1b202
    type: relates-to
    target: ent_36f3d9cd50377cc2aa601ee35d00509b
    description: uses Local Resource Provider
groma.md/first-delivery: 1A
groma.md/relationship-declarations:
  - key: decl_291cbc8203f051341d9cfa729919f864
    status: ambiguous
    text: Implements canonical-store capabilities
  - edgeIds:
      - rel_756e7226bc3ba2488c68fa079ca1b202
    key: decl_ef16f9b86059416c8164e97d271012b4
    status: edge
    text: uses Local Resource Provider
  - key: decl_d57e4ad926179b81c4445e19aa121b65
    status: constraint
    text: never receives scanner observations directly
groma.md/seed-key: markdown-intent-store
---

# Intent

Persist human- and agent-curated architectural meaning as deterministic, reviewable Markdown without mixing it with scan churn.
