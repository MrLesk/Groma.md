export const defaultHostPluginIds = Object.freeze({
  application: "official.application",
  configurationDiscovery: "official.configuration-discovery",
  configurationParser: "official.configuration-parser",
  kernel: "official.kernel",
  model: "official.model",
  persistence: "official.persistence",
  resources: "official.resources",
  surface: "official.surface",
});

export const defaultHostCapabilityIds = Object.freeze({
  configurationDiscovery: "groma.configuration-discovery/v1",
  configurationParser: "groma.configuration-parser/v1",
  graph: "groma.graph/v1",
  invariant: "groma.invariant/v1",
  model: "groma.model/v1",
  operations: "groma.operations/v1",
  queries: "groma.queries/v1",
  resourceMapper: "groma.resource-mapper/v1",
  resources: "groma.resources/v1",
  snapshotStateDecoder: "groma.snapshot-state-decoder/v1",
  store: "groma.intent-store/v1",
  surface: "groma.host-surface/v1",
  transactionEngine: "groma.transaction-engine/v1",
  transactionProvider: "groma.transaction-provider/v1",
  workspace: "groma.workspace/v1",
});
