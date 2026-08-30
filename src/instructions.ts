export const overview = `# Overview

Groma is this repository's architecture in Git. Solid boxes exist. Ghosts are next. Groma is the only writer of files under groma/.

## Workflow

1. groma web — scan this repo and open the browser map.
2. groma view — scan this repo and open the terminal map. groma view --plain prints the existing world as text without scanning. groma view <id|path> prints one existing record.
3. groma scan — scan this repo. Prints ok and a short summary. It does not print the architecture.
4. Change the architecture through Groma, not by editing groma/ files.
   - groma create — a new part becomes a ghost in a plan.
   - groma create --observed — author a semantic part that already exists without source evidence.
   - groma edit — update meaning, group scan evidence, move an empty scanned component, or combine empty scan records.
   - groma relate — author one observed collaboration between existing parts.
   - groma edit <id> --plan <plan-id> — restate an existing part as planned.
5. groma accept <id> — accept that ghost only if a scan has matched it.

## Rules of engagement

- Do not edit files under groma/ by hand.
- The architecture id is the kebab-case id in Markdown. Source code is evidence.
- A scan never accepts a ghost.
- Two plans must not claim the same element id.`

export const authoring = `# Authoring

Say what must be true, not how to build it. Do not specify frameworks, file layouts, or implementation detail unless a requirement forces it.

- New part: groma create <name> --plan <plan-id> --kind <kind> [--parent <id>] --description <prose>
  The id is the kebab-case of the name and stays that id when accepted.
- Existing semantic part without source evidence: groma create <name> --observed --kind <kind> [--parent <id>] [--external] [--technology <text>] --description <prose>
- Required change to something that exists: groma edit <id> --plan <plan-id> [--description <prose>]
  Same box, shown as planned until accepted. Omit --description to keep the current lead prose.
- Current meaning of an existing id: groma edit <id> --description <prose>
- Group or ungroup a component: groma edit <id> --group <name> or groma edit <id> --ungroup
- Move an empty scanned component: groma edit <id> --parent <container-id>
- Combine empty scan records into one responsibility: groma edit <target-id> --combine <source-id...>
- Observed collaboration: groma relate <source-id> <target-id> --description <prose> --technology <text>
- Remove the only observed collaboration between two parts: groma relate <source-id> <target-id> --remove
- Plan outcome prose: groma edit <plan-id> --description <prose>

Kinds are actor, system, container, and component. Containers need a system parent. Components need a container parent. Structural edits refuse to remove authored prose or relationships.`
