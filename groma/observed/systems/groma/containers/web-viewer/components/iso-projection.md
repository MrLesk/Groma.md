---
id: iso-projection
kind: component
parent: web-viewer
group: "Blueprint map"
code:
  - scanner: typescript
    file: src/viewers/web/iso/project.ts
    dependencies: 6
    dependents: 10
  - scanner: typescript
    file: src/viewers/web/iso/blueprint.ts
    dependencies: 5
    dependents: 2
---

# Iso projection

Projects the shared sheet into one ordered 2:1 isometric scene with blueprint frame, title plate, surfaces, buildings, and routes.
