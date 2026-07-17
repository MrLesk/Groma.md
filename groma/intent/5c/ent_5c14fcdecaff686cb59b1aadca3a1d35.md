---
schema: groma/v0.1
id: ent_5c14fcdecaff686cb59b1aadca3a1d35
kind: component
name: Git Revision Provider
type: component
parent: ent_4d168063306ab7b50c5cfa8f733621b4
inputs:
  - id: itm_2c9624e92e2da56c8d6a5729c292aa00
    name: repository context
  - id: itm_dc06c2d1f9c8abab0a70bb700307287f
    name: Git reference
  - id: itm_e6cff028cff9d7053a0d98922113cfc3
    name: canonical resource request
outputs:
  - id: itm_610b2672a0214359e3f177b479650b63
    name: unavailable or conflicted revision diagnostics
  - id: itm_94081bd59f41ebe6faa9cdd262d50ee3
    name: Read-only historical canonical view
actions:
  - id: itm_9df389696498ebec8b8ed0a258802045
    name: load historical resources
  - id: itm_ed1c3b1e81c89447f65bb02ec7b26138
    name: preserve historical identity and aliases
  - id: itm_f1989ffa793103eddbdbbbb6042b81ad
    name: Resolve revisions
  - id: itm_fb910e66b7a931134103730c61dbc7bb
    name: build a temporary view
relationships:
  - id: rel_bc7a56ba1f296eea5305a0a5f82d5eed
    type: relates-to
    target: ent_cbf27c2a68dd114ea57e185608959484
    description: Implements historical view capability for View Resolver
groma.md/first-delivery: "3"
groma.md/relationship-declarations:
  - edgeIds:
      - rel_bc7a56ba1f296eea5305a0a5f82d5eed
    key: decl_7150d60bd1b4c91f885cbb7142a3c817
    status: edge
    text: Implements historical view capability for View Resolver
  - key: decl_05011d74a6f49603fd4b6ee62562a470
    status: constraint
    text: optional in non-Git host profiles
groma.md/seed-key: git-revision-provider
---

# Intent

Reconstruct past canonical blueprints from Git without placing Git concepts in Core.
