export type GromaComponent = {
  id: "source-watcher";
  name: "Source watcher";
  description: "Requests a complete scan after supported source changes.";
  technology: "Bun filesystem events";
};

export type GromaRelationships = [
  {
    sourceId: "source-watcher";
    targetId: "scanner-plugin";
    description: "Requests a fresh bounded scan result";
    technology: "In-process event";
  },
  {
    sourceId: "source-watcher";
    targetId: "architecture-workspace";
    description: "Limits scanner output | preserves *other* files";
    technology: "Filesystem \\ boundary";
  },
];

export function settleSourceChange(): string {
  return "scan";
}
