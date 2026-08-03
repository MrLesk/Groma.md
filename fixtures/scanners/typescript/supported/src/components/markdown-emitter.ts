export type GromaComponent = {
  id: "markdown-emitter";
  name: "Markdown | emitter \\ [safe]";
  description: "Writes *bounded* scan results _without_ ambiguity.";
  technology: "TypeScript | Bun `text`";
};

export type GromaRelationships = [];

export function emitMarkdown(): string {
  return "canonical Markdown";
}
