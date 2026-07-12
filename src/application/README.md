# Application Operations

Presentation-neutral semantic operations shared by CLI, service, and web surfaces.
Operations depend on capabilities and never call storage implementations directly.

`createApplicationOperations` is the shared entry point. Its read surface currently
provides atomic workspace initialization, exact component reads with bounded outgoing
relationships, and deterministic bounded pages for all components, roots, and direct
children. Every page is bound to a graph generation and query context through Core's
opaque continuation cursor contract.

Application code sees stable component identities and content revisions, but never a
canonical resource locator. A host injects the transaction snapshot, transaction
execution, resource-mapping, graph, query, Standard Model, and workspace-initializer
capabilities. Page reads confirm resource revisions in a second snapshot and retry a
configured number of times if the generation changes; empty canonical state remains a
valid empty graph because bootstrap representation belongs to the host.

Mutations use the same injected transaction execution capability. Component creation
supports supplied or minted identities and outgoing ordinary relationships; updates
are sparse and may explicitly upsert or remove only relationships owned by their
source component. Reparenting is a separate operation, and removal fails closed until
children and every incident relationship have been handled explicitly. Mutation
outcomes retain semantic generations, affected stable identities, and component
revisions while omitting transaction resource keys and provider recovery secrets.
