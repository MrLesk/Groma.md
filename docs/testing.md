# Testing and validation

## Repository checks

Install the locked dependencies and validate observed architecture, every plan directory, and the automated tests:

```sh
bun install --frozen-lockfile
bun run check
```

## Browser verification

Install Chromium and run the isolated release gate or the full viewer browser suite:

```sh
npx playwright install chromium
npm run test:release-gate
npm run test:viewer:browser
```

`test:release-gate` uses disposable controlled repositories to prove observed system-to-container-to-component
navigation, all four plan comparison states, and the complete `03-code-scanning` materialization story. In the same
open source-blind viewer, one planned component moves from ghost to observed, modified, and ghost again as supported
source is added, changed, and removed.

An unchanged scanner restart must reproduce byte-identical generated Markdown and an equivalent C4 graph and
projection while manual architecture and every named plan remain byte-identical. The release gate starts only disposable
viewers on dynamic ports, so unrelated local services do not block it.

Screenshots and other browser-test artifacts stay outside the repository under
`/tmp/groma-release-gate-playwright-results` for the isolated gate and `/tmp/groma-playwright-results` for the full
browser suite.
