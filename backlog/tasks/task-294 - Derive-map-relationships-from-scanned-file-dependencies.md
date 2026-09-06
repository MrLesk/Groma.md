---
id: TASK-294
title: Derive architecture relationships from used and authored file connections
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 22:47'
updated_date: '2026-09-06 07:48'
labels: []
dependencies: []
references:
  - architecture-model
  - scan-lifecycle
  - authoring
  - commands
  - typescript-scanner
  - architecture-reader
  - plain-text-view
  - architecture-writer
  - web-viewer-authoring
  - web-viewer-details
  - render
  - sheet-composition
  - iso-map
  - iso-camera
  - screen
  - c-scanner
  - source-relationships
  - coding-agent
  - human-architect
  - draft
  - edit
  - init-command
  - observed-curation
  - project-initialization
  - welcome
  - accept
  - project-profile
  - world-loader
  - scanner-modules
  - details
  - navigation-history
  - navigation
  - projection
  - work-focus
  - backlog-plugin
  - terminal-host
  - component-tasks
  - export
  - flow-controls
  - page
  - project-editor
  - revision-history
  - source-viewer
  - task-diff
  - web-server
  - work-overlay
modified_files:
  - src/types.ts
  - src/code-reference.ts
  - src/scan-reconciler.ts
  - src/architecture-markdown.ts
  - src/source-relationships.ts
  - src/architecture-model.ts
  - src/move.ts
  - src/curate.ts
  - src/relation.ts
  - test-bun/source-relationships.test.ts
  - docs/component-markdown.md
  - docs/product-model.md
  - docs/agent-instructions/index.md
  - src/instructions.ts
  - test/architecture-model.test.ts
  - test-bun/okf-writers.test.ts
  - plugins/scanners/typescript/package.json
  - plugins/scanners/typescript/src/source-usage.ts
  - plugins/scanners/typescript/src/graph.ts
  - bun.lock
  - test-bun/typescript-source-usage.test.ts
  - test-bun/scanner-evidence.test.ts
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - src/okf-profile.ts
  - src/architecture-reader.ts
  - src/relationship-markdown.ts
  - src/plain-world.ts
  - src/core.ts
  - src/markdown-emitter.ts
  - src/viewers/web/chrome/relate.ts
  - src/viewers/web/editing/gestures.ts
  - src/viewers/web/organisms/relationship-details.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/edit.ts
  - src/remove.ts
  - >-
    test/fixtures/containers-view/groma/systems/shop/containers/web/components/page.md
  - >-
    test/fixtures/containers-view/groma/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/core-view/groma/systems/shop/containers/api/components/inventory.md
  - >-
    test/fixtures/core-view/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/edit/groma/systems/shop/containers/api/components/stock.md
  - test/fixtures/edit/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/flows/groma/actors/requester.md
  - test/fixtures/flows/groma/systems/service/containers/api/components/entry.md
  - >-
    test/fixtures/flows/groma/systems/service/containers/api/components/worker.md
  - test/fixtures/large-world/groma/actors/merchant.md
  - test/fixtures/large-world/groma/actors/shopper.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-cache.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-config.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-logger.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-queue.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-reader.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-router.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-session.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-validator.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-worker.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/catalog-api/components/catalog-api-writer.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-cache.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-config.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-logger.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-queue.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-reader.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-router.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-session.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-validator.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-worker.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/import/components/import-writer.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-cache.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-client.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-config.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-logger.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-queue.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-reader.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-router.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-session.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-validator.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-worker.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/media/components/media-writer.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-cache.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-config.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-logger.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-queue.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-reader.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-router.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-session.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-validator.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-worker.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/pricing/components/pricing-writer.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-cache.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-config.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-logger.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-queue.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-reader.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-router.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-session.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-validator.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-worker.md
  - >-
    test/fixtures/large-world/groma/systems/catalog/containers/product-db/components/product-db-writer.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-cache.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-config.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-logger.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-queue.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-reader.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-router.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-session.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-validator.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-worker.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/accounts/components/accounts-writer.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-cache.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-client.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-config.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-logger.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-queue.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-reader.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-router.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-session.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-validator.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-worker.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/audit/components/audit-writer.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-cache.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-config.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-logger.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-queue.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-reader.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-router.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-session.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-validator.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-worker.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/auth/components/auth-writer.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-cache.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-config.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-logger.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-queue.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-reader.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-router.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-session.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-validator.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-worker.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/directory/components/directory-writer.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-cache.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-config.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-logger.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-queue.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-reader.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-router.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-session.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-validator.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-worker.md
  - >-
    test/fixtures/large-world/groma/systems/identity/containers/sessions/components/sessions-writer.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-cache.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-config.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-logger.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-queue.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-reader.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-router.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-session.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-validator.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-worker.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/cart/components/cart-writer.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-cache.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-config.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-logger.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-queue.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-reader.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-router.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-session.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-validator.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-worker.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/checkout/components/checkout-writer.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-cache.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-client.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-config.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-logger.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-queue.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-reader.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-router.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-session.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-validator.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-worker.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/events/components/events-writer.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-cache.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-config.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-logger.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-queue.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-reader.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-router.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-session.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-validator.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-worker.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-db/components/order-db-writer.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-cache.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-config.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-logger.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-queue.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-reader.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-router.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-session.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-validator.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-worker.md
  - >-
    test/fixtures/large-world/groma/systems/orders/containers/order-service/components/order-service-writer.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-cache.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-config.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-logger.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-queue.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-reader.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-router.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-session.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-validator.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-worker.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/cdn-edge/components/cdn-edge-writer.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-cache.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-config.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-logger.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-queue.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-reader.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-router.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-session.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-validator.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-worker.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/mobile-api/components/mobile-api-writer.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-cache.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-config.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-logger.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-queue.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-reader.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-router.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-session.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-validator.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-worker.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/search/components/search-writer.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-cache.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-client.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-config.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-logger.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-queue.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-reader.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-router.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-session.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-validator.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-worker.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/session-store/components/session-store-writer.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-cache.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-config.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-gateway.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-logger.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-mapper.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-metrics.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-queue.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-reader.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-router.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-scheduler.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-session.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-validator.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-worker.md
  - >-
    test/fixtures/large-world/groma/systems/storefront/containers/web-app/components/web-app-writer.md
  - test/fixtures/openclaw-view/groma/actors/operator.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/agent-runtime/container.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/channels/container.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/cli/components/cli-implementation.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/gateway/components/gateway-implementation.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/cli/container.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/control-ui/components/control-ui-implementation.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/control-ui/container.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/channels/components/channels-implementation.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/agent-runtime/components/agent-runtime-implementation.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/gateway/container.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/node/components/node-implementation.md
  - >-
    test/fixtures/openclaw-view/groma/systems/openclaw/containers/node/container.md
  - test/fixtures/plain-view/groma/actors/buyer.md
  - >-
    test/fixtures/plain-view/groma/systems/shop/containers/api/components/stock.md
  - >-
    test/fixtures/plain-view/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/validate/groma/actors/buyer.md
  - test/fixtures/validate/groma/systems/shop/system.md
  - test/fixtures/viewer-view/groma/actors/shop-architect.md
  - test/fixtures/viewer-view/groma/actors/shop-operator.md
  - >-
    test/fixtures/viewer-view/groma/systems/shop/containers/order-viewer/components/order-page.md
  - >-
    test/fixtures/viewer-view/groma/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/viewer-view/groma/systems/shop/containers/gateway/components/router.md
  - >-
    test/fixtures/viewer-view/groma/systems/shop/containers/stock-viewer/components/stock-page.md
  - >-
    test/fixtures/viewer-view/groma/systems/shop/containers/api/components/pricing.md
  - test/fixtures/viewer-view/groma/systems/shop/system.md
  - test/fixtures/containers-view/groma/relationships.md
  - test/fixtures/core-view/groma/relationships.md
  - test/fixtures/edit/groma/relationships.md
  - test/fixtures/flows/groma/relationships.md
  - test/fixtures/large-world/groma/relationships.md
  - test/fixtures/openclaw-view/groma/relationships.md
  - test/fixtures/plain-view/groma/relationships.md
  - test/fixtures/validate/groma/relationships.md
  - test/fixtures/viewer-view/groma/relationships.md
  - plugins/scanners/typescript/src/scan.ts
  - src/sheet/relationships.ts
  - src/sheet/types.ts
  - src/sheet/route-geometry.ts
  - src/sheet/scene.ts
  - src/viewers/web/iso/paint-routes.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/camera.ts
  - src/viewers/tui/projection.ts
  - src/cli.ts
  - test-bun/flows.test.ts
  - scripts/validate-architecture.ts
  - test/architecture-model-helpers.ts
  - test/architecture-model-errors.test.ts
  - test/architecture-reader.test.ts
  - test/validate-architecture.test.ts
  - test/curate.test.ts
  - test/edit.test.ts
  - test/cli-view.test.ts
  - test/relation.test.ts
  - test-bun/editing.test.ts
  - test/remove.test.ts
  - test-bun/web-authoring.test.ts
  - groma/actors/coding-agent.md
  - groma/actors/human-architect.md
  - groma/systems/groma/containers/cli/components/commands.md
  - groma/systems/groma/containers/cli/components/draft.md
  - groma/systems/groma/containers/cli/components/edit.md
  - groma/systems/groma/containers/cli/components/init-command.md
  - groma/systems/groma/containers/cli/components/observed-curation.md
  - groma/systems/groma/containers/cli/components/plain-text-view.md
  - groma/systems/groma/containers/cli/components/project-initialization.md
  - groma/systems/groma/containers/cli/components/welcome.md
  - groma/systems/groma/containers/core/components/accept.md
  - groma/systems/groma/containers/core/components/architecture-reader.md
  - groma/systems/groma/containers/core/components/architecture-writer.md
  - groma/systems/groma/containers/core/components/project-profile.md
  - groma/systems/groma/containers/core/components/sheet-composition.md
  - groma/systems/groma/containers/core/components/world-loader.md
  - groma/systems/groma/containers/scanner/components/c-scanner.md
  - groma/systems/groma/containers/scanner/components/scan-lifecycle.md
  - groma/systems/groma/containers/scanner/components/scanner-modules.md
  - groma/systems/groma/containers/scanner/components/source-relationships.md
  - groma/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/systems/groma/containers/terminal-viewer/components/details.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/navigation-history.md
  - groma/systems/groma/containers/terminal-viewer/components/navigation.md
  - groma/systems/groma/containers/terminal-viewer/components/projection.md
  - groma/systems/groma/containers/terminal-viewer/components/screen.md
  - groma/systems/groma/containers/terminal-viewer/components/work-focus.md
  - groma/systems/groma/containers/view-host/components/backlog-plugin.md
  - groma/systems/groma/containers/view-host/components/terminal-host.md
  - groma/systems/groma/containers/web-viewer/components/component-tasks.md
  - groma/systems/groma/containers/web-viewer/components/export.md
  - groma/systems/groma/containers/web-viewer/components/flow-controls.md
  - groma/systems/groma/containers/web-viewer/components/page.md
  - groma/systems/groma/containers/web-viewer/components/project-editor.md
  - groma/systems/groma/containers/web-viewer/components/render.md
  - groma/systems/groma/containers/web-viewer/components/revision-history.md
  - groma/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/systems/groma/containers/web-viewer/components/task-diff.md
  - groma/systems/groma/containers/web-viewer/components/web-server.md
  - groma/systems/groma/containers/web-viewer/components/web-viewer-details.md
  - groma/systems/groma/containers/web-viewer/components/work-overlay.md
  - groma/relationships.md
  - groma/systems/groma/containers/cli/components/agent-instructions.md
  - groma/systems/groma/containers/cli/components/instructions.md
  - groma/systems/groma/containers/core/components/architecture-model.md
  - groma/systems/groma/containers/core/components/authoring.md
  - groma/systems/groma/containers/core/components/groma-filesystem.md
  - groma/systems/groma/containers/core/components/search.md
  - groma/systems/groma/containers/core/components/sheet-routing.md
  - groma/systems/groma/containers/scanner/components/large-world-fixture.md
  - groma/systems/groma/containers/scanner/components/scan-observation.md
  - groma/systems/groma/containers/terminal-viewer/components/chrome.md
  - groma/systems/groma/containers/terminal-viewer/components/flow.md
  - groma/systems/groma/containers/terminal-viewer/components/hierarchy.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/terminal-painting.md
  - groma/systems/groma/containers/view-host/components/architecture-watch.md
  - groma/systems/groma/containers/view-host/components/read-read.md
  - groma/systems/groma/containers/view-host/components/revisions.md
  - groma/systems/groma/containers/view-host/components/viewer-semantics.md
  - groma/systems/groma/containers/view-host/components/work-projection.md
  - groma/systems/groma/containers/view-host/components/work-source-contract.md
  - groma/systems/groma/containers/web-viewer/components/control.md
  - groma/systems/groma/containers/web-viewer/components/iso-camera.md
  - groma/systems/groma/containers/web-viewer/components/iso-map.md
  - groma/systems/groma/containers/web-viewer/components/iso-projection.md
  - groma/systems/groma/containers/web-viewer/components/layer-modes.md
  - groma/systems/groma/containers/web-viewer/components/motion.md
  - groma/systems/groma/containers/web-viewer/components/popover.md
  - groma/systems/groma/containers/web-viewer/components/relationship-card.md
  - groma/systems/groma/containers/web-viewer/components/session.md
  - groma/systems/groma/containers/web-viewer/components/stats.md
  - groma/systems/groma/containers/web-viewer/components/view.md
  - groma/systems/groma/containers/web-viewer/components/web-shell.md
  - groma/systems/groma/containers/web-viewer/components/web-viewer-authoring.md
  - groma/systems/groma/containers/web-viewer/components/web-viewer-hierarchy.md
  - test-bun/projection-routes.test.ts
