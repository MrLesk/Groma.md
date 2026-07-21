# Persistence

Persistence implements Groma's local adapters:

- portable bounded workspace resources with path containment and atomic replacement;
- readable deterministic Markdown intent documents;
- a deterministic JSON evidence index with one bounded shard per observation source;
- stable-ID alias records;
- an atomic local canonical transaction provider and recovery journal;
- an in-memory disposable projection read model.

Canonical Markdown meaning and canonical JSON evidence are the user-owned source of truth. Each
component is a prose-first Markdown document under `groma/components/`; its filename comes from its
name and its folders mirror the parent chain. The stable ID inside the document is the only component
identity. A rename or reparent atomically moves the affected document subtree without turning paths
into identity. Scanner observations never write directly to canonical intent; Application reconciliation
publishes their evidence and automatic component effects together through the transaction provider.
The evidence index names deterministic source shards; rescanning one project/scanner source rewrites
only that shard while the index and unrelated evidence remain byte-stable.

The transaction journal exists narrowly to make a prepared multi-resource canonical mutation atomic
and recoverable. It does not provide durable scanner sessions, projection checkpoints, or generalized
workflow durability.

The projection index rebuilds from one bounded canonical snapshot. It derives deterministic exact,
catalog, search, relation, and adjacency reads plus a content fingerprint. It has no persistent
chunks, Merkle proofs, repair mode, adoption protocol, or canonical authority.

The v0.2 component layout is readable and hierarchy-shaped; the v0.2 evidence layout is bounded and
source-sharded. Explicit migration of v0.1 workspaces remains a separate host workflow. Unsupported
schemas, sibling filename collisions, and ambiguous state fail closed rather than being guessed.
The component reader ignores only the exact incidental operating-system metadata filenames
`.DS_Store`, `Thumbs.db`, and `desktop.ini`; every other unexpected component-tree entry fails with
its canonical path so the workspace can be repaired directly.
