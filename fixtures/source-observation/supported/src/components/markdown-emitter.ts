export type GromaComponent = {
  id: "markdown-emitter";
  name: "Markdown emitter";
  description: "Writes bounded observations as canonical component Markdown.";
  technology: "TypeScript";
};

export type GromaRelationships = [
  {
    sourceId: "markdown-emitter";
    targetId: "architecture-workspace";
    description: "Writes generated observed component documents";
    technology: "Markdown";
  },
];

export function emitMarkdown(): string {
  return "canonical Markdown";
}