ordinal: 333000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer scans a project and gets connections backed by resolved source usage, without unused imports creating arrows. A developer can also declare a code interaction between exact source files, such as an HTTP client and endpoint with no import between them. Each file has one component owner; core derives component, container, and system connections from file ownership. Actor and external-system relationships remain explicit concept declarations. Replace the prototype component-addressed code relationship behavior and document the agreed model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The TypeScript scanner uses an AST and binding resolution for its supported source files: unused or shadowed import bindings do not add dependencies, actual value and type uses do, and explicit initialization imports are retained. Existing supported C# evidence follows the same rule.
- [x] #2 Authored code relationships use exact source-file endpoints, survive rescans without matching imports, and are never authored between internal C4 elements. Actor and external-system declarations remain supported.
- [x] #3 Core preserves one owner per file, combines file connections by their current component owners, keeps internal connections off the map, and projects connections to container and system views without losing authored evidence or meaning.
- [x] #4 CLI and web authoring select the participating files and support the existing relationship lifecycle. Normal reads, flows, historical reads, and exports use the same stored connections.
- [x] #5 The live Groma example follows the new contract through Groma writers; raw Backlog remains unannotated and is rescanned for human review. No compatibility or migration layer is introduced.
- [x] #6 Documentation describes the approved rules, focused behavioral tests and bun run check pass, and required simplicity, specification, quality, and complexity reviews pass.
- [x] #7 For two-way computed dependencies between components, the map uses the direction with more distinct supporting file pairs; ties retain both directions. Both directions and their counts remain inspectable, and authored interactions keep their declared direction.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the relationship contract with file-addressed code declarations and a common ownership projection, retaining concept declarations for actors and external systems. Keep the existing draft/current lifecycle and readable Markdown links. 2. Replace TypeScript import-text extraction with AST-backed used binding discovery and verify the existing C# semantic path; preserve the supported file inventory, current ownership, used type references, and initialization imports. 3. Update authoring, readers, structural operations, flows, and viewers to use the new connection endpoints. Recreate affected prototype examples through Groma APIs with concrete file evidence. 4. Update product and agent documentation; run focused supported-flow checks, cold simplicity review, implementer specification and quality reviews, full-context complexity review, and repository checks. 5. Resume TASK-156 measurements on the corrected complete graphs and finish actual web-map delivery. Automatic component grouping is not part of this revision.

