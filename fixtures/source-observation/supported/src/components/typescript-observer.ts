export type GromaComponent = {
  id: "typescript-observer";
  name: "TypeScript observer";
  description: "Reads the one supported declaration shape without executing code.";
  technology: "TypeScript text";
};

export type GromaRelationships = [
  {
    sourceId: "typescript-observer";
    targetId: "markdown-emitter";
    description: "Supplies bounded source observations";
    technology: "In-process data";
  },
];

export function observeDeclarations(): string {
  return "read only";
}
