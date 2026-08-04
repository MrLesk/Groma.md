# Contributing to Groma

Read the [Groma manifesto](MANIFESTO.md) for the product principles that guide contributions. Product behavior and
domain concepts are documented in the [documentation index](docs/index.md).

## Behavior specifications

Groma expresses viewer behavior as Gherkin scenarios. A scenario describes an observable product outcome rather than
browser interactions, terminal keystrokes, or implementation details. When web and terminal viewers provide the same
behavior, they share the same scenario. Surface-specific scenarios are identified explicitly.

Playwright BDD runs these scenarios through surface-specific drivers:

- The web driver uses Playwright to interact with the web viewer.
- The terminal driver runs the real TUI through a pseudoterminal (PTY). It sends input through the PTY and feeds the
  resulting terminal output into `@xterm/headless`, whose terminal state is used for assertions.

The PTY exercises the real terminal process. Xterm models what a terminal displays; it does not replace the process
runner.

## Validation

Groma treats architecture Markdown as a product contract. Architecture validation checks observed architecture and
every plan for valid C4 containment, stable identities, resolvable relationships, and the canonical Markdown structure.

Product-flow verification uses disposable controlled projects to cover observed system-to-container-to-component
navigation, missing-element reconciliation, planned additions and changes, and code-scanning materialization. An
unchanged scanner restart must reproduce an equivalent scan result. Applying that result through Groma core must
preserve an equivalent C4 graph and projection while manual architecture and every named plan remain unchanged.