Apply the requested dominant-direction display rule to two-way computed component dependencies, preserving underlying file evidence and authored interaction direction. Verify unequal counts and ties without inferring runtime behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented scanner target persistence and core projection; scanner modules are unchanged. Focused tests cover raw scan/reload, directed pairs, move/combine aggregation, internal-edge suppression, rescan removal, and the existing relationship editor. The first aggregation test exposed that scanner placement gives the fixture multiple containers, so the test now uses the supported move operation before combining and verifies connections survive it. Existing authored relationships remain part of this bounded revision; broader relationship lifecycle and file reassignment are not implemented here.

Cold simplicity review passed with no blocking findings. Accepted the SourceEvidence naming and authored-relationship wording suggestions. Full checks initially exposed authored-row ambiguity being collapsed by the projection; the implementation now retains authored rows so the existing flow validation still rejects ambiguity. Updated two metadata expectations for the new fields. Final bun run check passed with 106 Node tests and 315 Bun tests. Backlog.md/.groma was deleted and recreated through Groma writers; its fresh scan has 212 singleton components, 62 inferred containers, and 774 directed file/component dependencies. Verified zero authored component bodies, element descriptions, groups, actors, external systems, flows, or drafts. The project profile uses the neutral initialization overview required by Groma.

Implementer specification review: scanner discovery is unchanged; persisted dependencyFiles and core ownership projection satisfy raw creation, reload/export reuse, aggregation, and rescan-removal criteria. Fresh Backlog data verifies the requested absence of annotations. Implementer quality review: authored provenance preserves existing structural operations and relationship editing; existing flow ambiguity validation remains intact; changed functions pass the complexity limit. No blocking code findings remain. The raw viewer is starting on port 4748 with EMPTY_WORK_SOURCE; rendered delivery is still being verified.

