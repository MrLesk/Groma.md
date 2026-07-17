---
schema: groma/v0.1
id: ent_0eeeda674ddad0d0bccdea9545683de9
kind: component
name: Scanner Runtime
type: component
parent: ent_2a4b2e357b395b275bb51aa8dabfbfc0
inputs:
  - id: itm_0607eb3d9f90cdc2ef19f2ce769ee332
    name: Project scanner configuration
  - id: itm_1e7c218e19bcb3cdaca59715dc36393c
    name: scanner capability
  - id: itm_1fd67ca1cad3ab98013c9a0e9902a79e
    name: scope
  - id: itm_8704d98bf5978701c28244476213412d
    name: lease and cancellation policy
outputs:
  - id: itm_2b722eb064f9f0ce01bc940684690ef2
    name: failure and abandonment state
  - id: itm_6f1d331aad6144f1785d7cdfeb631055
    name: Observation sessions
  - id: itm_fba7bca1829dd5036cc01410313e66b7
    name: progress
actions:
  - id: itm_043317bcb860f00879bae7e1eec866bd
    name: fence epochs
  - id: itm_3669dc9ad7f316b347ebdca3b873dec5
    name: expose provisional progress
  - id: itm_6337d29f065985f6e1c379f0498713a9
    name: validate declared scope
  - id: itm_91990e2a1a30133ead90df50f8d18a41
    name: maintain heartbeats
  - id: itm_b19f8e71416db99436d38c9aaa390dcd
    name: Start scanners
  - id: itm_b283635e2c80d73cd8383ce7156db333
    name: terminate or abandon sessions
relationships:
  - id: rel_148c7911b71a753dc49052f6b3e1ac45
    type: relates-to
    target: ent_179c0e34cd0e046bcf651d0a58ca4996
    description: Uses Project Registry and Observation Contract
  - id: rel_73eadfde5af15619a4accc1b9b693590
    type: relates-to
    target: ent_03913cb2e84d458897038ac666c72506
    description: sends completed sessions to Reconciliation Engine
  - id: rel_7cb74a5f138ce39417f84dd50e9263bc
    type: relates-to
    target: ent_ddb045072331a4f7ba46644e51feaf5b
    description: Uses Project Registry and Observation Contract
groma.md/first-delivery: "2"
groma.md/relationship-declarations:
  - edgeIds:
      - rel_7cb74a5f138ce39417f84dd50e9263bc
      - rel_148c7911b71a753dc49052f6b3e1ac45
    key: decl_1a89968ccba79e5ab173832c3f9610ce
    status: edge
    text: Uses Project Registry and Observation Contract
  - edgeIds:
      - rel_73eadfde5af15619a4accc1b9b693590
    key: decl_42b85f0efcc3b9826f89adae3189f224
    status: edge
    text: sends completed sessions to Reconciliation Engine
  - key: decl_7fc1b413cf13c26c1753111fa20e775c
    status: constraint
    text: never supplies blueprint state to scanners
groma.md/seed-key: scanner-runtime
---

# Intent

Execute blind scanner plugins as finite, cancellable, scoped observation sessions.
