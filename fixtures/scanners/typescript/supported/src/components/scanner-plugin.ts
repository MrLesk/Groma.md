export type GromaComponent = {
  id: "scanner-plugin";
  name: "Scanner plugin";
  description: "Reads the one supported declaration shape without executing code.";
  technology: "TypeScript text";
};

export type GromaRelationships = [
  {
    sourceId: "scanner-plugin";
    targetId: "markdown-emitter";
    description: "Supplies bounded scan results";
    technology: "In-process data";
  },
];

export function scanDeclarations(): string {
  return "read only";
}
