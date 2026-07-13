import type { GraphKernel } from "../core/index.ts";
import type { StandardModelCapability } from "../standard-model/index.ts";
import type { ApplicationOperationBounds } from "./contracts.ts";
import type { ApplicationSnapshotStateDecoder } from "./snapshot-state.ts";

export type ApplicationSnapshotStateDecoderBounds = Readonly<
  Pick<
    ApplicationOperationBounds,
    | "maxComponents"
    | "maxEmbeddedItems"
    | "maxRelationships"
    | "maxSnapshotStateDepth"
    | "maxSnapshotStateValues"
  >
>;

export interface ApplicationSnapshotStateDecoderMetadata {
  readonly bounds: ApplicationSnapshotStateDecoderBounds;
  readonly graph: GraphKernel;
  readonly isProxy: ((value: unknown) => boolean) | undefined;
  readonly model: StandardModelCapability;
}

const metadata = new WeakMap<object, ApplicationSnapshotStateDecoderMetadata>();

export function registerApplicationSnapshotStateDecoder(
  decoder: ApplicationSnapshotStateDecoder,
  value: ApplicationSnapshotStateDecoderMetadata,
): ApplicationSnapshotStateDecoder {
  metadata.set(decoder as object, Object.freeze({ ...value }));
  return decoder;
}

export function applicationSnapshotStateDecoderMetadata(
  value: unknown,
): ApplicationSnapshotStateDecoderMetadata | undefined {
  return typeof value === "object" && value !== null ? metadata.get(value) : undefined;
}
