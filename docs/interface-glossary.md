# Interface glossary proposal — the few, simple elements

> Product decision input, 2026-07-19. Prompted by the "Periodic Table of Software" (115 elements for any SaaS product): Groma deliberately keeps only the few elements an architecture map needs — roughly 19 of 115 — and gives each one a plain surface word. Expert vocabulary (projection, reconciliation, binding, observation session, ...) stays in ARCHITECTURE.md, JSON envelopes, and diagnostics, but never in first-run UI prose.

## Nouns (10)

| Surface word     | Canonical term                                                          | Periodic element | Meaning                                                                                          |
| ---------------- | ----------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| **blueprint**    | blueprint (the workspace around the roots; also the whole-map CLI noun) | none             | The whole map of your system, kept as files you can read.                                        |
| **component**    | component (the single canonical entity kind)                            | none             | One named part of the system, and parts can live inside bigger parts.                            |
| **relationship** | relationship (relates-to edges; requires / informs as type words)       | none             | A line saying one part works with another, like 'needs' or 'tells'.                              |
| **intent**       | intent (the curated data plane)                                         | Note (18)        | The words a person or agent wrote about what a part is for.                                      |
| **evidence**     | evidence (the observed data plane, with provenance)                     | Audit (115)      | The facts the scan found in the real code, kept beside what people wrote and never on top of it. |
| **plan**         | plan (desired-state overlay)                                            | Plan (24)        | A page that says what the map should look like later.                                            |
| **project**      | project (registered project: name, source, scanners, coverage)          | Project (13)     | One codebase Groma is allowed to look at.                                                        |
| **scanner**      | scanner (blind scanner plugin)                                          | none             | A helper that reads your code and reports what it sees, without ever seeing your map.            |
| **scale**        | scale (closed curated axis: system, domain, part, element)              | none             | How big a part is: the whole system, a domain, a part, or an element. Unset means undecided.     |
| **shared**       | shared (explicit flag, orthogonal to scale and type)                    | none             | A badge for a part that more than one domain uses.                                               |

## Verbs (7)

| Surface word | Canonical term                                                       | Periodic element | Meaning                                                                                    |
| ------------ | -------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| **scan**     | scan (observation session + reconciliation)                          | Import (70)      | Look at the code and put what is really there onto the map without erasing anyone's words. |
| **add**      | create                                                               | Create (61)      | Put a new part on the map.                                                                 |
| **update**   | update                                                               | Update (62)      | Change what a part says.                                                                   |
| **move**     | reparent                                                             | none             | Put a part inside a different parent, or make it a top-level part.                         |
| **merge**    | merge (supersession + alias)                                         | none             | Squish two copies of the same part into one, and the old name still finds it.              |
| **remove**   | remove                                                               | Delete (64)      | Take a part off the map.                                                                   |
| **accept**   | explicit binding (accepting a scanner candidate into curated intent) | Approve (76)     | Say yes to something the scan suggested so it becomes a real part of the map.              |

## Views (5)

| Surface word | Canonical term                                                               | Periodic element | Meaning                                                                                |
| ------------ | ---------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| **map**      | projection (the visual blueprint; disposable, fully rebuildable)             | Map (91)         | A picture of the parts and the lines between them, never too big to look at.           |
| **tree**     | overview (bounded terminal hierarchy overview; component roots/children)     | Tree (100)       | An outline showing which parts live inside which parts.                                |
| **list**     | paged reads (component list, blueprint export/search pages, cursor, hasMore) | List (87)        | A plain batch of parts, a few at a time, with a note when there are more.              |
| **detail**   | component get (single-component read)                                        | Detail (96)      | One part's own page: what it is for, what goes in, what comes out, and what it can do. |
| **history**  | planned `rev:<ref>` historical view (read-only Git revision view)            | Timeline (92)    | A later view of how the map looked before.                                             |

## Plain narration vocabulary

Approved plain-English translations for narrating Groma to a general audience. (Originally
drafted for an earlier kid-language guide; the mappings remain the approved plain-word source for
first-run prose and narration.)

