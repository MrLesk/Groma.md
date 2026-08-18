---
id: doc-1
title: Semantic city layout evaluation
type: other
created_date: '2026-08-18 19:33'
updated_date: '2026-08-18 19:34'
---
# Semantic city layout evaluation (for Codex)

Date: 2026-08-18  
Repository commit: current `main` plus this slice (TASK-93, depends on TASK-92 `770baf5`)  
Question: Can ELK produce a city from the semantic view without inheriting hidden children, and can it keep Shop / people / siblings in place across Enter?

This is an evaluation. Viewers still paint the old world-layout city.

## Pipeline under test

```
Authored architecture
        ↓
world-layout (existing ELK, full nest)   ← still what viewers use
        ↓
semanticView                             ← TASK-92
        ↓
layoutSemanticView (fresh ELK)           ← this slice, strategy A
preserveSemanticAnchors                  ← this slice, strategy B
```

`semanticView` decides visibility, collapsed sizes, and promoted edges.  
`layoutSemanticView` feeds **only those items** to ELK. Hidden components never enter the graph. A parent with displayed children is given no fixed size; ELK wraps the visible children.  
`preserveSemanticAnchors` keeps Context origins for items that already existed and runs ELK only on the new children inside the entered parent.

Code: `src/semantic-view.ts`, `src/semantic-layout.ts`  
Tests: `test-bun/semantic-view.test.ts`, `test-bun/semantic-layout.test.ts`

## Measurements

### Hand-built Shop (world box 200×400, stacked Web 200 tall)

| Stage | Shop bounds |
| --- | --- |
| World (simulating inflated ELK parent) | 100.0, 0.0 — **200×400** |
| Semantic view (no ELK) | 100.0, 0.0 — **44×40** |
| Fresh ELK, Context | 68.0, 12.0 — **44×40** |
| Fresh ELK, Containers | 69.5, 12.0 — **136×84** |
| Pinned, Containers | 68.0, 12.0 — **164×96** |

Fresh ELK origin deltas, Context → Containers:

| Item | From | To | Δ |
| --- | --- | --- | --- |
| shop | 68.0, 12.0 | 69.5, 12.0 | +1.5, 0 |
| buyer | 12.0, 12.0 | 12.0, 40.0 | 0, +28 |
| git | 140.0, 12.0 | 233.5, 24.0 | **+93.5, +12** |

Pinned deltas: shop, buyer, git all **(0, 0)**.

### viewer-view fixture after current `layoutArchitectureWorld`

World Shop is **415×234** (four containers, components inside). Vault is a sibling external system.

| Stage | Shop bounds |
| --- | --- |
| World | 144.5, 12.0 — **415×234** |
| Semantic Context | 144.5, 12.0 — **44×40** |
| Fresh ELK, Context | 88.0, 18.7 — **44×40** |
| Fresh ELK, Containers | 101.5, 12.0 — **236×162** |
| Pinned, Containers | 88.0, 18.7 — **234×180** |

Fresh ELK origin deltas, Context → Containers:

| Item | Δ |
| --- | --- |
| shop | +13.5, −6.7 |
| shop-architect | 0, +22.3 |
| vault | **+205.5, +5.3** |

Pinned deltas: all **(0, 0)**.

## Findings

1. **ELK can size the semantic graph.** Once hidden components are absent, Context Shop is the intrinsic 44×40. It does not inherit Terminal-viewer / Web-stack height. That answers Codex’s first concern: collapse must happen before layout, and ELK will respect it if that is what it is given.

2. **Fresh ELK cannot keep anchors across Enter.** The Containers graph is different (Shop becomes a parent wrapping Api/Web). Layered layout re-places roots. People move a little; the sibling system jumps a lot (git +93, vault +205). Shop itself also drifts. So “stable position while retaining a readable collapsed representation” is **not** free from a second ELK pass.

3. **A pin-and-pack pass does keep anchors.** Reuse Context origins for Shop, people, and siblings. Lay out only the new containers inside Shop. Shop grows down/right from the same origin (44×40 → ~164×96 on the hand fixture, 44×40 → 234×180 on viewer-view). Still far below the inflated world parent (400 / 234). Children sit inside that plate.

4. **ELK remains useful behind the semantic contract.** It is a good engine for (a) the Context root graph and (b) packing newly revealed children. It should not own visibility, and it should not be asked to re-solve the whole city on Enter if origin stability is required.

5. **Not evaluated here:** routing quality of promoted edges, Components-level pack, whether pinned Shop growth can overlap a nearby sibling if Context packed them tightly. viewer-view Vault was 72 units to the right of Context Shop (88+44=132 vs 160); pinned Shop grows to width 234 and **would overlap Vault** unless the camera, spacing, or a later collision pass moves the sibling. That is a follow-up, not a reason to go back to full-nest layout.

## Recommendation

Keep ELK. Do not replace it in this slice.

Adopt:

```
semanticView → layoutSemanticView at Context
Enter → preserveSemanticAnchors (pin existing, ELK only new children)
```

Do not adopt “run layered ELK on the whole semantic graph at every level” if people and sibling systems must not jump.

Renderers still should not paint this city until the overlap/collision question on pinned growth is decided.

## Checks

```
bun test test-bun/semantic-view.test.ts   # 4 pass
bun test test-bun/semantic-layout.test.ts # 4 pass
bunx tsc --noEmit                         # clean
```

No TUI or web paint changes. No architecture Markdown changes.
