# PHP scanner validation

The relocated PHP package was checked against a disposable tracked-source copy of
Call for Papers at commit `1cb6783f3379664e3f176e72c5419064ce24dbfd`.
No project dependencies, PHP runtime, Composer, or WordPress were installed.

- Discovery recommended PHP without a Composer manifest.
- All 22 tracked PHP files were inventoried, including mixed PHP/HTML templates.
- Parsing produced 95 declarations, 114 operations, and 700 unresolved calls.
- A combined Java, TypeScript, Angular, and PHP fold assigned every PHP file to
  exactly one component through ordinary Markdown Code references.
- Repeating the fold in reversed scanner order created no elements and left the
  complete architecture unchanged. The combined architecture had 47 relationships;
  unresolved PHP calls did not introduce relationships.

The independent `php-source` fixture verifies exact source positions, nested
callback ownership, ignored files, syntax failure, curation, and live file edits
and additions. A file with a top-level write statement verifies that scanning does
not execute PHP. The relocated-package check runs with only Git on PATH and with
JavaScript network access blocked. The repository check passes.

PHP runtime loading, WordPress hooks, external definitions, and dynamic dispatch
remain unresolved. Their names alone do not establish C4 collaborations or shared
component ownership. See [supported evidence](index.md).