| Groma term                 | Plain words                                                     |
| -------------------------- | --------------------------------------------------------------- |
| blueprint                  | the map                                                         |
| component                  | a part of the system                                            |
| relationship               | a line between parts                                            |
| requires / informs         | needs / tells                                                   |
| intent                     | what we want it to do                                           |
| evidence                   | what we really found                                            |
| scan                       | look at the code                                                |
| scanner                    | the helper robot that looks at code (it never peeks at our map) |
| reconcile / reconciliation | tidy the new findings into the map without breaking anything    |
| projection                 | the picture (we can always draw it again)                       |
| plan                       | what the map should become                                      |
| candidate / suggestion     | a guess you can say yes or no to                                |
| accept                     | say yes to a guess                                              |
| ignore                     | say no thanks (we still keep the note)                          |
| binding                    | a match                                                         |
| merge                      | squish two copies of the same part into one                     |
| alias / supersession       | the old name still works                                        |
| drift                      | the code and the map stopped matching                           |
| canonical                  | the real copy                                                   |
| workspace                  | Groma's folder                                                  |
| project                    | the code we look at                                             |
| root                       | the biggest parts                                               |
| parent / child             | the part it lives in / the parts inside it                      |
| inputs / outputs / actions | what goes in / what comes out / what it can do                  |
| cursor / hasMore           | there is more - ask again                                       |
| scale                      | how big a part is (system, domain, part, or element)            |
| unscaled                   | we have not said how big it is yet                              |
| shared                     | used by more than one domain                                    |
| bounded                    | never too big                                                   |
| fail closed                | when unsure, stop and ask                                       |
| revision                   | the version number you saw                                      |
| planned rev:<ref> history  | how the map looked before                                       |
| observation session        | one whole look (it only counts if it finishes)                  |
| plugin                     | an add-on helper                                                |
| indeterminate              | we are not sure it saved - go check first                       |

## Design notes

The decisions behind the counts:

1. **Free words, taught nowhere.** init, get, list, status, preview, apply, enable, disable,
   inspect, search, and export are ordinary English and keep their periodic mappings silently
   (Search 66, Export 71, View 65). The glossary spends slots only on words carrying
   Groma-specific meaning.
2. **Hidden-but-retained expert layer.** node, projection, reconciliation, binding, observation
   session, candidate, canonical, supersession, alias, data plane, generation, cursor, bounded,
   envelope, provenance, handoff, and quarantine remain in ARCHITECTURE.md, JSON envelopes, and
   diagnostics — but never in first-run UI prose or bare-groma output. Each has a plain surface
   phrase (map, tidy-in, match, one scan run, suggestion, the real copy, old name still works,
   next-page code, never too big).
3. **Kept property elements not listed as nouns.** ID (50) is load-bearing (stable opaque IDs
   are identity; names and paths are not) and Status (36) appears as the lifecycle/desired
   fields. Both stay field names, not glossary nouns.
4. **Honesty constraints enforced.** No surface verb implies execution (no
   run/trigger/schedule/apply-a-plan); 'plan' is always something Groma shows, never something
   Groma does; tasks are explicitly Backlog.md's job, reflected in dropping
   Task/Subtask/Workflow/Kanban.
5. **Positioning in one line.** Of the 115 elements, Groma keeps about 19 (Project 13, Note 18,
   Plan 24, Status 36, ID 50, Create 61, Update 62, Delete 64, Search 66, Import 70, Export 71,
   Approve 76, Reject 77 as 'ignore', List 87, Map 91, Timeline 92, Detail 96, Tree 100, Audit
   115), repurposes four (Plan from pricing to desired future, Import as scan, Approve as
   accept, Audit as evidence), drops the other ~96 with reasons, and adds six of its own:
   component, blueprint, relationship, scanner, scale, shared — the periodic table reduced to what an
   architecture map needs.
6. **Resolved and open product flags.** The [Manifesto](../MANIFESTO.md) promise now has a
   working local loop: `groma init -> groma scan -> groma` in an interactive terminal. 'project'
   stays, but UI prose should always say 'scanned project'. The blueprint-vs-component CLI split
   should converge so whole-map reads live under blueprint and single-part reads under component,
   matching the noun glossary.
7. **Scale is closed; provenance words stay off surfaces (decided 2026-07-20).** The document
   pivot adds exactly two surface words: _scale_ (a closed curated axis — system, domain, part,
   element — with unscaled as the honest undecided state) and _shared_ (a badge for parts used
   by more than one domain). The type token stays open flavor and never carries size.
   _source-boundary_ is not a surface word or a component type: it is evidence vocabulary, a
   declared-boundary measurement a scanner reports. _external_ is not a type either: ownership
   is an explicit flag. Scanners measure and never classify, so no scanner vocabulary ever
   names a scale.
8. **Node has exactly one name (decided 2026-07-19).** The drawn element keeps the single name
   _node_, and it is expert vocabulary only. The visual uses it once in compact technical count
   metadata; its primary labels remain component names and, for a folded node, a count (for
   example "Payments +37"). The earlier "box" narration word is retired. "group" was considered
   and rejected: most nodes show exactly one component, and group reads as canonical containment
   — the very confusion the component/node distinction exists to prevent.