Full-context complexity review passed for the bounded experiment and confirmed raw viewer delivery as the remaining gate. Manual rendering of the unchanged raw graph exposed a reproducible performance problem: Libavoid processTransaction stays CPU-bound for multiple minutes. A read-only timing probe measures placement about 125 ms and endpoint setup about 150 ms, isolating the delay to routing. Investigating the existing route configuration without removing or curating any of the 774 relationships; no production routing changes yet.

A separate read-only TypeScript scan confirms exact equality: 774 scanner dependency pairs and 774 core pairs, with zero missing or extra connections. Saved raw CLI output is /tmp/backlog-raw-groma.txt (1051 lines). Viewer delivery remains incomplete: default Libavoid routing stays CPU-bound for minutes; temporary probes that reduced routing work completed but failed the existing no-shared-path check. No production renderer changes were made and no dependencies were filtered. Asked Alex whether to extend the work into renderer repair or review the raw text first. TASK-294 remains In Progress; AC 5 is not checked.

Alex approved implementation after the design discussion on 2026-09-06. The authored-authoritative curated-map workaround and blanket type-only filtering are rejected. Agreed rules: AST-backed actual usage; one file owner and many users; authored code relationships between files, including an HTTP client-to-endpoint pair with no import; shared core projection to architecture levels; actors/external systems remain declared concepts. User explicitly asked to fold these rules into docs and code and continue the performance goal. The preceding blocked-audit condition is resolved; a fresh audit applies if a new blocker appears.

