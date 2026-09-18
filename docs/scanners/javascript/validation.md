# JavaScript scanner validation

The packaged JavaScript scanner was checked against a disposable tracked-source
copy of [wifi-densepose](https://github.com/ruvnet/wifi-densepose) at commit
`66392cb4e209aced5ef591e7a1c31b4e0d024bdb`. No Node.js packages, bundler or
project build were installed or run.

- Discovery recommended JavaScript from source files alone, without a package
  manifest rule.
- 47 authored files were inventoried with 122 declarations, 1,249 operations,
  758 of them carrying body tokens, and 4,762 calls, every one unresolved.
- 579 files under `vendor/` stayed out through the shared Git boundary.
- Repeating the scan produced identical evidence. The first fold created 49
  elements; folding the same evidence again created none and refreshed the same
  47 files.
- `groma lint` reported 32 findings in that project's JavaScript, including a
  JSON helper copied between two `.cjs` files.
- All three `fetch` calls in its authored JavaScript were reported: a URL a local
  variable computes as unknown, a literal `/api/v1/status`, and a configured
  `/health/live` following `API_CONFIG.BASE_URL`. Its other calls go through a
  local helper, which is unsupported, and its JavaScript declares no endpoint, so
  no HTTP row was derived there.
- Each scan of the whole project finished in under a second.

The minified rules were measured against 137 authored candidate files in four
JavaScript repositories. The longest-lined authored file averaged 57 characters
per line. Exactly one file reached the 500-character average: a built asset under
an ordinary `.js` name, which the rule excluded. Vendored and built directories
are already outside the shared Git boundary.

The independent `javascript-source` fixture verifies ECMAScript modules,
CommonJS, JSX, a browser script whose top-level calls belong to the module,
exact source positions, tokens on named bodies only, and the exclusion of a
`.min.js` name, of a long-lined bundle, and of the TypeScript file beside them.
`javascript-outline` verifies the declaration list and the module, CommonJS and
script visibility rules, including a CommonJS file that publishes a function value
and keeps its own helpers private; `javascript-parity` verifies that one body
tokenizes identically under this scanner and the TypeScript scanner;
`javascript-duplicates` verifies the identical and near-duplicate bodies
`groma lint` reports and the callbacks and recursive namesakes it does not;
`javascript-http` verifies each supported client and router, including the jQuery
ajax helpers and a Koa router's own and nested prefixes, the configured, dynamic
and unknown request paths, every construct that reports nothing, and the rows core
derives from those facts. The packaged check runs with
only Git on PATH and with JavaScript network access blocked. The repository check
passes.

Module loading, dynamic dispatch, external symbols and framework wiring remain
unresolved, and the HTTP facts cover the clients and routers
[the scanner page lists](index.md#http-facts). Names alone do not establish C4
collaborations or shared component ownership. See
[supported evidence](index.md).
