---
schema: groma/v0.1
id: ent_7300e8c4b465e277a6a4fdecaa8d4cfa
kind: component
name: Plugin Scaffolding
type: component
parent: ent_b961ea37d6bcaca8b6d79a5c68fe33b0
inputs:
  - id: itm_6e79083c6b95046c19dd85dd1f59bdb6
    name: Plugin name
  - id: itm_a0567868cbc8979a95a0148a85dfc08c
    name: intended capability contributions
  - id: itm_d83d515bf474f7e291daf930600a0abf
    name: local destination
outputs:
  - id: itm_017d0c2e2f4cd23e0cb36f3c915bb77c
    name: entry point
  - id: itm_232dec3f16d449e9daed0985e9b1d90d
    name: conformance-test starting point
  - id: itm_37a01f2a543693466d49cb45e6a9f030
    name: Plugin manifest
actions:
  - id: itm_33e7abc5db744aa35ac1f9166f244d7e
    name: generate minimal files
  - id: itm_3a008aff2a3f80843cbb44473e4a98c3
    name: Validate plugin identity
  - id: itm_b7652f78f66e759c65b72dccb519cddb
    name: select relevant public contracts
  - id: itm_f26c5d3099dcdde3e1e6c0ed12b953e2
    name: avoid unused capability placeholders
relationships:
  - id: rel_2b4137a31045f2428f9e99fb3e448c06
    type: relates-to
    target: ent_4f59f67d83d0cd952daa0c93a21545f3
    description: uses Plugin SDK
  - id: rel_7fba7044d1a48de2fc8e71d03c753738
    type: relates-to
    target: ent_f396b626740ffefdbf4116f5322c77cf
    description: Exposed through CLI
groma.md/first-delivery: "3"
groma.md/relationship-declarations:
  - edgeIds:
      - rel_7fba7044d1a48de2fc8e71d03c753738
    key: decl_211c3461c5ea1372750385236c2f61db
    status: edge
    text: Exposed through CLI
  - edgeIds:
      - rel_2b4137a31045f2428f9e99fb3e448c06
    key: decl_e89cade0ee02b7966775386a17f225a7
    status: edge
    text: uses Plugin SDK
  - key: decl_99ed3e7bc1edf0765a581b8eae1263a9
    status: constraint
    text: remote discovery and marketplace discovery remain outside v0.1
groma.md/seed-key: plugin-scaffolding
---

# Intent

Create a minimal local plugin skeleton that follows public capability and manifest conventions without coupling authors to repository internals.
