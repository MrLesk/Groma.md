---
type: Groma Flow
title: 'Architect: terminal review'
groma:
  id: architect-terminal-review
---

Read the architecture in the terminal. The screen projects the shared sheet into the current map scope and applies navigation input without changing the authored world.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Human architect][human-architect] | [Screen][screen] | Start terminal review |
| [Screen][screen] | [Projection][projection] | Project the current architecture scope into terminal cells |
| [Projection][projection] | [Sheet composition][sheet-composition] | Read the fixed shared surfaces and relationship routes |
| [Screen][screen] | [Navigation][navigation] | Apply selection and inspection keys to viewer state |

[human-architect]: ../actors/human-architect.md
[screen]: ../systems/groma/containers/terminal-viewer/components/screen.md
[projection]: ../systems/groma/containers/terminal-viewer/components/projection.md
[sheet-composition]: ../systems/groma/containers/core/components/sheet-composition.md
[navigation]: ../systems/groma/containers/terminal-viewer/components/navigation.md
