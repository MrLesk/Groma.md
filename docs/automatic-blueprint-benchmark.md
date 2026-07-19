# Automatic blueprint fixture

The first useful Groma experience is the local loop:

```text
groma init
groma scan
groma
```

Verification should answer one product question: does that loop produce a bounded, honest,
understandable blueprint from supported source evidence without network access, AI calls, project
code execution, or manual repair?

Use a few representative end-to-end fixtures rather than a scoring framework or certification
harness. Each fixture should prove only high-value observable behavior:

- a supported TypeScript/Bun project produces a nonempty current blueprint;
- unchanged runs preserve canonical bytes and stable identities;
- ambiguous or partial source evidence creates no invented architectural meaning;
- failed or interrupted scans preserve curated intent and the last complete blueprint;
- the first visual layer stays bounded while every omitted component remains reachable through
  focus or detail.

Groma's own repository is the primary dogfood fixture. One small external project may guard against
self-specific assumptions. Exact scanner output, curated names, component counts, layout positions,
or a numeric comprehension score are not product contracts.