Alex supplied an external design review as suggestions, not an implementation mandate. Applied the bounded correction: aggregation preserves source-dependency meaning at every ownership level, and matching endpoints do not let an authored interaction replace or verify a computed source dependency. Keep both claims and their file witnesses; scans never accept draft intent. Separate view modes, a broad evidence taxonomy, unresolved observations, new providers, and automatic grouping remain outside this approved revision.

Revised implementation passes bun run check: 106 Node tests and 320 Bun tests. Cold simplicity review has no blocking findings; applied removal of unused aggregate and dialog fields, moved file ownership next to projection, and reused loaded relationship-removal context. The same full check passes after those changes. CLI lifecycle and HTTP authoring checks use exact files; deleting a permitted actor now removes its outgoing shared-record rows, restoring the existing removal flow. TUI verified at 120x36 and 200x60 with exact relationship details and unchanged geometry across selection. Browser UI QA is waiting for the Mac to be unlocked. Live Groma has been rewritten through writers: 99 authored claims preserved in relationships.md; raw Backlog was recreated and rescanned with 212 files and 774 connections, zero authored bodies, descriptions, groups, actors, externals, flows or drafts.

The C# scanner now also passes its four tests using a temporary .NET 10.0.400 SDK. The first run waited on an orphaned MSBuild node holding an output pipe; with MSBUILDDISABLENODEREUSE=1 the unchanged suite finishes in about one second, 4 passed, 0 failed. No C# test assertions or timeout limits were weakened.

