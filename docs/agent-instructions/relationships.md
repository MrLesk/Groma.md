# Relationships and flows

A relationship states that a source uses a target. A flow orders existing
relationships into one scenario a human needs to understand. A flow is
supporting scenario knowledge over C4 relationships, not another C4 element or
container.

## Derived and authored relationships

Scanners return temporary source and operation evidence. Core applies the
[shared inference rules](https://github.com/MrLesk/Groma.md/blob/main/docs/relationship-inference.md#current-inference-rule)
and writes the interactions it selects under `Derived relationships` in
`relationships.md`. It does not store raw dependency graphs or put every used
import on the map. The rules cover concretely supplied named callbacks, and
HTTP requests whose scanners report a certain endpoint match. Ordinary calls
and unresolved wiring need your interpretation.

Author the interactions the rules cannot see, including an HTTP call whose
scanner reports no facts or whose target is uncertain. For the same file pair,
current authored text takes precedence, and editing a derived row makes it
authored. Scans refresh evidence without rewriting, verifying, or accepting
authored rows. Parents summarize the same claim; an aggregate path does not
establish a runtime workflow.

## Commands

| Command | Targets |
| --- | --- |
| `groma add relation <source> <target> --description <prose> --technology <text>` | two endpoints; writes one current authored row per ordered pair |
| `groma draft relation <source> <target> --description <prose> --technology <text>` | two endpoints; plans a link, even between existing components |
| `groma accept relation <source> <target>` | the endpoints of a draft relationship; scans never accept it |
| `groma edit relation <source> <target> [--description <prose>] [--technology <text>]` | the endpoints of an existing relationship; its lifecycle stays |
| `groma remove relation <source> <target>` | the endpoints of a draft relationship that no flow uses |
| `groma add flow <title> --overview <prose> --steps <markdown-table>` | the title of a new flow; its ID is the title in kebab case |
| `groma edit <flow-id> [--title <text>] [--overview <prose>] [--steps <markdown-table>]` | a flow ID |
| `groma remove <flow-id>` | a flow ID |

Endpoints between software elements are exact repository-relative source files,
each owned by a component. Component, container, and system IDs are refused
there. When either endpoint is an actor or external system, endpoints may be
element IDs. Current relationships cannot be removed, including after explicit
acceptance.

For a relationship, `--description` states what the source does with the
target, and `--technology` states how they interact.

## Flow steps

Choose the exact ordered steps the human needs to understand. Do not include
every connection a component can reach. This example assumes actor
`requester`, and components `entry` and `worker` under container `api` in
system `service`. The directed relationships `requester -> entry` and
`entry -> worker` must already exist; a flow uses those collaborations and does
not create them.

```sh
groma add flow 'Submit a request' \
  --overview 'The requester submits work; entry delegates it to the worker.' \
  --steps '| From | To | Action |
| --- | --- | --- |
| [Requester](../actors/requester.md) | [Entry](../systems/service/containers/api/components/entry.md) | Submit work |
| [Entry](../systems/service/containers/api/components/entry.md) | [Worker](../systems/service/containers/api/components/worker.md) | Process the request |'
groma view submit-a-request
```

Groma writes `<groma-root>/flows/submit-a-request.md`. Each step stores From,
To, and Action columns and links each endpoint to its C4 Markdown document.
Links resolve relative to that flow document, not the shell's working
directory, and work the same under `groma/` and `.groma/`. Table order is
execution order, and each row must match an existing directed relationship.

The browser groups a flow under the actor that starts its first step, so this
flow appears under Requester. In that actor's details, its flows appear
directly without repeating the actor heading.
