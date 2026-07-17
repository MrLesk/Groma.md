---
schema: groma/v0.1
id: ent_ada9c8131d7fe79af98ecefc79908ca7
kind: component
name: Graph Kernel
type: component
parent: ent_71dbd1434f56e6d169aad3f543ac0cdc
inputs:
  - id: itm_5d2fe1cf11d01e5328fd544ad09b005a
    name: relation definitions
  - id: itm_ae816cf724c657c896446a9e7289b341
    name: registered model invariants
  - id: itm_cab7c36127ab41203d39119de268138b
    name: Entity definitions
  - id: itm_fd7fa9581692b50ae92a564a2778be97
    name: identity requests
outputs:
  - id: itm_455309f30719bbbadc18fbaf818278c3
    name: invariant diagnostics
  - id: itm_8bf8ddc6fec5baca6b4560729fb45be1
    name: resolvable relations
  - id: itm_b2b4dc596ab4415209ce9d34bcbc29a5
    name: identity and alias results
  - id: itm_f53f07bd99b25f34fb9de9e0ce569dfb
    name: Stable entities
actions:
  - id: itm_64d5e476bd1e810882b8fb3327a59019
    name: expose bounded graph primitives
  - id: itm_68e909d224a89c6f07a33d85366ca7f7
    name: resolve aliases
  - id: itm_8bbf8e615c82a5df160d23afcc8010bd
    name: Mint identities
  - id: itm_b505654de71f81e1c2ebe5f4a6948d35
    name: validate graph references
relationships:
  - id: rel_31c8df6c2873d578cc24458d94185058
    type: relates-to
    target: ent_c6335fe22ac1924249da491006cae1cd
    description: Used by every model and application operation
  - id: rel_f4b3b3c5fba14e503d6141b31fa3cbd6
    type: relates-to
    target: ent_070e99832ea99591e070ab3059f9db48
    description: delegates model-specific meaning to the Standard Blueprint Model
groma.md/first-delivery: 1A
groma.md/relationship-declarations:
  - edgeIds:
      - rel_31c8df6c2873d578cc24458d94185058
    key: decl_227545e2b71d5919fdc44fc0af808a17
    status: partial
    text: Used by every model and application operation
  - edgeIds:
      - rel_f4b3b3c5fba14e503d6141b31fa3cbd6
    key: decl_6e9bb9bfad7bb9c204466f7727dd2ec1
    status: edge
    text: delegates model-specific meaning to the Standard Blueprint Model
groma.md/seed-key: graph-kernel
---

# Intent

Give every architectural concept stable identity and a common graph representation without prescribing a storage or surface technology.
