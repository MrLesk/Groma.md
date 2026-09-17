# Describing elements

Read a record with `groma view <id>` before changing it.

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
both; Groma uses them as the concept's summary and responsibility text. Avoid
repeating the same paragraph in both:

```sh
groma edit entry --description 'Request coordinator' \
  --overview 'Receives requests, validates their input, and dispatches work to the worker.'
```

## Completion check

Every visible element has a responsibility a new reader can understand.
