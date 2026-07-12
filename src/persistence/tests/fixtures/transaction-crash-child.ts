import {
  TransactionEngine,
  parseEntityId,
  parseRelationId,
  parseResourceKey,
  type ResourceKey,
} from "../../../core/index.ts";
import {
  createStandardModelCapability,
  createStandardModelInvariant,
} from "../../../standard-model/index.ts";
import {
  createLocalResourceProvider,
  type LocalResourceFaultPhase,
} from "../../local-resource-provider.ts";
import {
  createLocalTransactionJournal,
  createMarkdownIntentTransactionAdapter,
} from "../../local-transaction-journal.ts";
import { createMarkdownIntentStore, markdownIntentLocator } from "../../markdown-intent-store.ts";

const [
  workspaceRoot,
  coordinationRootInput,
  mode,
  faultPhaseInput,
  faultLocator,
  faultOccurrenceInput,
] = process.argv.slice(2);
if (
  workspaceRoot === undefined ||
  coordinationRootInput === undefined ||
  (mode !== "create" && mode !== "delete") ||
  faultPhaseInput === undefined ||
  faultLocator === undefined ||
  faultOccurrenceInput === undefined
) {
  throw new Error("transaction crash fixture received invalid arguments");
}

const faultPhase = faultPhaseInput as LocalResourceFaultPhase;
const faultOccurrence = Number(faultOccurrenceInput);
if (!Number.isSafeInteger(faultOccurrence) || faultOccurrence <= 0) {
  throw new Error("transaction crash fixture received an invalid fault occurrence");
}
const entityId = (value: number) => {
  const parsed = parseEntityId(`ent_${value.toString(16).padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid fixture entity ID");
  return parsed.value;
};
const relationId = (value: number) => {
  const parsed = parseRelationId(`rel_${value.toString(16).padStart(32, "0")}`);
  if (!parsed.ok) throw new Error("invalid fixture relation ID");
  return parsed.value;
};
const resourceFor = (id: ReturnType<typeof entityId>): ResourceKey => {
  const locator = markdownIntentLocator(id);
  if (!locator.ok) throw new Error("invalid fixture resource locator");
  const resource = parseResourceKey(locator.value);
  if (!resource.ok) throw new Error("invalid fixture resource key");
  return resource.value;
};

let armed = false;
let matchingOccurrences = 0;
const resources = await createLocalResourceProvider({
  workspaceRoot,
  ...(coordinationRootInput === "-" ? {} : { coordinationRoot: coordinationRootInput }),
  faultInjector(phase, context) {
    if (armed && phase === faultPhase && String(context?.locator) === faultLocator) {
      matchingOccurrences += 1;
      if (matchingOccurrences === faultOccurrence) process.exit(86);
    }
  },
});
const model = createStandardModelCapability();
const store = createMarkdownIntentStore({ model, resources });
const provider = createLocalTransactionJournal({
  adapter: createMarkdownIntentTransactionAdapter({ model, store }),
  resources,
});
const engine = new TransactionEngine({
  maxAffectedIdentities: 100,
  maxRequestDataDepth: 30,
  maxRequestDataValues: 10_000,
  maxSnapshotStateDepth: 30,
  maxSnapshotStateValues: 100_000,
  provider,
});
const registered = engine.registerInvariant(
  createStandardModelInvariant({
    maxComponentMutations: 20,
    maxComponents: 20,
    maxOwnerCharacters: 100,
    maxPinnedComponentIds: 20,
    maxRelationshipMutations: 20,
    maxRelationships: 20,
  }),
);
if (!registered.ok) throw new Error("fixture invariant registration failed");

const shop = entityId(1);
const orders = entityId(2);
let request: Parameters<TransactionEngine["execute"]>[0];
if (mode === "create") {
  request = {
    affected: { entities: [shop, orders], relations: [relationId(1)] },
    context: {
      ownership: { owner: "curated", plane: "intent" },
      pinnedComponentIds: [],
    },
    expectedRevisions: [
      { expected: null, resource: resourceFor(shop) },
      { expected: null, resource: resourceFor(orders) },
    ],
    mutation: {
      components: [
        { component: { id: shop, intent: "Own commerce.", type: "domain" }, type: "create" },
        {
          component: { id: orders, intent: "Place orders.", parent: shop, type: "service" },
          type: "create",
        },
      ],
      relationships: [
        {
          relationship: {
            id: relationId(1),
            payload: { description: "Shop requires Orders." },
            source: shop,
            target: orders,
            type: "requires",
          },
          type: "upsert",
        },
      ],
    },
  };
} else {
  const loaded = await store.load();
  if (!loaded.ok) throw new Error("fixture could not load deletion state");
  const shopDocument = loaded.value.documents.find((document) => document.entity.id === shop);
  const ordersDocument = loaded.value.documents.find((document) => document.entity.id === orders);
  if (shopDocument === undefined || ordersDocument === undefined) {
    throw new Error("fixture deletion state is incomplete");
  }
  request = {
    affected: { entities: [shop, orders], relations: [relationId(1)] },
    context: {
      ownership: { owner: "curated", plane: "intent" },
      pinnedComponentIds: [],
    },
    expectedRevisions: [
      { expected: shopDocument.revision, resource: shopDocument.resource },
      { expected: ordersDocument.revision, resource: ordersDocument.resource },
    ],
    mutation: {
      components: [
        { id: shop, patch: { intent: "Delete Orders durably." }, type: "patch" },
        { id: orders, type: "remove" },
      ],
      relationships: [{ id: relationId(1), type: "remove" }],
    },
  };
}

if (typeof process.send !== "function") throw new Error("transaction crash fixture requires IPC");
armed = true;
process.send({ type: "armed" });
const outcome = await engine.execute(request);
process.send({ outcome, type: "unexpected-completion" });
process.exit(2);
