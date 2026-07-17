---
schema: groma/v0.1
id: ent_ab4fda71aea2135210ac6565dca1bfa0
kind: component
name: External Observation Submission
type: component
parent: ent_2a4b2e357b395b275bb51aa8dabfbfc0
inputs:
  - id: itm_eb6eed0cb4361b32a0daceda674d60ee
    name: Versioned framed begin, observation, heartbeat, and complete records from a file or standard input
outputs:
  - id: itm_43968517a9c03377aaa7e669e4ad8f13
    name: Validated observation session
  - id: itm_cb424f12094da7032dc943225101e76c
    name: final submission result
actions:
  - id: itm_143de7f3c8b496e11bf8f1f9cd3412e0
    name: pass observations to the standard sink
  - id: itm_6eb16f55501eac0859a69107e5fe4e9c
    name: reject incomplete streams
  - id: itm_72b62bc3399747bd69ad37197968eb00
    name: Decode transport
  - id: itm_7ea22b64691df0fc129d9eef0a6f8374
    name: enforce session lifecycle
relationships:
  - id: rel_ab355694504f605464c334d722802722
    type: relates-to
    target: ent_179c0e34cd0e046bcf651d0a58ca4996
    description: CLI adapter over Observation Contract
  - id: rel_c3dc589ece3781b372d215a2071d1402
    type: relates-to
    target: ent_03913cb2e84d458897038ac666c72506
    description: processed by Reconciliation Engine
groma.md/first-delivery: "3"
groma.md/relationship-declarations:
  - edgeIds:
      - rel_ab355694504f605464c334d722802722
    key: decl_51d6aac6399e527d6a25936abbb4a279
    status: edge
    text: CLI adapter over Observation Contract
  - key: decl_0c7891c559c9928e59067409c2bfdee1
    status: constraint
    text: independent of CLI result formats
  - edgeIds:
      - rel_c3dc589ece3781b372d215a2071d1402
    key: decl_effe2cede3d4b5941aa7b57cf240183a
    status: edge
    text: processed by Reconciliation Engine
groma.md/seed-key: external-observation-submission
---

# Intent

Let external agents, humans, and independent scanners report observations through the same safe session model without editing canonical files.
