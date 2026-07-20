# Component Model Teaching Examples

These are teaching examples, and they are **noncanonical**: they are not part of Groma's
self-blueprint, they do not define product behavior, and they do not replace the canonical
component model under [`../groma/`](../groma/). Every `ent_`, item, and `rel_` ID below is
made up for illustration and must never be reused. Real canonical state is created through
supported public Groma operations, which mint or validate real IDs.

## Recursive Shopify Blueprint

The original product sketch maps directly to the recursive component model. `Shop` and
`Users` are root components of type `domain`; the Shopify blueprint is their workspace,
not a required parent entity. Every nested box is another component with one structural
parent:

```text
Shop [domain]
├── Cart [component]
├── Orders [component]
│   └── OrderItem [component]
├── Products [component]
└── Shipments [component]

Users [domain]
├── Profile [component]
└── Authentication [component]
    ├── Registration [component]
    └── Login [component]
        └── GoogleLogin [component]
```

This hierarchy may continue to any depth. A component can contain children of its own
type or other types, but a child has only one parent and containment cannot form a cycle.
Actions such as `Add item` and `Remove item` are owned by Cart rather than modeled as
child components. Dependencies or flows between any components—including components in
different roots—use ordinary many-to-many relationships and do not affect containment.

## Ordering System

This example shows how a complex TypeScript ordering system should appear at the
architectural level. It does not reproduce packages, classes, handlers, queues, or
storage layout.

```mermaid
flowchart LR
    Checkout["Checkout"] -->|"Place order request"| Ordering["Ordering"]

    Ordering -->|"Price request"| Pricing["Pricing"]
    Ordering -->|"Reservation request"| Inventory["Inventory"]
    Ordering -->|"Authorization request"| Payments["Payments"]

    Ordering -->|"Order placed"| Fulfillment["Fulfillment"]
    Ordering -->|"Order status changed"| Notifications["Notifications"]

    Fulfillment -->|"Fulfillment status"| Ordering
    Payments -->|"Payment status"| Ordering
    Inventory -->|"Reservation status"| Ordering
```

The component boundaries express ownership:

- **Ordering** owns the durable order and its business lifecycle.
- **Pricing** owns authoritative purchase prices.
- **Inventory** owns availability and reservations.
- **Payments** owns payment authorization, capture, and refund behavior.
- **Fulfillment** owns delivery of accepted orders.
- **Notifications** owns delivery of customer communications.

The following is an illustrative v0.2 `groma/components/Commerce/Ordering.md` document.
Its parent folder mirrors the component hierarchy, while the stable ID inside the file—not
the filename—remains its identity. The IDs are examples only; this is not a file in the
canonical self-blueprint and must not be copied there by hand.

```md
---
schema: groma/component/v0.2
id: ent_00000000000000000000000000000010
name: Ordering
type: service
scale: domain
parent: ent_00000000000000000000000000000001
desired: present
lifecycle: active
---

# Inputs

- Place order request — A customer's confirmed intent to purchase. <!-- groma:item id=inp_example_place_order fields=name,description -->
- Cancel order request — A request to cancel while the lifecycle permits it. <!-- groma:item id=inp_example_cancel_order fields=name,description -->
- Fulfillment status — A meaningful fulfillment progress change. <!-- groma:item id=inp_example_fulfillment_status fields=name,description -->
- Payment status — A meaningful payment state change. <!-- groma:item id=inp_example_payment_status fields=name,description -->

# Outputs

- Order placed — A durable order accepted for fulfillment. <!-- groma:item id=out_example_order_placed fields=name,description -->
- Order rejected — An order that could not be accepted. <!-- groma:item id=out_example_order_rejected fields=name,description -->
- Order cancelled — Confirmation that cancellation completed. <!-- groma:item id=out_example_order_cancelled fields=name,description -->
- Order status changed — A downstream-relevant lifecycle change. <!-- groma:item id=out_example_order_status fields=name,description -->

# Actions

- Place order — Establish a durable order after its conditions are satisfied. <!-- groma:item id=act_example_place_order fields=name,description -->
- Cancel order — Cancel an eligible order and release its commitments. <!-- groma:item id=act_example_cancel_order fields=name,description -->
- Update order progress — Incorporate payment and fulfillment changes. <!-- groma:item id=act_example_update_progress fields=name,description -->

# Relationships

- requires → ent_00000000000000000000000000000020 — Uses an authoritative purchase price. <!-- groma:relationship id=rel_00000000000000000000000000000101 target=ent_00000000000000000000000000000020 description=true -->
- requires → ent_00000000000000000000000000000021 — Requires inventory reservation. <!-- groma:relationship id=rel_00000000000000000000000000000102 target=ent_00000000000000000000000000000021 description=true -->
- requires → ent_00000000000000000000000000000022 — Requires an acceptable payment state. <!-- groma:relationship id=rel_00000000000000000000000000000103 target=ent_00000000000000000000000000000022 description=true -->
- informs → ent_00000000000000000000000000000023 — Provides accepted orders for fulfillment. <!-- groma:relationship id=rel_00000000000000000000000000000104 target=ent_00000000000000000000000000000023 description=true -->

# Intent

Ordering owns the durable business record of a customer's purchase and its lifecycle
from acceptance through cancellation or completion.

It coordinates the conditions required to place an order, but pricing, inventory,
payment processing, fulfillment, and notification delivery remain separate
responsibilities.

## Behavioral notes

An order progresses through meaningful business states such as pending, placed,
cancelled, and completed. Exact storage, state-machine implementation, event transport,
and API technology are intentionally outside the blueprint.

Order placement must not create two orders when the same purchase intent is submitted
more than once. Cancellation is available only while the order's state and downstream
commitments permit it.

## Guarantees

- Every accepted order has a stable identity.
- The same purchase intent does not create duplicate orders.
- An order is not placed without an authoritative price, inventory reservation, and
  acceptable payment state.
- Meaningful lifecycle changes are available to downstream components.
```

The relationship source is implicit in the owning component file. Stable item and relationship
IDs live in unobtrusive HTML comments, so ordinary Markdown readers see names, descriptions,
and connections rather than storage machinery. Everything after the exact `# Intent` heading
is the component's reversible prose; its internal headings remain prose rather than schema.

Frontmatter contains identity and the structural fields that are actually present. Inputs,
outputs, actions, relationships, and intent map directly to readable Markdown sections:

| Ordering concept                             | Representation                       |
| -------------------------------------------- | ------------------------------------ |
| Order lifecycle state                        | `Behavioral notes` prose             |
| Pricing, inventory, and payment requirements | `requires` relationships             |
| Idempotency and acceptance guarantees        | `Guarantees` prose                   |
| Place-order trigger                          | `Place order request` input          |
| Rejection and cancellation outcomes          | Outputs                              |
| Reservation and payment effects              | Relationship and action descriptions |
| Fulfillment and payment events               | Inputs                               |

A TypeScript scanner might observe only this partial evidence:

```text
component candidate: packages/ordering
actions: placeOrder, cancelOrder, updateFulfillmentStatus
relationships: imports pricing, inventory, payments
```

A framework-specific scanner might additionally observe an HTTP input or an emitted
order event. The TypeScript and framework-specific scanners are both partial: neither is
expected to infer lifecycle meaning, idempotency, business guarantees, or why these
responsibilities form separate components. Those remain human- or agent-curated intent.
