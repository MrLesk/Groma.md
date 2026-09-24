# Describing elements

Read a record with `groma view <id>` before changing it.

## Writing useful annotations

Write for a developer who knows the language but is new to this project. Use
the C4 meanings in `groma agent-instructions` to decide what the record should
explain.

- The title names the role or responsibility people should recognize on the
  map. A source filename is useful only when it communicates that meaning.
- The description answers what this element does for the project in one short
  summary.
- The overview adds the context needed to understand that responsibility:
  where work enters, the important behavior, and which other parts it relies
  on. Describe only what applies to this element; avoid a file or function
  inventory.
- Technology names the actual implementation or storage technology when it
  helps a reader understand the element. Leave it unset when unknown.

Use code, project documentation, and confirmed user context to support these
claims. Keep useful existing annotations, and report missing knowledge instead
of writing guesses. Optional fields need content only when they add meaning.

## Commands

| Command | Target | Options |
| --- | --- | --- |
| `groma edit <id>` | an element ID: actor, external system, system, container, or component | `--title`, `--description`, `--overview`, `--technology` |
| `groma edit <draft-id>` | a draft ID | `--title`, `--overview` |
| `groma edit project` | the word `project`, meaning the project record | `--title`, `--description`, `--overview` |

`--title` renames the record; its ID stays. An empty `--description` or
`--technology` value removes that field, and an empty `--overview` clears the
body. `groma view` has no `project` target: the project record is
`<groma-root>/project.md`. Read that file, and change it only through
`groma edit project`.

## Description and overview

`--description` is an optional short summary, stored in the standard
`description` field of Open Knowledge Format (OKF). `--overview` is the fuller
explanation in the Markdown body. Ordinary Markdown and OKF readers can read
both; groma.md uses them as the concept's summary and responsibility text. Avoid
repeating the same paragraph in both:

```sh
groma edit entry --description 'Request coordinator' \
  --overview 'Receives requests, validates their input, and dispatches work to the worker.'
```

## Completion check

Every visible element has a responsibility a new reader can understand. Read
the result with `groma view <id>` and check its name and explanation in the map.
The short description and overview should complement each other, and the
record should remain useful as ordinary Markdown outside groma.md.
