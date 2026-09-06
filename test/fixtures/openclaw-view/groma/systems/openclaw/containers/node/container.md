---
type: C4 Container
title: Node
status: stable
groma:
  id: node
  parent: openclaw
---

A paired companion (macOS menu bar, iOS, Android, or headless
`openclaw node`) on the same WebSocket with `role: node`. It is a
peripheral, not a second Gateway: chats still land on the Gateway, and the
Gateway invokes canvas, camera, screen, location, and local exec on this
device.
