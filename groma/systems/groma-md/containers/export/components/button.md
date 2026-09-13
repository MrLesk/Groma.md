---
type: C4 Component
title: Shared controls
status: stable
groma:
  id: button
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/atoms/button.ts
      symbol: chromeButton
    - scanner: typescript
      file: src/viewers/web/atoms/chrome.ts
      symbol: chromeCss
    - scanner: typescript
      file: src/viewers/web/atoms/escape.ts
      symbol: escaped
    - scanner: typescript
      file: src/viewers/web/atoms/floating-bar.ts
      symbol: floatingBarCss
    - scanner: typescript
      file: src/viewers/web/atoms/marks.ts
      symbol: MARKS
    - scanner: typescript
      file: src/viewers/web/atoms/popover.ts
    - scanner: typescript
      file: src/viewers/web/atoms/settings-dialog.ts
    - scanner: typescript
      file: src/viewers/web/atoms/text.ts
  group: Map controls
---

Supplies the buttons, dialogs, menus, and text styles used by the browser panels.
