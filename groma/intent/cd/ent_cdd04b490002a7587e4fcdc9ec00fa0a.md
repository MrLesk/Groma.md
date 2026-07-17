---
schema: groma/v0.1
id: ent_cdd04b490002a7587e4fcdc9ec00fa0a
kind: component
name: Bootstrap Configuration
type: component
parent: ent_62fa113ff584f566c68a702c450d7f7a
inputs:
  - id: itm_27ca3ae550dd4ced4b8bbca78e258c9c
    name: Bootstrap resource context
  - id: itm_323bdb95f0b923e3282e3a4843a2b9e3
    name: config-parser providers
  - id: itm_35800180feaea1c7655171263249ddea
    name: config-discovery providers
outputs:
  - id: itm_197e1dc38005102528748376b0bbc6ea
    name: Workspace locator
  - id: itm_3286d8d1e54516d59c0bd22b4e592e70
    name: requested runtime plugins
  - id: itm_7514e8a074a4dc206859bcd77bf35c79
    name: typed base configuration
actions:
  - id: itm_2d122f876d5b4dcb5845c8c771b6a2ae
    name: Search for configuration
  - id: itm_a2d6eeb7d8bdd0503e910fe981546e82
    name: report no-workspace state
  - id: itm_a5724e6c2c2036ccd06d3f8237a8031e
    name: reject ambiguous or incompatible bootstrap providers
  - id: itm_ffa30720c75fb49bd2a67dc03dda2a74
    name: parse configuration
relationships:
  - id: rel_4a425a55d0f7c65fdc4a4c0348387b10
    type: relates-to
    target: ent_f5e8a107d322fa16831edd20867ad6d8
    description: Runs in Plugin Runtime Phase 0
groma.md/first-delivery: 1B
groma.md/relationship-declarations:
  - edgeIds:
      - rel_4a425a55d0f7c65fdc4a4c0348387b10
    key: decl_9babd08a9d4c45d3ffe441c78eb73614
    status: edge
    text: Runs in Plugin Runtime Phase 0
  - key: decl_bb5925cac36296ea334e641c8075144a
    status: ambiguous
    text: official profile uses Local Resources and YAML Configuration providers
groma.md/seed-key: bootstrap-configuration
---

# Intent

Discover and load configuration before the runtime plugin graph exists, while keeping filesystem and YAML assumptions replaceable.