Implementer specification review: AST binding tests and C# tests cover actual references, unused imports and shadowing. File-level authored claims remain separate from computed claims through rescans, edits, acceptance and grouping; a single owner and hidden internal links are covered. Existing navigation, flow, history, HTTP writer and export tests pass with the new record. Reciprocal projection keeps distinct pair counts and alias identities. Live Groma preserves 99 authored claims through writer-based conversion; raw Backlog remains unannotated. Implementer quality review: checked ownership, lifecycle removal, scanner process closure, exact endpoint writes, and model immutability; no code blocker found. Removed redundant relationship subtitle to follow the UI copy rule. Browser UI verification and dense-map delivery remain explicit completion gates.

Full-context complexity review found one blocking defect: TUI route promotion appended into shared sheet relationshipIds. Copying the array fixes it. The repeated-projection regression test passes, and the targeted re-review reports no remaining complexity finding. Required full check passes with macOS file-watch access: 106 Node tests and 321 Bun tests. The sandboxed check could not start FSEvents; no assertion or lifecycle behavior was changed.

Final implementer review after the projection-array fix: AST/binding and Roslyn usage checks, exact file endpoint authoring, single ownership, authored/computed separation, repeated immutable projection, flows/history/export behavior, and the documented profile are covered by passing checks. All required model reviews pass. The full repository check now passes 106 Node and 317 Bun tests after removal of obsolete Libavoid-only tests by TASK-156. Live Groma remains 83 elements, 218 owned files, 626 computed cross-owner file connections and 99 authored claims. Browser review of authoring, raw-map presentation and relationship counts remains pending because the Mac is locked.

Final browser review passes for the currently supported web surface. Selecting Sheet routing then its relationship to Sheet composition shows both directions with 3 versus 2 distinct supporting file pairs and the dominant Sheet routing to Sheet composition map direction. The Connection selector exposes all exact file pairs and separately labels the authored current interaction. Selecting that authored pair opens its existing Description/Technology editor; Cancel returns to the relationship without modifying data. Reload preserves the relationship selection and both counts. No browser errors. TASK-262 and docs/viewers/web/index.md explicitly keep the unfinished creation toolbar hidden; this task preserves that decision. New draft creation remains available through the CLI, with the updated file-selection dialog wired behind the existing hidden gesture entry. Shared write/lifecycle behavior is covered by the passing authoring tests. Raw Backlog was deleted and rebuilt from scratch at Alex’s request: 275 elements, 774 relationships, zero authored connections, and all 277 files match the prior raw output exactly. The live Groma map renders 348 routes with reciprocal aliases; Backlog renders all 774. Specification and quality review found no remaining blocker within the supported surface.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Source dependencies now follow resolved source usage, retaining actual value/type references and initialization imports while excluding unused or shadowed bindings. Authored code interactions connect exact files and remain separate from scanned claims. Ownership determines their C4 projection; reciprocal computed links use the direction with more distinct file pairs while keeping both counts and authored direction inspectable. Updated the live Groma example through writers and rebuilt raw Backlog without annotations. Browser checks confirm counts, file-pair selection, authored editing and complete map rendering. Existing hidden creation controls remain hidden per TASK-262. All 423 repository tests, C# checks and required reviews pass.
<!-- SECTION:FINAL_SUMMARY:END -->
