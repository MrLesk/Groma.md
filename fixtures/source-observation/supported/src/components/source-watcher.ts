export type GromaComponent = {
  id: "source-watcher";
  name: "Source watcher";
  description: "Requests a complete observation after supported source changes.";
  technology: "Bun filesystem events";
};

export type GromaRelationships = [
  {
    sourceId: "source-watcher";
    targetId: "typescript-observer";
    description: "Requests a fresh bounded observation";
    technology: "In-process event";
  },
  {
    sourceId: "source-watcher";
    targetId: "architecture-workspace";
    description: "Limits refreshes to the owned component directory";
    technology: "Filesystem boundary";
  },
];

export function settleSourceChange(): string {
  return "observe";
}
