const instructionDirectory = `## More instructions

Run groma instructions for human guides and groma agent-instructions for agent operating rules.`

export const overview = `# Overview

Groma is this repository's architecture in Git: Markdown that people and agents can read, and one C4 world that its viewers can walk. Solid boxes exist. Ghosts are drafts. Groma is the only writer of files in the selected groma/ or .groma/ directory.

## How it works

\`\`\`text
source code ──scan──▶ groma|.groma/*.md ──view──▶ maps
                                 ▲
                  add · draft · edit · relate · remove
\`\`\`

## Workflow

1. groma web — scan this repo and open the browser map.
2. groma view — scan this repo and open the terminal map. groma view --plain prints the existing world as text without scanning. groma view <id|path> prints one existing record.
3. groma scan — scan this repo. Prints ok and a short summary. It does not print the architecture. The scanner alone creates systems, containers and components; nothing hand-writes them.
4. Change the architecture through Groma, not by editing its files.
   - groma add — declare a person, an external system, or a draft; the scanner never sees those.
   - groma draft — a new system, container or component becomes a ghost at the path it will keep.
   - groma edit — rename, update meaning or technology, tag a part with a draft, group scan evidence, move an empty scanned component, combine empty scan records, or change the project record.
   - groma relate — author one collaboration between existing parts.
   - groma remove — take away a person, an external, a ghost, or a draft nothing belongs to.
5. groma accept <id> — accept a ghost only if a scan has matched it. The file stays where it is; only its status changes.

## Rules of engagement

- Do not edit files under the selected Groma directory by hand.
- The architecture id is the kebab-case id in Markdown. Source code is evidence.
- A scan never accepts a ghost.
- Every id is unique: one file per part, for its whole life.

${instructionDirectory}`

export const authoring = `# Authoring

Say what must be true, not how to build it. Do not specify frameworks, file layouts, or implementation detail unless a requirement forces it.

- Person or outside system: groma add actor <name> --overview <markdown> [--description <text>], groma add external <name> [--technology <text>] --overview <markdown> [--description <text>]
- Draft record: groma add draft <name> --overview <markdown>
- New part: groma draft <kind> <name> [--parent <id>] --overview <markdown> [--description <text>] [--technology <text>] [--draft <draft-id>]
  Kinds are system, container, and component. The id is the kebab-case of the name and stays that id when accepted. --draft names the draft record the ghost belongs to.
- Part an existing draft touches: groma edit <id> --draft <draft-id>
  Same box, still solid; the tag says the draft changes it.
- Rename a part or a draft record, id unchanged: groma edit <id> --title <text>
- Technology of an element: groma edit <id> --technology <text>. Pass an empty value to remove it.
- Current long overview: groma edit <id> --overview <markdown>
- Optional concise description: groma edit <id> --description <text>. Pass an empty value to remove it.
- Group or ungroup a component: groma edit <id> --group <name> or groma edit <id> --ungroup
- Move an empty scanned component: groma edit <id> --parent <container-id>
- Combine empty scan records into one responsibility: groma edit <target-id> --combine <source-id...>
- Collaboration: groma relate <source-id> <target-id> --description <prose> --technology <text>
- Remove the only collaboration between two parts: groma relate <source-id> <target-id> --remove
- Draft outcome prose: groma edit <draft-id> --overview <markdown>
- Project record: groma edit project [--title <text>] [--description <text>] [--overview <markdown>]
- Remove a person, an external, a ghost, or a draft no ghost belongs to: groma remove <id>. It refuses while other parts relate to it, while a ghost still contains parts, or while ghosts carry the draft's tag, and it never removes scanned software.

Containers need a system parent. Components need a container parent. An external system has no containers. Structural edits refuse to remove authored prose or relationships.

${instructionDirectory}`

export const humanInstructionGuides = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'what Groma is and how it works',
    content: overview,
  },
  {
    id: 'authoring',
    title: 'Authoring',
    description: 'draft and change architecture',
    content: authoring,
  },
] as const

export function humanInstructionGuide(id: string | undefined) {
  const selected = id ?? 'overview'
  return humanInstructionGuides.find(guide => guide.id === selected)
}
