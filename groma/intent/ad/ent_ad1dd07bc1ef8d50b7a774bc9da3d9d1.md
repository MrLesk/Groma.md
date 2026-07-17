---
schema: groma/v0.1
id: ent_ad1dd07bc1ef8d50b7a774bc9da3d9d1
kind: component
name: Web Viewer and Editor
type: component
parent: ent_5eace865414b153d77cc6a0786b1c36e
inputs:
  - id: itm_0a641dab2a58869b937a2c07b9dc0c0b
    name: current, plan, and diff views
  - id: itm_3d78cd2da4a3b1dc95258c21bfddd6e8
    name: Bounded subgraphs
  - id: itm_40be35033ba58911c8ac5fc6b97ea28f
    name: search and filters
  - id: itm_7c98f7c41d171c6abc0cffdcd06ccaf0
    name: semantic edit requests
outputs:
  - id: itm_17860e5e2799e567cb50f111979a73dd
    name: conflict-resolution prompts
  - id: itm_4fec6600c1a268eda002876460db4695
    name: revisioned mutations
  - id: itm_78d59df9fd5b435c0dd6b24d3d2280f0
    name: Hierarchical visualizations
  - id: itm_ebbdff241d66be59986871bb86f764c5
    name: evidence and intent inspectors
actions:
  - id: itm_4f0482b1685ad78278b5e4e0a3edf629
    name: switch views
  - id: itm_7b3bf1fc1ae9a163b889e1087f92cd99
    name: Search and expand subgraphs
  - id: itm_88c19056587269cabcbcd109dfd98ad0
    name: recover from missed generations
  - id: itm_aed1b25b52c3021ea65d947872734a02
    name: inspect provenance
  - id: itm_cfcca5911ebc1bd7ba330649df1e7a8d
    name: edit through application operations
relationships:
  - id: rel_051e050761ff0ce0862dc9b3e6709ab3
    type: relates-to
    target: ent_a6986962855e978def377010e81d8784
    description: Uses Application Service only
groma.md/first-delivery: "4"
groma.md/relationship-declarations:
  - edgeIds:
      - rel_051e050761ff0ce0862dc9b3e6709ab3
    key: decl_9d70c2e3a91430c118b4fec323d15615
    status: edge
    text: Uses Application Service only
  - key: decl_6da2dc7a9377a32ebe6f4e0127dd40ec
    status: constraint
    text: does not access Markdown or SQLite
  - key: decl_4688d09669d1be2fcfa97e851bebe9f0
    status: constraint
    text: replaces the disposable local artifact as the default interactive experience for bare `groma` when the long-lived service is available
groma.md/seed-key: web-surface
---

# Intent

Give humans a scalable visual environment for understanding and editing the aggregate blueprint.
