---
type: Groma Flow
title: Process a request
description: Complete two units of requested work.
groma:
  id: process-request
---

The requester submits work. The entry coordinates two calls to the worker and receives progress between them.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Requester](../actors/requester.md) | [Entry][entry] | Submit the request |
| [Entry][entry] | [Worker][worker] | Run the first unit |
| [Worker][worker] | [Entry][entry] | Report progress |
| [Entry][entry] | [Worker][worker] | Run the second unit |

[entry]: ../systems/service/containers/api/components/entry.md
[worker]: ../systems/service/containers/api/components/worker.md
