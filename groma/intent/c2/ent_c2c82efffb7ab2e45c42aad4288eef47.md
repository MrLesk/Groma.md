---
schema: groma/v0.1
id: ent_c2c82efffb7ab2e45c42aad4288eef47
kind: component
name: Projection Index
type: component
parent: ent_f84d88a45bc71392e87251a9e53e5344
inputs:
  - id: itm_0a88ffd38628043bf747e92b8124fbe7
    name: Canonical documents
  - id: itm_77d4fa3ab23ec2e190f7016fa877a822
    name: evidence and bindings
  - id: itm_7e1dd968d30e2bccdaa6e732df779564
    name: aliases
  - id: itm_ecade1351ca6e4d9f8f388a4b506860c
    name: committed generation events
outputs:
  - id: itm_0bf3674e5dd0d2f7ee58d8e28578ef37
    name: adjacency
  - id: itm_12275ece7f8a694f60fe14bb0a7c0907
    name: search results
  - id: itm_3488766abe94095300ab799fe3269c76
    name: Indexed entities
  - id: itm_bc80595aaf4fe88a76a0f7bccaef94f7
    name: derived states
  - id: itm_c3c610917df56307d58d1b7fe214814e
    name: generation watermark
actions:
  - id: itm_0c29416e5fd570b685a8c70fcb253c7e
    name: incrementally repair changed files
  - id: itm_1acedbbd02a0a6fc23b5dd8e4887bcad
    name: Rebuild from canonical state
  - id: itm_49b6f12b404b96377a7cff193d1a4ccb
    name: join intent and evidence
  - id: itm_fc9d228847d57973ede604fec0d4a5e4
    name: materialize plan projections
relationships:
  - id: rel_6e993b5589386ce2153c7db82ba51267
    type: relates-to
    target: ent_86ed24ba36882dc4365a08293ffeb90b
    description: uses canonical stores but never becomes authoritative
  - id: rel_c1b44f4186bfb1ba6b5608940ffa47b0
    type: relates-to
    target: ent_6e17f657cc00d57287127e6b8336ac52
    description: Implements projection capability for Query Engine
groma.md/first-delivery: 1B
groma.md/relationship-declarations:
  - edgeIds:
      - rel_c1b44f4186bfb1ba6b5608940ffa47b0
    key: decl_e4b754740d7cc027a8b2fc9a2d6ddecf
    status: edge
    text: Implements projection capability for Query Engine
  - edgeIds:
      - rel_6e993b5589386ce2153c7db82ba51267
    key: decl_2e48e28c368cda343b7cd6610ade2924
    status: partial
    text: uses canonical stores but never becomes authoritative
groma.md/seed-key: projection-index
---

# Intent

Materialize canonical state into a fast local index for search, joins, traversal, evidence state, and plan views.
